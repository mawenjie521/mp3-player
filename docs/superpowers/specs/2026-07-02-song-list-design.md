# Song List Screen — Design

**Date:** 2026-07-02
**Status:** Approved (pending implementation)

## Goal

Add a song list screen to the MP3 player. The app opens to the list; tapping a song switches to the existing vinyl player screen for that track. A back button in the player returns to the list. The currently-active track is highlighted in the list.

## Context

The app (`App.js`) is a React Native vinyl-style player with a hardcoded `playlist` of 3 tracks. Playback is handled by `react-native-track-player`, which is initialized with the full queue at startup. There is currently only one screen (the player). No navigation library is installed.

## Non-goals

- No navigation library (react-navigation, etc.) — state-based switching only.
- No search, filtering, sorting, or editing of the list.
- No persistence of last-played track across app launches.
- The existing `☰` control button stays decorative — not wired to open the list.
- No automated tests — the project has none; verification is manual.

## Approach

State-based screen switching inside `App`. Two screens, toggled by a `view` state:

```
App
 ├── view === 'list'   → <PlaylistScreen />
 └── view === 'player' → <PlayerScreen />   (existing vinyl UI, extracted)
```

`TrackPlayer` remains the source of truth for the queue and playback. `App` owns `view` and `currentTrack` state and passes callbacks down.

## Components

### `App` (orchestrator)

Owns:
- `view: 'list' | 'player'` — starts as `'list'`.
- `currentTrack: Track | null` — starts as `null`. Set only when the user selects a track or via next/prev. **Not** set by `initPlayer`.
- `isPlayerInitialized`, `loopOn`, `spin` animation, all playback logic (unchanged from today).

Passes to `PlaylistScreen`: `playlist`, `currentTrack`, `onSelect`.
Passes to `PlayerScreen`: `currentTrack`, all playback handlers, `onBack`.

### `PlaylistScreen`

Props: `playlist`, `currentTrack`, `onSelect(index)`.

Renders:
- A header row: title "播放列表" and a subtitle with the track count (e.g. "共 3 首").
- A `FlatList` of rows. Each row:
  - 48×48 artwork thumbnail (rounded corners).
  - Title (single line).
  - Artist (single line, muted).
  - Active-row indicator: when `track.id === currentTrack?.id`, the title turns accent red (`#C20C0C`) and a small ▶ glyph (or equivalent) shows on the right.

Row tap → calls `onSelect(index)`.

### `PlayerScreen`

The current body of `App` (top bar, vinyl stage, lyrics, slider, controls), extracted into its own component. Receives `currentTrack` and all playback handlers as props.

Changes to the existing top bar:
- The `‹` chevron (currently decorative) becomes the back button. On press → `onBack()` (sets `view='list'`). Does **not** stop playback.

Guard for `currentTrack === null`: in practice the player screen is only shown after `onSelect` sets a track, so this is a defensive guard only. If `null`, render a minimal placeholder (e.g. centered "请选择歌曲" text) and skip the vinyl/lyrics/slider/controls.

## Data flow & events

- **Tap a list row** (`onSelect(index)`):
  1. `await TrackPlayer.skip(index)`
  2. `await TrackPlayer.play()`
  3. `const track = await TrackPlayer.getActiveTrack(); setCurrentTrack(track);`
  4. `setView('player')`

- **Next / Previous in player** (existing `skipToNext` / `skipToPrevious`): unchanged. They already call `TrackPlayer.skipToNext()` / `skipToPrevious()` and update `currentTrack` from the active track. Because `currentTrack` is shared state, the list highlight automatically reflects the new track when the user navigates back.

- **Back button (`‹`) in player**: `setView('list')`. Playback continues uninterrupted.

- **Active-track sync**: `currentTrack` is updated in exactly three places — `onSelect`, `skipToNext`, `skipToPrevious`. The list derives its highlight from `currentTrack?.id`; no separate "active index" state.

## Highlight rule

- A row is highlighted when `track.id === currentTrack?.id`.
- On first launch, `currentTrack` is `null`, so **no row is highlighted**.
- Once the user taps a row, that row becomes and remains highlighted (through pause, next/prev, return-to-list) until another row is tapped or the app is relaunched.

## What stays unchanged

- `TrackPlayer` setup (`setupPlayer`, `add(playlist)`), `service.js`, all playback methods (`togglePlayback`, `skipToNext`, `skipToPrevious`, `seekTo`, `formatTime`).
- Vinyl, Tonearm, Lyrics, Controls, Slider components and their styling.
- The `loopOn` toggle behavior.
- The `☰` button remains decorative.

## Verification (manual, on iOS simulator)

1. Launch app → list screen visible, no row highlighted.
2. Tap row 2 → player screen appears, vinyl spins, song 2 plays.
3. Tap `‹` → back to list, row 2 highlighted, music still playing.
4. From player, tap next → return to list → highlight has moved to row 3.
5. Tap row 1 while row 3 is playing → player switches to song 1, row 1 highlighted on return.
6. Pause from player, go back to list → row remains highlighted (highlight = active track, not "is playing").
