import { state, preview, readToggleBtn, setModifiedState } from './state.js';
import { renderMarkdownWithLines } from './markdown-renderer.js';
import { triggerSaveAction, triggerSaveAsAction, triggerNewFileAction, triggerOpenFileAction, loadDocument } from './file-actions.js';

export function setupEditor() {
    require(['vs/editor/editor.main'], function() {
        const rootStyles = getComputedStyle(document.documentElement);
        const editorFontSize = parseInt(rootStyles.getPropertyValue('--editor-font-size')) || 16;
        const editorFontFamily = rootStyles.getPropertyValue('--code-font-family').trim().replace(/['"]/g, "") || "Fira Code, Consolas, Monaco, monospace";
        const editorLineHeightMultiplier = parseFloat(rootStyles.getPropertyValue('--editor-line-height')) || 1.5;
        const editorLineHeight = Math.round(editorFontSize * editorLineHeightMultiplier);

        monaco.editor.defineTheme('styledmd-theme', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editorCursor.foreground': '#000000',
                'editor.background': '#FDFBF7'
            }
        });

        state.editorInstance = monaco.editor.create(document.getElementById('editor'), {
            value: "",
            language: 'markdown',
            theme: 'styledmd-theme',
            automaticLayout: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            fontSize: editorFontSize,
            fontFamily: editorFontFamily,
            lineHeight: editorLineHeight,
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 12,
            lineNumbersMinChars: 0,
            readOnly: false,
            padding: { top: 10 },
            guides: {
                bracketPairs: false,
                bracketPairsHorizontal: false,
                highlightActiveBracketPair: false,
                indentation: false,
                highlightActiveIndentation: false
            },
            renderLineHighlight: 'none'
        });

        state.editorInstance.updateOptions({ lineNumbers: 'off' });

        state.editorInstance.addAction({
            id: 'ai-chat-popup',
            label: '인공지능 대화 (AI Chat)',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
            contextMenuGroupId: 'navigation',
            run: function(editor) {
                const selection = editor.getSelection();
                const model = editor.getModel();
                let selectedText = "";
                if (selection && model) {
                    selectedText = model.getValueInRange(selection).trim();
                }
                state.activeSelectedText = selectedText;

                const aiChatModal = document.getElementById('ai-chat-modal');
                const aiChatTitle = document.getElementById('ai-chat-title');
                const aiSelectedTextCaption = document.getElementById('ai-selected-text-caption');
                const aiChatHistory = document.getElementById('ai-chat-history');
                const aiPromptInput = document.getElementById('ai-prompt-input');

                if (aiChatModal && aiChatTitle) {
                    if (selectedText) {
                        aiChatTitle.textContent = `AI와의 대화 - 선택 영역: "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"`;
                    } else {
                        aiChatTitle.textContent = "AI와의 대화";
                    }
                    if (aiSelectedTextCaption) {
                        aiSelectedTextCaption.value = selectedText;
                    }
                    if (aiChatHistory) {
                        aiChatHistory.value = "";
                    }
                    aiChatModal.classList.add('show');
                    if (aiPromptInput) {
                        state.historyIndex = state.promptHistory.length;
                        aiPromptInput.focus();
                    }
                }
            }
        });

        state.editorInstance.addAction({
            id: 'change-color-syntax',
            label: '색변경',
            contextMenuGroupId: 'navigation',
            run: function(editor) {
                const selection = editor.getSelection();
                const model = editor.getModel();
                if (selection && model) {
                    const selectedText = model.getValueInRange(selection);
                    if (selectedText) {
                        const textToInsert = `[${selectedText}]{ #000000 bg: #ffffff}`;
                        editor.executeEdits("change-color-syntax", [{ range: selection, text: textToInsert, forceMoveMarkers: true }]);
                    }
                }
            }
        });

        state.editorInstance.onDidChangeModelContent(() => {
            const currentVal = state.editorInstance.getValue();
            if (preview) {
                preview.innerHTML = renderMarkdownWithLines(currentVal);
            }
            setModifiedState(true);
        });

        state.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() { triggerSaveAction(); });
        state.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, function() { triggerSaveAsAction(); });
        state.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, function() { triggerNewFileAction(); });
        state.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, function() { triggerOpenFileAction(); });

        let persistentSelectionDecos = [];
        state.editorInstance.onDidChangeCursorSelection((e) => {
            const selection = e.selection;
            if (!selection.isEmpty()) {
                persistentSelectionDecos = state.editorInstance.deltaDecorations(persistentSelectionDecos, [{
                    range: selection,
                    options: { inlineClassName: 'custom-persistent-selection' }
                }]);
            }
        });

        state.editorInstance.onMouseDown((e) => {
            if (persistentSelectionDecos.length > 0) {
                persistentSelectionDecos = state.editorInstance.deltaDecorations(persistentSelectionDecos, []);
            }
        });

        const isReadModeStored = localStorage.getItem('read-mode') !== 'false';
        let initWidth = 1616;
        if (isReadModeStored) {
            document.body.classList.add('read-mode');
            if (readToggleBtn) readToggleBtn.textContent = '✍️ 편집';
            initWidth = 816;
        } else {
            document.body.classList.remove('read-mode');
            if (readToggleBtn) readToggleBtn.textContent = '📖 읽기';
        }

        fetch('/api/resize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ width: initWidth, height: 960 })
        }).catch(err => console.error("초기 창 크기 설정 실패:", err));

        loadDocument();
    });

    window.addEventListener('resize', () => {
        if (state.editorInstance) {
            state.editorInstance.layout();
        }
    });

    if (preview) {
        preview.addEventListener('scroll', () => {
            if (!state.editorInstance) return;
            const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
            if (previewScrollHeight <= 0) return;
            const scrollPercentage = (preview.scrollTop / previewScrollHeight) * 0.95;
            const editorScrollHeight = state.editorInstance.getScrollHeight() - state.editorInstance.getLayoutInfo().height;
            if (editorScrollHeight <= 0) return;
            state.editorInstance.setScrollTop(editorScrollHeight * scrollPercentage);
        });

        preview.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;
            
            let rawHref = anchor.getAttribute('href');
            if (!rawHref || rawHref.match(/^(https?|mailto|tel):/)) return;
            if (rawHref.startsWith('#')) {
                e.preventDefault();
                const targetId = decodeURIComponent(rawHref.slice(1));
                const target = preview.querySelector('#' + CSS.escape(targetId));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }
            
            e.preventDefault();
            const absoluteUrl = new URL(anchor.href);
            const isMarkdown = absoluteUrl.pathname.toLowerCase().endsWith('.md');
            
            if (isMarkdown) {
                let targetPath = absoluteUrl.pathname;
                if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);
                state.currentPath = targetPath;
                window.history.pushState({}, '', '/?file=' + encodeURIComponent(targetPath));
                loadDocument();
            } else {
                window.location.href = anchor.href;
            }
        });
    }

    window.addEventListener('popstate', () => {
        state.currentPath = new URLSearchParams(window.location.search).get('file') || '';
        loadDocument();
    });

    window.addEventListener('keydown', (e) => {
        const newDocModal = document.getElementById('new-doc-modal');
        const tableModal = document.getElementById('table-modal');
        const apiKeyModal = document.getElementById('api-key-modal');
        const aiChatModal = document.getElementById('ai-chat-modal');

        if (e.key === 'Escape') {
            if (aiChatModal) aiChatModal.classList.remove('show');
            if (newDocModal) newDocModal.classList.remove('show');
            if (tableModal) tableModal.classList.remove('show');
            if (apiKeyModal) apiKeyModal.classList.remove('show');
            return;
        }

        if (e.ctrlKey && e.key === '.') {
            if (state.editorInstance && state.editorInstance.hasTextFocus()) {
                return;
            }
            e.preventDefault();
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            state.activeSelectedText = selectedText;

            const aiChatTitle = document.getElementById('ai-chat-title');
            const aiSelectedTextCaption = document.getElementById('ai-selected-text-caption');
            const aiChatHistory = document.getElementById('ai-chat-history');
            const aiPromptInput = document.getElementById('ai-prompt-input');

            if (aiChatModal && aiChatTitle) {
                if (selectedText) {
                    aiChatTitle.textContent = `AI와의 대화 - 선택 영역: "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"`;
                } else {
                    aiChatTitle.textContent = "AI와의 대화";
                }
                if (aiSelectedTextCaption) {
                    aiSelectedTextCaption.value = selectedText;
                }
                if (aiChatHistory) {
                    aiChatHistory.value = "";
                }
                aiChatModal.classList.add('show');
                if (aiPromptInput) {
                    state.historyIndex = state.promptHistory.length;
                    aiPromptInput.focus();
                }
            }
        }
    });
}
