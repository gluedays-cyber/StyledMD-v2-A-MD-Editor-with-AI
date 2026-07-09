import { fileNameInput, state } from './state.js';

export function applyColorSyntax(text) {
    return text.replace(/\[([^\]]+)\]\{\s*(?:color:\s*)?([#\w\(\),]+)?\s*(?:bg:\s*)?([#\w\(\),]+)?\s*\}/g, (match, text, color, bg) => {
        let style = "";
        if (color) {
            if (color.startsWith('bg:')) {
                style += `background-color: ${color.replace('bg:', '')};`;
            } else {
                style += `color: ${color};`;
            }
        }
        if (bg) {
            style += `background-color: ${bg.replace('bg:', '')};`;
        }
        return `<span style="${style}">${text}</span>`;
    });
}

export function applyCallouts(text) {
    const lines = text.split('\n');
    const result = [];
    let inCallout = false;
    let calloutBuffer = [];

    lines.forEach(line => {
        if (line.match(/^>\s*\[!([a-zA-Z]+)\]/)) {
            if (inCallout) result.push(processBuffer(calloutBuffer));
            inCallout = true;
            calloutBuffer = [line];
        } else if (inCallout && line.startsWith('>')) {
            calloutBuffer.push(line);
        } else {
            if (inCallout) {
                result.push(processBuffer(calloutBuffer));
                calloutBuffer = [];
                inCallout = false;
            }
            result.push(line);
        }
    });
    if (inCallout) result.push(processBuffer(calloutBuffer));
    return result.join('\n');
}

export function markedParseWithFallback(text) {
    try {
        return marked.parser(marked.lexer(text));
    } catch (e) {
        return text;
    }
}

function processBuffer(buffer) {
    const calloutMap = { 'IMPORTANT': 'important', 'NOTE': 'note', 'TIP': 'tip', 'WARNING': 'warning', 'QUESTION': 'question' };
    const match = buffer[0].match(/^>\s*\[!([a-zA-Z]+)\]\s*(.*)/);
    const type = match ? match[1].toUpperCase() : 'NOTE';
    const filename = calloutMap[type] || 'note';
    const cleanContent = buffer.map(l => l.replace(/^>\s?/, '')).slice(1).join('\n');

    return `<div class="callout callout-${filename}"><img src="/.app/SVG/${filename}.svg" class="callout-icon"><div class="callout-content"><span class="callout-title">${type}</span>${markedParseWithFallback(cleanContent)}</div></div>`;
}

export function parseCustomMarkers(markdown) {
    return markdown.replace(/^\|\|/gm, '<br>');
}

export function renderMarkdownWithLines(markdownText, currentFilePath) {
    if (!markdownText) return '';
    
    let currentDir = '';
    const activePath = state.currentPath;
    
    if (activePath && activePath !== 'Untitled.md') {
        const parts = activePath.replace(/\\/g, '/').split('/');
        parts.pop();
        currentDir = parts.length > 0 ? parts.join('/') + '/' : '';
    }

    let baseTag = document.querySelector('base');
    if (!baseTag) {
        baseTag = document.createElement('base');
        document.head.appendChild(baseTag);
    }
    baseTag.href = '/' + currentDir;

    let text = parseCustomMarkers(markdownText);
    text = applyCallouts(text);
    text = applyColorSyntax(text);
    
    const renderer = new marked.Renderer();
    renderer.link = (href, title, text) => {
        let cleanHref = href ? href.replace(/\\/g, '/') : '';
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${cleanHref}"${titleAttr}>${text}</a>`;
    };

    renderer.image = (href, title, text) => {
        let cleanSrc = href ? href.replace(/\\/g, '/') : '';
        const titleAttr = title ? ` title="${title}"` : '';
        const altAttr = text ? ` alt="${text}"` : '';
        return `<img src="${cleanSrc}"${altAttr}${titleAttr}>`;
    };

    marked.setOptions({ breaks: true, renderer: renderer });
    const tokens = marked.lexer(text);
    
    let html = "";
    try {
        html = marked.parser(tokens);
    } catch (e) {
        html = text;
    }

    const withLines = html.split('\n').map((line, index) => {
        if (line.trim().startsWith('<') && !line.includes('data-line')) {
            return line.replace(/^<([a-zA-Z0-9\-]+)/, `<$1 data-line="${index + 1}"`);
        }
        return line;
    }).join('\n');

    const slugCounts = {};
    function makeSlug(text) {
        const plain = text.replace(/<[^>]+>/g, '').toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\u00C0-\u024F\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3\-]/g, '')
            .replace(/^-+|-+$/g, '');
        if (!plain) return 'heading';
        if (slugCounts[plain] === undefined) {
            slugCounts[plain] = 0;
            return plain;
        }
        slugCounts[plain]++;
        return `${plain}-${slugCounts[plain]}`;
    }
    return withLines.replace(/<h([1-6])(\s[^>]*)?>([^<]*(?:<(?!\/h[1-6]>)[^>]*>[^<]*)*)<\/h[1-6]>/gi, (match, level, attrs, inner) => {
        const slug = makeSlug(inner);
        const attrsStr = attrs || '';
        if (/\bid=/.test(attrsStr)) return match;
        return `<h${level}${attrsStr} id="${slug}">${inner}</h${level}>`;
    });
}
