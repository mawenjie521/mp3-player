# Restore Last Track - Design Spec

**Date:** 2026-07-08
**Scope:** Persist playback state across app restarts. On relaunch, restore the track, position, filtered-tab scope, and repeat mode that were active when the app exited. Load the track paused at the saved position - do not auto-play.

## Problem

When the app is killed and relaunched, `initPlayer` rebuilds the queue from scratch (`playlist + importedTracks`), `currentTrack` starts `null`, `activeTab` resets to `"all"`, and `repeatMode` resets to `"off"`. The user has to re-tap a song, re-select their tab, and re-set repeat mode to get back to where they were. There is no `AppState` handling and no persistence of the active playback state.

The existing persistence layer (`storage.js` with `loadJSON` / `saveJSON` over AsyncStorage) already persists `favorites`, `recent`, and `importedTracks`. The `@mp3player:playback` key for the active playback state does not exist yet.

## Approach (chosen: A)

Three approaches were considered for **when to save**:

- **A. Save on track change + on app background.** A `useEffect` keyed on `currentTrack?.id` / `activeTab` / `repeatMode` saves the full state (trackId + position from `getProgress()` + activeTab + repeatMode) whenever any of these change. A new `AppState` listener saves the same state when the app goes to `inactive` / `background`. Restore runs at the end of `initPlayer` after all dependencies are loaded. **Chosen.**
- **B. Save only on app background.** Single `AppState` listener. Rejected: if the track auto-advances while the app is in background, the saved state still points at the old track; restore would load the wrong song.
- **C. Save continuously (every N seconds) + on background.** `setInterval` polling. Rejected: excessive AsyncStorage writes for marginal position accuracy; over-engineering for a music player.

A companion decision: **also restore `repeatMode` and `activeTab`**, not just the track. The user explicitly chose to restore the filtered scope (so next/prev stay within the saved scope) and the repeat mode (so loop behavior is preserved).

## Component Changes

### 1. New file: `src/data/filterTracks.js`

Extract the filter logic currently inlined in `PlaylistScreen.js` (lines 13-18) into a reusable function. App.js needs it for restore; PlaylistScreen.js uses it for display. Single source of truth.

```js
export function filterTracks(activeTab, allTracks, favorites, recent) {
  if (activeTab === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (activeTab === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
```

### 2. `src/screens/PlaylistScreen.js` - use `filterTracks`

Replace the inline `useMemo` filter (lines 13-18) with a call to `filterTracks`:

```js
import { filterTracks } from "../data/filterTracks";

// ...
const filtered = useMemo(
  () => filterTracks(activeTab, playlist, favorites, recent),
  [activeTab, playlist, favorites, recent]
);
```

No other change to this file.

### 3. `App.js` - imports

Add `AppState` to the existing `react-native` import. Add `filterTracks` import.

```js
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Alert, AppState,
} from "react-native";
import { filterTracks } from "./src/data/filterTracks";
```

### 4. `App.js` - `initPlayer` loads favorites + recent + saved playback

Currently `initPlayer` (lines 122-156) loads only `imported`. Two separate `useEffect`s (lines 83-89) load `favorites` and `recent` in parallel. Move all three loads into `initPlayer` via `Promise.all`, plus the new `@mp3player:playback` load:

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
        Capability.Play, Capability.Pause, Capability.Stop,
        Capability.SkipToNext, Capability.SkipToPrevious,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
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
        // Intentionally do NOT call TrackPlayer.play() - user chose "no auto-play"
      }
      // If idx === -1: track not in scope (e.g., unfavorited) - skip track restore,
      // but repeatMode + activeTab are still restored above.
    } else {
      await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
    }

    setIsPlayerInitialized(true);
  } catch (e) {
    setInitError((e && e.message) || "播放器初始化失败");
  }
};
```

### 5. `App.js` - remove the standalone favorites/recent loading `useEffect`s

Delete these two `useEffect`s (lines 83-89):

```js
useEffect(() => {
  loadJSON("@mp3player:favorites", []).then(setFavorites);
}, []);

useEffect(() => {
  loadJSON("@mp3player:recent", []).then(setRecent);
}, []);
```

They are now handled inside `initPlayer` (with `Promise.all`). The `recent`-saving `useEffect` (lines 91-98) stays - it saves recent when `currentTrack` changes.

### 6. `App.js` - new save `useEffect` (on track/tab/repeatMode change)

Add a new `useEffect` that saves the full playback state whenever `currentTrack`, `activeTab`, or `repeatMode` changes:

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

This fires on:
- Track change (manual skip, auto-advance, restore) - saves new track + current position
- Tab switch - saves current track + position + new tab
- Repeat mode change - saves current track + position + new mode

The restore path triggers this useEffect (because `setCurrentTrack` is called), which may overwrite the saved position with a slightly stale value (if `seekTo` hasn't completed when `getProgress` runs). This is acceptable - the next background event or track change refreshes the correct position. See Edge Cases.

### 7. `App.js` - new `AppState` listener `useEffect` (on background)

Add a new `useEffect` that saves the full state when the app goes to `inactive` or `background`. Uses a ref to access current `currentTrack` / `activeTab` / `repeatMode` without re-subscribing on every state change:

```js
const playbackRef = useRef(null);
useEffect(() => {
  playbackRef.current = { currentTrack, activeTab, repeatMode };
});

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

The ref is updated on every render (the first `useEffect` with no deps array constraint). The `AppState` listener is stable (empty deps), avoiding re-subscription on every state change.

### 8. No other file changes

- `service.js` - unchanged. Remote events don't need to save state; the `currentTrack` change they cause flows through the existing `playback-track-changed` listener, which triggers `setCurrentTrack`, which triggers the save `useEffect`.
- `PlayerScreen.js`, `Controls.js`, `PlaylistScreen.js` (beyond the `filterTracks` extraction) - unchanged.
- `src/data/storage.js` - unchanged. `loadJSON` / `saveJSON` already handle errors silently.
- `src/data/constants.js` - unchanged. `REPEAT_MAP` already covers `off` / `queue` / `track`.
- No new npm dependencies. `AppState` is a React Native built-in.

## Behavior Matrix

| Scenario | Old behavior | New behavior |
|----------|-------------|--------------|
| First launch (no saved state) | Queue = full list, currentTrack = null, activeTab = all, repeat = off | Same (no restore) |
| Relaunch after exit (saved state) | Same as first launch | Restore: repeatMode set, activeTab set, queue = filtered scope, track loaded at saved position, paused |
| Track changes (foreground) | currentTrack updates | Same + save `@mp3player:playback` |
| Track auto-advances (background) | currentTrack updates via `playback-track-changed` | Same + save `@mp3player:playback` (trackId = new track, position ~0) |
| User switches tab | activeTab updates | Same + save `@mp3player:playback` |
| User toggles repeat | repeatMode updates | Same + save `@mp3player:playback` |
| App backgrounds | No lifecycle handling | Save `@mp3player:playback` with current position |
| Saved track not in scope (unfavorited) | N/A | Restore repeatMode + activeTab only; currentTrack = null |
| Saved track deleted (imported removed) | N/A | Same as above |
| Saved position > duration | N/A | `seekTo` clamps to duration, no crash |
| Restore triggers save useEffect | N/A | Saves with possibly-stale position; corrected on next background/track-change |

## Edge Cases and Error Handling

- **First launch**: `loadJSON("@mp3player:playback", null)` returns `null` -> skip restore, set `RepeatMode.off`, fall through to `setIsPlayerInitialized(true)`. Identical to current behavior.
- **Corrupted saved state**: `loadJSON` catches JSON parse errors and returns `null`. If the object exists but lacks `trackId`, the `if (savedPlayback && savedPlayback.trackId)` guard skips restore.
- **Invalid `repeatMode`** (e.g., unknown string from a future version): `safeRepeat = REPEAT_MAP[savedRepeat] ? savedRepeat : "off"` falls back to `off`.
- **Invalid `activeTab`**: `safeTab = ["all", "favorites", "recent", "imported"].includes(savedTab) ? savedTab : "all"` falls back to `all`.
- **Saved track not in filtered scope** (e.g., was in favorites, user unfavorited before relaunch): `idx === -1` -> skip `skip`/`seekTo`/`setCurrentTrack`, but `repeatMode` + `activeTab` are still restored. `currentTrack` stays `null`; user taps a song to start playback.
- **Saved track completely gone** (imported track deleted): same as above - `idx === -1`.
- **Saved position > duration**: `TrackPlayer.seekTo` clamps internally; no error.
- **Restore triggers save useEffect**: when `setCurrentTrack(track)` runs during restore, the save `useEffect` (section 6) fires. `getProgress()` might return 0 if `seekTo` hasn't completed, saving `{trackId, position: 0, ...}`. The next background event or track change overwrites this with the correct position. Window of inconsistency: from restore to next save trigger. Acceptable.
- **App killed in foreground** (rare - crash, force-quit from app switcher while foregrounded): saved position is from the last track change or background event, may be stale. Acceptable - iOS users typically background before killing.
- **AsyncStorage unavailable**: `loadJSON` / `saveJSON` already catch and return fallback / silently fail. No crash, no playback impact.
- **Background auto-advance**: track changes in background -> `playback-track-changed` fires -> `setCurrentTrack` -> save useEffect saves new track (position ~0). On relaunch, the saved track is the new one, correct.

## Out of Scope

- **Second-level position accuracy** across background-to-kill window - accepted drift.
- **Custom queue reordering** (P3 deferred queue management).
- **Auto-play on restore** - user explicitly chose "no auto-play".
- **Persisting `isPlaying` state** - restore is always paused.
- **`playback-queue-ended` handling** - filtered list ending still leaves `currentTrack` on the last track (per auto-advance spec).
- **Periodic position saves** ( Approach C ) - rejected as over-engineering.
- **Restoring `recent` tab scroll position** - out of scope.

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** - `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` - catches import errors (especially `AppState`, `filterTracks`) and syntax issues.
2. **Manual iOS simulator check** by the user:
   - Play a song to mid-position, press Home (background) -> wait 5s -> kill app from app switcher -> relaunch -> confirm same song + roughly same position + paused state.
   - In "收藏" tab, play a favorite, background + kill -> relaunch -> confirm `activeTab = 收藏`, next/prev navigates within favorites.
   - Set `repeat = queue`, background + kill -> relaunch -> confirm `repeatMode = queue`.
   - Play a song, let it auto-advance in background, kill -> relaunch -> confirm restored to the new track (not the old one).
   - Play an imported track, background + kill -> relaunch -> confirm restored to the imported track.
   - Play a favorite, unfavorite it (while paused or playing), background + kill -> relaunch -> confirm `activeTab = 收藏` but `currentTrack = null` (track not in scope, track restore skipped).
   - First install (no saved state) -> launch -> confirm no restore, default behavior.
   - Play a song, pause, background + kill -> relaunch -> confirm restored at paused position, still paused (no auto-play).
