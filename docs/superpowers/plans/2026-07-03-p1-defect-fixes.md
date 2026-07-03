# P1 Defect Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three existing defects in the vinyl MP3 player — wire three-state loop mode to TrackPlayer, remove dead list icon, add layered error handling — without expanding scope or files.

**Architecture:** All changes in `App.js`. Replace `loopOn` boolean with `repeatMode` three-state, wire to `TrackPlayer.setRepeatMode`. Delete dead `☰` button. Add `initError` state + full-screen error page, `playback-error` event listener showing `Alert`, and try-catch around skip functions for boundary safety.

**Tech Stack:** React Native 0.75.4, react-native-track-player 4.1.1 (uses `RepeatMode` enum + `setRepeatMode` API), `@react-native-community/slider` 5.2.0. No new dependencies.

## Global Constraints

- React Native 0.75.4, React 18.3.1 (do not change versions).
- `react-native-track-player` 4.1.1 — `RepeatMode` and `setRepeatMode` are stable APIs in this version.
- No new npm dependencies.
- All changes in `App.js` only. `service.js`, `index.js`, `app.json` untouched.
- Preserve existing visual style: background `#1a1a1a`, accent `#C20C0C`, primary text `#ffffff`, secondary text `#b3b3b3`.
- Preserve existing `playlist` data shape and `PlayerScreen`/`PlaylistScreen` component boundaries.
- No automated tests exist; verification is `npx eslint App.js` + manual iOS simulator check.
- Spec: `docs/superpowers/specs/2026-07-03-p1-defect-fixes-design.md`.

## File Structure

- **Modify:** `App.js` — single file containing all components (`App`, `PlayerScreen`, `PlaylistScreen`, `Controls`, `Vinyl`, `Tonearm`, `Lyrics`) and styles. All P1 changes land here. No new files. No module split (deferred to P2).

---

### Task 1: Update imports for Alert and RepeatMode

**Files:**
- Modify: `App.js:1-15` (the import block at top of file)

**Interfaces:**
- Produces: `Alert` available from `react-native`; `RepeatMode` available from `react-native-track-player`. Consumed by Task 2 (RepeatMode in `REPEAT_MAP` + `initPlayer`) and Task 6 (Alert in playback-error listener).

- [ ] **Step 1: Add `Alert` to the react-native import**

In `App.js`, find the react-native import block (lines 2-13):

```js
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
  FlatList,
} from "react-native";
```

Replace with (adding `Alert` after `FlatList`):

```js
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
  FlatList,
  Alert,
} from "react-native";
```

- [ ] **Step 2: Add `RepeatMode` to the react-native-track-player import**

Find line 15:

```js
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
```

Replace with:

```js
import TrackPlayer, { usePlaybackState, State, useProgress, RepeatMode } from "react-native-track-player";
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add Alert and RepeatMode imports for P1 defect fixes"
```

---

### Task 2: Implement three-state loop mode

This task replaces the `loopOn` boolean with a `repeatMode` three-state (`'off' | 'queue' | 'track'`), wires it to `TrackPlayer.setRepeatMode`, updates `Controls` props and icon logic, updates `PlayerScreen` props, and updates `App`'s render — all in one commit so the app stays in a working state.

**Files:**
- Modify: `App.js` — `Controls` component (lines 144-170), `PlayerScreen` component (lines 172-250), `App` component (lines 295-420)

**Interfaces:**
- Consumes: `RepeatMode` from Task 1.
- Produces: `Controls` accepts `repeatMode: 'off' | 'queue' | 'track'` and `onToggleRepeat: () => void` instead of `loopOn` / `onToggleLoop`. `PlayerScreen` forwards the same props. `App` owns `repeatMode` state and `toggleRepeat` handler.

- [ ] **Step 1: Add REPEAT_MAP constant**

Find the constants block (lines 71-73):

```js
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
const ART_SIZE = Math.min(220, VINYL_SIZE - 120);
```

Insert immediately after (after line 73, before `function Vinyl`):

```js
const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};
```

- [ ] **Step 2: Update Controls component props and icon logic**

Find the `Controls` function (lines 144-170):

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

Replace the entire function with:

```js
function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat }) {
  const accent = (on) => (on ? "#C20C0C" : "#b3b3b3");
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
```

Note: this also removes the dead `☰` list icon button (P1 defect #2). Both defects touching `Controls` are handled in this one edit so the component isn't edited twice.

- [ ] **Step 3: Update PlayerScreen props**

Find the `PlayerScreen` function signature (line 172):

```js
function PlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  loopOn,
  spin,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onToggleLoop,
  onBack,
}) {
```

Replace with:

```js
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
```

- [ ] **Step 4: Update Controls usage inside PlayerScreen**

Find the Controls usage inside PlayerScreen's return (around line 240-247):

```js
      <Controls
        isPlaying={isPlaying}
        onPrev={onSkipPrev}
        onNext={onSkipNext}
        onTogglePlay={onTogglePlay}
        loopOn={loopOn}
        onToggleLoop={onToggleLoop}
      />
```

Replace with:

```js
      <Controls
        isPlaying={isPlaying}
        onPrev={onSkipPrev}
        onNext={onSkipNext}
        onTogglePlay={onTogglePlay}
        repeatMode={repeatMode}
        onToggleRepeat={onToggleRepeat}
      />
```

- [ ] **Step 5: Replace loopOn state with repeatMode in App**

Find in the `App` component (around line 300):

```js
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const [view, setView] = useState("list");
```

Replace with:

```js
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");
```

- [ ] **Step 6: Add toggleRepeat handler and update initPlayer**

Find the `initPlayer` function (around line 343):

```js
  const initPlayer = async () => {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    setIsPlayerInitialized(true);
  };
```

Replace with:

```js
  const initPlayer = async () => {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
    setIsPlayerInitialized(true);
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      const next = prev === "off" ? "queue" : prev === "queue" ? "track" : "off";
      TrackPlayer.setRepeatMode(REPEAT_MAP[next]);
      return next;
    });
  };
```

- [ ] **Step 7: Update App's PlayerScreen render to pass new props**

Find the PlayerScreen usage at the bottom of `App` (around line 405-419):

```js
  return (
    <PlayerScreen
      currentTrack={currentTrack}
      isPlaying={isPlaying}
      position={position}
      duration={duration}
      loopOn={loopOn}
      spin={spin}
      onTogglePlay={togglePlayback}
      onSkipNext={skipToNext}
      onSkipPrev={skipToPrevious}
      onSeek={seekTo}
      onToggleLoop={() => setLoopOn((v) => !v)}
      onBack={onBack}
    />
  );
```

Replace with:

```js
  return (
    <PlayerScreen
      currentTrack={currentTrack}
      isPlaying={isPlaying}
      position={position}
      duration={duration}
      repeatMode={repeatMode}
      spin={spin}
      onTogglePlay={togglePlayback}
      onSkipNext={skipToNext}
      onSkipPrev={skipToPrevious}
      onSeek={seekTo}
      onToggleRepeat={toggleRepeat}
      onBack={onBack}
    />
  );
```

- [ ] **Step 8: Verify lint**

Run: `npx eslint App.js`
Expected: no errors. If "loopOn is not defined" or similar appears, search for any remaining `loopOn` / `onToggleLoop` references and replace them — they should all be gone after Step 7.

- [ ] **Step 9: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Loading dependency graph, done." with no errors.

- [ ] **Step 10: Commit**

```bash
git add App.js
git commit -m "Wire three-state loop mode to TrackPlayer and remove dead list icon"
```

---

### Task 3: Add init failure error page

This task wraps `initPlayer` in try-catch, adds an `initError` state, a `retryInit` handler, and a full-screen error page rendered when `initError` is set.

**Files:**
- Modify: `App.js` — `App` component state, `initPlayer`, render branches, `styles`

**Interfaces:**
- Produces: `App` has `initError: string | null` state and `retryInit: () => void` handler. When `initError` is non-null, renders error page instead of loading screen or player.

- [ ] **Step 1: Add initError state**

Find in the `App` component (the state block you edited in Task 2 Step 5):

```js
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");
```

Replace with:

```js
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");
```

- [ ] **Step 2: Wrap initPlayer in try-catch and add retryInit**

Find the `initPlayer` function (edited in Task 2 Step 6):

```js
  const initPlayer = async () => {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
    setIsPlayerInitialized(true);
  };
```

Replace with:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.add(playlist);
      await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      setIsPlayerInitialized(true);
    } catch (e) {
      setInitError((e && e.message) || "播放器初始化失败");
    }
  };

  const retryInit = () => {
    setInitError(null);
    initPlayer();
  };
```

- [ ] **Step 3: Add initError render branch**

Find the loading-screen guard (around line 386):

```js
  if (!isPlayerInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  }
```

Replace with:

```js
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

  if (!isPlayerInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  }
```

- [ ] **Step 4: Add error page styles**

Find the `loading` style in the StyleSheet (around line 436):

```js
  loading: {
    color: "#fff",
    textAlign: "center",
    marginTop: 100,
  },
```

Insert immediately after it:

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

- [ ] **Step 5: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add App.js
git commit -m "Add init failure error page with retry"
```

---

### Task 4: Wrap skip functions in try-catch

This task wraps `skipToNext` and `skipToPrevious` in try-catch so queue-boundary errors (when `repeatMode === 'off'`) are silently ignored instead of surfacing in the console. This must be done before Task 5 so the playback-error listener (registered once with empty deps) captures the try-catch version of `skipToNext`.

**Files:**
- Modify: `App.js` — `skipToNext` and `skipToPrevious` functions in `App` (around lines 358-368)

**Interfaces:**
- Produces: `skipToNext` and `skipToPrevious` swallow boundary errors silently. `currentTrack` stays unchanged when a boundary is hit. The function signatures are unchanged — Task 5's listener references `skipToNext` directly.

- [ ] **Step 1: Wrap skipToNext in try-catch**

Find the `skipToNext` function (around line 358):

```js
  const skipToNext = async () => {
    await TrackPlayer.skipToNext();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };
```

Replace with:

```js
  const skipToNext = async () => {
    try {
      await TrackPlayer.skipToNext();
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    } catch (e) {
      // Queue boundary (repeatMode=off at last track) — silently ignore.
    }
  };
```

- [ ] **Step 2: Wrap skipToPrevious in try-catch**

Find the `skipToPrevious` function (around line 364):

```js
  const skipToPrevious = async () => {
    await TrackPlayer.skipToPrevious();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };
```

Replace with:

```js
  const skipToPrevious = async () => {
    try {
      await TrackPlayer.skipToPrevious();
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    } catch (e) {
      // Queue boundary (at first track) — silently ignore.
    }
  };
```

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Silently ignore queue-boundary errors in skip functions"
```

---

### Task 5: Add playback-error event listener

This task registers a `playback-error` event listener in `App` that shows an `Alert` offering to skip to the next track. The listener is registered once on mount with empty deps; it captures `skipToNext` at first render, which (after Task 4) already includes try-catch.

**Files:**
- Modify: `App.js` — `App` component, add a new `useEffect` after the existing `isPlaying` spin effect

**Interfaces:**
- Consumes: `Alert` from Task 1, `skipToNext` from Task 4 (with try-catch already applied).
- Produces: When TrackPlayer emits `playback-error`, an `Alert` appears with "下一首" / "取消" options.

- [ ] **Step 1: Add the playback-error useEffect**

Find the `isPlaying` spin effect (around lines 313-319):

```js
  useEffect(() => {
    if (isPlaying) {
      startSpin();
    } else {
      stopSpin();
    }
  }, [isPlaying]);
```

Insert immediately after it (after the closing `});` of that effect, before `const startSpin`):

```js
  useEffect(() => {
    const sub = TrackPlayer.addEventListener("playback-error", () => {
      Alert.alert(
        "播放失败",
        "当前歌曲无法播放，是否跳到下一首？",
        [
          { text: "下一首", onPress: () => skipToNext() },
          { text: "取消", style: "cancel" },
        ]
      );
    });
    return () => sub.remove();
  }, []);
```

Note: empty dependency array means the listener registers once on mount. `skipToNext` is captured at first render — after Task 4 it already has try-catch, so the Alert's "下一首" button is safe even at queue boundaries.

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors. (If eslint warns about missing `skipToNext` in the deps array, that's expected — the empty-deps pattern is intentional here. Add an `// eslint-disable-next-line react-hooks/exhaustive-deps` comment on the closing `}, []);` line if the project's eslint config enforces that rule.)

- [ ] **Step 3: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: "Loading dependency graph, done." with no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Show Alert on playback-error with option to skip next"
```

---

### Task 6: Manual verification in iOS simulator

No file changes. Verification only — run through the spec's acceptance checklist.

**Files:**
- No file changes.

**Interfaces:**
- N/A

- [ ] **Step 1: Reload app in simulator**

If Metro is running, save any file to trigger fast reload. Otherwise start Metro:
```bash
npx react-native start
```
Then in the simulator press `Cmd+R` to reload.

- [ ] **Step 2: Verify loop mode (three-state cycle)**

In the simulator:
- [ ] Open the app → song list appears → tap a song → player screen appears.
- [ ] Loop icon shows gray `🔁` by default (`repeatMode='off'`).
- [ ] Tap loop icon once → icon turns red `🔁` (`repeatMode='queue'`).
- [ ] With `queue` active, let the current song finish (or seek near end) → playback wraps to first track in playlist automatically.
- [ ] Tap loop icon again → icon turns red `🔂` (`repeatMode='track'`).
- [ ] With `track` active, let the current song finish → same song replays automatically.
- [ ] Tap loop icon a third time → icon returns to gray `🔁` (`repeatMode='off'`).
- [ ] Switching songs (prev/next) does not reset `repeatMode` — the icon color/state persists.

- [ ] **Step 3: Verify list icon removal**

- [ ] Look at the bottom Controls row → only 4 buttons visible: loop / prev / play-pause / next.
- [ ] No `☰` icon present.
- [ ] Buttons are evenly spaced across the row (no visual gap on the right).
- [ ] Top-bar `‹` back button still navigates to the song list.

- [ ] **Step 4: Verify skip boundary handling**

- [ ] Set `repeatMode='off'` (gray `🔁`).
- [ ] Play the last song in the playlist → press next → nothing happens (silent), `currentTrack` unchanged, no console error.
- [ ] Play the first song in the playlist → press previous → nothing happens (silent), `currentTrack` unchanged, no console error.
- [ ] Set `repeatMode='queue'` → at last song press next → wraps to first song (TrackPlayer handles automatically, no error).

- [ ] **Step 5: Verify playback error Alert**

- [ ] Turn off network on the dev machine (Wi-Fi off or simulator in airplane mode).
- [ ] Reload the app, pick a song → after a brief timeout, the "播放失败" Alert appears with "下一首" and "取消" buttons.
- [ ] Tap "取消" → Alert dismisses, stays on current (paused) track.
- [ ] Tap "下一首" → skips to next track (or silently no-ops if at boundary with `repeatMode='off'`).
- [ ] Re-enable network afterward.

- [ ] **Step 6: Verify init error page (best-effort)**

This is hard to trigger without code injection. Skip unless you temporarily break `setupPlayer` to test:
- [ ] (Optional) Temporarily throw inside `initPlayer` → reload → "加载失败" page appears with the error message and a "重试" button.
- [ ] (Optional) Tap "重试" → `initError` clears and `initPlayer` runs again.
- [ ] Revert the temporary break before committing.

- [ ] **Step 7: Check Metro console**

- [ ] No red-box errors in simulator.
- [ ] No uncaught errors in Metro terminal (previously `skipToNext` at queue boundary would log a warning/error — that should be gone now).

- [ ] **Step 8: No commit (verification only)**

If any checklist item fails, file a follow-up fix task. Do not mark P1 complete until all items pass (init error page items are optional per Step 6).

---

## Self-Review

- **Spec coverage:**
  - Spec §3.1 (loop mode three-state) → Task 2 (state + toggleRepeat + Controls + PlayerScreen + App wiring + initPlayer sync).
  - Spec §3.1.4 (Controls icon logic 🔁/🔂 + color) → Task 2 Step 2.
  - Spec §3.2 (remove ☰ list icon) → Task 2 Step 2 (folded into Controls edit since both touch the same component).
  - Spec §3.3.1 (init failure error page + retry) → Task 3.
  - Spec §3.3.2 (playback-error Alert) → Task 5.
  - Spec §3.3.3 (skip boundary try-catch) → Task 4.
  - Spec §5 (acceptance checklist) → Task 6.
  - All spec sections covered.

- **Placeholder scan:** No TBD/TODO. Every code step has complete code. No "add appropriate error handling" — the exact try-catch and Alert code is shown.

- **Type consistency:**
  - `repeatMode: 'off' | 'queue' | 'track'` — used consistently in Task 2 (state, REPEAT_MAP keys, Controls props, PlayerScreen props).
  - `toggleRepeat` — defined in Task 2 Step 6, referenced in Task 2 Step 7 as `onToggleRepeat={toggleRepeat}`. Consistent.
  - `onToggleRepeat` — prop name in Controls (Task 2 Step 2), PlayerScreen (Task 2 Step 3/4), App render (Task 2 Step 7). Consistent.
  - `initError` — state name in Task 3 Step 1, used in Step 2 (setInitError), Step 3 (render guard). Consistent.
  - `retryInit` — defined in Task 3 Step 2, used in Step 3. Consistent.
  - `REPEAT_MAP` — defined in Task 2 Step 1, used in Step 6 (initPlayer + toggleRepeat). Consistent.
  - `skipToNext` — modified in Task 4, referenced in Task 5. The empty-deps useEffect in Task 5 captures the post-Task-4 version (try-catch included). Task ordering ensures this.

- **Task ordering:** Task 4 (try-catch) before Task 5 (listener) is intentional — ensures the listener's captured `skipToNext` includes try-catch. Documented in both task headers.

Plan is internally consistent and spec-complete.
