# 从文件夹导入小说 - 设计文档

## 背景

现有 OCR 导入流程只能从相册多选图片或拍照，整本扫描书要一张张勾选。需要一个「选文件夹批量导入」的入口，且目录里可能混合图片、文本、音频三种文件。

## 目标

在 `OcrImportScreen` 的 `select-images` 步骤新增「从文件夹导入」按钮，选目录后自动扫描、分类、按文件名排序，每个文件作为一章，按类型走不同处理路径，最终复用现有的编辑、命名、TTS 流程完成导入。

## 非目标

- 不递归子目录
- 不支持用户在导入前勾选/排序/合并文件（一文件一章，按文件名排序）
- 不从文件名生成章节标题（统一用「第 N 章」）

## 入口与扫描

### 入口

`select-images` 步骤的按钮行从两个变三个：「从相册选择」「拍照」「从文件夹导入」。第三个按钮调 `DocumentPicker.pickDirectory()` 拿到目录 URI。

### 扫描

拿到目录 URI 后用 `RNFS.readDir()` 读取顶层文件：
- 跳过子目录（`isDirectory: true` 的项）
- 按扩展名过滤：
  - 图片：`.jpg` `.jpeg` `.png`
  - 文本：`.txt`
  - 音频：`.m4a` `.mp3`
- 其他扩展名忽略
- 支持文件按文件名做自然排序（`chapter2` < `chapter10`）

扫描后留在 `select-images` 步骤，图片在缩略图区显示，文本和音频显示为带类型标签的行。用户点「开始识别」才开始处理，和现有选图体验一致。

## 处理流程

| 类型 | 拷贝到 bookDir | 取文本方式 | audioPath |
|------|----------------|-----------|-----------|
| 图片 | `source-{i}.{ext}` | ML Kit OCR | 空（TTS 阶段填） |
| 文本 | 不拷贝（内容进章节对象） | `RNFS.readFile()` | 空（TTS 阶段填） |
| 音频 | 保留原始文件名 | 无 | `file://bookDir/{原始文件名}` |

音频文件保留原始文件名（同目录内天然无重名），编辑步骤预览可直接从 `audioPath` 提取文件名显示。`i` = `startIndex + 顺序索引`，用于图片源文件命名和章节 id，和现有 append 模式一致，避免和已有章节撞文件名。

点「开始识别」后进入处理阶段，复用现有 `ocr-processing` 步骤的进度 UI，文案从「识别中 {current}/{total}...」改为「导入中 {current}/{total}...」（实现上可复用同一步骤名，按导入来源切文案，或新增步骤名，由实现决定）。

## 章节模型

复用现有字段，不新增 `sourceType`：

```js
{
  id: `ch-${startIndex + i}`,
  title: `第 ${startIndex + i + 1} 章`,
  text: "",              // 图片=OCR文本, 文本=文件内容, 音频=""
  sourceImagePath: "",   // 仅图片有值
  audioPath: "",         // 仅音频导入有值；图片/文本由 TTS 填
  ocrFailed: false,      // 仅图片 OCR 失败或文本读取失败时 true
}
```

类型判断用现有字段：
- `sourceImagePath` 非空 -> 图片
- `audioPath` 非空 -> 音频（跳过 TTS、不可编辑文本）
- 否则 -> 文本

## 书名

文件夹导入时书名默认填文件夹名（去掉路径前缀），用户可在 `name-book` 步骤改。和现有「新建模式填空、append 模式用已有书名」并列。

## 编辑步骤改动

`edit-chapters` 步骤章节列表按顺序展示，点击行为分流：
- 图片 / 文本章节：打开 `OcrChapterEditScreen` 编辑文本
- 音频章节：预览行显示「🎵 {文件名}」（从 `audioPath` 提取），点击不打开编辑器，仍可点「删除」移除

音频章节预览行显示文件名而非文本片段，避免用户误以为识别出错。

## TTS 步骤改动

`runTts` 循环增加跳过逻辑：

```js
for (let i = 0; i < chapters.length; i++) {
  const ch = chapters[i];
  if (ch.audioPath) {              // 已有音频，跳过 TTS
    completedChapters.push(ch);
    setProgress({ current: i + 1, total: chapters.length });
    continue;
  }
  if (!ch.text.trim()) {           // 无文本
    setProgress({ current: i + 1, total: chapters.length });
    continue;
  }
  // 现有 TTS 合成逻辑
}
```

进度总数仍为 `chapters.length`，音频章节瞬间跳过。

## 封面

和现在一样用第一张图片当封面。若目录里没有图片，封面路径为空字符串，播放器显示占位图。

## 错误处理

### 目录选择
- 用户取消：留在 `select-images` 步骤
- 目录无支持文件：`Alert.alert("该目录没有可导入的文件")`

### 单文件处理失败
- 图片 OCR 失败：`ocrFailed: true`，文本为空，进编辑步骤可手填（现有逻辑）
- 文本读取失败：同样标记 `ocrFailed: true`，文本为空，可手填
- 音频拷贝失败：该章不进 `chapters` 数组，`Alert.alert` 提示 `"{文件名} 导入失败，已跳过"`
- 不因单文件失败中断整批

### 全部失败
所有章节都失败时（OCR 全挂、文本全空、音频全拷失败），复用现有「没有可用的章节」提示。

## append 模式

文件夹导入支持 append（长按小说 -> 添加章节 -> 选文件夹）。`startIndex` 从已有章节数往后算，混合类型同样适用。

## 验证

项目无自动化测试，验证方式：
1. `npx react-native bundle --platform ios --dev false` 确认无语法/导入错误
2. 模拟器手动测试：
   - 纯图片目录导入
   - 纯文本目录导入
   - 纯音频目录导入
   - 混合目录导入
   - 空目录 / 无支持文件目录
   - append 模式追加混合章节
   - 文件名自然排序（chapter2 在 chapter10 前）
