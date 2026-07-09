import { state } from './state.js';

const aiChatModal = document.getElementById('ai-chat-modal');
const aiChatTitle = document.getElementById('ai-chat-title');
const aiSelectedTextCaption = document.getElementById('ai-selected-text-caption');
const aiChatHistory = document.getElementById('ai-chat-history');
const aiPromptInput = document.getElementById('ai-prompt-input');
const aiChatModelSelect = document.getElementById('ai-modelSelect');
const aiChatModelInfo = document.getElementById('ai-chat-model-info');
const aiChatClose = document.getElementById('ai-chat-close');
const aiChatOk = document.getElementById('ai-chat-ok');
const aiChatInsert = document.getElementById('ai-chat-insert');
const aiChatClear = document.getElementById('ai-chat-clear');

function loadAIConfig() {
    if (!aiChatModelSelect) return;
    fetch('/api/ai-config?_t=' + Date.now())
    .then(res => res.json())
    .then(config => {
        aiChatModelSelect.innerHTML = "";
        let hasAnyModel = false;
        const addGroup = (label, providerName, providerData) => {
            if (providerData && providerData.apiKey && providerData.apiKey.trim() !== "" && providerData.models && providerData.models.length > 0) {
                const group = document.createElement('optgroup');
                group.label = label;
                providerData.models.forEach(model => {
                    const opt = document.createElement('option');
                    opt.value = `${providerName}|${model.name}`;
                    opt.textContent = `✨ ${model.alias}`;
                    group.appendChild(opt);
                    hasAnyModel = true;
                });
                aiChatModelSelect.appendChild(group);
            }
        };
        addGroup("Google API", "google", config.google);
        addGroup("Groq API", "groq", config.groq);
        addGroup("Ollama API", "ollama", config.ollama);
        addGroup("Upstage API", "upstage", config.upstage);
        if (!hasAnyModel) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "(등록된 모델이 없음)";
            aiChatModelSelect.appendChild(opt);
            aiChatModelSelect.value = "";
            localStorage.setItem('selected-ai-model', "");
            return;
        }
        const savedModel = localStorage.getItem('selected-ai-model');
        if (savedModel && Array.from(aiChatModelSelect.options).some(opt => opt.value === savedModel)) {
            aiChatModelSelect.value = savedModel;
        } else {
            if (aiChatModelSelect.options.length > 0) {
                aiChatModelSelect.value = aiChatModelSelect.options[0].value;
                localStorage.setItem('selected-ai-model', aiChatModelSelect.value);
            }
        }
    })
    .catch(err => console.error("API 설정 로드 실패:", err));
}

export function setupAIChat() {
    if (aiChatModelSelect) {
        aiChatModelSelect.addEventListener('change', () => {
            localStorage.setItem('selected-ai-model', aiChatModelSelect.value);
        });
        loadAIConfig();
    }

    const apiKeySetupBtn = document.getElementById('api-key-setup-btn');
    const apiKeyModal = document.getElementById('api-key-modal');
    const apiKeyClose = document.getElementById('api-key-close');
    const apiKeyCancel = document.getElementById('api-key-cancel');
    const apiKeyConfirm = document.getElementById('api-key-confirm');

    const googleApiKey = document.getElementById('google-api-key');
    const googleModel1Name = document.getElementById('google-model1-name');
    const googleModel1Alias = document.getElementById('google-model1-alias');
    const googleModel2Name = document.getElementById('google-model2-name');
    const googleModel2Alias = document.getElementById('google-model2-alias');

    const groqApiKey = document.getElementById('groq-api-key');
    const groqModel1Name = document.getElementById('groq-model1-name');
    const groqModel1Alias = document.getElementById('groq-model1-alias');
    const groqModel2Name = document.getElementById('groq-model2-name');
    const groqModel2Alias = document.getElementById('groq-model2-alias');

    const ollamaApiKey = document.getElementById('ollama-api-key');
    const ollamaModel1Name = document.getElementById('ollama-model1-name');
    const ollamaModel1Alias = document.getElementById('ollama-model1-alias');
    const ollamaModel2Name = document.getElementById('ollama-model2-name');
    const ollamaModel2Alias = document.getElementById('ollama-model2-alias');

    const upstageApiKey = document.getElementById('upstage-api-key');
    const upstageModel1Name = document.getElementById('upstage-model1-name');
    const upstageModel1Alias = document.getElementById('upstage-model1-alias');
    const upstageModel2Name = document.getElementById('upstage-model2-name');
    const upstageModel2Alias = document.getElementById('upstage-model2-alias');

    function closeApiKeyModal() { if (apiKeyModal) apiKeyModal.classList.remove('show'); }
    
    if (apiKeySetupBtn) {
        apiKeySetupBtn.addEventListener('click', () => {
            fetch('/api/ai-config?_t=' + Date.now())
                .then(res => res.json())
                .then(config => {
                    const g = config.google || {};
                    if(googleApiKey) googleApiKey.value = g.apiKey || '';
                    if(googleModel1Name) googleModel1Name.value = (g.models && g.models[0]) ? g.models[0].name : '';
                    if(googleModel1Alias) googleModel1Alias.value = (g.models && g.models[0]) ? g.models[0].alias : '';
                    if(googleModel2Name) googleModel2Name.value = (g.models && g.models[1]) ? g.models[1].name : '';
                    if(googleModel2Alias) googleModel2Alias.value = (g.models && g.models[1]) ? g.models[1].alias : '';
                    
                    const gr = config.groq || {};
                    if(groqApiKey) groqApiKey.value = gr.apiKey || '';
                    if(groqModel1Name) groqModel1Name.value = (gr.models && gr.models[0]) ? gr.models[0].name : '';
                    if(groqModel1Alias) groqModel1Alias.value = (gr.models && gr.models[0]) ? gr.models[0].alias : '';
                    if(groqModel2Name) groqModel2Name.value = (gr.models && gr.models[1]) ? gr.models[1].name : '';
                    if(groqModel2Alias) groqModel2Alias.value = (gr.models && gr.models[1]) ? gr.models[1].alias : '';

                    const ol = config.ollama || {};
                    if(ollamaApiKey) ollamaApiKey.value = ol.apiKey || '';
                    if(ollamaModel1Name) ollamaModel1Name.value = (ol.models && ol.models[0]) ? ol.models[0].name : '';
                    if(ollamaModel1Alias) ollamaModel1Alias.value = (ol.models && ol.models[0]) ? ol.models[0].alias : '';
                    if(ollamaModel2Name) ollamaModel2Name.value = (ol.models && ol.models[1]) ? ol.models[1].name : '';
                    if(ollamaModel2Alias) ollamaModel2Alias.value = (ol.models && ol.models[1]) ? ol.models[1].alias : '';

                    const up = config.upstage || {};
                    if(upstageApiKey) upstageApiKey.value = up.apiKey || '';
                    if(upstageModel1Name) upstageModel1Name.value = (up.models && up.models[0]) ? up.models[0].name : '';
                    if(upstageModel1Alias) upstageModel1Alias.value = (up.models && up.models[0]) ? up.models[0].alias : '';
                    if(upstageModel2Name) upstageModel2Name.value = (up.models && up.models[1]) ? up.models[1].name : '';
                    if(upstageModel2Alias) upstageModel2Alias.value = (up.models && up.models[1]) ? up.models[1].alias : '';

                    if (apiKeyModal) {
                        apiKeyModal.classList.add('show');
                        setTimeout(() => { if (googleApiKey) googleApiKey.focus(); }, 50);
                    }
                })
                .catch(err => console.error("설정 로드 에러:", err));
        });
    }

    if (apiKeyClose) apiKeyClose.addEventListener('click', closeApiKeyModal);
    if (apiKeyCancel) apiKeyCancel.addEventListener('click', closeApiKeyModal);
    if (apiKeyModal) apiKeyModal.addEventListener('click', (e) => { if (e.target === apiKeyModal) closeApiKeyModal(); });

    if (apiKeyConfirm) {
        apiKeyConfirm.addEventListener('click', () => {
            const buildProviderPayload = (keyInput, m1Name, m1Alias, m2Name, m2Alias) => {
                const apiKeyVal = keyInput ? keyInput.value.trim() : '';
                const models = [];
                if (apiKeyVal !== "") {
                    const name1 = m1Name ? m1Name.value.trim() : '';
                    const alias1 = m1Alias ? m1Alias.value.trim() : '';
                    if (name1 && alias1) models.push({ name: name1, alias: alias1 });
                    const name2 = m2Name ? m2Name.value.trim() : '';
                    const alias2 = m2Alias ? m2Alias.value.trim() : '';
                    if (name2 && alias2) models.push({ name: name2, alias: alias2 });
                }
                return { apiKey: apiKeyVal, models: models };
            };
            const payload = {
                google: buildProviderPayload(googleApiKey, googleModel1Name, googleModel1Alias, googleModel2Name, googleModel2Alias),
                groq: buildProviderPayload(groqApiKey, groqModel1Name, groqModel1Alias, groqModel2Name, groqModel2Alias),
                ollama: buildProviderPayload(ollamaApiKey, ollamaModel1Name, ollamaModel1Alias, ollamaModel2Name, ollamaModel2Alias),
                upstage: buildProviderPayload(upstageApiKey, upstageModel1Name, upstageModel1Alias, upstageModel2Name, upstageModel2Alias)
            };
            fetch('/api/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if (!res.ok) throw new Error("저장 실패");
                closeApiKeyModal();
                loadAIConfig();
            }).catch(err => alert("설정 저장에 실패했다: " + err.message));
        });
    }

    function closeAiChatModal() { if (aiChatModal) aiChatModal.classList.remove('show'); }
    if (aiChatClose) aiChatClose.addEventListener('click', closeAiChatModal);
    if (aiChatOk) aiChatOk.addEventListener('click', closeAiChatModal);
    if (aiChatModal) aiChatModal.addEventListener('click', (e) => { if (e.target === aiChatModal) closeAiChatModal(); });

    if (aiChatClear) {
        aiChatClear.addEventListener('click', () => {
            if (aiChatHistory) aiChatHistory.value = "";
            state.lastMarkdownResponse = "";
        });
    }

    if (aiChatInsert) {
        aiChatInsert.addEventListener('click', () => {
            if (!state.editorInstance) return;
            const textToInsert = aiChatHistory ? aiChatHistory.value : state.lastMarkdownResponse;
            if (!textToInsert) return;
            const selection = state.editorInstance.getSelection();
            state.editorInstance.executeEdits("ai-chat-insert", [{ range: selection, text: textToInsert, forceMoveMarkers: true }]);
            state.editorInstance.focus();
            closeAiChatModal();
        });
    }

    function executeAiRequest(instruction) {
        if (!instruction) return;
        const currentDoc = state.editorInstance ? state.editorInstance.getValue() : "";
        state.lastMarkdownResponse = "";
        let fullResponse = "";
        const selectedModel = aiChatModelSelect ? aiChatModelSelect.value : 'gemini-2.5-flash-lite';
        let waitingMsg = '⚡ 답변 준비중...';
        if (selectedModel === 'gemini-2.5-flash') waitingMsg = '🧠 심층 분석 및 추론을 진행하고 있습니다. 잠시만 기다려 주십시오...';

        const currentAnswer = aiChatHistory ? aiChatHistory.value : "";
        if (aiChatHistory) aiChatHistory.value = waitingMsg;

        fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: instruction,
                fullContent: currentDoc,
                selectedContent: state.activeSelectedText,
                currentAnswer: currentAnswer,
                model: selectedModel
            })
        }).then(async response => {
            if (!response.ok) throw new Error('서버 응답 오류 (' + response.status + ')');
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr) continue;
                            const data = JSON.parse(jsonStr);
                            if (data.response) {
                                fullResponse += data.response;
                                state.lastMarkdownResponse = fullResponse;
                                if (aiChatHistory) {
                                    aiChatHistory.value = fullResponse;
                                    aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
                                }
                            }
                            if (data.done && fullResponse === "") {
                                if (aiChatHistory) aiChatHistory.value = '❌ 응답 없음: API 키 또는 네트워크 오류일 수 있다.';
                            }
                        } catch (e) {
                            console.error("JSON 파싱 에러:", e, line);
                        }
                    }
                }
            }
        }).catch(error => {
            console.error("통신 에러 발생:", error);
            if (aiChatHistory) aiChatHistory.value = `❌ 통신 에러 발생!\n${error.message}`;
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('quick-prompt-btn')) {
            const promptType = e.target.getAttribute('data-prompt');
            let instruction = "";
            switch (promptType) {
                case '뜻': instruction = `다음 선택된 부분의 뜻을 설명하라.\n\n선택된 단어: "${state.activeSelectedText}"`; break;
                case '요약': instruction = `다음 선택된 내용을 요점만 항목별로 요약하라.\n\n선택된 내용:\n"${state.activeSelectedText}"`; break;
                case '영어로': instruction = `다음 선택된 내용을 영어로 번역하라.\n\n선택된 내용:\n"${state.activeSelectedText}"`; break;
                case '한글로': instruction = `다음 선택된 내용을 한글로 번역하라.\n\n선택된 내용:\n"${state.activeSelectedText}"`; break;
                case '개념확장': instruction = `다음 선택된 개념을 가르치기 위한 과정을 블릿이 붙은 제목(주제)만을 순서대로 나열하라. 부가 설명은 일절 배제하라.\n\n선택된 개념: "${state.activeSelectedText}"`; break;
                case '개념설명': instruction = `다음 주어진 제목(개념)을 가르치기 위한 상세히 설명하는 내용을 작성하라.\n\n제목: "${state.activeSelectedText}"`; break;
                case '전개예측': instruction = `다음 선택된 내용이 이후에 어떤 내용으로 전개될 것인지 예측하여 본문 컨텐츠를 확장하여 작성하라.\n\n선택된 내용:\n"${state.activeSelectedText}"`; break;
                default: instruction = promptType;
            }
            executeAiRequest(instruction);
        }
    });

    if (aiPromptInput) {
        aiPromptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) return;
                e.preventDefault();
                const val = aiPromptInput.value.trim();
                if (val) {
                    executeAiRequest(val);
                    if (state.promptHistory.length === 0 || state.promptHistory[state.promptHistory.length - 1] !== val) {
                        state.promptHistory.push(val);
                    }
                    state.historyIndex = state.promptHistory.length;
                    aiPromptInput.value = '';
                }
            } else if (e.key === 'ArrowUp') {
                if (state.promptHistory.length > 0) {
                    e.preventDefault();
                    if (state.historyIndex > 0) {
                        state.historyIndex--;
                    } else if (state.historyIndex === -1 || state.historyIndex === state.promptHistory.length) {
                        state.historyIndex = state.promptHistory.length - 1;
                    }
                    aiPromptInput.value = state.promptHistory[state.historyIndex];
                    setTimeout(() => { aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length; }, 0);
                }
            } else if (e.key === 'ArrowDown') {
                if (state.promptHistory.length > 0) {
                    e.preventDefault();
                    if (state.historyIndex >= 0 && state.historyIndex < state.promptHistory.length - 1) {
                        state.historyIndex++;
                        aiPromptInput.value = state.promptHistory[state.historyIndex];
                    } else if (state.historyIndex === state.promptHistory.length - 1) {
                        state.historyIndex = state.promptHistory.length;
                        aiPromptInput.value = '';
                    }
                    setTimeout(() => { aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length; }, 0);
                }
            }
        });
    }
}
