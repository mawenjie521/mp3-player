# NetEase Cloud Music Vinyl Player — Design Spec

**Date:** 2026-07-01
**Scope:** Single-file refactor of `App.js` to reimagine the player as a NetEase Cloud Music-style vinyl now-playing screen: rotating black vinyl record with tonearm, scrolling lyrics, red accent, dark background. Pure JavaScript, no new native dependencies.

## Goal

Replace the current minimal dark player with NetEase Cloud Music's signature vinyl aesthetic: a circular album artwork embedded in a rotating black vinyl disc, a tonearm that lowers when playing and lifts when paused, a multi-line lyric display that highlights the current line, and a red (`#C20C0C`) accent color throughout.

## Non-Goals

- Real lyric parsing from audio files or LRC time tags (v1 uses placeholder lyrics evenly distributed over duration).
- Real audio spectrum visualization.
- Background blur derived from artwork (would need a native module).
- Playlist/queue screen, comments, sharing — anything not on the now-playing screen.
- Performance refactors of the existing playback logic.

## Current State

`App.js` renders: title, artist, slider, time row, prev / play-pause / next. Tracks have `id`, `url`, `title`, `artist`, no artwork. Background is flat `#121212`. Controls use raw Unicode glyphs.

## Target Design

### Layout (top → bottom, inside `SafeAreaView`)

1. **Top bar** — row: left back chevron `‹` (decorative), center title (current song name, 15px white, single line), right share icon `⤴` (decorative). Height ~44px.
2. **Vinyl assembly** — centered, ~340px square region:
   - **Vinyl disc:** 340×340 circle, black (`#0a0a0a`) base, 4 concentric ring borders (`#1a1a1a`/`#222`/`#1a1a1a`/`#222`) to simulate grooves, centered ~220×220 circular album artwork with 2px white border, and a 16×16 red center label (`#C20C0C`) on top of the artwork center.
   - **Tonearm:** anchored at top-right of the vinyl region. A 120×8 rounded bar (`#999`) pivoting from a 24×24 circle pivot (`#666`) at the top-right. When playing, rotates to ~20° (lowered onto the disc). When paused, rotates to ~-30° (lifted). Smooth `Animated.timing` transition, 400ms.
   - **Rotation:** the entire vinyl disc (with artwork) rotates continuously via `Animated.loop` (`Animated.timing` 20s linear). Starts when `isPlaying` becomes true; stops (preserving current angle via `stopAnimation`) when paused; resumes from preserved angle when played again.
3. **Lyrics area** — below vinyl, ~120px tall, centered text:
   - 3 visible lines: previous (gray 14px opacity 0.4), current (white 17px opacity 1.0), next (gray 14px opacity 0.4).
   - Current line index computed from `position / duration * lyrics.length`.
   - Smooth `Animated.timing` vertical slide when index changes.
4. **Progress bar** — full width, 4px effective track height. Active track `#C20C0C`, inactive `#ffffff20`, thumb white 14px. Time row below: position left, duration right, 11px gray, `tabular-nums`.
5. **Bottom controls** — row, evenly spaced:
   - Loop icon `🔁` (visual toggle, gray/red)
   - Previous `⏮`
   - Play/pause — 64px circle, border 2px white, white glyph 28px (NetEase uses outlined style; we use white-on-dark)
   - Next `⏭`
   - List icon `☰` (visual, gray)

### Visual Treatment

- **Background:** `#1a1a1a` flat. Top 280px overlay `#C20C0C` opacity 0.05 for subtle warmth.
- **Typography:** System font. Title 15px white. Artist not separately shown in this layout (the top bar shows the song title; artist omitted for vinyl authenticity — NetEase's vinyl screen emphasizes the title only).
- **Vinyl groove illusion:** concentric `View` rings with alternating `#1a1a1a` / `#222` borders at radii 170, 150, 130, 110. Cheap but effective.
- **Tonearm:** `Animated.View` with `transform: [{ rotate: interpolatedAngle }]`. The pivot is a separate `View` at the anchor point; the bar extends from it.
- **Rotation preservation:** store the rotation `Animated.Value` and a ref to the running animation. On pause, call `anim.stopAnimation(callback)` to capture the current value, then resume from there on play.

### Data Change

Each track gains `artwork` (URL) and `lyrics` (array of strings). Lyrics are placeholder Chinese text. Example:

```js
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
}
```

Each track gets its own 8-line placeholder lyric set so the scrolling demo looks varied.

### Component Structure

Single `App.js`. Inline sub-components:

- `App` — state (existing) + `lyricIndex` derived from `position`/`duration`. New refs: `spinValue` (`Animated.Value`), `spinAnim` (the loop animation ref), `tonearmAngle` (`Animated.Value`).
- `Vinyl` — props: `artwork`, `isPlaying`, `spinValue`. Renders disc + artwork + center label.
- `Tonearm` — props: `isPlaying`. Renders pivot + bar, animates `rotate`.
- `Lyrics` — props: `lines`, `currentIndex`. Renders 3-line window with slide animation.
- `Controls` — props: playback state + callbacks, same pattern as before.

`service.js` untouched.

## Open Questions Resolved

**Lyrics sync:** v1 uses `Math.floor(position / duration * lines.length)` to pick the current line. Acceptable for a visual demo; real LRC parsing is out of scope.

**Rotation state across track changes:** when skipping tracks, the disc continues rotating from its current angle — no reset. NetEase behavior matches this.

## Testing / Verification

- App launches, no red screen.
- Vinyl renders with groove rings, center artwork, red label.
- Tonearm lowers (~20°) when play starts, lifts (~-30°) when paused, smooth 400ms.
- Disc rotates continuously while playing; stops and preserves angle on pause; resumes from same angle on play.
- Lyrics scroll: current line white 17px, neighbors gray 14px, transitions as position advances.
- Progress bar red active track, white thumb, seek works.
- Prev/next update artwork, title, lyrics, and reset lyric index to 0.
- Loop and list icons toggle/press without effect (visual only).
- No console errors.

## Risk

- **`Animated.loop` + stop/resume:** React Native's `Animated.loop` doesn't natively preserve position on stop. Mitigation: use `spinValue.stopAnimation(cb)` to capture current value, then on resume start a fresh `Animated.timing` loop from that value (using `Animated.loop` with `Animated.timing(spinValue, { toValue: 360 + current, duration: ..., useNativeDriver: true })` — but since we always spin forward, simpler: start a new loop to 360 and use `Animated.modulo` or just let it accumulate). Documented in plan; implementer handles via ref pattern.
- **Placeholder lyrics look fake:** acceptable for v1; the structure (`lyrics: string[]`) is forward-compatible with real LRC data.
- **Unicode glyph rendering across platforms:** acceptable.
