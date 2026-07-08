export const preview = document.getElementById('preview');
export const readToggleBtn = document.querySelector('.read-toggle-btn');
export const fileNameInput = document.querySelector('.file-name');
export const aiToggleBtn = document.querySelector('.ai-toggle-btn');
export const lowerPanel = document.querySelector('.lower-panel');
export const mainContainer = document.querySelector('.main-container');

export const state = {
    editorInstance: null,
    aiEditorInstance: null,
    aiResponseInstance: null,
    isModified: false,
    currentPath: new URLSearchParams(window.location.search).get('file') || '',
    lastValidPath: new URLSearchParams(window.location.search).get('file') || '',
    activeSelectedText: "",
    lastMarkdownResponse: "",
    promptHistory: [],
    historyIndex: -1
};

export function setModifiedState(modified) {
    state.isModified = modified;
    if (!fileNameInput) return;
    const baseName = fileNameInput.dataset.baseName || fileNameInput.textContent.replace(' (수정됨)', '');
    fileNameInput.dataset.baseName = baseName;
    fileNameInput.textContent = modified ? `${baseName} *` : baseName;
}
