# Restore Last Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `{trackId, position, activeTab, repeatMode}` to AsyncStorage on track change and app background; on next app launch, restore the track at the saved position within the saved filtered scope, paused (no auto-play).

**Architecture:** Two new `useEffect`s in `App.js` handle save (one keyed on `currentTrack`/`activeTab`/`repeatMode` changes, one on `AppState` background/inactive). Restore runs at the end of `initPlayer` after loading all dependencies (imported/favorites/recent/savedPlayback) via `Promise.all`. A new `src/data/filterTracks.js` extracts the filter logic so App.js and PlaylistScreen.js share one source of truth.

**Tech Stack:** React Native 0.75.4 (`AppState` built-in), `react-native-track-player` (`getProgress`, `setQueue`, `skip`, `seekTo`, `setRepeatMode`), `@react-native-async-storage/async-storage` (via existing `storage.js`). No new dependencies.

## Global Constraints

- **No automated tests** - this project has no test suite. Verification is Metro bundle build + manual iOS simulator check by the user. Do NOT run `npm test` (it exits 1 with "No tests found" - pre-existing, not a regression).
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must exit 0 with `info Done writing bundle output`.
- **eslint is not configured** - do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Extract filterTracks helper"), with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.
- **AsyncStorage keys:** Existing - `@mp3player:favorites`, `@mp3player:recent`, `@mp3player:imported`. New - `@mp3player:playback` (stores `{trackId, position, activeTab, repeatMode}`).
- **`REPEAT_MAP`** is defined in `src/data/constants.js` as `{ off: RepeatMode.Off, queue: RepeatMode.Queue, track: RepeatMode.Track }`. Import `REPEAT_MAP` from `./src/data/constants` (already imported in App.js).
- **`loadJSON` / `saveJSON`** are imported from `./src/data/storage` (already imported in App.js). Both catch errors silently and return fallback / no-op.
- **Valid `activeTab` values:** `"all"`, `"favorites"`, `"recent"`, `"imported"` (defined as `TABS` in `src/screens/PlaylistScreen.js:5-10`).
- **Valid `repeatMode` values:** `"off"`, `"queue"`, `"track"` (keys of `REPEAT_MAP`).
- **`TrackPlayer.getProgress()`** returns `{ position, duration, buffered }` (all numbers in seconds). It is the source of truth for the current playback position.
- **No `play()` call in restore** - user explicitly chose "no auto-play". Restore sets the track + position + state, but leaves the player paused.
- **No `try/catch` added to `onSelect` / `skipToNext` / `skipToPrevious`** - robustness pass is deferred (consistent with the prior filtered-scope-playback feature).

## File Structure

- **`src/data/filterTracks.js`** (new, ~10 lines): Pure function `filterTracks(activeTab, allTracks, favorites, recent) -> Track[]`. Single source of truth for the filter logic. Used by App.js (restore) and PlaylistScreen.js (display).
- **`src/screens/PlaylistScreen.js`** (modify, ~5 lines changed): Replace the inline `useMemo` filter with a call to `filterTracks`. Add the import. No other change.
- **`App.js`** (modify, ~60 lines changed): Add `AppState` + `filterTracks` imports. Move `favorites`/`recent` loading into `initPlayer` via `Promise.all`. Remove two standalone loading `useEffect`s. Add restore block at end of `initPlayer`. Add save `useEffect`. Add `playbackRef` + `AppState` listener `useEffect`.

---

### Task 1: Extract filterTracks helper

Pure refactor - extract the filter logic from `PlaylistScreen.js` into a shared `filterTracks.js` so App.js can reuse it for restore in Task 2. No behavior change. PlaylistScreen's `filtered` output is byte-identical before and after.

**Files:**
- Create: `src/data/filterTracks.js`
- Modify: `src/screens/PlaylistScreen.js` (lines 1-3 import block, lines 13-18 `useMemo`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `filterTracks(activeTab: string, allTracks: Track[], favorites: string[], recent: string[]) -> Track[]`. Track shape: `{ id: string, title: string, artist: string, url: string, artwork: string, isImported?: boolean, lrc?: string }` (same as `playlist` / `importedTracks`).

- [ ] **Step 1: Create `src/data/filterTracks.js`**

Write the file with this exact content:

```js
export function filterTracks(activeTab, allTracks, favorites, recent) {
  if (activeTab === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (activeTab === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
```

- [ ] **Step 2: Add the import to `src/screens/PlaylistScreen.js`**

The current import block (line 3) is:

```js
import { COLORS } from "../data/constants";
```

Add a new line after it:

```js
import { COLORS } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
```

Use the Edit tool with `old_string` = `import { COLORS } from "../data/constants";` and `new_string` = the two lines above. This string is unique in the file.

- [ ] **Step 3: Replace the inline `useMemo` filter in `PlaylistScreen.js`**

The current `useMemo` (lines 13-18) is:

```js
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    if (activeTab === "imported") return playlist.filter((t) => t.isImported);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);
```

Replace it with:

```js
  const filtered = useMemo(
    () => filterTracks(activeTab, playlist, favorites, recent),
    [activeTab, playlist, favorites, recent]
  );
```

Use the Edit tool with `old_string` = the full current `useMemo` block (from `const filtered = useMemo(() => {` through the closing `}, [activeTab, playlist, favorites, recent]);`) and `new_string` = the new block above.

- [ ] **Step 4: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`. If it fails, investigate the error (likely a typo in the import path or the function name).

- [ ] **Step 5: Commit**

```bash
git add src/data/filterTracks.js src/screens/PlaylistScreen.js
git commit -m "$(cat <<'EOF'
Extract filterTracks helper

Pull the playlist filter logic out of PlaylistScreen.js into a shared
filterTracks function so App.js can reuse it for restore-on-launch in
the next change. No behavior change - PlaylistScreen's filtered output
is byte-identical.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Persist and restore playback state

The feature task. App.js gains save logic (track change + AppState background), restore logic (end of `initPlayer`), and the `favorites`/`recent` loads move into `initPlayer` so restore has all dependencies available.

**Files:**
- Modify: `App.js` (imports, `initPlayer`, remove two `useEffect`s, add two `useEffect`s, add `playbackRef`)

**Interfaces:**
- Consumes: `filterTracks(activeTab, allTracks, favorites, recent)` from Task 1. `loadJSON` / `saveJSON` from `./src/data/storage` (already imported). `REPEAT_MAP` from `./src/data/constants` (already imported). `AppState` from `react-native` (new import).
- Produces: No new exports. App.js internal behavior change only. The AsyncStorage key `@mp3player:playback` is now read and written.

- [ ] **Step 1: Add `AppState` to the `react-native` import in `App.js`**

The current import (lines 2-10) is:

```js
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from "react-native";
```

Add `AppState` to the list (alphabetical order places it first):

```js
import {
  AppState,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from "react-native";
```

Use the Edit tool with `old_string` = the full current import block (from `import {` through `} from "react-native";`) and `new_string` = the new block above.

- [ ] **Step 2: Add the `filterTracks` import to `App.js`**

The current imports from `./src/data/...` (lines 20-23) include:

```js
import { playlist } from "./src/data/playlist";
import { loadJSON, saveJSON } from "./src/data/storage";
import { loadImported, pickAndCopyTrack, persistImported } from "./src/data/importedTracks";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
```

Add a new import line after the `playlist` import:

```js
import { playlist } from "./src/data/playlist";
import { filterTracks } from "./src/data/filterTracks";
import { loadJSON, saveJSON } from "./src/data/storage";
import { loadImported, pickAndCopyTrack, persistImported } from "./src/data/importedTracks";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
```

Use the Edit tool with `old_string` = `import { playlist } from "./src/data/playlist";` and `new_string` = the two lines (playlist + filterTracks). This string is unique in the file.

- [ ] **Step 3: Remove the standalone `favorites` and `recent` loading `useEffect`s**

The current `useEffect`s at lines 83-89 are:

```js
  useEffect(() => {
    loadJSON("@mp3player:favorites", []).then(setFavorites);
  }, []);

  useEffect(() => {
    loadJSON("@mp3player:recent", []).then(setRecent);
  }, []);
```

Delete both `useEffect`s entirely. These loads move into `initPlayer` (Step 5) so they can be awaited before restore.

Use the Edit tool with `old_string` = the two full `useEffect` blocks (including the blank line between them, if present) and `new_string` = empty string. Alternatively, replace with a single blank line to preserve formatting.

**Important:** Do NOT delete the `recent`-saving `useEffect` at lines 91-98 (the one that calls `setRecent((prev) => ...)` and `saveJSON("@mp3player:recent", next)`). That one stays.

- [ ] **Step 4: Add the `playbackRef` and its update `useEffect`**

After the `playback-track-changed` listener `useEffect` (currently lines 75-81) and before the `recent`-saving `useEffect`, add:

```js
  const playbackRef = useRef(null);
  useEffect(() => {
    playbackRef.current = { currentTrack, activeTab, repeatMode };
  });
```

This ref lets the `AppState` listener (added in Step 7) read current state without re-subscribing on every render. The `useEffect` has no dependency array, so it runs after every render and keeps the ref fresh.

Use the Edit tool to insert this block. A good anchor: insert it right before the `recent`-saving `useEffect` (the one starting with `useEffect(() => {` and containing `if (!currentTrack) return;` and `setRecent((prev) =>`).

- [ ] **Step 5: Rewrite `initPlayer` to load all dependencies and restore saved state**

The current `initPlayer` (lines 122-156) is:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.DefaultToSpeaker,
        ],
      });
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
      });
      await TrackPlayer.add(playlist);
      await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      const imported = await loadImported();
      setImportedTracks(imported);
      if (imported.length > 0) await TrackPlayer.add(imported);
      setIsPlayerInitialized(true);
    } catch (e) {
      setInitError((e && e.message) || "播放器初始化失败");
    }
  };
```

Replace the entire function with:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.DefaultToSpeaker,
        ],
      });
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
      });
      await TrackPlayer.add(playlist);

      const [imported, savedFavs, savedRecent, savedPlayback] = await Promise.all([
        loadImported(),
        loadJSON("@mp3player:favorites", []),
        loadJSON("@mp3player:recent", []),
        loadJSON("@mp3player:playback", null),
      ]);

      setImportedTracks(imported);
      setFavorites(savedFavs);
      setRecent(savedRecent);
      if (imported.length > 0) await TrackPlayer.add(imported);

      if (savedPlayback && savedPlayback.trackId) {
        const { trackId, position, activeTab: savedTab, repeatMode: savedRepeat } = savedPlayback;
        const safeRepeat = REPEAT_MAP[savedRepeat] ? savedRepeat : "off";
        const safeTab = ["all", "favorites", "recent", "imported"].includes(savedTab) ? savedTab : "all";

        setRepeatMode(safeRepeat);
        await TrackPlayer.setRepeatMode(REPEAT_MAP[safeRepeat]);
        setActiveTab(safeTab);

        const allTracks = [...playlist, ...imported];
        const filtered = filterTracks(safeTab, allTracks, savedFavs, savedRecent);
        await TrackPlayer.setQueue(filtered);
        const idx = filtered.findIndex((t) => t.id === trackId);
        if (idx >= 0) {
          await TrackPlayer.skip(idx);
          if (typeof position === "number" && position > 0) {
            await TrackPlayer.seekTo(position);
          }
          const track = await TrackPlayer.getActiveTrack();
          setCurrentTrack(track);
        }
      } else {
        await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      }

      setIsPlayerInitialized(true);
    } catch (e) {
      setInitError((e && e.message) || "播放器初始化失败");
    }
  };
```

Key changes:
1. `TrackPlayer.setRepeatMode(REPEAT_MAP.off)` moved from before `loadImported` into the `else` branch (only set `off` when there's no saved state to restore).
2. `loadImported` + `favorites` + `recent` + `playback` loads merged into one `Promise.all`.
3. `setFavorites` / `setRecent` called here (replaces the deleted `useEffect`s from Step 3).
4. Restore block: validates `savedRepeat` / `savedTab`, sets state + RNTP repeat mode, rebuilds queue to filtered scope, skips to saved track, seeks to saved position, sets `currentTrack`. Does NOT call `play()`.
5. If `savedPlayback` is null or lacks `trackId`, falls through to the `else` branch (sets repeat off, no restore).

Use the Edit tool with `old_string` = the full current `initPlayer` function and `new_string` = the new function above.

- [ ] **Step 6: Add the save `useEffect` (on track/tab/repeatMode change)**

Add a new `useEffect` after the `recent`-saving `useEffect` (which was at lines 91-98, now shifted by the earlier edits). This `useEffect` saves the full playback state whenever `currentTrack`, `activeTab`, or `repeatMode` changes:

```js
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    (async () => {
      try {
        const { position } = await TrackPlayer.getProgress();
        if (cancelled) return;
        saveJSON("@mp3player:playback", {
          trackId: currentTrack.id,
          position: position || 0,
          activeTab,
          repeatMode,
        });
      } catch {
        // 静默失败 - 存储不可用不应阻断 UI
      }
    })();
    return () => { cancelled = true; };
  }, [currentTrack?.id, activeTab, repeatMode]);
```

The `cancelled` flag prevents a stale async save from overwriting a newer one if `currentTrack` changes again before `getProgress` resolves.

A good anchor: insert this right after the `recent`-saving `useEffect` (the one ending with `}, [currentTrack?.id]);`). Use the Edit tool to insert it after that block.

- [ ] **Step 7: Add the `AppState` listener `useEffect` (on background)**

Add a new `useEffect` after the save `useEffect` from Step 6. This listener saves the full state when the app goes to `inactive` or `background`:

```js
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "inactive" && state !== "background") return;
      const snap = playbackRef.current;
      if (!snap || !snap.currentTrack) return;
      try {
        const { position } = await TrackPlayer.getProgress();
        saveJSON("@mp3player:playback", {
          trackId: snap.currentTrack.id,
          position: position || 0,
          activeTab: snap.activeTab,
          repeatMode: snap.repeatMode,
        });
      } catch {
        // 静默失败
      }
    });
    return () => sub.remove();
  }, []);
```

The empty dependency array means the listener subscribes once. It reads current state via `playbackRef` (kept fresh by the `useEffect` from Step 4), avoiding re-subscription on every state change.

Use the Edit tool to insert this after the save `useEffect` from Step 6.

- [ ] **Step 8: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`. Save the last 5 lines to the report.

If it fails, common causes:
- `AppState` not imported (Step 1 missed)
- `filterTracks` import path wrong (Step 2)
- A deleted `useEffect` left a dangling reference (Step 3 - check that `setFavorites` / `setRecent` are only called in `initPlayer` now, not in a deleted `useEffect`)
- `playbackRef` not declared before use (Step 4 must come before Step 7's `useEffect`)

- [ ] **Step 9: Commit**

```bash
git add App.js
git commit -m "$(cat <<'EOF'
Persist and restore playback state across restarts

Save {trackId, position, activeTab, repeatMode} to AsyncStorage on
track change and app background; restore on next launch (paused at
the saved position, within the saved filtered scope). Moves favorites
and recent loads into initPlayer so restore has all dependencies.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 10: Report manual verification steps to the user**

The agent cannot run the iOS simulator. Surface the following checklist to the user for manual verification:

> Manual simulator check:
> 1. Play a song to mid-position, press Home (background) -> wait 5s -> kill app from app switcher -> relaunch -> confirm same song + roughly same position + paused.
> 2. In 收藏 tab, play a favorite, background + kill -> relaunch -> confirm activeTab=收藏, next/prev navigates within favorites.
> 3. Set repeat=queue, background + kill -> relaunch -> confirm repeatMode=queue.
> 4. Play a song, let it auto-advance in background, kill -> relaunch -> confirm restored to the new track (not the old one).
> 5. Play an imported track, background + kill -> relaunch -> confirm restored to the imported track.
> 6. Play a favorite, unfavorite it, background + kill -> relaunch -> confirm activeTab=收藏 but currentTrack=null (track not in scope, skipped).
> 7. First install (no saved state) -> launch -> confirm no restore, default behavior.
> 8. Play a song, pause, background + kill -> relaunch -> confirm restored at paused position, still paused (no auto-play).

---

## Notes for the implementer

- **Why `Promise.all` for the four loads in `initPlayer`:** `loadImported`, `loadJSON(favorites)`, `loadJSON(recent)`, and `loadJSON(playback)` are independent. Running them in parallel cuts init latency vs. sequential awaits. The restore logic needs all four results before it can run, so they must all complete first.
- **Why `playbackRef` instead of adding `currentTrack` / `activeTab` / `repeatMode` to the `AppState` listener's deps:** Adding them as deps would re-subscribe the `AppState` listener on every track change / tab switch / repeat toggle. That's wasteful (AppState events are rare) and risks missing an event during the re-subscribe window. The ref pattern subscribes once and reads current state at event time.
- **Why the save `useEffect` has a `cancelled` flag:** `getProgress()` is async. If `currentTrack` changes twice in quick succession (e.g., rapid skips), two saves are in flight. Without `cancelled`, the first save's resolution could overwrite the second's. The flag lets the cleanup function mark the first save as stale.
- **Why `safeRepeat` / `safeTab` validation:** If a future app version writes a new `repeatMode` or `activeTab` value, then the user downgrades, the old version would crash on `REPEAT_MAP[unknownMode]` (undefined) or silently filter wrong. The validation falls back to `off` / `all` for unknown values.
- **Why `setRepeatMode(safeRepeat)` (React state) AND `TrackPlayer.setRepeatMode(REPEAT_MAP[safeRepeat])` (RNTP):** The React state drives the UI (the repeat button icon in `Controls.js`). The RNTP call drives the actual repeat behavior. Both must be set for the UI and behavior to match.
- **Why the restore does NOT call `play()`:** The user explicitly chose "歌曲+位置(不自动播)" - restore the song and position, but leave it paused. The user taps play to resume.
- **Why `setQueue(filtered)` instead of `setQueue(allTracks)`:** The user explicitly chose "同时恢复过滤范围" - restore the filtered scope too, so next/prev stays within the saved scope (e.g., 收藏) instead of jumping to the full list.
- **Why the `else` branch sets `RepeatMode.off`:** The current code (before this change) unconditionally calls `TrackPlayer.setRepeatMode(REPEAT_MAP.off)` after `TrackPlayer.add(playlist)`. This moves that call into the `else` branch so it only fires when there's no saved state to restore. When there IS saved state, the repeat mode is set to `safeRepeat` inside the `if` branch.
- **Do NOT add `try/catch` to `onSelect`, `skipToNext`, `skipToPrevious`:** Robustness pass is deferred (consistent with the prior filtered-scope-playback feature). The `try/catch` blocks inside the new `useEffect`s (save + AppState) are about not crashing on storage errors, not about playback robustness.
- **Do NOT modify `service.js`, `PlayerScreen.js`, `Controls.js`, `PlaylistScreen.js` (beyond Task 1), `storage.js`, `constants.js`:** The spec is explicit about this. All changes are in `App.js` (Task 2) and `filterTracks.js` + `PlaylistScreen.js` (Task 1).
- **Do NOT persist `isPlaying`:** Restore is always paused. The user taps play to resume.
- **Do NOT add a `playback-queue-ended` listener:** Filtered list ending still leaves `currentTrack` on the last track (per the auto-advance spec). Out of scope.
