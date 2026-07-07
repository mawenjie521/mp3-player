# Auto-Advance Track Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync `currentTrack` state with `react-native-track-player` on auto-advance / remote-skip, add scroll-to-active in the playlist, and add a sticky "now playing" card.

**Architecture:** A single new `playback-track-changed` listener in `App.js` updates `currentTrack`; the existing `recent` useEffect and list highlight cascade automatically. `PlaylistScreen.js` adds `scrollToIndex` to bring the active row into view and a tappable sticky card above the list to surface the current track from any tab.

**Tech Stack:** React Native, `react-native-track-player` v4.1.1, React hooks (`useRef`, `useEffect`, `useMemo`).

## Global Constraints

- **No automated tests** — this project has no test suite. Verification is Metro bundle build + manual iOS simulator check. Do NOT run `npm test` (it exits 1 with "No tests found" — pre-existing, not a regression).
- **Verification gate per task:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must succeed (catches import / syntax / missing-module errors).
- **eslint is not configured** — do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Add playback-track-changed listener"), no Co-Authored-By trailer (matches recent project history).
- **COLORS:** `COLORS.accent = "#C20C0C"`, `COLORS.primaryText = "#ffffff"`, `COLORS.secondaryText = "#b3b3b3"`, `COLORS.background = "#1a1a1a"` — defined in `src/data/constants.js`.
- **App.js line budget:** P2/P3 set a 300-line soft budget; this plan pushes App.js to ~326 lines. Already exceeded by the background-audio work — acceptable.
- **No new files, no new dependencies.** Only `App.js` and `src/screens/PlaylistScreen.js` are touched.

## File Structure

- **`App.js`** (modify): Add `playback-track-changed` listener (Task 1), add `onShowPlayer` callback + pass it as a prop to `PlaylistScreen` (Task 3). Task 1 is the foundational data-flow fix; Task 3 wires the navigation callback for the sticky card.
- **`src/screens/PlaylistScreen.js`** (modify): Add `useRef`/`useEffect` for scroll-to-active (Task 2), add sticky "now playing" card JSX + styles + `onShowPlayer` prop (Task 3).

---

### Task 1: Add `playback-track-changed` listener in App.js

This is the foundational fix. Without it, `currentTrack` stays stale on auto-advance / remote-skip and Tasks 2-3 have nothing to react to. After this task: player screen, list highlight, and recent plays all update on auto-advance (existing cascades).

**Files:**
- Modify: `App.js` (add a `useEffect` next to the existing `playback-error` listener at lines 52-65)

**Interfaces:**
- Consumes: `TrackPlayer.addEventListener` (existing import, line 11), `TrackPlayer.getActiveTrack` (RNTP v4 API), `setCurrentTrack` (existing state setter, line 21)
- Produces: `currentTrack` state now updates on any track change (auto-advance, remote-next, remote-previous, programmatic skip). Downstream consumers (existing `recent` useEffect at line 75-82, `PlaylistScreen` highlight at line 28, `PlayerScreen` title/artwork/lyrics) cascade automatically — no changes needed there.

- [ ] **Step 1: Add the listener useEffect**

In `App.js`, immediately after the `playback-error` useEffect block (which ends at line 65 with `}, []);`), insert:

```js
  useEffect(() => {
    const sub = TrackPlayer.addEventListener("playback-track-changed", async () => {
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    });
    return () => sub.remove();
  }, []);
```

The full surrounding context should read:

```js
  useEffect(() => {
    const sub = TrackPlayer.addEventListener("playback-error", (error) => {
      console.error(error)
      Alert.alert(
        "播放失败",
        "当前歌曲无法播放，是否跳到下一首？",
        [
          { text: "下一首", onPress: () => skipToNext() },
          { text: "取消", style: "cancel" },
        ]
      );
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener("playback-track-changed", async () => {
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    });
    return () => sub.remove();
  }, []);
```

- [ ] **Step 2: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: bundle completes with no errors. The listener uses only existing imports (`TrackPlayer`, `useEffect`, `setCurrentTrack`) — no new imports needed.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "Add playback-track-changed listener to sync currentTrack on auto-advance"
```

---

### Task 2: Add scroll-to-active in PlaylistScreen

Now `currentTrack` updates on auto-advance (Task 1), but if the active row is off-screen the user has to manually scroll to find it. This task adds `FlatList.scrollToIndex` to bring the active row into view whenever `currentTrack`, `activeTab`, or `filtered` changes.

**Files:**
- Modify: `src/screens/PlaylistScreen.js` (import line 1, add `useRef`/`useEffect` after the `filtered` useMemo around line 18, add `ref` + `onScrollToIndexFailed` to the `FlatList` at line 91)

**Interfaces:**
- Consumes: `currentTrack` prop (already passed by App.js), `filtered` useMemo result (already computed at line 13-18), `activeTab` prop
- Produces: a `FlatList` that scrolls to keep the active row centered (vertically at `viewPosition: 0.5`) on auto-advance, tab switch, or remount after returning from the player screen

- [ ] **Step 1: Extend React import to include `useRef` and `useEffect`**

In `src/screens/PlaylistScreen.js` line 1, change:

```js
import React, { useMemo } from "react";
```

to:

```js
import React, { useMemo, useRef, useEffect } from "react";
```

- [ ] **Step 2: Add `listRef` and the scroll useEffect**

Inside `PlaylistScreen`, immediately after the `filtered` useMemo (which ends at line 18 with `}, [activeTab, playlist, favorites, recent]);`), insert:

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

The surrounding context should read:

```js
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    if (activeTab === "imported") return playlist.filter((t) => t.isImported);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);

  const listRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) return;
    const index = filtered.findIndex((t) => t.id === currentTrack.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    }
  }, [currentTrack?.id, activeTab, filtered]);
```

- [ ] **Step 3: Wire `ref` and `onScrollToIndexFailed` onto the FlatList**

Replace the existing `FlatList` (line 91-96):

```jsx
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        />
```

with:

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

`onScrollToIndexFailed` fires if `scrollToIndex` is called before the list has laid out (e.g., on first mount). The retry waits 100ms for layout to settle, then re-attempts. Without this, the initial scroll on returning from the player screen could silently no-op.

- [ ] **Step 4: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: bundle completes with no errors. `useRef` and `useEffect` are now used — if the import was not extended, this would fail with "useRef is not defined".

- [ ] **Step 5: Commit**

```bash
git add src/screens/PlaylistScreen.js
git commit -m "Scroll playlist to active track on auto-advance and tab switch"
```

---

### Task 3: Add sticky "now playing" card

A tappable card fixed at the top of the list view (above the FlatList, below the tab bar and import bar) that surfaces the current track from any tab. Tapping it navigates to the player screen without restarting playback.

**Files:**
- Modify: `App.js` (add `onShowPlayer` callback around line 188, pass it as a prop to `PlaylistScreen` around line 232-244)
- Modify: `src/screens/PlaylistScreen.js` (extend function signature at line 12, add card JSX before the FlatList around line 79, add styles to the StyleSheet)

**Interfaces:**
- Consumes: `currentTrack` prop (already passed), `setView` from App.js state (line 27)
- Produces: `onShowPlayer` callback (signature: `() => void`) passed from App.js to PlaylistScreen; PlaylistScreen renders the card when `currentTrack` is truthy and calls `onShowPlayer` on tap

- [ ] **Step 1: Add `onShowPlayer` callback in App.js**

In `App.js`, immediately after `onBack` (line 188-190):

```js
  const onBack = () => {
    setView("list");
  };
```

insert:

```js
  const onShowPlayer = () => setView("player");
```

The surrounding context should read:

```js
  const onBack = () => {
    setView("list");
  };

  const onShowPlayer = () => setView("player");
```

`onShowPlayer` is intentionally separate from `onSelect` (line 180-186): `onSelect` calls `TrackPlayer.skip + play`, which would replay the current track from the start. The sticky card should only navigate, not replay.

- [ ] **Step 2: Pass `onShowPlayer` to PlaylistScreen in App.js**

In `App.js`, the `PlaylistScreen` render block (line 233-243) currently reads:

```jsx
      <PlaylistScreen
        playlist={allTracks}
        currentTrack={currentTrack}
        onSelect={onSelect}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favorites={favorites}
        recent={recent}
        onImport={handleImport}
      />
```

Change it to:

```jsx
      <PlaylistScreen
        playlist={allTracks}
        currentTrack={currentTrack}
        onSelect={onSelect}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favorites={favorites}
        recent={recent}
        onImport={handleImport}
        onShowPlayer={onShowPlayer}
      />
```

- [ ] **Step 3: Add `onShowPlayer` to PlaylistScreen props**

In `src/screens/PlaylistScreen.js` line 12, change:

```js
function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent, onImport }) {
```

to:

```js
function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent, onImport, onShowPlayer }) {
```

- [ ] **Step 4: Add the sticky card JSX in PlaylistScreen**

In `src/screens/PlaylistScreen.js`, the section currently reads (lines 73-90):

```jsx
      {activeTab === "imported" && (
        <View style={styles.importBar}>
          <TouchableOpacity onPress={onImport} style={styles.importButton}>
            <Text style={styles.importButtonText}>+ 导入音乐</Text>
          </TouchableOpacity>
        </View>
      )}
      {filtered.length === 0 ? (
```

Insert the sticky card between the import-bar block and the `filtered.length === 0` check:

```jsx
      {activeTab === "imported" && (
        <View style={styles.importBar}>
          <TouchableOpacity onPress={onImport} style={styles.importButton}>
            <Text style={styles.importButtonText}>+ 导入音乐</Text>
          </TouchableOpacity>
        </View>
      )}
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
      {filtered.length === 0 ? (
```

The card is rendered on all tabs (it is outside any `activeTab ===` check). When `currentTrack` is `null` (initial launch, no track selected), the card is not rendered.

- [ ] **Step 5: Add the card styles to the StyleSheet**

In `src/screens/PlaylistScreen.js`, inside the `StyleSheet.create({...})` block, after the `importButtonText` style (line 217-220):

```js
  importButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
  },
```

insert:

```js
  nowPlayingCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#C20C0C0D",
  },
  nowPlayingThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  nowPlayingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nowPlayingLabel: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginBottom: 2,
  },
  nowPlayingTitle: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  nowPlayingArtist: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 1,
  },
  nowPlayingArrow: {
    color: COLORS.accent,
    fontSize: 14,
    marginLeft: 8,
  },
```

`#C20C0C0D` is `COLORS.accent` (`#C20C0C`) with `0D` alpha = 5.1% opacity, matching the spec's "~5% opacity, echoing `glowTop`" wording. The 8-digit `#RRGGBBAA` hex format is supported by React Native.

- [ ] **Step 6: Verify Metro bundle builds**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: bundle completes with no errors. Common failure modes this catches: typo in `onShowPlayer` prop name, missing style reference, JSX unclosed tag.

- [ ] **Step 7: Commit**

```bash
git add App.js src/screens/PlaylistScreen.js
git commit -m "Add sticky now-playing card to playlist screen"
```

---

## Verification (whole branch, after all 3 tasks)

Per the project's verification method (no automated tests):

1. **Metro bundle build** — `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` — must succeed.

2. **Manual iOS simulator check** (user-driven) — from the spec's verification section:
   - Play a track, let it finish naturally → confirm the player screen (title / artwork / lyrics) updates to the next track.
   - Switch to the list view → confirm the new track's row is highlighted and scrolled into view, and the sticky "now playing" card shows the new track.
   - Switch to the "收藏" tab with the current track not favorited → confirm the sticky card still shows the current track, and no scroll fires.
   - Tap the sticky card → confirm it navigates to the player screen without restarting playback.
   - Lock the simulator, use Control Center / lock screen next button → unlock and confirm the list and card have followed.
   - Set `repeat=off`, play the last track to the end → confirm `currentTrack` stays on the last track and the card still shows.
   - Switch to the "最近播放" tab after an auto-advance → confirm the new track appears at the top.

## Out of Scope

- Manual queue reordering / removal (deferred from P3).
- `retryInit` duplicate-queue bug (P5 candidate).
- ID3 tag extraction (P5 candidate).
- Non-MP3 format support (P5 candidate).
- Drag-to-seek on the lock screen (deferred from the background-audio spec).
