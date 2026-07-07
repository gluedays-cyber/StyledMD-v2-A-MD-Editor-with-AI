package main

import (
	"time"
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"styledmd/pkg"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

// 전역 변수 선언
var baseDir string    // 애플리케이션의 기본 디렉토리를 저장한다.
var targetFile string // 사용자에게 선택된 파일 경로를 저장한다.
var wv webview2.WebView

//go:embed frontend/*
var frontendFS embed.FS

// 초기화 함수
func init() {
	// 실행 파일의 경로를 가져온다.
	exePath, _ := os.Executable()
	// 실행 파일이 위치한 디렉토리를 baseDir로 설정한다.
	baseDir = filepath.Dir(exePath)
	pkg.BaseDir = baseDir

	// 명령줄 인수가 제공되었는지 확인한다.
	if len(os.Args) > 1 {
		// 두 번째 인수를 절대 경로로 변환하여 targetFile로 설정한다.
		absPath, err := filepath.Abs(os.Args[1])
		if err == nil {
			targetFile = absPath
		} else {
			targetFile = os.Args[1] // 오류 발생 시 인수를 그대로 사용한다.
		}
	} else {
		// 명령줄 인수가 없으면 빈 문자열로 설정하여 빈 페이지로 시작한다.
		targetFile = ""
	}
	pkg.TargetFile = targetFile

	// 초기 웹 루트 디렉토리 설정
	homeDir, err := os.UserHomeDir()
	if err == nil {
		pkg.SetCurrentRootDir(filepath.Join(homeDir, "Documents"))
	} else {
		pkg.SetCurrentRootDir(baseDir)
	}
}

// 메인 함수
func main() {
	// HTTP 핸들러 설정: 웹 서버 기능을 구현한다.
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// API 요청은 /api/ 경로 라우팅으로 분기되므로 무시
		if strings.HasPrefix(r.URL.Path, "/api/") {
			return
		}

		// 특정 경로(`/.app/`)에 대한 요청 처리 (앱 자체 리소스)
		if strings.HasPrefix(r.URL.Path, "/.app/") {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			
			subFS, _ := fs.Sub(frontendFS, "frontend")
			fsrv := http.FileServer(http.FS(subFS))
			http.StripPrefix("/.app/", fsrv).ServeHTTP(w, r)
			return
		}

		// 브라우저의 마크다운 렌더링용 HTML 네비게이션 요청 처리
		isDocReq := r.URL.Path == "/" || strings.HasSuffix(strings.ToLower(r.URL.Path), ".md")
		isHtmlAccept := strings.Contains(r.Header.Get("Accept"), "text/html")

		if isDocReq && isHtmlAccept {
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")

			htmlContent, err := frontendFS.ReadFile("frontend/index.html")
			if err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				htmlStr := string(htmlContent)
				htmlStr = strings.Replace(htmlStr, "script.js?v=2", "script.js", 1)
				ts := time.Now().UnixNano()
				htmlStr = strings.Replace(htmlStr, "script.js", fmt.Sprintf("script.js?v=%d", ts), 1)
				w.Write([]byte(htmlStr))
				return
			}
			http.NotFound(w, r)
			return
		}

		// 그 외 요청(이미지 등)은 현재 웹 루트 디렉토리(currentRootDir) 기준 서빙
		localPath := r.URL.Path
		decodedPath, err := url.PathUnescape(localPath)
		if err == nil {
			localPath = decodedPath
		}

		physicalPath := filepath.Join(pkg.GetCurrentRootDir(), filepath.FromSlash(localPath))

		if info, err := os.Stat(physicalPath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, physicalPath)
			return
		}

		// 파일이 존재하지 않는 경우 404 반환
		fmt.Println("[DEBUG] 404 File Not Found:", physicalPath)
		serve404(w, r)
	})

	// API 엔드포인트 핸들러 등록
	http.HandleFunc("/api/load", pkg.LoadHandler)
	http.HandleFunc("/api/save", pkg.SaveHandler)
	http.HandleFunc("/api/open-dialog", pkg.OpenFileDialogHandler)
	http.HandleFunc("/api/save-dialog", pkg.SaveFileDialogHandler)
	http.HandleFunc("/api/rename", pkg.RenameHandler)
	http.HandleFunc("/api/resize", pkg.ResizeHandler)

	// 이미지 등 정적 파일을 절대 경로 query param으로 서빙한다.
	// URL path에 Windows 드라이브 문자(D:/)가 포함되는 문제를 우회하기 위해 사용한다.
	http.HandleFunc("/api/file", func(w http.ResponseWriter, r *http.Request) {
		filePath := r.URL.Query().Get("path")
		if filePath == "" {
			http.Error(w, "path parameter required", http.StatusBadRequest)
			return
		}
		filePath = filepath.Clean(filePath)
		info, err := os.Stat(filePath)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filePath)
	})

	http.HandleFunc("/api/ai-chat", pkg.AIChatHandler)
	http.HandleFunc("/api/chat", pkg.AIChatHandler)
	http.HandleFunc("/api/ai-prompt-status", pkg.AIPromptStatusHandler)

	http.HandleFunc("/api/ai-config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			pkg.GetAIConfigHandler(w, r)
		case http.MethodPost:
			pkg.SaveAIConfigHandler(w, r)
		case http.MethodDelete:
			pkg.DeleteAIConfigHandler(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	// HTTP 서버를 위한 리스너 설정 (포트 0을 사용하여 시스템이 사용 가능한 포트를 할당하게 한다.)
	listener, _ := net.Listen("tcp", "127.0.0.1:0")
	port := listener.Addr().(*net.TCPAddr).Port // 할당된 포트를 가져온다.
	baseURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	// HTTP 서버를 백그라운드 고루틴에서 실행한다.
	go func() {
		fmt.Printf("SERVER_PORT: %d\n", port)
		_ = http.Serve(listener, nil)
	}()

	// Webview2 창을 초기화한다.
	// 로딩 단계에서 노출되는 덜컥거림을 원천 차단하기 위해 Hidden 속성을 true로 설정한다.
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     true,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "StyledMD - 마크다운 편집기 (Ctrl+. 으로 인공지능 대화창을 연다.)",
			Width:  640,
			Height: 960,
			IconId: 1,
		},
	})
	wv = w
	pkg.Wv = w
	defer w.Destroy() // 함수 종료 시 창을 정리한다.

	hwnd := w.Window() // 창 핸들(HWND)을 가져온다.
	if hwnd != nil {
		user32 := syscall.NewLazyDLL("user32.dll")
		// 데스크탑 화면의 작업 영역(Work Area) 기준 우측 상단 정렬
		monitorFromWindow := user32.NewProc("MonitorFromWindow")
		getMonitorInfoW := user32.NewProc("GetMonitorInfoW")
		setWindowPos := user32.NewProc("SetWindowPos")

		// MONITOR_DEFAULTTOPRIMARY = 1
		hMonitor, _, _ := monitorFromWindow.Call(uintptr(hwnd), 1)

		var monitorInfo pkg.MONITORINFO
		monitorInfo.CbSize = uint32(unsafe.Sizeof(monitorInfo))
		getMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&monitorInfo)))

		workArea := monitorInfo.RcWork
		width := int32(640)
		height := int32(960)

		// Windows 10/11의 투명 그림자 테두리(7px)를 보정하여 화면 우측 가장자리에 완전히 밀착시킨다.
		const borderOffset = 7
		newLeft := workArea.Right - width + borderOffset
		newTop := workArea.Top


		// 3. 보이지 않는 상태에서 크기와 위치를 정밀하게 설정하고 프레임을 갱신한다. (SWP_NOZORDER = 0x0004 | SWP_FRAMECHANGED = 0x0020 -> 0x0024)
		setWindowPos.Call(
			uintptr(hwnd),
			0,
			uintptr(newLeft),
			uintptr(newTop),
			uintptr(width),
			uintptr(height),
			0x0024,
		)

		// 4. 배치가 완전히 끝난 시점에 비로소 창과 브라우저 컴포넌트를 화면에 표시한다. (표준 패키지 사용 시 자동 표출됨)

		// 제목 표시줄 색상을 #c8e8ff로 설정한다.
		// Windows COLORREF는 BGR 순서이므로 #c8e8ff(R=0xC8, G=0xE8, B=0xFF) → 0x00FFE8C8이다.
		// DWMWA_CAPTION_COLOR = 35
		dwmapi := syscall.NewLazyDLL("dwmapi.dll")
		dwmSetWindowAttribute := dwmapi.NewProc("DwmSetWindowAttribute")
		captionColor := uint32(0x00FFE8C8)
		dwmSetWindowAttribute.Call(
			uintptr(hwnd),
			35, // DWMWA_CAPTION_COLOR
			uintptr(unsafe.Pointer(&captionColor)),
			unsafe.Sizeof(captionColor),
		)
	}

	// 웹뷰에 로드할 초기 URL을 설정한다.
	var startURL string
	if targetFile == "" {
		startURL = fmt.Sprintf("%s/", baseURL)
	} else {
		// 고정 루트를 기준으로 입력된 타겟 파일의 상대 경로를 구하여 시작 파라미터에 대입한다.
		relStartPath, err := filepath.Rel(pkg.GetCurrentRootDir(), targetFile)
		if err != nil {
			relStartPath = filepath.Base(targetFile)
		}
		relStartPath = filepath.ToSlash(relStartPath)
		startURL = fmt.Sprintf("%s/?file=%s", baseURL, url.QueryEscape(relStartPath))
	}
	w.Navigate(startURL) // 웹뷰를 해당 URL로 이동시킨다.
	w.Run()              // 웹뷰 이벤트 루프를 시작하여 프로그램을 실행 상태로 유지한다.
}

func serve404(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>404 Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8f5ed;
            color: #242424;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        h1 {
            font-size: 48px;
            margin-bottom: 8px;
            color: #d9383a;
        }
        p {
            font-size: 16px;
            margin-bottom: 24px;
            color: #666;
        }
        button {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            color: #fff;
            background-color: #0070c9;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #147bcd;
        }
    </style>
</head>
<body>
    <h1>404</h1>
    <p>요청하신 파일을 찾을 수 없습니다.</p>
    <button onclick="history.back()">뒤로 가기</button>
</body>
</html>`))
}
