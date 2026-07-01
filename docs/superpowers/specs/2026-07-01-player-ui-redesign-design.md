# Player UI Redesign — Design Spec

**Date:** 2026-07-01
**Scope:** Single-file refactor of `App.js` to modernize the now-playing screen of the React Native MP3 player. No new native dependencies, no behavior changes beyond added shuffle/repeat visual toggles.

## Goal

Replace the current minimal dark player with a modern streaming-style now-playing screen (Apple Music / Spotify feel): large album artwork, refined typography, polished controls, subtle depth. Pure JavaScript + React Native core — must ship without `pod install` or a native rebuild.

## Non-Goals

- Playlist UI, queue screen, library browser.
- Wiring shuffle/repeat to actual playback logic (visual stubs only).
- Dynamic color extraction from artwork (would require a native module).
- Performance refactors, useEffect dependency fixes, memory leak fixes.
- Adding `react-native-linear-gradient` (native dep — out of scope).

## Current State

`App.js` renders: title, artist, slider, time row, prev / play-pause / next. Tracks have `id`, `url`, `title`, `artist` — no `artwork`. Background is flat `#121212`. Controls use raw Unicode glyphs.

## Target Design

### Layout (top → bottom, inside `SafeAreaView`)

1. **Header label** — "正在播放", centered, 13px, `#b3b3b3`, letter-spacing feel via uppercase if Latin. Small, just for context.
2. **Album artwork** — 320×320 (width clamped to screen width minus 64px padding on small screens), 24px border-radius, soft drop shadow (`shadowColor #000`, opacity 0.5, radius 16, offset y 8), 1px `#ffffff20` border for edge definition. Loaded via network URL from the track's `artwork` field.
3. **Title + artist block** — left-aligned. Title 24px bold `#fff`, artist 16px `#b3b3b3`, 4px gap. Sits ~32px below artwork.
4. **Progress slider** — full width, 4px effective track height (slider native height 40 for touch target). Active track `#1DB954`, inactive `#ffffff20`, thumb `#fff` 16px. ~16px gap to time row.
5. **Time row** — `position` left, `duration` right, 12px, `#b3b3b3`, `fontVariant: ['tabular-nums']` so digits don't jitter.
6. **Control row** — single row, evenly spaced:
   - Shuffle icon (visual toggle, 22px, `#b3b3b3` default / `#1DB954` when "on")
   - Previous icon
   - Play/pause button — 72px circle, `#1DB954`, white glyph 32px, drop shadow
   - Next icon
   - Repeat icon (visual toggle, same color logic as shuffle)

### Visual Treatment

- **Background depth:** A semi-transparent overlay `View` at the top of `playerContainer` — radial-ish via two stacked `View`s with `backgroundColor` and low opacity, approximating a soft glow. No gradient library; pure `View` stacking.
- **Typography:** System font (no new dep). Title/artist left-aligned for premium feel vs. current centered layout.
- **Icons:** Unicode glyphs (`⏮ ⏭ ▶ ⏸ 🔀 🔁`) sized and colored per slot. Play button glyph offset slightly upward (common offset hack: `marginTop: -2` or `paddingTop`) to optically center.
- **Spacing:** 32px horizontal padding, 48px between artwork and title block, 48px between time row and controls.

### Data Change

Add `artwork` field to each track in the `playlist` array. Use stable public placeholder image URLs (picsum.photos with a fixed seed per track so each song gets a consistent cover). Example:

```js
{
  id: "1",
  url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  title: "示例音乐 1",
  artist: "SoundHelix",
  artwork: "https://picsum.photos/seed/song1/600/600",
}
```

TrackPlayer's track object natively accepts `artwork` — we render it ourselves via `Image` rather than relying on a notification/lock-screen renderer, so no service-side change needed.

### Component Structure

Single `App.js` still, but split rendering into small inline render helpers / sub-components within the same file to keep the return tree readable:

- `App` (state + handlers, unchanged logic)
- `NowPlaying` sub-tree composed inline via styled `View`s

No new files. The existing `service.js` (TrackPlayer background service) is untouched.

## Open Question Resolved

**Real gradient vs. faked depth:** Resolved — fake with stacked `View`s to avoid adding `react-native-linear-gradient` (native module, requires `pod install` + rebuild). Visual cost is small; the artwork shadow + tinted overlay carry most of the depth.

## Testing / Verification

- App launches without red screen on iOS simulator.
- Artwork loads for all three tracks when navigating next/prev.
- Play/pause toggles glyph correctly.
- Slider seek works (unchanged handler).
- Time labels update and don't jitter horizontally (tabular-nums).
- Shuffle/repeat toggles change color when tapped (visual-only).
- No console errors about missing image sources.

## Risk

- **Network image failure:** picsum may be slow/blocked. Mitigation: nothing in code for v1 (acceptable for a demo). If it becomes an issue later, add a fallback colored `View` behind the `Image`.
- **Glyph rendering differences across platforms:** Unicode media glyphs render slightly differently on iOS vs Android. Acceptable for this pass.
