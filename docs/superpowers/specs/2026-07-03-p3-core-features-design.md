# P3 核心功能设计文档

> 阶段：P3（核心功能）
> 日期：2026-07-03
> 前置：P2 架构改进已合并到 main（commit c1ab8d6）

---

## 1. 目标与范围

### 1.1 目标

为黑胶播放器添加三项核心功能：LRC 歌词时间同步、收藏、最近播放。这些功能让播放器从"能播放"升级到"可用"——歌词跟随音频进度滚动，用户可标记喜爱的歌曲并快速回到最近听过的曲目。

### 1.2 范围内（In Scope）

| # | 功能 | 说明 |
| --- | --- | --- |
| 1 | LRC 歌词同步 | 替换占位歌词为 LRC 格式（带时间戳），歌词按播放进度滚动 |
| 2 | 收藏 | 播放页心形图标标记收藏，持久化到 AsyncStorage |
| 3 | 最近播放 | 歌曲开始播放时自动记录，列表页"最近播放"标签可查看 |
| 4 | 列表过滤标签 | 歌单列表页顶部添加"全部 / 收藏 / 最近播放"三个过滤标签 |

### 1.3 范围外（Out of Scope）

- 搜索（当前仅 3 首示例曲目，搜索价值低；推迟到 P4 扩充曲目后）
- 播放队列管理（涉及 TrackPlayer 队列操作，复杂度高，独立任务）
- LRC 在线获取（P4 扩展来源时考虑）
- 收藏/最近播放的批量管理（清空、多选删除等）
- 主题切换、Android 适配

### 1.4 约束

- 不新增 npm 依赖（`@react-native-async-storage/async-storage` 已在 P2 安装）
- App.js 行数 ≤ 300（P2 后为 243 行，P3 预估 ~290 行）
- 保留 P2 的模块结构（`src/data/`, `src/components/`, `src/screens/`, `src/error/`），不新建顶层目录
- 保留 P1 的所有行为（三态循环、错误处理分层、播放逻辑）
- 验证方式：Metro bundle 构建 + iOS 模拟器人工检查（项目无自动化测试）

---

## 2. 架构概览

### 2.1 方案选择

采用 **方案 A：状态集中在 App.js**。所有新状态（`favorites`、`recent`、`activeTab`）放在 `App` 组件，通过 props 下发给 `PlaylistScreen` 和 `PlayerScreen`。理由：
- 匹配 P2 的现有模式（App.js 作为 orchestrator，props 下发）
- 仅 2 个消费者（PlaylistScreen / PlayerScreen），不值得引入 hook 或 Context 抽象
- App.js 仍在 ≤ 300 行预算内

### 2.2 改动文件

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/data/lrcParser.js` | 新建 | `parseLRC(lrcString)` 导出 LRC 解析器 |
| `src/data/playlist.js` | 修改 | 每首曲目 `lyrics: string[]` → `lrc: string`（LRC 格式文本） |
| `src/components/Lyrics.js` | 修改 | props 从 `({ lines, currentIndex })` → `({ lrc, position })`；内部解析 LRC 并定位当前行 |
| `src/screens/PlayerScreen.js` | 修改 | 顶栏添加心形图标；移除比例 lyricIndex 计算；新增 `isFavorite` + `onToggleFavorite` props |
| `src/screens/PlaylistScreen.js` | 修改 | 添加过滤标签栏（全部/收藏/最近播放）；按标签过滤列表 |
| `App.js` | 修改 | 新增 `favorites`/`recent`/`activeTab` state；启动加载持久化数据；切歌时更新 recent；toggleFavorite handler |
| `src/data/constants.js` | 不改 | — |
| `src/data/storage.js` | 不改 | 已在 P2 提供 `loadJSON`/`saveJSON`，P3 首次消费 |
| `src/error/ErrorBoundary.js` | 不改 | — |
| `src/components/Vinyl.js` | 不改 | — |
| `src/components/Tonearm.js` | 不改 | — |
| `src/components/Controls.js` | 不改 | — |
| `index.js`, `service.js` | 不改 | — |

### 2.3 存储键

P3 首次消费 P2 的 `storage.js`：

| 键 | 格式 | 说明 |
| --- | --- | --- |
| `@mp3player:favorites` | `string[]`（track id 数组） | 用户收藏的曲目 id |
| `@mp3player:recent` | `string[]`（track id 数组） | 最近播放的曲目 id，最新在前，去重，上限 20 |

---

## 3. 详细设计

### 3.1 LRC 解析器（lrcParser.js）

```js
// src/data/lrcParser.js
export function parseLRC(lrc) {
  if (!lrc) return [];
  const lines = lrc.split("\n");
  const result = [];
  const timeRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  for (const line of lines) {
    const times = [...line.matchAll(timeRe)];
    const text = line.replace(timeRe, "").trim();
    if (times.length === 0 || !text) continue;
    for (const m of times) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
      result.push({ time: sec, text });
    }
  }
  result.sort((a, b) => a.time - b.time);
  return result;
}
```

**设计要点：**
- 支持每行多个时间戳（`[00:12.34][01:30.00]副歌` → 两条记录）
- 元数据行（`[ti:...]`, `[ar:...]`）自动过滤——无文本则跳过
- 毫秒字段支持 2-3 位（`[01:23.45]` 和 `[01:23.456]` 都合法）
- 返回值按时间升序排列
- 空输入或全空行返回 `[]`

**查找当前行：**

```js
export function findCurrentIndex(parsed, position) {
  if (parsed.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].time <= position) idx = i;
    else break;
  }
  return idx;
}
```

线性扫描（LRC 行数通常 < 50，无需二分）。返回 `time <= position` 的最后一行索引；若第一行时间已大于 position，返回 -1（显示前奏状态）。

### 3.2 LRC 数据（playlist.js）

每首曲目的 `lyrics: string[]` 字段替换为 `lrc: string`。示例：

```js
{
  id: "1",
  url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "示例音乐 1",
  artist: "SoundHelix",
  artwork: "https://picsum.photos/seed/song1/600/600",
  lrc: `[00:12.34]夜色温柔如水
[00:15.67]音符在指尖流淌
[00:19.00]回忆像风一样
[00:23.50]吹过空荡的街
[00:27.80]我们都在追寻
[00:31.20]那一束微光
[00:35.00]时间停在原地
[00:38.90]听一首老歌`,
}
```

三首曲目均复用现有中文占位歌词文本，添加合理时间戳（起始 ~12 秒，每行间隔 3-4 秒，覆盖歌曲前 ~2 分钟）。时间戳不需要精确匹配 SoundHelix 示例音频的实际节拍——LRC 解析与同步机制是真实的，数据是合理的占位。

### 3.3 Lyrics 组件改造

```jsx
// src/components/Lyrics.js
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { parseLRC, findCurrentIndex } from "../data/lrcParser";

function Lyrics({ lrc, position }) {
  const parsed = useMemo(() => parseLRC(lrc), [lrc]);
  const currentIndex = useMemo(() => findCurrentIndex(parsed, position), [parsed, position]);

  if (parsed.length === 0) {
    return (
      <View style={styles.lyricsContainer}>
        <Text style={styles.emptyText}>暂无歌词</Text>
      </View>
    );
  }

  const visible = [];
  for (let i = -1; i <= 1; i++) {
    const idx = currentIndex + i;
    if (idx >= 0 && idx < parsed.length) {
      visible.push({ idx, text: parsed[idx].text });
    }
  }

  return (
    <View style={styles.lyricsContainer}>
      {visible.map(({ idx, text }) => {
        const isCurrent = idx === currentIndex;
        return (
          <Text key={idx} style={[styles.lyricLine, isCurrent && styles.lyricCurrent]} numberOfLines={1}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}
```

**变化：**
- props: `({ lines, currentIndex })` → `({ lrc, position })`
- 组件内部用 `useMemo` 解析 LRC + 定位当前行（PlayerScreen 不再计算 lyricIndex）
- 无 LRC 数据时显示"暂无歌词"占位
- 3 行窗口视觉与 P2 一致（前一行/当前行/下一行）

### 3.4 收藏功能

#### 3.4.1 State（App.js）

```js
const [favorites, setFavorites] = useState([]); // string[] of track ids
```

#### 3.4.2 加载与持久化

```js
useEffect(() => {
  loadJSON("@mp3player:favorites", []).then(setFavorites);
}, []);
```

#### 3.4.3 Toggle

```js
const toggleFavorite = (id) => {
  setFavorites((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    saveJSON("@mp3player:favorites", next);
    return next;
  });
};
```

`saveJSON` 在 `setFavorites` 的 updater 函数内调用，基于 `next`（而非闭包里的 `prev`）写入，避免 stale-closure。`saveJSON` 静默失败（P2 已实现），存储不可用时不影响内存状态。

#### 3.4.4 UI（PlayerScreen 顶栏）

当前顶栏：`‹` 返回 | 歌曲名 | `⤴` 分享

改造后：`‹` 返回 | 歌曲名 | `♥` 收藏 | `⤴` 分享

```jsx
<TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBackButton}>
  <Text style={[styles.topIcon, { color: isFavorite ? COLORS.accent : COLORS.secondaryText }]}>
    {isFavorite ? "♥" : "♡"}
  </Text>
</TouchableOpacity>
```

复用 P2 已有的 `topBackButton`（40×40 居中容器）和 `topIcon`（图标文字）样式，仅通过内联 `color` 覆盖区分收藏/未收藏状态——不新增样式。

- 收藏：`♥` 红色（COLORS.accent）
- 未收藏：`♡` 灰色（COLORS.secondaryText）

#### 3.4.5 Props 传递

App.js → PlayerScreen 新增：
- `isFavorite`（boolean）— `favorites.includes(currentTrack.id)`
- `onToggleFavorite`（函数）— `toggleFavorite`

### 3.5 最近播放

#### 3.5.1 State（App.js）

```js
const [recent, setRecent] = useState([]); // string[] of track ids, most-recent-first
```

#### 3.5.2 加载

```js
useEffect(() => {
  loadJSON("@mp3player:recent", []).then(setRecent);
}, []);
```

#### 3.5.3 切歌时更新

```js
useEffect(() => {
  if (!currentTrack) return;
  setRecent((prev) => {
    const next = [currentTrack.id, ...prev.filter((id) => id !== currentTrack.id)].slice(0, 20);
    saveJSON("@mp3player:recent", next);
    return next;
  });
}, [currentTrack?.id]);
```

**设计要点：**
- 依赖 `currentTrack?.id`（不是 `currentTrack`），仅在歌曲 id 变化时触发，避免每次 position/playbackState 更新都触发
- 新 id 放数组首位，去重（filter 掉已存在的同名 id），cap 20（slice）
- `saveJSON` 在 updater 内调用，写入基于 `next` 的最新值
- 首次启动 `currentTrack` 为 null（P2 已有），不触发；用户选歌后触发

#### 3.5.4 边界情况

- 首次启动 `recent` 为 `[]`，"最近播放"标签页显示空状态
- 若 `recent` 包含的 id 不在 `playlist` 中（未来 P4 场景），列表渲染时 `.filter(Boolean)` 丢弃，不崩溃；存储中的陈旧 id 保留（P3 不做清理）

### 3.6 列表过滤标签（PlaylistScreen）

#### 3.6.1 标签栏 UI

在 `listHeader`（"播放列表" + "共 N 首"）下方添加一行标签：

```
全部    收藏    最近播放
━━━━━
```

- 当前标签：红色文字（COLORS.accent）+ 下方红色下划线
- 非当前标签：灰色文字（COLORS.secondaryText）
- `onPress` → `onTabChange(tabName)`

#### 3.6.2 Props

App.js → PlaylistScreen 新增：
- `activeTab`（`"all" | "favorites" | "recent"`）
- `onTabChange`（函数）
- `favorites`（`string[]`）
- `recent`（`string[]`）

#### 3.6.3 过滤逻辑

```js
const filtered = useMemo(() => {
  if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
  return playlist;
}, [activeTab, playlist, favorites, recent]);
```

#### 3.6.4 副标题动态

| 标签 | 副标题 |
| --- | --- |
| all | `共 ${playlist.length} 首` |
| favorites | `已收藏 ${filtered.length} 首` |
| recent | `最近播放过 ${filtered.length} 首` |

#### 3.6.5 空状态

`filtered.length === 0` 时不渲染 FlatList，渲染居中提示：
- favorites 标签：`还没有收藏的歌曲`
- recent 标签：`还没有播放记录`
- all 标签永不为空（内置 3 首）

#### 3.6.6 列表项视觉（不变）

- 当前播放高亮（红色标题 + ▶）在所有标签下一致
- 收藏状态不在列表项中显示（心形仅在播放页），避免列表视觉拥挤

### 3.7 App.js 改造汇总

新增：
- `import { loadJSON, saveJSON } from "./src/data/storage";`
- state: `favorites`, `recent`, `activeTab`（默认 `"all"`）
- useEffect: 加载 favorites、加载 recent、切歌更新 recent
- handler: `toggleFavorite(id)`
- PlayerScreen 传入 `isFavorite` + `onToggleFavorite`
- PlaylistScreen 传入 `activeTab` + `onTabChange` + `favorites` + `recent`

移除：
- 无（App.js 不移除任何内容；`lyricIndex` 的 useMemo 在 PlayerScreen 中移除——见 §3.3）

不变：
- `initPlayer`、`togglePlayback`、`skipToNext`、`skipToPrevious`、`seekTo`、`toggleRepeat`、`onSelect`、`onBack`、`retryInit`
- 三态循环、错误处理、ErrorBoundary 包裹
- 7 个顶层 styles

预估行数：243 → ~290（+47 行，≤ 300 预算内）。

---

## 4. 数据流

### 4.1 启动加载

```
App mounts
  → useEffect: loadJSON("@mp3player:favorites", []).then(setFavorites)
  → useEffect: loadJSON("@mp3player:recent", []).then(setRecent)
  → initPlayer()（已有）
  → render: PlaylistScreen with activeTab="all", favorites=[], recent=[]
```

两个 `loadJSON` 并行触发（无 await）。存储加载期间 UI 立即渲染（空数组兜底）；加载完成后 state 更新触发重渲染。

### 4.2 选歌

```
用户点列表项
  → onSelect(index)（已有）
    → TrackPlayer.skip(index) + setCurrentTrack(track)
  → currentTrack?.id 变化
    → recent useEffect 触发 → 加入 recent + saveJSON
  → render: PlayerScreen with isFavorite=favorites.includes(id), onToggleFavorite
```

### 4.3 切换收藏

```
用户点播放页 ♥
  → onToggleFavorite(id)
    → setFavorites(prev => { ...; saveJSON(...); return next; })
  → render: ♥ 颜色翻转（灰 ↔ 红）
```

### 4.4 切换标签

```
用户点"收藏"标签
  → onTabChange("favorites")
    → setActiveTab("favorites")
  → render: PlaylistScreen 用 filtered = playlist.filter(favorites.includes) 渲染
```

---

## 5. 错误处理

- **存储加载失败**：`loadJSON` 返回 `[]`（P2 已实现静默失败）。App 以空收藏/最近播放启动——降级但可用，不阻断 UI。
- **存储保存失败**：`saveJSON` 静默失败（P2 已实现）。内存 state 正确；下次启动不会持久化。不崩溃，不弹错误（收藏是非关键数据，静默失败可接受）。
- **LRC 解析失败**：`parseLRC` 任何错误情况返回 `[]`。Lyrics 组件显示"暂无歌词"占位。不崩溃。
- **LRC 数据缺失**（曲目无 `lrc` 字段）：`parseLRC(undefined)` 返回 `[]`，Lyrics 显示"暂无歌词"。
- **recent 含陈旧 id**（未来 P4 删歌场景）：`.filter(Boolean)` 过滤，不崩溃。存储中的陈旧 id 保留（P3 不清理）。

错误边界（P2 已有）仍包裹整个 App 树，捕获渲染异常。

---

## 6. 验收标准

无自动化测试，验证靠 iOS 模拟器人工检查 + Metro bundle 构建。

### 6.1 LRC 歌词同步

- [ ] 播放歌曲时，歌词随播放进度滚动（当前行高亮）
- [ ] 当前行之前/之后的行以灰色低透明度显示
- [ ] 暂停时歌词停在当前位置
- [ ] 拖动进度条跳转后，歌词立即跳到对应时间
- [ ] 切歌后歌词切换为新曲目内容
- [ ] 无 LRC 数据的曲目显示"暂无歌词"（可选——3 首示例曲目均有 LRC）

### 6.2 收藏

- [ ] 播放页顶栏显示心形图标（`♡` 灰色未收藏 / `♥` 红色已收藏）
- [ ] 点击心形图标切换收藏状态，颜色立即翻转
- [ ] 杀掉 App 重启后，收藏状态保持（AsyncStorage 持久化）
- [ ] 收藏标签页显示已收藏的曲目
- [ ] 取消收藏后，收藏标签页立即移除该曲目

### 6.3 最近播放

- [ ] 播放一首歌后，"最近播放"标签页显示该曲目
- [ ] 最近播放的曲目按时间倒序（最新在前）
- [ ] 重复播放同一首歌不会重复出现在列表中（去重）
- [ ] 杀掉 App 重启后，最近播放列表保持
- [ ] （可选）播放 21 首歌后，列表仍只有 20 首（cap 验证——需 21 首歌，当前仅 3 首，推迟）

### 6.4 列表过滤标签

- [ ] 标签栏显示三个标签：全部 / 收藏 / 最近播放
- [ ] 当前标签红色 + 下划线，非当前标签灰色
- [ ] 点击标签切换列表内容
- [ ] 副标题动态显示对应数量
- [ ] 空状态正确显示（收藏为空时显示"还没有收藏的歌曲"等）
- [ ] 当前播放高亮在所有标签下一致

### 6.5 回归（P1 + P2 行为不回归）

- [ ] 三态循环 off → queue → track → off 正常
- [ ] 播放失败 Alert、跳转边界静默
- [ ] 初始化失败错误页（可选）
- [ ] ErrorBoundary 仍包裹 App
- [ ] Metro bundle 构建无错误
- [ ] App.js 行数 ≤ 300

---

## 7. 风险与备注

### 7.1 风险

| 风险 | 概率 | 缓解 |
| --- | --- | --- |
| LRC 时间戳与 SoundHelix 音频实际节拍不匹配 | 高 | 已知——LRC 机制真实，数据是合理占位；P4 接入真实曲目时替换 |
| `currentTrack?.id` 依赖在首次加载时触发（currentTrack 从 null → 有值） | 中 | 预期行为——首次选歌即加入 recent，合理 |
| AsyncStorage 在 iOS 模拟器首次安装需 pod install | 低 | P2 已完成 pod install，P3 不新增原生模块 |
| App.js 行数超 300 | 低 | 预估 ~290；若超预算，可抽 `useFavorites`/`useRecent` hook（P3.5 或独立任务） |
| recent 含陈旧 id 累积 | 低 | P3 不清理；未来 P4 删歌时统一处理 |

### 7.2 备注

- `storage.js` 的三个函数（`loadJSON`/`saveJSON`/`removeKey`）中，`removeKey` 在 P3 仍无消费者——保留供未来"清空最近播放"等功能使用
- LRC 解析器是纯函数，无副作用，未来可单独加单元测试（项目当前无测试基础设施）
- 收藏/最近播放的持久化是 best-effort——存储不可用时不阻断 UI，与 P2 的 `storage.js` 静默失败策略一致
- 不引入 React Navigation——过滤标签是同一屏幕内的 state 切换，不是屏幕导航

---

## 8. 自检清单

- [x] 无 TBD / TODO / 占位符
- [x] 内部一致：存储键、state 名、props 名、组件签名在各章节统一
- [x] 范围聚焦：仅含 LRC + 收藏 + 最近播放 + 过滤标签，未夹带搜索/队列管理
- [x] 无歧义：LRC 格式、收藏触发、recent 更新时机、标签切换行为均明确
- [x] 与 P2 兼容：保留 P2 的模块结构、存储 API、ErrorBoundary、COLORS 中央化
- [x] 与 P1 兼容：保留三态循环、错误处理分层、播放逻辑
