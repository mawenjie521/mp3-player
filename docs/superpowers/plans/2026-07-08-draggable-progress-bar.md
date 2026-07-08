# Draggable Progress Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the player screen's progress bar so it drags smoothly — decouple the slider's `value` from `useProgress` position while dragging, seek on release.

**Architecture:** Extract a new `ProgressBar` component (`src/components/ProgressBar.js`) that owns the slider, time labels, `formatTime` helper, and drag state (`isDragging` / `dragValue`). `PlayerScreen` renders `<ProgressBar position={position} duration={duration} onSeek={onSeek} />` instead of the inline `Slider` + time labels.

**Tech Stack:** React Native 0.75.4, `@react-native-community/slider` ^5.2.0, React hooks (`useState`).

## Global Constraints

- **No automated tests** — this project has no test suite. Verification is Metro bundle build + manual iOS simulator check. Do NOT run `npm test` (it exits 1 with "No tests found" — pre-existing, not a regression).
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must succeed (catches import / syntax / missing-module errors).
- **eslint is not configured** — do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Extract draggable ProgressBar component"), with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer (matches recent project history).
- **COLORS:** `COLORS.accent = "#C20C0C"`, `COLORS.primaryText = "#ffffff"`, `COLORS.secondaryText = "#b3b3b3"`, `COLORS.background = "#1a1a1a"` — defined in `src/data/constants.js`.
- **No new dependencies.** `@react-native-community/slider` ^5.2.0 is already in `package.json`.
- **App.js unchanged** — `position`, `duration`, `onSeek` are already passed to `PlayerScreen` (App.js:277-284); this plan only touches `src/components/ProgressBar.js` (new) and `src/screens/PlayerScreen.js`.

## File Structure

- **`src/components/ProgressBar.js`** (create): Self-contained progress UI — Slider + two time labels + `formatTime` helper + drag state. Imports `COLORS` from `../data/constants`. Default-exports the `ProgressBar` React component. Props: `position` (number, seconds), `duration` (number, seconds), `onSeek` (fn: `(value: number) => void`).
- **`src/screens/PlayerScreen.js`** (modify): Remove `Slider` import, `formatTime` function, inline Slider JSX, time-labels JSX, and migrated styles. Add `ProgressBar` import. Render `<ProgressBar />` in place of the removed block. Net: ~159 lines → ~126 lines.

---

### Task 1: Extract draggable ProgressBar component and wire into PlayerScreen

Single cohesive change: create the new component file and update `PlayerScreen` to use it. These are inseparable — the component has no other consumer, and `PlayerScreen` cannot drop its inline `Slider` without the replacement. One task, one reviewer gate, one commit.

**Files:**
- Create: `src/components/ProgressBar.js`
- Modify: `src/screens/PlayerScreen.js` — import block (lines 1-8), `formatTime` function (lines 26-30), Slider + time-labels JSX (lines 64-77), styles `slider` / `timeContainer` / `time` (lines 141-155)

**Interfaces:**
- Consumes: `position` (number, seconds) and `duration` (number, seconds) from `useProgress()` in `App.js:31`; `onSeek` is `seekTo` from `App.js:200-202` (`async (value) => { await TrackPlayer.seekTo(value); }`). All three are already passed by `App.js` to `PlayerScreen` (App.js:277-284) and forwarded through props.
- Produces: `ProgressBar` React component (default export from `src/components/ProgressBar.js`). No later task consumes this — Task 1 is terminal.

- [ ] **Step 1: Create `src/components/ProgressBar.js`**

Write the full file with this exact content:

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
        onSlidingStart={() => {
          setDragValue(position);
          setIsDragging(true);
        }}
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

Key points the implementer should understand (do not add these as comments in the file — they are review notes):
- `safeDuration = Math.max(duration || 0, 1)` floors `maximumValue` to 1 so the slider never has `max ≤ 0` when `duration` is briefly `0` or `NaN` at track load. The `|| 0` coerces `NaN`/`undefined` to `0` before `Math.max`.
- `displayValue = isDragging ? dragValue : Math.min(position, safeDuration)` is the core fix: while dragging, the thumb reads `dragValue` (set by `onValueChange`), so `useProgress` updates to `position` can no longer push the thumb back.
- `onSlidingStart` seeds `dragValue` with the current `position` before flipping `isDragging` to `true`. This closes a narrow race: between drag start and the first `onValueChange`, a `useProgress` re-render could pass `value=stale_dragValue` to the slider and snap the thumb. Seeding guarantees `dragValue` is valid from the instant dragging begins.
- `onSlidingComplete` receives the final native value `v` (already clamped by the slider to `[0, maximumValue]`), so `onSeek(v)` is always within bounds.

- [ ] **Step 2: Update `PlayerScreen.js` imports**

In `src/screens/PlayerScreen.js`, replace the `Slider` import on line 3 with a `ProgressBar` import. The top of the file (lines 1-8) should become:

```jsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { COLORS } from "../data/constants";
import Vinyl from "../components/Vinyl";
import Tonearm from "../components/Tonearm";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";
```

(Remove `import Slider from "@react-native-community/slider";`. Add `import ProgressBar from "../components/ProgressBar";` after the `Controls` import.)

- [ ] **Step 3: Remove `formatTime` from PlayerScreen**

Delete the `formatTime` function (currently lines 26-30 of `src/screens/PlayerScreen.js`):

```jsx
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };
```

This helper now lives inside `ProgressBar.js` — it was only used by the slider's two time labels, which are migrating to `ProgressBar`.

- [ ] **Step 4: Replace inline Slider + time labels with `<ProgressBar />`**

In `src/screens/PlayerScreen.js`, replace this entire JSX block (currently lines 64-77):

```jsx
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
```

with this single line:

```jsx
      <ProgressBar position={position} duration={duration} onSeek={onSeek} />
```

The `position` / `duration` / `onSeek` props are already destructured in the `PlayerScreen` function signature (lines 13, 14, 21 of the original file) and flow straight through to `ProgressBar`.

- [ ] **Step 5: Remove migrated styles from PlayerScreen**

In the `StyleSheet.create` block of `src/screens/PlayerScreen.js`, delete these three style entries (currently lines 141-155):

```js
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
```

These styles now live inside `ProgressBar.js`. After removal, scan the rest of `PlayerScreen.js` to confirm no remaining JSX references `styles.slider`, `styles.timeContainer`, or `styles.time`. If any do, the Metro bundle will still build, but those elements will render unstyled — remove or redirect any such references.

- [ ] **Step 6: Verify Metro bundle builds**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: command exits 0 with a final line like `Done writing bundle output`. Common failures to watch for:
- `Unable to resolve module '../components/ProgressBar'` — file path wrong or file not created.
- `SyntaxError` — typo in the new file or a leftover brace from the `PlayerScreen` edits.
- `ReferenceError: formatTime is not defined` (at bundle eval time, unlikely but possible) — `formatTime` is still referenced somewhere in `PlayerScreen` and was not fully removed.

If the bundle succeeds, also do a quick visual scan of `PlayerScreen.js` to confirm `Slider` is no longer referenced anywhere (search for the literal `Slider`).

- [ ] **Step 7: Commit**

```bash
git add src/components/ProgressBar.js src/screens/PlayerScreen.js
git commit -m "$(cat <<'EOF'
Extract draggable ProgressBar component

Decouple slider value from useProgress position while dragging so the
thumb follows the finger instead of snapping back. Seek on release.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Manual iOS simulator check (user-driven)**

The implementer cannot drive the simulator; the user verifies. Hand off these test cases. Do not mark the task complete until the user confirms the core drag fix (cases 2-3):

1. **Play a track** — slider advances with playback, left time label updates each second, right time label shows total duration.
2. **Core fix (drag)** — press and hold the thumb, drag left and right. Confirm:
   - Thumb stays under the finger (no snapping back to playback position).
   - Left time label previews the dragged-to time live (e.g. `1:23` → `2:05` → `2:41`).
   - Right time label (duration) is unaffected.
3. **Release** — release the thumb. Confirm playback jumps to the released position and continues (audio was not paused during the drag).
4. **Lyrics during drag** — during a drag, confirm lyrics do not jump. After release, confirm lyrics sync to the new position within ~1 second.
5. **Skip to next track** — confirm slider resets to the left, new track's duration appears in the right label, and dragging works on the new track.
6. **Imported local MP3** — play an imported track (file:// URL) from the "我的音乐" tab; confirm the same drag behavior works.
7. **Pause then drag** — pause playback, drag and release. Confirm seek works while paused and the left time label reflects the new position while paused.

If case 2 fails (thumb still snaps back), the most likely cause is the `value` prop override not being decoupled — re-check that `displayValue` (not `position`) is passed to the `Slider`'s `value` prop in `ProgressBar.js`.
