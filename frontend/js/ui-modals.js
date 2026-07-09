import { state, readToggleBtn, fileNameInput } from './state.js';
import { triggerNewFileAction, triggerOpenFileAction, triggerSaveAction, triggerSaveAsAction, saveDocumentContent } from './file-actions.js';

export function setupUIModals() {
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdowns.forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
                dropdown.classList.toggle('show');
            });
        }
    });
    document.addEventListener('click', (e) => {
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) dropdown.classList.remove('show');
        });
    });

    const menuFileNew = document.getElementById('menu-file-new');
    const menuFileOpen = document.getElementById('menu-file-open');
    const menuFileSave = document.getElementById('menu-file-save');
    const menuFileSaveAs = document.getElementById('menu-file-saveas');

    if (menuFileNew) {
        menuFileNew.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            triggerNewFileAction();
        });
    }
    if (menuFileOpen) {
        menuFileOpen.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            triggerOpenFileAction();
        });
    }
    if (menuFileSave) {
        menuFileSave.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            triggerSaveAction();
        });
    }
    if (menuFileSaveAs) {
        menuFileSaveAs.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            triggerSaveAsAction();
        });
    }

    const newDocModal = document.getElementById('new-doc-modal');
    const newDocText = document.getElementById('new-doc-text');
    const newDocFilename = document.getElementById('new-doc-filename');
    const newDocClose = document.getElementById('new-doc-close');
    const newDocCancel = document.getElementById('new-doc-cancel');
    const newDocConfirm = document.getElementById('new-doc-confirm');

    function closeNewDocModal() { if (newDocModal) newDocModal.classList.remove('show'); }
    if (newDocClose) newDocClose.addEventListener('click', closeNewDocModal);
    if (newDocCancel) newDocCancel.addEventListener('click', closeNewDocModal);
    if (newDocModal) newDocModal.addEventListener('click', (e) => { if (e.target === newDocModal) closeNewDocModal(); });

    if (newDocConfirm) {
        newDocConfirm.addEventListener('click', () => {
            const textVal = newDocText ? newDocText.value.trim() : '';
            let fileVal = newDocFilename ? newDocFilename.value.trim() : '';
            if (!textVal || !fileVal) { alert('보일 문자와 파일 이름을 모두 입력해야 한다.'); return; }
            if (!fileVal.toLowerCase().endsWith('.md')) fileVal += '.md';
            if (state.editorInstance) {
                const relativeLink = `[${textVal}](${fileVal})`;
                const selection = state.editorInstance.getSelection();
                state.editorInstance.executeEdits("insert-new-doc-link", [{ range: selection, text: relativeLink, forceMoveMarkers: true }]);
                state.editorInstance.focus();
                saveDocumentContent(state.editorInstance.getValue());
                setTimeout(() => { window.location.reload(); }, 100);
            }
            closeNewDocModal();
        });
    }

    const menuBackTwoDocs = document.getElementById('menu-back-two-docs');
    if (menuBackTwoDocs) {
        menuBackTwoDocs.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            if (state.editorInstance) {
                const textToInsert = '<button class="button-15" onclick="window.history.back();" title="이전 문서로 돌아가기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button>';
                const selection = state.editorInstance.getSelection();
                state.editorInstance.executeEdits("insert-back-button", [{ range: selection, text: textToInsert, forceMoveMarkers: true }]);
                state.editorInstance.focus();
            }
        });
    }

    const menuInsertTable = document.getElementById('menu-insert-table');
    const tableModal = document.getElementById('table-modal');
    const tableRowsInput = document.getElementById('table-rows');
    const tableColsInput = document.getElementById('table-cols');
    const tableModalClose = document.getElementById('table-modal-close');
    const tableModalCancel = document.getElementById('table-modal-cancel');
    const tableModalConfirm = document.getElementById('table-modal-confirm');

    function closeTableModal() { if (tableModal) tableModal.classList.remove('show'); }
    if (menuInsertTable) {
        menuInsertTable.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            if (tableModal) {
                if (tableRowsInput) tableRowsInput.value = '3';
                if (tableColsInput) tableColsInput.value = '3';
                tableModal.classList.add('show');
            }
        });
    }
    if (tableModalClose) tableModalClose.addEventListener('click', closeTableModal);
    if (tableModalCancel) tableModalCancel.addEventListener('click', closeTableModal);
    if (tableModal) tableModal.addEventListener('click', (e) => { if (e.target === tableModal) closeTableModal(); });

    if (tableModalConfirm) {
        tableModalConfirm.addEventListener('click', () => {
            const rows = parseInt(tableRowsInput ? tableRowsInput.value : '3', 10);
            const cols = parseInt(tableColsInput ? tableColsInput.value : '3', 10);
            if (isNaN(rows) || rows < 1 || isNaN(cols) || cols < 1) { alert('행과 열의 개수는 1 이상의 숫자여야 한다.'); return; }
            if (state.editorInstance) {
                const tableContent = generateMarkdownTable(rows, cols);
                const selection = state.editorInstance.getSelection();
                state.editorInstance.executeEdits("insert-table", [{ range: selection, text: tableContent, forceMoveMarkers: true }]);
                state.editorInstance.focus();
            }
            closeTableModal();
        });
    }

    function generateMarkdownTable(rows, cols) {
        let md = "|";
        for (let c = 1; c <= cols; c++) md += ` Header ${c} |`;
        md += "\n|";
        for (let c = 1; c <= cols; c++) md += " --- |";
        md += "\n";
        for (let r = 1; r <= rows; r++) {
            md += "|";
            for (let c = 1; c <= cols; c++) md += ` |`;
            md += "\n";
        }
        return md;
    }

    const menuInsertTip = document.getElementById('menu-insert-tip');
    const menuInsertWarning = document.getElementById('menu-insert-warning');
    const menuInsertQuestion = document.getElementById('menu-insert-question');
    const menuInsertImportant = document.getElementById('menu-insert-important');

    const insertCallout = (type) => {
        if (state.editorInstance) {
            const textToInsert = `> [!${type}]\n> `;
            const selection = state.editorInstance.getSelection();
            state.editorInstance.executeEdits("insert-callout", [{ range: selection, text: textToInsert, forceMoveMarkers: true }]);
            state.editorInstance.focus();
        }
    };

    if (menuInsertTip) menuInsertTip.addEventListener('click', (e) => { e.preventDefault(); dropdowns.forEach(d => d.classList.remove('show')); insertCallout('TIP'); });
    if (menuInsertWarning) menuInsertWarning.addEventListener('click', (e) => { e.preventDefault(); dropdowns.forEach(d => d.classList.remove('show')); insertCallout('WARNING'); });
    if (menuInsertQuestion) menuInsertQuestion.addEventListener('click', (e) => { e.preventDefault(); dropdowns.forEach(d => d.classList.remove('show')); insertCallout('QUESTION'); });
    if (menuInsertImportant) menuInsertImportant.addEventListener('click', (e) => { e.preventDefault(); dropdowns.forEach(d => d.classList.remove('show')); insertCallout('IMPORTANT'); });

    if (readToggleBtn) {
        readToggleBtn.addEventListener('click', () => {
            const isReadMode = document.body.classList.toggle('read-mode');
            localStorage.setItem('read-mode', isReadMode);
            let targetWidth = 1280;
            let targetHeight = 960;

            if (isReadMode) {
                readToggleBtn.textContent = '✍️ 편집';
                targetWidth = 816; 
            } else {
                readToggleBtn.textContent = '📖 읽기';
                targetWidth = 1616; 
            }

            fetch('/api/resize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ width: targetWidth, height: targetHeight })
            }).then(() => {
                setTimeout(() => { if (state.editorInstance) state.editorInstance.layout(); }, 50);
            }).catch(err => console.error("창 크기 변경 실패:", err));

            setTimeout(() => { if (state.editorInstance) state.editorInstance.layout(); }, 100);
        });
    }

    // 도움말 모달 로직
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const helpModalClose = document.getElementById('help-modal-close');
    const helpModalOk = document.getElementById('help-modal-ok');

    function closeHelpModal() { if (helpModal) helpModal.classList.remove('show'); }
    if (helpBtn) {
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdowns.forEach(d => d.classList.remove('show'));
            if (helpModal) helpModal.classList.add('show');
        });
    }
    if (helpModalClose) helpModalClose.addEventListener('click', closeHelpModal);
    if (helpModalOk) helpModalOk.addEventListener('click', closeHelpModal);
    if (helpModal) helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelpModal(); });

    window.addEventListener('keydown', (e) => {
        const isCtrl = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (isCtrl) {
            if (e.shiftKey && key === 's') { e.preventDefault(); triggerSaveAsAction(); }
            else if (key === 's') { e.preventDefault(); triggerSaveAction(); }
            else if (key === 'n') { e.preventDefault(); triggerNewFileAction(); }
            else if (key === 'o') { e.preventDefault(); triggerOpenFileAction(); }
        }
    });
}

export function makeModalDraggable(modalEl) {
    const content = modalEl.querySelector('.modal-content');
    const header = modalEl.querySelector('.modal-header');
    if (!content || !header) return;

    header.style.cursor = 'move';
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (modalEl.classList.contains('show')) {
                    content.style.position = '';
                    content.style.transform = '';
                    content.style.left = '';
                    content.style.top = '';
                    content.style.margin = '';
                }
            }
        });
    });
    observer.observe(modalEl, { attributes: true });

    header.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.classList.contains('modal-close')) return;
        e.preventDefault();
        const rect = content.getBoundingClientRect();
        content.style.position = 'absolute';
        content.style.transform = 'none';
        content.style.margin = '0';
        content.style.left = rect.left + 'px';
        content.style.top = rect.top + 'px';

        const startX = e.clientX;
        const startY = e.clientY;
        const originalLeft = rect.left;
        const originalTop = rect.top;

        function onMouseMove(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let newLeft = originalLeft + dx;
            let newTop = originalTop + dy;
            const minX = 0; const minY = 0;
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));
            content.style.left = newLeft + 'px';
            content.style.top = newTop + 'px';
        }
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}
