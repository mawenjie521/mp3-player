# Progress Bar Visual Redesign — Design Spec

**Date:** 2026-07-08
**Scope:** Replace the `@react-native-community/slider` inside `ProgressBar` with a hand-built `View` + `PanResponder` progress bar. Solve three visual issues: unplayed track too faint, track too thin, played portion not prominent. Preserve the drag-to-seek behavior shipped in the prior draggable-progress-bar phase.

## Problem

After the draggable-progress-bar fix (merged as `d007778`), the user reported the progress bar is "还是不明显" (still not obvious). Three specific issues:

1. **Unplayed track too faint** — `maximumTrackTintColor="#ffffff20"` (white at ~12% opacity) is nearly invisible on the `#1a1a1a` background.
2. **Track too thin** — `@react-native-community/slider` v5's iOS native track is ~3-4px with no JS-exposed height control. `trackHeight` is web-only in this library version.
3. **Played portion not prominent** — the red `COLORS.accent` played track is visible in isolation but lacks contrast because the unplayed track beside it is nearly invisible, so the red looks "孤零零" (orphaned).

The thumb size was explicitly not flagged — the default is acceptable.

## Root Cause

`@react-native-community/slider` v5 does not expose `trackHeight` on iOS/Android native (verified in `node_modules/@react-native-community/slider/src/RNCSliderNativeComponent.web.tsx:43` — `trackHeight` is web-only). `thumbSize` only takes effect when a custom `thumbImage` is provided. The only iOS-native lever for thicker tracks is `trackImage` / `minimumTrackImage` / `maximumTrackImage` (custom image assets) — awkward for one tiny UI element.

Color bumps alone (Approach B) could fix issues #1 and #3 but not #2. The Slider's fixed-thin native track is the binding constraint.

## Approach (chosen: A)

Three approaches were considered:

- **A. Custom progress bar (View + PanResponder).** Replace the `Slider` with a hand-built layout: a 40px-tall touch container holding a 6px-tall track (background + fill) and a 16px thumb, all positioned via percentage widths driven by a `progress` value. `PanResponder` handles drag start/move/release with the same `isDragging` / `dragValue` / `onSeek` contract as today. **Chosen** — the only approach that solves all three issues without image-asset overhead.
- **B. Keep Slider, bump colors only.** Raise `maximumTrackTintColor` opacity, maybe brighten `minimumTrackTintColor`. Rejected: cannot fix issue #2 (track thickness) — `trackHeight` is web-only in v5.
- **C. Slider + custom `trackImage` asset.** Provide a PNG to render a thicker track on iOS. Rejected: introduces image-asset management (resolution variants, asset registration) for one tiny element. Awkward.

## Component Changes

### 1. `src/components/ProgressBar.js` — rewrite internals, same props

**Props (unchanged):** `position` (number, seconds), `duration` (number, seconds), `onSeek` (fn: `(value: number) => void`). `PlayerScreen` calls `<ProgressBar position={position} duration={duration} onSeek={onSeek} />` — no change to the call site.

**Removed:** `import Slider from "@react-native-community/slider"` and the `<Slider>` JSX element. The `@react-native-community/slider` dependency stays in `package.json` (harmless if unused by this component; removal is out of scope).

**Added imports:** `PanResponder` (from `react-native`), `useRef` (from `react`).

**State / refs:**

| Name | Type | Purpose |
|---|---|---|
| `isDragging` | bool (state) | Whether the user is currently holding the thumb |
| `dragValue` | number (state) | Preview position while dragging |
| `containerWidth` | number (ref) | Track container width in px, from `onLayout`. Used to convert touch X → seconds. |

**Derived:**

- `safeDuration = Math.max(duration || 0, 1)` — floors `maximumValue` to 1 so division never blows up when `duration` is `0` / `NaN` / `undefined` (the `|| 0` coerces `NaN`/`undefined` to `0` before `Math.max`).
- `displayValue = isDragging ? dragValue : Math.min(position, safeDuration)` — core drag-decoupling (unchanged from prior phase).
- `progress = Math.max(0, Math.min(1, displayValue / safeDuration))` — 0-to-1 ratio driving fill width and thumb position.

**Layout (JSX):**

```jsx
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
    <View
      style={[
        styles.thumb,
        { left: `${progress * 100}%` },
      ]}
    />
  </View>
  <View style={styles.timeContainer}>
    <Text style={styles.time}>{formatTime(displayValue)}</Text>
    <Text style={styles.time}>{formatTime(duration)}</Text>
  </View>
</View>
```

**`PanResponder` (created once via `useRef`):**

```js
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
```

`updateValueFromTouchX(x)` is a helper inside the component:

```js
const updateValueFromTouchX = (x) => {
  const width = containerWidth.current || 1;
  const ratio = Math.max(0, Math.min(1, x / width));
  const value = ratio * safeDuration;
  setDragValue(value);
  return value;
};
```

**Key behavioral notes:**

- `onPanResponderGrant` seeds `dragValue` with `position` before flipping `isDragging` (closes the same re-render race as the prior phase), then immediately applies the touch X so a tap previews the tapped position. This means **tap-to-seek** is supported as a natural side effect — a tap with no drag seeks to the tapped position on release. The prior Slider did not tap-to-seek; this is an intentional improvement matching Apple Music / NetEase Cloud Music behavior.
- `onPanResponderTerminate` (gesture conflict, system interruption) resets `isDragging` but does **not** call `onSeek` — the drag is cancelled, the thumb reverts to `position` on the next render. Correct cancel semantics.
- `updateValueFromTouchX` returns the value so `onPanResponderRelease` can pass it to `onSeek` without re-reading stale state.

**Styles:**

```js
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
    top: 17, // (40 - 6) / 2 — vertically center 6px track in 40px touch area
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
    top: 12, // (40 - 16) / 2 — vertically center 16px thumb in 40px touch area
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
```

**Visual decisions (why these exact values):**

- **Track height 6px** — ~50% thicker than the Slider's ~3-4px native default; matches Apple Music / NetEase Cloud Music thickness (~5-6px). Thicker would look crude.
- **Unplayed track `#ffffff40`** (white 25% opacity) — doubles the prior `#ffffff20` (12%) opacity; clearly visible on `#1a1a1a` without competing with the played red.
- **Played track `COLORS.accent`** (`#C20C0C`) — unchanged. The thickness increase + the now-visible unplayed track beside it resolve "played not prominent" without breaking brand-color consistency (same red used in top-bar glow, favorite icon, now-playing card).
- **Thumb 16×16px** — ~30% larger than the Slider's default thumb; clearly tappable without dominating.
- **Touch container 40px tall, track/thumb absolutely positioned with explicit `top`** — the 6px track is too thin to tap accurately; the 40px invisible touch area gives fingers room. `top: 17` = `(40 - 6) / 2` vertically centers the 6px track; `top: 12` = `(40 - 16) / 2` vertically centers the 16px thumb. (`justifyContent: "center"` does **not** affect `position: "absolute"` children in React Native — explicit `top` values are required.)
- **Thumb `marginLeft: -8`** — half of 16px, offsets so the thumb's *center* aligns with the progress position (not its left edge).
- **Wrapper `paddingHorizontal: 24`** — insets both the track and the time labels by 24px so they align edge-to-edge. (Prior layout had the slider spanning full width while labels were inset 24px — slightly misaligned. The new wrapper-level padding fixes this.)

### 2. No other file changes

- `src/screens/PlayerScreen.js` — unchanged. It already renders `<ProgressBar position={position} duration={duration} onSeek={onSeek} />`.
- `App.js` — unchanged.
- `package.json` — `@react-native-community/slider` stays (removal is out of scope; the dependency is small and may be reused elsewhere later).
- No new dependencies. `PanResponder` and `useRef` are React Native / React built-ins.

## Behavior

### What the user will see

- The progress bar is visibly thicker (6px vs ~3-4px), with a clear light-gray unplayed portion and a red played portion. The thumb is a white circle ~30% larger than before.
- During playback, the red fill grows from left to right; the thumb follows. The unplayed gray portion is now clearly visible as context, making the red read as "progress" rather than an orphaned segment.
- Pressing anywhere on the track: thumb jumps to the pressed position (preview), left time label updates to the preview time. Dragging moves the thumb live. Releasing seeks to the released position.
- Releasing without moving (a pure tap): seeks to the tapped position. (New behavior vs. prior Slider, which did not tap-to-seek.)
- Playback continues during drag (audio not paused). Lyrics stay synced to `position` — they do not move during drag, and sync to the new position within ~1s of release.

### What won't change

- The `PlayerScreen` integration, `App.js` data flow, `seekTo` implementation, lyrics, vinyl, and all other features.
- The drag-decoupling fix from the prior phase (`displayValue` ignores `position` while `isDragging`).
- The `safeDuration` floor for `duration=0`/`NaN` edge case.

### Trade-offs vs. the prior Slider implementation

- **Lost:** VoiceOver "adjustable" accessibility (the native Slider exposed value adjustment to assistive tech). The custom View-based bar does not. Project has no current accessibility requirement; can be added later via `accessibilityRole="adjustable"` + `accessibilityValue` if needed.
- **Gained:** Full visual control (track height, colors, thumb size, rounded corners), tap-to-seek, and a track that reads as a coherent progress indicator instead of a thin line.
- **Performance:** `onPanResponderMove` fires at touch frequency (60-120Hz), each triggering `setDragValue` → re-render. The native Slider was native-driven. For a 6px track + 16px thumb on a small screen region, RN handles this fine. If drag jank appears, `Animated.Value` + `Animated.View` is the optimization path — but the time label still needs a JS listener to format, so the win is partial. Start simple per YAGNI.

### Edge cases

- **`duration` unknown (0 / `NaN` / `undefined`):** `safeDuration = 1`, `progress = 0`, thumb at far left, time labels show `0:00 / 0:00`. Resolves when metadata arrives.
- **`position > duration` (transient after seek):** `displayValue` clamps via `Math.min(position, safeDuration)`, `progress` clamps via `Math.max(0, Math.min(1, ...))`. Fill never overflows the track.
- **`containerWidth = 0` (touch before first `onLayout`):** `|| 1` guard prevents divide-by-zero; `ratio` clamps to `[0, 1]`. Practically impossible — the user cannot touch an unrendered element.
- **Touch X outside track bounds (finger drags beyond container):** `locationX` may be negative or exceed `width`; `Math.max(0, Math.min(1, x / width))` clamps. Fill and thumb stay within the track.
- **Gesture conflict / system interruption:** `onPanResponderTerminate` fires → `isDragging` resets to `false`, `onSeek` is NOT called. The drag is cancelled; thumb reverts to `position`.
- **Drag in progress when track changes:** New `duration` arrives → `safeDuration` rescales → `progress` recomputes. If `dragValue` exceeds the new `safeDuration`, `progress` clamps to 1 (thumb at far right). On release, `onSeek(dragValue)` seeks within the new track. Acceptable (matches prior Slider behavior; rare edge case).
- **Drag in progress when play/pause is tapped:** Unaffected. Drag state is decoupled from playback state.

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** — `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` — catches import errors, syntax errors, and missing modules.
2. **Manual iOS simulator check** by the user:
   - **Visual:** unplayed track clearly visible (25% white), played red prominent, track thicker than before, thumb larger than before.
   - **Playback:** fill advances with playback, thumb follows, time labels update each second.
   - **Core drag:** press and hold thumb, drag left/right — thumb follows finger, left time label previews live, right label (duration) unaffected. Release — playback jumps to released position, continues.
   - **Tap-to-seek (new):** tap once on any point of the track — on release, playback jumps to that position.
   - **Bounds:** drag to far left — thumb stops at left edge, does not go negative. Drag to far right — thumb stops at right edge, does not overflow.
   - **Cancel:** (hard to test in simulator) start a drag, then trigger a system gesture to interrupt — thumb should revert to `position`, no seek fires.
   - **Skip to next track:** slider resets to left, new duration appears, drag works on new track.
   - **Imported local MP3:** same drag and tap-to-seek behavior.
   - **Pause then drag:** seek works while paused, time label reflects new position.

## Out of Scope

- Removing `@react-native-community/slider` from `package.json` (leave it; may be reused).
- VoiceOver / assistive-tech accessibility for the progress bar (can be added later if needed).
- `Animated.Value`-driven drag optimization (only if the plain `setState` approach proves janky in practice).
- Lock-screen / Control Center drag-to-seek (still deferred from the background-audio spec).
- Adding a progress bar to the "now playing" sticky card on `PlaylistScreen` (still deferred from the prior spec).
