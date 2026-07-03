# P1 缺陷修复设计文档

> 阶段：P1（修复现有缺陷）
> 日期：2026-07-03
> 关联：`docs/requirements.md` 第 5 节"已知限制与待办"

---

## 1. 目标与范围

### 1.1 目标

修复 MP3 黑胶播放器现有功能中的三类缺陷，使基线功能行为正确，为后续 P2（架构改进）、P3（核心功能）、P4（扩展来源）打牢基础。

### 1.2 范围内（In Scope）

| # | 缺陷 | 修复方式 |
| --- | --- | --- |
| 1 | 循环模式未生效 | 扩展为三态循环（off/queue/track），对接 `TrackPlayer.setRepeatMode` |
| 2 | 列表图标 `☰` 无响应 | 移除 Controls 中该项 |
| 3 | 无错误处理 | 分层处理：初始化失败/播放失败/跳转边界 |

### 1.3 范围外（Out of Scope）

- 歌词 LRC 真实同步（推迟到 P3 或独立任务）
- App.js 模块拆分（P2）
- 自动化测试基础设施（P2）
- 新功能（收藏、搜索、队列管理等，P3）
- 本地音频导入、在线歌单（P4）

### 1.4 约束

- 不新增 npm 依赖
- 不新增文件，所有改动限制在 `App.js`（必要时少量改 `service.js`）
- 不改变现有视觉风格（色彩、尺寸、动画时长）
- 保留现有播放逻辑（init/toggle/skip/seek）的接口形状，只扩展不重写

---

## 2. 架构概览

### 2.1 改动文件

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `App.js` | 修改 | 循环状态扩展、Controls 删 `☰`、错误状态与处理、PlayerScreen 加错误 UI |
| `service.js` | 不改 | 远程控制事件保持不变；`playback-error` 在组件内监听 |

### 2.2 方案选择

采用 **方案 A：最小改动**。所有修改限制在 `App.js` 内，不抽 hook、不拆模块。理由：
- P1 目标是"把基线修对"，架构改进是 P2 的事
- 改动集中易审查，与现有单文件模式一致
- 避免为后续 P2 重构埋入可能返工的抽象

---

## 3. 详细设计

### 3.1 循环模式（三态循环）

#### 3.1.1 状态变更

**旧**：
```js
const [loopOn, setLoopOn] = useState(false);
```

**新**：
```js
const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'queue' | 'track'
```

#### 3.1.2 切换逻辑

三态循环顺序：`off → queue → track → off`

```js
import TrackPlayer, { RepeatMode } from "react-native-track-player";

const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};

const toggleRepeat = () => {
  setRepeatMode((prev) => {
    const next = prev === 'off' ? 'queue' : prev === 'queue' ? 'track' : 'off';
    TrackPlayer.setRepeatMode(REPEAT_MAP[next]);
    return next;
  });
};
```

#### 3.1.3 初始化同步

`initPlayer` 末尾追加：
```js
await TrackPlayer.setRepeatMode(RepeatMode.Off);
```

确保 TrackPlayer 内部状态与 UI 默认值一致（防止热重载后状态漂移）。

#### 3.1.4 Controls 组件改动

**Props 变更**：
- 旧：`loopOn, onToggleLoop`
- 新：`repeatMode, onToggleRepeat`

**图标逻辑**：
```js
const repeatIcon = repeatMode === 'track' ? '🔂' : '🔁';
const accent = (on) => (on ? "#C20C0C" : "#b3b3b3");
// repeatMode === 'off' → 灰色
// repeatMode === 'queue' || 'track' → 红色
```

**渲染**：
```jsx
<TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
  <Text style={[styles.sideIcon, { color: accent(repeatMode !== 'off') }]}>
    {repeatIcon}
  </Text>
</TouchableOpacity>
```

#### 3.1.5 TrackPlayer RepeatMode 行为说明

- `RepeatMode.Off`：播完队列最后一首自动停止
- `RepeatMode.Queue`：播完最后一首自动回到第一首
- `RepeatMode.Track`：当前单曲循环

TrackPlayer 自动处理播放结束后的回绕，无需在 `playback-track-changed` 等事件中手动干预。

---

### 3.2 列表图标移除

#### 3.2.1 改动

`Controls` 组件删除最后一个 `TouchableOpacity`：

```jsx
// 删除这一段
<TouchableOpacity style={styles.sideButton}>
  <Text style={styles.sideIcon}>☰</Text>
</TouchableOpacity>
```

#### 3.2.2 布局影响

`controls` 样式 `justifyContent: 'space-between'` 仍生效。剩余 4 个按钮（循环/上一首/播放/下一首）在水平方向均匀分布。无需调整 `paddingHorizontal` 或按钮尺寸。

#### 3.2.3 导航替代

返回列表的导航统一由顶部 `‹` 按钮负责（`PlayerScreen` 已有 `onBack` prop）。功能上无损失。

---

### 3.3 错误处理（分层）

#### 3.3.1 初始化失败

**状态**：
```js
const [initError, setInitError] = useState(null);
```

**initPlayer 改造**：
```js
const initPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    setIsPlayerInitialized(true);
  } catch (e) {
    setInitError(e?.message || '播放器初始化失败');
  }
};
```

**重试**：
```js
const retryInit = () => {
  setInitError(null);
  initPlayer();
};
```

**渲染（在 App 顶层）**：
```jsx
if (initError) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>加载失败</Text>
      <Text style={styles.errorMessage}>{initError}</Text>
      <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
        <Text style={styles.retryText}>重试</Text>
      </TouchableOpacity>
    </View>
  );
}
```

**新增样式**：
```js
errorTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "600",
  textAlign: "center",
  marginTop: 120,
},
errorMessage: {
  color: "#b3b3b3",
  fontSize: 14,
  textAlign: "center",
  marginTop: 8,
  marginHorizontal: 32,
},
retryButton: {
  marginTop: 24,
  paddingHorizontal: 32,
  paddingVertical: 12,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#C20C0C",
  alignSelf: "center",
},
retryText: {
  color: "#C20C0C",
  fontSize: 15,
},
```

#### 3.3.2 播放失败

**监听位置**：`App` 组件内 `useEffect`（TrackPlayer 支持组件内事件监听）。

```js
useEffect(() => {
  const sub = TrackPlayer.addEventListener('playback-error', (e) => {
    Alert.alert(
      '播放失败',
      '当前歌曲无法播放，是否跳到下一首？',
      [
        { text: '下一首', onPress: () => skipToNext() },
        { text: '取消', style: 'cancel' },
      ]
    );
  });
  return () => sub.remove();
}, []);
```

**触发场景**：
- 音频 URL 404
- 网络超时
- 解码失败

**UI**：`Alert.alert` 弹窗，提供"下一首"和"取消"两个选项。不阻塞界面，用户取消则停留在当前曲目的暂停状态。

**注意**：`Alert` 需从 `react-native` 导入（当前未导入，需补充）。

#### 3.3.3 跳转边界

`skipToNext` / `skipToPrevious` 包 try-catch：

```js
const skipToNext = async () => {
  try {
    await TrackPlayer.skipToNext();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  } catch (e) {
    // 队尾且 repeatMode=off，静默忽略
  }
};

const skipToPrevious = async () => {
  try {
    await TrackPlayer.skipToPrevious();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  } catch (e) {
    // 队首，静默忽略
  }
};
```

**边界行为说明**：
- `repeatMode === 'queue'`：TrackPlayer 自动回绕，不抛错
- `repeatMode === 'track'`：不影响跳转，仍可切歌
- `repeatMode === 'off'`：队尾按下一首、队首按上一首时抛错，catch 后静默忽略，`currentTrack` 不变

---

## 4. 数据流

### 4.1 循环模式切换

```
用户点循环按钮
    ↓
toggleRepeat() 计算下一状态 (off→queue→track→off)
    ↓
setRepeatMode() 更新 React state
    ↓
同步调用 TrackPlayer.setRepeatMode(REPEAT_MAP[next])
    ↓
TrackPlayer 内部记录 RepeatMode
    ↓
播放到队尾时 TrackPlayer 按 RepeatMode 自动处理（回绕/停止单曲重播）
```

### 4.2 播放失败处理

```
TrackPlayer 尝试加载/解码音频
    ↓
失败 → TrackPlayer 触发 'playback-error' 事件
    ↓
App 内 useEffect 注册的监听器被调用
    ↓
Alert.alert('播放失败', ..., [下一首, 取消])
    ↓
用户选"下一首" → skipToNext()
用户选"取消" → 关闭 Alert，停留在当前曲目
```

### 4.3 跳转边界处理

```
用户在队尾按下一首（repeatMode=off）
    ↓
TrackPlayer.skipToNext() 抛错
    ↓
catch 捕获，静默忽略
    ↓
currentTrack 不变，UI 无变化
```

---

## 5. 验收标准

无自动化测试，验证靠 iOS 模拟器人工检查。

### 5.1 循环模式

- [ ] 默认 `repeatMode='off'`，循环图标灰色 `🔁`
- [ ] 点击一次 → `repeatMode='queue'`，图标红色 `🔁`
- [ ] 在 `queue` 模式下播放到最后一首，自然结束后自动回到第一首继续播放
- [ ] 点击两次 → `repeatMode='track'`，图标红色 `🔂`
- [ ] 在 `track` 模式下，当前单曲播放结束后自动重播
- [ ] 点击三次 → 回到 `off`，图标灰色 `🔁`
- [ ] 切换歌曲后 `repeatMode` 状态保持不变

### 5.2 列表图标移除

- [ ] Controls 区域只剩 4 个按钮：循环 / 上一首 / 播放暂停 / 下一首
- [ ] 4 个按钮水平方向均匀分布，无视觉空洞
- [ ] 顶部 `‹` 返回按钮仍可正常返回列表

### 5.3 错误处理

- [ ] **初始化失败**：（难以模拟，可暂时只验证正常路径不回归）若 `setupPlayer` 失败，显示"加载失败"页面 + 重试按钮
- [ ] **播放失败**：断网状态下选歌播放，弹出"播放失败"Alert
- [ ] Alert 选"下一首"能切换到下一首曲目
- [ ] Alert 选"取消"关闭弹窗，停留在当前曲目
- [ ] **跳转边界**：`repeatMode=off` 时在最后一首按下一首，静默无变化，`currentTrack` 不变
- [ ] **跳转边界**：在第一首按上一首，静默无变化
- [ ] 无控制台报错（之前的 `skipToNext` 抛错会出现在控制台）

---

## 6. 风险与备注

### 6.1 风险

| 风险 | 概率 | 缓解 |
| --- | --- | --- |
| `setRepeatMode` 在某些 RNTP 版本下行为不一致 | 低 | 4.1.1 文档明确支持，且 `RepeatMode` 是稳定 API |
| `playback-error` 事件在 iOS 上触发时机差异 | 中 | Alert 非阻塞，最坏情况是用户看不到提示但播放器仍可操作 |
| 热重载导致 `repeatMode` state 与 TrackPlayer 内部状态漂移 | 中 | `initPlayer` 末尾强制 `setRepeatMode(Off)` 同步默认值 |

### 6.2 备注

- `Alert` 需从 `react-native` 补充导入
- `RepeatMode` 需从 `react-native-track-player` 补充导入
- 事件监听器在 `useEffect` 返回值中调用 `sub.remove()` 清理，防止内存泄漏
- `toggleRepeat` 内部用 `setRepeatMode(prev => ...)` 函数式更新，避免闭包陷阱

---

## 7. 自检清单

- [x] 无 TBD / TODO / 占位符
- [x] 内部一致：状态名 `repeatMode` 在所有章节统一
- [x] 范围聚焦：仅含 3 项缺陷修复，未夹带架构改进
- [x] 无歧义：三态循环顺序、Alert 选项、跳转边界行为均明确
- [x] 与现有代码兼容：保留 `playlist` 数据结构、`PlayerScreen`/`PlaylistScreen` 组件边界
