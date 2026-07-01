# Player UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal dark player in `App.js` with a modern streaming-style now-playing screen — large album artwork, refined typography, polished controls, subtle depth — without adding any native dependencies.

**Architecture:** Single-file refactor of `App.js`. Track data gains an `artwork` field. Layout becomes a vertical stack (header → artwork → title/artist → slider → time → controls). Background depth is faked with stacked semi-transparent `View`s instead of a gradient library. Shuffle/repeat are visual-only toggle stubs with local state.

**Tech Stack:** React Native 0.75.4, `react-native-track-player` 4.1.1, `@react-native-community/slider` 5.2.0. No new dependencies.

## Global Constraints

- No new native dependencies — must ship without `pod install` or a native rebuild.
- All changes confined to `App.js`. `service.js`, `index.js`, native config untouched.
- Preserve all existing playback logic (init, toggle, skip, seek) — only UI and the `playlist` data shape change.
- Track `artwork` uses stable `https://picsum.photos/seed/<seed>/600/600` URLs.
- Color palette: background `#121212`, accent `#1DB954`, primary text `#ffffff`, secondary text `#b3b3b3`, track-inactive `#ffffff20`.

---

## File Structure

- **Modify:** `App.js` — the entire now-playing screen. Split into:
  - `playlist` data array (now includes `artwork`)
  - `App` component (state + handlers, mostly unchanged)
  - Small inline sub-components (`AlbumArt`, `TrackInfo`, `ProgressBar`, `Controls`) defined in the same file for readability
  - `styles` StyleSheet (rewritten)

No new files. No new tests (project has Jest configured but no UI test infra; verification is manual via simulator).

---

### Task 1: Add artwork to playlist data

**Files:**
- Modify: `App.js:6-25` (the `playlist` array)

**Interfaces:**
- Produces: `playlist` items now include `artwork: string` (URL). Consumed by the `AlbumArt` component in Task 4. TrackPlayer accepts `artwork` on its track objects natively, so no service change needed.

- [ ] **Step 1: Replace the `playlist` array**

Open `App.js` and replace the existing `playlist` declaration (lines 6–25) with:

```js
const playlist = [
  {
    id: "1",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "示例音乐 1",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song1/600/600",
  },
  {
    id: "2",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "示例音乐 2",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song2/600/600",
  },
  {
    id: "3",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "示例音乐 3",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song3/600/600",
  },
];
```

- [ ] **Step 2: Verify the file still parses**

Run: `node -c App.js` is not valid for JSX. Instead run the linter:
```bash
npx eslint App.js
```
Expected: no errors (warnings about `useEffect` deps are pre-existing and acceptable).

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add artwork URLs to playlist tracks"
```

---

### Task 2: Add shuffle/repeat toggle state

**Files:**
- Modify: `App.js` (inside the `App` component, near the existing `useState` calls around line 28–31)

**Interfaces:**
- Produces: two state hooks in `App`: `shuffleOn` / `setShuffleOn` (`boolean`) and `repeatOn` / `setRepeatOn` (`boolean`). Consumed by the `Controls` component in Task 5. Toggling is visual-only — no effect on playback.

- [ ] **Step 1: Add the state declarations**

In `App.js`, find this block inside `App`:

```js
const [currentTrack, setCurrentTrack] = useState(playlist[0]);
const playbackState = usePlaybackState();
const { position, duration } = useProgress();
const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
```

Add two new lines immediately after `isPlayerInitialized`:

```js
const [shuffleOn, setShuffleOn] = useState(false);
const [repeatOn, setRepeatOn] = useState(false);
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add shuffle/repeat visual toggle state"
```

---

### Task 3: Update imports and add `Image` + `Dimensions`

**Files:**
- Modify: `App.js:1-4` (the React Native import block)

**Interfaces:**
- Produces: `Image` and `Dimensions` available for use by sub-components in Tasks 4–5.

- [ ] **Step 1: Update the React Native import line**

Find:

```js
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
```

Replace with:

```js
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, Dimensions } from "react-native";
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors. (Unused-import warnings for `Image`/`Dimensions` will clear once Task 4 uses them.)

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Import Image and Dimensions for artwork rendering"
```

---

### Task 4: Define `AlbumArt` sub-component

**Files:**
- Modify: `App.js` — add a new component between the `playlist` array and the `App` component (around line 27).

**Interfaces:**
- Consumes: `currentTrack.artwork` (string URL) passed from `App` as the `artwork` prop.
- Produces: `<AlbumArt artwork={currentTrack.artwork} />` usable in `App`'s JSX (Task 6).

- [ ] **Step 1: Add the component**

Insert this above `export default function App()`:

```js
const SCREEN_WIDTH = Dimensions.get("window").width;
const ARTWORK_SIZE = Math.min(320, SCREEN_WIDTH - 64);

function AlbumArt({ artwork }) {
  return (
    <View style={styles.artworkWrapper}>
      <Image source={{ uri: artwork }} style={styles.artwork} />
    </View>
  );
}
```

- [ ] **Step 2: Add the matching styles**

In the `styles` StyleSheet, add these entries (the old styles will be replaced in Task 7; for now just append):

```js
artworkWrapper: {
  width: ARTWORK_SIZE,
  height: ARTWORK_SIZE,
  alignSelf: "center",
  borderRadius: 24,
  shadowColor: "#000",
  shadowOpacity: 0.5,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
  marginBottom: 48,
  borderWidth: 1,
  borderColor: "#ffffff20",
  overflow: "hidden",
},
artwork: {
  width: "100%",
  height: "100%",
  borderRadius: 24,
},
```

Note: `ARTWORK_SIZE` is module-scoped, so `styles` can reference it only if computed at render time. To keep it simple, the wrapper uses fixed pixel values via the module const. This is fine because `ARTWORK_SIZE` is computed once at module load — acceptable for a phone app in portrait.

- [ ] **Step 3: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Add AlbumArt component with shadow and rounded corners"
```

---

### Task 5: Define `Controls` sub-component

**Files:**
- Modify: `App.js` — add a new component right after `AlbumArt`.

**Interfaces:**
- Consumes (props): `playbackState` (from `usePlaybackState`), `onPrev`, `onNext`, `onTogglePlay` (callbacks), `shuffleOn`, `repeatOn` (booleans), `onToggleShuffle`, `onToggleRepeat` (callbacks).
- Produces: `<Controls ... />` usable in `App`'s JSX (Task 6).

- [ ] **Step 1: Add the component**

Insert after `AlbumArt`:

```js
function Controls({
  playbackState,
  onPrev,
  onNext,
  onTogglePlay,
  shuffleOn,
  repeatOn,
  onToggleShuffle,
  onToggleRepeat,
}) {
  const isPlaying = playbackState.state === State.Playing;
  const toggleColor = (on) => (on ? "#1DB954" : "#b3b3b3");

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleShuffle} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: toggleColor(shuffleOn) }]}>🔀</Text>
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

      <TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: toggleColor(repeatOn) }]}>🔁</Text>
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
  paddingHorizontal: 8,
  marginTop: 16,
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
  fontSize: 32,
  color: "#fff",
},
playButton: {
  width: 72,
  height: 72,
  borderRadius: 36,
  backgroundColor: "#1DB954",
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#1DB954",
  shadowOpacity: 0.4,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
},
playIcon: {
  fontSize: 32,
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
git commit -m "Add Controls component with shuffle/repeat toggles"
```

---

### Task 6: Rewrite the `App` render tree

**Files:**
- Modify: `App.js` — the `return (...)` block of `App` (currently lines 74–111).

**Interfaces:**
- Consumes: `AlbumArt`, `Controls`, the state and handlers already defined in `App`.
- Produces: the final rendered screen.

- [ ] **Step 1: Replace the return block**

Find the entire `return (...)` inside `App` (the `<SafeAreaView>...</SafeAreaView>` block) and replace with:

```jsx
return (
  <SafeAreaView style={styles.container}>
    <View style={styles.glowTop} />
    <View style={styles.playerContainer}>
      <Text style={styles.headerLabel}>正在播放</Text>

      <AlbumArt artwork={currentTrack.artwork} />

      <View style={styles.trackInfo}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingComplete={seekTo}
        minimumTrackTintColor="#1DB954"
        maximumTrackTintColor="#ffffff20"
        thumbTintColor="#ffffff"
      />

      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      <Controls
        playbackState={playbackState}
        onPrev={skipToPrevious}
        onNext={skipToNext}
        onTogglePlay={togglePlayback}
        shuffleOn={shuffleOn}
        repeatOn={repeatOn}
        onToggleShuffle={() => setShuffleOn((v) => !v)}
        onToggleRepeat={() => setRepeatOn((v) => !v)}
      />
    </View>
  </SafeAreaView>
);
```

- [ ] **Step 2: Verify lint**

Run: `npx eslint App.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Rewrite App render tree with new layout"
```

---

### Task 7: Rewrite the `styles` StyleSheet

**Files:**
- Modify: `App.js` — the entire `styles = StyleSheet.create({...})` block (currently lines 114–176).

**Interfaces:**
- Consumes: style names referenced by `App`, `AlbumArt`, `Controls`. Note: `artworkWrapper`, `artwork`, `controls`, `sideButton`, `sideIcon`, `controlButton`, `controlIcon`, `playButton`, `playIcon` were appended in Tasks 4–5 and must be preserved (or merged) here.
- Produces: final styles for the screen.

- [ ] **Step 1: Replace the entire StyleSheet**

Find `const styles = StyleSheet.create({` through its closing `});` and replace with:

```js
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: "#1DB954",
    opacity: 0.12,
  },
  playerContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 13,
    color: "#b3b3b3",
    textAlign: "center",
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 24,
    textTransform: "uppercase",
  },
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    alignSelf: "center",
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    marginBottom: 48,
    borderWidth: 1,
    borderColor: "#ffffff20",
    overflow: "hidden",
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  trackInfo: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
    textAlign: "center",
  },
  artist: {
    fontSize: 16,
    color: "#b3b3b3",
    textAlign: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  time: {
    color: "#b3b3b3",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 16,
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
    fontSize: 32,
    color: "#fff",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1DB954",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1DB954",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playIcon: {
    fontSize: 32,
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
Expected: "Loading dependency graph, done." with no errors. (This catches syntax/import errors without needing a simulator.)

- [ ] **Step 4: Commit**

```bash
git add App.js
git commit -m "Rewrite styles for modern streaming layout"
```

---

### Task 8: Manual visual verification in iOS simulator

**Files:**
- No file changes. Verification only.

**Interfaces:**
- N/A

- [ ] **Step 1: Start Metro and launch the iOS simulator**

Run in one terminal:
```bash
npm start
```
Run in a second terminal:
```bash
npx react-native run-ios
```
Expected: simulator boots, app installs and launches, no red error screen.

- [ ] **Step 2: Verify the visual checklist**

Confirm each item by looking at the simulator:
- Album artwork renders (picsum image loads), 320×320 with rounded corners and shadow.
- "正在播放" header label visible at top, uppercase, muted gray.
- Title and artist render centered below artwork, single-line (no wrap).
- Slider track: green active portion, white thumb, dark inactive portion.
- Time labels show `0:00` / duration, right-aligned duration updates, digits don't jitter.
- Play button is green circle with shadow; tapping toggles to pause glyph and music plays.
- Prev / next buttons skip tracks and artwork + title update.
- Shuffle and repeat icons turn green when tapped, back to gray when tapped again.

- [ ] **Step 3: Verify no console errors**

In the Metro terminal, watch for red error output or `console.error` lines. Expected: clean after initial load.

- [ ] **Step 4: No commit (verification only)**

If anything fails, file the issue and fix in a follow-up task. Do not mark this task complete until the checklist passes.

---

## Self-Review

- **Spec coverage:** Album artwork → Task 4. Refined typography → Task 7 (`title`, `artist`, `headerLabel`, `time` with `tabular-nums`). Polished controls + shadow → Task 5/7. Subtle depth (glow overlay) → Task 7 (`glowTop`). Shuffle/repeat visual toggles → Task 2/5. Network artwork URLs → Task 1. No native dep → Global Constraints + Task 7 uses `View` overlay not gradient lib. All spec sections covered.
- **Placeholder scan:** No TBD/TODO/vague steps. All code blocks complete.
- **Type consistency:** `artwork` prop is consistently `string`. `AlbumArt` takes `{ artwork }`, `App` passes `currentTrack.artwork`. `Controls` prop names match between Task 5 (definition) and Task 6 (usage): `playbackState`, `onPrev`, `onNext`, `onTogglePlay`, `shuffleOn`, `repeatOn`, `onToggleShuffle`, `onToggleRepeat`. Style names referenced in render (Task 6) all defined in Task 7. `ARTWORK_SIZE` referenced in Task 4 styles and Task 7 styles — defined in Task 4 module scope, available to both.

Plan is internally consistent.
