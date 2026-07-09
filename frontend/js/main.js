import { setupUIModals, makeModalDraggable } from './ui-modals.js';
import { setupAIChat } from './ai-chat.js';
import { setupEditor } from './editor-setup.js';

require.config({ paths: { 'vs': '/.app/lib/monaco-editor/min/vs' } });

setupUIModals();
setupAIChat();
setupEditor();

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal').forEach(makeModalDraggable);
});

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    document.querySelectorAll('.modal').forEach(makeModalDraggable);
}

document.addEventListener('DOMContentLoaded', () => {
    const preview = document.getElementById('preview');
    if (preview && typeof hljs !== 'undefined') {
        const observer = new MutationObserver(() => {
            preview.querySelectorAll('pre code').forEach((block) => {
                if (!block.dataset.highlighted) {
                    hljs.highlightElement(block);
                    block.dataset.highlighted = 'true';
                }
            });
        });
        observer.observe(preview, { childList: true, subtree: true, characterData: true });
    }
});
