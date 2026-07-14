# UI 改版设计 - 参考网易云音乐 + 喜马拉雅

**日期:** 2026-07-14
**范围:** 方案 A - 纯视觉换皮(不加新功能)
**当前阶段:** 设计待评审

## 背景

当前 app 是 React Native 黑胶唱片 MP3 播放器,深色主题(#1a1a1a + #C20C0C 红),三个 tab(歌曲/小说/我的),播放器以旋转黑胶 + 唱针为视觉核心。

用户要求参考网易云音乐和喜马拉雅重做一版 UI。

## 设计决策

| 决策点 | 选择 | 原因 |
|---|---|---|
| 范围 | 全量重做(含黑胶) | 用户明确选了"含黑胶" |
| 风格走向 | 混合(歌曲走网易云,小说走喜马拉雅) | 两种内容气质不同,贴合各自使用场景 |
| 配色 | 全亮色 | 用户明确选了"全亮色" |
| 主调色 | 分主调色(歌曲红 #C20C0C / 小说橙 #F86442) | 跟随各自参考 app 的主调,通过 tab 切换 |
| 播放器背景 | 模糊封面背景(沉浸式) | 网易云原版做法,与外部亮色形成对比 |
| 小说布局 | 网格布局(2 列封面) | 喜马拉雅"我的书架"式,封面更直观 |
| 范围方案 | 方案 A - 纯视觉换皮 | 风险最低,一个周期能完成并验证 |

## 不在本期范围

以下功能属于方案 B/C,本期不做,留到后续单独 brainstorm:

- 小说播放器章节列表抽屉(Ximalaya 招牌交互)
- 倍速播放控制
- 睡眠定时
- 歌词左右滑动切歌
- NowPlayingBar 进度条拖动
- 顶部搜索框
- 推荐位 / 每日推荐卡片

注:NowPlayingBar 加一条**只读**细进度条(不可拖动)属于本期范围,因为这是 NetEase 招牌视觉,实现成本极低。

---

## §1 - 配色 & 字体

### 配色(`src/data/constants.js` 的 `COLORS` 重写)

```
// 基础色(全 app 共用)
background:    "#FAF7F2"   // 暖白底(喜马拉雅式米白)
surface:       "#FFFFFF"   // 卡片/列表项背景
separator:     "#0000000F" // 12% 黑,分隔线
primaryText:   "#1A1A1A"   // 主文字
secondaryText: "#8A8A8E"   // 次要文字
tertiaryText:  "#B5B5B8"   // 三级文字(章节计数等)

// 主调色(按 tab 切换)
accent:        "#C20C0C"   // 歌曲 tab / 音乐相关(网易云红)
accentNovel:   "#F86442"   // 小说 tab / OCR 相关(喜马拉雅橙)

// 播放器(沉浸式模糊封面背景上的文字)
playerText:    "#FFFFFF"
playerTextDim: "#FFFFFF99" // 60% 白
```

废弃字段:`vinyl`、`groove`、旧 `background` 值。

### 主调色按 tab 切换机制

App.js 维护派生值 `activeAccent`,根据当前视图上下文决定:

```js
const isNovelContext = view === "player"
  ? (currentTrack?.isNovel || currentTrack?.isOCR)
  : (tab === "novels" || (tab === "mine" && mineSubTab === "ocr"));
const activeAccent = isNovelContext ? COLORS.accentNovel : COLORS.accent;
```

通过 prop 传给所有子组件,而不是每个组件各自 import `COLORS.accent`。影响范围:底部导航高亮色、NowPlayingBar、列表激活态、按钮边框/文字、播放器进度条、播放器控制条激活图标。

播放器视图按 `currentTrack` 的 `isNovel`/`isOCR` 判断(因为播放器是从任意 tab 进入的,tab 状态可能不准);非播放器视图按 `tab` + `mineSubTab` 判断。

### 字体(`TYPO` 常量,加到 `constants.js`)

```
titleLarge:  { fontSize: 28, fontWeight: "700" }  // 屏幕大标题
titleMedium: { fontSize: 17, fontWeight: "600" }  // 卡片标题、模态标题
body:        { fontSize: 15, fontWeight: "600" }  // 列表项主文字
caption:     { fontSize: 12, fontWeight: "400" }  // 章节计数、艺术家
micro:       { fontSize: 10, fontWeight: "600" }  // 角标(OCR)
```

字体族不加(系统默认),只统一字号/字重,替换现在散落各处的魔法数字。

---

## §2 - 底部导航 + NowPlayingBar

### BottomNav(`src/components/BottomNav.js`)

- 背景:`#FFFFFF`,顶部 1px 分隔线用 `separator`
- 图标:Unicode 字符 `♫/▤/☻`(避免新依赖),字号 22
- 激活态颜色按 tab 切换:歌曲=红、小说=橙、我的=红
- 标签字号 11,激活态加粗;非激活态用 `tertiaryText`
- 安全区底部留白:用 `SafeAreaView` 的 `insets.bottom` 处理(目前没处理,会补)
- 删除顶部投影,改用 1px 分隔线

### NowPlayingBar(`src/components/NowPlayingBar.js`)

```
┌──────────────────────────────────────────────┐
│  ┌──┐  歌名(15/600)                        │
│  │📱│  艺术家(12/灰)                         │
│  └──┘                              ▶/⏸      │
│  ────────────────────  (细进度条,主调色)    │
└──────────────────────────────────────────────┘
```

- 卡片:白底、`#0000000D` 投影、圆角 12、左右 8 边距、底部 4 边距
- 封面 40×40(从 48 缩小),圆角 6
- 中间歌名(15/600 黑)+ 艺术家(12/灰),双行
- 右侧播放/暂停图标(▶/⏸)用 Unicode,主调色
- 底部 1.5px 细进度条,跨整张卡片宽度,用 `position/duration` 算百分比,主调色填充
- 删除 "正在播放" label
- 卡片主调色按当前 track 的 `isNovel`/`isOCR` 判断:小说/OCR 章节用橙,其它用红

新增 prop:`position`、`duration`、`isPlaying`(用于进度条和播放/暂停图标切换)。

---

## §3 - 歌曲 tab

### SongsScreen(`src/screens/SongsScreen.js`)

```
歌曲                          (28/700, 黑)
3 首                          (12, 灰)
─────────────────────────────
[列表...]
```

- 大标题 28/700 黑,左对齐,padding 24
- 副标题 "X 首"(12,灰),紧贴大标题下方
- 大标题上方留出 iOS 状态栏高度(App.js 已包 SafeAreaView,padding 调整即可)

### TrackList(`src/components/TrackList.js`)

```
┌──────────────────────────────────────────┐
│  ┌────┐  歌名(15/600,黑)        ▶  │
│  │🎵 │  艺术家(12,灰)               │
│  │    │  [OCR]                       │
│  └────┘                                  │
└──────────────────────────────────────────┘
   48×48  圆角 8                          主调色
```

- 封面 48×48,圆角 8(从 6 加大)
- 行 padding:左右 16(从 24 减),上下 10
- 主文字 15/600 黑;激活态变主调色
- 艺术家 12 灰
- OCR 角标:背景 `#0000000D`(灰底),文字主调色,圆角 3,padding 4/2(原红底白字太抢眼)
- 激活态右侧 ▶ 改成竖向波形小图标(Unicode `▍▍▍` 模拟),主调色
- 分隔线:`marginLeft: 80`,颜色 `separator`
- `scrollToIndex` 逻辑保留不动

新增 prop:`accentColor`(由父组件按 tab 传入)。

---

## §4 - 小说 tab + NovelDetail

### NovelsScreen(`src/screens/NovelsScreen.js`)- 改为 2 列网格

```
小说                          (+)
3 本
─────────────────────────────
┌─────────┐  ┌─────────┐
│         │  │         │
│  封面   │  │  封面   │
│         │  │         │
└─────────┘  └─────────┘
书名(14/600)  书名(14/600)
12 章 · OCR    8 章
```

- 顶部标题 28/700 黑 + 副标题 "X 本"(12,灰),右侧 `+` 按钮 32×32 圆形,主调色边框(橙)
- `FlatList numColumns={2}`,列间距 12,行间距 16,左右 padding 16
- 封面:`aspectRatio: 1`(正方形),圆角 8,背景 `#0000000D` 占位
- 封面下方:书名 14/600 黑(最多 1 行,省略号),副信息 12 灰("X 章",OCR 书加 " · OCR")
- 正在播放的封面:左下角加橙色播放图标徽章(白底+橙图标,8px 圆角)
- 空状态:"还没有有声书" 居中,16 灰
- 长按删除(OCR 书)逻辑保留

### NovelDetailScreen(`src/screens/NovelDetailScreen.js`)

```
‹  书名                        ⋯
─────────────────────────────
┌────┐  书名(20/700)
│封面│  12 章 · 已读 3 章
└────┘  [▶ 播放]   [+ 添加章节]
─────────────────────────────
章节
─────────────────────────────
[列表] 第1章 标题            ▶
       第2章 标题
       第3章 标题  (橙色=正在播)
```

- 顶栏:左 `‹` 返回,中间书名(15/600,居中),右 `⋯` 菜单(OCR 书显示,弹删除/添加章节;非 OCR 书隐藏)
- 顶部信息块:左封面 96×96 圆角 8,右侧书名 20/700 + 副信息 12 灰(章节数 / 已读数)
- 两个按钮:播放(橙底白字,圆角 20)、添加章节(透明橙边框,圆角 20)
- "章节" 标题 17/600 黑,padding 16
- 章节列表:NovelDetailScreen 自己用 FlatList + `renderChapter` 渲染(不复用 TrackList,因为章节项无封面、有章节号,跟歌曲列表项差异大)。章节号 + 章节标题,激活态橙色,分隔线缩进 16

---

## §5 - 两个播放器

### 文件结构变化

```
src/screens/
  PlayerScreen.js        -> 删除(逻辑搬到 App.js 的 view 选择)
  SongsPlayerScreen.js   -> 新增(圆形旋转封面 + 歌词)
  NovelsPlayerScreen.js  -> 新增(方形封面 + 章节信息)

src/components/
  Vinyl.js               -> 删除(圆形封面替代)
  Tonearm.js             -> 删除(不再有唱针)
```

App.js 里 `view === "player"` 时,根据 `currentTrack.isNovel || currentTrack.isOCR` 选择渲染哪个播放器。

### 共用元素(两个播放器都有)

- 背景:专辑封面模糊放大版 + 半透明黑色蒙层(70% 黑)。用 `ImageBackground` + `blurRadius={80}` + 黑色 `View` overlay
- 文字:白色主文字,`playerTextDim` 次文字
- 顶栏:左 `‹` 返回、中间标题(15/600 白)、右 `♡`/`♥` 收藏图标
- 进度条:`ProgressBar` 改成白色轨道 + 主调色填充(歌曲红、小说橙),滑块白色圆形
- 控制条:`Controls` 改成白色图标,重复模式图标用主调色高亮
- 歌词(仅歌曲播放器):`Lyrics` 文字白色,当前行加粗 + 60% 白色(其它行 30% 白)

### SongsPlayerScreen

```
‹  歌名                    ♡

      ┌───────────────┐
      │   🎵 专辑封面  │  ← 圆形,旋转
      └───────────────┘

      艺术家(14/白/60%)

   [歌词当前行]
   [歌词下一行]

───────────────────────────
00:32  ━━●━━━━━━━━  03:45
───────────────────────────
    ⏮  ⏯  ⏭   🔁
```

- 封面 280×280,圆形(borderRadius 140),复用现有 `spin` Animated.Value,中间是专辑封面
- 删除 `Tonearm` 唱针组件
- 删除 `Vinyl` 组件(被圆形封面替代)
- 歌词区在封面下方,3 行可见(当前行 + 上一行 + 下一行)
- 进度条左右时间标签 11/白/60%

### NovelsPlayerScreen

```
‹  第3章 标题              ⋯

   ┌─────────────┐
   │   📖 封面    │  ← 方形,圆角 12,不旋转
   └─────────────┘

   书名(17/700/白)
   第3章 / 共12章(12/白/60%)

───────────────────────────
00:32  ━━●━━━━━━━━  23:45
───────────────────────────
⏮  ⏯  ⏭   🔁
```

- 封面 240×240,方形圆角 12,静态(不旋转)
- 封面下方:书名 17/700 白,章节进度 "第N章 / 共M章" 12/白/60%
- 进度条同歌曲
- 控制条 4 个按钮:`⏮ ⏯ ⏭ 🔁`(省掉 `1.0×` 和 `⏰` 占位 - YAGNI)
- 没有 `Tonearm`、`Vinyl`、`Lyrics`(小说没有歌词)

### 新增常量(`constants.js`)

```
PLAYER_COVER_SIZE_SONG: 280
PLAYER_COVER_SIZE_NOVEL: 240
```

---

## §6 - 我的 tab + 设置 + OCR 屏幕

### MineScreen(`src/screens/MineScreen.js`)

```
我的                                  ⚙ 设置
─────────────────────────────────────
收藏   最近播放   导入音乐   OCR 小说
─────                              (橙色下划线 = OCR tab)
─────────────────────────────────────
[+ 导入音乐]  (仅 "导入音乐" tab 显示)

[列表/网格...]
```

- 顶栏:左侧 "我的" 28/700 黑,右侧 ⚙ 设置图标(32×32,点击进 SettingsScreen),替代现在的 "设置" 文字按钮
- 子 tab 条:`收藏 / 最近播放 / 导入音乐 / OCR 小说`,字号 14,激活态加粗 + 下划线
- 前 3 个子 tab 下划线用红,`OCR 小说` 子 tab 下划线用橙
- 子 tab 之间间距 24,左对齐 padding 16
- "导入音乐" 按钮改成胶囊形:红底白字(主调色),圆角 20,padding 10/16
- 前 3 个子 tab 用 TrackList(已经是新版样式)
- `OCR 小说` 子 tab 用列表:每行封面 48×48 + 书名 + 章节数 + 删除按钮。封面圆角 6,主调色边框/文字用橙
- 空状态:"还没有..." 居中,16 灰

### SettingsScreen(`src/screens/SettingsScreen.js`)

```
‹  设置

  清除缓存                    >
  版本                        1.0.0
```

- 顶栏:左 `‹` 返回,中间 "设置" 17/600 黑
- 列表项:白底卡片(圆角 12,左右 16 边距,项之间间距 8),每项 padding 16,左右布局
- "清除缓存" 行:左侧 15/600 黑,右侧 `>` 箭头(灰),点击触发现有 onClearCache 逻辑
- "版本" 行:左侧 15/600 黑,右侧 "1.0.0" 灰
- 删除 `onShowPlayer` 入口(从设置进播放器这个路径很奇怪,NowPlayingBar 已经能进)

### OcrImportScreen / OcrChapterEditScreen

工具型界面,做最小改动:

- 背景从 `#1a1a1a` 改成 `#FAF7F2`
- 文字从白改黑,次要文字改灰
- 按钮主调色用橙(小说相关流程)
- 顶栏返回按钮、标题样式跟其他屏幕对齐(17/600 黑)
- 不重构布局,只换色

### App.js 顶层

- `styles.container` 的 `backgroundColor` 改成新的 `COLORS.background`(#FAF7F2 暖白)
- `glowTop`(顶部 5% 透明度红色光晕)删除--亮色主题下不需要
- 错误页/加载页文字颜色跟着改

---

## 文件改动总览

### 新增
- `src/screens/SongsPlayerScreen.js`
- `src/screens/NovelsPlayerScreen.js`

### 删除
- `src/screens/PlayerScreen.js`
- `src/components/Vinyl.js`
- `src/components/Tonearm.js`

### 修改
- `src/data/constants.js`(COLORS 重写 + TYPO 新增 + PLAYER_COVER_SIZE_* + activeAccent 派生逻辑放 App.js)
- `src/components/BottomNav.js`(亮色 + 主调色切换 + 安全区)
- `src/components/NowPlayingBar.js`(白卡片 + 进度条 + 主调色切换)
- `src/components/TrackList.js`(亮色 + 主调色 prop)
- `src/components/BookCover.js`(亮色占位)
- `src/components/Controls.js`(白色图标 + 主调色高亮)
- `src/components/ProgressBar.js`(白色轨道 + 主调色填充)
- `src/components/Lyrics.js`(白色文字)
- `src/components/CreateEmptyBookModal.js`(亮色)
- `src/screens/SongsScreen.js`(亮色 + TYPO)
- `src/screens/NovelsScreen.js`(亮色 + 网格布局)
- `src/screens/NovelDetailScreen.js`(亮色 + 章节列表样式)
- `src/screens/MineScreen.js`(亮色 + 设置图标 + OCR 橙色)
- `src/screens/SettingsScreen.js`(亮色 + 卡片列表)
- `src/screens/OcrImportScreen.js`(亮色换色)
- `src/screens/OcrChapterEditScreen.js`(亮色换色)
- `App.js`(container 颜色 + glowTop 删除 + view 选择逻辑拆分两个播放器 + activeAccent 派生)

---

## 验证计划

按照 [[mp3-player-verification-method]]:

1. **Metro bundle 构建**:`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` -- 捕获 import 错误、语法错误、缺失模块
2. **iOS 模拟器手动验证**(用户驱动,不可自动化):
   - 歌曲 tab:列表显示、激活态、点击进播放器、圆形封面旋转、歌词滚动、进度条、控制条
   - 小说 tab:网格显示、点击进详情、章节列表、点击进播放器、方形封面、章节进度
   - 我的 tab:4 个子 tab 切换、收藏/最近/导入音乐列表、OCR 小说列表、导入音乐按钮、设置入口
   - 设置:清除缓存、版本号
   - 播放器:沉浸式背景、收藏图标、返回按钮、两个播放器分别正确切换
   - 主调色:歌曲红 / 小说橙 在各 tab 切换时正确显示

不运行 `npm test`(项目无测试套件,`npm test` 退出码 1 是预期)。

## 执行方式

按照 [[mp3-player-workflow-preferences]],默认采用 Subagent-Driven Development + 合并到 main(本地,--no-ff)。在执行前仍会通过 AskUserQuestion 确认。
