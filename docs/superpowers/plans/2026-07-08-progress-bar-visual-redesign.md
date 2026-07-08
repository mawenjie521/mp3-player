# Progress Bar Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `@react-native-community/slider` inside `ProgressBar` with a hand-built `View` + `PanResponder` progress bar that is visibly thicker, has a clearly-visible unplayed track, and a more prominent played portion — while preserving the drag-to-seek behavior shipped in the prior phase.

**Architecture:** Rewrite `src/components/ProgressBar.js` internals: swap the `<Slider>` for a `View`-based layout (40px touch container holding a 6px track + 16px thumb, positioned via percentage widths driven by a `progress` ratio). `PanResponder` handles drag start/move/release with the same `isDragging` / `dragValue` / `onSeek` contract. Props are unchanged, so `PlayerScreen` is not touched.

**Tech Stack:** React Native 0.75.4 (`View`, `Text`, `PanResponder`, `StyleSheet`), React 18 hooks (`useState`, `useRef`). No new dependencies. `@react-native-community/slider` is removed from `ProgressBar.js` imports but stays in `package.json`.

## Global Constraints

- **No automated tests** — this project has no test suite. Verification is Metro bundle build + manual iOS simulator check. Do NOT run `npm test` (it exits 1 with "No tests found" — pre-existing, not a regression).
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must exit 0 with `info Done writing bundle output`.
- **eslint is not configured** — do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Rewrite ProgressBar with custom track"), with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer (matches recent project history).
- **COLORS:** `COLORS.accent = "#C20C0C"`, `COLORS.primaryText = "#ffffff"`, `COLORS.secondaryText = "#b3b3b3"`, `COLORS.background = "#1a1a1a"` — defined in `src/data/constants.js`. Import `COLORS` directly, do not thread through props.
- **No new dependencies.** `PanResponder` and `useRef` are React Native / React built-ins.
- **Only `src/components/ProgressBar.js` is touched.** `PlayerScreen.js`, `App.js`, and all other files are unchanged. The `@react-native-community/slider` dependency stays in `package.json` (removal is out of scope).
- **Props contract preserved:** `ProgressBar` must accept `position` (number, seconds), `duration` (number, seconds), `onSeek` (fn: `(value: number) => void`) — same as today. `PlayerScreen` renders `<ProgressBar position={position} duration={duration} onSeek={onSeek} />` and must not need to change.

## File Structure

- **`src/components/ProgressBar.js`** (rewrite): Replace the `Slider` import + JSX with `PanResponder` + `View`-based layout. Same props, same drag contract, new visual presentation. `formatTime` helper stays. Styles change to reflect the new layout (wrapper padding, touch container, track background, track fill, thumb, time labels).

---

### Task 1: Rewrite ProgressBar with custom View + PanResponder track

Single cohesive rewrite of `src/components/ProgressBar.js`. The file is self-contained — no other file changes. One task, one reviewer gate, one commit.

**Files:**
- Modify (rewrite): `src/components/ProgressBar.js` (currently 70 lines; target ~110 lines)

**Interfaces:**
- Consumes: `position` (number, seconds) and `duration` (number, seconds) from `useProgress()` in `App.js:31`; `onSeek` is `seekTo` from `App.js:200-202` (`async (value) => { await TrackPlayer.seekTo(value); }`). All three are passed by `App.js` to `PlayerScreen` (App.js:277-284) and forwarded through props unchanged.
- Produces: `ProgressBar` React component (default export). Props signature identical to prior version — `PlayerScreen` needs no changes. No later task consumes this; Task 1 is terminal.

- [ ] **Step 1: Rewrite `src/components/ProgressBar.js`**

Replace the entire file contents with:

```jsx
import React, { useState, useRef } from "react";
import { View, Text, PanResponder, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function ProgressBar({ position, duration, onSeek }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const containerWidth = useRef(0);

  const safeDuration = Math.max(duration || 0, 1);
  const displayValue = isDragging
    ? dragValue
    : Math.min(position, safeDuration);
  const progress = Math.max(0, Math.min(1, displayValue / safeDuration));

  const updateValueFromTouchX = (x) => {
    const width = containerWidth.current || 1;
    const ratio = Math.max(0, Math.min(1, x / width));
    const value = ratio * safeDuration;
    setDragValue(value);
    return value;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setDragValue(position);
        setIsDragging(true);
        updateValueFromTouchX(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateValueFromTouchX(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: (evt) => {
        const v = updateValueFromTouchX(evt.nativeEvent.locationX);
        onSeek(v);
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    })
  ).current;

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.touchContainer}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBackground} />
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(displayValue)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 24,
  },
  touchContainer: {
    width: "100%",
    height: 40,
    position: "relative",
  },
  trackBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff40",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  thumb: {
    position: "absolute",
    top: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primaryText,
    marginLeft: -8,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  time: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

export default ProgressBar;
```

Key points the implementer should understand (do not add these as comments in the file — they are review notes):
- `containerWidth` is a `useRef` (not state) to avoid re-renders on layout; `onLayout` writes to `.current`, and `updateValueFromTouchX` reads from `.current`.
- `progress = Math.max(0, Math.min(1, displayValue / safeDuration))` is the 0-to-1 ratio driving both fill `width` and thumb `left` via percentage strings. Percentage `left` is relative to the `touchContainer` width (the positioned ancestor).
- `onPanResponderGrant` seeds `dragValue` with `position` before flipping `isDragging` (closes the re-render race from the prior phase), then immediately applies the touch X so a tap previews the tapped position. This means tap-to-seek works as a natural side effect.
- `onPanResponderTerminate` resets `isDragging` but does NOT call `onSeek` — the drag is cancelled (e.g., by a system gesture), thumb reverts to `position`.
- Track/thumb `top` values are hardcoded: `top: 17` = `(40 - 6) / 2` vertically centers the 6px track in the 40px touch container; `top: 12` = `(40 - 16) / 2` vertically centers the 16px thumb. `justifyContent: "center"` does NOT affect `position: "absolute"` children in React Native — explicit `top` is required.
- `thumb` `marginLeft: -8` offsets the 16px thumb by half its width so its center (not left edge) aligns with the progress position.
- `wrapper` `paddingHorizontal: 24` insets both track and time labels so they align edge-to-edge (prior layout had slider full-width and labels inset 24px — slightly misaligned; this fixes it).
- `safeDuration = Math.max(duration || 0, 1)` floors to 1 so `progress` division never divides by zero; the `|| 0` coerces `NaN`/`undefined` to `0` before `Math.max`.
- `formatTime` helper stays at module scope (unchanged from prior version).

- [ ] **Step 2: Verify no other file references the old Slider import path**

Run:

```bash
grep -rn "from \"@react-native-community/slider\"" /Users/mawenjie14/demo/MP3-codex/src /Users/mawenjie14/demo/MP3-codex/App.js
```

Expected: **no output** (zero matches). The only consumer of `@react-native-community/slider` was `ProgressBar.js`, which no longer imports it. If any other file still imports it, do NOT remove the import from that file — the dependency stays in `package.json` and other consumers (if any) are out of scope. (As of this plan, `PlayerScreen.js` removed its Slider import in the prior phase, so no other consumer should exist.)

- [ ] **Step 3: Verify Metro bundle builds**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: command exits 0 with a final line like `info Done writing bundle output`. Common failures to watch for:
- `Unable to resolve module 'PanResponder'` — typo in the `react-native` import.
- `SyntaxError` — a typo in the new file (e.g., missing brace, bad JSX).
- `ReferenceError: containerWidth is not defined` — the `useRef` declaration was misplaced or renamed.

If the bundle succeeds, do a quick visual scan of the file to confirm `Slider` is no longer referenced anywhere (search for the literal `Slider` — there should be zero matches in `ProgressBar.js`).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProgressBar.js
git commit -m "$(cat <<'EOF'
Rewrite ProgressBar with custom track and PanResponder

Replace @react-native-community/slider with a View-based layout: 6px
track (clearly-visible unplayed portion + red played portion) and a
16px thumb, driven by a progress ratio via percentage widths. PanResponder
preserves the drag-to-seek contract and adds tap-to-seek as a side effect.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Manual iOS simulator check (user-driven)**

The implementer cannot drive the simulator; the user verifies. Hand off these test cases. Do not mark the task complete until the user confirms the core visual + drag fix (cases 1-3):

1. **Visual prominence** — the progress bar is visibly thicker than before (6px vs ~3-4px). The unplayed portion is a clear light gray (`#ffffff40`, 25% white) rather than nearly invisible. The played portion is the same red (`COLORS.accent`) but reads as more prominent due to thickness + contrast with the visible unplayed track. The thumb is a white circle, visibly larger than the prior native default.
2. **Playback** — play a track. The red fill grows left-to-right; the thumb follows. The left time label updates each second; the right label shows total duration. The track and time labels are aligned edge-to-edge (both inset 24px from screen edges).
3. **Core drag** — press and hold the thumb, drag left and right. Confirm:
   - Thumb follows the finger (no snap-back).
   - Left time label previews the dragged-to time live.
   - Release — playback jumps to the released position, continues (audio not paused).
4. **Tap-to-seek (new behavior)** — tap once on any point of the track (not on the thumb). On release, playback jumps to the tapped position. The thumb moves to the tapped point on press (preview), and the seek fires on release.
5. **Bounds** — drag to the far left — thumb stops at the left edge, fill width is 0, time shows `0:00`. Drag to the far right — thumb stops at the right edge, fill width is 100%, time shows the full duration. Neither overflows the track.
6. **Skip to next track** — skip; the fill resets to 0, the new track's duration appears in the right label, drag and tap-to-seek work on the new track.
7. **Imported local MP3** — play an imported track (file:// URL) from the "我的音乐" tab; confirm the same drag and tap-to-seek behavior.
8. **Pause then drag** — pause playback, drag and release. Seek works while paused; the left time label reflects the new position while paused.

If case 1 fails (track still looks thin/faint), the most likely cause is the styles not being applied — re-check that `trackBackground`, `trackFill`, and `thumb` styles match the spec exactly (height 6, `#ffffff40`, `top: 17`, etc.).
If case 3 fails (thumb doesn't follow finger), the most likely cause is `containerWidth.current` staying 0 — re-check that `onLayout` writes to `containerWidth.current` and that `updateValueFromTouchX` reads from it.
