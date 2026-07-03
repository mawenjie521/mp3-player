# P2 架构改进设计文档

> 阶段：P2（架构改进）
> 日期：2026-07-03
> 前置：P1 缺陷修复已合并到 main（commit 824473f）

---

## 1. 目标与范围

### 1.1 目标

将 755 行的单文件 `App.js` 拆分为分层模块结构，引入错误边界和持久化数据层基础设施，为 P3（核心功能）建立可扩展的架构基线。

**P2 是纯重构**——功能行为与 P1 完全一致，不新增用户可见特性。

### 1.2 范围内（In Scope）

| # | 内容 | 说明 |
| --- | --- | --- |
| 1 | 模块拆分 | App.js → `src/data/` + `src/components/` + `src/screens/` + `src/error/` |
| 2 | 样式 co-locate | 移除全局 StyleSheet，每个组件/屏幕自带样式 |
| 3 | 错误边界 | `ErrorBoundary` 类组件，包裹整个 App 树 |
| 4 | 数据层基础设施 | `storage.js` 封装 AsyncStorage 读写，不预设具体 key |

### 1.3 范围外（Out of Scope）

- React Navigation（P3 屏幕多了再引入）
- 测试基础设施（jest 已配置但未引入测试用例）
- `useStorage` hook / Context Provider（P3 有实际消费者再加）
- 全局状态管理（Redux/Zustand）
- 主题系统
- 任何用户可见的功能变化

### 1.4 约束

- React Native 0.75.4, React 18.3.1（不改变版本）
- `react-native-track-player` 4.1.1（不改变）
- **新依赖**：`@react-native-async-storage/async-storage`（P2 允许必要依赖，P1 的"无新依赖"约束不沿用）
- 功能行为与 P1 完全一致——P2 是纯重构，验收以"P1 行为不回归"为准
- 验证方式：Metro bundle 构建 + iOS 模拟器人工检查（项目无自动化测试）

---

## 2. 目录结构

```
src/
  data/
    playlist.js          # 内置歌单数组
    constants.js         # 尺寸常量 + 色板 + REPEAT_MAP
    storage.js           # AsyncStorage 封装
  components/
    Vinyl.js             # 含自身 styles
    Tonearm.js
    Lyrics.js
    Controls.js
  screens/
    PlayerScreen.js      # 含自身 styles
    PlaylistScreen.js    # 含自身 styles
  error/
    ErrorBoundary.js     # 类组件 + ErrorFallback 兜底 UI
App.js                   # 仅 App orchestrator + 顶层样式（container/loading/error）
index.js                 # 入口，不变
service.js               # 播放服务，不变
```

### 2.1 文件职责

| 文件 | 职责 | 导出 |
| --- | --- | --- |
| `data/playlist.js` | 内置 3 首示例曲目数据 | `playlist`（命名导出） |
| `data/constants.js` | 尺寸、色板、循环模式映射 | `SCREEN_WIDTH`, `VINYL_SIZE`, `ART_SIZE`, `COLORS`, `REPEAT_MAP` |
| `data/storage.js` | AsyncStorage 读写封装 | `loadJSON`, `saveJSON`, `removeKey` |
| `components/Vinyl.js` | 黑胶唱片视觉 | `Vinyl`（默认导出） |
| `components/Tonearm.js` | 唱针动画 | `Tonearm` |
| `components/Lyrics.js` | 歌词 3 行窗口 | `Lyrics` |
| `components/Controls.js` | 播放控制栏 | `Controls` |
| `screens/PlayerScreen.js` | 播放页（组合 Vinyl/Tonearm/Lyrics/Controls） | `PlayerScreen` |
| `screens/PlaylistScreen.js` | 歌单列表页 | `PlaylistScreen` |
| `error/ErrorBoundary.js` | 错误边界 + 兜底 UI | `ErrorBoundary` |
| `App.js` | 状态编排 + 导航 + 播放逻辑 | `App`（默认导出） |

### 2.2 样式策略

- 每个组件/屏幕文件自带 `StyleSheet.create(...)`，仅含该组件用到的样式
- `App.js` 保留顶层样式：`container`、`loading`、`errorTitle`、`errorMessage`、`retryButton`、`retryText`、`glowTop`
- 移除当前 App.js 末尾 276 行的全局 `styles`
- 色板统一从 `constants.js` 引用（`COLORS.background`、`COLORS.accent` 等），不在各文件硬编码

---

## 3. 详细设计

### 3.1 数据层（storage.js）

```js
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 静默失败——存储不可用不应阻断 UI
  }
}

export async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // 同上
  }
}
```

**设计决策**：
- 不预设 `STORAGE_KEYS` 常量——P3 添加收藏/最近播放时再定义具体 key
- 所有操作 try-catch 静默失败——存储异常不应让 app 崩溃
- `loadJSON` 接受 `fallback` 参数，调用方无需写 `|| defaultValue`
- 不引入 React hook 或 Context——YAGNI，P3 有实际消费者再加

### 3.2 常量（constants.js）

```js
import { Dimensions } from "react-native";
import { RepeatMode } from "react-native-track-player";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
export const ART_SIZE = Math.min(220, VINYL_SIZE - 120);

export const COLORS = {
  background: "#1a1a1a",
  accent: "#C20C0C",
  primaryText: "#ffffff",
  secondaryText: "#b3b3b3",
  vinyl: "#0a0a0a",
  groove: "#222",
};

export const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};
```

### 3.3 错误边界（ErrorBoundary.js）

```jsx
import React, { Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.warn("ErrorBoundary caught:", error, info);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.message}>
            {this.state.error?.message || "应用发生未知错误"}
          </Text>
          <TouchableOpacity onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.primaryText, fontSize: 20, fontWeight: "600" },
  message: { color: COLORS.secondaryText, fontSize: 14, marginTop: 8, marginHorizontal: 32, textAlign: "center" },
  button: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: COLORS.accent },
  buttonText: { color: COLORS.accent, fontSize: 15 },
});

export default ErrorBoundary;
```

**放置位置**：`App.js` 的 return 最外层包裹 `<ErrorBoundary>`，让整个组件树都被边界保护。不放在 `index.js`——保持 `index.js` 仅做注册。

**"重试"行为**：`handleReset` 清空 `hasError` state，组件树重新渲染。若错误是确定性的（如坏数据），重试会再次触发；但大多数渲染错误是瞬态的（如网络加载中的临时状态），重试能恢复。

### 3.4 组件抽取（以 Vinyl.js 为例）

```jsx
// src/components/Vinyl.js
import React from "react";
import { View, Animated, Image, StyleSheet } from "react-native";
import { VINYL_SIZE, ART_SIZE } from "../data/constants";

function Vinyl({ artwork, spin }) {
  const spinDeg = spin.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.vinylWrapper}>
      <Animated.View style={[styles.vinyl, { transform: [{ rotate: spinDeg }] }]}>
        <View style={[styles.groove, { width: VINYL_SIZE - 20, height: VINYL_SIZE - 20, borderRadius: (VINYL_SIZE - 20) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 60, height: VINYL_SIZE - 60, borderRadius: (VINYL_SIZE - 60) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 100, height: VINYL_SIZE - 100, borderRadius: (VINYL_SIZE - 100) / 2 }]} />
        <View style={styles.artWrapper}>
          <Image source={{ uri: artwork }} style={styles.art} />
          <View style={styles.centerLabel} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  vinylWrapper: { width: VINYL_SIZE, height: VINYL_SIZE, alignSelf: "center", marginBottom: 24 },
  vinyl: { width: VINYL_SIZE, height: VINYL_SIZE, borderRadius: VINYL_SIZE / 2, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  groove: { position: "absolute", borderWidth: 1, borderColor: "#222" },
  artWrapper: { width: ART_SIZE, height: ART_SIZE, borderRadius: ART_SIZE / 2, borderWidth: 2, borderColor: "#fff", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  art: { width: "100%", height: "100%", borderRadius: ART_SIZE / 2 },
  centerLabel: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: "#C20C0C" },
});

export default Vinyl;
```

其他组件（Tonearm/Lyrics/Controls/PlayerScreen/PlaylistScreen）按相同模式抽取：props 不变、样式自带、从 `constants.js` 引用常量。

### 3.5 App.js（重构后）

`App.js` 只保留：
- imports（从 src/ 各模块引入）
- `App` 组件：state（currentTrack/playbackState/position/duration/isPlayerInitialized/initError/repeatMode/view）、spin ref、effects（initPlayer/spin/playback-error）、handlers（togglePlayback/skipToNext/skipToPrevious/seekTo/toggleRepeat/onSelect/onBack/retryInit）、render
- 顶层 styles（container/loading/errorTitle/errorMessage/retryButton/retryText/glowTop）

预估行数：从 755 行降到 ~250 行（App 逻辑 ~180 + 顶层 styles ~70）。

`App` 的 return 结构：

```jsx
return (
  <ErrorBoundary>
    {/* initError / loading / view === "list" / player 分支 */}
  </ErrorBoundary>
);
```

### 3.6 导航（保持 state 切换）

`App` 保留 `view` state（`'list' | 'player'`）和 `setView`。`onSelect` 切到 player，`onBack` 切回 list。

P2 唯一改进：把两个分支渲染抽成 `renderScreen()` 方法：

```jsx
renderScreen() {
  if (this.state.view === "list") {
    return <PlaylistScreen ... />;
  }
  return <PlayerScreen ... />;
}
```

实际上 `App` 是函数组件，用条件返回即可，无需方法。保持现状的 `if (view === "list") return ...; return ...;` 模式，只是组件从外部引入。

---

## 4. 实施路径

### 4.1 增量抽取顺序

每步一个 commit，每步后 Metro bundle 必须能构建：

1. **安装依赖**：`npm install @react-native-async-storage/async-storage`
2. **建 src/data/**：抽 `playlist.js`、`constants.js`、`storage.js`；App.js 改为从 src/ 引入
3. **抽叶子组件**：Vinyl → Tonearm → Lyrics → Controls（每次一个文件）
4. **抽屏幕**：PlayerScreen → PlaylistScreen
5. **建 ErrorBoundary**：写组件 + App.js 包裹
6. **清理 App.js**：移除已搬走的样式和组件定义，确认仅剩 orchestrator

### 4.2 每步验证

每个 commit 后运行：
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
预期："Done writing bundle output" 无错误。

### 4.3 最终验证

全部拆完后在 iOS 模拟器人工检查，对照 P1 验收清单：
- 歌单列表正常显示、点击进播放页
- 黑胶旋转、唱针动画、歌词同步
- 三态循环模式切换
- 播放失败 Alert、跳转边界静默
- 初始化失败错误页（可选，难模拟）

所有行为应与 P1 一致——P2 不引入行为变化。

---

## 5. 风险与备注

### 5.1 风险

| 风险 | 概率 | 缓解 |
| --- | --- | --- |
| AsyncStorage 在 iOS 模拟器上首次安装需 pod install | 高 | 安装后 `cd ios && pod install` |
| 抽取过程中 import 路径写错导致 Metro 崩 | 中 | 每步后 Metro bundle 验证 |
| 样式遗漏（某组件样式没搬过来） | 中 | 逐组件抽取时连带搬样式，每步验证视觉 |
| `Dimensions.get("window")` 在 constants.js 模块加载时执行，热重载后不更新 | 低 | 已有行为，P2 不改变；如需动态可后续改 |
| ErrorBoundary 不捕获事件处理器中的错误（React 限制） | 低 | 已知限制；事件错误靠现有 try-catch 兜底 |

### 5.2 备注

- 默认导出 vs 命名导出：组件用默认导出（`export default Vinyl`），数据/常量用命名导出（`export const playlist`）——符合 React Native 社区惯例
- `index.js` 和 `service.js` 完全不动
- 不改变 `app.json`、`babel.config.js`、`metro.config.js`
- iOS Pods 需重新安装（async-storage 是原生模块）

---

## 6. 验收标准

### 6.1 结构验收

- [ ] `src/data/playlist.js` 存在并导出 `playlist`
- [ ] `src/data/constants.js` 导出 `SCREEN_WIDTH`、`VINYL_SIZE`、`ART_SIZE`、`COLORS`、`REPEAT_MAP`
- [ ] `src/data/storage.js` 导出 `loadJSON`、`saveJSON`、`removeKey`
- [ ] `src/components/` 下有 `Vinyl.js`、`Tonearm.js`、`Lyrics.js`、`Controls.js`
- [ ] `src/screens/` 下有 `PlayerScreen.js`、`PlaylistScreen.js`
- [ ] `src/error/ErrorBoundary.js` 存在
- [ ] `App.js` 行数 ≤ 300（从 755 降下来）
- [ ] `App.js` 不再包含 `function Vinyl/Tonearm/Lyrics/Controls/PlayerScreen/PlaylistScreen` 定义

### 6.2 行为验收（与 P1 一致）

- [ ] 歌单列表显示 3 首曲目，点击进入播放页
- [ ] 黑胶旋转、唱针落下/抬起、歌词 3 行滚动
- [ ] 三态循环：off → queue → track → off，图标与颜色正确
- [ ] 播放失败弹 Alert，可选"下一首"/"取消"
- [ ] 队尾按下一曲静默无变化
- [ ] Metro bundle 构建无错误

### 6.3 数据层验收

- [ ] `storage.js` 的三个函数可被 import（无实际消费者，P3 才用）

### 6.4 错误边界验收

- [ ] `<ErrorBoundary>` 包裹在 App return 最外层
- [ ] （可选）临时在某组件 throw 验证兜底 UI 显示 + "重试"重置

---

## 7. 自检清单

- [x] 无 TBD / TODO / 占位符
- [x] 内部一致：目录结构、文件职责、导出名称在各章节统一
- [x] 范围聚焦：仅含模块拆分 + 错误边界 + 数据层基础设施，未夹带功能变化
- [x] 无歧义：样式策略、错误边界位置、数据层 scope 均明确
- [x] 与 P1 兼容：保留 P1 的 repeatMode 三态、错误处理分层、播放逻辑
