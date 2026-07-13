# 空小说目录创建 - 设计文档

## 背景

当前小说 tab 右上角 "+" 按钮直接进入 `OcrImportScreen` 新书导入流程，要求用户先选文件（图片/文本/音频），再 OCR、编辑、TTS，最终生成一本含至少一章的小说。长按某章 -> "添加章节" 也是同样的批量文件导入流程。

用户希望：先创建一个**空小说目录**（只有书名，无章节），后续再向该目录下添加章节。这样可以把「建书」和「导入章节」解耦。

## 目标

- "+" 按钮支持两种创建方式：原有「导入文件创建」（不变）和新的「创建空小说」（只输入书名）。
- 空小说在 **小说 tab** 和 **我的 -> OCR 小说** 两处都可见。
- 两处都能长按 -> "添加章节" / "删除"。
- 空小说加章节时复用现有 `OcrImportScreen` 追加流程。

## 非目标

- 不支持创建后改书名（涉及文件夹重命名，后续跟进）。
- 不支持独立选封面；封面仅在首次追加章节且批次含图片时自动设置。
- 不迁移或改动现有 OCR 小说数据。
- 不改 bookId 规则（仍是 `ocr-${Date.now()}`）。

## 数据模型

### 新增 `bookDir` 字段

空小说没有 `coverImage` 也没有章节音频，现有 `getBookDir` 无法推导文件夹（会回退到 `ocr-<timestamp>`，错误）。因此给 book 对象新增显式 `bookDir` 字段：

```
{
  id: `ocr-${Date.now()}`,
  title: "<trimmed user input>",
  coverImage: "",          // 空小说暂无封面
  chapters: [],
  createdAt: Date.now(),
  isOCR: true,
  bookDir: "file://<Documents>/ocr-novels/<sanitized-title>",
}
```

`bookDir` 以 `file://` 协议存储（与 `coverImage`/`audioPath` 一致），`resolvePath` 在加载时按 `/Documents/` 标记重新锚定到当前 Documents 目录，跨重装可用。

### `getBookDir` 更新（`ocrNovels.js`）

优先检查 `book.bookDir`：

```js
export function getBookDir(book) {
  if (book.bookDir) return resolvePathNoProtocol(book.bookDir);
  if (book.coverImage) { ... }          // 原逻辑
  const chWithAudio = ...               // 原逻辑
  return `${OCR_DIR}/${book.id}`;       // 原回退
}
```

现有书无 `bookDir` 字段，走原逻辑，向后兼容。

### `computeBookDir` / `sanitizeTitle` 提取

目前 `computeBookDir` 和 `sanitizeTitle` 定义在 `OcrImportScreen.js:44-69`。移到 `ocrNovels.js` 并导出，供空小说创建和原导入流程共用。`OcrImportScreen` 改为从 `ocrNovels.js` 导入。

### `expandEmptyBooks(books)` 新增

返回 0 章OCR 小说的占位 track，供小说 tab 展示：

```js
{
  id: `${book.id}__empty`,
  title: book.title,
  artist: "暂无章节，长按添加",
  artwork: "",
  isNovel: true,
  isOCR: true,
  isEmptyBook: true,
  bookId: book.id,
  url: "",
}
```

## 创建流程

### "+" 按钮（NovelsScreen）

当前 `onPress={onStartImport}` 直接进导入。改为 `onPress={onAdd}`，`onAdd` 由 App.js 提供，弹出 `Alert`：

- 标题："添加小说"
- 按钮："导入文件创建" / "创建空小说" / "取消"
- "导入文件创建" -> 原 `onStartImport`（`OcrImportScreen` 新书模式）
- "创建空小说" -> 打开 `CreateEmptyBookModal`

### `CreateEmptyBookModal` 组件（`src/components/CreateEmptyBookModal.js`）

- 居中 `Modal`，含 `TextInput`（书名）+ "创建" / "取消" 按钮
- "创建" 在书名 trim 后为空时禁用
- 创建 -> 调 `onCreate(title)`
- 取消 -> 关闭

### App.js 接线

- 新增 state：`showCreateEmptyBook`（boolean）
- `onCreateEmptyBook(title)`（async）：
  1. `const bookId = \`ocr-${Date.now()}\``（即 book 的 `id`）
  2. `bookDir = await computeBookDir(title, bookId)`（冲突检测同新书流程，`bookId` 仅作 sanitize 失败时的回退文件夹名）
  3. `await RNFS.mkdir(bookDir)`（立即创建文件夹，保证后续同名书得到 `<title> (2)`）
  4. 构造空 book 对象（`id: bookId`、`bookDir: \`file://${bookDir}\``、`coverImage: ""`、`chapters: []`、`isOCR: true`、`createdAt: Date.now()`）
  5. `saveOCRNovel(book)` -> 前插到存储
  6. `setOcrNovels(next)`、关闭 modal、`setTab("novels")`

## 展示与交互

### App.js track 组装

```js
const ocrNovelChapters = expandOCRChapters(ocrNovels);
const ocrEmptyBooks = expandEmptyBooks(ocrNovels);
const novelsTracks = [...novels, ...ocrEmptyBooks, ...ocrNovelChapters];
```

`allTracks`（播放队列）**不含**空小说占位行——不可播放。

### NovelsScreen

- `handleSelect`：若 `item.isEmptyBook` 直接 return（不可播放）。否则队列过滤掉 `isEmptyBook` 项：
  ```js
  const playable = tracks.filter(t => !t.isEmptyBook);
  const queue = item.bookId ? playable.filter(t => t.bookId === item.bookId) : playable;
  ```
- `handleLongPress`：空小说占位行有 `isOCR && bookId`，现有 "添加章节" / "删除" 菜单自动生效，无需改。
- `TrackList`：`artwork` 为空时渲染占位 `View`（48x48，书名首字居中），避免空 URI 警告。

### MineScreen（"OCR 小说" 子 tab）

- 空小说已在 `ocrNovels` 列表中，显示 "0 章"。
- `renderOcrBook`：`coverImage` 为空时渲染同款占位 `View`（书名首字）。
- 新增书行 `onLongPress` -> `Alert`："添加章节" / "删除" / "取消"（与 NovelsScreen 一致）。
- App.js 给 MineScreen 传 `onAddChapters` prop。
- 右侧 "删除" 按钮保留（快捷删除）。

## 封面补齐（首次追加时）

空小说首次加章节时，若批次含图片，自动设封面。改 `OcrImportScreen.runTts`（约 251 行）：

- 当前：`isAppendMode` 时 `coverPath = existingBook?.coverImage || ""`，不拷封面。
- 改为：`isAppendMode && !existingBook.coverImage` 且 `pendingFiles` 含图片时，拷贝第一张为 `cover.<ext>`，`coverPath = file://${bookDir}/cover.${ext}`。
- `onAppendComplete` 的 payload 从「章节数组」改为对象 `{ chapters, coverImage }`，其中 `coverImage` 为拷贝到的封面路径（无封面时为空串）。
- `appendOCRChapters(bookId, newChapters, coverImage)`：新增第三参数（可选）。若传入的 `coverImage` 非空且书的 `coverImage` 为空，则设置；否则不动。
- App.js `onAppendComplete({ chapters, coverImage })` 解构后调用 `appendOCRChapters(bookId, chapters, coverImage)`。

## 边界情况

- **同名空小说**：`computeBookDir` 冲突检测 + 创建时 `mkdir`，第二本得 `<title> (2)`。
- **书名 sanitize 后为空**：modal 禁用 "创建"，不可达。
- **删除空小说**：`deleteOCRNovel` -> `getBookDir` 返回 `book.bookDir` -> `RNFS.unlink`（文件夹已创建，存在），干净删除。
- **重装 / UUID 变化**：`bookDir` 以 `file://` + `/Documents/` 标记存储，`resolvePathNoProtocol` 重新锚定。首章追加时 `RNFS.mkdir` 幂等重建。
- **空小说进播放队列**：`allTracks` 不含占位行，不会进 TrackPlayer。
- **点占位行（非长按）**：`handleSelect` 早退，无操作。

## 验证

无自动化测试（项目惯例）。用 Metro bundle + iOS 模拟器手动验证：

1. 创建空小说 "测试书" —— 小说 tab 出现占位行（书名首字 + "暂无章节，长按添加"），我的 -> OCR 小说 显示 "0 章"。
2. 长按 -> "添加章节" -> 选一张图片 -> 完成 OCR + TTS —— 书变为 1 章，封面来自该图片，占位行变为可播放 track。
3. 长按 -> "删除" —— 书和文件夹移除。
4. 连续创建两本同名 "测试书" —— 第二本文件夹为 `测试书 (2)`。
5. 创建空小说，杀进程重开 —— 书仍在（持久化 + 路径重锚定）。
6. 我的 -> OCR 小说 长按书行 -> "添加章节" —— 进入追加流程。

## 涉及文件

- `src/data/ocrNovels.js` —— `getBookDir` 加 `bookDir` 分支；提取 `computeBookDir`/`sanitizeTitle` 并导出；新增 `expandEmptyBooks`；`appendOCRChapters` 加可选第三参数 `coverImage`。
- `src/screens/OcrImportScreen.js` —— 从 `ocrNovels.js` 导入 `computeBookDir`/`sanitizeTitle`；追加模式补封面拷贝；`onAppendComplete` payload 改为 `{ chapters, coverImage }`。
- `src/components/CreateEmptyBookModal.js` —— 新文件。
- `src/components/TrackList.js` —— `artwork` 为空时渲染占位。
- `src/screens/NovelsScreen.js` —— `onAdd` prop 替代直接 `onStartImport`；`handleSelect` 守卫 `isEmptyBook`。
- `src/screens/MineScreen.js` —— 占位封面；书行 `onLongPress` 菜单；新 `onAddChapters` prop。
- `App.js` —— `onAdd` Alert；`showCreateEmptyBook` state；`onCreateEmptyBook` 处理器；给 MineScreen 传 `onAddChapters`；`onAppendComplete` 解构 `{ chapters, coverImage }` 后调 `appendOCRChapters`。

## 后续跟进（不在本次范围）

- 创建后改书名（需移动文件夹）。
- 独立选/换封面。
- 文本批次追加无图片时封面仍为空（可后续加默认封面）。
