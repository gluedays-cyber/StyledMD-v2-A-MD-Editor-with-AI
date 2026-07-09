package pkg

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// HandleOllamaChat: Ollama API 스트리밍 처리를 수행한다.
func HandleOllamaChat(w http.ResponseWriter, r *http.Request, flusher http.Flusher, config AIConfig, targetModel, sysPrompt, userPrompt string) {
	endpoint, err := Decrypt(config.Ollama.APIKey)
	if err != nil || endpoint == "" {
		endpoint = "http://localhost:11434"
	}

	url := strings.TrimSuffix(endpoint, "/") + "/api/chat"

	payload := map[string]interface{}{
		"model": targetModel,
		"messages": []map[string]string{
			{"role": "system", "content": sysPrompt},
			{"role": "user", "content": userPrompt},
		},
		"stream": true,
		"options": map[string]interface{}{
			"temperature": 0.2,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		sendOllamaError(w, flusher, "❌ Ollama 요청 직렬화 오류: "+err.Error())
		return
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		sendOllamaError(w, flusher, "❌ Ollama 요청 생성 오류: "+err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{
		Timeout: 120 * time.Second,
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		sendOllamaError(w, flusher, "❌ Ollama 연결 오류: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBody []byte
		buf := make([]byte, 1024)
		if n, readErr := resp.Body.Read(buf); readErr == nil {
			errBody = buf[:n]
		}
		sendOllamaError(w, flusher, fmt.Sprintf("❌ Ollama API 오류 (HTTP %d): %s", resp.StatusCode, string(errBody)))
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		var chunk struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			Done bool `json:"done"`
		}
		if err := json.Unmarshal([]byte(line), &chunk); err != nil {
			continue
		}

		if chunk.Message.Content != "" {
			outData, err := json.Marshal(map[string]interface{}{
				"thinking": "",
				"response": chunk.Message.Content,
				"done":     false,
			})
			if err == nil {
				fmt.Fprintf(w, "data: %s\n\n", outData)
				flusher.Flush()
			}
		}
		if chunk.Done {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		sendOllamaError(w, flusher, "❌ Ollama 스트림 읽기 오류: "+err.Error())
		return
	}

	doneData, _ := json.Marshal(map[string]interface{}{
		"thinking": "",
		"response": "",
		"done":     true,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}

func sendOllamaError(w http.ResponseWriter, flusher http.Flusher, errMsg string) {
	outData, _ := json.Marshal(map[string]interface{}{
		"response": errMsg,
		"done":     true,
	})
	fmt.Fprintf(w, "data: %s\n\n", outData)
	flusher.Flush()
}
