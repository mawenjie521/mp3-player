# 从文件夹导入小说 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "从文件夹导入" button to OcrImportScreen that batch-imports mixed file types (images/text/audio) as chapters from a selected directory.

**Architecture:** Extend `OcrImportScreen` with a third entry button. Unify the `images` state into `pendingFiles` (each item `{uri, type, name}`). Add folder scanning via `DocumentPicker.pickDirectory()` + `RNFS.readDir()`, mixed-type processing, and modify edit/TTS steps to handle audio chapters (no text, skip TTS).

**Tech Stack:** React Native 0.75.4, react-native-document-picker ^9.0.1, react-native-fs ^2.20.0, @react-native-ml-kit/text-recognition ^2.0.0

## Global Constraints

- **No automated tests.** Verification = `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` + manual iOS simulator. Do NOT run `npm test` (exits 1 with "No tests found" - pre-existing, not a regression).
- Files stored under `Documents/ocr-novels/<bookId>/`, one directory per novel, all chapters in same directory.
- Chapter id format: `ch-{N}` where N = `startIndex + sequential index`.
- Follow existing code style: functional components, hooks, StyleSheet, `COLORS` from `src/data/constants.js`.
- Commit after each task.
- Spec: `docs/superpowers/specs/2026-07-11-directory-import-design.md`

---

### Task 1: Refactor `images` state to typed `pendingFiles`

**Files:**
- Modify: `src/screens/OcrImportScreen.js`

**Interfaces:**
- Produces: `pendingFiles` state = array of `{uri: string, type: "image"|"text"|"audio", name: string}`. `removeFile(index)`. All existing flows (pickFromLibrary, takePhoto) populate `type: "image"`.

**Why:** Folder import needs to track file type alongside URI. Unifying the state keeps processing and display single-pathed instead of branching on two states.

- [ ] **Step 1: Rename state and update pickers**

In `src/screens/OcrImportScreen.js`, change the state declaration (around line 26):

```js
const [pendingFiles, setPendingFiles] = useState([]);
```

Update `pickFromLibrary`:
```js
const pickFromLibrary = async () => {
  const result = await launchImageLibrary({
    selectionLimit: 0,
    mediaType: "photo",
    includeBase64: false,
  });
  if (result.didCancel || !result.assets) return;
  const newFiles = result.assets.map((a) => ({
    uri: a.uri,
    type: "image",
    name: a.fileName || `image-${Date.now()}.jpg`,
  }));
  setPendingFiles((prev) => [...prev, ...newFiles]);
};
```

Update `takePhoto`:
```js
const takePhoto = async () => {
  const result = await launchCamera({
    mediaType: "photo",
    includeBase64: false,
  });
  if (result.didCancel || !result.assets) return;
  setPendingFiles((prev) => [
    ...prev,
    {
      uri: result.assets[0].uri,
      type: "image",
      name: result.assets[0].fileName || `photo-${Date.now()}.jpg`,
    },
  ]);
};
```

Rename `removeImage` to `removeFile`:
```js
const removeFile = (index) => {
  setPendingFiles((prev) => prev.filter((_, i) => i !== index));
};
```

- [ ] **Step 2: Update `runOcr` to read from `pendingFiles`**

Replace `images[i]` with `pendingFiles[i].uri` and `images.length` with `pendingFiles.length` in `runOcr`:

```js
const runOcr = async () => {
  setStep("ocr-processing");
  setProgress({ current: 0, total: pendingFiles.length });
  await RNFS.mkdir(bookDir);
  const newChapters = [];
  for (let i = 0; i < pendingFiles.length; i++) {
    try {
      const sandboxUri = await copyImageToSandbox(pendingFiles[i].uri, i, false);
      const recognition = await TextRecognition.recognize(
        sandboxUri,
        TextRecognitionScript.CHINESE
      );
      newChapters.push({
        id: `ch-${startIndex + i}`,
        title: `第 ${startIndex + i + 1} 章`,
        text: recognition.text || "",
        sourceImagePath: sandboxUri,
        audioPath: "",
        ocrFailed: !recognition.text,
      });
    } catch (e) {
      const sandboxUri = await copyImageToSandbox(pendingFiles[i].uri, i, false);
      newChapters.push({
        id: `ch-${startIndex + i}`,
        title: `第 ${startIndex + i + 1} 章`,
        text: "",
        sourceImagePath: sandboxUri,
        audioPath: "",
        ocrFailed: true,
      });
    }
    setProgress({ current: i + 1, total: pendingFiles.length });
  }
  setChapters(newChapters);
  setStep("edit-chapters");
};
```

- [ ] **Step 3: Update `runTts` references to `images`**

In `runTts`, replace the cover-copy block. Find:
```js
let coverPath = existingBook?.coverImage || "";
if (!isAppendMode) {
  try {
    if (images.length > 0) {
      await copyImageToSandbox(images[0], 0, true);
    }
  } catch {
    // Cover copy failure is non-fatal
  }
  const coverExt = (images[0]?.match(/\.(\w+)(\?|$)/)?.[1]) || "jpg";
  coverPath = `file://${bookDir}/cover.${coverExt}`;
}
```

Replace with:
```js
let coverPath = existingBook?.coverImage || "";
if (!isAppendMode) {
  const firstImage = pendingFiles.find((f) => f.type === "image");
  try {
    if (firstImage) {
      await copyImageToSandbox(firstImage.uri, 0, true);
    }
  } catch {
    // Cover copy failure is non-fatal
  }
  const coverExt = (firstImage?.uri.match(/\.(\w+)(\?|$)/)?.[1]) || "jpg";
  coverPath = `file://${bookDir}/cover.${coverExt}`;
}
```

- [ ] **Step 4: Update select-images display and footer**

In the `select-images` step render, update the thumbnail map and remove handler. Find:
```jsx
{images.length > 0 && (
  <ScrollView horizontal style={styles.thumbRow}>
    {images.map((uri, i) => (
      <View key={i} style={styles.thumbWrap}>
        <Image source={{ uri }} style={styles.thumb} />
        <TouchableOpacity
          onPress={() => removeImage(i)}
          style={styles.thumbRemove}
        >
          <Text style={styles.thumbRemoveText}>×</Text>
        </TouchableOpacity>
      </View>
    ))}
  </ScrollView>
)}
<Text style={styles.hint}>已选择 {images.length} 张图片</Text>
```

Replace with:
```jsx
{pendingFiles.length > 0 && (
  <ScrollView horizontal style={styles.thumbRow}>
    {pendingFiles.map((file, i) => (
      <View key={i} style={styles.thumbWrap}>
        {file.type === "image" ? (
          <Image source={{ uri: file.uri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbIcon}>{file.type === "text" ? "📄" : "🎵"}</Text>
            <Text style={styles.thumbName} numberOfLines={1}>{file.name}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={() => removeFile(i)}
          style={styles.thumbRemove}
        >
          <Text style={styles.thumbRemoveText}>×</Text>
        </TouchableOpacity>
      </View>
    ))}
  </ScrollView>
)}
<Text style={styles.hint}>已选择 {pendingFiles.length} 个文件</Text>
```

Footer button - find `disabled={images.length === 0}` and the style array `images.length === 0 && styles.primaryBtnDisabled`, replace `images.length` with `pendingFiles.length`:
```jsx
<TouchableOpacity
  onPress={runOcr}
  disabled={pendingFiles.length === 0}
  style={[styles.primaryBtn, pendingFiles.length === 0 && styles.primaryBtnDisabled]}
>
  <Text style={styles.primaryBtnText}>开始识别</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Add placeholder styles**

Add to the `styles` StyleSheet:
```js
thumbPlaceholder: {
  backgroundColor: "#333",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 4,
},
thumbIcon: {
  fontSize: 20,
},
thumbName: {
  color: COLORS.secondaryText,
  fontSize: 9,
  marginTop: 2,
},
```

- [ ] **Step 6: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 7: Manual simulator check**

Reload app. Go to 小说 tab -> import. Verify:
- 「从相册选择」multi-select still works, thumbnails show, × remove works
- 「拍照」still works
- 「开始识别」still triggers OCR on selected images
- Hint shows "已选择 N 个文件"

- [ ] **Step 8: Commit**

```bash
git add src/screens/OcrImportScreen.js
git commit -m "Refactor images state to typed pendingFiles for folder import prep"
```

---

### Task 2: Add folder picker, file scanning, and book title default

**Files:**
- Modify: `src/screens/OcrImportScreen.js`

**Interfaces:**
- Produces: `pickFolder()` async function. `categorizeFile(name) -> "image"|"text"|"audio"|null`. `naturalCompare(a, b) -> number`. `folderName` state. `folderName` is consumed by Task 4's name-book step.

- [ ] **Step 1: Add DocumentPicker import**

At the top of `src/screens/OcrImportScreen.js`, after the `react-native-image-picker` import, add:
```js
import DocumentPicker from "react-native-document-picker";
```

- [ ] **Step 2: Add helper functions before the component**

After `const OCR_DIR = ...` (line 20), add:
```js
function categorizeFile(name) {
  const ext = name.match(/\.(\w+)$/)?.[1].toLowerCase();
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  if (ext === "txt") return "text";
  if (["m4a", "mp3"].includes(ext)) return "audio";
  return null;
}

function naturalCompare(a, b) {
  const ax = [], bx = [];
  a.name.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || Infinity, $2 || ""]); });
  b.name.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || Infinity, $2 || ""]); });
  while (ax.length && bx.length) {
    const an = ax.shift(), bn = bx.shift();
    const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
    if (nn) return nn;
  }
  return ax.length - bx.length;
}
```

- [ ] **Step 3: Add `folderName` state and `pickFolder` function**

Add state next to other `useState` calls:
```js
const [folderName, setFolderName] = useState("");
```

Add `pickFolder` after `takePhoto`:
```js
const pickFolder = async () => {
  try {
    const res = await DocumentPicker.pickDirectory();
    const items = await RNFS.readDir(res.uri);
    const files = items
      .filter((it) => !it.isDirectory())
      .map((it) => ({ uri: it.uri, name: it.name, type: categorizeFile(it.name) }))
      .filter((f) => f.type !== null);
    if (files.length === 0) {
      Alert.alert("该目录没有可导入的文件");
      return;
    }
    files.sort(naturalCompare);
    setPendingFiles(files);
    setFolderName(res.name || res.uri.split("/").pop() || "");
  } catch (e) {
    if (DocumentPicker.isCancel(e)) return;
    Alert.alert("读取目录失败", e.message || "");
  }
};
```

- [ ] **Step 4: Add third button to select-images step**

In the `select-images` step, after the existing `btnRow` View (containing 从相册选择 and 拍照), add a full-width folder button. Find:
```jsx
<View style={styles.btnRow}>
  <TouchableOpacity onPress={pickFromLibrary} style={styles.outlineBtn}>
    <Text style={styles.outlineBtnText}>从相册选择</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={takePhoto} style={styles.outlineBtn}>
    <Text style={styles.outlineBtnText}>拍照</Text>
  </TouchableOpacity>
</View>
```

After this View, add:
```jsx
<TouchableOpacity onPress={pickFolder} style={[styles.outlineBtn, styles.fullWidthBtn]}>
  <Text style={styles.outlineBtnText}>从文件夹导入</Text>
</TouchableOpacity>
```

Add style to StyleSheet:
```js
fullWidthBtn: {
  marginTop: 12,
  flex: 0,
},
```

(`flex: 0` overrides `outlineBtn`'s `flex: 1` so the button gets natural height in the column layout - same pattern as the primaryBtn fix.)

- [ ] **Step 5: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 6: Manual simulator check**

Reload app. Go to import. Verify:
- 「从文件夹导入」button appears below the other two, full width
- Tapping it opens the system folder picker
- Selecting a folder with mixed files shows them in the thumbnail row: images as thumbnails, text as 📄 card, audio as 🎵 card
- Files are sorted naturally (chapter2.jpg before chapter10.jpg)
- Empty folder or folder with no supported files shows "该目录没有可导入的文件"
- Cancel folder picker does nothing

- [ ] **Step 7: Commit**

```bash
git add src/screens/OcrImportScreen.js
git commit -m "Add folder picker entry and file scanning with natural sort"
```

---

### Task 3: Implement `runImport` for mixed file types with error handling

**Files:**
- Modify: `src/screens/OcrImportScreen.js`

**Interfaces:**
- Produces: `runImport()` async function (replaces `runOcr`). Chapter objects now may have non-empty `audioPath` for audio-imported chapters. Consumes `pendingFiles` from Task 1, `folderName` from Task 2.

- [ ] **Step 1: Replace `runOcr` with `runImport`**

Delete the existing `runOcr` function and replace with:
```js
const runImport = async () => {
  setStep("ocr-processing");
  setProgress({ current: 0, total: pendingFiles.length });
  await RNFS.mkdir(bookDir);
  const newChapters = [];
  for (let i = 0; i < pendingFiles.length; i++) {
    const file = pendingFiles[i];
    const id = `ch-${startIndex + i}`;
    const title = `第 ${startIndex + i + 1} 章`;
    try {
      if (file.type === "image") {
        let sandboxUri = "";
        try {
          sandboxUri = await copyImageToSandbox(file.uri, i, false);
        } catch {
          // copy failed, sandboxUri stays empty
        }
        let text = "";
        if (sandboxUri) {
          try {
            const recognition = await TextRecognition.recognize(
              sandboxUri,
              TextRecognitionScript.CHINESE
            );
            text = recognition.text || "";
          } catch {
            // OCR failed, text stays empty
          }
        }
        newChapters.push({
          id, title, text,
          sourceImagePath: sandboxUri,
          audioPath: "",
          ocrFailed: !text,
        });
      } else if (file.type === "text") {
        let text = "";
        try {
          text = await RNFS.readFile(file.uri, "utf8");
        } catch {
          // read failed, text stays empty
        }
        newChapters.push({
          id, title, text,
          sourceImagePath: "",
          audioPath: "",
          ocrFailed: !text,
        });
      } else if (file.type === "audio") {
        try {
          const dest = `${bookDir}/${file.name}`;
          await RNFS.copyFile(file.uri, dest);
          newChapters.push({
            id, title,
            text: "",
            sourceImagePath: "",
            audioPath: `file://${dest}`,
            ocrFailed: false,
          });
        } catch (e) {
          Alert.alert(`${file.name} 导入失败，已跳过`);
        }
      }
    } catch (e) {
      // Safety net - shouldn't reach here, but don't crash the batch
    }
    setProgress({ current: i + 1, total: pendingFiles.length });
  }
  setChapters(newChapters);
  setStep("edit-chapters");
};
```

- [ ] **Step 2: Update footer button to call `runImport`**

In the `select-images` footer button, change `onPress={runOcr}` to `onPress={runImport}`:
```jsx
<TouchableOpacity
  onPress={runImport}
  disabled={pendingFiles.length === 0}
  style={[styles.primaryBtn, pendingFiles.length === 0 && styles.primaryBtnDisabled]}
>
  <Text style={styles.primaryBtnText}>开始识别</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Update processing progress text**

In the `ocr-processing` step render, change the progress text. Find:
```jsx
<Text style={styles.progressText}>
  识别中 {progress.current}/{progress.total}...
</Text>
```

Replace with:
```jsx
<Text style={styles.progressText}>
  导入中 {progress.current}/{progress.total}...
</Text>
```

- [ ] **Step 4: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 5: Manual simulator check**

Reload app. Prepare test folders on device/simulator with:
- A folder of 2-3 text files (.txt) with Chinese content
- A folder with 1 image + 1 text file
- A folder with 1 audio file (.m4a or .mp3)

Verify:
- Text-only folder: import shows "导入中 1/2..." progress, chapters appear in edit list with text content
- Image + text folder: image chapter shows OCR text, text chapter shows file content
- Audio folder: audio chapter appears in edit list (preview shows filename - implemented in Task 4, for now shows empty text)
- Audio copy failure (e.g. permissions issue): shows "{filename} 导入失败，已跳过" alert, other files continue
- All chapters fail: shows "没有可用的章节" at TTS step (existing behavior)

- [ ] **Step 6: Commit**

```bash
git add src/screens/OcrImportScreen.js
git commit -m "Implement runImport for mixed image/text/audio files"
```

---

### Task 4: Audio chapter display, TTS skip, and book title from folder

**Files:**
- Modify: `src/screens/OcrImportScreen.js`

**Interfaces:**
- Modifies: `edit-chapters` step render to show audio chapter filenames. `runTts` to skip chapters with non-empty `audioPath`. `name-book` step to pre-fill `bookTitle` from `folderName`.

- [ ] **Step 1: Update edit-chapters display for audio chapters**

In the `edit-chapters` step, find the chapter row render:
```jsx
{chapters.map((ch, i) => (
  <View key={ch.id} style={styles.chapterRow}>
    <TouchableOpacity
      style={styles.chapterInfo}
      onPress={() => setEditingIndex(i)}
    >
      <Text style={styles.chapterTitle}>{ch.title}</Text>
      <Text style={styles.chapterPreview} numberOfLines={1}>
        {ch.text || "（识别为空，点击编辑）"}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => deleteChapter(i)}
      style={styles.chapterDeleteBtn}
    >
      <Text style={styles.chapterDeleteText}>删除</Text>
    </TouchableOpacity>
  </View>
))}
```

Replace with:
```jsx
{chapters.map((ch, i) => {
  const audioName = ch.audioPath ? ch.audioPath.split("/").pop() : "";
  const isAudio = !!ch.audioPath;
  return (
    <View key={ch.id} style={styles.chapterRow}>
      <TouchableOpacity
        style={styles.chapterInfo}
        onPress={() => !isAudio && setEditingIndex(i)}
        disabled={isAudio}
      >
        <Text style={styles.chapterTitle}>{ch.title}</Text>
        <Text style={styles.chapterPreview} numberOfLines={1}>
          {isAudio
            ? `🎵 ${audioName}`
            : ch.text || "（识别为空，点击编辑）"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => deleteChapter(i)}
        style={styles.chapterDeleteBtn}
      >
        <Text style={styles.chapterDeleteText}>删除</Text>
      </TouchableOpacity>
    </View>
  );
})}
```

- [ ] **Step 2: Skip TTS for chapters with existing audioPath**

In `runTts`, find the loop body start:
```js
for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  if (!ch.text.trim()) {
    setProgress({ current: i + 1, total: chapters.length });
    continue;
  }
  const audioPath = `file://${bookDir}/${ch.id}.m4a`;
```

Replace with:
```js
for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  if (ch.audioPath) {
    // Already has audio (imported), skip TTS
    completedChapters.push(ch);
    setProgress({ current: i + 1, total: chapters.length });
    continue;
  }
  if (!ch.text.trim()) {
    setProgress({ current: i + 1, total: chapters.length });
    continue;
  }
  const audioPath = `file://${bookDir}/${ch.id}.m4a`;
```

- [ ] **Step 3: Pre-fill book title from folder name**

The `bookTitle` state initializer (`existingBook?.title || ""`) stays as-is - `folderName` is empty at mount time, so it can't contribute to the initial value. Instead, set `bookTitle` when a folder is picked.

In `pickFolder` (added in Task 2), find:
```js
setPendingFiles(files);
setFolderName(res.name || res.uri.split("/").pop() || "");
```

Add after these two lines:
```js
if (!isAppendMode && !bookTitle) {
  setBookTitle(res.name || res.uri.split("/").pop() || "");
}
```

This only pre-fills when `bookTitle` is currently empty and not in append mode - doesn't override existing-book titles or user edits made before picking a folder.

- [ ] **Step 4: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 5: Manual simulator check**

Reload app. Verify:
- Import a folder with an audio file: edit-chapters list shows "🎵 {filename}" for the audio chapter, tapping it does nothing (no editor opens), delete button works
- Import a folder with mixed image + audio: image chapters are tappable (open editor), audio chapter is not
- At name-book step: book title is pre-filled with the folder name (if not in append mode)
- Append mode: book title stays as existing book's title, folder name doesn't override
- TTS step: audio chapters are skipped instantly (progress jumps), image/text chapters get TTS as normal
- Final book plays: audio chapters play their imported file, image/text chapters play TTS-generated file

- [ ] **Step 6: Commit**

```bash
git add src/screens/OcrImportScreen.js
git commit -m "Handle audio chapters in edit/TTS, pre-fill book title from folder"
```

---

## Verification Summary

After all 4 tasks:

1. Run Metro bundle: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
2. Manual simulator test matrix:
   - [ ] 纯图片目录导入（等价于现有流程，从文件夹批量选图）
   - [ ] 纯文本目录导入（每章一个 .txt，TTS 合成）
   - [ ] 纯音频目录导入（.m4a/.mp3 直接作为章节，跳过 TTS）
   - [ ] 混合目录导入（图片走 OCR、文本走 TTS、音频直接用）
   - [ ] 空目录 / 无支持文件目录 → Alert 提示
   - [ ] 文件名自然排序（chapter2 在 chapter10 前）
   - [ ] append 模式追加混合章节（长按小说 → 添加章节 → 选文件夹）
   - [ ] 音频章节编辑列表显示文件名、不可点击、可删除
   - [ ] 书名默认填文件夹名（新建模式）
   - [ ] 音频拷贝失败 → Alert 提示跳过，其余继续
