# TXT 整本小说导入 - 设计文档

> 为「小说」tab 增加 TXT 整本导入入口：用户选一个 `.txt` 文件，应用按章节标题正则自动分章，用户在编辑步调整标题/正文/合并/拆分后，逐章 TTS 合成 `.m4a`，作为一本 OCR 风格的书加入小说 tab。与现有 OCR / 文件夹 / 空小说三种导入并列，复用 TTSWriter、`ocrNovels.js` 存储、`expandOCRChapters` 展开逻辑。

## 目标

- 让用户能把一整本中文 TXT 小说转成有声书，按章分文件
- 自动识别章节边界，每章生成一个独立音频文件
- 自动识别书名（文件名优先），用户可改
- 复用现有 OCR 书的存储布局、播放队列、删除机制，不引入第二条数据链路

## 非目标

- GBK / GB2312 编码支持（仅 UTF-8，GBK 文件提示用户自行转换）
- append 模式（向已有书追加 TXT 章节，v1 不支持；长按「添加章节」仍走 `OcrImportScreen`）
- 章节顺序拖拽
- 批量编辑（多选删除/合并）
- 目录页智能识别（仅靠「空正文剔除」启发式）
- 正文分段优化
- 章节标题数字规范化（不把「一」转成「1」）
- 封面（TXT 导入无封面，沿用空占位）
- Android 支持（项目仅 iOS）
- ID3 元数据

## 架构总览

### 入口

`App.js` 现有 `onAdd` Alert（`App.js:481`）加第三个按钮：

```
添加小说
- 导入文件创建     (现有 onStartImport)
- 导入 TXT 整本    (新增 onStartTxtImport)
- 创建空小说       (现有 setShowCreateEmptyBook(true))
- 取消
```

`onStartTxtImport` 设 `view: "txt-import"`，App.js 渲染 `<TxtImportScreen>`。

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/screens/TxtImportScreen.js` | TXT 整本导入向导主控（选文件 -> 解析 -> 编辑列表 -> 命名 -> TTS -> 完成） |
| `src/data/txtChapterParser.js` | 纯函数模块：`detectChapters(text)` / `detectBookName(filename)` / `sanitizeChapterFilename(title, index)` / `looksLikeGbkDecodedAsUtf8(text)` |

### 复用现有模块

- `src/data/tts.js` 的 TTSWriter：TTS 合成（新增导出 `synthesizeToPath(text, audioPath)`，路径决定权交给调用方）
- `src/data/ocrNovels.js` 的 `saveOCRNovel` / `computeBookDir` / `sanitizeTitle` / `getBookDir` / `expandOCRChapters` / `deleteOCRNovel` / `checkOCRFileExistence`：存储与文件夹布局，**零改动**
- `src/screens/OcrChapterEditScreen.js`：章节正文编辑（新增可选 `onSplitHere` prop）
- `src/components/CreateEmptyBookModal.js` / `NovelsScreen` / `MineScreen`：**零改动**

### 数据流

```
[选 TXT (DocumentPicker.pick, type=plain-text)]
  -> [读文件 (RNFS.readFile utf8)]
  -> [GBK 启发式检查]
  -> [detectChapters(text) -> [{title, body}]]
  -> [章节列表编辑 (TxtImportScreen 内 step="edit-chapters")]
        - 内联改标题 / 删除行 / 点「编辑正文」进 OcrChapterEditScreen
        - 「合并下一章」/「在光标处拆分」
  -> [name-book: 默认 detectBookName(filename)，可改]
  -> [runTts: 逐章 synthesizeToPath -> .m4a]
  -> [最终化: computeBookDir + moveFile + saveOCRNovel]
  -> [回到小说 tab，新书带 OCR 徽章]
```

### 数据模型

复用 OCR 书元数据结构（`isOCR: true`、`bookId`、`chapters[]`、`bookDir`），不新增字段。每章：

```js
{
  id: `ch-${i}`,                       // i = 0..N-1
  title: "<识别或编辑后的标题>",         // 如 "第一章 风起云涌"
  text: "<章节正文>",
  sourceImagePath: "",                  // TXT 导入无图
  audioPath: "",                        // TTS 阶段填
  ocrFailed: false,
}
```

与现有 OCR 书完全同构，`expandOCRChapters` / `getBookDir` / `deleteOCRNovel` / `appendOCRChapters` / `checkOCRFileExistence` 全部复用，**零改动**。

### 文件系统布局

沿用 novel-folder-layout 的新布局：

```
Documents/ocr-novels/
  <sanitized-title>/                   # 由 computeBookDir 生成
    第一章 风起云涌.m4a                 # 章节标题 sanitize 后作为文件名
    第二章 山雨欲来.m4a
    ...
```

处理过程用临时文件夹 `${OCR_DIR}/${tempBookId}`，最终化时 `moveFile` 到 `${OCR_DIR}/${sanitized-title}`。与 OCR 流程完全一致。

### 与现有体系的融合

- **小说 tab**：新书通过 `expandOCRChapters` 展开成多章 track，带 OCR 徽章，按 `bookId` 限定队列
- **「我的」-> OCR 小说 子 tab**：新书按书折叠显示，可删除
- **长按 -> 「添加章节」**：仍走 `OcrImportScreen`（图片/文件夹流程），不走 TXT 整本
- **封面**：`coverImage: ""`，NovelsScreen/MineScreen 已有空封面占位逻辑（empty-novel-directory 已加）

## 章节自动识别算法

### `detectChapters(text)`

按行扫描，匹配章节标题正则。匹配到的行作为新章节的标题，匹配行之后到下一匹配行之前的所有文本作为该章节的正文。

### 章节标题正则

```
/^\s*第\s*([零一二三四五六七八九十百千0-9]+)\s*([章回节])\s*(.*)$/
```

匹配示例（行首行尾容忍空白）：

| 文本行 | 命中 | 标题 |
|--------|------|------|
| `第一章 风起云涌` | ✓ | `第一章 风起云涌` |
| `第 1 章` | ✓ | `第 1 章` |
| `第123回 山雨欲来` | ✓ | `第123回 山雨欲来` |
| `第十二节` | ✓ | `第十二节` |
| `第十二章　大风起兮` | ✓ | `第十二章　大风起兮`（全角空格） |
| `  第一章 风起云涌  ` | ✓ | `第一章 风起云涌`（trim） |
| `第三十一章 风起云涌（上）` | ✓ | `第三十一章 风起云涌（上）` |
| `第一节 简介` | ✓ | `第一节 简介` |
| `第章` | ✗ | -（无数字） |
| `第一章节` | ✗ | -（「章」后接「节」不匹配，避免误识） |

数字部分支持：阿拉伯数字 `0-9`、中文数字 `零一二三四五六七八九十百千`。不匹配大写金额数字 `壹贰叁`。

### 章节标题提取规则

匹配后章节标题 = `第` + 数字 + 量词 + 描述部分（trim 后），保留原样。不规范化数字。用户可在编辑步改。

### 正文规则

- 章节正文 = 从标题下一行起，到下一匹配行（不含）止，所有行拼接
- 正文保留原换行
- 正文首尾的空行 trim 掉
- 章节标题行本身不计入正文

### 文件头处理

TXT 开头到第一个章节匹配行之间的内容（如版权页、简介、作者序）：

- **统一丢弃**，无论匹配到几章
- 用户若想保留，可在编辑步手动加一章贴进去

### 0 章匹配兜底

若整本没有匹配到任何章节标题行：

- 返回 `[{ title: "第 1 章", body: text.trim() }]`
- 整本作为一章

### 章节去重（目录页剔除）

许多 TXT 开头有目录页：

```
目录
第一章 风起云涌
第二章 山雨欲来
...

第一章 风起云涌
正文从这里开始...
```

会识别出两遍「第一章 风起云涌」，第一遍正文为空。

**剔除规则**：若某章 `body.trim()` 为空字符串，丢弃该章。剔除后再检查总数，若为 0 则走 0 章兜底（整本 1 章）。

### 性能

5MB TXT 约 200 万字、可能上千章。一次扫描 + 正则匹配 O(n)，JS 在 RN 上处理 5MB 文本可接受（< 1 秒）。不增量解析，一次性 `split('\n')` 后遍历。

## 书名识别

### `detectBookName(filename)`

```js
export function detectBookName(filename) {
  const base = filename.replace(/^.*[\\/]/, "");      // 去路径
  const noExt = base.replace(/\.[^.]+$/, "");         // 去扩展名
  const trimmed = noExt.trim();
  return trimmed || "未命名小说";
}
```

- `斗破苍穹.txt` -> `斗破苍穹`
- `/path/to/《三体》.txt` -> `《三体》`
- `新建文本文档.txt` -> `新建文本文档`（不智能判断默认名，用户在 name-book 步改）
- 空文件名 -> `未命名小说`

不做首行/书名号回退。

## 向导状态机

`TxtImportScreen` 内部 `useState`，step 取值：

```
pick-file -> parsing -> edit-chapters -> name-book -> tts-generating -> done
```

| step | 用户操作 | 触发 |
|------|----------|------|
| `pick-file` | 点「选择 TXT 文件」 | `DocumentPicker.pick({ type: ['public.plain-text'] })` |
| `parsing` | 自动 | 读文件 + `detectChapters` |
| `edit-chapters` | 改标题/删行/编辑正文/合并/拆分 | 「下一步」 |
| `name-book` | 确认/改书名 | 「开始合成」 |
| `tts-generating` | 自动 | 逐章 `synthesizeToPath` |
| `done` | 自动 | `onComplete(book)` -> App.js |

### pick-file 步

- 单按钮「选择 TXT 文件」
- 点击调 `DocumentPicker.pick({ type: ['public.plain-text'] })`
- 拿到 `{ uri, name }` 后进入 `parsing`

### parsing 步

- 全屏 `ActivityIndicator` + 文案「解析中…」
- `RNFS.readFile(uri, 'utf8')` 读全文
- `looksLikeGbkDecodedAsUtf8(text)` 检查，命中则 Alert「文件可能是 GBK 编码，目前仅支持 UTF-8，请先用其他工具转换」+ 回 `pick-file` 步
- `detectChapters(text)` 分章
- 进入 `edit-chapters` 步

### edit-chapters 步 UI

```
┌─────────────────────────────────────┐
│ ‹ 返回      章节列表 (12 章)         │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ [TextInput: 第一章 风起云涌    ] │ │  ← 内联标题编辑
│ │ 风起云涌，席卷苍穹……（前 30 字） │ │  ← 正文预览
│ │              [编辑正文] [合并↓] [✕] │ │  ← 操作按钮
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [TextInput: 第二章 山雨欲来    ] │ │
│ │ 山雨欲来风满楼……              │ │
│ │              [编辑正文] [合并↓] [✕] │ │
│ └─────────────────────────────────┘ │
│ ...                                  │
├─────────────────────────────────────┤
│            [下一步]                  │
└─────────────────────────────────────┘
```

**内联标题编辑**：每个章节行顶部一个 `TextInput`，单行，预填识别出的标题。改完立即更新 `chapters[i].title`。

**正文预览**：标题下方一行小字，显示 `body.slice(0, 30)` + 「…」。

**操作按钮**（右下角，横向）：

| 按钮 | 行为 |
|------|------|
| `编辑正文` | `setEditingIndex(i)`，全屏渲染 `OcrChapterEditScreen` 预填 `chapters[i].text`，保存回 `chapters[i].text` |
| `合并↓` | `mergeWithNext(i)`：`chapters[i].text += "\n\n" + chapters[i+1].text`，`chapters[i+1]` 删除。最后一章禁用 |
| `✕` | `deleteChapter(i)`：从 chapters 移除。Alert 二次确认 |

**校验**：chapters 为空时禁用「下一步」，提示「至少保留一章」。

### 编辑正文（复用 OcrChapterEditScreen）

`OcrChapterEditScreen` 现有 props：`{ initialText, onSave, onCancel, chapterTitle }`。新增可选 prop `onSplitHere`：

```jsx
// OcrChapterEditScreen.js
const [selection, setSelection] = useState({ start: 0, end: 0 });
// <TextInput
//   ...
//   onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
// />

// 底部按钮行（原有「保存」右侧）：
{onSplitHere && (
  <TouchableOpacity onPress={() => onSplitHere(text, selection.start)}>
    <Text>在光标处拆分</Text>
  </TouchableOpacity>
)}
```

`onSplitHere(text, cursorPos)` 由 `TxtImportScreen` 提供：

```js
const onSplitHere = (fullText, cursorPos) => {
  const before = fullText.slice(0, cursorPos);
  const after = fullText.slice(cursorPos);
  if (!before.trim() || !after.trim()) {
    Alert.alert("拆分位置无效", "请把光标放在段落中间");
    return;
  }
  setChapters(prev => {
    const next = [...prev];
    next[editingIndex] = { ...next[editingIndex], text: before };
    next.splice(editingIndex + 1, 0, {
      id: `ch-${Date.now()}`,            // 临时 id，runTts 时重新规整
      title: `第 ${editingIndex + 2} 章`,
      text: after,
      sourceImagePath: "",
      audioPath: "",
      ocrFailed: false,
    });
    return next;
  });
  setEditingIndex(null);                  // 回到列表
};
```

### name-book 步

```
┌─────────────────────────────────────┐
│ ‹ 返回      命名小说                 │
├─────────────────────────────────────┤
│                                      │
│  书名：                              │
│  [TextInput: 斗破苍穹             ]  │  ← 预填 detectBookName(filename)
│                                      │
│  共 12 章，预计合成 12 个音频文件     │
│                                      │
├─────────────────────────────────────┤
│         [开始合成语音]               │
└─────────────────────────────────────┘
```

- 校验：书名 trim 后非空（沿用 `sanitizeTitle` 检查）
- 章节数 > 50 时加一行黄色提示：「章节较多，合成可能需要较长时间」

### tts-generating 步

- 进度条：「合成语音 3/12...」
- 进度 UI 复用 `OcrImportScreen` 风格

### 取消/返回

向导任意步按「‹ 返回」：

- `pick-file` 步：直接 `onCancel()` 回小说 tab
- 其他步：Alert「放弃本次导入？已生成的文件会清理」-> 确认 -> `cleanupAndCancel()`

`cleanupAndCancel` 删除临时文件夹 `${OCR_DIR}/${tempBookId}`。tempBookId 在进入向导时生成（`ocr-${Date.now()}`），处理过程中所有 TTS 输出写到临时文件夹，最终化时 `moveFile`。

## TTS 合成与最终化

### runTts 流程

```js
const runTts = async () => {
  setStep("tts-generating");
  setProgress({ current: 0, total: chapters.length });
  await RNFS.mkdir(bookDir);                          // 临时文件夹

  const completedChapters = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    try {
      if (!ch.text.trim()) {                          // 空正文跳过
        setProgress({ current: i + 1, total: chapters.length });
        continue;
      }
      const safeTitle = sanitizeChapterFilename(ch.title, i);
      const audioPath = `file://${bookDir}/${safeTitle}.m4a`;
      await synthesizeToPath(ch.text, audioPath);
      completedChapters.push({
        ...ch,
        id: `ch-${i}`,                                // 规整 id
        audioPath,
      });
    } catch (e) {
      // 见错误处理
    }
    setProgress({ current: i + 1, total: chapters.length });
  }

  if (completedChapters.length === 0) {
    Alert.alert("合成失败", "所有章节均合成失败");
    return;
  }

  // 最终化
  const finalDir = await computeBookDir(bookTitle, tempBookId);
  if (finalDir !== bookDir) {
    await RNFS.moveFile(bookDir, finalDir);
  }
  const book = {
    id: tempBookId,
    title: bookTitle.trim(),
    coverImage: "",                                   // TXT 导入无封面
    chapters: completedChapters.map((ch) => ({
      ...ch,
      audioPath: ch.audioPath.replace(bookDir, finalDir),
    })),
    createdAt: Date.now(),
    isOCR: true,
    bookDir: `file://${finalDir}`,
  };
  onComplete(book);                                   // App.js 调 saveOCRNovel
};
```

### `synthesizeToPath` 签名调整

现有 `src/data/tts.js` 的 `synthesizeChapter(text, bookId, chapterId)` 内部按 `bookId/chapterId` 拼路径。TXT 导入需要按「书名文件夹/章节标题」拼路径。

**改动**：新增导出 `synthesizeToPath(text, audioPath)`，把路径决定权交给调用方。`synthesizeChapter` 内部改为调 `synthesizeToPath`。OCR 流程和 TXT 流程都改用 `synthesizeToPath`，路径由各自屏幕决定。

### `sanitizeChapterFilename(title, index)`

```js
function sanitizeChapterFilename(title, index) {
  const cleaned = (title || "").trim()
    .replace(/[/:\x00\n\t\r]/g, "_")                  // 非法字符
    .replace(/\s+/g, " ");                            // 折叠空白
  if (!cleaned) return `第 ${index + 1} 章`;
  return cleaned.length > 60 ? cleaned.substring(0, 60) : cleaned;
}
```

- `第一章 风起云涌` -> `第一章 风起云涌`
- `第一章/风起云涌` -> `第一章_风起云涌`
- 空标题 -> `第 N 章`
- 截断到 60 字（避免 iOS 文件名 255 字节限制，中文 3 字节/字 -> 60 字 = 180 字节，留余量）

## 错误处理

| 场景 | 处理 |
|------|------|
| 选文件取消 | 留在 `pick-file` 步 |
| 文件读取失败 | Alert「无法读取文件」+ 留在 `pick-file` 步 |
| UTF-8 解码出大量 U+FFFD（GBK 文件） | Alert「文件可能是 GBK 编码，目前仅支持 UTF-8，请先用其他工具转换」+ 留在 `pick-file` 步 |
| 解析后 0 章节 | 不可能（兜底返回整本 1 章） |
| 单章 TTS 失败 | Alert「第 N 章合成失败」+ 选项「重试」/「跳过该章」/「取消整个导入」。跳过的章不进 `completedChapters` |
| 全部章节失败 | Alert「合成失败」+ 留在 `tts-generating` 步 |
| `moveFile` 失败 | catch，保留 `ocr-<bookId>` 临时文件夹名，book 对象用临时路径，导入仍成功。静默不 Alert |
| 磁盘空间不足 | `RNFS.writeFile` 抛错 -> Alert「存储空间不足」+ `cleanupAndCancel()` |
| App 后台 / 中断 | 不持久化向导状态。TTS 中切后台回前台后检查预期文件是否存在，缺失则报错让用户重试当前章 |

### GBK 检测启发式

```js
function looksLikeGbkDecodedAsUtf8(text) {
  const replacementCount = (text.match(/�/g) || []).length;
  return replacementCount > text.length * 0.01;       // > 1% 是替换字符
}
```

读取后检查，命中则报错让用户转换。不做 GBK 自动解码（避免引入 iconv 依赖）。

### 取消清理

```js
const cleanupAndCancel = async () => {
  try {
    await RNFS.unlink(bookDir);
  } catch {}
  onCancel();
};
```

`bookDir` = `${OCR_DIR}/${tempBookId}`（临时文件夹）。

## App.js 集成

新增 view 值 `"txt-import"`，与现有 `"tabs"` / `"player"` / `"ocr-import"` / `"ocr-edit"` / `"empty-book"` 并列。

```js
const onStartTxtImport = () => {
  setView("txt-import");
};

const onAdd = () => {
  Alert.alert("添加小说", null, [
    { text: "导入文件创建", onPress: onStartImport },
    { text: "导入 TXT 整本", onPress: onStartTxtImport },
    { text: "创建空小说", onPress: () => setShowCreateEmptyBook(true) },
  ]);
};
```

渲染分支：

```jsx
{view === "txt-import" && (
  <TxtImportScreen
    onComplete={onTxtImportComplete}
    onCancel={() => setView("tabs")}
  />
)}
```

`onTxtImportComplete(book)`：

```js
const onTxtImportComplete = async (book) => {
  const next = await saveOCRNovel(book);
  setOcrNovels(next);
  setView("tabs");
  setTab("novels");
};
```

`runTts` 不存 AsyncStorage，`onTxtImportComplete` 回调里存（与 OCR 流程一致）。

## UI 细节

### OcrChapterEditScreen 改动

新增可选 props：`onSplitHere`（可选 `function(text, cursorPos)`）。

底部按钮行从单一「保存」改为：

- 无 `onSplitHere`：仅「保存」（OCR 流程不变）
- 有 `onSplitHere`：「保存」+「在光标处拆分」（TXT 流程）

`TextInput` 加 `onSelectionChange` 追踪光标位置。React Native `selection.start` 是 UTF-16 code unit 偏移，与 `String.slice` 一致，中文字符位置可靠。

### NovelsScreen / MineScreen

**零改动**。新书通过 `expandOCRChapters` 进入列表，带 OCR 徽章；「我的」-> OCR 小说 子 tab 自动显示新书；删除/长按菜单全部复用。

### 视觉

- `TxtImportScreen` 复用 `COLORS` 调色板（浅色主题，主色橙红）
- header 样式与 `OcrImportScreen` 一致（左「‹ 返回」+ 中标题）
- 进度条样式复用现有 `OcrImportScreen` 的进度 UI
- 章节列表卡片样式：白底卡片 + 浅灰边框，与 `TrackList` 卡片风格一致
- 主按钮（下一步 / 开始合成）复用现有 `styles.playButton` 风格的实心橙红按钮

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/screens/TxtImportScreen.js` | 新增 | TXT 整本导入向导主控 |
| `src/data/txtChapterParser.js` | 新增 | `detectChapters` / `detectBookName` / `sanitizeChapterFilename` / `looksLikeGbkDecodedAsUtf8` |
| `src/data/tts.js` | 修改 | 新增导出 `synthesizeToPath(text, audioPath)`，`synthesizeChapter` 改为调它 |
| `src/screens/OcrImportScreen.js` | 修改 | `runTts` 改调 `synthesizeToPath` 传显式路径（保持行为不变） |
| `src/screens/OcrChapterEditScreen.js` | 修改 | 新增可选 `onSplitHere` prop + 光标追踪 |
| `App.js` | 修改 | `onStartTxtImport` / `onTxtImportComplete` / view 新分支 / Alert 第三项 |

## 依赖

**零新依赖**：

- `react-native-document-picker`（已有，P4 引入）-> `DocumentPicker.pick({ type: ['public.plain-text'] })`
- `react-native-fs`（已有，P4 引入）-> `readFile` / `mkdir` / `moveFile` / `unlink`
- `src/data/tts.js` 的 TTSWriter native 模块（已有，OCR 引入）-> `synthesizeToPath`
- 不引入新的 native 模块、不引入 GBK 解码库

## App.js 行数预算

- 本期新增：`onStartTxtImport`、`onTxtImportComplete`、view 新分支、Alert 一行
- 预计 +10-15 行
- 缓解：向导逻辑全在 `TxtImportScreen` 内部，App.js 只管 view 切换 + 完成回调

## 边界情况

| 场景 | 处理 |
|------|------|
| TXT 文件为空（0 字节） | `detectChapters` 返回 `[{ title: "第 1 章", body: "" }]`，编辑步显示空章节，TTS 步跳过空正文，最终 0 章完成 -> Alert「合成失败」-> 留在 tts 步 |
| TXT 只有章节标题无正文（纯目录） | 所有章节 body 为空 -> 全部剔除 -> 0 章 -> `detectChapters` 兜底返回整本 1 章 |
| 章节标题重复 | 不去重，保留。用户手动删除 |
| 章节标题含 `/` 或 `:` | 编辑步可显示，TTS 时 `sanitizeChapterFilename` 转 `_` |
| 章节标题超长（> 60 字） | `sanitizeChapterFilename` 截断到 60 字 |
| 书名全是非法字符 | `sanitizeTitle` 返回空 -> `computeBookDir` 回退 `ocr-<bookId>` |
| 两本同名小说 | `computeBookDir` 冲突检测，第二本得 `<书名> (2)` |
| 同名章节文件（用户硬改两章标题一样） | 后写的覆盖先写的 `.m4a`。v1 不预防，已知限制 |
| 大文件（5MB+） | 解析 < 1 秒可接受；TTS 按章逐个合成 |
| 选了非 TXT 文件 | `DocumentPicker.pick({ type: ['public.plain-text'] })` 在 iOS 上过滤 |
| 选文件时用户取消 | DocumentPicker 抛 cancel 异常，捕获后留在 `pick-file` 步 |

### iOS container UUID 变化

新书 `bookDir` 字段以 `file://` + `/Documents/` 标记存储。重装/升级后 `resolvePath` 重新锚定。`checkOCRFileExistence` 启动时检查音频文件，缺失标记 `ttsFailed`。复用现有机制，**零改动**。

### App 中途被杀

- 杀在 `pick-file` / `parsing` / `edit-chapters` / `name-book` 步：无文件落地，无副作用
- 杀在 `tts-generating` 步：临时 `ocr-<bookId>` 文件夹成孤儿，不在 AsyncStorage，用户不可见
- 杀在 `moveFile` 之后、`saveOCRNovel` 之前：重命名后的文件夹成孤儿

不建孤儿清理机制（与 novel-folder-layout 决策一致）。

## 验证方法

项目无自动化测试（既有约定）。沿用：

1. **每个 task 完成后**：`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` 作为冒烟门
2. **全部完成后手动 iOS 模拟器验证**：
   - 选 UTF-8 中文 TXT 文件 -> 自动分章 -> 列表正确显示标题和正文预览
   - 改标题 -> 保留改动到 TTS
   - 删行 -> 列表更新
   - 编辑正文 -> 保存生效
   - 合并下一章 -> 文本拼接，下一章消失
   - 在光标处拆分 -> 当前章截断，新章插入
   - 命名书名 -> 默认填文件名，可改
   - TTS 生成 -> 每章一个 `.m4a`，文件名为章节标题
   - 回到小说 tab -> 新书带 OCR 徽章，章节按 bookId 限定队列
   - 「我的」-> OCR 小说 -> 新书可见，可删除
   - 删除 -> `ocr-novels/<书名>/` 文件夹消失
   - GBK 文件 -> 提示不支持，留在选文件步
   - 无章节标记的 TXT -> 整本作为 1 章
   - 含目录页的 TXT -> 目录页自动剔除

## 后续跟进

- GBK 编码自动解码（native 模块或 iconv-lite）
- TXT append 模式（向已有书追加 TXT 章节）
- 章节顺序拖拽
- 从 TXT 第一行/书名号回退识别书名
- 大写金额数字章节（「第壹章」）
- 多卷本小说按「第 N 卷」分卷
