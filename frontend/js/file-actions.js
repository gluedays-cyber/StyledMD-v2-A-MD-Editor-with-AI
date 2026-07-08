import { state, setModifiedState, fileNameInput, preview } from './state.js';
import { renderMarkdownWithLines } from './markdown-renderer.js';

export function triggerNewFileAction() {
    const createEmptyFile = () => {
        const filename = state.currentPath;
        if (!filename) {
            if (state.editorInstance) {
                state.editorInstance.setValue('');
            }
            setModifiedState(false);
            if (fileNameInput) {
                fileNameInput.dataset.baseName = 'Untitled.md';
                fileNameInput.textContent = 'Untitled.md';
            }
            if (preview) {
                preview.innerHTML = '';
            }
        } else {
            window.location.href = '/';
        }
    };

    if (state.isModified) {
        if (confirm("파일이 수정되었다. 저장하겠는가?")) {
            let currentPath = state.currentPath || '';

            if (currentPath && currentPath !== '') {
                fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: currentPath, content: state.editorInstance ? state.editorInstance.getValue() : '' })
                }).then(() => {
                    createEmptyFile();
                }).catch(err => console.error("저장 실패:", err));
            } else {
                fetch('/api/save-dialog?currentPath=')
                .then(res => {
                    if (res.status === 204) return null;
                    return res.json();
                })
                .then(data => {
                    if (data && data.path) {
                        const normalizedPath = data.path.replace(/\\/g, '/');
                        fetch('/api/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: normalizedPath, content: state.editorInstance ? state.editorInstance.getValue() : '' })
                        }).then(() => {
                            createEmptyFile();
                        }).catch(err => console.error("저장 실패:", err));
                    }
                }).catch(err => console.error("파일 저장 창 실행 실패:", err));
            }
        } else {
            createEmptyFile();
        }
    } else {
        createEmptyFile();
    }
}

export function triggerOpenFileAction() {
    const currentPath = state.currentPath || '';

    fetch('/api/open-dialog?currentPath=' + encodeURIComponent(currentPath))
    .then(res => {
        if (res.status === 204) return null;
        return res.json();
    })
    .then(data => {
        if (data && data.path) {
            const normalizedPath = data.path.replace(/\\/g, '/');
            window.location.href = '/?file=' + encodeURIComponent(normalizedPath);
        }
    })
    .catch(err => console.error("파일 열기 실패:", err));
}

export function triggerSaveAsAction() {
    const currentPath = state.currentPath || '';

    fetch('/api/save-dialog?currentPath=' + encodeURIComponent(currentPath))
    .then(res => {
        if (res.status === 204) return null;
        return res.json();
    })
    .then(data => {
        if (data && data.path) {
            const normalizedPath = data.path.replace(/\\/g, '/');
            fetch('/api/save', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ path: normalizedPath, content: state.editorInstance ? state.editorInstance.getValue() : '' }) 
            }).then(() => {
                window.location.href = '/?file=' + encodeURIComponent(normalizedPath);
            }).catch(err => console.error("새 이름으로 저장 실패:", err));
        }
    })
    .catch(err => console.error("파일 저장 창 실행 실패:", err));
}

export function triggerSaveAction() {
    const currentPath = state.currentPath || '';

    if (currentPath && currentPath !== '') {
        if (state.isModified) {
            fetch('/api/save', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ path: currentPath, content: state.editorInstance ? state.editorInstance.getValue() : '' }) 
            }).then(() => {
                setModifiedState(false);
            }).catch(err => console.error("저장 실패:", err));
        }
    } else {
        fetch('/api/save-dialog?currentPath=')
        .then(res => {
            if (res.status === 204) return null;
            return res.json();
        })
        .then(data => {
            if (data && data.path) {
                const normalizedPath = data.path.replace(/\\/g, '/');
                fetch('/api/save', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ path: normalizedPath, content: state.editorInstance ? state.editorInstance.getValue() : '' }) 
                }).then(() => {
                    const parts = normalizedPath.split('/');
                    const filename = parts[parts.length - 1];
                    window.location.href = '/?file=' + encodeURIComponent(filename);
                }).catch(err => console.error("저장 실패:", err));
            }
        })
        .catch(err => console.error("파일 저장 창 실행 실패:", err));
    }
}

export function saveDocumentContent(content) {
    const currentPath = state.currentPath || '';

    fetch('/api/save', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ path: currentPath, content: content }) 
    }).then(() => {
        setModifiedState(false);
    }).catch(err => console.error("임시 저장 실패:", err));
}

export function loadDocument(isRetry = false) {
    const currentPath = state.currentPath || '';

    fetch('/api/load?path=' + encodeURIComponent(currentPath))
    .then(res => {
        if (!res.ok) throw new Error("File not found");
        return res.json();
    })
    .then(data => {
        if (data.filename) {
            state.currentPath = data.filename;
        }

        if (state.editorInstance) {
            state.editorInstance.setValue(data.content);
            state.editorInstance.layout();
            setTimeout(() => {
                state.editorInstance.layout();
            }, 50);
        }
        if (preview) {
            preview.innerHTML = renderMarkdownWithLines(data.content);
        }

        state.lastValidPath = currentPath;

        if (data.filename) {
            document.title = `StyledMD - ${data.filename}`;
            if (fileNameInput) {
                fileNameInput.dataset.baseName = data.filename;
                fileNameInput.textContent = data.filename;
            }
            setModifiedState(false);
        }
    }).catch(err => {
        console.error("문서 로드 실패:", err);
        if (!isRetry && currentPath) {
            const newContent = '<button class="button-15" onclick="window.history.back();" title="이전 문서로 돌아가기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button>\n\n';
            fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: currentPath, content: newContent })
            }).then(saveRes => {
                if (saveRes.ok) {
                    loadDocument(true);
                } else {
                    throw new Error("Save failed");
                }
            }).catch(saveErr => {
                console.error("새 파일 생성 실패:", saveErr);
                fallbackLoad();
            });
        } else {
            fallbackLoad();
        }
    });

    function fallbackLoad() {
        if (state.lastValidPath && state.lastValidPath !== currentPath) {
            window.history.replaceState({}, '', '/?file=' + encodeURIComponent(state.lastValidPath));
            loadDocument(true);
        } else {
            window.location.href = "/";
        }
    }
}
