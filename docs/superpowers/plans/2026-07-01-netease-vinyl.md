# NetEase Vinyl Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimagine `App.js` as a NetEase Cloud Music-style vinyl player — rotating black vinyl disc with album artwork, lowering tonearm, scrolling lyrics, red accent.

**Architecture:** Single-file refactor of `App.js`. New inline sub-components: `Vinyl`, `Tonearm`, `Lyrics`, `Controls`. Rotation uses `Animated.Value` + `Animated.loop` with stop/resume preserving angle. Tonearm angle uses `Animated.timing` toggled by play state. Lyric index derived from `position/duration`.

**Tech Stack:** React Native 0.75.4, `react-native-track-player` 4.1.1, `@react-native-community/slider` 5.2.0, `Animated` (built-in). No new dependencies.

## Global Constraints

- No new native dependencies — must ship without `pod install` or rebuild.
- All changes in `App.js`. `service.js`, `index.js`, native config untouched.
- Preserve existing playback logic (init, toggle, skip, seek) — only UI and `playlist` data shape change.
- Color palette: background `#1a1a1a`, accent `#C20C0C`, primary text `#ffffff`, secondary text `#b3b3b3`, vinyl black `#0a0a0a`, groove rings `#1a1a1a`/`#222`.
- Track `artwork` uses `https://picsum.photos/seed/<seed>/600/600`.
- Each track has `lyrics: string[]` (8 placeholder Chinese lines).

---

## File Structure

- **Modify:** `App.js` — full rewrite of the screen. New structure:
  - `playlist` data (with `artwork` + `lyrics`)
  - `App` component (existing state + new `Animated` refs + derived `lyricIndex`)
  - `Vinyl` sub-component
  - `Tonearm` sub-component
  - `Lyrics` sub-component
  - `Controls` sub-component
  - `styles` StyleSheet (rewritten)

No new files. No automated tests (project lacks UI test infra; verification is manual via simulator).

---

### Task 1: Update playlist data with artwork and lyrics

**Files:**
- Modify: `App.js:6-25` (the `playlist` array)

**Interfaces:**
- Produces: `playlist` items now include `artwork: string` and `lyrics: string[]`. Consumed by `Vinyl` (artwork) in Task 4 and `Lyrics` (lyrics) in Task 6.

- [ ] **Step 1: Replace the `playlist` array**

Open `App.js` and replace the existing `playlist` declaration with:

```js
const playlist = [
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

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add artwork and placeholder lyrics to playlist"
```

---

### Task 2: Update imports and add Animated

**Files:**
- Modify: `App.js:1-4` (the import block)

**Interfaces:**
- Produces: `Animated`, `Image`, `Dimensions`, `useRef`, `useEffect` available for sub-components.

- [ ] **Step 1: Replace imports**

Replace the top of `App.js` (lines 1–4):

```js
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import Slider from "@react-native-community/slider";
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors (unused-import warnings clear as later tasks use them).

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add Animated, Image, Dimensions imports"
```

---

### Task 3: Add module constants

**Files:**
- Modify: `App.js` — add after the `playlist` array, before `App`.

**Interfaces:**
- Produces: `VINYL_SIZE` (340), `ART_SIZE` (220), `LYRIC_WINDOW` (3) used by sub-components and styles.

- [ ] **Step 1: Add constants**

Insert after `playlist` and before `export default function App()`:

```js
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
const ART_SIZE = Math.min(220, VINYL_SIZE - 120);
const LYRIC_WINDOW = 3;
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add vinyl sizing constants"
```

---

### Task 4: Define Vinyl sub-component

**Files:**
- Modify: `App.js` — add after the constants, before `App`.

**Interfaces:**
- Consumes: `artwork` (string URL), `spin` (an `Animated.Value` driving rotation, owned by `App`).
- Produces: `<Vinyl artwork={...} spin={spin} />` usable in `App`'s JSX (Task 8).

- [ ] **Step 1: Add the component**

Insert before `export default function App()`:

```js
function Vinyl({ artwork, spin }) {
  const spinDeg = spin.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.vinylWrapper}>
      <Animated.View
        style={[
          styles.vinyl,
          { transform: [{ rotate: spinDeg }] },
        ]}
      >
        {/* Groove rings */}
        <View style={[styles.groove, { width: VINYL_SIZE - 20, height: VINYL_SIZE - 20, borderRadius: (VINYL_SIZE - 20) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 60, height: VINYL_SIZE - 60, borderRadius: (VINYL_SIZE - 60) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 100, height: VINYL_SIZE - 100, borderRadius: (VINYL_SIZE - 100) / 2 }]} />

        {/* Album artwork */}
        <View style={styles.artWrapper}>
          <Image source={{ uri: artwork }} style={styles.art} />
          <View style={styles.centerLabel} />
        </View>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 2: Append matching styles (will be merged into final StyleSheet in Task 9)**

Add to `styles`:

```js
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
  backgroundColor: "#0a0a0a",
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
  borderColor: "#222",
},
artWrapper: {
  width: ART_SIZE,
  height: ART_SIZE,
  borderRadius: ART_SIZE / 2,
  borderWidth: 2,
  borderColor: "#fff",
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
  backgroundColor: "#C20C0C",
},
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add Vinyl component with groove rings and artwork"
```

---

### Task 5: Define Tonearm sub-component

**Files:**
- Modify: `App.js` — add after `Vinyl`.

**Interfaces:**
- Consumes: `isPlaying` (boolean).
- Produces: `<Tonearm isPlaying={...} />` usable in `App`'s JSX (Task 8).

- [ ] **Step 1: Add the component**

Insert after `Vinyl`:

```js
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
    <Animated.View
      style={[
        styles.tonearm,
        { transform: [{ rotate: rot }] },
      ]}
    >
      <View style={styles.tonearmBar} />
      <View style={styles.tonearmHead} />
    </Animated.View>
  );
}
```

- [ ] **Step 2: Append matching styles**

Add to `styles`:

```js
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
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add Tonearm component with animated angle"
```

---

### Task 6: Define Lyrics sub-component

**Files:**
- Modify: `App.js` — add after `Tonearm`.

**Interfaces:**
- Consumes: `lines` (string[]), `currentIndex` (number, 0-based into `lines`).
- Produces: `<Lyrics lines={...} currentIndex={...} />` usable in `App`'s JSX (Task 8).

- [ ] **Step 1: Add the component**

Insert after `Tonearm`:

```js
function Lyrics({ lines, currentIndex }) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: -currentIndex,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [currentIndex, offset]);

  const translateY = offset.interpolate({
    inputRange: [-lines.length, lines.length],
    outputRange: [lines.length * 28, -lines.length * 28],
  });

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
          <Text
            key={idx}
            style={[styles.lyricLine, isCurrent && styles.lyricCurrent]}
            numberOfLines={1}
          >
            {text}
          </Text>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Append matching styles**

Add to `styles`:

```js
lyricsContainer: {
  height: 90,
  alignItems: "center",
  justifyContent: "center",
  marginHorizontal: 24,
  marginBottom: 16,
},
lyricLine: {
  fontSize: 14,
  color: "#b3b3b3",
  opacity: 0.4,
  marginVertical: 4,
  textAlign: "center",
},
lyricCurrent: {
  fontSize: 17,
  color: "#ffffff",
  opacity: 1,
  fontWeight: "600",
},
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add Lyrics component with current-line highlight"
```

---

### Task 7: Define Controls sub-component

**Files:**
- Modify: `App.js` — add after `Lyrics`.

**Interfaces:**
- Consumes (props): `isPlaying`, `onPrev`, `onNext`, `onTogglePlay`, `loopOn`, `onToggleLoop`.
- Produces: `<Controls ... />` usable in `App`'s JSX (Task 8).

- [ ] **Step 1: Add the component**

Insert after `Lyrics`:

```js
function Controls({ isPlaying, onPrev, onNext, onTogglePlay, loopOn, onToggleLoop }) {
  const accent = (on) => (on ? "#C20C0C" : "#b3b3b3");

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleLoop} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: accent(loopOn) }]}>🔁</Text>
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

      <TouchableOpacity style={styles.sideButton}>
        <Text style={styles.sideIcon}>☰</Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: Append matching styles**

Add to `styles`:

```js
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
  color: "#fff",
},
playButton: {
  width: 64,
  height: 64,
  borderRadius: 32,
  borderWidth: 2,
  borderColor: "#fff",
  alignItems: "center",
  justifyContent: "center",
},
playIcon: {
  fontSize: 28,
  color: "#fff",
  marginTop: -2,
},
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add Controls component with loop/list toggles"
```

---

### Task 8: Rewrite App component body (state, refs, handlers, render)

**Files:**
- Modify: `App.js` — the entire `App` function from `export default function App()` through its closing `}`.

**Interfaces:**
- Consumes: `Vinyl`, `Tonearm`, `Lyrics`, `Controls`, the `playlist` data, `Animated`.
- Produces: the final rendered screen.

- [ ] **Step 1: Replace the entire `App` function**

Find `export default function App() {` and replace the whole function (through its matching closing brace, just before `const styles =`) with:

```js
export default function App() {
  const [currentTrack, setCurrentTrack] = useState(playlist[0]);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [loopOn, setLoopOn] = useState(false);

  // Vinyl rotation
  const spin = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(null);

  const isPlaying = playbackState.state === State.Playing;

  // Lyric index derived from progress
  const lyricIndex = useMemo(() => {
    if (!currentTrack.lyrics || !duration) return 0;
    const idx = Math.floor((position / duration) * currentTrack.lyrics.length);
    return Math.min(idx, currentTrack.lyrics.length - 1);
  }, [position, duration, currentTrack]);

  useEffect(() => {
    initPlayer();
    return () => TrackPlayer.reset();
  }, []);

  // Start/stop rotation based on isPlaying
  useEffect(() => {
    if (isPlaying) {
      startSpin();
    } else {
      stopSpin();
    }
  }, [isPlaying]);

  const startSpin = () => {
    if (spinAnim.current) return;
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: spin._value + 360,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetOnStart: false }
    );
    spinAnim.current = anim;
    anim.start();
  };

  const stopSpin = () => {
    if (spinAnim.current) {
      spinAnim.current.stop();
      spinAnim.current = null;
    }
  };

  const initPlayer = async () => {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    setIsPlayerInitialized(true);
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const skipToNext = async () => {
    await TrackPlayer.skipToNext();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };

  const skipToPrevious = async () => {
    await TrackPlayer.skipToPrevious();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };

  const seekTo = async (value) => {
    await TrackPlayer.seekTo(value);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!isPlayerInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topIcon}>‹</Text>
        <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.topIcon}>⤴</Text>
      </View>

      {/* Vinyl + tonearm */}
      <View style={styles.vinylStage}>
        <Vinyl artwork={currentTrack.artwork} spin={spin} />
        <Tonearm isPlaying={isPlaying} />
      </View>

      {/* Lyrics */}
      <Lyrics lines={currentTrack.lyrics || []} currentIndex={lyricIndex} />

      {/* Progress */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingComplete={seekTo}
        minimumTrackTintColor="#C20C0C"
        maximumTrackTintColor="#ffffff20"
        thumbTintColor="#ffffff"
      />
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      {/* Controls */}
      <Controls
        isPlaying={isPlaying}
        onPrev={skipToPrevious}
        onNext={skipToNext}
        onTogglePlay={togglePlayback}
        loopOn={loopOn}
        onToggleLoop={() => setLoopOn((v) => !v)}
      />
    </SafeAreaView>
  );
}
```

Note: `spin._value` access is a documented React Native pattern for reading the current value of an `Animated.Value` synchronously during render/handler setup. It works but is technically internal; acceptable for this scope.

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Rewrite App body with vinyl/tonearm/lyrics/controls composition"
```

---

### Task 9: Rewrite the styles StyleSheet

**Files:**
- Modify: `App.js` — the entire `styles = StyleSheet.create({...})` block.

**Interfaces:**
- Consumes: all style names referenced by `App`, `Vinyl`, `Tonearm`, `Lyrics`, `Controls`. Tasks 4–7 appended styles to the old StyleSheet; this task replaces the whole block with the consolidated final version (merging and removing duplicates).
- Produces: final styles.

- [ ] **Step 1: Replace the entire StyleSheet**

Find `const styles = StyleSheet.create({` through its closing `});` and replace with:

```js
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: "#C20C0C",
    opacity: 0.05,
  },
  loading: {
    color: "#fff",
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
  topIcon: {
    fontSize: 24,
    color: "#fff",
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 16,
  },
  vinylStage: {
    position: "relative",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
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
    backgroundColor: "#0a0a0a",
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
    borderColor: "#222",
  },
  artWrapper: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    borderWidth: 2,
    borderColor: "#fff",
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
    backgroundColor: "#C20C0C",
  },
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
  lyricsContainer: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  lyricLine: {
    fontSize: 14,
    color: "#b3b3b3",
    opacity: 0.4,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    color: "#ffffff",
    opacity: 1,
    fontWeight: "600",
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
    color: "#b3b3b3",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
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
    color: "#fff",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: "#fff",
    marginTop: -2,
  },
});
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 3: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Loading dependency graph, done." with no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Rewrite styles for NetEase vinyl layout"
```

---

### Task 10: Reload app in simulator and verify

**Files:**
- No file changes. Verification only.

**Interfaces:**
- N/A

- [ ] **Step 1: Trigger Metro fast reload**

The running Metro server will hot-reload on save. If not, in the simulator press `Cmd+R` to reload.

- [ ] **Step 2: Verify the visual checklist**

Confirm each item in the iOS simulator:
- Background `#1a1a1a` with subtle red glow at top.
- Top bar shows back chevron, song title centered, share icon.
- Vinyl disc renders: black circle, 3 groove rings visible, center album artwork (220px circle), red center label.
- Tonearm visible at top-right of vinyl; lowers (~20°) when play starts, lifts (~-30°) when paused, smooth 400ms.
- Disc rotates continuously while playing; stops on pause, resumes from same angle on play.
- Lyrics area shows ~3 lines: current white 17px, neighbors gray 14px opacity 0.4. Current line advances as position progresses.
- Progress bar red active track, white thumb, seek works.
- Time labels show position/duration, tabular-nums.
- Bottom controls: loop (toggles red/gray), prev, play/pause (white outlined circle), next, list icon.
- Prev/next update artwork, title, lyrics; lyric index resets to 0.
- No console errors in Metro terminal.

- [ ] **Step 3: No commit (verification only)**

If any item fails, file a fix task. Do not mark complete until checklist passes.

---

## Self-Review

- **Spec coverage:** Vinyl disc + grooves + artwork + center label → Task 4. Tonearm with animated angle → Task 5. Lyrics 3-line window with current highlight → Task 6. Controls with loop/list → Task 7. Rotation start/stop preserving angle → Task 8 (`startSpin`/`stopSpin` using `Animated.loop` + `stop()`). Lyric index from position/duration → Task 8 (`lyricIndex` useMemo). Red accent + dark background + glow → Task 9 (`#1a1a1a`, `#C20C0C`, `glowTop`). Track data with artwork + lyrics → Task 1. No native dep → Global Constraints.
- **Placeholder scan:** No TBD/TODO. All code blocks complete.
- **Type consistency:** `Vinyl` props `{ artwork, spin }` match Task 8 usage. `Tonearm` props `{ isPlaying }` match. `Lyrics` props `{ lines, currentIndex }` match. `Controls` props `{ isPlaying, onPrev, onNext, onTogglePlay, loopOn, onToggleLoop }` match. `spin` is an `Animated.Value` created in `App` (Task 8) and passed to `Vinyl` (Task 4) — consistent. `VINYL_SIZE`, `ART_SIZE` defined in Task 3, used in Tasks 4 and 9 — consistent.

Plan is internally consistent.
