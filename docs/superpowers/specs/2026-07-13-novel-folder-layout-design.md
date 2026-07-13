# 小说文件夹按书名/章节名存储 - 设计文档

## 背景

现有 OCR 小说存储布局为 `Documents/ocr-novels/ocr-<timestamp>/ch-N.m4a`：文件夹名是 bookId（时间戳），音频文件名是 `ch-N.m4a`。文件系统对人不可读，不便于外部浏览或导出。

## 目标

新导入的 OCR 小说改为按 `ocr-novels/<小说名>/<章节名>.m4a` 存储：文件夹名=小说名，音频文件名=章节名。让文件系统人可读。

## 非目标

- 不迁移现有小说（已存的 `ocr-<id>/ch-N.m4a` 保持原样，代码同时支持两种布局）
- 不改 bookId（仍是 `ocr-${Date.now()}`，作 AsyncStorage 键和 track-ID 前缀）
- 不改 source image / cover 文件名（`source-N.<ext>` / `cover.<ext>`，内部文件不是「章节」）
- 不改 App 内浏览方式（仍按列表展示，不是文件管理器式 UI）
- 不新增「导入有声书文件夹」入口

## 存储布局

### 新导入（new mode）

```
Documents/ocr-novels/<sanitized-title>/
  cover.<ext>              # 封面（若有）
  source-N.<ext>           # OCR 源图（若有）
  第 1 章.m4a              # TTS 音频，按章节名命名
  第 2 章.m4a
  <original-name>.mp3      # 从文件夹导入的音频章节保留原始文件名
```

### 现有小说

保持 `ocr-<id>/ch-N.m4a` 布局。代码通过 AsyncStorage 里存的完整路径读取，`resolvePath` 在加载时重新锚定到当前 Documents 目录，两种布局都兼容。

### bookId 不变

仍是 `ocr-${Date.now()}`，用于：
- AsyncStorage 里的 book 对象 `id` 字段
- track-ID 前缀 `${book.id}/${ch.id}`

只有磁盘文件夹名改用小说名，bookId 仍存在。

### 音频文件名规则

- TTS 合成的音频：`<chapter-title>.m4a`（如 `第 1 章.m4a`）
- 从文件夹导入的音频章节：保留原始文件名（沿用现有 folder-import spec）
- 章节标题目前固定为 `第 ${N} 章`（自动生成，无 UI 编辑），含空格但无非法字符，iOS 文件系统接受

## 文件夹名生成

### `sanitizeTitle(title)`

- 去首尾空白
- 替换文件系统非法字符（`/`、`:`、`\0`、`\n`、`\t`）为 `_`
- 截断到 80 字符（给冲突后缀和后续文件名留余量）
- 若结果为空 -> 回退到 `ocr-${bookId}`

### `computeBookDir(title, bookId)`

- `base = sanitizeTitle(title)`
- 若 `${OCR_DIR}/${base}` 不存在 -> 用它
- 若存在 -> 试 `base (2)`、`base (3)`、... 到 `base (99)`，用第一个不存在的
- 若 99 个都占满 -> 回退到 `ocr-${bookId}`（实际不可能发生）

仅在最终化时调用一次（`runTts` 里，书名确认后）。处理过程中用 bookId 作临时文件夹名，时间戳唯一，无冲突可能。

### 章节文件名不 sanitize

章节标题是自动生成的 `第 ${N} 章`，无非法字符、无用户编辑，不需要 sanitize。空格在 iOS 上合法。

## 处理流程（new mode）

问题：`runImport`（步骤 2）里要拷贝源图，但书名到 `name-book`（步骤 4）才知道。最终文件夹名不能提前算。

方案：处理过程用临时文件夹，最终化时重命名。

### 处理过程（runImport、edit-chapters、runTts）

- `bookDir = ${OCR_DIR}/${tempBookId}`（时间戳唯一，无冲突）
- 所有文件操作（源图拷贝、OCR、音频拷贝、TTS 输出）用这个临时文件夹
- `cleanupAndCancel` 撤销时 unlink 临时文件夹（现有行为，不变）

### 最终化（runTts 里，书名校验通过且所有 TTS 完成后）

1. `finalDir = computeBookDir(bookTitle, tempBookId)`（sanitize + 冲突检测）
2. `RNFS.moveFile(bookDir, finalDir)`（单次 rename，iOS 同文件系统原子）
3. 构建 `book` 对象时，路径指向 `finalDir`（不是旧的 `bookDir`）
4. 调 `onComplete(book)` -> App.js 存到 AsyncStorage

若 `moveFile` 抛错（磁盘满、权限，极少见）：catch，保留 `ocr-<bookId>` 文件夹名，book 对象用临时文件夹路径，导入仍成功（文件夹名丑但数据不丢）。静默失败，不弹 Alert。

## Append 模式

复用现有书文件夹，不 rename，不新建文件夹。

### `getBookDir(book)` 辅助函数

现有 `bookDir = ${OCR_DIR}/${tempBookId}`（`tempBookId = existingBook?.id`）在旧布局下凑巧能用（文件夹=bookId）。新布局下文件夹是 sanitized title，不等于 bookId，会失效。

新增 `getBookDir(book)`（导出自 `ocrNovels.js`，供 `OcrImportScreen` 和 `deleteOCRNovel` 共用）：
- 若 `book.coverImage` 非空：剥 `file://` 和 `/cover.<ext>` -> 文件夹路径
- 否则若有任一章节 `audioPath` 非空：剥 `file://` 和文件名 -> 文件夹路径
- 否则（防御性，不应发生）：回退 `${OCR_DIR}/${book.id}`

使用点：
- `OcrImportScreen`（append 模式）：挂载时 `bookDir = getBookDir(existingBook)`
- `deleteOCRNovel(bookId)`（`ocrNovels.js`）：现做 `RNFS.unlink(${OCR_DIR}/${bookId})`，改为先在列表里找到 book，用 `getBookDir(book)` 推导文件夹再 unlink。同时修复新旧两种布局的删除。

### Append 章节文件名

新章节用 `<chapter-title>.m4a`（如 `第 6 章.m4a`，startIndex=5）。startIndex 从已有章节数往后接，不与现有文件冲突（无论旧式 `ch-N.m4a` 还是新式 `第 N 章.m4a`）。一个文件夹内混合命名可接受，反映各批次导入时间。

## 错误处理与边界

### 书名全是非法字符（如 `///`）

sanitize 后为空 -> 回退 `ocr-${bookId}`。书仍保存成功，文件夹名不可读。用户可后续用真实书名重新导入。

### 冲突循环到 99 仍占满

回退 `ocr-${bookId}`。实际不可能。

### moveFile 失败

catch，保留 `ocr-<bookId>` 文件夹，book 对象用临时文件夹路径。导入成功，文件夹名丑。静默，不 Alert。

### App 在 rename 中途被杀

iOS `rename(2)` 同文件系统原子。要么旧名在、要么新名在，无半 rename 状态。
- 杀在 rename 前：临时 `ocr-<id>` 文件夹成孤儿（不在 AsyncStorage），占空间但不可见
- 杀在 rename 后、AsyncStorage 保存前：重命名后的文件夹成孤儿

两种都是沙箱内孤儿，用户不可见，卸载 App 时清理。不值得为孤儿清理建机制。

### Append 到文件夹被外部删除的书

`getBookDir` 推导出路径，但文件夹不存在。`runImport` 里 `RNFS.mkdir(bookDir)` 会重建。新章节文件正常写入。现有章节经 `checkOCRFileExistence` 标 `ttsFailed: true`（现有行为）。无需新处理。

### 老布局小说无回归

`deleteOCRNovel`、`getBookDir`、`checkOCRFileExistence`、`expandOCRChapters` 都基于存储路径操作，对 `ocr-<id>/ch-N.m4a` 和 `<title>/第 N 章.m4a` 一视同仁。

## 改动文件

- `src/data/ocrNovels.js`：新增并导出 `getBookDir(book)`；`deleteOCRNovel` 改用 `getBookDir` 推导文件夹再 unlink
- `src/screens/OcrImportScreen.js`：从 `ocrNovels` 导入 `getBookDir`；新增 `sanitizeTitle`/`computeBookDir`（本文件内私有）；`bookDir` 在 new 模式用临时 bookId 文件夹、append 模式用 `getBookDir(existingBook)`；`runTts` 最终化时 moveFile + 用 finalDir 构建 book 对象

## 验证

项目无自动化测试。验证方式：
1. `npx react-native bundle --platform ios --dev false` 确认无语法/导入错误
2. 模拟器手动测试：
   - 新建 OCR 导入（相册图片）-> 文件夹名为输入书名，音频 = `第 N 章.m4a`
   - 新建文件夹导入（混合）-> 文件夹名为文件夹名，TTS 音频 = `第 N 章.m4a`，导入的音频保留原名
   - 空书名 -> Alert「请输入书名」（现有守卫，不尝试 rename）
   - 书名含 `/` 或 `:` -> sanitize 成 `_`
   - 两本同名小说 -> 第二本加 ` (2)` 后缀
   - 向新布局书 append 章节 -> 新文件进现有 title 文件夹
   - 向旧布局书（现有测试数据）append 章节 -> 新文件进现有 `ocr-<id>` 文件夹
   - 删除新布局书 -> title 文件夹被删
   - 删除旧布局书 -> `ocr-<id>` 文件夹被删
   - 导入中途取消 -> 临时 `ocr-<id>` 文件夹被清理
