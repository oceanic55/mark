# Web Save Fix Specification

## Scope
Fix save behavior in `web/app.js` for the File System Access (FSA), IndexedDB, directory-import, and download-only browser modes. Saving a new document must never overwrite an existing document; saving an edited document must target the exact file opened by the user.

## Findings

1. **The low-level writer is overwrite-capable.** `saveMarkdown(name, content)` calls `getFileHandle(name, { create: true })` and writes to it, while IndexedDB uses `put` with `name` as its key. Both operations replace an existing file with the same name.
2. **Name collision handling is incomplete and inconsistent.** `generateFileName` starts at the unsuffixed name and then uses `02`, `03`, etc. It does not implement the requested `x01`, `x02` convention. It also depends on `state.availableFiles`, which can be stale at the point of save.
3. **Editing does not have a separate save identity.** `currentFileName` is used both as the displayed name and as an implicit target, while `generateFileName(rawMarkdown, currentFileName)` may derive a different name when the title changes. The manual-save confirmation displays the derived name, not necessarily the file opened by the user.
4. **Download-only mode cannot overwrite a local file.** `downloadFile` always creates a browser download. The browser may rename a duplicate download (for example `foo (1).md`), but that name is not recorded in app state, so subsequent saves cannot identify the downloaded file.
5. **Import collision handling uses `02` and does not share save rules.** `importFiles` has a separate collision implementation, making behavior differ between imported and newly saved documents.

## Required behavior

### New document

- Before choosing a new filename, obtain a fresh list of Markdown filenames from the active storage backend.
- Derive the requested base name from the document title.
- If `<base>.md` is unused, use it.
- If it exists, try `<base>x01.md`, then `<base>x02.md`, incrementing until an unused name is found. (The suffix is part of the filename and appears before `.md`.)
- Never overwrite an existing file during a new-document save, including races detected immediately before writing.
- Set `state.currentFileName` to the actual allocated filename only after the write succeeds, and refresh the library.

### Editing an existing document

- When `loadDocument(name)` succeeds, set a stable save target (for example `state.currentFileName` / `state.currentFileId`) to exactly `name`.
- Manual Save, autosave, tag changes, and save-before-navigation must write to that stable target. They must not regenerate a filename merely because the title changed.
- Existing-file saves are intentional overwrites of the file currently open; confirmation may be shown, but it must identify the exact target name.
- A title change must not silently rename the document. If rename is desired later, it must be an explicit separate action with the same collision allocator and no overwrite.
- Do not allocate a version suffix for ordinary edits to an opened file.

### Download-only mode

- Allocate a collision-free filename using the same `x01`, `x02` algorithm before downloading a new document.
- Record the allocated name as `state.currentFileName` and use it for later in-app saves/downloads.
- Clearly indicate that a browser download cannot overwrite an existing disk file. If the user edits an opened imported document, the app should offer the exact filename as the download target; the browser remains responsible for the final disk destination.
- Do not claim that a download overwrote a file.

## Design requirements

- Introduce one shared `allocateUniqueFileName(baseName, existingNames)` helper; use it for new saves and imports.
- Add a storage-aware `getCurrentFileNames()` immediately before allocation. Do not rely only on `state.availableFiles`.
- Keep allocation and writing in one save flow. For FSA, re-check existence before creating a new file and fail/retry with the next suffix if a collision occurs.
- Keep `persistCurrentDocument` branches explicit: `isNewDocument` allocates; `currentFileName` updates that exact name.
- Avoid `renameMarkdown` in ordinary persistence.
- Refresh `availableFiles`, summaries, displayed filename, and unsaved state only after successful persistence.
- Preserve the existing empty-document/title validation and error reporting.

## Acceptance criteria

- Saving two new documents with the same title produces `Title.md` and `Titlex01.md`; a third produces `Titlex02.md`.
- Existing files are never replaced by a new-document save or import.
- Opening `Titlex01.md`, editing it, and pressing Save writes only `Titlex01.md`.
- Editing a file so its first heading changes does not redirect Save to another variant or rename it.
- Autosave and save-before-navigation use the same exact target as manual Save.
- In download-only mode, duplicate new saves receive the next `xNN` name and the status message accurately describes a download rather than an overwrite.
- Tests cover collision allocation, stale-library refresh, opened-variant editing, title changes, imports, and all storage modes.
