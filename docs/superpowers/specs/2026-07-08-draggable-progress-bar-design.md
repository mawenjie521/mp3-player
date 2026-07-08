# Draggable Progress Bar — Design Spec

**Date:** 2026-07-08
**Scope:** Fix the player screen's progress bar so it can be dragged smoothly. While the user drags, the slider thumb and the left-side time label must follow the finger (not get pushed back by the playback position); on release, playback seeks to the chosen position.

## Problem

`PlayerScreen.js` already has a `Slider` from `@react-native-community/slider` (lines 64-77) wired to `onSlidingComplete={onSeek}` → `TrackPlayer.seekTo`. So the progress bar exists and the seek callback is connected — but the drag UX is broken.

The slider's `value` prop is bound directly to `position`, which comes from `useProgress()` in `App.js:31` and updates roughly every second. While the user holds the thumb and drags, the React tree re-renders with a new `position`, and the native slider snaps the thumb back to the playback position — fighting the user's finger. The thumb visibly jumps, the time label flickers between the dragged value and the playback value, and the user cannot land on the position they want.

The result: the progress bar "doesn't drag" from the user's perspective, even though the wiring is technically there.

## Root Cause

`PlayerScreen.js:64-73` binds `value={position}` unconditionally. There is no drag-state tracking, so every `useProgress` update overwrites the thumb position during a drag. This is the classic React-controlled-slider bug: a continuously-updating `value` prop cannot coexist with user touch interaction unless the component decouples the displayed value from the external source while dragging.

A secondary bug: when a new track loads, `duration` is briefly `0`. With `maximumValue={duration}` (0) and `value={position}` (also 0), this is harmless, but if `position` arrives before `duration` updates, `value > maximumValue` can render the thumb at the far right. Needs a floor on `maximumValue`.

## Approach (chosen: B)

Two approaches were considered:

- **A. Inline the fix in `PlayerScreen`.** Add `isDragging` / `dragValue` state directly to `PlayerScreen`; make the slider's `value` conditional. Smallest diff — one file, ~15 lines. Rejected: leaves the drag logic mixed with screen layout, and `PlayerScreen` is already 159 lines.
- **B. Extract a `ProgressBar` component.** New `src/components/ProgressBar.js` owns the slider, the time labels, the `formatTime` helper, and all drag state. `PlayerScreen` renders `<ProgressBar position={position} duration={duration} onSeek={onSeek} />`. **Chosen.** Matches the project's existing small-component pattern (Vinyl, Tonearm, Lyrics, Controls), keeps `PlayerScreen` focused on layout, and leaves a reuse seam for a future mini-player progress bar.

## Component Changes

### 1. `src/components/ProgressBar.js` — new file

Props:

| Prop | Type | Description |
|---|---|---|
| `position` | number | Current playback position (seconds), from `useProgress()` |
| `duration` | number | Track total length (seconds), from `useProgress()` |
| `onSeek` | fn | Called on release with the target position (seconds) |

Internal state:

- `isDragging` (bool) — whether the user is currently holding the thumb
- `dragValue` (number) — preview position while dragging

Derived values:

- `safeDuration = Math.max(duration || 0, 1)` — floors `maximumValue` so the slider never has `max ≤ 0` (also covers the `NaN` case via `|| 0`)
- `displayValue = isDragging ? dragValue : Math.min(position, safeDuration)` — what the thumb and left time label show

Behavior:

- `onSlidingStart` → `setIsDragging(true)`
- `onValueChange` → `setDragValue(v)` (keeps the thumb and left time label in sync with the finger)
- `onSlidingComplete` → `onSeek(v)` then `setIsDragging(false)`
- Slider `value={displayValue}` — during drag, `displayValue` tracks `dragValue`, so `useProgress` updates no longer push the thumb around
- Left time label: `formatTime(displayValue)` — previews the dragged-to time live
- Right time label: `formatTime(duration)` — always shows total length

Reference implementation:

```jsx
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS } from "../data/constants";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function ProgressBar({ position, duration, onSeek }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const safeDuration = Math.max(duration || 0, 1);
  const displayValue = isDragging
    ? dragValue
    : Math.min(position, safeDuration);

  return (
    <View style={styles.wrapper}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={safeDuration}
        value={displayValue}
        onSlidingStart={() => setIsDragging(true)}
        onValueChange={(v) => setDragValue(v)}
        onSlidingComplete={(v) => {
          onSeek(v);
          setIsDragging(false);
        }}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor="#ffffff20"
        thumbTintColor={COLORS.primaryText}
      />
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

export default ProgressBar;
```

`formatTime` lives inside this file because it is only used here. `COLORS` is imported directly — same convention as the other components (`Controls`, `Vinyl`, etc.), not threaded through props.

### 2. `src/screens/PlayerScreen.js` — slim down

- Remove `import Slider from "@react-native-community/slider"` (line 3) — Slider is now an internal concern of `ProgressBar`.
- Add `import ProgressBar from "../components/ProgressBar"`.
- Remove the `formatTime` function (lines 26-30) — moved to `ProgressBar`.
- Replace the `<Slider> ... </View>` block (lines 64-77, the slider plus the `timeContainer` View with two `Text` labels) with:

```jsx
<ProgressBar position={position} duration={duration} onSeek={onSeek} />
```

- Remove the `slider`, `timeContainer`, and `time` entries from `styles` (lines 141-155) — moved to `ProgressBar`.

Net: `PlayerScreen` drops from 159 lines to ~130, and its remaining responsibility is purely layout (top bar / vinyl stage / lyrics / controls) plus prop forwarding.

### 3. No other file changes

- `App.js` — unchanged. It already passes `position`, `duration`, and `onSeek` (via `seekTo`) to `PlayerScreen`, which now forwards them to `ProgressBar`.
- `seekTo` (`App.js:200-202`) — unchanged.
- `Lyrics`, `Vinyl`, `Tonearm`, `Controls` — unchanged.
- No new npm dependencies (`@react-native-community/slider` is already in `package.json` at `^5.2.0`).

## Behavior

### What the user will see

- During playback, the slider thumb advances smoothly with `position`, and the left time label updates every second as before.
- When the user presses and holds the thumb:
  - The thumb stops following `position` and stays under the finger.
  - The left time label updates live to preview the dragged-to position (e.g., `1:23` → `2:05` → `2:41` as the finger moves).
  - The right time label (total duration) is unaffected.
- On release:
  - `onSeek(value)` fires → `TrackPlayer.seekTo(value)` → audio jumps to the chosen position.
  - `isDragging` flips back to `false`, and the thumb re-binds to `position`. Since playback has just seeked to the same value, there is no visible jump.
- Playback continues during the drag (audio is not paused). The user can hear the old position while previewing the new one — standard music-player behavior.

### What won't change

- Lyrics still key off `position` (`PlayerScreen.js:62`) — they do **not** move during the drag. On release, `position` jumps to the seek target and the lyric line syncs. This is the intended behavior: lyrics follow actual playback, not the drag preview.
- Vinyl rotation (`spin` animation) is unaffected by the drag.
- Manual play/pause/skip buttons behave exactly as before.
- The "now playing" sticky card on `PlaylistScreen` has no progress bar — out of scope for this change.

### Edge cases

- **`duration` unknown (0 or NaN) at track load:** `safeDuration = Math.max(duration || 0, 1)` floors `maximumValue` to 1. The thumb stays at the left, both labels show `0:00`. Once RNTP resolves the track metadata and `duration` updates, the slider rescales and the thumb advances normally.
- **`position > duration` (brief transient after a seek):** `Math.min(position, safeDuration)` clamps `displayValue` so the thumb never exceeds `maximumValue`.
- **Drag in progress when the track changes** (rare — user drags, then taps next/previous or auto-advance fires): `isDragging` stays `true`; the new track's `duration` arrives and `maximumValue` rescales; if `dragValue` exceeds the new `safeDuration`, the native slider clamps it. On release, `onSeek(dragValue)` seeks within the new track. Acceptable — the user initiated a drag, and this edge case is too rare to warrant extra handling.
- **Drag in progress when play/pause is tapped:** Unaffected. The drag state is decoupled from playback state. The user can pause mid-drag, then release to seek.
- **Re-render storms from `useProgress`:** During drag, `position` continues to update every second, but `displayValue` ignores it (returns `dragValue`). The slider `value` prop stays at `dragValue`, which matches the thumb's native position — no visible snap.

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** — `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` — catches import errors, syntax errors, and missing modules.
2. **Manual iOS simulator check** by the user:
   - Play a track — confirm the slider advances with playback and the left time label updates each second.
   - **Core fix:** press and hold the thumb, drag it left and right — confirm the thumb stays under the finger (no snapping back to playback position) and the left time label previews the dragged-to time live.
   - Release the thumb — confirm playback jumps to the released position and continues (audio not paused).
   - During a drag — confirm the lyrics do not jump; after release, confirm lyrics sync to the new position within a second.
   - Skip to the next track — confirm the slider resets to the left, the new track's duration appears in the right label, and dragging works on the new track.
   - Play an imported local MP3 (file:// URL) — confirm the same drag behavior works.
   - Pause playback, then drag and release — confirm seek works while paused and the time label reflects the new position.

## Out of Scope

- Adding a progress bar to the "now playing" sticky card on `PlaylistScreen` (separate future work; `ProgressBar` component leaves the reuse seam).
- Real-time scrubbing (seeking on every `onValueChange` rather than only on release) — explicitly rejected by the user in favor of the freeze-during-drag pattern.
- Pausing playback during drag — explicitly rejected.
- Drag-to-seek from the iOS lock screen / Control Center — deferred from the background-audio spec, still out of scope.
