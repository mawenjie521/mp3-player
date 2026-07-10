# OCR + TTS 小说导入设计

> 为「小说」tab 增加 OCR 导入能力：用户从相册/相机选多张含中文文字的图片，ML Kit 识别文本，用户按章编辑，AVSpeechSynthesizer 合成语音写入本地 `.m4a`，生成的章节作为轨道加入现有播放器，与有声书混排在小说 tab。

## 目标

- 让「小说」tab 不再只有预置有声书，用户能从任意拍下的书页图片生成可听的小说
- 复用现有 TrackPlayer / 队列 / 持久化机制，不引入第二条播放链路
- 全本地、零网络依赖、零调用费用（OCR 用 ML Kit 本地识别，TTS 用 iOS 系统 AVSpeechSynthesizer）

## 范围

- 仅 iOS
- 仅中文 OCR（ML Kit 中文语言模型）
- 一本 OCR 书 = 多张图 = 多个章节 = 多条轨道
- 不做：文本转语音的语速/音色调节（v1 固定系统默认）、章节顺序拖拽（按选图顺序）、Android 支持、ID3 元数据

## 架构总览

### 新增依赖

- `react-native-ml-kit-text-recognition`：社区封装的 ML Kit 文字识别（iOS 内置 ML Kit，需在 Podfile 配置中文语言模型）
- `react-native-image-picker`：相机 + 相册选图（支持多选）
- `react-native-fs`（已在 P4 引入）：写 TTS 音频文件、管理 OCR 书目录

### 新增 native 模块（iOS）

`TTSWriter`（Objective-C）：

- 暴露一个方法 `synthesize(text, outputPath, resolver)`
- 内部用 `AVSpeechSynthesizer` + `AVAudioFile` 把合成结果写入指定 `.m4a` 路径
- 合成完成后 resolve JS（返回 `{ success, path, durationMs }`）
- 仅 iOS，通过 `NativeModules.TTSWriter` 暴露给 JS

### 新增 JS 模块

- `src/data/ocrNovels.js`：OCR 书的存取（`loadOCRNovels` / `saveOCRNovel` / `deleteOCRNovel`），元数据存 AsyncStorage `@mp3player:ocr-novels`
- `src/data/tts.js`：封装 TTSWriter native 模块，提供 `synthesizeChapter(text, bookId, chapterId) -> filePath`
- `src/screens/OcrImportScreen.js`：多步导入向导
- `src/screens/OcrChapterEditScreen.js`：单章文本编辑

### 数据流

```
[选图 (image-picker)]
  -> [逐张 OCR (ml-kit)] -> [文本数组]
  -> [逐章编辑 (OcrChapterEditScreen)] -> [确认文本]
  -> [命名书名] -> [逐章 TTS (TTSWriter) -> .m4a 文件]
  -> [元数据存 AsyncStorage] -> [加入 novels 列表]
```

### App.js 改动

- 新增 view 值：`"ocr-import"` / `"ocr-edit"`，与现有 `"tabs"` / `"player"` 并列
- Novels tab 顶部加"+"按钮，点击进入 `view: "ocr-import"`
- 导入完成后回到 novels tab，新书自动出现在列表

## 数据模型

### OCR 书元数据结构

存 AsyncStorage `@mp3player:ocr-novels`（数组）：

```js
{
  id: "ocr-1718000000000",          // "ocr-" + Date.now()
  title: "用户输入的书名",
  coverImage: "file:///.../cover.jpg", // 第一张图的本地路径，用作 artwork
  chapters: [
    {
      id: "ch-0",
      title: "第 1 章",              // 自动生成 "第 N 章"
      text: "OCR 识别并经用户编辑后的文本",
      audioPath: "file:///var/.../Documents/ocr-novels/<bookId>/ch-0.m4a",
      sourceImagePath: "file:///.../source-0.jpg",
    },
    // ... 更多章节
  ],
  createdAt: 1718000000000,
  isOCR: true,
}
```

### 文件系统布局

RNFS `DocumentsDirectoryPath`：

```
Documents/
  ocr-novels/
    <bookId>/
      cover.jpg          # 第一张图复制过来当封面
      ch-0.m4a           # TTS 合成的章节音频
      ch-1.m4a
      ...
      source-0.jpg       # 原图留存
      source-1.jpg
```

### 与现有 novels 的合并

`allTracks` 改为 `[...playlist, ...novels, ...importedTracks, ...ocrNovelChapters]`，其中 `ocrNovelChapters` 是把每本 OCR 书的每章展开成一个 track：

```js
{
  id: "ocr-1718.../ch-0",           // bookId + "/" + chapterId，全局唯一
  url: chapter.audioPath,           // file:// 路径，TrackPlayer 直接播
  title: `${book.title} - 第 1 章`,
  artist: "OCR 朗读",
  artwork: book.coverImage,
  lrc: "",
  category: "OCR 小说",
  isNovel: true,                    // 关键：标记为 novel，出现在小说 tab
  isOCR: true,                      // 二级标记，用于显示 OCR 徽章
  bookId: book.id,                  // 关联回书，便于按书限定队列
}
```

### 小说 tab 展示策略

按章节展开列出（每章一个列表项，与有声书并列），复用现有 TrackList。同一书的章节在列表里相邻，title 前缀书名区分。OCR 书带"OCR"小徽章（TrackList 里根据 `isOCR` 渲染）。

不采用"按书折叠"——会让 TrackList 出现两种行类型，破坏现有复用。

## 导入向导流程

### 入口

NovelsScreen 顶部加"+"按钮（与 `共 N 本` 同行，右侧），点击 `setView("ocr-import")`。

### 向导状态机

OcrImportScreen 内部 useState，step 取值：

```
select-images -> ocr-processing -> edit-chapters -> name-book -> tts-generating -> done
```

### Step 1: select-images（选图）

- "选择图片"按钮调 `ImagePicker.launchImageLibrary({ selectionLimit: 0, mediaType: 'photo', includeBase64: false })`（`selectionLimit: 0` = 多选）
- 选完后显示缩略图列表（横向滚动），每张右上角"×"可删除，可重新选择
- 至少 1 张才能"下一步"
- 选图完成后把每张图复制到 `Documents/ocr-novels/<tempBookId>/source-<i>.jpg`（避免相册原图被删）

### Step 2: ocr-processing（逐张 OCR）

- 自动触发，进度条："识别中 2/5..."
- 对每张图调 `TextRecognition.recognize(imagePath, 'zh')`（ML Kit 中文识别）
- 收集结果到 `chapters[i].text`，`chapters[i].sourceImagePath` = 复制后的路径
- 某张识别失败时：该章 `text = ""`，`ocrFailed: true`，不阻断整体流程

### Step 3: edit-chapters（逐章编辑）

- 列出所有章节，每行：`第 N 章` + 文本预览前 30 字 + "编辑"按钮
- 点"编辑"进入 OcrChapterEditScreen（全屏 TextInput，多行，预填 OCR 文本）
- 编辑完返回，向导内状态更新
- 章节顺序按选图顺序，v1 不支持调序

### Step 4: name-book（命名）

- 一个 TextInput 输入书名
- "完成并生成语音"按钮
- 校验：书名非空

### Step 5: tts-generating（逐章 TTS）

- 进度条："合成语音 3/5..."
- 对每章调 `TTSWriter.synthesize(chapters[i].text, audioPath)`，audioPath = `Documents/ocr-novels/<bookId>/ch-<i>.m4a`
- 第一张图复制为 `cover.jpg`
- 全部完成后：
  - 组装元数据对象
  - `saveOCRNovel(book)` 存 AsyncStorage
  - 更新 App.js 的 `ocrNovels` state（触发 allTracks 重算）
  - `setView("tabs")` + `setTab("novels")` 回到小说 tab

### 取消/返回

- 向导任意步按"返回"：Alert "放弃本次导入？已生成的文件会清理"
- 确认后：RNFS 删除 `Documents/ocr-novels/<tempBookId>/`，`setView("tabs")`
- tempBookId 在进入向导时即生成（`"ocr-" + Date.now()`），确保取消清理有目标

## 播放器集成

### 队列构造：按书限定

NovelsScreen 的 `onSelect` 根据 `item.bookId` 过滤队列：

```js
onSelect={(item) => {
  const queue = item.bookId
    ? novels.filter((t) => t.bookId === item.bookId)  // OCR 书：按 bookId 限定
    : novels;                                          // 有声书：全队列
  onSelect(item, queue, "novels");
}}
```

- 有声书（无 `bookId`）：队列就是所有 novels（与现状一致）
- OCR 书（有 `bookId`）：队列只含同书章节，"下一首"在同书内推进，听完整本停在末章

### TrackPlayer 适配

- OCR 章节轨道的 `url` 是 `file://` 本地路径，TrackPlayer 4.1.1 支持（P4 已验证 imported MP3 用 `file://` 可播）
- TTS 生成的 `.m4a` 是 AAC 编码，TrackPlayer 默认支持
- 无需额外配置

### 进度持久化

现有 save/restore 按 `currentTrack?.id` 存位置。OCR 章节轨道 id 形如 `"ocr-.../ch-0"`，与现有 id 格式不冲突，`allTracksForRestore` 能找到对应轨道即可。无需改动 restore 逻辑。

### 循环模式

沿用现有 repeat-off / repeat-one / repeat-all 三态。对 OCR 书而言：
- repeat-one：重播当前章节
- repeat-all：循环当前队列（即整本书）
- 不新增"全书循环"概念

## UI 与视觉

### NovelsScreen 改动

- header 右侧加"+"按钮：`<Text style={styles.addBtn}>+</Text>`，复用 `COLORS.primary` 红色，fontSize 22
- header 布局改为 `flexDirection: "row", justifyContent: "space-between"`，左侧 title+subtitle，右侧 +按钮
- 点击 -> `onStartImport()`（App.js 传入）-> `setView("ocr-import")`

### TrackList OCR 徽章

在 TrackList 每行 title 右侧，若 `item.isOCR` 为真，渲染徽章：

```jsx
{item.isOCR && (
  <View style={styles.ocrBadge}>
    <Text style={styles.ocrBadgeText}>OCR</Text>
  </View>
)}
```

样式：小圆角矩形，`backgroundColor: COLORS.primary`，白色文字，fontSize 9，padding 2px 6px。不影响非 OCR 轨道。

### OcrImportScreen 视觉

- 顶部 header：左侧"返回"（‹），中间"导入 OCR 小说"，无右侧
- 内容区按 step 渲染，统一 `paddingHorizontal: 24`
- 进度条（step 2 / 5）：简单 View 高度条 + 百分比文字，样式与现有进度条一致
- 底部固定"下一步"/"完成"主按钮（复用现有 `styles.playButton` 风格的实心红按钮）

### OcrChapterEditScreen 视觉

- 顶部 header：左侧"返回"（‹，回到向导），中间 `第 N 章`
- 内容区：全屏 `TextInput`，`multiline`，`textAlignVertical: "top"`，预填 OCR 文本
- 底部固定"保存"按钮

### "我的"tab 新增 OCR 子标签

- MineScreen sub-tabs 从 `favorites / recent / imported` 扩展为 `favorites / recent / imported / ocr`
- NAV_TABS 不变（仍是 3 个底部 tab），sub-tabs 是 Mine 内部
- "ocr" 子 tab 列出所有 OCR 书（按书折叠，每行：封面 + 书名 + 章节数 + 删除按钮）
- 删除按钮：Alert 确认 -> `deleteOCRNovel(bookId)`（清 AsyncStorage + RNFS 目录）-> 刷新列表

### 颜色与常量

- 不新增颜色，OCR 徽章复用 `COLORS.primary`
- sub-tab key "ocr" 直接用字符串，不加到 NAV_TABS

### 无图占位

- OCR 书封面 = 第一张 source 图，必有
- 若图损坏导致 artwork 加载失败，Image 组件 fallback 到默认音乐图标（沿用现有逻辑）

## 边界情况与错误处理

### OCR 边界

- **某张图识别为空**：该章 `text = ""`，`ocrFailed: true`。编辑步显示"（识别为空，请手动输入）"占位。不阻断流程。
- **ML Kit 中文模型未下载**：iOS 首次使用 ML Kit 中文识别时系统自动下载语言模型，需联网。离线时 `recognize` 会 reject。向导捕获后 Alert "中文识别模型下载中或网络不可用，请稍后重试"，停在选图步。
- **图片过大/格式异常**：image-picker 已限制为 photo，ML Kit 自身有缩放。不做额外处理，失败按"识别为空"处理。

### TTS 边界

- **文本过长**：AVSpeechSynthesizer 单次合成超长文本可能卡顿。v1 不做分片，单章通常 < 2000 字。若超过 5000 字，Alert 提示"第 N 章文本较长，合成可能较慢"，允许继续。
- **TTS 合成失败**：弹 Alert "第 N 章合成失败"，选项"重试"/"跳过该章"/"取消整个导入"。跳过的章节**不加入** chapters 数组，书仍保留其他章节。
- **磁盘空间不足**：RNFS 写文件抛错。Alert "存储空间不足"，取消导入，清理 `Documents/ocr-novels/<tempBookId>/`。

### 导入取消

- 向导任意步按返回：Alert "放弃本次导入？" -> 确认后 RNFS 删 `Documents/ocr-novels/<tempBookId>/` -> `setView("tabs")`
- 已生成的部分 TTS 文件一并清理

### App 后台 / 中断

- TTS 合成中切后台：AVSpeechSynthesizer 在后台不保证完成。回前台后检查预期文件是否存在，缺失则报错让用户重试当前章
- AppState 监听复用现有 save 逻辑，不额外处理向导状态（向导状态不持久化，重启后回到 tabs）

### 文件存在性（iOS container UUID）

- iOS 升级或重装后 app container 路径变化，`file://` URL 可能失效
- v1 处理：启动时（`initPlayer`）检查所有 OCR 书的 `audioPath` 是否存在，不存在的标记 `ttsFailed`，列表里灰显或隐藏。不做自动修复
- 复用 P5 候选 "file-existence cleanup on startup" 思路，仅 OCR 书受影响

### 删除 OCR 书

- 删除时 TrackPlayer 正在播该书的某章：先 `TrackPlayer.reset()` 再删文件再删元数据
- 删除后若 currentTrack 被清空，UI 回到 tabs view

## 验证方法

沿用项目既有约定（无自动化测试）：

- 每个 task 完成后跑 `npm run build`（Metro bundle）作为冒烟门
- 全部完成后手动模拟器验证：
  - 选 2-3 张含中文文字的图片
  - OCR 识别结果合理（容错）
  - 编辑文本生效
  - TTS 生成音频可播
  - 列表里新书带 OCR 徽章
  - 点章节播放，下一首在同书内推进
  - "我的" -> OCR 子 tab 能看到书，能删除
  - 删除后文件目录消失

## App.js 行数预算

- 当前 300 行（P4 达预算上限）
- 本期新增：OCR state（`ocrNovels` + `setOcrNovels`）、`onStartImport`、`onDeleteOCRNovel`、view 新值分支
- 预计 +30-40 行，App.js 达 ~335 行
- 缓解：OCR 书的 load/save/delete 全部放 `src/data/ocrNovels.js`，App.js 只调函数；向导逻辑全在 OcrImportScreen 内部，App.js 只管 view 切换
- 接受 ~335 行，不强行拆分

## 依赖与风险

- `react-native-ml-kit-text-recognition`：社区库，需验证 iOS Pod 安装与中文模型配置；若库不可用，备选直接调原生 Vision 框架（识别率较低但无依赖）
- AVSpeechSynthesizer 写文件：iOS 上需用 `AVAudioEngine` + `AVAudioFile` tap 合成输出（AVSpeechSynthesizer 默认只播不写），native 模块复杂度中等
- 系统机械音：用户接受度未知，但作为免费、本地的方案是合理起点；未来可扩展第三方 TTS
- ML Kit 中文模型首次下载需联网：首次使用体验略差，但仅一次
