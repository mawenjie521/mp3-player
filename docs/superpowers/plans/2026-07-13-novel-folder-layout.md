# Novel Folder Layout by Title/Chapter Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store new OCR novel imports under `ocr-novels/<sanitized-title>/<chapter-title>.m4a` instead of `ocr-novels/ocr-<id>/ch-N.m4a`, so the on-disk layout is human-readable.

**Architecture:** Keep `bookId` (`ocr-${Date.now()}`) as the AsyncStorage key and track-ID prefix; only the on-disk folder name changes. During import, use the temp `ocr-<bookId>` folder (timestamp-unique, no collision). At finalization in `runTts`, compute the final `<sanitized-title>` folder (with ` (2)`..` (99)` collision suffix), `RNFS.moveFile` the temp folder to it, and build the book object with paths pointing to the final folder. Existing novels keep the old layout; code reads both via stored paths. Append mode derives the existing folder via a new `getBookDir(book)` helper.

**Tech Stack:** React Native 0.75.4, `react-native-fs` (RNFS.moveFile, RNFS.exists, RNFS.unlink), no automated tests (verification = Metro bundle + manual iOS simulator).

## Global Constraints

- New imports only; existing novels keep `ocr-<id>/ch-N.m4a` layout — no migration.
- `bookId` unchanged: `ocr-${Date.now()}` (still used as AsyncStorage key and track-ID prefix `${book.id}/${ch.id}`).
- TTS audio filename: `<chapter-title>.m4a` (e.g., `第 1 章.m4a`). Chapter titles are auto-generated `第 ${N} 章`, no user editing, no sanitization needed.
- Imported audio chapters (from folder-import) keep their original filename — unchanged from existing behavior.
- Source images: `source-N.<ext>`, cover: `cover.<ext>` — unchanged.
- Folder name: `sanitizeTitle(title)` (trim, replace `/` `:` `\0` `\n` `\t` with `_`, truncate to 80 chars); empty -> fall back to `ocr-${bookId}`; collision -> append ` (2)`..` (99)`; all 99 taken -> fall back to `ocr-${bookId}`.
- Temp folder during processing: `${OCR_DIR}/${tempBookId}`. Rename to final folder at end of `runTts` (new mode only; append mode reuses existing folder, no rename).
- `moveFile` failure: catch, keep temp `ocr-<bookId>` folder, build book object with temp paths, proceed silently (no Alert).
- `getBookDir(book)` exported from `src/data/ocrNovels.js`: derives folder from `book.coverImage` (strip protocol + filename), else from first chapter's `audioPath`, else falls back to `${OCR_DIR}/${book.id}`.
- Verification: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/bundle.js` must exit 0.

---

### Task 1: getBookDir helper and deleteOCRNovel fix

**Files:**
- Modify: `src/data/ocrNovels.js`

**Interfaces:**
- Produces: `getBookDir(book)` exported from `src/data/ocrNovels.js`. Signature: `getBookDir(book: { coverImage?: string, chapters?: Array<{ audioPath?: string }>, id: string }): string`. Returns the absolute filesystem path (no `file://` prefix) of the book's storage folder. Task 2 imports this.

- [ ] **Step 1: Add getBookDir function**

In `src/data/ocrNovels.js`, after the existing `resolvePathNoProtocol` function (around line 21) and before `loadOCRNovels`, add:

```js
// Derive the book's storage folder from any stored path. Needed because
// new-layout books use <sanitized-title> as folder name (not bookId), so
// we can't assume folder = `${OCR_DIR}/${book.id}`.
export function getBookDir(book) {
  if (book.coverImage) {
    const path = resolvePathNoProtocol(book.coverImage);
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : path;
  }
  const chWithAudio = book.chapters?.find((ch) => ch.audioPath);
  if (chWithAudio) {
    const path = resolvePathNoProtocol(chWithAudio.audioPath);
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : path;
  }
  return `${OCR_DIR}/${book.id}`;
}
```

- [ ] **Step 2: Fix deleteOCRNovel to use getBookDir**

In `src/data/ocrNovels.js`, replace the existing `deleteOCRNovel` function (currently lines 34-44):

```js
export async function deleteOCRNovel(bookId) {
  const existing = await loadOCRNovels();
  const next = existing.filter((b) => b.id !== bookId);
  await saveJSON(STORAGE_KEY, next);
  try {
    await RNFS.unlink(`${OCR_DIR}/${bookId}`);
  } catch {
    // Directory may not exist - ignore
  }
  return next;
}
```

with:

```js
export async function deleteOCRNovel(bookId) {
  const existing = await loadOCRNovels();
  const book = existing.find((b) => b.id === bookId);
  const next = existing.filter((b) => b.id !== bookId);
  await saveJSON(STORAGE_KEY, next);
  if (book) {
    try {
      await RNFS.unlink(getBookDir(book));
    } catch {
      // Directory may not exist - ignore
    }
  }
  return next;
}
```

The key change: find the book before filtering it out, then unlink `getBookDir(book)` instead of `${OCR_DIR}/${bookId}`. This fixes delete for new-layout books (whose folder is `<title>`, not `<bookId>`) and preserves old-layout behavior (where `getBookDir` returns `${OCR_DIR}/${book.id}` via the fallback, same as before).

- [ ] **Step 3: Verify Metro bundle**

Run: `cd /Users/mawenjie14/demo/MP3-codex && npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/bundle.js`
Expected: exit 0, final line `Done writing bundle output to: /tmp/bundle.js`.

- [ ] **Step 4: Commit**

```bash
cd /Users/mawenjie14/demo/MP3-codex
git add src/data/ocrNovels.js
git commit -m "Add getBookDir helper, fix deleteOCRNovel folder derivation"
```

---

### Task 2: Title-based folder layout in OcrImportScreen

**Files:**
- Modify: `src/screens/OcrImportScreen.js`

**Interfaces:**
- Consumes: `getBookDir(book)` from `../data/ocrNovels` (Task 1).
- Produces: no new exports. Internal helpers `sanitizeTitle` (sync) and `computeBookDir` (async) are file-private.

- [ ] **Step 1: Import getBookDir**

In `src/screens/OcrImportScreen.js`, after the existing `synthesizeChapter` import (line 18), add:

```js
import { getBookDir } from "../data/ocrNovels";
```

The import block (lines 13-19) becomes:

```js
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import DocumentPicker from "react-native-document-picker";
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import RNFS from "react-native-fs";
import { COLORS } from "../data/constants";
import { synthesizeChapter } from "../data/tts";
import { getBookDir } from "../data/ocrNovels";
import OcrChapterEditScreen from "./OcrChapterEditScreen";
```

- [ ] **Step 2: Add sanitizeTitle and computeBookDir helpers**

After the existing `naturalCompare` function (ends around line 41) and before the `OcrImportScreen` component declaration, add:

```js
function sanitizeTitle(title) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[/:\x00\n\t]/g, "_");
  return cleaned.length > 80 ? cleaned.substring(0, 80) : cleaned;
}

async function computeBookDir(title, bookId) {
  const base = sanitizeTitle(title);
  if (!base) return `${OCR_DIR}/${bookId}`;
  const candidate = `${OCR_DIR}/${base}`;
  try {
    if (!(await RNFS.exists(candidate))) return candidate;
  } catch {
    return candidate;
  }
  for (let i = 2; i <= 99; i++) {
    const next = `${OCR_DIR}/${base} (${i})`;
    try {
      if (!(await RNFS.exists(next))) return next;
    } catch {
      return next;
    }
  }
  return `${OCR_DIR}/${bookId}`;
}
```

- [ ] **Step 3: Derive bookDir from getBookDir in append mode**

In the `OcrImportScreen` component, the current `bookDir` declaration (line 54) is:

```js
const bookDir = `${OCR_DIR}/${tempBookId}`;
```

Replace with:

```js
const bookDir = isAppendMode ? getBookDir(existingBook) : `${OCR_DIR}/${tempBookId}`;
```

This makes append mode derive the existing book's actual folder (works for both old-layout `ocr-<id>` and new-layout `<title>` folders). New mode keeps the temp `ocr-<bookId>` folder during processing; the rename to `<title>` happens in Step 5.

- [ ] **Step 4: Change TTS audio filename to chapter title**

In the `runTts` function, inside the TTS loop, the current audio path (line 251) is:

```js
const audioPath = `file://${bookDir}/${ch.id}.m4a`;
```

Replace with:

```js
const audioPath = `file://${bookDir}/${ch.title}.m4a`;
```

Chapter titles are `第 ${N} 章` (auto-generated, no illegal chars, no user editing), so no sanitization is needed. Files are written to the temp `bookDir` during the loop; the rename in Step 5 moves them to the final folder.

- [ ] **Step 5: Add rename flow and path rewriting at finalization**

In the `runTts` function, the current finalization block (after the TTS loop, around lines 280-315) is:

```js
    if (completedChapters.length === 0) {
      Alert.alert("没有可用的章节", "所有章节都合成失败", [
        { text: "确定", onPress: () => cleanupAndCancel() },
      ]);
      return;
    }

    if (isAppendMode) {
      onAppendComplete(
        completedChapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          text: ch.text,
          audioPath: ch.audioPath,
          sourceImagePath: ch.sourceImagePath,
        }))
      );
      return;
    }

    const book = {
      id: tempBookId,
      title: bookTitle.trim(),
      coverImage: coverPath,
      chapters: completedChapters.map((ch, i) => ({
        id: ch.id,
        title: ch.title,
        text: ch.text,
        audioPath: ch.audioPath,
        sourceImagePath: ch.sourceImagePath,
      })),
      createdAt: Date.now(),
      isOCR: true,
    };
    onComplete(book);
  };
```

Replace with:

```js
    if (completedChapters.length === 0) {
      Alert.alert("没有可用的章节", "所有章节都合成失败", [
        { text: "确定", onPress: () => cleanupAndCancel() },
      ]);
      return;
    }

    let finalDir = bookDir;
    if (!isAppendMode) {
      finalDir = await computeBookDir(bookTitle, tempBookId);
      if (finalDir !== bookDir) {
        try {
          await RNFS.moveFile(bookDir, finalDir);
        } catch {
          // moveFile failed (disk full, permissions) - keep temp folder
          finalDir = bookDir;
        }
      }
    }
    const resolveFinal = (p) =>
      p ? p.replace(`file://${bookDir}`, `file://${finalDir}`) : p;

    if (isAppendMode) {
      onAppendComplete(
        completedChapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          text: ch.text,
          audioPath: ch.audioPath,
          sourceImagePath: ch.sourceImagePath,
        }))
      );
      return;
    }

    const book = {
      id: tempBookId,
      title: bookTitle.trim(),
      coverImage: resolveFinal(coverPath),
      chapters: completedChapters.map((ch, i) => ({
        id: ch.id,
        title: ch.title,
        text: ch.text,
        audioPath: resolveFinal(ch.audioPath),
        sourceImagePath: resolveFinal(ch.sourceImagePath),
      })),
      createdAt: Date.now(),
      isOCR: true,
    };
    onComplete(book);
  };
```

Key changes:
1. After the empty-chapters check, compute `finalDir` via `computeBookDir` (new mode only). If it differs from `bookDir`, `RNFS.moveFile` the temp folder to `finalDir`. On failure, fall back to `bookDir` (book saves with ugly folder name, data preserved).
2. `resolveFinal(p)` rewrites `file://${bookDir}` -> `file://${finalDir}` in stored paths. In append mode `finalDir === bookDir` so it's a no-op (and append mode doesn't use it anyway — the `onAppendComplete` map uses `ch.audioPath` directly).
3. The new-mode `book` object applies `resolveFinal` to `coverImage` and each chapter's `audioPath`/`sourceImagePath`, so stored paths point to the renamed folder.

- [ ] **Step 6: Verify Metro bundle**

Run: `cd /Users/mawenjie14/demo/MP3-codex && npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/bundle.js`
Expected: exit 0, final line `Done writing bundle output to: /tmp/bundle.js`.

- [ ] **Step 7: Commit**

```bash
cd /Users/mawenjie14/demo/MP3-codex
git add src/screens/OcrImportScreen.js
git commit -m "Store new OCR imports under sanitized-title folder with chapter-name audio"
```

---

## Manual simulator test plan (post-implementation)

After both tasks land, verify on iOS simulator:

1. **New image-mode import** — enter title "三体", import images. Files at `ocr-novels/三体/第 1 章.m4a`, `cover.jpg`, `source-0.jpg`.
2. **New folder-import (mixed)** — pick a folder named "射雕". Folder at `ocr-novels/射雕/`. TTS chapters = `第 N 章.m4a`, imported audio keeps original names.
3. **Empty title** — Alert "请输入书名" (existing guard, no rename attempted).
4. **Title with illegal chars** (`///` or `a:b`) — sanitized to `___` or `a_b`.
5. **Duplicate title** — second "三体" -> folder `ocr-novels/三体 (2)/`.
6. **Append to new-layout book** — append chapters to "三体". New files land in `ocr-novels/三体/` as `第 6 章.m4a` etc.
7. **Append to old-layout book** (existing test data) — new files land in existing `ocr-<id>/` folder. Old chapters keep `ch-N.m4a`, new ones get `第 N 章.m4a`. Mixed naming acceptable.
8. **Delete new-layout book** — `ocr-novels/三体/` folder removed.
9. **Delete old-layout book** — `ocr-novels/ocr-<id>/` folder removed.
10. **Cancel during import** — temp `ocr-<id>/` folder cleaned up (existing behavior, unchanged).
