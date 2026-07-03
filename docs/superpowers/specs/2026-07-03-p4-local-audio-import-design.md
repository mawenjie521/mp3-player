# P4 本地音频导入设计文档

> 阶段：P4（扩展来源）
> 日期：2026-07-03
> 前置：P3 核心功能已合并到 main（commit 3c8e9c4）

---

## 1. 目标与范围

### 1.1 目标

为黑胶播放器添加本地音频导入功能：用户通过 iOS 文件选择器选取 MP3 文件，文件复制到 app 沙盒，曲目加入播放列表并可正常播放。导入的曲目持久化，重启后保留。这让播放器从"仅 3 首示例曲目"扩展到"用户自己的音乐库"。

### 1.2 范围内（In Scope）

| # | 功能 | 说明 |
| --- | --- | --- |
| 1 | 文件选择 | Document Picker 选取 MP3 文件（`audio/mpeg`） |
| 2 | 文件复制 | RNFS 将文件复制到 app 的 Documents 目录 |
| 3 | 曲目构建 | 文件名解析为标题，构建 Track 对象 |
| 4 | 持久化 | 导入曲目存 AsyncStorage，重启后加载 |
| 5 | 队列同步 | 导入曲目追加到 TrackPlayer 队列 |
| 6 | "我的音乐"标签 | PlaylistScreen 新增第 4 个过滤标签 |
| 7 | 导入按钮 | "我的音乐"标签页内的"导入音乐"按钮 + 空状态 |

### 1.3 范围外（Out of Scope）

- 批量导入（一次选多个文件）—— 推迟，当前单文件导入
- 删除导入曲目 —— 推迟到 P5
- ID3 标签提取（标题/艺术家/封面）—— 用文件名解析替代
- 非 MP3 格式（M4A/WAV/FLAC）—— DocumentPicker 过滤 `audio/mpeg`，可扩展
- 文件存在性检查（重装后清理失效条目）—— 已知限制，playback-error Alert 兜底
- 歌词关联（导入曲目的 LRC 获取）—— 推迟
- Android 适配 —— iOS 优先

### 1.4 约束

- 新增 2 个 npm 依赖：`react-native-document-picker`、`react-native-fs`（需 `pod install`）
- App.js 行数 ≤ 300（P3 后 278 行，P4 预估 ~299 行）
- 保留 P2 模块结构（`src/data/`, `src/components/`, `src/screens/`, `src/error/`）
- 保留 P1/P3 行为（三态循环、错误处理分层、收藏、最近播放、LRC 同步、过滤标签）
- 验证方式：Metro bundle 构建 + iOS 模拟器人工检查（项目无自动化测试）

---

## 2. 架构概览

### 2.1 方案选择

采用 **方案 A：统一播放列表 + 来源标记**。App.js 将内置 `playlist`（3 首 SoundHelix）与 `importedTracks`（导入）合并为 `allTracks`，导入曲目带 `isImported: true` 标记。理由：
- 收藏/最近播放自然跨来源工作（一首歌就是一首歌，id 唯一即可）
- 单一数据源，PlaylistScreen 的过滤逻辑统一
- 与 P3 标签 UI 一致——"我的音乐"标签仅是 `allTracks.filter(t => t.isImported)`
- TrackPlayer 队列顺序 = `allTracks`，`onSelect(playlist.indexOf(item))` 不破坏

### 2.2 改动文件

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/data/importedTracks.js` | 新建 | `loadImported()`、`pickAndCopyTrack()` —— 文件选择 + 复制 + 构建 Track |
| `App.js` | 修改 | `importedTracks` state + `allTracks` memo + 加载/队列 effect + `handleImport` + 传 `onImport` 给 PlaylistScreen |
| `src/screens/PlaylistScreen.js` | 修改 | TABS 加第 4 项"我的音乐"；过滤加 `isImported` 分支；导入按钮栏 + 空状态文案 |
| `src/data/playlist.js` | 不改 | 内置 3 首曲目不变（无 `isImported` 字段，undefined → falsy） |
| `src/data/storage.js` | 不改 | 复用 `loadJSON`/`saveJSON` |
| `src/data/lrcParser.js` | 不改 | — |
| `src/components/*` | 不改 | Vinyl/Tonearm/Lyrics/Controls 不变 |
| `src/screens/PlayerScreen.js` | 不改 | — |
| `src/error/ErrorBoundary.js` | 不改 | — |

### 2.3 存储键

P4 新增第 3 个存储键（P3 已有 favorites、recent）：

| 键 | 格式 | 说明 |
| --- | --- | --- |
| `@mp3player:imported` | `Track[]`（完整对象数组） | 导入的曲目，含 id/url/title/artist/artwork/lrc/isImported |

### 2.4 新增依赖

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `react-native-document-picker` | latest | iOS 文件选择器，过滤 `audio/mpeg` |
| `react-native-fs` | latest | 文件系统操作，`copyFile` 复制到 Documents 目录 |

安装后需 `cd ios && pod install`。两个库均含原生模块。

---

## 3. 详细设计

### 3.1 importedTracks 模块（`src/data/importedTracks.js`）

```js
import RNFS from "react-native-fs";
import DocumentPicker from "react-native-document-picker";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:imported";

export async function loadImported() {
  return loadJSON(STORAGE_KEY, []);
}

export async function pickAndCopyTrack() {
  const result = await DocumentPicker.pick({
    type: ["audio/mpeg"],
  });
  const { uri: pickerUri, name } = result[0];

  const timestamp = Date.now();
  const filename = `imported-${timestamp}.mp3`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.copyFile(pickerUri, destPath);

  const title = (name || "")
    .replace(/\.mp3$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "未知曲目";

  return {
    id: `imported-${timestamp}`,
    url: `file://${destPath}`,
    title,
    artist: "导入",
    artwork: `https://picsum.photos/seed/imported-${timestamp}/600/600`,
    lrc: "",
    isImported: true,
  };
}

export function persistImported(tracks) {
  return saveJSON(STORAGE_KEY, tracks);
}
```

**设计要点：**
- `loadImported()` —— 启动时从 AsyncStorage 加载，返回 `Track[]`（空数组兜底）
- `pickAndCopyTrack()` —— 调 DocumentPicker + RNFS.copyFile，返回单个 `Track` 对象（不持久化、不更新 state——交给 App.js）
- `persistImported(tracks)` —— 持久化完整数组（App.js 在 state updater 内调用）
- 文件名解析：去 `.mp3` 扩展名，`-`/`_` 替换为空格，trim；空则"未知曲目"
- `url` 用 `file://` 前缀 + 绝对路径，TrackPlayer 支持本地文件
- `artwork` 用 picsum 占位（unique seed），与内置曲目视觉一致
- `lrc: ""` —— 导入曲目无歌词，Lyrics 组件显示"暂无歌词"（P3 已实现的空状态）
- 用户取消选择器时，`DocumentPicker.pick` 抛错（含 "cancel"），由 App.js 的 `handleImport` catch

### 3.2 Track 对象对比

| 字段 | 内置曲目（playlist.js） | 导入曲目 |
| --- | --- | --- |
| `id` | `"1"` / `"2"` / `"3"` | `"imported-<timestamp>"` |
| `url` | `https://www.soundhelix.com/...` | `file://<Documents>/imported-<ts>.mp3` |
| `title` | "示例音乐 N" | 文件名去 `.mp3` |
| `artist` | "SoundHelix" | "导入" |
| `artwork` | picsum URL | picsum URL（unique seed） |
| `lrc` | LRC 格式文本 | `""`（空） |
| `isImported` | 无（undefined → falsy） | `true` |

### 3.3 App.js 改造

**新增 import：**
```js
import { loadImported, pickAndCopyTrack, persistImported } from "./src/data/importedTracks";
```

**新增 state + memo：**
```js
const [importedTracks, setImportedTracks] = useState([]);
const allTracks = useMemo(() => [...playlist, ...importedTracks], [importedTracks]);
const importedAddedRef = useRef(false);
```

**加载 + 队列同步 effect：**
```js
useEffect(() => {
  loadImported().then(setImportedTracks);
}, []);

useEffect(() => {
  if (isPlayerInitialized && importedTracks.length > 0 && !importedAddedRef.current) {
    importedAddedRef.current = true;
    TrackPlayer.add(importedTracks);
  }
}, [isPlayerInitialized, importedTracks]);
```

ref 守卫确保导入曲目只在启动时追加一次到队列（避免 handleImport 新增时重复追加）。

**handleImport handler：**
```js
const handleImport = async () => {
  try {
    const track = await pickAndCopyTrack();
    setImportedTracks((prev) => {
      const next = [...prev, track];
      persistImported(next);
      return next;
    });
    await TrackPlayer.add([track]);
  } catch (e) {
    const msg = (e && e.message) || "";
    if (msg.includes("cancel") || msg.includes("Cancel")) return;
    Alert.alert("导入失败", "无法导入此文件");
  }
};
```

- `persistImported` 在 `setImportedTracks` updater 内调用（P3 模式，避免 stale-closure）
- 用户取消选择器：静默返回（错误消息含 "cancel"）
- 其他失败：Alert 提示

**PlaylistScreen 传 prop：**
```jsx
<PlaylistScreen
  playlist={allTracks}          // 改：原 playlist → allTracks
  currentTrack={currentTrack}
  onSelect={onSelect}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  favorites={favorites}
  recent={recent}
  onImport={handleImport}       // 新增
/>
```

**不变：**
- PlayerScreen 传 props 不变（currentTrack 已是 allTracks 中的对象）
- `onSelect` 逻辑不变（`TrackPlayer.skip(index)` + `setCurrentTrack`），index 现在是 allTracks 中的位置

### 3.4 PlaylistScreen 改造

**TABS 加第 4 项：**
```js
const TABS = [
  { key: "all", label: "全部" },
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
  { key: "imported", label: "我的音乐" },
];
```

**props 签名加 `onImport`：**
```js
function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent, onImport }) {
```

**过滤逻辑加 `isImported` 分支：**
```js
const filtered = useMemo(() => {
  if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
  if (activeTab === "imported") return playlist.filter((t) => t.isImported);
  return playlist;
}, [activeTab, playlist, favorites, recent]);
```

**副标题动态：**
```js
const subtitle = useMemo(() => {
  if (activeTab === "favorites") return `已收藏 ${filtered.length} 首`;
  if (activeTab === "recent") return `最近播放过 ${filtered.length} 首`;
  if (activeTab === "imported") return `已导入 ${filtered.length} 首`;
  return `共 ${playlist.length} 首`;
}, [activeTab, filtered.length, playlist.length]);
```

**导入按钮栏（仅"我的音乐"标签显示）：**

在 tabBar 与列表/空状态之间插入：
```jsx
{activeTab === "imported" && (
  <View style={styles.importBar}>
    <TouchableOpacity onPress={onImport} style={styles.importButton}>
      <Text style={styles.importButtonText}>+ 导入音乐</Text>
    </TouchableOpacity>
  </View>
)}
```

**空状态文案扩展：**
```js
const emptyText = activeTab === "favorites"
  ? "还没有收藏的歌曲"
  : activeTab === "recent"
  ? "还没有播放记录"
  : "还没有导入音乐";
```

导入按钮栏在空状态时仍显示（用户可直接点导入）。

**新增样式：**
```js
importBar: {
  paddingHorizontal: 24,
  paddingBottom: 8,
},
importButton: {
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: COLORS.accent,
  alignSelf: "flex-start",
},
importButtonText: {
  color: COLORS.accent,
  fontSize: 14,
  fontWeight: "600",
},
```

### 3.5 列表项视觉（不变）

- 缩略图、标题、艺术家、当前播放高亮在所有标签下一致
- 导入曲目的 artwork 是 picsum 占位，视觉与内置曲目无差别
- 导入曲目无 `▶` 当前播放标记差异（同一逻辑）

---

## 4. 数据流

### 4.1 启动加载

```
App mounts
  → initPlayer()（已有，加内置 playlist）
  → loadImported().then(setImportedTracks)
  → [isPlayerInitialized && importedTracks.length > 0 && !importedAddedRef.current]
    → importedAddedRef.current = true
    → TrackPlayer.add(importedTracks)
  → render: PlaylistScreen with allTracks = [...playlist, ...importedTracks]
```

两个异步操作（initPlayer、loadImported）独立进行。ref 守卫确保导入曲目在两个条件都满足后追加一次。

### 4.2 导入

```
用户在"我的音乐"标签点"导入音乐"
  → handleImport()
    → pickAndCopyTrack()
      → DocumentPicker.pick({ type: [audio] })
        → 用户选文件 → 返回 { uri, name }
        → 用户取消 → 抛错（含 "cancel"）→ catch 静默返回
      → RNFS.copyFile(pickerUri, Documents/imported-<ts>.mp3)
      → 构建 Track 对象
    → setImportedTracks(prev => { next = [...prev, track]; persistImported(next); return next; })
    → TrackPlayer.add([track])
  → render: "我的音乐"标签显示新曲目
```

### 4.3 播放导入曲目

```
用户在"我的音乐"（或"全部"）标签点导入曲目
  → onSelect(allTracks.indexOf(item))  // 索引 = 内置3 + 导入N 中的位置
  → TrackPlayer.skip(index) + play()
  → 播放 file:// URI
  → currentTrack?.id 变化 → recent useEffect 触发（P3 已有）
```

### 4.4 切换标签

```
用户点"我的音乐"标签
  → onTabChange("imported")
  → render: 导入按钮栏 + allTracks.filter(t => t.isImported)
```

---

## 5. 错误处理

| 场景 | 行为 |
| --- | --- |
| 用户取消选择器 | `DocumentPicker.pick` 抛错（含 "cancel"），`handleImport` catch 静默返回，无 Alert |
| 文件复制失败（RNFS.copyFile） | `pickAndCopyTrack` 抛错，`handleImport` catch → `Alert.alert("导入失败", "无法导入此文件")` |
| 播放导入曲目失败（文件丢失/损坏） | P1 的 `playback-error` 监听器兜底 → `Alert.alert("播放失败", "当前歌曲无法播放，是否跳到下一首？")` |
| AsyncStorage 加载失败 | `loadJSON` 静默返回 `[]`（P2 模式），降级为无导入曲目，不阻断 UI |
| AsyncStorage 保存失败 | `saveJSON` 静默失败（P2 模式），内存 state 正确，下次启动不持久化 |
| app 重装后 `file://` 路径失效 | `playback-error` Alert 兜底（已知限制，存储条目不自动清理——P5 候选） |
| TrackPlayer 队列追加失败 | `TrackPlayer.add` 异步错误未捕获（罕见），不影响内置曲目播放 |

错误边界（P2 已有）仍包裹整个 App 树，捕获渲染异常。

---

## 6. 验收标准

无自动化测试，验证靠 iOS 模拟器人工检查 + Metro bundle 构建。

### 6.1 文件选择与导入

- [ ] "我的音乐"标签显示在标签栏（第 4 项）
- [ ] 点"导入音乐"→ iOS 文件选择器打开
- [ ] 选择 MP3 文件 → 文件复制 → 曲目出现在"我的音乐"列表
- [ ] 文件名解析为标题（去 `.mp3`，`-`/`_` 替换为空格）
- [ ] 用户取消选择器 → 无错误提示，返回"我的音乐"标签
- [ ] 复制失败 → 显示"导入失败"Alert

### 6.2 播放导入曲目

- [ ] 导入的曲目可正常播放（唱片旋转、唱针落下、进度条推进）
- [ ] 导入曲目的歌词区显示"暂无歌词"
- [ ] 导入曲目可被收藏（心形图标切换）
- [ ] 导入曲目播放后出现在"最近播放"标签
- [ ] 导入曲目在"全部"标签可见

### 6.3 持久化

- [ ] 杀掉 App 重启 → 导入曲目保留在"我的音乐"标签
- [ ] 重启后导入曲目可正常播放（file:// 路径有效）
- [ ] 收藏/最近播放状态对导入曲目保持

### 6.4 UI 一致性

- [ ] 4 个标签切换正确（全部/收藏/最近播放/我的音乐）
- [ ] "我的音乐"标签副标题显示"已导入 N 首"
- [ ] 空状态："还没有导入音乐" + 导入按钮可见
- [ ] 导入按钮仅在"我的音乐"标签显示
- [ ] 列表项视觉（缩略图、标题、艺术家、当前播放高亮）在所有标签一致

### 6.5 回归（P1/P2/P3 行为不破坏）

- [ ] 三态循环 off → queue → track → off 正常
- [ ] 播放失败 Alert、跳转边界静默
- [ ] ErrorBoundary 仍包裹 App
- [ ] LRC 歌词同步正常（内置曲目）
- [ ] 收藏/最近播放/过滤标签正常（内置曲目）
- [ ] Metro bundle 构建无错误
- [ ] App.js 行数 ≤ 300

---

## 7. 风险与备注

### 7.1 风险

| 风险 | 概率 | 缓解 |
| --- | --- | --- |
| TrackPlayer 不支持 `file://` URI | 低 | react-native-track-player 官方支持本地文件；如失败，playback-error Alert 兜底 |
| RNFS.copyFile 对某些 picker URI 格式失败 | 中 | catch → Alert 提示"导入失败" |
| App.js 行数超 300（P3 后 278 + ~21 = ~299） | 中 | 紧贴预算；若超，将 `handleImport` 的 try/catch + `TrackPlayer.add` 移入模块，App.js 仅调 `handleImport()` 一行 |
| iOS 容器路径重装后变化 | 低 | 已知限制；playback-error Alert 兜底；P5 可加 `RNFS.exists` 文件存在性检查，清理失效条目 |
| `pod install` 后构建问题 | 低 | 两个库都是成熟 RN 库；构建失败则排查依赖版本 |
| DocumentPicker.types.audio 在某些 iOS 版本过滤不严格 | 低 | 用户选非 MP3 时，TrackPlayer 播放失败 → playback-error Alert 兜底 |

### 7.2 备注

- `persistImported` 函数封装 `saveJSON`，保持模块内聚（存储键 `@mp3player:imported` 仅在此模块引用）
- `importedAddedRef` 守卫确保启动时导入曲目只追加一次到 TrackPlayer 队列；`handleImport` 新增的单首曲目单独 `TrackPlayer.add([track])`
- 导入曲目的 `id` 用 `imported-<timestamp>` 保证唯一性（与内置 `"1"/"2"/"3"` 不冲突）
- `allTracks` 是 `useMemo`，`importedTracks` 变化时重算；`playlist` 是静态导入，引用稳定
- 不引入 React Navigation——"我的音乐"是同一屏幕内的 state 切换，不是屏幕导航
- `react-native-document-picker` 在 iOS 上无需特殊 Info.plist 权限（用户主动选文件，非扫描媒体库）

### 7.3 App.js 行数预算

P3 后 App.js 278 行。P4 新增：
- `import { loadImported, pickAndCopyTrack, persistImported }` —— 1 行
- `importedTracks` state —— 1 行
- `allTracks` memo —— 1 行
- `importedAddedRef` —— 1 行
- 加载 effect —— 3 行
- 队列同步 effect —— 5 行
- `handleImport` —— 12 行
- `onImport` prop —— 1 行
- `playlist={allTracks}` 改动 —— 0 行（原行替换）

合计 ~25 行。278 + 25 = ~303 行，略超预算。

**缓解：** 若超 300，将 `handleImport` 的 try/catch + `TrackPlayer.add` 逻辑移入 `importedTracks.js` 的 `pickAndImportTrack()` 函数（模块内完成 pick + copy + persist + queue-add），App.js 仅调 `const track = await pickAndImportTrack(); setImportedTracks(prev => [...prev, track]);`（~5 行）。这样 App.js 降至 ~290 行。

---

## 8. 自检清单

- [x] 无 TBD / TODO / 占位符
- [x] 内部一致：存储键、state 名、props 名、组件签名在各章节统一
- [x] 范围聚焦：仅含本地音频导入 + "我的音乐"标签，未夹带批量导入/删除/ID3/搜索
- [x] 无歧义：文件选择机制、复制流程、持久化时机、队列同步、错误分支均明确
- [x] 与 P3 兼容：保留过滤标签 UI（加第 4 项）、收藏/最近播放跨来源工作、saveJSON 在 updater 内调用
- [x] 与 P2 兼容：保留模块结构、storage.js API、ErrorBoundary、COLORS 中央化
- [x] 与 P1 兼容：保留三态循环、错误处理分层、播放逻辑
- [x] 行数预算有缓解方案（超 300 时移 handleImport 入模块）
