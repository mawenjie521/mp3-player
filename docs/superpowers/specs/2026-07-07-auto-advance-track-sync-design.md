# Auto-Advance Track Sync — Design Spec

**Date:** 2026-07-07
**Scope:** When a track finishes naturally (or is skipped via lock screen / Bluetooth), sync `currentTrack` state so the player screen, list highlight, list scroll position, recent-plays list, and a new sticky "now playing" card all reflect the active track.

## Problem

When the user manually taps "next" in the player screen, `skipToNext` calls `setCurrentTrack`, so everything stays in sync. But when the track advances **without going through `skipToNext`**, `currentTrack` state stays stale. Three triggers are affected:

1. **Natural auto-advance** — a track finishes playing; `react-native-track-player` internally advances to the next track in the queue.
2. **Lock screen / Control Center remote-next** — `service.js` handles `remote-next` by calling `TrackPlayer.skipToNext()` directly, never touching React state.
3. **Bluetooth / headphone media buttons** — same path as #2.

Symptoms the user reported:
- The playlist list does not move its highlight to the new track ("列表也定位到下一首").
- The "最近播放" (recent) tab does not record the new track ("最近播放也添加下一首").

Additional symptom the user did not mention but shares the same root cause:
- The player screen itself (title, artwork, lyrics) also stays on the old track while the new track's audio plays.

## Root Cause

`App.js` has no listener for `playback-track-changed`. The only track-state updates happen inside `skipToNext` (line 156) and `skipToPrevious` (line 166) and `onSelect` (line 180) — all manual user actions in the foreground UI. RNTP emits `playback-track-changed` for any active-track change (auto-advance, remote-next, remote-previous, programmatic `skip`), but nothing in the app listens for it.

The existing `recent` useEffect at line 75-82 keys off `currentTrack?.id`, so it only fires when React state updates — which never happens on auto-advance. Similarly, `PlaylistScreen`'s `isActive` highlight (line 28) compares against `currentTrack.id`, so it cannot move until `currentTrack` updates.

## Approach (chosen: A)

Three approaches were considered:

- **A. Minimal — listener + scroll + sticky card.** One new `useEffect` in `App.js` listens for `playback-track-changed`; existing `recent` useEffect and list highlight cascade automatically. Add `scrollToIndex` to `PlaylistScreen` so the active row scrolls into view. Add a sticky "now playing" card at the top of `PlaylistScreen` showing the current track, tappable to navigate to the player. **Chosen.**
- **B. A + extract `NowPlayingCard` component.** Same as A but pulls the card into `src/components/NowPlayingCard.js`. Rejected as over-decomposition — the card is ~10 lines of JSX.
- **C. A + extract `useTrackSync` hook.** Same as A but pulls the listener into `src/hooks/useTrackSync.js`. Rejected as over-abstraction — a single `useEffect` does not justify a hook file.

## Component Changes

### 1. `App.js` — `playback-track-changed` listener

Add a new `useEffect` next to the existing `playback-error` listener (line 52-65):

```js
useEffect(() => {
  const sub = TrackPlayer.addEventListener("playback-track-changed", async () => {
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  });
  return () => sub.remove();
}, []);
```

This listener fires on:
- Natural auto-advance when a track finishes.
- `remote-next` / `remote-previous` from lock screen, Control Center, Bluetooth, headphones.
- Programmatic `skipToNext` / `skipToPrevious` / `skip` (the manual paths already call `setCurrentTrack`; the listener re-sets to the same value — idempotent, no side effect).

### 2. `App.js` — `onShowPlayer` callback

Add a new callback that navigates from list to player **without** re-selecting / replaying the track:

```js
const onShowPlayer = () => setView("player");
```

Pass it to `PlaylistScreen` as the `onShowPlayer` prop (alongside the existing `onSelect`, `onBack`, etc.). `onSelect` cannot be reused because it calls `TrackPlayer.skip + play`, which would replay the current track from the start.

### 3. `src/screens/PlaylistScreen.js` — scroll to active track

Add a `ref` on the `FlatList` and a `useEffect` that scrolls to the active row whenever `currentTrack`, `activeTab`, or `filtered` changes:

```js
const listRef = useRef(null);

useEffect(() => {
  if (!currentTrack) return;
  const index = filtered.findIndex((t) => t.id === currentTrack.id);
  if (index >= 0) {
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
  }
}, [currentTrack?.id, activeTab, filtered]);
```

On the `FlatList` itself:

```jsx
<FlatList
  ref={listRef}
  data={filtered}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
  onScrollToIndexFailed={() => {
    setTimeout(() => {
      const idx = filtered.findIndex((t) => currentTrack && t.id === currentTrack.id);
      if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5 });
    }, 100);
  }}
/>
```

`onScrollToIndexFailed` covers the mount-time race where the list has not yet laid out when `scrollToIndex` is first called.

`viewPosition: 0.5` centers the active row vertically, keeping it clear of both the sticky card at the top and the bottom edge.

When the active track is not in `filtered` (e.g., the user is on the "favorites" tab but the current track is not favorited), `index === -1` and the scroll is skipped — the sticky card (section 4 below) still surfaces the current track.

### 4. `src/screens/PlaylistScreen.js` — sticky "now playing" card

Render a tappable card above the `FlatList` (below the tab bar and the optional import bar). It is **not** part of the scrollable list content — it stays fixed at the top of the screen.

Layout:

```
┌─────────────────────────────┐
│ ♪ 正在播放                    │  ← small label, secondary color
│ ┌──┐ 歌曲标题                 │
│ │  │ 歌手                     │  ← 48px artwork + title/artist
│ └──┘                     ▶  │  ▶ arrow hint, tappable to player
└─────────────────────────────┘
```

JSX:

```jsx
{currentTrack && (
  <TouchableOpacity
    style={styles.nowPlayingCard}
    onPress={onShowPlayer}
    activeOpacity={0.7}
  >
    <Image source={{ uri: currentTrack.artwork }} style={styles.nowPlayingThumb} />
    <View style={styles.nowPlayingInfo}>
      <Text style={styles.nowPlayingLabel}>正在播放</Text>
      <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentTrack.title}</Text>
      <Text style={styles.nowPlayingArtist} numberOfLines={1}>{currentTrack.artist}</Text>
    </View>
    <Text style={styles.nowPlayingArrow}>▶</Text>
  </TouchableOpacity>
)}
```

Styling mirrors the existing `listRow` (48px artwork, same title/artist font sizes) but adds a distinct background (`COLORS.accent` at ~5% opacity, echoing `glowTop`) and rounded corners so it reads as a separate "now playing" surface rather than another list row.

The card is shown on **all four tabs**. The current track is global state; the user should always be able to see what is playing regardless of which filter is active. When `currentTrack` is `null` (initial launch, no track selected yet), the card is not rendered.

### 5. No other file changes

- `service.js` — unchanged. `remote-next` / `remote-previous` already call `TrackPlayer.skipToNext()` / `skipToPrevious()`, which triggers `playback-track-changed` in RNTP, which the new `App.js` listener picks up.
- `PlayerScreen.js` — unchanged. It already derives everything from `currentTrack`, so once `currentTrack` updates on auto-advance, the title / artwork / lyrics / favorite icon all update for free.
- `src/components/*` — unchanged.
- No new npm dependencies.

## Behavior

### What the user will see

- A track finishes playing → the next track's audio begins, and within a frame or two the player screen (title, artwork, lyrics) updates to the new track.
- Switching back to the list view → the new track's row is highlighted with the ▶ icon and scrolled to vertical center; the sticky "now playing" card at the top shows the new track's artwork, title, and artist.
- The "最近播放" tab updates to put the new track at the top of the list.
- Lock screen / Control Center / Bluetooth / headphone next/previous buttons produce the same sync as foreground manual skips.
- Tapping the sticky card navigates to the player screen without restarting playback.

### What won't change

- Manual skip (next/previous buttons in the player screen, tapping a list row) behaves exactly as before — the new listener is idempotent on top of the existing `setCurrentTrack` calls.
- `repeat=off` queue boundary: when the last track finishes, RNTP emits `playback-queue-ended`, not `playback-track-changed`, so `currentTrack` stays on the last track. The sticky card continues to show it; no auto-scroll fires. This is the natural behavior — no special handling needed.
- Imported tracks (file:// URLs) sync the same way as remote URLs — the listener is track-source-agnostic.
- Favorites, repeat mode, and all other state are unaffected.

### Safe degradation

If `playback-track-changed` fires and `TrackPlayer.getActiveTrack()` returns `null` (queue emptied, `TrackPlayer.reset()` called, or teardown), `setCurrentTrack(null)` is called. The sticky card disappears, the list highlight clears, and no scroll fires. No crash, no stale state.

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** — `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` — catches import errors, syntax errors, and missing modules.
2. **Manual iOS simulator check** by the user:
   - Play a track, let it finish naturally → confirm the player screen (title / artwork / lyrics) updates to the next track.
   - Switch to the list view → confirm the new track's row is highlighted and scrolled into view, and the sticky "now playing" card shows the new track.
   - Switch to the "收藏" tab with the current track not favorited → confirm the sticky card still shows the current track, and no scroll fires.
   - Tap the sticky card → confirm it navigates to the player screen without restarting playback.
   - Lock the simulator, use Control Center / lock screen next button → unlock and confirm the list and card have followed.
   - Set `repeat=off`, play the last track to the end → confirm `currentTrack` stays on the last track and the card still shows it.
   - Switch to the "最近播放" tab after an auto-advance → confirm the new track appears at the top.

## Out of Scope

- Manual queue reordering / removal (deferred from P3).
- `retryInit` duplicate-queue bug (P5 candidate).
- ID3 tag extraction (P5 candidate).
- Non-MP3 format support (P5 candidate).
- Drag-to-seek on the lock screen (deferred from the background-audio spec).
