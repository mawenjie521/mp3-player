# 空小说目录创建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持在小说 tab 创建「空小说目录」（只有书名，无章节），后续通过长按追加章节，实现「建书」与「导入章节」解耦。

**Architecture:** 给 book 对象新增显式 `bookDir` 字段（解决空书无 cover/chapter 时 `getBookDir` 无法推导文件夹的问题）。新增 `expandEmptyBooks` 把 0 章书展开为占位 track，混入小说 tab 列表（不可播放，长按可加章节/删除）。新建 `CreateEmptyBookModal` 组件承接入录入书名。首次追加章节时若批次含图片则自动补封面。

**Tech Stack:** React Native, react-native-fs (RNFS), AsyncStorage, react-native-track-player。

## Global Constraints

- 无自动化测试套件（项目惯例）。每个任务的自动验证门是 **Metro bundle 构建**：`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`。不要跑 `npm test`（会因「No tests found」退出 1，属预期）。
- 手动验证由用户在 iOS 模拟器进行，每个任务给出验证清单。
- 现有 OCR 小说不迁移、不改数据；新增字段 `bookDir` 对旧书可选（`getBookDir` 缺失时走原逻辑）。
- bookId 仍是 `ocr-${Date.now()}`。
- 路径以 `file://` 协议存储，`resolvePath` 按 `/Documents/` 标记重新锚定以跨重装。
- 代码风格跟随现有文件（无分号、双引号、ES2020+ 语法）。

---

## File Structure

| 文件 | 职责 | 本次改动 |
|------|------|----------|
| `src/data/ocrNovels.js` | OCR 小说的持久化与展开 | 新增 `sanitizeTitle`/`computeBookDir` 导出；`getBookDir` 加 `bookDir` 分支；新增 `expandEmptyBooks`；`appendOCRChapters` 加第三参数 `coverImage` |
| `src/screens/OcrImportScreen.js` | 文件导入/追加屏幕 | 从 `ocrNovels.js` 导入 `computeBookDir`；追加模式补封面拷贝；`onAppendComplete` payload 改为 `{ chapters, coverImage }` |
| `src/components/BookCover.js` | 封面组件（有图显示图，无图显示首字占位） | 新文件 |
| `src/components/TrackList.js` | track 列表 | 用 `BookCover` 替代裸 `Image`，支持空 artwork 占位 |
| `src/components/CreateEmptyBookModal.js` | 创建空小说的 modal（书名输入） | 新文件 |
| `src/screens/NovelsScreen.js` | 小说 tab | `onStartImport` prop 改为 `onAdd`；`handleSelect` 守卫 `isEmptyBook` |
| `src/screens/MineScreen.js` | 我的 tab | 用 `BookCover`；书行 `onLongPress` 菜单；新 `onAddChapters` prop |
| `App.js` | 顶层状态与接线 | `onAdd` Alert；`showCreateEmptyBook` state；`onCreateEmptyBook`；`novelsTracks` 含 `expandEmptyBooks`；给 MineScreen 传 `onAddChapters`；`onAppendComplete` 解构 `{ chapters, coverImage }` |

---

### Task 1: 提取 `computeBookDir`/`sanitizeTitle` 到 ocrNovels.js + `getBookDir` 加 `bookDir` 分支

**Files:**
- Modify: `src/data/ocrNovels.js`
- Modify: `src/screens/OcrImportScreen.js:19,44-69`

**Interfaces:**
- Produces: `ocrNovels.js` 导出 `sanitizeTitle(title)` 和 `computeBookDir(title, bookId)`（async）；`getBookDir(book)` 新增 `book.bookDir` 优先分支。
- Consumes: `OcrImportScreen.js` 改为从 `ocrNovels.js` 导入 `computeBookDir`（删除本地定义）。

- [ ] **Step 1: 在 `ocrNovels.js` 新增 `sanitizeTitle` 和 `computeBookDir`，并更新 `getBookDir`**

在 `src/data/ocrNovels.js` 的 `getBookDir` 函数**之前**插入 `sanitizeTitle` 和 `computeBookDir`（从 OcrImportScreen.js 原样搬来），并把 `getBookDir` 的第一行改为检查 `book.bookDir`。

修改后的 `ocrNovels.js` 顶部到 `getBookDir` 结束应为：

```js
import RNFS from "react-native-fs";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:ocr-novels";
const OCR_DIR = `${RNFS.DocumentDirectoryPath}/ocr-novels`;

// Stored paths may be absolute with an old Application UUID from a previous
// install. Extract the relative part after /Documents/ and re-anchor to the
// current Documents directory so paths survive app reinstalls.
function resolvePath(storedPath) {
  if (!storedPath) return storedPath;
  const marker = "/Documents/";
  const idx = storedPath.indexOf(marker);
  if (idx < 0) return storedPath;
  const relative = storedPath.substring(idx + marker.length);
  return `file://${RNFS.DocumentDirectoryPath}/${relative}`;
}

function resolvePathNoProtocol(storedPath) {
  return resolvePath(storedPath).replace("file://", "");
}

export function sanitizeTitle(title) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[/:\x00\n\t]/g, "_");
  return cleaned.length > 80 ? cleaned.substring(0, 80) : cleaned;
}

export async function computeBookDir(title, bookId) {
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

// Derive the book's storage folder. Prefer an explicitly stored `bookDir`
// (empty books have no cover/chapter to derive from). Then fall back to
// coverImage, then first chapter audio, then bookId.
export function getBookDir(book) {
  if (book.bookDir) return resolvePathNoProtocol(book.bookDir);
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

- [ ] **Step 2: 从 `OcrImportScreen.js` 删除本地 `sanitizeTitle` 和 `computeBookDir`，改为从 `ocrNovels.js` 导入**

在 `src/screens/OcrImportScreen.js`：

把第 19 行：
```js
import { getBookDir } from "../data/ocrNovels";
```
改为：
```js
import { getBookDir, computeBookDir } from "../data/ocrNovels";
```

删除第 44-69 行（`sanitizeTitle` 函数 + `computeBookDir` 函数）。这两段是：
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

`OcrImportScreen.js` 中 `computeBookDir` 的调用点（`runTts` 内 `finalDir = await computeBookDir(bookTitle, tempBookId)`）不变，函数现在从 `ocrNovels.js` 导入。

- [ ] **Step 3: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功，无 "Cannot find module" 或重复声明错误。

- [ ] **Step 4: Commit**

```bash
git add src/data/ocrNovels.js src/screens/OcrImportScreen.js
git commit -m "Extract computeBookDir/sanitizeTitle to ocrNovels.js; getBookDir checks bookDir field"
```

---

### Task 2: 新增 `expandEmptyBooks` + `appendOCRChapters` 加 `coverImage` 参数

**Files:**
- Modify: `src/data/ocrNovels.js`

**Interfaces:**
- Produces: `expandEmptyBooks(books)` 返回 0 章 OCR 书的占位 track 数组；`appendOCRChapters(bookId, newChapters, coverImage)` 第三参数可选，非空且书无封面时设置 `coverImage`。

- [ ] **Step 1: 在 `ocrNovels.js` 新增 `expandEmptyBooks` 函数**

在 `expandOCRChapters` 函数**之后**插入：

```js
export function expandEmptyBooks(books) {
  return books
    .filter((b) => b.isOCR && b.chapters.length === 0)
    .map((b) => ({
      id: `${b.id}__empty`,
      title: b.title,
      artist: "暂无章节，长按添加",
      artwork: "",
      isNovel: true,
      isOCR: true,
      isEmptyBook: true,
      bookId: b.id,
      url: "",
    }));
}
```

- [ ] **Step 2: 扩展 `appendOCRChapters` 加第三参数 `coverImage`**

把 `ocrNovels.js` 中现有的 `appendOCRChapters`：
```js
export async function appendOCRChapters(bookId, newChapters) {
  const existing = await loadOCRNovels();
  const next = existing.map((b) =>
    b.id === bookId
      ? { ...b, chapters: [...b.chapters, ...newChapters] }
      : b
  );
  await saveJSON(STORAGE_KEY, next);
  return next;
}
```
改为：
```js
export async function appendOCRChapters(bookId, newChapters, coverImage) {
  const existing = await loadOCRNovels();
  const next = existing.map((b) => {
    if (b.id !== bookId) return b;
    const updated = { ...b, chapters: [...b.chapters, ...newChapters] };
    if (coverImage && !b.coverImage) {
      updated.coverImage = coverImage;
    }
    return updated;
  });
  await saveJSON(STORAGE_KEY, next);
  return next;
}
```

- [ ] **Step 3: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 4: Commit**

```bash
git add src/data/ocrNovels.js
git commit -m "Add expandEmptyBooks helper; appendOCRChapters accepts optional coverImage"
```

---

### Task 3: 新建 `BookCover` 组件 + `TrackList` 使用它

**Files:**
- Create: `src/components/BookCover.js`
- Modify: `src/components/TrackList.js`

**Interfaces:**
- Produces: `BookCover` 组件，props `{ uri, title, style }`。`uri` 非空时渲染 `Image`；为空时渲染占位 `View`（caller 的 `style` 提供尺寸/圆角，叠加居中首字 + accent 背景）。

- [ ] **Step 1: 创建 `src/components/BookCover.js`**

```jsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function BookCover({ uri, title, style }) {
  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }
  const initial = (title || "?").trim().charAt(0) || "?";
  return (
    <View style={[style, styles.placeholder]}>
      <Text style={styles.placeholderText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
  },
  placeholderText: {
    color: COLORS.primaryText,
    fontSize: 20,
    fontWeight: "600",
  },
});

export default BookCover;
```

- [ ] **Step 2: `TrackList.js` 用 `BookCover` 替代裸 `Image`**

在 `src/components/TrackList.js` 顶部 import 区加一行（第 3 行之后）：
```js
import BookCover from "./BookCover";
```

把 `renderItem` 中的（约第 25 行）：
```jsx
        <Image source={{ uri: item.artwork }} style={styles.listThumb} />
```
改为：
```jsx
        <BookCover uri={item.artwork} title={item.title} style={styles.listThumb} />
```

`Image` 是否还被 `TrackList` 其他地方使用？检查后若 `nowPlayingCard` 仍用 `Image`（`currentTrack.artwork` 总有值），保留 `Image` import 不动。当前 `TrackList.js` 第 2 行 `import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList } from "react-native";` -- `Image` 仍被 `nowPlayingThumb` 用到，保持不动。

- [ ] **Step 3: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 4: 手动验证（用户在模拟器）**

1. 启动 app，进入「歌曲」「我的-收藏」等任意用 `TrackList` 的列表。
2. 确认有 artwork 的 track 封面正常显示（与改动前一致）。
3. （占位分支此时无数据触发，下一任务创建空书后再验证占位样式。）

- [ ] **Step 5: Commit**

```bash
git add src/components/BookCover.js src/components/TrackList.js
git commit -m "Add BookCover component with placeholder; TrackList uses it for artwork"
```

---

### Task 4: 新建 `CreateEmptyBookModal` 组件

**Files:**
- Create: `src/components/CreateEmptyBookModal.js`

**Interfaces:**
- Produces: `CreateEmptyBookModal` 组件，props `{ visible, onCreate, onCancel }`。`onCreate(title)` 在书名非空时触发；`onCancel()` 关闭。每次 `visible` 变 true 时重置输入。

- [ ] **Step 1: 创建 `src/components/CreateEmptyBookModal.js`**

```jsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { COLORS } from "../data/constants";

function CreateEmptyBookModal({ visible, onCreate, onCancel }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (visible) setTitle("");
  }, [visible]);

  const trimmed = title.trim();

  const handleCreate = () => {
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>创建空小说</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="输入书名"
            placeholderTextColor={COLORS.secondaryText}
            autoFocus
          />
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!trimmed}
              style={[styles.primaryBtn, !trimmed && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnText}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "80%",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    color: COLORS.primaryText,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    flex: 1,
    alignItems: "center",
  },
  outlineBtnText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CreateEmptyBookModal;
```

- [ ] **Step 2: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功（新文件可被导入，下一任务接线）。

- [ ] **Step 3: Commit**

```bash
git add src/components/CreateEmptyBookModal.js
git commit -m "Add CreateEmptyBookModal component"
```

---

### Task 5: App.js + NovelsScreen 接线：创建空小说全流程

**Files:**
- Modify: `App.js`
- Modify: `src/screens/NovelsScreen.js`

**Interfaces:**
- Consumes: Task 1 的 `computeBookDir`；Task 2 的 `expandEmptyBooks`；Task 3 的 `BookCover`（经 TrackList）；Task 4 的 `CreateEmptyBookModal`。
- Produces: App.js 新增 `onAdd`（Alert）、`onCreateEmptyBook(title)`、`showCreateEmptyBook` state；`novelsTracks` 含占位行；NovelsScreen prop `onStartImport` 改为 `onAdd`，`handleSelect` 守卫 `isEmptyBook`。

- [ ] **Step 1: `App.js` 顶部加 import**

在 `src/App.js` 第 27 行（`import { loadOCRNovels, saveOCRNovel, ...`）改为：
```js
import { loadOCRNovels, saveOCRNovel, deleteOCRNovel, appendOCRChapters, expandOCRChapters, expandEmptyBooks, checkOCRFileExistence, computeBookDir } from "./src/data/ocrNovels";
```

在第 35 行（`import ErrorBoundary from "./src/error/ErrorBoundary";` 之后）加：
```js
import RNFS from "react-native-fs";
import CreateEmptyBookModal from "./src/components/CreateEmptyBookModal";
```

- [ ] **Step 2: `App.js` 加 `showCreateEmptyBook` state**

在第 52 行（`const [appendTargetBook, setAppendTargetBook] = useState(null);`）之后加：
```js
  const [showCreateEmptyBook, setShowCreateEmptyBook] = useState(false);
```

- [ ] **Step 3: `App.js` 的 `novelsTracks` 含占位行**

把第 54 行：
```js
  const novelsTracks = useMemo(() => [...novels, ...ocrNovelChapters], [ocrNovelChapters]);
```
改为：
```js
  const ocrEmptyBooks = useMemo(() => expandEmptyBooks(ocrNovels), [ocrNovels]);
  const novelsTracks = useMemo(
    () => [...novels, ...ocrEmptyBooks, ...ocrNovelChapters],
    [novels, ocrEmptyBooks, ocrNovelChapters]
  );
```

- [ ] **Step 4: `App.js` 加 `onAdd` 和 `onCreateEmptyBook` 处理器**

在 `onStartImport`（第 362-365 行）之后插入 `onAdd` 和 `onCreateEmptyBook`：

```js
  const onAdd = () => {
    Alert.alert("添加小说", null, [
      { text: "导入文件创建", onPress: onStartImport },
      { text: "创建空小说", onPress: () => setShowCreateEmptyBook(true) },
      { text: "取消", style: "cancel" },
    ]);
  };

  const onCreateEmptyBook = async (title) => {
    const bookId = `ocr-${Date.now()}`;
    const bookDir = await computeBookDir(title, bookId);
    try {
      await RNFS.mkdir(bookDir);
    } catch {
      // dir may already exist; ignore
    }
    const book = {
      id: bookId,
      title,
      coverImage: "",
      chapters: [],
      createdAt: Date.now(),
      isOCR: true,
      bookDir: `file://${bookDir}`,
    };
    const next = await saveOCRNovel(book);
    setOcrNovels(next);
    setShowCreateEmptyBook(false);
    setTab("novels");
  };
```

`Alert` 已在第 10 行从 react-native 导入，无需新增。

- [ ] **Step 5: `App.js` 给 NovelsScreen 传 `onAdd` 替代 `onStartImport`**

把第 476 行：
```jsx
              onStartImport={onStartImport}
```
改为：
```jsx
              onAdd={onAdd}
```

- [ ] **Step 6: `App.js` 在 tabs 视图渲染 modal**

在 `SafeAreaView` 内、`BottomNav` 之前（约第 497 行 `</View>` 之前）加：
```jsx
          <CreateEmptyBookModal
            visible={showCreateEmptyBook}
            onCreate={onCreateEmptyBook}
            onCancel={() => setShowCreateEmptyBook(false)}
          />
```

- [ ] **Step 7: `NovelsScreen.js` prop 改名 + `handleSelect` 守卫**

在 `src/screens/NovelsScreen.js`：

把第 6 行函数签名里的 `onStartImport` 改为 `onAdd`：
```js
function NovelsScreen({ tracks, currentTrack, onSelect, onShowPlayer, onAdd, onDeleteOCRNovel, onAddChapters }) {
```

把第 38 行：
```jsx
        <TouchableOpacity onPress={onStartImport} style={styles.addBtn}>
```
改为：
```jsx
        <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
```

把 `handleSelect`（第 7-12 行）改为：
```js
  const handleSelect = (item) => {
    if (item.isEmptyBook) return;
    const playable = tracks.filter((t) => !t.isEmptyBook);
    const queue = item.bookId ? playable.filter((t) => t.bookId === item.bookId) : playable;
    onSelect(item, queue, "novels");
  };
```

`handleLongPress`（第 14-29 行）不变--占位行有 `isOCR && bookId`，现有菜单自动生效。

- [ ] **Step 8: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 9: 手动验证（用户在模拟器）**

1. 启动 app，进入「小说」tab。
2. 点右上角 "+" -> 弹出 Alert「添加小说」，含三个按钮：导入文件创建 / 创建空小说 / 取消。
3. 点「创建空小说」-> 弹出 modal，输入「测试书」，点「创建」。
4. modal 关闭，留在小说 tab，列表出现一行占位：accent 色方块 + 「测」字 + 标题「测试书」+ 副标题「暂无章节，长按添加」。
5. 点该行 -> 无反应（不可播放）。
6. 长按该行 -> 弹出菜单「添加章节」/「删除」/「取消」。
7. 点「删除」-> 行消失。
8. 再创建一本「测试书」，再创建一本同名「测试书」-> 两本都存在（第二本文件夹应为 `测试书 (2)`，可通过文件系统或删除后重建验证）。
9. 创建一本后杀进程重开 -> 书仍在。

- [ ] **Step 10: Commit**

```bash
git add App.js src/screens/NovelsScreen.js
git commit -m "Wire empty book creation: onAdd Alert, CreateEmptyBookModal, novelsTracks with placeholders"
```

---

### Task 6: MineScreen 占位封面 + 长按菜单 + `onAddChapters` prop

**Files:**
- Modify: `src/screens/MineScreen.js`
- Modify: `App.js`

**Interfaces:**
- Consumes: Task 3 的 `BookCover`；App.js 的 `onAddChapters`（已存在）。
- Produces: MineScreen 接受 `onAddChapters` prop；书行 `onLongPress` 弹「添加章节」/「删除」/「取消」；`coverImage` 为空时用 `BookCover` 占位。

- [ ] **Step 1: `MineScreen.js` 加 import 和 `onAddChapters` prop**

在 `src/screens/MineScreen.js` 第 5 行（`import TrackList from "../components/TrackList";`）之后加：
```js
import BookCover from "../components/BookCover";
```

把第 14-26 行函数签名里的 props 列表，在 `onDeleteOCRNovel,` 之后加 `onAddChapters`：
```js
function MineScreen({
  allTracks,
  currentTrack,
  onSelect,
  onShowPlayer,
  favorites,
  recent,
  onImport,
  mineSubTab,
  onSubTabChange,
  ocrNovels,
  onDeleteOCRNovel,
  onAddChapters,
}) {
```

- [ ] **Step 2: `MineScreen.js` 加 `handleBookLongPress`**

在 `confirmDelete`（第 39-44 行）之后加：
```js
  const handleBookLongPress = (book) => {
    const actions = [];
    if (onAddChapters) {
      actions.push({ text: "添加章节", onPress: () => onAddChapters(book.id) });
    }
    actions.push({ text: "删除", style: "destructive", onPress: () => confirmDelete(book) });
    Alert.alert(book.title, null, [...actions, { text: "取消", style: "cancel" }]);
  };
```

`Alert` 已在第 2 行从 react-native 导入。

- [ ] **Step 3: `MineScreen.js` 改 `renderOcrBook` 用 `BookCover` + `onLongPress`**

把第 46-57 行的 `renderOcrBook`：
```jsx
  const renderOcrBook = ({ item }) => (
    <View style={styles.bookRow}>
      <Image source={{ uri: item.coverImage }} style={styles.bookCover} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookMeta}>{item.chapters.length} 章</Text>
      </View>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </View>
  );
```
改为：
```jsx
  const renderOcrBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookRow}
      onLongPress={() => handleBookLongPress(item)}
      activeOpacity={0.6}
    >
      <BookCover uri={item.coverImage} title={item.title} style={styles.bookCover} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookMeta}>{item.chapters.length} 章</Text>
      </View>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
```

`Image` 是否还被 MineScreen 其他地方使用？检查后若不再使用，从第 2 行 react-native import 中移除 `Image`。当前 MineScreen 只在 `renderOcrBook` 用 `Image`，改完后无其他引用，把第 2 行：
```js
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, Alert } from "react-native";
```
改为：
```js
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
```

- [ ] **Step 4: `App.js` 给 MineScreen 传 `onAddChapters`**

在 `src/App.js` 第 482-494 行的 `<MineScreen ... />`，在 `onDeleteOCRNovel={onDeleteOCRNovel}` 之后加一行：
```jsx
              onAddChapters={onAddChapters}
```

- [ ] **Step 5: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 6: 手动验证（用户在模拟器）**

1. 先按 Task 5 创建一本空小说「测试书」。
2. 进入「我的」->「OCR 小说」子 tab。
3. 看到「测试书」行：accent 色方块 + 「测」字 + 标题 + 「0 章」+ 右侧「删除」按钮。
4. 长按该行 -> 弹出菜单「添加章节」/「删除」/「取消」。
5. 点「添加章节」-> 进入 `OcrImportScreen` 追加模式（标题「添加章节」）。
6. 点右侧「删除」按钮 -> 弹确认 -> 确认 -> 行消失。
7. 已有非空 OCR 小说（有封面）的行封面仍正常显示。

- [ ] **Step 7: Commit**

```bash
git add src/screens/MineScreen.js App.js
git commit -m "MineScreen: BookCover placeholder, long-press menu with add-chapters, onAddChapters prop"
```

---

### Task 7: OcrImportScreen 追加模式补封面 + `onAppendComplete` payload 改对象

**Files:**
- Modify: `src/screens/OcrImportScreen.js`
- Modify: `App.js`

**Interfaces:**
- Consumes: Task 2 的 `appendOCRChapters(bookId, newChapters, coverImage)`。
- Produces: `OcrImportScreen` 追加模式下若书无封面且批次含图片，拷贝封面；`onAppendComplete` payload 改为 `{ chapters, coverImage }`；App.js `onAppendComplete` 解构该对象。

- [ ] **Step 1: `OcrImportScreen.js` 追加模式补封面拷贝**

在 `src/screens/OcrImportScreen.js` 的 `runTts`（约第 251-263 行），把：
```js
    let coverPath = existingBook?.coverImage || "";
    if (!isAppendMode) {
      const firstImage = pendingFiles.find((f) => f.type === "image");
      if (firstImage) {
        try {
          await copyImageToSandbox(firstImage.uri, 0, true);
        } catch {
          // Cover copy failure is non-fatal
        }
        const coverExt = firstImage.uri.match(/\.(\w+)(\?|$)/)?.[1] || "jpg";
        coverPath = `file://${bookDir}/cover.${coverExt}`;
      }
    }
```
改为：
```js
    let coverPath = existingBook?.coverImage || "";
    const needsCoverCopy = isAppendMode ? !existingBook?.coverImage : true;
    if (needsCoverCopy) {
      const firstImage = pendingFiles.find((f) => f.type === "image");
      if (firstImage) {
        try {
          await copyImageToSandbox(firstImage.uri, 0, true);
        } catch {
          // Cover copy failure is non-fatal
        }
        const coverExt = firstImage.uri.match(/\.(\w+)(\?|$)/)?.[1] || "jpg";
        coverPath = `file://${bookDir}/cover.${coverExt}`;
      }
    }
```

- [ ] **Step 2: `OcrImportScreen.js` 改 `onAppendComplete` payload 为对象**

在 `runTts` 末尾（约第 329-340 行），把：
```js
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
```
改为：
```js
    if (isAppendMode) {
      onAppendComplete({
        chapters: completedChapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          text: ch.text,
          audioPath: ch.audioPath,
          sourceImagePath: ch.sourceImagePath,
        })),
        coverImage: coverPath,
      });
      return;
    }
```

- [ ] **Step 3: `App.js` 的 `onAppendComplete` 解构对象 + 传 `coverImage`**

把 `src/App.js` 第 383-397 行的 `onAppendComplete`：
```js
  const onAppendComplete = async (newChapters) => {
    const bookId = appendTargetBook.id;
    const updatedBooks = await appendOCRChapters(bookId, newChapters);
    const updatedBook = updatedBooks.find((b) => b.id === bookId);
    setOcrNovels(updatedBooks);
    if (updatedBook) {
      const newTracks = expandOCRChapters([updatedBook]).filter((t) =>
        newChapters.some((ch) => t.id === `${bookId}/${ch.id}`)
      );
      if (newTracks.length > 0) await TrackPlayer.add(newTracks);
    }
    setAppendTargetBook(null);
    setView("tabs");
    setTab("novels");
  };
```
改为：
```js
  const onAppendComplete = async ({ chapters, coverImage }) => {
    const bookId = appendTargetBook.id;
    const updatedBooks = await appendOCRChapters(bookId, chapters, coverImage);
    const updatedBook = updatedBooks.find((b) => b.id === bookId);
    setOcrNovels(updatedBooks);
    if (updatedBook) {
      const newTracks = expandOCRChapters([updatedBook]).filter((t) =>
        chapters.some((ch) => t.id === `${bookId}/${ch.id}`)
      );
      if (newTracks.length > 0) await TrackPlayer.add(newTracks);
    }
    setAppendTargetBook(null);
    setView("tabs");
    setTab("novels");
  };
```

- [ ] **Step 4: 验证 Metro bundle 构建**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 5: 手动验证（用户在模拟器）**

1. 先按 Task 5 创建一本空小说「测试书」（无封面）。
2. 长按 -> 「添加章节」-> 进入追加模式。
3. 选一张图片（相册或拍照）-> 开始导入 -> 完成 OCR -> 编辑（可选）-> 完成并生成语音。
4. 回到小说 tab：占位行消失，出现可播放 track「测试书 - 第 1 章」。
5. 进入「我的 -> OCR 小说」：「测试书」行现在显示该图片作为封面（不再是首字占位），「1 章」。
6. 再长按 -> 「添加章节」-> 选一张**文本文件**（.txt，无图片）-> 完成 -> 章节追加成功，封面不变（仍是首次的图片）。
7. 验证非空书追加不被破坏：对一本已有封面的书追加章节，封面保持不变。

- [ ] **Step 6: Commit**

```bash
git add src/screens/OcrImportScreen.js App.js
git commit -m "OcrImportScreen append mode: copy cover for coverless books; onAppendComplete payload as {chapters, coverImage}"
```

---

## Self-Review Notes

- **Spec coverage**: 数据模型（Task 1-2）、创建流程（Task 4-5）、展示与交互（Task 3, 5-6）、封面补齐（Task 7）、边界情况（在各任务手动验证中覆盖）。
- **Task 间依赖**: Task 1 < Task 2 < Task 3 < Task 4 < Task 5 < Task 6 < Task 7。Task 5 依赖 1/2/3/4；Task 6 依赖 3；Task 7 依赖 2。严格按序执行。
- **向后兼容**: 现有 OCR 书无 `bookDir` 字段，`getBookDir` 走原分支；`appendOCRChapters` 第三参数可选，现有调用（如有）不传 `coverImage` 不影响。
- **payload 破坏性变更**: `onAppendComplete` 从数组改对象，Task 7 同时改 caller（OcrImportScreen）和 receiver（App.js），不留给中间状态。
