# TTS 音质优化设计

> 现有 OCR/TXT 小说导入使用 iOS 系统 `AVSpeechSynthesizer` 合成语音，中文音质偏机械。本设计在不引入云端依赖的前提下，通过 premium 语音包检测+引导、voice/语速选择 UI、扩充 voice 候选逻辑、适配新版 iOS 语音四项优化，让用户能用上 Apple 最顶级的中文 neural 语音并把选择持久化。

## 目标

- 让用户能选择并使用设备上已有的最佳中文语音（premium > enhanced > compact）
- 在未下载 premium 语音包时主动引导用户去系统设置下载
- 暴露语速调节，并持久化 voice + rate 偏好
- 提升新版 iOS（17+）下 voice 质量判定的健壮性

## 范围

- 仅 iOS（与现有 TTS 实现一致）
- 仅优化系统 TTS 路径，不引入云端 TTS
- voice 选择作用于全局（所有 OCR/TXT 导入共用一套偏好），不做 per-book 设置
- 不做：Android 支持、第三方 TTS 接入、按章节覆盖全局 voice

## 现状回顾

- `ios/MP3Player/TTSWriter.mm`：封装 `AVSpeechSynthesizer`，暴露 `synthesize(text, outputPath, voiceId, rate)` 和 `getVoices()`。voice 质量判定用 `[v.identifier containsString:@"premium"]` 字符串匹配。
- `src/data/tts.js`：JS 封装层，31 行。`synthesizeChapter(text, outputPath, voice, rate)` 透传 native；`getVoices()` 透传；`DEFAULT_VOICE = ""`、`DEFAULT_RATE = 0`。
- 调用方：`OcrImportScreen.js:261` 和 `TxtImportScreen.js:187`，均只传 `text` 和 `outputPath`，未传 voice/rate。
- `src/screens/SettingsScreen.js`：已存在，含"清除缓存""版本"两行。
- App.js 当前 757 行，已有 `view: "settings"` 等多个视图状态。

## 架构总览

### 原生模块改动（`ios/MP3Player/TTSWriter.mm`）

1. **voice 质量判定改用枚举**：将 `[v.identifier containsString:@"premium"]` 等字符串匹配替换为 `AVSpeechSynthesisVoice.quality` 枚举判定（`AVVoiceQualityPremium` / `AVVoiceQualityEnhanced` / `AVVoiceQualityCompact`）。更健壮，不受新版 iOS voice identifier 格式变化影响。

2. **新增 `previewVoice` 方法**：用 `AVSpeechSynthesizer speak:` 直接朗读（不写文件），用于试听。native 层持有 `AVSpeechSynthesizer *previewSynth` 单例，调用时先 `stopSpeakingAtBoundary:AVSpeechBoundaryImmediate` 再 `speak:`，避免快速点击多个试听按钮时语音重叠。

3. **`getVoices` 返回值增强**：
   - 增加 `downloaded: @YES` 字段（`speechVoices` 本就只返回已下载的，显式标记便于 JS 判断）
   - 按 quality 降序排序（premium 先于 enhanced 先于 compact）
   - quality 字段改用枚举映射，不再依赖 identifier 字符串

4. **`selectVoice` 逻辑优化**：当用户传入 voiceId 时直接用；未传入时按 premium > enhanced > compact 降序取第一个（与现状一致，但用枚举判定）。

### JS 数据层改动（`src/data/tts.js`）

1. **`synthesizeChapter` 自动加载持久化设置**：当调用方未传 voice/rate 时，从 AsyncStorage 读取用户偏好。`OcrImportScreen` / `TxtImportScreen` 零改动。

2. **新增 `previewVoice(voiceId, rate, text)`**：透传给 native `TTSWriter.previewVoice`。

3. **新增 `loadTTSSettings()` / `saveTTSSettings(voice, rate)`**：
   - AsyncStorage key：`@mp3player:tts-settings`
   - 结构：`{ voice: "<identifier or empty>", rate: <number -100..100>, updatedAt: <ts> }`
   - 默认值：`{ voice: "", rate: 0 }`（空 voice = 让 native 层自动选最佳 premium）

4. **`getVoices()` 透传**：已有，不变。

5. **不新建 `ttsSettings.js`**：现有 `tts.js` 31 行，加 settings 存取后约 60 行，仍在单文件舒适区。

### 新增 TTSSettingsScreen

入口：`SettingsScreen` 新增一行"TTS 语音"，显示当前选中的 voice 名（或"系统默认"），点击 `onTTSSettings()` -> App.js `setView("tts-settings")`。位置在"清除缓存"之上（功能设置优先于维护操作）。

布局（自上而下）：

1. **Header**：左侧"‹"返回，中间"TTS 语音"，无右侧。复用 SettingsScreen 的 header 样式。

2. **Premium 检测横幅**（条件渲染）：
   - 进入屏幕时调 `getVoices()`，若返回列表中无 `quality === "premium"` 的 zh voice，显示黄色横幅
   - 文案："未检测到 premium 中文语音包，音质会偏机械。前往 设置 › 辅助功能 › 朗读内容 › 声音 › 中文（简体） 下载 Tingting/Lilian 优质语音"
   - 不放"打开设置"按钮 -- `UIApplication.openSettingsURL` 只能打开本 app 设置页，到不了"朗读内容"系统设置页，按钮会误导用户

3. **语速滑块区**：
   - 标签"语速"，右侧显示当前值（如"+10%"或"默认"）
   - 使用 `@react-native-community/slider`（已在依赖中），范围 -50 ~ +50，默认 0
   - 拖动结束后触发"试听当前选中 voice + 新 rate"以便对比

4. **语音列表区**（ScrollView）：
   - 按 quality 分组：Premium / Enhanced / Compact（仅显示有 voice 的组）
   - 每行：左侧 radio + voice 名（如"Tingting"）+ 语言标签（zh-CN）；右侧"试听"按钮
   - 选中态：radio 实心，行背景轻微高亮
   - 第一项永远是"系统默认"（voice = ""），表示让 native 层自动选最佳 premium

5. **底部固定"保存"按钮**：复用现有实心红按钮样式。点保存 -> `saveTTSSettings(voice, rate)` -> alert "已保存" -> 自动返回 SettingsScreen。不做自动保存 -- 让用户能试听多个 voice 后再决定，避免频繁写盘。

**空状态**：`getVoices()` 返回空数组（极端情况，系统连 compact zh voice 都没有）-> 显示"未找到中文语音包，请在系统设置中下载"。

### App.js 接线

- 新增 view 状态 `"tts-settings"`，与现有 `"settings"` / `"ocr-import"` / `"txt-import"` 并列
- 新增 handler `onTTSSettings = () => setView("tts-settings")`
- SettingsScreen props 扩展：
  - `onTTSSettings`：点击 TTS 行的回调
  - `ttsVoiceLabel`：当前选中 voice 的显示名（或"系统默认"），由 App.js 通过 `loadTTSSettings()` + `getVoices()` 计算后传入，避免 SettingsScreen 自己管异步状态
- App.js 启动时加载 TTS 设置到 state `ttsVoiceLabel`，仅用于 SettingsScreen 行显示；实际合成时 `synthesizeChapter` 自己再读一次 AsyncStorage（避免 state 与磁盘不一致）
- 渲染分支新增 `view === "tts-settings"` -> `<TTSSettingsScreen onBack={() => setView("settings")} />`

行数预算：当前 757 行，预计 +15 行（1 个 view 分支 + 1 个 handler + ttsVoiceLabel state + 加载逻辑），不做拆分。

### 数据流

```
启动 -> App.js loadTTSSettings -> ttsVoiceLabel state
                                         |
SettingsScreen 行显示 <------------------+
                                         |
点击行 -> setView("tts-settings")
                                         |
TTSSettingsScreen -> getVoices/previewVoice/saveTTSSettings
                                         |
保存 -> AsyncStorage -> 返回 SettingsScreen
                                         |
后续 OCR/TXT 导入 -> synthesizeChapter -> 读 AsyncStorage -> 用新 voice/rate
```

## 边界情况与错误处理

### Premium 语音包检测的局限

- `AVSpeechSynthesisVoice.speechVoices()` 只返回**已下载**的 voice，无法列举"可下载但未下载"的列表
- 因此横幅只能判断"有没有 premium"，不能告诉用户"具体缺哪个 voice"
- 横幅文案用泛化描述（"Tingting/Lilian 优质语音"），不承诺精确名称

### 试听打断

- native 层持有 `AVSpeechSynthesizer *previewSynth` 单例
- `previewVoice` 调用时先 `stopSpeakingAtBoundary:AVSpeechBoundaryImmediate`，再 `speak:`
- 避免快速点击多个试听按钮时语音重叠

### voice 在保存后被系统删除

- 用户在系统设置里删掉已选的 premium voice -> 下次 `synthesizeChapter` 时 native 层 `voiceWithIdentifier:` 返回 nil -> `selectVoice` 走 fallback 链（其他 premium -> enhanced -> compact -> 默认），不抛错
- TTS 仍能完成，只是音质降级。SettingsScreen 下次进入时 `getVoices()` 不再含该 voice，行显示会自动切回"系统默认"

### rate 范围

- native 层接受 -100 ~ +100（现有代码已实现）
- UI 滑块限制 -50 ~ +50（超过 ±50 语速过快/过慢，无实用价值）
- 保存时 clamp 到该范围

### 后台合成中断

现有 `TTSWriter` 已有 `beginBackgroundTask` 处理，本次不改。

## 验证方法

沿用项目既有约定（无自动化测试）：

1. 每个 task 完成后跑 `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` 作为冒烟门
2. 全部完成后手动模拟器验证：
   - SettingsScreen 出现"TTS 语音"行，显示当前 voice 名
   - 进入 TTSSettingsScreen，能看到 zh voice 列表（至少有 compact Tingting）
   - 若模拟器无 premium voice，横幅显示
   - 点"试听"能听到语音；切换 voice 再试听，声音不同
   - 拖动语速滑块，试听语速变化
   - 保存后返回，行右侧 voice 名更新
   - 跑一次 TXT 导入，生成的音频用新 voice + rate
   - 杀进程重启，设置仍在（AsyncStorage 持久化）

### 模拟器限制

iOS 模拟器可能预装较少 voice（通常无 premium），premium 检测横幅几乎必然触发。真机测试才能验证 premium voice 实际效果 -- 这部分由用户验证，Claude 只在模拟器验证流程跑通。

## 依赖与风险

- `AVSpeechSynthesisVoice.quality` 枚举：`AVVoiceQuality` 枚举及其四个值（Default/Compact/Enhanced/Premium）自 iOS 9 起可用。项目当前 deployment target 为 iOS 15.5，满足要求
- `previewVoice` 用 `speak:` 不写文件：与现有 `writeUtterance:` 路径独立，不互相影响
- premium 语音包下载依赖用户手动操作：app 无法自动触发下载，只能引导。这是 iOS 平台限制，无法绕过
- App.js 已 757 行：本次 +15 行可接受，不触发拆分；后续若继续增长可考虑 settings 相关 state 外移
