# Filtered-Scope Playback - Design Spec

**Date:** 2026-07-08
**Scope:** When the user taps a song from a filtered tab (收藏 / 最近播放 / 我的音乐), playback should continue through that filtered list in order, not jump back to the full list.

## Problem

The player queue in `react-native-track-player` is always `[...playlist, ...importedTracks]` (the full list), set once in `initPlayer`. When the user is on a filtered tab (e.g. 收藏 with 3 favorites) and taps a song, `onSelect` calls `TrackPlayer.skip(index)` where `index` is the song's position in the full list. Subsequent auto-advance, next/prev, and lock-screen remote-next all navigate the full list, not the filtered list the user picked from.

The user expectation: tapping a song in 收藏 should play through 收藏 in order. Tapping in 最近播放 should play through the recent list in order. The current architecture can't express this because the queue is a single global full-list.

## Approach (chosen: A)

Three approaches were considered:

- **A. Rebuild queue on select.** `onSelect` calls `TrackPlayer.setQueue(filtered)` to replace the queue with the filtered list, then `skip` + `play` within that scope. All subsequent navigation (auto-advance, manual skip, lock-screen remote) is handled by RNTP's native queue semantics. **Chosen.**
- **B. Keep full-list queue + intercept auto-advance.** Add a `playbackScope` state, listen to `playback-track-changed`, and override `skipToNext` / `skipToPrevious` to navigate within scope. Rejected: logic spread across three paths (auto-advance, manual skip, remote), too many edge cases.
- **C. Rebuild queue on tab change.** Any tab switch rebuilds the queue to that tab's filtered list. Rejected: switching to 收藏 would interrupt playback if the current track isn't favorited; switching to an empty tab would clear the queue. Too invasive.

A companion decision: queue rebuild fires **only** on song selection, not on tab switch. Switching tabs changes the visible list but not the playback context. This matches the "playing context" mental model of Apple Music / Spotify.

## Component Changes

### 1. `App.js` - `onSelect` signature and implementation

Current:

```js
const onSelect = async (index) => {
  await TrackPlayer.skip(index);
  await TrackPlayer.play();
  const track = await TrackPlayer.getActiveTrack();
  setCurrentTrack(track);
  setView("player");
};
```

New:

```js
const onSelect = async (item, scope) => {
  await TrackPlayer.setQueue(scope);
  const index = scope.findIndex((t) => t.id === item.id);
  await TrackPlayer.skip(index);
  await TrackPlayer.play();
  const track = await TrackPlayer.getActiveTrack();
  setCurrentTrack(track);
  setView("player");
};
```

`setQueue` replaces the queue; `skip` sets the active track; `play` starts playback. Order matters - `setQueue` may invalidate the current track index, so `skip` must come after.

### 2. `src/screens/PlaylistScreen.js` - call site

Current (line 42):

```js
onPress={() => onSelect(playlist.indexOf(item))}
```

New:

```js
onPress={() => onSelect(item, filtered)}
```

`filtered` is already computed in `PlaylistScreen` via `useMemo` (line 13-18). No new computation needed - just pass it through.

### 3. No other file changes

- `service.js` - unchanged. `remote-next` / `remote-previous` call `TrackPlayer.skipToNext()` / `skipToPrevious()`, which operate on the current queue (now the filtered scope).
- `PlayerScreen.js` - unchanged. Derives everything from `currentTrack`.
- `Controls.js` - unchanged. Next/prev buttons call the existing `onSkipNext` / `onSkipPrev`, which call `TrackPlayer.skipToNext()` / `skipToPrevious()`.
- `App.js` `playback-track-changed` listener - unchanged. Still does `setCurrentTrack(await TrackPlayer.getActiveTrack())`, which works regardless of queue contents.
- `App.js` `playback-error` handler - unchanged. "下一首" button calls `skipToNext`, which now navigates within the filtered scope.
- `App.js` `initPlayer` - unchanged. Initial queue is still `[...playlist, ...importedTracks]` (the full list), matching the default "全部" tab.
- No new npm dependencies.

## Data Flow

```
PlaylistScreen
  ├─ filtered = useMemo(filter by activeTab)   ← already exists
  └─ row onPress -> onSelect(item, filtered)
       ↓
App.js onSelect
  ├─ TrackPlayer.setQueue(filtered)             ← new
  ├─ TrackPlayer.skip(index of item in filtered) ← changed (was full-list index)
  ├─ TrackPlayer.play()
  └─ setCurrentTrack(track) + setView("player")
```

After `onSelect` returns, all subsequent track transitions flow through RNTP's native queue operations:
- Natural auto-advance when a track finishes
- `skipToNext` / `skipToPrevious` from manual buttons
- `remote-next` / `remote-previous` from lock screen / Control Center / Bluetooth / headphones

No App.js interception is needed for any of these paths.

## Behavior Matrix

| Scenario | Old behavior | New behavior |
|----------|-------------|--------------|
| 全部 tab, tap song | skip to index in allTracks, play | setQueue(allTracks) + skip, play (equivalent) |
| 收藏 tab, tap song | skip to index in allTracks, then plays through full list | setQueue(favorites) + skip, plays only favorites |
| 最近 tab, tap song | skip to index in allTracks, plays through full list | setQueue(recent), plays in recent order |
| 我的音乐 tab, tap song | skip to index in allTracks, plays through full list | setQueue(imported), plays only imported |
| Filtered list ends (repeat=off) | Queue boundary, stops | Same - filtered queue is shorter, stops sooner |
| Filtered list ends (repeat=queue) | Loops the full list | Loops the filtered list |
| Filtered list ends (repeat=track) | Repeats current track | Same |
| Switch tab without tapping | Queue unchanged | Same - queue unchanged |
| Current track not in current tab | Sticky card still shows it | Same (already handled by auto-advance spec) |
| Re-tap currently playing song | Restarts from beginning | Same (setQueue + skip + play restarts it) |

## Edge Cases and Error Handling

- **Empty filtered list**: `onSelect` cannot be triggered (no rows to tap). No special handling needed.
- **`setQueue` failure**: No `try/catch` is added. The current `onSelect` also lacks `try/catch`, so behavior is consistent. If robustness is needed, it should be added uniformly in a separate pass.
- **Mixed imported + built-in tracks in scope**: `scope` is a `Track[]`. RNTP is source-agnostic - `file://` URLs and remote URLs both work. No special handling.
- **`playback-track-changed` listener**: Unchanged. Continues to call `setCurrentTrack(await TrackPlayer.getActiveTrack())`, which works for any queue contents.
- **`playback-queue-ended` (repeat=off at end of filtered list)**: RNTP emits this event, not `playback-track-changed`. `currentTrack` stays on the last track. The sticky card continues to show it. This is the natural behavior - no special handling (per auto-advance spec line 165).
- **App restart**: Queue is rebuilt from scratch in `initPlayer` (full list). Playback scope is not persisted. User can re-select a song to re-scope. This matches current behavior - no persistence layer exists for queue state.

## Out of Scope

- Persisting playback context across app restarts.
- Rebuilding queue on tab switch (rejected as too invasive).
- Adding a "Play All" button to start playback from the first song in the filtered list.
- Adding a new "sequential" repeat mode (the existing `off` mode already means sequential).
- Manual queue reordering / removal (still deferred from P3).
- Adding `try/catch` to `onSelect` (separate robustness pass).

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** - `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` - catches import errors, syntax errors, and missing modules.
2. **Manual iOS simulator check** by the user:
   - 全部 tab, tap a song -> confirm auto-advance walks through the full list (regression check).
   - 收藏 tab, tap a song -> confirm auto-advance stays within favorites; when the last favorite finishes (repeat=off), playback stops.
   - 收藏 tab, tap a song, set repeat=queue -> confirm playback loops within favorites.
   - 最近 tab, tap a song -> confirm auto-advance follows the recent list order (most-recent-first), not the full-list order.
   - 我的音乐 tab, tap an imported song -> confirm auto-advance stays within imported tracks.
   - Start playback from 收藏, switch to 全部 tab without tapping -> confirm current track keeps playing, list shows full list, current track is highlighted.
   - 全部 tab, tap the currently playing song -> confirm it restarts from the beginning.
   - Lock the simulator, use Control Center next button while playback scope is 收藏 -> confirm next navigates within favorites, not the full list.
   - Set repeat=off, play the last favorite in 收藏 tab to the end -> confirm `currentTrack` stays on the last favorite and the sticky card still shows it.
