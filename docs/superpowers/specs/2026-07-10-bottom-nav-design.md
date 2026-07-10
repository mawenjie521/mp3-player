# Bottom Navigation - Design Spec

**Date:** 2026-07-10
**Scope:** Add a bottom navigation bar with three tabs - 歌曲 (Songs), 小说 (Novels), 我的 (Mine). Restructure the current single-list view into a tabbed architecture. The novels tab introduces audiobook playback reusing the existing player. The mine tab consolidates personal content (favorites, recent, imported) currently scattered as filter tabs on the playlist screen.

## Problem

The app currently has a single `PlaylistScreen` with four filter tabs (全部/收藏/最近播放/我的音乐) and a `view` state that toggles between list and full-screen player. This structure conflates "browse all music" with "browse my personal content" in one screen, and there is no home for a new content type (audiobooks/novels).

The user wants a bottom nav with three top-level destinations:

- **歌曲** - browse and play songs (the existing built-in playlist)
- **小说** - browse and play audiobooks (new content type, reuses the audio player)
- **我的** - personal content: favorites, recent plays, imported music

## Decisions (from brainstorming)

1. **Novels are audiobooks** (audio files), not text. Reuse `PlayerScreen` and `TrackPlayer` infrastructure - no new media stack.
2. **「我的」consolidates personal content.** Favorites, recent, imported (and the import button) move here. The songs tab becomes just the full song list.
3. **Novel data source: prebuilt samples.** New `novels.js` with 3 sample audiobooks, mirroring `playlist.js` style.
4. **Player hides bottom nav.** Full-screen `PlayerScreen` unchanged; back button returns to the originating tab.
5. **Implementation: custom state + component.** No `react-navigation` dependency. Extend the existing `view`-state pattern with a new `tab` state and a `BottomNav` component. Consistent with the project's minimal-deps approach.

## Architecture

### Navigation model

Two pieces of state in `App.js` control what the user sees:

- `tab: "songs" | "novels" | "mine"` - which bottom-nav tab is active (UI position)
- `view: "tabs" | "player"` - whether the full-screen player is overlaying (renamed from `"list"`/`"player"`)

Rendering:

- `view === "tabs"`: render the active tab's screen + `BottomNav` at the bottom
- `view === "player"`: render `PlayerScreen` full-screen (no `BottomNav`)

`PlayerScreen` keeps its existing back button, which sets `view` back to `"tabs"`. The `tab` state is preserved across the player overlay, so the user returns to the tab they launched the player from.

### Tab vs. scope separation

A subtle but important point: the tab the user is browsing and the queue's source scope can diverge. Example: user plays a song from the Songs tab, then switches to the Novels tab to browse. The song keeps playing; the queue is still "all songs" even though the UI is now on the Novels tab.

- `tab` - UI state, current bottom-nav position
- `scope` - queue source, locked when the user selects a track to play

`scope` takes values: `"songs" | "novels" | "favorites" | "recent" | "imported"`. It replaces the old `activeTab` field that conflated UI and queue scope.

## Screen Structure

### New: `src/components/TrackList.js`

Extracted from the current `PlaylistScreen`. A reusable list component that renders a FlatList of tracks plus the "正在播放" card. Props:

- `tracks` - array of track objects to render
- `currentTrack` - the currently playing track (for highlight + now-playing card)
- `onSelect(item, tracks)` - callback when a row is tapped
- `onShowPlayer` - callback when the now-playing card is tapped

The now-playing card shows on every tab so the user can return to the player from anywhere, regardless of whether the current track is a song or a novel.

### New: `src/screens/SongsScreen.js`

- Header: title "歌曲" + subtitle "共 N 首"
- Body: `<TrackList tracks={playlist} ... />`
- No filter tabs, no import button. Calls `onSelect(item, playlist)` with scope `"songs"` (passed through to App's `onSelect`).

### New: `src/screens/NovelsScreen.js`

- Header: title "小说" + subtitle "共 N 本"
- Body: `<TrackList tracks={novels} ... />`
- Structurally near-identical to `SongsScreen`. Separate file so future audiobook-specific features (chapters, sleep timer) have a home.
- Calls `onSelect(item, novels)` with scope `"novels"`.

### New: `src/screens/MineScreen.js`

Reuses the filter-tab pattern from the current `PlaylistScreen`, but with only three sub-tabs:

- 收藏 (favorites)
- 最近播放 (recent)
- 导入音乐 (imported) - includes the `+ 导入音乐` button bar

Local state `mineSubTab: "favorites" | "recent" | "imported"` controls which sub-tab is shown. Initialized on restore from the persisted `scope` if `tab === "mine"` (e.g. scope `"favorites"` -> mineSubTab `"favorites"`); otherwise defaults to `"favorites"`.

Calls `onSelect(item, filtered)` where `filtered` is the sub-tab's filtered list and the scope is the sub-tab key.

### `src/screens/PlayerScreen.js` - unchanged

Full-screen player. Back button sets `view` to `"tabs"`. No bottom nav visible.

### `src/components/BottomNav.js`

Three tabs, each a `TouchableOpacity` with an icon (Unicode symbol) and label. Highlights the active tab using `COLORS.accent`. Styled with `COLORS.background` and a top border to separate from content. Props:

- `activeTab: "songs" | "novels" | "mine"`
- `onChange(tab)`

Icon choices (Unicode, consistent with the project's existing `♥` `▶` `‹` `⤴` text-symbol style):

- 歌曲: `♫`
- 小说: `▤`
- 我的: `☻`

### Deleted: `src/screens/PlaylistScreen.js`

Fully replaced by `SongsScreen`, `NovelsScreen`, `MineScreen`, and the shared `TrackList`. Its filter-tab logic moves into `MineScreen`; its list rendering moves into `TrackList`.

## Data Model

### New: `src/data/novels.js`

3 sample audiobooks, same field shape as `playlist` entries plus an `isNovel: true` marker:

```js
export const novels = [
  {
    id: "n1",
    url: "<audiobook MP3 URL>",
    title: "示例有声书标题",
    artist: "演播者/作者",
    artwork: "https://picsum.photos/seed/novel1/600/600",
    lrc: "",
    category: "有声书",
    isNovel: true,
  },
  // ... 3 entries total
];
```

`lrc` is empty for audiobooks - the `Lyrics` component already handles the empty case gracefully.

Sample URLs: use the same external-MP3 pattern as `playlist.js` (e.g. `sound2.yywz123.com` domain) or LibriVox public-domain audiobook links. Exact URLs finalized during implementation - design does not lock specific URLs to avoid link-rot blocking the build.

### `isNovel` marker

Added to each entry in `novels.js`. Needed because `allTracks` is now `[...playlist, ...novels, ...importedTracks]` and `filterTracks` must distinguish songs from novels for the `"songs"` and `"novels"` scopes. Imported tracks keep `isImported: true` (already present) and do not get `isNovel` - imports remain song-type for now.

### No `kind` field elsewhere

The track shape is not otherwise extended. `TrackList` and `PlayerScreen` do not branch on song vs. novel - both render identically. The "now-playing" card shows on all tabs regardless of the current track's type. This keeps the change minimal; if audiobook-specific UI is needed later, `isNovel` is already available.

### Imports stay song-type

The import flow (`pickAndCopyTrack` in `importedTracks.js`) is unchanged. Imported files land in `importedTracks` and appear only in the 「我的」> 导入音乐 sub-tab. Importing novels is out of scope (YAGNI).

## State & Persistence

### App.js state changes

| State | Before | After |
|---|---|---|
| `view` | `"list" \| "player"` | `"tabs" \| "player"` (renamed) |
| `activeTab` | `"all" \| "favorites" \| "recent" \| "imported"` | removed |
| `tab` | (none) | `"songs" \| "novels" \| "mine"` - new |
| `scope` | (none) | `"songs" \| "novels" \| "favorites" \| "recent" \| "imported"` - new, set when a track is selected |

`mineSubTab` lives in `MineScreen` as local state, not in `App.js`. On restore, `MineScreen` initializes it from the restored `scope` if `tab === "mine"`, else `"favorites"`.

### `filterTracks.js` extension

Current signature `filterTracks(activeTab, allTracks, favorites, recent)` is renamed semantically - the first param is now `scope`, and two new branches are added:

```js
export function filterTracks(scope, allTracks, favorites, recent) {
  if (scope === "songs") return allTracks.filter((t) => !t.isNovel && !t.isImported);
  if (scope === "novels") return allTracks.filter((t) => t.isNovel);
  if (scope === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (scope === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (scope === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
```

### `onSelect` change

Existing `onSelect(item, scope)` second arg already carries the scope concept. Each tab screen passes its scope:

- `SongsScreen` -> `onSelect(item, "songs")` (well, `playlist` - but the scope is `"songs"`)
- `NovelsScreen` -> `onSelect(item, "novels")`
- `MineScreen` -> `onSelect(item, mineSubTab)` where `mineSubTab` is `"favorites"`/`"recent"`/`"imported"`

Inside `App.js`, `onSelect` now also stores `scope` in state and includes it in the persisted playback object (replacing `activeTab`).

### Persistence migration

`@mp3player:playback` structure changes. Old format has `activeTab`; new format has `tab` + `scope`.

| Old `activeTab` | New `tab` | New `scope` |
|---|---|---|
| `"all"` | `"songs"` | `"songs"` |
| `"favorites"` | `"mine"` | `"favorites"` |
| `"recent"` | `"mine"` | `"recent"` |
| `"imported"` | `"mine"` | `"imported"` |
| (new scenario) | `"novels"` | `"novels"` |

`initPlayer` restore logic detects old vs. new format: if the saved object has `activeTab` (string), map per the table above; if it has `tab` + `scope`, use directly. `trackId`, `position`, `repeatMode` are unchanged.

The queue rebuild in restore also changes: previously `filterTracks(safeTab, allTracks, ...)` where `allTracks` was `[...playlist, ...importedTracks]`. Now `allTracks` is `[...playlist, ...novels, ...importedTracks]` and `filterTracks(scope, ...)` returns the correct subset. For `scope === "songs"`, this correctly narrows from the combined list to just built-in songs (excluding novels and imports) - an improvement over the old `"all"` which would have included imports.

### Save logic

The existing `useEffect` keyed on `currentTrack?.id` / `activeTab` / `repeatMode` saves the playback state. It now keys on `currentTrack?.id` / `scope` / `repeatMode` and writes `tab` + `scope` instead of `activeTab`. The `AppState` background-save listener uses a `playbackRef` that captures `{ currentTrack, tab, scope, repeatMode }`.

## Constants

### `src/data/constants.js` - new `NAV_TABS`

```js
export const NAV_TABS = [
  { key: "songs", label: "歌曲", icon: "♫" },
  { key: "novels", label: "小说", icon: "▤" },
  { key: "mine", label: "我的", icon: "☻" },
];
```

Consumed by `BottomNav` (renders the three tabs) and `App.js` (no direct use, but `tab` state values match the keys).

## File Inventory

### New files

- `src/data/novels.js` - 3 sample audiobook entries with `isNovel: true`
- `src/components/BottomNav.js` - bottom navigation bar
- `src/components/TrackList.js` - reusable track list (FlatList + now-playing card)
- `src/screens/SongsScreen.js` - songs tab
- `src/screens/NovelsScreen.js` - novels tab
- `src/screens/MineScreen.js` - mine tab (3 sub-tabs + import button)

### Modified files

- `App.js` - add `tab`/`scope` state, render `BottomNav` + active tab screen, rename `view` values, `initPlayer` migration logic, `onSelect` stores `scope`, save logic writes new format
- `src/data/filterTracks.js` - add `songs`/`novels` branches, rename param `activeTab` -> `scope`
- `src/data/constants.js` - add `NAV_TABS`

### Deleted files

- `src/screens/PlaylistScreen.js` - replaced by the three new tab screens + `TrackList`

### App.js line budget

Current: 417 lines (already above the original 300-line budget due to restore-last-track). This change adds `tab`/`scope` state, `BottomNav` rendering, and migration logic (~+30 lines), offset by `onSelect` simplification and `PlaylistScreen` reference becoming three screen references (roughly flat). Estimated 430-450 lines after the change. Acceptable range given restore logic already pushed past budget. If it balloons past 470 during implementation, extract restore logic to `src/data/restoreState.js` as a follow-up.

## Verification

No automated tests (pre-existing project condition). Verification uses the project's standard two-step:

1. **Metro bundle build** - catches import errors, syntax errors, missing modules:
   ```
   npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
   ```
2. **Manual iOS simulator check** (user-driven):
   - Three bottom-nav tabs switch correctly, active tab highlighted
   - Songs tab: shows built-in song list, tapping a song enters player
   - Novels tab: shows 3 sample audiobooks, tapping enters player and plays
   - Mine tab: three sub-tabs work; import button in 导入音乐 sub-tab opens document picker
   - Player back button returns to the originating tab
   - Now-playing card shows on all three tabs, tapping it opens player
   - Kill app and relaunch: restores to the saved tab + resumes the saved track at saved position (paused)
   - Migration: existing users with old `activeTab` format restore correctly (test by clearing AsyncStorage, writing an old-format object, relaunching)

## Edge Cases

- **Empty novels list:** if `novels.js` is empty or URLs fail, the novels tab shows an empty-state message ("还没有有声书"). `TrackList` handles empty input.
- **Empty favorites/recent/imported:**沿用现有空状态文案 ("还没有收藏的歌曲" / "还没有播放记录" / "还没有导入音乐").
- **Cross-type now-playing card:** if a song is playing and the user is on the Novels tab, the now-playing card shows the song title. This is intentional - the card is a global "return to player" affordance, not a tab-local indicator.
- **Migration narrowing:** old `activeTab: "all"` mapped to `scope: "songs"` will narrow the restored queue from `allTracks` (songs + imports) to just built-in songs. This is correct: the old `"all"` included imports incidentally because `allTracks` was `[...playlist, ...importedTracks]`. Post-migration, imports live under their own scope and should not bleed into the songs queue.
- **Restore to mine tab:** if `tab === "mine"` on restore, `MineScreen` initializes `mineSubTab` from the restored `scope` (if scope is `favorites`/`recent`/`imported`); if scope is `songs`/`novels` but tab is somehow `mine` (shouldn't happen, but defensive), defaults to `"favorites"`.

## Out of Scope

- Novel-specific player features (chapters, sleep timer, playback speed) - future work
- Importing novels - imports remain song-type
- Search across songs/novels - previously deferred, still deferred
- Bottom-nav transitions/animations - keep it simple, instant tab switch
- `kind` field on tracks for broader type dispatch - `isNovel` is sufficient for current needs
