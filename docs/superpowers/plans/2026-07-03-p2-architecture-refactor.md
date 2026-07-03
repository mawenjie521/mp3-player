# P2 Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 755-line single-file `App.js` into a layered `src/` module structure (data/components/screens/error), add an error boundary, and introduce an AsyncStorage data-layer utility — without changing any user-visible behavior.

**Architecture:** Incremental extraction. Each task moves code out of `App.js` into a focused module under `src/`, keeps styles co-located with their components, and verifies Metro bundle builds before committing. Pure refactor — P1 behavior (three-state loop, layered error handling, playback logic) is preserved exactly.

**Tech Stack:** React Native 0.75.4, React 18.3.1, react-native-track-player 4.1.1, `@react-native-community/slider` 5.2.0, **new:** `@react-native-community/async-storage`.

## Global Constraints

- React Native 0.75.4, React 18.3.1 (do not change versions).
- `react-native-track-player` 4.1.1, `@react-native-community/slider` 5.2.0 (already installed).
- New dependency allowed: `@react-native-community/async-storage` (requires `pod install` in `ios/`).
- Pure refactor — no user-visible behavior change. All P1 behavior (three-state loop `off→queue→track→off`, init error page, playback-error Alert, silent skip-boundary handling) must work identically after P2.
- No automated tests exist; verification is Metro bundle build + manual iOS simulator check (eslint skipped — no config in project).
- Spec: `docs/superpowers/specs/2026-07-03-p2-architecture-refactor-design.md`.
- `index.js`, `service.js`, `app.json`, `babel.config.js`, `metro.config.js` untouched.
- Components use default export (`export default X`); data/constants use named exports (`export const X`).
- Colors referenced via `COLORS` from `src/data/constants.js` where applicable; one-off shades (e.g. `#ffffff20`) may stay inline.

---

## File Structure

Final state after all tasks:

```
src/
  data/
    playlist.js          # playlist array (named export)
    constants.js         # SCREEN_WIDTH, VINYL_SIZE, ART_SIZE, COLORS, REPEAT_MAP
    storage.js           # loadJSON, saveJSON, removeKey
  components/
    Vinyl.js             # default export, co-located styles
    Tonearm.js
    Lyrics.js
    Controls.js
  screens/
    PlayerScreen.js      # default export, co-located styles, imports components
    PlaylistScreen.js
  error/
    ErrorBoundary.js     # default export, co-located fallback UI + styles
App.js                   # orchestrator only (~250 lines)
```

Each component/screen file contains its own `StyleSheet.create(...)` with only the styles it uses. `App.js` retains only top-level styles (`container`, `glowTop`, `loading`, `errorTitle`, `errorMessage`, `retryButton`, `retryText`).

---

### Task 1: Install @react-native-community/async-storage

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `ios/Podfile.lock` (via `pod install`)

**Interfaces:**
- Produces: `@react-native-community/async-storage` installed and linked. Consumed by Task 2 (`src/data/storage.js`).

- [ ] **Step 1: Install the npm package**

Run:
```bash
npm install @react-native-community/async-storage
```
Expected: package added to `dependencies` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Install iOS pods**

Run:
```bash
cd ios && pod install && cd ..
```
Expected: `Podfile.lock` updated; output includes `Installing AsyncStorage` (or similar) with no errors.

- [ ] **Step 3: Verify Metro bundle builds (dependency is unused but installed)**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json ios/Podfile.lock
git commit -m "Install @react-native-community/async-storage for P2 data layer"
```

---

### Task 2: Create src/data/ modules and update App.js imports

This task creates `playlist.js`, `constants.js`, `storage.js` under `src/data/`, then updates `App.js` to import from them instead of defining inline.

**Files:**
- Create: `src/data/playlist.js`
- Create: `src/data/constants.js`
- Create: `src/data/storage.js`
- Modify: `App.js` — remove inline `playlist`, `SCREEN_WIDTH`/`VINYL_SIZE`/`ART_SIZE`, `REPEAT_MAP`; add imports from `src/data/`

**Interfaces:**
- Consumes: `RepeatMode` from `react-native-track-player` (for `REPEAT_MAP`); `@react-native-community/async-storage` (for `storage.js`); `Dimensions` from `react-native` (for `constants.js`).
- Produces: `playlist` (named), `SCREEN_WIDTH`/`VINYL_SIZE`/`ART_SIZE`/`COLORS`/`REPEAT_MAP` (named), `loadJSON`/`saveJSON`/`removeKey` (named). Consumed by App.js immediately and by components/screens in later tasks.

- [ ] **Step 1: Create src/data/playlist.js**

Create file `src/data/playlist.js` with the playlist array extracted verbatim from `App.js:18-70`:

```js
export const playlist = [
  {
    id: "1",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "示例音乐 1",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song1/600/600",
    lyrics: [
      "夜色温柔如水",
      "音符在指尖流淌",
      "回忆像风一样",
      "吹过空荡的街",
      "我们都在追寻",
      "那一束微光",
      "时间停在原地",
      "听一首老歌",
    ],
  },
  {
    id: "2",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "示例音乐 2",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song2/600/600",
    lyrics: [
      "月光洒在窗台",
      "心事无处安放",
      "远处灯火阑珊",
      "谁在轻声哼唱",
      "走过多少旅程",
      "才学会遗忘",
      "梦里有你的脸",
      "醒来只剩空",
    ],
  },
  {
    id: "3",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "示例音乐 3",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song3/600/600",
    lyrics: [
      "雨滴敲打屋檐",
      "节奏像心跳声",
      "城市在沉睡中",
      "独自闪烁霓虹",
      "每一段旋律里",
      "藏着旧时光",
      "让音乐带我们",
      "回到那一年",
    ],
  },
];
```

- [ ] **Step 2: Create src/data/constants.js**

Create file `src/data/constants.js`:

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

- [ ] **Step 3: Create src/data/storage.js**

Create file `src/data/storage.js`:

```js
import AsyncStorage from "@react-native-community/async-storage";

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

- [ ] **Step 4: Update App.js imports**

In `App.js`, find the import block (lines 1-16) and the inline data/constants (lines 18-80).

Replace lines 1-80 (everything from the first `import` through the closing `};` of `REPEAT_MAP`) with:

```js
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Animated,
  Easing,
  FlatList,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
import { playlist } from "./src/data/playlist";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
```

Key changes:
- Removed `Dimensions` from the react-native import (now in `constants.js`).
- Removed `RepeatMode` from the react-native-track-player import (now in `constants.js`).
- Added imports of `playlist`, `COLORS`, `REPEAT_MAP` from `src/data/`.
- Removed the inline `playlist` array, `SCREEN_WIDTH`/`VINYL_SIZE`/`ART_SIZE` constants, and `REPEAT_MAP` object.

Note: `COLORS` is imported now but not yet referenced in App.js — it will be used in Task 4 Step 6 when App.js's remaining top-level styles are updated to reference `COLORS` instead of hardcoded hex values. Between Task 2 and Task 4 the import is unused; eslint is not configured in this project so no warning, and Metro bundle does not fail on unused imports.

- [ ] **Step 5: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors. If you see "Unable to resolve `./src/data/playlist`", verify the file was created at the exact path.

- [ ] **Step 6: Commit**

```bash
git add src/data/playlist.js src/data/constants.js src/data/storage.js App.js
git commit -m "Extract playlist, constants, and storage into src/data/"
```

---

### Task 3: Extract leaf components (Vinyl, Tonearm, Lyrics, Controls)

This task moves the four presentational components out of `App.js` into `src/components/`, each with its own co-located styles. `App.js` no longer defines these components; it will import them (the imports are added in this task, but full usage in `PlayerScreen` comes in Task 4 when `PlayerScreen` is extracted — for now `PlayerScreen` still references `Vinyl`/`Tonearm`/`Lyrics`/`Controls` which are now imported).

**Files:**
- Create: `src/components/Vinyl.js`
- Create: `src/components/Tonearm.js`
- Create: `src/components/Lyrics.js`
- Create: `src/components/Controls.js`
- Modify: `App.js` — remove the four component function definitions; remove their styles from the global StyleSheet; add imports

**Interfaces:**
- Consumes: `VINYL_SIZE`, `ART_SIZE`, `COLORS` from `src/data/constants.js`.
- Produces: `Vinyl` (default), `Tonearm` (default), `Lyrics` (default), `Controls` (default). Consumed by `PlayerScreen` (currently inline in App.js, extracted in Task 4).

- [ ] **Step 1: Create src/components/Vinyl.js**

Create file `src/components/Vinyl.js`:

```jsx
import React from "react";
import { View, Animated, Image, StyleSheet } from "react-native";
import { VINYL_SIZE, ART_SIZE, COLORS } from "../data/constants";

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
  vinylWrapper: {
    width: VINYL_SIZE,
    height: VINYL_SIZE,
    alignSelf: "center",
    marginBottom: 24,
  },
  vinyl: {
    width: VINYL_SIZE,
    height: VINYL_SIZE,
    borderRadius: VINYL_SIZE / 2,
    backgroundColor: COLORS.vinyl,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  groove: {
    position: "absolute",
    borderWidth: 1,
    borderColor: COLORS.groove,
  },
  artWrapper: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: "100%",
    height: "100%",
    borderRadius: ART_SIZE / 2,
  },
  centerLabel: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
});

export default Vinyl;
```

- [ ] **Step 2: Create src/components/Tonearm.js**

Create file `src/components/Tonearm.js`:

```jsx
import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

function Tonearm({ isPlaying }) {
  const angle = useRef(new Animated.Value(isPlaying ? 20 : -30)).current;

  useEffect(() => {
    Animated.timing(angle, {
      toValue: isPlaying ? 20 : -30,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isPlaying, angle]);

  const rot = angle.interpolate({
    inputRange: [-30, 20],
    outputRange: ["-30deg", "20deg"],
  });

  return (
    <Animated.View style={[styles.tonearm, { transform: [{ rotate: rot }] }]}>
      <View style={styles.tonearmBar} />
      <View style={styles.tonearmHead} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tonearm: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 130,
    height: 130,
    zIndex: 10,
  },
  tonearmBar: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 100,
    borderRadius: 4,
    backgroundColor: "#999",
    transformOrigin: "top right",
  },
  tonearmHead: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#666",
    borderWidth: 2,
    borderColor: "#888",
  },
});

export default Tonearm;
```

- [ ] **Step 3: Create src/components/Lyrics.js**

Create file `src/components/Lyrics.js`:

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function Lyrics({ lines, currentIndex }) {
  const visible = [];
  for (let i = -1; i <= 1; i++) {
    const idx = currentIndex + i;
    if (idx >= 0 && idx < lines.length) {
      visible.push({ idx, text: lines[idx] });
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

const styles = StyleSheet.create({
  lyricsContainer: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  lyricLine: {
    fontSize: 14,
    color: COLORS.secondaryText,
    opacity: 0.4,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    color: COLORS.primaryText,
    opacity: 1,
    fontWeight: "600",
  },
});

export default Lyrics;
```

- [ ] **Step 4: Create src/components/Controls.js**

Create file `src/components/Controls.js`:

```jsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat }) {
  const accent = (on) => (on ? COLORS.accent : COLORS.secondaryText);
  const repeatIcon = repeatMode === "track" ? "🔂" : "🔁";

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: accent(repeatMode !== "off") }]}>{repeatIcon}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPrev} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏮</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onTogglePlay} style={styles.playButton}>
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏭</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sideButton: {
    padding: 12,
    width: 56,
    alignItems: "center",
  },
  sideIcon: {
    fontSize: 22,
  },
  controlButton: {
    padding: 12,
  },
  controlIcon: {
    fontSize: 30,
    color: COLORS.primaryText,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: COLORS.primaryText,
    marginTop: -2,
  },
});

export default Controls;
```

- [ ] **Step 5: Add imports to App.js**

In `App.js`, find the import block at the top (the lines you added in Task 2 Step 4). Add these four imports after the `src/data/constants` import:

```js
import Vinyl from "./src/components/Vinyl";
import Tonearm from "./src/components/Tonearm";
import Lyrics from "./src/components/Lyrics";
import Controls from "./src/components/Controls";
```

- [ ] **Step 6: Remove the four component function definitions from App.js**

In `App.js`, delete these four function definitions (they are now in `src/components/`):
- `function Vinyl({ artwork, spin }) { ... }` (was lines ~82-101, but line numbers have shifted after Task 2 — find by the function name)
- `function Tonearm({ isPlaying }) { ... }`
- `function Lyrics({ lines, currentIndex }) { ... }`
- `function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat }) { ... }`

Delete each function from its `function X(...) {` line through its closing `}`.

- [ ] **Step 7: Remove extracted styles from App.js StyleSheet**

In `App.js`, find the `const styles = StyleSheet.create({ ... })` block. Remove these style entries (they now live in the component files):
- `vinylWrapper`, `vinyl`, `groove`, `artWrapper`, `art`, `centerLabel` (moved to Vinyl.js)
- `tonearm`, `tonearmBar`, `tonearmHead` (moved to Tonearm.js)
- `lyricsContainer`, `lyricLine`, `lyricCurrent` (moved to Lyrics.js)
- `controls`, `sideButton`, `sideIcon`, `controlButton`, `controlIcon`, `playButton`, `playIcon` (moved to Controls.js)

Leave all other styles in place (`container`, `glowTop`, `loading`, `errorTitle`, `errorMessage`, `retryButton`, `retryText`, `topBar`, `topBackButton`, `topIcon`, `topTitle`, `vinylStage`, `slider`, `timeContainer`, `time`, and all `list*` styles — these are used by `PlayerScreen`/`PlaylistScreen`/`App` which are extracted later).

- [ ] **Step 8: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ App.js
git commit -m "Extract Vinyl, Tonearm, Lyrics, Controls into src/components/"
```

---

### Task 4: Extract PlayerScreen and PlaylistScreen

This task moves the two screen components into `src/screens/`, each with co-located styles. `App.js` imports them.

**Files:**
- Create: `src/screens/PlayerScreen.js`
- Create: `src/screens/PlaylistScreen.js`
- Modify: `App.js` — remove the two screen function definitions; remove their styles from the global StyleSheet; add imports

**Interfaces:**
- Consumes: `Vinyl`, `Tonearm`, `Lyrics`, `Controls` (from Task 3); `COLORS` from `src/data/constants.js`; `Slider` from `@react-native-community/slider`.
- Produces: `PlayerScreen` (default), `PlaylistScreen` (default). Consumed by `App.js`.

- [ ] **Step 1: Create src/screens/PlayerScreen.js**

Create file `src/screens/PlayerScreen.js`:

```jsx
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS } from "../data/constants";
import Vinyl from "../components/Vinyl";
import Tonearm from "../components/Tonearm";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";

function PlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  repeatMode,
  spin,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onToggleRepeat,
  onBack,
}) {
  const lyricIndex = useMemo(() => {
    if (!currentTrack || !currentTrack.lyrics || !duration) return 0;
    const idx = Math.floor((position / duration) * currentTrack.lyrics.length);
    return Math.min(idx, currentTrack.lyrics.length - 1);
  }, [position, duration, currentTrack]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>请选择歌曲</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.topBackButton}>
          <Text style={styles.topIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.topIcon}>⤴</Text>
      </View>

      <View style={styles.vinylStage}>
        <Vinyl artwork={currentTrack.artwork} spin={spin} />
        <Tonearm isPlaying={isPlaying} />
      </View>

      <Lyrics lines={currentTrack.lyrics || []} currentIndex={lyricIndex} />

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor="#ffffff20"
        thumbTintColor={COLORS.primaryText}
      />
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      <Controls
        isPlaying={isPlaying}
        onPrev={onSkipPrev}
        onNext={onSkipNext}
        onTogglePlay={onTogglePlay}
        repeatMode={repeatMode}
        onToggleRepeat={onToggleRepeat}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  loading: {
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  topBackButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topIcon: {
    fontSize: 24,
    color: COLORS.primaryText,
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 16,
  },
  vinylStage: {
    position: "relative",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  time: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

export default PlayerScreen;
```

- [ ] **Step 2: Create src/screens/PlaylistScreen.js**

Create file `src/screens/PlaylistScreen.js`:

```jsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, FlatList } from "react-native";
import { COLORS } from "../data/constants";

function PlaylistScreen({ playlist, currentTrack, onSelect }) {
  const renderItem = ({ item, index }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(index)}
        activeOpacity={0.6}
      >
        <Image source={{ uri: item.artwork }} style={styles.listThumb} />
        <View style={styles.listInfo}>
          <Text
            style={[styles.listTitle, isActive && styles.listTitleActive]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={styles.listActiveIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>播放列表</Text>
        <Text style={styles.listHeaderCount}>共 {playlist.length} 首</Text>
      </View>
      <FlatList
        data={playlist}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  listHeaderCount: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  listTitleActive: {
    color: COLORS.accent,
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  listActiveIcon: {
    color: COLORS.accent,
    fontSize: 16,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff10",
    marginLeft: 84,
  },
});

export default PlaylistScreen;
```

- [ ] **Step 3: Add screen imports to App.js**

In `App.js`, find the import block. Add these two imports after the component imports (from Task 3 Step 5):

```js
import PlayerScreen from "./src/screens/PlayerScreen";
import PlaylistScreen from "./src/screens/PlaylistScreen";
```

- [ ] **Step 4: Remove the two screen function definitions from App.js**

In `App.js`, delete:
- `function PlayerScreen({ ... }) { ... }` (the entire function, from `function PlayerScreen` through its closing `}`)
- `function PlaylistScreen({ playlist, currentTrack, onSelect }) { ... }` (the entire function)

- [ ] **Step 5: Remove extracted screen styles from App.js StyleSheet**

In `App.js`, remove these style entries from the `styles` StyleSheet:
- `topBar`, `topBackButton`, `topIcon`, `topTitle`, `vinylStage`, `slider`, `timeContainer`, `time` (moved to PlayerScreen.js)
- `listHeader`, `listHeaderTitle`, `listHeaderCount`, `listRow`, `listThumb`, `listInfo`, `listTitle`, `listTitleActive`, `listArtist`, `listActiveIcon`, `listSeparator` (moved to PlaylistScreen.js)

Leave in `App.js`: `container`, `glowTop`, `loading`, `errorTitle`, `errorMessage`, `retryButton`, `retryText` (used by App's init-error / loading branches).

- [ ] **Step 6: Update App.js remaining styles to use COLORS**

In `App.js`, update the 7 remaining style entries to reference `COLORS` instead of hardcoded hex values (satisfies spec §2.2 "色板统一从 constants.js 引用...不在各文件硬编码"). Replace the entire `const styles = StyleSheet.create({ ... })` block with:

```js
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  loading: {
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 100,
  },
  errorTitle: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 120,
  },
  errorMessage: {
    color: COLORS.secondaryText,
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
    borderColor: COLORS.accent,
    alignSelf: "center",
  },
  retryText: {
    color: COLORS.accent,
    fontSize: 15,
  },
});
```

`COLORS` was imported in Task 2 Step 4; it is now used. Verify no other style entries remain in this StyleSheet (all component/screen styles were moved in Tasks 3-4).

- [ ] **Step 7: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/ App.js
git commit -m "Extract PlayerScreen and PlaylistScreen into src/screens/"
```

---

### Task 5: Create ErrorBoundary and wrap App

This task creates the `ErrorBoundary` class component with a fallback UI, and wraps the `App` component's return in `<ErrorBoundary>`.

**Files:**
- Create: `src/error/ErrorBoundary.js`
- Modify: `App.js` — import `ErrorBoundary` and wrap all return branches

**Interfaces:**
- Consumes: `COLORS` from `src/data/constants.js`; `React.Component` from `react`.
- Produces: `ErrorBoundary` (default export, class component). Wraps the entire App tree.

- [ ] **Step 1: Create src/error/ErrorBoundary.js**

Create file `src/error/ErrorBoundary.js`:

```jsx
import React, { Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.warn("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.message}>
            {this.state.error && this.state.error.message
              ? this.state.error.message
              : "应用发生未知错误"}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 20,
    fontWeight: "600",
  },
  message: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 32,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.accent,
    fontSize: 15,
  },
});

export default ErrorBoundary;
```

- [ ] **Step 2: Import ErrorBoundary in App.js**

In `App.js`, add to the import block (after the screen imports):

```js
import ErrorBoundary from "./src/error/ErrorBoundary";
```

- [ ] **Step 3: Wrap App's return branches in ErrorBoundary**

In `App.js`, find the `App` component's return statements. There are three early returns (`initError`, `!isPlayerInitialized`, `view === "list"`) and the final `PlayerScreen` return.

Wrap each return's content in `<ErrorBoundary>...</ErrorBoundary>`. The `initError` branch becomes:

```jsx
  if (initError) {
    return (
      <ErrorBoundary>
        <View style={styles.container}>
          <Text style={styles.errorTitle}>加载失败</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      </ErrorBoundary>
    );
  }
```

Apply the same `<ErrorBoundary>` wrap to:
- The `!isPlayerInitialized` loading branch
- The `view === "list"` branch (wrap the `<PlaylistScreen>`)
- The final `return ( <PlayerScreen ... /> );`

- [ ] **Step 4: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/error/ErrorBoundary.js App.js
git commit -m "Add ErrorBoundary wrapping all App render branches"
```

---

### Task 6: Final cleanup and verification

This task verifies the refactor is complete: `App.js` is lean (≤ 300 lines), no stray component definitions remain, and behavior matches P1.

**Files:**
- Modify: `App.js` (if any cleanup needed)

**Interfaces:**
- N/A (verification task)

- [ ] **Step 1: Check App.js line count**

Run:
```bash
wc -l App.js
```
Expected: ≤ 300 lines. If significantly more, look for leftover code that should have been moved.

- [ ] **Step 2: Verify no component definitions remain in App.js**

Run:
```bash
grep -n "^function Vinyl\|^function Tonearm\|^function Lyrics\|^function Controls\|^function PlayerScreen\|^function PlaylistScreen\|^const playlist\|^const REPEAT_MAP\|^const { width" App.js
```
Expected: no output (all moved to `src/`).

- [ ] **Step 3: Verify all src/ files exist**

Run:
```bash
ls src/data/playlist.js src/data/constants.js src/data/storage.js src/components/Vinyl.js src/components/Tonearm.js src/components/Lyrics.js src/components/Controls.js src/screens/PlayerScreen.js src/screens/PlaylistScreen.js src/error/ErrorBoundary.js
```
Expected: all 10 files listed with no "No such file" errors.

- [ ] **Step 4: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Done writing bundle output" with no errors.

- [ ] **Step 5: Manual verification in iOS simulator**

Reload the app in the simulator (or run `npx react-native run-ios` if not already running). Verify the following P1 behaviors are preserved:
- [ ] App launches to the song list (3 songs displayed).
- [ ] Tapping a song opens the player screen; vinyl spins, tonearm lowers.
- [ ] Lyrics show 3 lines with the current line highlighted.
- [ ] Progress bar advances; time labels show position/duration.
- [ ] Tapping the loop icon cycles: gray 🔁 → red 🔁 → red 🔂 → gray 🔁.
- [ ] With `queue` mode active, reaching the end of the last song wraps to the first.
- [ ] With `track` mode active, the current song replays when it ends.
- [ ] Tapping next on the last song with `repeatMode=off` silently does nothing.
- [ ] Tapping the `‹` back button returns to the song list.
- [ ] No red-box errors in the simulator; no uncaught errors in Metro console.

- [ ] **Step 6: (Optional) Verify ErrorBoundary fallback**

Temporarily add `throw new Error("test")` as the first line of `PlaylistScreen`'s render (in `src/screens/PlaylistScreen.js`). Reload the app.
- [ ] The ErrorBoundary fallback UI appears: "出错了" + error message + "重试" button.
- [ ] Tapping "重试" clears the error state (the app attempts to re-render; since the throw is still there, it will show again — that's expected for this test).
- Revert the `throw` before committing.

- [ ] **Step 7: Commit (if any cleanup was made)**

If Steps 1-4 required any edits to App.js, commit them:
```bash
git add App.js
git commit -m "Final cleanup of App.js after P2 refactor"
```

If no changes were needed, skip the commit — the refactor is complete.

---

## Self-Review

**1. Spec coverage:**
- Spec §2 (directory structure) → Task 2 (data/), Task 3 (components/), Task 4 (screens/), Task 5 (error/).
- Spec §2.1 (file responsibilities) → each task creates files with the specified exports.
- Spec §2.2 (co-located styles, COLORS centralization) → Task 3 Step 1-4 (each component has own StyleSheet, references COLORS), Task 4 Step 1-2 (same for screens), Task 4 Step 6 (App.js remaining 7 styles updated to use COLORS).
- Spec §3.1 (storage.js with loadJSON/saveJSON/removeKey) → Task 2 Step 3.
- Spec §3.2 (constants.js with COLORS/REPEAT_MAP/sizes) → Task 2 Step 2.
- Spec §3.3 (ErrorBoundary class component, wrap App) → Task 5.
- Spec §3.4 (component extraction pattern) → Tasks 3-4.
- Spec §3.5 (App.js ≤ 300 lines, only orchestrator + top-level styles) → Task 6 Step 1 verifies.
- Spec §3.6 (state-based navigation preserved) → App.js retains `view` state (no task changes it).
- Spec §4.1 (incremental extraction order) → task ordering matches.
- Spec §6 (acceptance criteria) → Task 6 verification checklist.
- All spec sections covered.

**2. Placeholder scan:** No TBD/TODO. Every code step has complete code. No "add appropriate error handling" — exact try-catch shown in storage.js. No "similar to Task N" — each component's full code is shown.

**3. Type consistency:**
- `COLORS` keys: `background`, `accent`, `primaryText`, `secondaryText`, `vinyl`, `groove` — defined in Task 2 Step 2, used consistently in Tasks 3-5.
- `REPEAT_MAP` keys: `off`, `queue`, `track` — defined in Task 2 Step 2, used in App.js (unchanged from P1).
- Component prop signatures match between definitions (Tasks 3-4) and App.js usage (unchanged from P1):
  - `Vinyl({ artwork, spin })`
  - `Tonearm({ isPlaying })`
  - `Lyrics({ lines, currentIndex })`
  - `Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat })`
  - `PlayerScreen({ currentTrack, isPlaying, position, duration, repeatMode, spin, onTogglePlay, onSkipNext, onSkipPrev, onSeek, onToggleRepeat, onBack })`
  - `PlaylistScreen({ playlist, currentTrack, onSelect })`
- `loadJSON(key, fallback)`, `saveJSON(key, value)`, `removeKey(key)` — defined in Task 2 Step 3, no consumers in P2 (P3 will use them). Not referenced in later tasks — consistent.
- Default exports for components/screens/ErrorBoundary; named exports for data/constants — consistent across all tasks.

**4. Task ordering:**
- Task 1 (install) before Task 2 (storage.js needs async-storage) — correct.
- Task 2 (data/constants) before Task 3 (components import COLORS, VINYL_SIZE, ART_SIZE) — correct.
- Task 3 (components) before Task 4 (screens import components) — correct.
- Task 5 (ErrorBoundary) after Task 4 (wraps App which now imports screens) — correct, though ErrorBoundary could technically come anytime after Task 2 (needs COLORS). Placed last-before-cleanup for logical flow.
- Task 6 (cleanup) last — correct.

Plan is internally consistent and spec-complete.
