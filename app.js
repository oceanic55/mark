/* ==========================================================================
   Markdownit — Web app
   Feature-port of the macOS SwiftUI app (Markdownit.xcodeproj).
   No dependencies, no build step.
   ========================================================================== */
(() => {
'use strict';

/* ==========================================================================
   State
   ========================================================================== */
const state = {
  mode: null,                     // 'fsa' | 'directory-import' | 'file-import'
  dirHandle: null,                // FileSystemDirectoryHandle (FSA mode)
  workingDirName: 'Markdownit',

  rawMarkdown: '',
  currentFileName: '',
  availableFiles: [],
  hasUnsavedChanges: false,
  isPreviewMode: false,

  summaries: {},                  // 'foo.md' -> { tags, title, preview, content, mtime }

  selection: 'all',               // 'all' | 'untagged' | 'tag:<name>'
  searchText: '',
  filteredFiles: [],
  availableTags: [],
  tagCounts: {},
  untaggedCount: 0,

  isLoading: false,
  llmQuestion: '',
  llmAnswer: '',
  statusMessage: '',
  isError: false,
  llmRequestGen: 0,
  documentGen: 0,
  isNewDocumentDraft: false,

  apiKeys: [],
  selectedModel: 'llama-3.3-70b-versatile',
  previewShortcut: { alt: true, ctrl: false, meta: false, shift: false, code: 'Space', display: 'Option+Space' },

  undoStack: [],
  redoStack: [],

  viewport: 'desktop',
  mobileView: 'list',
  sidebarOpen: false,
  searchActive: false,
};

const LS = {
  workingDirName: 'markdownit.workingDirName',
  apiKeys: 'markdownit.apiKeys',
  groqApiKey: 'markdownit.groqApiKey',
  selectedModel: 'markdownit.selectedModel',
  previewShortcut: 'markdownit.previewShortcut',
};

const IDB_NAME = 'markdownit';
const IDB_STORE_FILES = 'files';
const IDB_STORE_META = 'meta';
const IDB_KEY_DIR_HANDLE = 'dirHandle';

/* ==========================================================================
   DOM helpers
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const els = {};
function cacheEls() {
  [
    'app','sidebar','sidebarOverlay','collectionButton','collectionName','collectionCount',
    'tagNav','settingsButton','folderButton','workingDirName','noteList','mobileMenuBtn',
    'listTitle','newFromListBtn','noteListBody','fabBtn','editorPane','backBtn','fileLabel',
    'unsavedDot','fileNameText','newBtn','saveBtn','searchBtn','tagBtn','previewBtn','mobileMenuBtn2',
    'editorScroll','markdownEditor','highlightLayer','previewPane','llmAnswerArea','llmAnswerText',
    'statusBar','statusMessage','clearStatusBtn','llmQuestion','copyAnswerBtn','contextMenu',
    'ctxDelete','ctxDownload','searchModal','searchInput','searchCancelBtn','searchConfirmBtn',
    'tagModal','tagModalTitle','tagInput','tagChips','tagCancelBtn','tagSaveBtn','settingsModal',
    'workingDirPath','chooseDirBtn','resetDirBtn','apiKeyList','testKeyBtn','testKeyResult',
    'addKeyBtn','modelSelect','shortcutDisplay','recordShortcutBtn','resetShortcutBtn',
    'settingsDoneBtn','addKeyModal','newKeyInput','newKeyCancelBtn','newKeyAddBtn',
    'confirmModal','confirmMessage','confirmOkBtn','confirmCancelBtn',
    'folderInput','fileInput'
  ].forEach(id => els[id] = $(id));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgIcon(paths, opts = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  if (opts.size) { s.style.width = opts.size; s.style.height = opts.size; }
  s.innerHTML = paths;
  return s;
}
const ICONS = {
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  tray: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  tag: '<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42L12 2z"/><circle cx="7" cy="7" r="1.5"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  lightbulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  magnifier: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pencil: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  archive: '<path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  checkmark: '<path d="M20 6 9 17l-5-5"/>',
};

/* ==========================================================================
   TagParser — port of NoteMetadata.swift
   ========================================================================== */
const TagParser = {
  // Stricter ASCII tag content (fixes audit #2): letters, digits, space, dash, underscore.
  tokenRe: /\[([a-zA-Z0-9 _-]+)\]/g,

  normalizedTag(tag) {
    if (tag.includes('[') || tag.includes(']')) return null;
    const words = tag.split(/\s+/).filter(w => w.length);
    const normalized = words.join(' ').toLowerCase();
    if (!/[a-zA-Z0-9]/.test(normalized)) return null;
    return normalized;
  },

  tagsInTagLine(line) {
    const trimmed = (line ?? '').trim();
    if (!trimmed) return null;
    const tokenRe = new RegExp(this.tokenRe.source, 'g');
    const matches = [...trimmed.matchAll(tokenRe)];
    if (matches.length === 0) return null;

    const tags = [];
    let consumed = 0;
    for (const m of matches) {
      const gap = trimmed.slice(consumed, m.index);
      if (gap.trim() !== '') return null;
      const tag = this.normalizedTag(m[1]);
      if (tag === null) return null;
      tags.push(tag);
      consumed = m.index + m[0].length;
    }
    const trailing = trimmed.slice(consumed);
    if (trailing.trim() !== '') return null;
    return tags;
  },

  isTagLine(line) { return this.tagsInTagLine(line) !== null; },

  tags(content) {
    const lines = (content ?? '').replace(/\r\n/g, '\n').split('\n');
    let idx = lines.length - 1;
    const result = [];
    while (idx >= 0) {
      const lineTags = this.tagsInTagLine(lines[idx]);
      if (lineTags) {
        result.unshift(...lineTags);
      } else if (lines[idx].trim() !== '') {
        break;
      }
      idx--;
    }
    return result;
  },

  contentWithoutTags(content) {
    const lines = (content ?? '').replace(/\r\n/g, '\n').split('\n');
    let idx = lines.length - 1;
    let firstTagIdx = null;
    let foundTag = false;
    while (idx >= 0) {
      const lineTags = this.tagsInTagLine(lines[idx]);
      if (lineTags) {
        firstTagIdx = idx;
        foundTag = true;
      } else if (lines[idx].trim() !== '') {
        break;
      } else if (foundTag) {
        firstTagIdx = idx;
      }
      idx--;
    }
    if (firstTagIdx === null) return content;
    return lines.slice(0, firstTagIdx).join('\n').trim();
  },

  contentWithTags(content, tags) {
    const base = this.contentWithoutTags(content);
    if (!tags.length) return base;
    const tagLine = tags.map(t => `[${t}]`).join(' ');
    return base + '\n\n' + tagLine + '\n';
  },
};

/* ==========================================================================
   FileManagerService — port of FileManagerService.swift helpers
   ========================================================================== */
const FileManager = {
  extractTitleAndPreview(content, fallback) {
    const lines = (content ?? '').split('\n').map(l => l.trim());
    let title = null;
    let preview = null;
    for (const line of lines) {
      if (!line) continue;
      if (TagParser.isTagLine(line)) continue;
      if (title === null) {
        const stripped = line.replace(/^\s*#{1,6}\s+/, '');
        title = stripped || line;
        continue;
      }
      if (preview === null) { preview = line; break; }
    }
    return { title: title ?? fallback, preview: preview ?? '' };
  },

  hasUsableTitle(content) {
    const title = this.extractTitleAndPreview(content, '').title;
    const firstWord = title.split(/\s+/).find(w => w.length);
    if (!firstWord) return false;
    return firstWord.replace(/[^a-zA-Z0-9_-]/g, '').length > 0;
  },
};

/* ==========================================================================
   Markdown renderer — port of MarkdownPreview.swift
   ========================================================================== */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseInline(text) {
  let html = '';
  let i = 0;
  let plain = '';
  const flush = () => { if (plain) { html += escapeHtml(plain); plain = ''; } };
  const textStr = String(text ?? '');

  while (i < textStr.length) {
    const rest = textStr.slice(i);
    let matched = false;

    // 1. ==text== highlight
    if (rest.startsWith('==')) {
      const end = rest.indexOf('==', 2);
      if (end !== -1) {
        flush();
        html += `<mark>${escapeHtml(rest.slice(2, end))}</mark>`;
        i += end + 2;
        matched = true;
      }
    }
    // 2. *** or ___ bold+italic
    if (!matched && (rest.startsWith('***') || rest.startsWith('___'))) {
      const delim = rest.slice(0, 3);
      const end = rest.indexOf(delim, 3);
      if (end !== -1) {
        flush();
        html += `<strong><em>${escapeHtml(rest.slice(3, end))}</em></strong>`;
        i += end + 3;
        matched = true;
      }
    }
    // 3. ** or __ bold
    if (!matched && (rest.startsWith('**') || rest.startsWith('__'))) {
      const delim = rest.slice(0, 2);
      const end = rest.indexOf(delim, 2);
      if (end !== -1) {
        flush();
        html += `<strong>${escapeHtml(rest.slice(2, end))}</strong>`;
        i += end + 2;
        matched = true;
      }
    }
    // 4. * or _ italic (single, not double)
    if (!matched && (rest.startsWith('*') || rest.startsWith('_'))) {
      const delim = rest[0];
      const end = rest.indexOf(delim, 1);
      if (end !== -1) {
        flush();
        html += `<em>${escapeHtml(rest.slice(1, end))}</em>`;
        i += end + 1;
        matched = true;
      }
    }
    // 5. `code`
    if (!matched && rest.startsWith('`')) {
      const end = rest.indexOf('`', 1);
      if (end !== -1) {
        flush();
        html += `<code>${escapeHtml(rest.slice(1, end))}</code>`;
        i += end + 1;
        matched = true;
      }
    }
    // 6. [text](url)
    if (!matched && rest.startsWith('[')) {
      const textEnd = rest.indexOf('](');
      if (textEnd !== -1) {
        const urlEnd = rest.indexOf(')', textEnd + 2);
        if (urlEnd !== -1) {
          flush();
          const linkText = rest.slice(1, textEnd);
          const url = rest.slice(textEnd + 2, urlEnd);
          html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(linkText)}</a>`;
          i += urlEnd + 1;
          matched = true;
        }
      }
    }

    if (!matched) {
      plain += textStr[i];
      i += 1;
    }
  }
  flush();
  return html;
}

function parseBlocks(text) {
  const elements = [];
  const lines = (text ?? '').split('\n');
  let para = [];

  const flushPara = () => {
    if (para.length) {
      elements.push({ type: 'paragraph', text: para.join(' ') });
      para = [];
    }
  };

  const ordered = (line) => {
    const m = line.match(/^(\d+)\s*([.)-])\s+(.+)$/);
    if (!m) return null;
    return { number: parseInt(m[1], 10) || 1, text: m[3] };
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { flushPara(); i += 1; continue; }

    // Headings (H5/H6 render as H4)
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      elements.push({ type: 'heading', level: heading[1].length, text: heading[2] });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      flushPara();
      elements.push({ type: 'bullet', text: trimmed.slice(2) });
    } else if (/^\d+/.test(trimmed) && ordered(trimmed)) {
      flushPara();
      const o = ordered(trimmed);
      elements.push({ type: 'numbered', number: o.number, text: o.text });
    } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushPara();
      elements.push({ type: 'hr' });
    } else if (trimmed.startsWith('```')) {
      flushPara();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // skip closing fence
      elements.push({ type: 'code', code: codeLines.join('\n') });
      continue;
    } else {
      para.push(trimmed);
    }
    i += 1;
  }
  flushPara();
  return elements;
}

function renderMarkdown(text) {
  const body = TagParser.contentWithoutTags(text ?? '');
  if (!body.trim()) {
    return '<div class="preview-empty">Enter markdown to see preview</div>';
  }

  const elements = parseBlocks(body);
  let html = '';
  let listType = null;
  const closeList = () => {
    if (listType) { html += `</${listType}>`; listType = null; }
  };

  for (const el of elements) {
    if (el.type === 'bullet') {
      if (listType !== 'ul') { closeList(); listType = 'ul'; html += '<ul>'; }
      html += `<li>${parseInline(el.text)}</li>`;
    } else if (el.type === 'numbered') {
      if (listType !== 'ol') { closeList(); listType = 'ol'; html += `<ol start="${el.number}">`; }
      html += `<li>${parseInline(el.text)}</li>`;
    } else {
      closeList();
      if (el.type === 'heading') {
        html += `<h${el.level}>${parseInline(el.text)}</h${el.level}>`;
      } else if (el.type === 'paragraph') {
        html += `<p>${parseInline(el.text)}</p>`;
      } else if (el.type === 'code') {
        html += `<pre><code>${escapeHtml(el.code)}</code></pre>`;
      } else if (el.type === 'hr') {
        html += '<hr>';
      }
    }
  }
  closeList();
  return html;
}

/* ==========================================================================
   IndexedDB virtual library
   ========================================================================== */
let _idbPromise = null;
function idb() {
  if (!_idbPromise) {
    _idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_FILES)) {
          db.createObjectStore(IDB_STORE_FILES, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_META)) {
          db.createObjectStore(IDB_STORE_META);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _idbPromise;
}
function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAllFiles() {
  const db = await idb();
  const tx = db.transaction(IDB_STORE_FILES, 'readonly');
  return idbReq(tx.objectStore(IDB_STORE_FILES).getAll());
}
async function idbGetMeta(key) {
  const db = await idb();
  const tx = db.transaction(IDB_STORE_META, 'readonly');
  return idbReq(tx.objectStore(IDB_STORE_META).get(key));
}
async function idbPutMeta(key, value) {
  const db = await idb();
  const tx = db.transaction(IDB_STORE_META, 'readwrite');
  return idbReq(tx.objectStore(IDB_STORE_META).put(value, key));
}
async function idbPutFile(rec) {
  const db = await idb();
  const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
  return idbReq(tx.objectStore(IDB_STORE_FILES).put(rec));
}
async function idbDeleteFile(name) {
  const db = await idb();
  const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
  return idbReq(tx.objectStore(IDB_STORE_FILES).delete(name));
}

/* ==========================================================================
   Storage abstraction (mode-aware)
   ========================================================================== */
function hasDir() { return state.mode === 'fsa' && state.dirHandle; }

async function listMarkdownFiles() {
  if (hasDir()) {
    const names = [];
    for await (const [name, h] of state.dirHandle.entries()) {
      if (h.kind === 'file' && name.toLowerCase().endsWith('.md')) names.push(name);
    }
    return names.sort();
  }
  const recs = await idbGetAllFiles();
  return recs.map(r => r.name).filter(n => n.toLowerCase().endsWith('.md')).sort();
}

async function getCurrentFileNames() {
  return await listMarkdownFiles();
}

function titleToBaseName(content) {
  const title = FileManager.extractTitleAndPreview(content, 'document').title;
  const firstWord = title.split(/\s+/).find(w => w.length) || 'document';
  const cleanedWord = firstWord.replace(/[^a-zA-Z0-9_-]/g, '');
  let baseName = cleanedWord.slice(0, 30);
  if (!baseName) baseName = 'document';
  return baseName;
}

function allocateUniqueFileName(baseName, existingNames) {
  const existing = new Set(existingNames);
  if (!existing.has(`${baseName}.md`)) return `${baseName}.md`;
  let n = 1;
  for (;;) {
    const candidate = `${baseName}x${String(n).padStart(2, '0')}.md`;
    if (!existing.has(candidate)) return candidate;
    n += 1;
  }
}

async function loadMarkdown(name) {
  if (hasDir()) {
    const fh = await state.dirHandle.getFileHandle(name);
    const f = await fh.getFile();
    return await f.text();
  }
  const recs = await idbGetAllFiles();
  const rec = recs.find(r => r.name === name);
  if (!rec) throw new Error(`File not found: ${name}`);
  return rec.content;
}

async function saveMarkdown(name, content) {
  if (hasDir()) {
    const fh = await state.dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
    return;
  }
  const now = Date.now();
  await idbPutFile({ name, content, mtime: now });
  if (state.summaries[name]) {
    state.summaries[name].content = content;
    state.summaries[name].mtime = now;
  }
}

async function removeMarkdown(name) {
  if (hasDir()) {
    try { await state.dirHandle.removeEntry(name); } catch (e) { /* ignore */ }
    return;
  }
  await idbDeleteFile(name);
}

async function modificationDate(name) {
  if (hasDir()) {
    try {
      const fh = await state.dirHandle.getFileHandle(name);
      const f = await fh.getFile();
      return f.lastModified;
    } catch (e) { return 0; }
  }
  const recs = await idbGetAllFiles();
  const rec = recs.find(r => r.name === name);
  return rec ? rec.mtime : 0;
}

/* ==========================================================================
   Mode detection & working directory
   ========================================================================== */
function supportsDirectoryInput() {
  const input = document.createElement('input');
  return 'webkitdirectory' in input;
}

async function detectMode() {
  if ('showDirectoryPicker' in window) {
    state.mode = 'fsa';
    // Try to restore a persisted handle
    try {
      const handle = await idbGetMeta(IDB_KEY_DIR_HANDLE);
      if (handle && typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          try { perm = await handle.requestPermission({ mode: 'readwrite' }); }
          catch (e) { perm = 'denied'; }
        }
        if (perm === 'granted') {
          state.dirHandle = handle;
          state.workingDirName = handle.name;
          localStorage.setItem(LS.workingDirName, handle.name);
        }
      }
    } catch (e) { /* ignore */ }
    return;
  }
  if (supportsDirectoryInput()) {
    state.mode = 'directory-import';
    return;
  }
  state.mode = 'file-import';
}

async function pickDirectory() {
  if (state.mode === 'fsa' && 'showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      state.dirHandle = handle;
      state.workingDirName = handle.name;
      localStorage.setItem(LS.workingDirName, handle.name);
      await idbPutMeta(IDB_KEY_DIR_HANDLE, handle);
      await loadAvailableFiles();
      renderAll();
      return true;
    } catch (e) {
      return false; // cancelled or failed
    }
  }
  // Fallback modes
  if (state.mode === 'directory-import') {
    els.folderInput.click();
  } else {
    els.fileInput.click();
  }
  return false;
}

function clearVirtualLibrary() {
  return new Promise(async (resolve) => {
    try {
      const db = await idb();
      const tx = db.transaction(IDB_STORE_FILES, 'readwrite');
      tx.objectStore(IDB_STORE_FILES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
}

async function resetWorkingDirectory() {
  await savePendingChanges();
  if (state.mode === 'fsa') {
    state.dirHandle = null;
    try { await idbPutMeta(IDB_KEY_DIR_HANDLE, null); } catch (e) { /* ignore */ }
  } else {
    await clearVirtualLibrary();
  }
  localStorage.removeItem(LS.workingDirName);
  state.workingDirName = 'Markdownit';
  clearDocument();
  await loadAvailableFiles();
  renderAll();
  closeModal('settingsModal');
}

/* ==========================================================================
   Import handlers
   ========================================================================== */
async function importFiles(fileList) {
  const mdFiles = [...fileList].filter(f => /\.md$/i.test(f.name));
  if (!mdFiles.length) return;
  const existing = await getCurrentFileNames();
  for (const f of mdFiles) {
    const baseName = f.name.replace(/\.md$/i, '');
    let name = f.name;
    if (existing.includes(name)) {
      name = allocateUniqueFileName(baseName, existing);
    }
    existing.push(name);
    const content = await f.text();
    await saveMarkdown(name, content);
  }
  await loadAvailableFiles();
  renderAll();
}

function onFolderInputChange(e) {
  const files = e.target.files;
  if (!files || !files.length) return;
  const firstPath = files[0].webkitRelativePath || '';
  const rootName = firstPath.split('/')[0] || 'Imported';
  state.workingDirName = rootName;
  localStorage.setItem(LS.workingDirName, rootName);
  importFiles(files);
  e.target.value = '';
}

function onFileInputChange(e) {
  importFiles(e.target.files);
  e.target.value = '';
}

/* ==========================================================================
   LLM service — port of GroqService.swift
   ========================================================================== */
const LLM_MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'moonshotai/kimi-k2-instruct-0905',
  'qwen/qwen3-32b',
];
function modelDisplay(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function parseErrorResponse(res) {
  try {
    const json = await res.json();
    if (typeof json.message === 'string') return json.message;
    if (json.error && typeof json.error.message === 'string') return json.error.message;
    if (json.error) return String(json.error);
  } catch (e) { /* not json */ }
  try {
    const text = await res.text();
    if (text) return text;
  } catch (e) { /* ignore */ }
  return `HTTP ${res.status}: Request failed`;
}

const LLM = {
  async ask({ apiKey, question, context, model }) {
    const systemMessage = 'You are a helpful assistant. The user has a markdown document open and will ask you questions about it. Answer concisely and helpfully. If the question is not about the document, answer generally.';
    const userMessage = context
      ? `Here is my document:\n\n---\n${context}\n---\n\nQuestion: ${question}`
      : question;
    const body = {
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: await parseErrorResponse(res) };
      }
      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : null;
      if (content === null || content === undefined) {
        return { ok: false, error: 'Invalid response from LLM API' };
      }
      return { ok: true, content };
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, error: 'Request timed out' };
      return { ok: false, error: err.message || 'Network request failed' };
    } finally {
      clearTimeout(timer);
    }
  },

  async testConnection(apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (res.ok) return { ok: true, message: 'Connection successful' };
      return { ok: false, message: await parseErrorResponse(res) };
    } catch (err) {
      if (err.name === 'AbortError') return { ok: false, message: 'Request timed out' };
      return { ok: false, message: err.message || 'Connection failed' };
    } finally {
      clearTimeout(timer);
    }
  },
};

/* ==========================================================================
   Settings (API keys, model, shortcut)
   ========================================================================== */
function getActiveApiKey() {
  const active = state.apiKeys.find(k => k.isActive);
  if (active) return active.key;
  try { return localStorage.getItem(LS.groqApiKey) || ''; } catch (e) { return ''; }
}
function persistApiKeys() {
  try {
    localStorage.setItem(LS.apiKeys, JSON.stringify(state.apiKeys));
    const active = state.apiKeys.find(k => k.isActive);
    if (active) localStorage.setItem(LS.groqApiKey, active.key);
    else localStorage.removeItem(LS.groqApiKey);
  } catch (e) { /* storage unavailable — keep in-memory */ }
}
function loadSettings() {
  try {
    const keys = localStorage.getItem(LS.apiKeys);
    state.apiKeys = keys ? JSON.parse(keys) : [];
    if (!Array.isArray(state.apiKeys)) state.apiKeys = [];
  } catch (e) { state.apiKeys = []; }
  const legacy = localStorage.getItem(LS.groqApiKey);
  if (legacy && !state.apiKeys.length) {
    state.apiKeys = [{ id: crypto.randomUUID(), name: 'LLM API Key', key: legacy, isActive: true }];
  }
  state.selectedModel = localStorage.getItem(LS.selectedModel) || state.selectedModel;
  try {
    const sc = JSON.parse(localStorage.getItem(LS.previewShortcut));
    if (sc && sc.code) state.previewShortcut = sc;
  } catch (e) { /* keep default */ }
  state.workingDirName = localStorage.getItem(LS.workingDirName) || state.workingDirName;
}

/* ==========================================================================
   ViewModel logic — port of MarkdownEditorViewModel.swift
   ========================================================================== */
async function loadAvailableFiles() {
  state.availableFiles = await listMarkdownFiles();
  const fileSet = new Set(state.availableFiles);

  // Refresh summaries for files whose mtime changed (audit #4 fix)
  const namesToLoad = [];
  for (const name of state.availableFiles) {
    const mtime = await modificationDate(name);
    const cached = state.summaries[name];
    if (!cached || cached.mtime !== mtime) namesToLoad.push(name);
  }
  for (const name of namesToLoad) {
    try {
      const content = await loadMarkdown(name);
      const info = FileManager.extractTitleAndPreview(content, name);
      state.summaries[name] = {
        tags: TagParser.tags(content),
        title: info.title,
        preview: info.preview,
        content,
        mtime: await modificationDate(name),
      };
    } catch (e) {
      delete state.summaries[name];
    }
  }
  for (const name of Object.keys(state.summaries)) {
    if (!fileSet.has(name)) delete state.summaries[name];
  }

  updateTagData();
  updateFilteredFiles();
}

function updateTagData() {
  const counts = {};
  let untagged = 0;
  for (const name of state.availableFiles) {
    const tags = state.summaries[name]?.tags || [];
    if (!tags.length) untagged += 1;
    for (const t of new Set(tags)) counts[t] = (counts[t] || 0) + 1;
  }
  state.availableTags = Object.keys(counts).sort();
  state.tagCounts = counts;
  state.untaggedCount = untagged;
}

function updateFilteredFiles(sel, searchText) {
  const activeSelection = sel !== undefined ? sel : state.selection;
  const activeSearch = searchText !== undefined ? searchText : state.searchText;

  let files = state.availableFiles.filter(name => {
    const tags = state.summaries[name]?.tags || [];
    if (activeSelection === 'all') return true;
    if (activeSelection === 'untagged') return tags.length === 0;
    return tags.includes(activeSelection.slice(4));
  });

  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    files = files.filter(name => {
      const info = state.summaries[name];
      return (info && info.content.toLowerCase().includes(q)) || name.toLowerCase().includes(q);
    });
  }

  files.sort((a, b) => (state.summaries[b]?.mtime || 0) - (state.summaries[a]?.mtime || 0));
  state.filteredFiles = files;
}

async function handleManualSave() {
  if (state.currentFileName && state.hasUnsavedChanges) {
    const target = state.currentFileName;
    const confirmed = await confirmDialog(
      `Save changes to "${target}"? This will overwrite the existing file.`,
      'Save'
    );
    if (!confirmed) {
      showStatus('Save cancelled', true);
      return;
    }
  }
  if (hasDir()) {
    if (await savePendingChanges()) {
      reconcileLibraryState();
      renderAll();
      showStatus(`Saved to ${state.workingDirName}`);
    }
    return;
  }
  if (state.mode === 'fsa') {
    showStatus('Choose a folder to save into…');
    const ok = await pickDirectory();
    if (!ok) {
      showStatus('Save cancelled — no folder selected', true);
      return;
    }
    if (await savePendingChanges()) {
      reconcileLibraryState();
      renderAll();
      showStatus(`Saved to ${state.workingDirName}`);
    }
    return;
  }
  const ok = await savePendingChanges();
  if (ok) {
    reconcileLibraryState();
    renderAll();
    if (state.currentFileName) {
      downloadFile(state.currentFileName);
      showStatus(`Downloaded ${state.currentFileName} — this browser can't write to a folder`);
    } else {
      showStatus('Saved to the in-app library');
    }
  }
}

async function savePendingChanges() {
  if (!state.hasUnsavedChanges) return true;
  if (!state.currentFileName && state.rawMarkdown && !FileManager.hasUsableTitle(state.rawMarkdown)) {
    showStatus('Add a title before leaving this document', true);
    return false;
  }
  try {
    await persistCurrentDocument();
    return true;
  } catch (e) {
    showStatus(`Save failed: ${e.message}`, true);
    return false;
  }
}

async function saveNewMarkdown(content) {
  const baseName = titleToBaseName(content);
  if (hasDir()) {
    for (;;) {
      const existing = await getCurrentFileNames();
      const name = allocateUniqueFileName(baseName, existing);
      let exists = true;
      try {
        await state.dirHandle.getFileHandle(name);
      } catch (e) {
        exists = false;
      }
      if (!exists) {
        await saveMarkdown(name, content);
        return name;
      }
    }
  }
  const existing = await getCurrentFileNames();
  const name = allocateUniqueFileName(baseName, existing);
  await saveMarkdown(name, content);
  return name;
}

async function persistCurrentDocument() {
  if (!state.rawMarkdown && !state.currentFileName) return;

  if (!state.currentFileName) {
    const newName = await saveNewMarkdown(state.rawMarkdown);
    state.currentFileName = newName;
    state.isNewDocumentDraft = false;
  } else {
    await saveMarkdown(state.currentFileName, state.rawMarkdown);
  }

  state.hasUnsavedChanges = false;
  await loadAvailableFiles();
}

function setMarkdown(newValue, actionName = 'Edit', registerUndo = true) {
  const oldValue = state.rawMarkdown;
  if (oldValue === newValue) return;
  if (registerUndo) pushUndo(oldValue, actionName);
  state.rawMarkdown = newValue;
  state.hasUnsavedChanges = true;
}

function clearDocument(isNewDraft = false) {
  state.isNewDocumentDraft = isNewDraft;
  state.currentFileName = '';
  state.rawMarkdown = '';
  state.hasUnsavedChanges = false;
  state.isPreviewMode = false;
  state.llmAnswer = '';
  state.llmQuestion = '';
  state.isLoading = false;
  state.documentGen += 1;
  state.llmRequestGen += 1;
  state.undoStack = [];
  state.redoStack = [];
}

async function createNewDocument() {
  if (!(await savePendingChanges())) return;
  clearDocument(true);
  state.selection = 'all';
  state.searchText = '';
  state.searchActive = false;
  if (state.viewport === 'mobile') {
    state.mobileView = 'editor';
    setViewClass();
  }
  renderAll();
  focusEditor();
}

async function loadDocument(name) {
  try {
    const content = await loadMarkdown(name);
    state.isNewDocumentDraft = false;
    state.currentFileName = name;
    state.rawMarkdown = content;
    state.hasUnsavedChanges = false;
    state.isPreviewMode = false;
    state.llmAnswer = '';
    state.llmQuestion = '';
    state.isLoading = false;
    state.documentGen += 1;
    state.llmRequestGen += 1;
    state.undoStack = [];
    state.redoStack = [];
    state.summaries[name] = {
      ...(state.summaries[name] || {}),
      content,
      mtime: await modificationDate(name),
    };
    if (state.viewport === 'mobile') {
      state.mobileView = 'editor';
      setViewClass();
    }
    renderAll();
    focusEditor();
  } catch (e) {
    showStatus(`Failed to open file: ${e.message}`, true);
  }
}

async function openDocument(name) {
  if (name === state.currentFileName) {
    if (state.viewport === 'mobile') { state.mobileView = 'editor'; setViewClass(); }
    return;
  }
  if (!(await savePendingChanges())) return;
  await loadDocument(name);
}

async function deleteDocument(name) {
  const confirmed = await confirmDialog(`Delete "${name}"? This cannot be undone.`);
  if (!confirmed) return;
  try {
    if (name !== state.currentFileName) {
      if (!(await savePendingChanges())) return;
    }
    await removeMarkdown(name);
    if (state.currentFileName === name) clearDocument();
    await loadAvailableFiles();
    reconcileLibraryState(true);
    showStatus(`Deleted: ${name}`, false);
  } catch (e) {
    showStatus(`Delete failed: ${e.message}`, true);
  }
}

function reconcileLibraryState(normalizeSelection = false) {
  if (normalizeSelection && state.selection.startsWith('tag:') &&
      !state.availableTags.includes(state.selection.slice(4))) {
    state.selection = 'all';
    updateFilteredFiles('all');
  } else {
    updateFilteredFiles();
  }
  reconcileCurrentDocument();
}

function reconcileCurrentDocument() {
  if (state.isNewDocumentDraft) return;
  if (state.currentFileName && state.filteredFiles.includes(state.currentFileName)) return;
  const first = state.filteredFiles[0];
  if (first) loadDocument(first);
  else clearDocument();
}

/* --- tag editing --- */
function currentDocumentTags() {
  return TagParser.tags(state.rawMarkdown);
}

function noteTitle(name) {
  return state.summaries[name]?.title || name;
}

async function setDocumentTags(tags) {
  if (!state.rawMarkdown) return;
  const seen = new Set();
  const cleaned = tags.map(TagParser.normalizedTag).filter(t => t !== null && !seen.has(t) && (seen.add(t), true));
  const updated = TagParser.contentWithTags(state.rawMarkdown, cleaned);
  setMarkdown(updated, 'Edit Tags');
  state.hasUnsavedChanges = true;
  await savePendingChanges();
  // saveMarkdown updates mtime in IDB mode to match the stored value, so
  // loadAvailableFiles' mtime-based reload skips this file and never refreshes
  // the tags in the summary. Update tags directly so the sidebar stays in sync.
  const name = state.currentFileName;
  if (name && state.summaries[name]) {
    state.summaries[name].tags = TagParser.tags(state.rawMarkdown);
    state.summaries[name].content = state.rawMarkdown;
  }
  updateTagData();
  reconcileLibraryState(true);
  renderAll();
}

/* --- undo / redo --- */
function pushUndo(value, actionName) {
  const now = Date.now();
  const last = state.undoStack[state.undoStack.length - 1];
  if (last && last.file === state.currentFileName && now - last.ts < 500) {
    last.value = value;
    last.ts = now;
  } else {
    state.undoStack.push({ file: state.currentFileName, value, ts: now });
  }
  state.redoStack = [];
  if (state.undoStack.length > 200) state.undoStack.shift();
}

function undo() {
  if (!state.undoStack.length) return;
  const entry = state.undoStack.pop();
  state.redoStack.push({ file: state.currentFileName, value: state.rawMarkdown });
  state.rawMarkdown = entry.value;
  state.hasUnsavedChanges = true;
  renderAll();
}

function redo() {
  if (!state.redoStack.length) return;
  const entry = state.redoStack.pop();
  state.undoStack.push({ file: state.currentFileName, value: state.rawMarkdown });
  state.rawMarkdown = entry.value;
  state.hasUnsavedChanges = true;
  renderAll();
}

/* --- search --- */
function searchHighlightRanges() {
  const q = state.searchText.trim().toLowerCase();
  if (!q) return [];
  const text = state.rawMarkdown.toLowerCase();
  const ranges = [];
  let idx = text.indexOf(q);
  while (idx !== -1) {
    ranges.push([idx, idx + q.length]);
    idx = text.indexOf(q, idx + q.length);
  }
  return ranges;
}

function search(query) {
  const cleaned = (query || '').trim();
  if (!cleaned) return;
  if (state.isNewDocumentDraft && !state.rawMarkdown) state.isNewDocumentDraft = false;
  state.searchText = cleaned;
  state.searchActive = true;
  updateFilteredFiles();
  reconcileCurrentDocument();
  renderAll();
}

function clearSearch() {
  state.searchText = '';
  state.searchActive = false;
  updateFilteredFiles();
  reconcileCurrentDocument();
  renderAll();
}

/* --- preview toggle --- */
function togglePreviewMode() {
  if (!state.rawMarkdown) return;
  state.isPreviewMode = !state.isPreviewMode;
  renderAll();
}

/* --- LLM --- */
function showStatus(message, isError) {
  state.statusMessage = message;
  state.isError = isError;
  renderStatus();
}

function clearStatus() {
  state.statusMessage = '';
  state.isError = false;
  renderStatus();
}

async function askLLM() {
  if (state.isLoading) return;
  const question = state.llmQuestion.trim();
  if (!question) {
    showStatus('Enter a question first', true);
    return;
  }
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    showStatus('Set your API key in Settings', true);
    return;
  }

  state.isLoading = true;
  state.llmAnswer = '';
  state.llmRequestGen += 1;
  const reqGen = state.llmRequestGen;
  const docGen = state.documentGen;
  renderLLMPanel();

  const result = await LLM.ask({
    apiKey,
    question,
    context: state.rawMarkdown,
    model: state.selectedModel,
  });

  if (reqGen !== state.llmRequestGen || docGen !== state.documentGen) return;
  state.isLoading = false;
  if (result.ok) {
    state.llmAnswer = result.content;
    state.llmQuestion = '';
    showStatus('', false);
  } else {
    state.llmAnswer = '';
    showStatus(`Error: ${result.error}`, true);
  }
  renderLLMPanel();
}

async function testConnection() {
  const apiKey = getActiveApiKey();
  const resultEl = els.testKeyResult;
  resultEl.textContent = '';
  resultEl.className = 'test-result';
  if (!apiKey) {
    showStatus('Set your API key', true);
    resultEl.textContent = 'No key';
    resultEl.className = 'test-result error';
    return;
  }
  const result = await LLM.testConnection(apiKey);
  if (result.ok) {
    showStatus(result.message, false);
    resultEl.textContent = 'Valid';
    resultEl.className = 'test-result ok';
  } else {
    showStatus(`Connection failed: ${result.message}`, true);
    resultEl.textContent = 'Invalid';
    resultEl.className = 'test-result error';
  }
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tagIcon(tag) {
  switch (tag.toLowerCase()) {
    case 'todo': case 'task': case 'tasks': return ICONS.check;
    case 'today': case 'daily': return ICONS.calendar;
    case 'work': case 'job': return ICONS.briefcase;
    case 'personal': case 'private': return ICONS.person;
    case 'project': case 'projects': return ICONS.folder;
    case 'ideas': case 'idea': return ICONS.lightbulb;
    case 'reading': case 'read': return ICONS.book;
    case 'research': return ICONS.magnifier;
    case 'draft': case 'drafts': return ICONS.pencil;
    case 'archive': case 'archived': return ICONS.archive;
    case 'important': case 'urgent': return ICONS.warning;
    default: return ICONS.tag;
  }
}

function headerTitle() {
  if (state.searchActive) return 'Search';
  if (state.selection === 'all') return 'All Notes';
  if (state.selection === 'untagged') return 'Untagged';
  return capitalize(state.selection.slice(4));
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function renderSidebar() {
  els.collectionName.textContent = state.workingDirName;
  els.workingDirName.textContent = state.workingDirName;
  els.collectionCount.textContent = state.availableFiles.length ? String(state.availableFiles.length) : '';
  els.collectionButton.setAttribute('aria-pressed', state.selection === 'all' ? 'true' : 'false');

  const items = [
    { sel: 'untagged', label: 'Untagged', icon: ICONS.tray, count: state.untaggedCount },
    ...state.availableTags.map(t => ({ sel: `tag:${t}`, label: capitalize(t), icon: tagIcon(t), count: state.tagCounts[t] })),
  ];
  els.tagNav.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'tag-item';
    btn.setAttribute('aria-pressed', state.selection === item.sel ? 'true' : 'false');
    btn.dataset.selection = item.sel;
    btn.appendChild(svgIcon(item.icon));
    const label = document.createElement('span');
    label.className = 'tag-item-label';
    label.textContent = item.label;
    btn.appendChild(label);
    if (item.count > 0) {
      const count = document.createElement('span');
      count.className = 'tag-item-count';
      count.textContent = String(item.count);
      btn.appendChild(count);
    }
    btn.addEventListener('click', () => {
      state.selection = item.sel;
      updateFilteredFiles();
      reconcileCurrentDocument();
      renderAll();
      closeSidebar();
      if (state.viewport === 'mobile') {
        // Keep the user in the list view so they can pick a note
        state.mobileView = 'list';
        setViewClass();
      }
    });
    els.tagNav.appendChild(btn);
  }
}

function renderNoteList() {
  els.listTitle.textContent = headerTitle();

  if (!state.filteredFiles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = svgIcon(ICONS.doc, { size: '36px' });
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'empty-state-title';
    title.textContent = state.searchActive ? 'No results' : 'No notes';
    empty.appendChild(title);
    if (!state.searchActive) {
      const sub = document.createElement('div');
      sub.className = 'empty-state-sub';
      sub.textContent = 'Create a new note to get started';
      empty.appendChild(sub);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = state.availableFiles.length ? 'New Note' : 'Choose Folder';
      btn.addEventListener('click', () => {
        if (state.availableFiles.length) createNewDocument();
        else pickDirectory();
      });
      empty.appendChild(btn);
    }
    els.noteListBody.innerHTML = '';
    els.noteListBody.appendChild(empty);
    return;
  }

  els.noteListBody.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const name of state.filteredFiles) {
    const row = document.createElement('button');
    row.className = 'note-row';
    row.dataset.name = name;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-current', state.currentFileName === name ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'note-row-title';
    title.textContent = noteTitle(name);
    row.appendChild(title);

    const preview = document.createElement('span');
    preview.className = 'note-row-preview';
    preview.textContent = state.summaries[name]?.preview || '';
    row.appendChild(preview);

    const date = document.createElement('span');
    date.className = 'note-row-date';
    date.textContent = formatDate(state.summaries[name]?.mtime);
    row.appendChild(date);

    row.addEventListener('click', () => openDocument(name));
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, name);
    });
    fragment.appendChild(row);
  }
  els.noteListBody.appendChild(fragment);
}

function renderEditor() {
  els.fileNameText.textContent = state.currentFileName || 'Untitled';
  els.fileLabel.title = state.currentFileName;
  els.unsavedDot.hidden = !state.hasUnsavedChanges;
  els.tagBtn.disabled = !state.rawMarkdown;
  els.previewBtn.disabled = !state.rawMarkdown;
  els.previewBtn.textContent = state.isPreviewMode ? 'Edit' : 'Preview';

  if (state.isPreviewMode) {
    els.previewPane.hidden = false;
    els.editorScroll.hidden = true;
    renderPreview();
  } else {
    els.previewPane.hidden = true;
    els.editorScroll.hidden = false;
    if (els.markdownEditor.value !== state.rawMarkdown) {
      els.markdownEditor.value = state.rawMarkdown;
    }
    updateHighlightLayer();
  }
}

function renderPreview() {
  els.previewPane.innerHTML = renderMarkdown(state.rawMarkdown);
}

function renderStatus() {
  els.statusBar.hidden = !state.statusMessage;
  els.statusMessage.textContent = state.statusMessage;
  els.statusBar.className = 'status-bar ' + (state.isError ? 'error' : 'ok');
  els.clearStatusBtn.hidden = !state.isError;
}

function renderLLMPanel() {
  const showAnswer = state.isLoading || !!state.llmAnswer;
  els.llmAnswerArea.hidden = !showAnswer;
  if (state.isLoading) {
    const spin = document.createElement('div');
    spin.className = 'spinner';
    const t = document.createElement('span');
    t.textContent = 'Thinking…';
    els.llmAnswerText.innerHTML = '';
    els.llmAnswerText.appendChild(spin);
    els.llmAnswerText.appendChild(t);
  } else {
    els.llmAnswerText.textContent = state.llmAnswer;
  }
  els.copyAnswerBtn.hidden = !state.llmAnswer;
  if (els.llmQuestion.value !== state.llmQuestion) {
    els.llmQuestion.value = state.llmQuestion;
  }
  renderStatus();
}

function renderModals() {
  renderApiKeyList();
  renderModelSelect();
  els.shortcutDisplay.textContent = state.previewShortcut.display;
  els.workingDirPath.textContent = state.workingDirName;
}

function renderApiKeyList() {
  els.apiKeyList.innerHTML = '';
  if (!state.apiKeys.length) {
    const none = document.createElement('div');
    none.className = 'settings-value';
    none.textContent = 'No API keys configured';
    els.apiKeyList.appendChild(none);
    return;
  }
  for (const key of state.apiKeys) {
    const row = document.createElement('div');
    row.className = 'api-key-item';

    const activeBtn = document.createElement('button');
    activeBtn.className = 'api-key-active' + (key.isActive ? ' on' : '');
    activeBtn.title = key.isActive ? 'Active key' : 'Set as active';
    activeBtn.setAttribute('aria-label', key.isActive ? 'Active key' : 'Set as active');
    if (key.isActive) activeBtn.appendChild(svgIcon(ICONS.checkmark));
    activeBtn.addEventListener('click', () => {
      if (key.isActive) return;
      state.apiKeys.forEach(k => { k.isActive = k.id === key.id; });
      persistApiKeys();
      renderModals();
    });
    row.appendChild(activeBtn);

    const masked = document.createElement('span');
    masked.className = 'api-key-key';
    masked.textContent = maskedDisplay(key.key);
    row.appendChild(masked);

    const del = document.createElement('button');
    del.className = 'icon-btn api-key-delete';
    del.title = 'Delete API key';
    del.setAttribute('aria-label', 'Delete API key');
    del.appendChild(svgIcon(ICONS.trash));
    del.addEventListener('click', () => deleteApiKey(key.id));
    row.appendChild(del);

    els.apiKeyList.appendChild(row);
  }
}

function maskedDisplay(key) {
  if (!key) return '';
  if (key.length <= 4) return '•'.repeat(key.length);
  return '••••••••…' + key.slice(-4);
}

function deleteApiKey(id) {
  const wasActive = state.apiKeys.find(k => k.id === id)?.isActive || false;
  state.apiKeys = state.apiKeys.filter(k => k.id !== id);
  if (wasActive && state.apiKeys.length) {
    state.apiKeys[0].isActive = true;
  }
  persistApiKeys();
  renderModals();
}

function addNewKey(key) {
  const makeActive = state.apiKeys.length === 0;
  if (makeActive) state.apiKeys.forEach(k => { k.isActive = false; });
  state.apiKeys.push({
    id: crypto.randomUUID(),
    name: `API Key ${state.apiKeys.length + 1}`,
    key,
    isActive: makeActive,
  });
  persistApiKeys();
  renderModals();
}

function renderModelSelect() {
  els.modelSelect.innerHTML = '';
  for (const id of LLM_MODELS) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = modelDisplay(id);
    els.modelSelect.appendChild(opt);
  }
  els.modelSelect.value = state.selectedModel;
}

/* --- search highlight overlay --- */
function updateHighlightLayer() {
  const text = state.rawMarkdown;
  if (!state.searchActive) {
    els.highlightLayer.textContent = text;
    els.app.classList.remove('search-active');
    return;
  }
  const q = state.searchText.trim().toLowerCase();
  if (!q) {
    els.highlightLayer.textContent = text;
    els.app.classList.remove('search-active');
    return;
  }
  els.app.classList.add('search-active');
  const ranges = searchHighlightRanges();
  let html = '';
  let last = 0;
  const lower = text.toLowerCase();
  for (const [start, end] of ranges) {
    html += escapeHtml(text.slice(last, start));
    html += `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
    last = end;
  }
  html += escapeHtml(text.slice(last));
  els.highlightLayer.innerHTML = html;
}

function syncHighlightScroll() {
  if (!state.searchActive) return;
  els.highlightLayer.style.transform = `translateY(${-els.editorScroll.scrollTop}px)`;
}

function focusEditor() {
  els.markdownEditor.focus();
}

/* ==========================================================================
   Modals
   ========================================================================== */
const openModals = new Set();
function openModal(id) {
  const modal = els[id];
  if (!modal) return;
  modal.hidden = false;
  openModals.add(id);
  const input = modal.querySelector('input');
  if (input) setTimeout(() => input.focus(), 30);
}
function closeModal(id) {
  const modal = els[id];
  if (!modal) return;
  modal.hidden = true;
  openModals.delete(id);
}

let confirmResolver = null;
function confirmDialog(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    els.confirmMessage.textContent = message;
    els.confirmOkBtn.textContent = okLabel;
    els.confirmModal.hidden = false;
    openModals.add('confirmModal');
    setTimeout(() => els.confirmOkBtn.focus(), 30);
  });
}
function closeConfirm(result) {
  els.confirmModal.hidden = true;
  openModals.delete('confirmModal');
  const r = confirmResolver;
  confirmResolver = null;
  if (r) r(result);
}

function openSettings() {
  renderModals();
  openModal('settingsModal');
}

/* ==========================================================================
   Context menu
   ========================================================================== */
let ctxTarget = null;
function showContextMenu(x, y, name) {
  ctxTarget = name;
  els.contextMenu.hidden = false;
  els.contextMenu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  els.contextMenu.style.top = Math.min(y, window.innerHeight - 100) + 'px';
}
function hideContextMenu() {
  els.contextMenu.hidden = true;
  ctxTarget = null;
}

/* ==========================================================================
   Sidebar / mobile navigation
   ========================================================================== */
function openSidebar() {
  state.sidebarOpen = true;
  els.app.classList.add('sidebar-open');
  els.sidebarOverlay.hidden = false;
}
function closeSidebar() {
  state.sidebarOpen = false;
  els.app.classList.remove('sidebar-open');
  els.sidebarOverlay.hidden = true;
}

function setViewport() {
  const width = window.innerWidth;
  if (width < 768) {
    state.viewport = 'mobile';
    if (!state.mobileView) state.mobileView = 'list';
  } else {
    state.viewport = 'desktop';
    state.mobileView = 'list';
  }
  setViewClass();
}

function setViewClass() {
  const app = els.app;
  app.classList.remove('desktop', 'mobile', 'view-list', 'view-editor');
  app.classList.add(state.viewport);
  if (state.viewport === 'mobile') {
    app.classList.add(state.mobileView === 'editor' ? 'view-editor' : 'view-list');
  }
}

/* ==========================================================================
   Autosave & external refresh
   ========================================================================== */
let renameCheckTimer = null;
function scheduleRenameCheck() {
  clearTimeout(renameCheckTimer);
  renameCheckTimer = setTimeout(() => {
    checkRenameAndTags();
  }, 2000);
}

async function checkRenameAndTags() {
  const previousTags = state.summaries[state.currentFileName]?.tags || [];
  const currentTags = TagParser.tags(state.rawMarkdown);
  const completedTagsChanged = JSON.stringify(previousTags) !== JSON.stringify(currentTags) && currentTags.length > 0;
  // Persist new documents (no currentFileName yet) as soon as they have a
  // usable title, so they appear in the working directory without waiting
  // for the 10-second autosave.
  const isNewDocToSave = !state.currentFileName &&
    state.hasUnsavedChanges &&
    FileManager.hasUsableTitle(state.rawMarkdown);
  if (completedTagsChanged || isNewDocToSave) {
    if (await savePendingChanges()) reconcileLibraryState(completedTagsChanged);
    renderAll();
  }
}

function setupAutosave() {
  setInterval(() => {
    if (!state.hasUnsavedChanges) return;
    if (!state.rawMarkdown && !state.currentFileName) return;
    savePendingChanges().then(() => {
      reconcileLibraryState();
      renderAll();
    });
  }, 10000);
}

function setupExternalRefresh() {
  setInterval(() => {
    if (!state.hasUnsavedChanges) refreshExternalChanges();
  }, 2000);
}

async function refreshExternalChanges() {
  if (state.mode !== 'fsa') return;
  const files = await listMarkdownFiles();
  const fileSet = new Set(files);
  const listChanged = JSON.stringify(files) !== JSON.stringify(state.availableFiles);

  let openChanged = false;
  let anyChanged = listChanged;
  if (state.currentFileName && fileSet.has(state.currentFileName)) {
    const m = await modificationDate(state.currentFileName);
    if (state.summaries[state.currentFileName]?.mtime !== m) openChanged = true;
  }
  if (!anyChanged) {
    for (const name of files) {
      const m = await modificationDate(name);
      if (state.summaries[name]?.mtime !== m) { anyChanged = true; break; }
    }
  }
  if (!anyChanged) return;

  await loadAvailableFiles();
  if (openChanged && fileSet.has(state.currentFileName)) {
    await loadDocument(state.currentFileName);
  }
  reconcileLibraryState(true);
  renderAll();
}

/* ==========================================================================
   Event wiring
   ========================================================================== */
function bindEvents() {
  // Sidebar
  els.collectionButton.addEventListener('click', () => {
    state.selection = 'all';
    updateFilteredFiles();
    reconcileCurrentDocument();
    renderAll();
    closeSidebar();
    if (state.viewport === 'mobile') { state.mobileView = 'list'; setViewClass(); }
  });
  els.settingsButton.addEventListener('click', openSettings);
  els.folderButton.addEventListener('click', pickDirectory);

  // List
  els.newFromListBtn.addEventListener('click', createNewDocument);
  els.fabBtn.addEventListener('click', createNewDocument);
  els.mobileMenuBtn.addEventListener('click', openSidebar);
  els.mobileMenuBtn2.addEventListener('click', openSidebar);
  els.sidebarOverlay.addEventListener('click', closeSidebar);

  // Editor toolbar
  els.newBtn.addEventListener('click', createNewDocument);
  els.saveBtn.addEventListener('click', handleManualSave);
  els.searchBtn.addEventListener('click', () => {
    els.searchInput.value = state.searchText;
    els.searchConfirmBtn.disabled = !els.searchInput.value.trim();
    openModal('searchModal');
  });
  els.tagBtn.addEventListener('click', openTagEditor);
  els.previewBtn.addEventListener('click', togglePreviewMode);
  els.backBtn.addEventListener('click', () => {
    state.mobileView = 'list';
    setViewClass();
  });

  // Editor input
  els.markdownEditor.addEventListener('input', () => {
    const oldValue = state.rawMarkdown;
    state.rawMarkdown = els.markdownEditor.value;
    if (oldValue === state.rawMarkdown) return;
    state.hasUnsavedChanges = true;
    pushUndo(oldValue);
    updateHighlightLayer();
    renderEditor();
    scheduleRenameCheck();
  });
  els.editorScroll.addEventListener('scroll', syncHighlightScroll);

  // LLM
  els.llmQuestion.addEventListener('input', () => {
    state.llmQuestion = els.llmQuestion.value;
    autoGrow(els.llmQuestion);
  });
  els.llmQuestion.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askLLM();
    }
  });
  els.copyAnswerBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.llmAnswer);
      showStatus('Copied', false);
    } catch (e) {
      showStatus('Copy failed', true);
    }
  });
  els.clearStatusBtn.addEventListener('click', clearStatus);

  // Search modal
  els.searchInput.addEventListener('input', () => {
    els.searchConfirmBtn.disabled = !els.searchInput.value.trim();
  });
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && els.searchInput.value.trim()) confirmSearch();
  });
  els.searchConfirmBtn.addEventListener('click', confirmSearch);
  els.searchCancelBtn.addEventListener('click', () => closeModal('searchModal'));
  function confirmSearch() {
    search(els.searchInput.value);
    closeModal('searchModal');
    if (state.viewport === 'mobile') {
      state.mobileView = 'list';
      setViewClass();
    }
  }

  // Tag modal
  els.tagSaveBtn.addEventListener('click', confirmTags);
  els.tagCancelBtn.addEventListener('click', () => closeModal('tagModal'));
  els.tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmTags(); }
  });
  function confirmTags() {
    const tags = els.tagInput.value
      .split(/[,|\n]/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length);
    setDocumentTags(tags);
    closeModal('tagModal');
  }

  // Settings
  els.settingsDoneBtn.addEventListener('click', () => closeModal('settingsModal'));
  els.chooseDirBtn.addEventListener('click', () => {
    pickDirectory().then(ok => { if (ok) closeModal('settingsModal'); });
  });
  els.resetDirBtn.addEventListener('click', () => {
    confirmDialog('Reset working directory to the default (empty) library?', 'Reset').then(ok => {
      if (ok) resetWorkingDirectory();
    });
  });
  els.testKeyBtn.addEventListener('click', testConnection);
  els.addKeyBtn.addEventListener('click', () => {
    els.newKeyInput.value = '';
    els.newKeyAddBtn.disabled = true;
    openModal('addKeyModal');
  });
  els.modelSelect.addEventListener('change', () => {
    state.selectedModel = els.modelSelect.value;
    localStorage.setItem(LS.selectedModel, state.selectedModel);
  });
  els.recordShortcutBtn.addEventListener('click', () => {
    els.recordShortcutBtn.textContent = 'Recording…';
    state.recordingShortcut = true;
  });
  els.resetShortcutBtn.addEventListener('click', () => {
    state.previewShortcut = { alt: true, ctrl: false, meta: false, shift: false, code: 'Space', display: 'Option+Space' };
    localStorage.setItem(LS.previewShortcut, JSON.stringify(state.previewShortcut));
    els.shortcutDisplay.textContent = state.previewShortcut.display;
  });

  // Add key modal
  els.newKeyInput.addEventListener('input', () => {
    els.newKeyAddBtn.disabled = !els.newKeyInput.value.trim();
  });
  els.newKeyAddBtn.addEventListener('click', () => {
    const key = els.newKeyInput.value.trim();
    if (key) addNewKey(key);
    closeModal('addKeyModal');
  });
  els.newKeyCancelBtn.addEventListener('click', () => closeModal('addKeyModal'));

  // Context menu
  els.ctxDelete.addEventListener('click', () => {
    const target = ctxTarget;
    hideContextMenu();
    if (target) deleteDocument(target);
  });
  els.ctxDownload.addEventListener('click', () => {
    const target = ctxTarget;
    hideContextMenu();
    if (target) downloadFile(target);
  });
  document.addEventListener('click', (e) => {
    if (!els.contextMenu.hidden && !els.contextMenu.contains(e.target)) hideContextMenu();
  });

  // File inputs
  els.folderInput.addEventListener('change', onFolderInputChange);
  els.fileInput.addEventListener('change', onFileInputChange);

  // Global keyboard
  document.addEventListener('keydown', handleKeydown);

  // Resize + visibility
  window.addEventListener('resize', () => {
    let t;
    clearTimeout(t);
    t = setTimeout(() => {
      setViewport();
      renderAll();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshExternalChanges();
  });

  // Modal overlay backdrop click
  ['searchModal', 'tagModal', 'settingsModal', 'addKeyModal'].forEach(id => {
    els[id].addEventListener('click', (e) => {
      if (e.target === els[id]) closeModal(id);
    });
  });

  // Confirm dialog
  els.confirmOkBtn.addEventListener('click', () => closeConfirm(true));
  els.confirmCancelBtn.addEventListener('click', () => closeConfirm(false));
  els.confirmModal.addEventListener('click', (e) => {
    if (e.target === els.confirmModal) closeConfirm(false);
  });
}

function openTagEditor() {
  const existing = currentDocumentTags();
  els.tagModalTitle.textContent = existing.length ? 'Edit Tags' : 'Add Tags';
  els.tagInput.value = existing.join(', ');
  els.tagSaveBtn.textContent = existing.length ? 'Save' : 'Add';
  els.tagChips.innerHTML = '';
  for (const tag of existing) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = capitalize(tag);
    els.tagChips.appendChild(chip);
  }
  openModal('tagModal');
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 134) + 'px';
}

function downloadFile(name) {
  const content = state.summaries[name]?.content ?? state.rawMarkdown;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- keyboard shortcuts --- */
function previewShortcutMatches(e) {
  const s = state.previewShortcut;
  return e.code === s.code &&
    !!e.altKey === !!s.alt &&
    !!e.ctrlKey === !!s.ctrl &&
    !!e.metaKey === !!s.meta &&
    !!e.shiftKey === !!s.shift;
}

function handleKeydown(e) {
  // Recording a shortcut
  if (state.recordingShortcut) {
    e.preventDefault();
    const mods = [];
    if (e.altKey) mods.push('Option');
    if (e.ctrlKey) mods.push('Control');
    if (e.metaKey) mods.push('Command');
    if (e.shiftKey) mods.push('Shift');
    const keyLabel = e.code === 'Space' ? 'Space'
      : e.key && e.key.length === 1 ? e.key.toUpperCase()
      : e.code.replace(/^(Key|Digit)/, '');
    state.previewShortcut = {
      alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey,
      code: e.code, display: [...mods, keyLabel].join('+'),
    };
    localStorage.setItem(LS.previewShortcut, JSON.stringify(state.previewShortcut));
    els.recordShortcutBtn.textContent = 'Record';
    els.shortcutDisplay.textContent = state.previewShortcut.display;
    state.recordingShortcut = false;
    return;
  }

  const mod = e.metaKey || e.ctrlKey;

  if (mod && e.code === 'KeyN') {
    e.preventDefault();
    createNewDocument();
    return;
  }
  if (mod && e.code === 'KeyO') {
    e.preventDefault();
    els.fileInput.click();
    return;
  }
  if (mod && e.code === 'KeyZ') {
    if (e.shiftKey) { e.preventDefault(); redo(); }
    else { e.preventDefault(); undo(); }
    return;
  }
  if (mod && e.code === 'KeyY') {
    e.preventDefault();
    redo();
    return;
  }

  // Escape: close modal, else clear search
  if (e.key === 'Escape') {
    if (openModals.size) {
      const id = [...openModals].pop();
      if (id === 'confirmModal') closeConfirm(false);
      else closeModal(id);
    } else if (state.searchActive) {
      clearSearch();
    }
    return;
  }

  // Preview shortcut (default Option+Space)
  if (previewShortcutMatches(e)) {
    const isTyping = ['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName);
    if (isTyping && document.activeElement === els.llmQuestion) return;
    e.preventDefault();
    togglePreviewMode();
  }
}

/* ==========================================================================
   Render all
   ========================================================================== */
function renderAll() {
  renderSidebar();
  renderNoteList();
  renderEditor();
  renderLLMPanel();
}

/* ==========================================================================
   Init
   ========================================================================== */
async function init() {
  cacheEls();
  loadSettings();
  setViewport();
  await detectMode();
  await loadAvailableFiles();
  reconcileCurrentDocument();
  renderAll();
  bindEvents();
  setupAutosave();
  setupExternalRefresh();
  // Never auto-show the settings window on launch. It only opens via the
  // sidebar "Settings" or toolbar "Set" buttons. Guard against any residual
  // modal state left over from a prior session or a stale cached build.
  ['searchModal', 'tagModal', 'settingsModal', 'addKeyModal', 'confirmModal'].forEach(id => {
    const m = els[id];
    if (m) { m.hidden = true; }
  });
  openModals.clear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();