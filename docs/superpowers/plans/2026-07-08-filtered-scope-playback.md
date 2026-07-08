# Filtered-Scope Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user taps a song in a filtered tab (收藏 / 最近播放 / 我的音乐), rebuild the RNTP queue to that filtered list so auto-advance, manual skip, and lock-screen remote-next all stay within the chosen scope instead of jumping back to the full list.

**Architecture:** Change `onSelect` in `App.js` to take `(item, scope)` instead of `(index)`, and call `TrackPlayer.setQueue(scope)` before `skip` + `play`. Update the single call site in `PlaylistScreen.js` to pass `(item, filtered)` - `filtered` is already computed by an existing `useMemo`. No other files change; RNTP's native queue semantics handle all subsequent navigation.

**Tech Stack:** React Native 0.75.4, `react-native-track-player` (RNTP) API: `setQueue`, `skip`, `play`, `getActiveTrack`. No new dependencies.

## Global Constraints

- **No automated tests** - this project has no test suite. Verification is Metro bundle build + manual iOS simulator check by the user. Do NOT run `npm test` (it exits 1 with "No tests found" - pre-existing, not a regression).
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must exit 0 with `info Done writing bundle output`.
- **eslint is not configured** - do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Scope playback to filtered list on select"), with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer (matches recent project history).
- **Only two files are touched:** `App.js` (the `onSelect` function) and `src/screens/PlaylistScreen.js` (the `onPress` of the list row). All other files are unchanged.
- **Props contract for `onSelect`:** Old signature `(index: number) => Promise<void>`. New signature `(item: Track, scope: Track[]) => Promise<void>`. `Track` is the existing shape used by `playlist` / `importedTracks` (has `id`, `title`, `artist`, `url`, `artwork`, optional `isImported`, optional `lrc`).
- **`setQueue` semantics:** `TrackPlayer.setQueue(tracks)` replaces the queue. The currently active track index may be invalidated, so `skip(index)` must be called after `setQueue` to set the active track before `play`.
- **Initial queue unchanged:** `initPlayer` (App.js:122-156) still calls `TrackPlayer.add(playlist)` + `TrackPlayer.add(importedTracks)` at app launch. This matches the default 全部 tab. Do not modify `initPlayer`.
- **No persistence:** Playback scope is not persisted across app restarts. On relaunch the queue is rebuilt to the full list. This matches current behavior - no persistence layer exists for queue state.

## File Structure

- **`App.js`** (modify `onSelect` only, lines 204-210): Change signature from `(index)` to `(item, scope)`. Body calls `TrackPlayer.setQueue(scope)`, computes `index` as `scope.findIndex((t) => t.id === item.id)`, then `skip(index)` + `play()` + `setCurrentTrack` + `setView("player")` as before. ~10 lines, still within the 300-line App.js budget.
- **`src/screens/PlaylistScreen.js`** (modify `onPress` only, line 42): Change `onPress={() => onSelect(playlist.indexOf(item))}` to `onPress={() => onSelect(item, filtered)}`. The `filtered` array is already computed at line 13-18 via `useMemo`. No other change to this file.

---

### Task 1: Rebuild queue to filtered scope on select

Single cohesive change across two files. The App.js signature change and the PlaylistScreen.js call-site update must ship together - either alone breaks the build. One task, one reviewer gate, one commit.

**Files:**
- Modify: `App.js` (the `onSelect` function, currently lines 204-210)
- Modify: `src/screens/PlaylistScreen.js` (the list-row `onPress`, currently line 42)

**Interfaces:**
- Consumes: `filtered` (`Track[]`) computed by `PlaylistScreen.js:13-18` `useMemo`, which filters `playlist` (the prop, which is `allTracks` from App.js:40) by `activeTab`. `item` is the `Track` object being rendered by `FlatList` in `PlaylistScreen.js:117-128`.
- Produces: Updated `onSelect(item, scope)` async function in `App.js`. No later task consumes this; Task 1 is terminal. The RNTP queue is replaced with `scope` on each tap; all downstream RNTP operations (`skipToNext`, `skipToPrevious`, auto-advance, `remote-next`, `remote-previous`) operate on the new queue without further App.js intervention.

- [ ] **Step 1: Read current `onSelect` in `App.js` to confirm exact lines**

Read `App.js` lines 200-215 to confirm the current `onSelect` implementation matches the spec. Expected current code:

```js
const onSelect = async (index) => {
  await TrackPlayer.skip(index);
  await TrackPlayer.play();
  const track = await TrackPlayer.getActiveTrack();
  setCurrentTrack(track);
  setView("player");
};
```

If the line numbers have shifted (App.js is a live file), locate `onSelect` via grep before editing.

- [ ] **Step 2: Update `onSelect` in `App.js`**

Replace the entire `onSelect` function with:

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

Use the Edit tool with `old_string` set to the full current function body (from `const onSelect = async (index) => {` through the closing `};`) and `new_string` set to the new function body above. The function is unique in `App.js` - no `replace_all` needed.

- [ ] **Step 3: Update the `onPress` call site in `PlaylistScreen.js`**

Read `src/screens/PlaylistScreen.js` lines 37-57 to confirm the current `renderItem` shape, then edit line 42.

Use the Edit tool with:

- `old_string`: `onPress={() => onSelect(playlist.indexOf(item))}`
- `new_string`: `onPress={() => onSelect(item, filtered)}`

This string is unique in the file (only one `onPress` inside `renderItem`). The `filtered` variable is already in scope - it's the `useMemo` result at line 13-18.

- [ ] **Step 4: Run Metro bundle build to verify no syntax / import errors**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`. Save the full output to the task report. If it fails, do not commit - investigate the error (likely a typo in the edit, or `setQueue` is not exported by the RNTP version in `package.json` - check `node_modules/react-native-track-player/lib/types/TrackPlayer.d.ts` for `setQueue` if so).

- [ ] **Step 5: Commit**

```bash
git add App.js src/screens/PlaylistScreen.js
git commit -m "$(cat <<'EOF'
Scope playback to filtered list on select

When a song is tapped in a filtered tab (favorites/recent/imported),
rebuild the RNTP queue to that filtered list so auto-advance, manual
skip, and lock-screen remote-next stay within the chosen scope.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Report manual verification steps to the user**

The agent cannot run the iOS simulator. Surface the following checklist to the user for manual verification (per the project's verification method):

> Manual simulator check:
> 1. 全部 tab, tap a song → auto-advance walks through the full list (regression check).
> 2. 收藏 tab, tap a song → auto-advance stays within favorites; when the last favorite finishes (repeat=off), playback stops.
> 3. 收藏 tab, tap a song, set repeat=queue → playback loops within favorites.
> 4. 最近 tab, tap a song → auto-advance follows the recent list order (most-recent-first), not the full-list order.
> 5. 我的音乐 tab, tap an imported song → auto-advance stays within imported tracks.
> 6. Start playback from 收藏, switch to 全部 tab without tapping → current track keeps playing, list shows full list, current track is highlighted.
> 7. 全部 tab, tap the currently playing song → it restarts from the beginning.
> 8. Lock the simulator, use Control Center next button while playback scope is 收藏 → next navigates within favorites.
> 9. Set repeat=off, play the last favorite in 收藏 to the end → currentTrack stays on the last favorite and the sticky card still shows it.

---

## Notes for the implementer

- **Why `setQueue` instead of `reset` + `add`:** `setQueue` is a single atomic call that replaces the queue in one step. `reset` + `add` is two steps and briefly leaves an empty queue, which can cause a playback-state flicker. `setQueue` is the idiomatic RNTP API for "replace queue."
- **Why `findIndex` after `setQueue`:** The track `item` is an object reference from the `filtered` array. After `setQueue(scope)`, RNTP's queue holds the same object references (or deep-equal copies depending on RNTP version). `scope.findIndex((t) => t.id === item.id)` finds the index by `id`, which is stable across reference / copy differences. Using `item.id` (not reference equality) is the robust choice.
- **Why no `try/catch`:** The pre-existing `onSelect` had no `try/catch`. The spec explicitly defers robustness to a separate pass. Do not add `try/catch` here - it would be scope creep.
- **Why `setView("player")` stays:** Tapping a song should navigate to the player screen, same as before. This is unchanged behavior.
- **Do not modify `initPlayer`:** The initial queue setup (`TrackPlayer.add(playlist)` + `TrackPlayer.add(imported)`) is correct - it matches the default 全部 tab. The first `onSelect` call will rebuild the queue as needed.
- **Do not modify `skipToNext` / `skipToPrevious`:** They call `TrackPlayer.skipToNext()` / `skipToPrevious()`, which already operate on the current queue. After `setQueue(scope)`, they naturally navigate within `scope`. No change needed.
- **Do not modify `service.js`:** `remote-next` / `remote-previous` call `TrackPlayer.skipToNext()` / `skipToPrevious()`, which operate on the current queue. No change needed.
- **Do not modify the `playback-track-changed` listener:** It calls `setCurrentTrack(await TrackPlayer.getActiveTrack())`, which works regardless of queue contents. No change needed.
