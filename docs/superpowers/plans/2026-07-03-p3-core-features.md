# P3 Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LRC lyric sync, favorites, and recent plays to the MP3 vinyl player.

**Architecture:** State (favorites, recent, activeTab) lives in App.js, persisted via the existing storage.js utility (built in P2, first consumer in P3). LRC parsing is a pure function in src/data/lrcParser.js, consumed by the Lyrics component via useMemo. Filter tabs on the playlist screen switch between all/favorites/recent views.

**Tech Stack:** React Native 0.75.4, React 18.3.1, react-native-track-player 4.1.1, @react-native-async-storage/async-storage.

## Global Constraints

- **No new npm dependencies** — `@react-native-async-storage/async-storage` was installed in P2.
- **App.js ≤ 300 lines** (P2 baseline: 243; P3 estimate: ~290).
- **Preserve P2 module structure** — `src/data/`, `src/components/`, `src/screens/`, `src/error/`. No new top-level directories.
- **Preserve P1 behavior** — three-state repeat loop (off → queue → track → off), layered error handling (init error page, playback-error Alert, silent skip-boundary), playback logic unchanged.
- **AsyncStorage package**: `@react-native-async-storage/async-storage` (NOT the deprecated `@react-native-community/async-storage`).
- **Storage keys**: `@mp3player:favorites` (string[] of track ids), `@mp3player:recent` (string[] of track ids, most-recent-first, deduped, cap 20).
- **COLORS centralization** — all colors via `COLORS.*` from `src/data/constants.js`; no hardcoded hex.
- **ErrorBoundary** — single outer wrap (`<ErrorBoundary>{content}</ErrorBoundary>`), unchanged from P2.
- **Verification** — Metro bundle build (`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`) + manual iOS simulator check. No automated tests exist (jest configured but 0 test files; pre-existing, not a regression). Do NOT run `npm test` as a gate — it exits 1 with "No tests found".
- **saveJSON inside state updater** — call `saveJSON` inside the `setFavorites`/`setRecent` updater function (not outside) to avoid stale-closure bugs.
- **Branch**: create `feature/p3-core-features` from `main` before Task 1.

---

## File Structure

| File | Type | Responsibility |
| --- | --- | --- |
| `src/data/lrcParser.js` | Create | `parseLRC(lrc) → {time, text}[]`; `findCurrentIndex(parsed, position) → number` |
| `src/data/playlist.js` | Modify | Each track: `lyrics: string[]` → `lrc: string` (LRC format with timestamps) |
| `src/components/Lyrics.js` | Modify | Props `({lines, currentIndex})` → `({lrc, position})`; internal parse + find via useMemo |
| `src/screens/PlayerScreen.js` | Modify | Remove lyricIndex useMemo; update Lyrics call site; add heart icon + `isFavorite`/`onToggleFavorite` props |
| `src/screens/PlaylistScreen.js` | Modify | Add filter tab bar (全部/收藏/最近播放); filter logic; dynamic subtitle; empty states |
| `App.js` | Modify | Add `favorites`/`recent`/`activeTab` state; load effects; song-change effect; `toggleFavorite` handler; pass new props |

---

## Task 1: LRC Lyric Sync

Replace placeholder lyric arrays with real LRC timestamps. Lyrics now scroll based on playback position instead of proportional duration slicing.

**Files:**
- Create: `src/data/lrcParser.js`
- Modify: `src/data/playlist.js`
- Modify: `src/components/Lyrics.js`
- Modify: `src/screens/PlayerScreen.js`

**Interfaces:**
- Produces: `parseLRC(lrc: string) → Array<{time: number, text: string}>` and `findCurrentIndex(parsed: Array<{time, text}>, position: number) → number` in `src/data/lrcParser.js`
- Consumes: none (foundation task)

- [ ] **Step 1: Create `src/data/lrcParser.js`**

```js
// src/data/lrcParser.js
export function parseLRC(lrc) {
  if (!lrc) return [];
  const lines = lrc.split("\n");
  const result = [];
  const timeRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  for (const line of lines) {
    const times = [...line.matchAll(timeRe)];
    const text = line.replace(timeRe, "").trim();
    if (times.length === 0 || !text) continue;
    for (const m of times) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 1000;
      result.push({ time: sec, text });
    }
  }
  result.sort((a, b) => a.time - b.time);
  return result;
}

export function findCurrentIndex(parsed, position) {
  if (parsed.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].time <= position) idx = i;
    else break;
  }
  return idx;
}
```

- [ ] **Step 2: Update `src/data/playlist.js` — replace `lyrics: string[]` with `lrc: string` for all 3 tracks**

Replace the entire file content with:

```js
export const playlist = [
  {
    id: "1",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "示例音乐 1",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song1/600/600",
    lrc: `[00:12.34]夜色温柔如水
[00:15.67]音符在指尖流淌
[00:19.00]回忆像风一样
[00:23.50]吹过空荡的街
[00:27.80]我们都在追寻
[00:31.20]那一束微光
[00:35.00]时间停在原地
[00:38.90]听一首老歌`,
  },
  {
    id: "2",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "示例音乐 2",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song2/600/600",
    lrc: `[00:13.20]月光洒在窗台
[00:16.50]心事无处安放
[00:20.10]远处灯火阑珊
[00:24.30]谁在轻声哼唱
[00:28.60]走过多少旅程
[00:32.40]才学会遗忘
[00:36.10]梦里有你的脸
[00:40.00]醒来只剩空`,
  },
  {
    id: "3",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "示例音乐 3",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song3/600/600",
    lrc: `[00:11.50]雨滴敲打屋檐
[00:14.80]节奏像心跳声
[00:18.30]城市在沉睡中
[00:22.70]独自闪烁霓虹
[00:26.90]每一段旋律里
[00:30.50]藏着旧时光
[00:34.20]让音乐带我们
[00:38.60]回到那一年`,
  },
];
```

- [ ] **Step 3: Rewrite `src/components/Lyrics.js`**

Replace the entire file content with:

```jsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { parseLRC, findCurrentIndex } from "../data/lrcParser";

function Lyrics({ lrc, position }) {
  const parsed = useMemo(() => parseLRC(lrc), [lrc]);
  const currentIndex = useMemo(() => findCurrentIndex(parsed, position), [parsed, position]);

  if (parsed.length === 0) {
    return (
      <View style={styles.lyricsContainer}>
        <Text style={styles.emptyText}>暂无歌词</Text>
      </View>
    );
  }

  const visible = [];
  for (let i = -1; i <= 1; i++) {
    const idx = currentIndex + i;
    if (idx >= 0 && idx < parsed.length) {
      visible.push({ idx, text: parsed[idx].text });
    }
  }

  return (
    <View style={styles.lyricsContainer}>
      {visible.map(({ idx, text }) => {
        const isCurrent = idx === currentIndex;
        return (
          <Text key={idx} style={[styles.lyricLine, isCurrent && styles.lyricCurrent]} numberOfLines={1}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lyricsContainer: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  lyricLine: {
    fontSize: 14,
    color: COLORS.secondaryText,
    opacity: 0.4,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    color: COLORS.primaryText,
    opacity: 1,
    fontWeight: "600",
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});

export default Lyrics;
```

- [ ] **Step 4: Update `src/screens/PlayerScreen.js` — remove lyricIndex, update Lyrics call**

Two changes:

Change 1 — line 1, remove `useMemo` from the React import (no longer used after removing lyricIndex):

```jsx
import React from "react";
```

Change 2 — remove the `lyricIndex` useMemo block (current lines 24-28). Delete entirely:

```jsx
// DELETE this block:
const lyricIndex = useMemo(() => {
  if (!currentTrack || !currentTrack.lyrics || !duration) return 0;
  const idx = Math.floor((position / duration) * currentTrack.lyrics.length);
  return Math.min(idx, currentTrack.lyrics.length - 1);
}, [position, duration, currentTrack]);
```

Change 3 — update the Lyrics call site (current line 61). Change from:

```jsx
<Lyrics lines={currentTrack.lyrics || []} currentIndex={lyricIndex} />
```

to:

```jsx
<Lyrics lrc={currentTrack.lrc} position={position} />
```

- [ ] **Step 5: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: build succeeds with no errors. Check for:
- No "Module not found" errors for `../data/lrcParser`
- No syntax errors
- Bundle written to `/tmp/test-bundle.js`

- [ ] **Step 6: Commit**

```bash
git add src/data/lrcParser.js src/data/playlist.js src/components/Lyrics.js src/screens/PlayerScreen.js
git commit -m "Add LRC lyric sync: parser, LRC data, Lyrics component"
```

---

## Task 2: Favorites

Add a heart icon in the player top bar. Tapping toggles favorite state, persisted to AsyncStorage. Loaded on app launch.

**Files:**
- Modify: `App.js`
- Modify: `src/screens/PlayerScreen.js`

**Interfaces:**
- Consumes: `loadJSON`/`saveJSON` from `src/data/storage.js` (P2)
- Produces: `favorites: string[]` state and `toggleFavorite(id: string) → void` handler in App.js; `isFavorite: boolean` and `onToggleFavorite: (id: string) → void` props on PlayerScreen

- [ ] **Step 1: Update `App.js` — add storage import**

After the existing `import { playlist } from "./src/data/playlist";` (line 12), add:

```jsx
import { loadJSON, saveJSON } from "./src/data/storage";
```

- [ ] **Step 2: Update `App.js` — add favorites state**

After the existing `const [view, setView] = useState("list");` (line 25), add:

```jsx
const [favorites, setFavorites] = useState([]);
```

- [ ] **Step 3: Update `App.js` — add favorites load effect**

After the existing playback-error `useEffect` block (closes at line 57 with `}, []);`), add:

```jsx
useEffect(() => {
  loadJSON("@mp3player:favorites", []).then(setFavorites);
}, []);
```

- [ ] **Step 4: Update `App.js` — add toggleFavorite handler**

After the `onBack` handler (lines 146-148), add:

```jsx
const toggleFavorite = (id) => {
  setFavorites((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    saveJSON("@mp3player:favorites", next);
    return next;
  });
};
```

- [ ] **Step 5: Update `App.js` — pass isFavorite + onToggleFavorite to PlayerScreen**

In the `PlayerScreen` JSX block (currently lines 177-191), add two new props. After `onBack={onBack}`, add:

```jsx
        isFavorite={favorites.includes(currentTrack?.id)}
        onToggleFavorite={toggleFavorite}
```

The full PlayerScreen block becomes:

```jsx
content = (
  <PlayerScreen
    currentTrack={currentTrack}
    isPlaying={isPlaying}
    position={position}
    duration={duration}
    repeatMode={repeatMode}
    spin={spin}
    onTogglePlay={togglePlayback}
    onSkipNext={skipToNext}
    onSkipPrev={skipToPrevious}
    onSeek={seekTo}
    onToggleRepeat={toggleRepeat}
    onBack={onBack}
    isFavorite={favorites.includes(currentTrack?.id)}
    onToggleFavorite={toggleFavorite}
  />
);
```

- [ ] **Step 6: Update `src/screens/PlayerScreen.js` — add isFavorite + onToggleFavorite props**

In the function signature (lines 10-23), add the two new props. After `onBack,` add:

```jsx
  isFavorite,
  onToggleFavorite,
```

The full signature becomes:

```jsx
function PlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  repeatMode,
  spin,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onToggleRepeat,
  onBack,
  isFavorite,
  onToggleFavorite,
}) {
```

- [ ] **Step 7: Update `src/screens/PlayerScreen.js` — add heart icon in top bar**

In the `topBar` View (currently lines 48-54), insert a heart `TouchableOpacity` between the title `Text` and the share `Text`. Replace the block:

```jsx
<View style={styles.topBar}>
  <TouchableOpacity onPress={onBack} style={styles.topBackButton}>
    <Text style={styles.topIcon}>‹</Text>
  </TouchableOpacity>
  <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
  <Text style={styles.topIcon}>⤴</Text>
</View>
```

with:

```jsx
<View style={styles.topBar}>
  <TouchableOpacity onPress={onBack} style={styles.topBackButton}>
    <Text style={styles.topIcon}>‹</Text>
  </TouchableOpacity>
  <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
  <TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBackButton}>
    <Text style={[styles.topIcon, { color: isFavorite ? COLORS.accent : COLORS.secondaryText }]}>
      {isFavorite ? "♥" : "♡"}
    </Text>
  </TouchableOpacity>
  <Text style={styles.topIcon}>⤴</Text>
</View>
```

- [ ] **Step 8: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: build succeeds, no errors.

- [ ] **Step 9: Commit**

```bash
git add App.js src/screens/PlayerScreen.js
git commit -m "Add favorites: heart icon in player, AsyncStorage persistence"
```

---

## Task 3: Recent Plays

Record the current track id when a song starts playing. Persist to AsyncStorage (cap 20, most-recent-first, deduped). Loaded on app launch. No UI in this task — the filter tab UI comes in Task 4.

**Files:**
- Modify: `App.js`

**Interfaces:**
- Consumes: `loadJSON`/`saveJSON` from `src/data/storage.js` (already imported in Task 2)
- Produces: `recent: string[]` state in App.js (consumed by PlaylistScreen in Task 4)

- [ ] **Step 1: Update `App.js` — add recent state**

After the `const [favorites, setFavorites] = useState([]);` line (added in Task 2), add:

```jsx
const [recent, setRecent] = useState([]);
```

- [ ] **Step 2: Update `App.js` — add recent load effect**

After the favorites load effect (added in Task 2), add:

```jsx
useEffect(() => {
  loadJSON("@mp3player:recent", []).then(setRecent);
}, []);
```

- [ ] **Step 3: Update `App.js` — add song-change effect to update recent**

After the recent load effect from Step 2, add:

```jsx
useEffect(() => {
  if (!currentTrack) return;
  setRecent((prev) => {
    const next = [currentTrack.id, ...prev.filter((id) => id !== currentTrack.id)].slice(0, 20);
    saveJSON("@mp3player:recent", next);
    return next;
  });
}, [currentTrack?.id]);
```

- [ ] **Step 4: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add App.js
git commit -m "Add recent plays tracking with AsyncStorage persistence"
```

---

## Task 4: Playlist Filter Tabs

Add a filter tab bar (全部/收藏/最近播放) to the playlist screen. Tapping a tab filters the list. Dynamic subtitle shows count. Empty states for favorites/recent.

**Files:**
- Modify: `App.js`
- Modify: `src/screens/PlaylistScreen.js`

**Interfaces:**
- Consumes: `favorites: string[]` and `recent: string[]` state from App.js (Tasks 2 & 3)
- Produces: `activeTab: "all" | "favorites" | "recent"` state in App.js

- [ ] **Step 1: Update `App.js` — add activeTab state**

After the `const [recent, setRecent] = useState([]);` line (added in Task 3), add:

```jsx
const [activeTab, setActiveTab] = useState("all");
```

- [ ] **Step 2: Update `App.js` — pass new props to PlaylistScreen**

In the `PlaylistScreen` JSX block (currently lines 168-174), add four new props. Replace:

```jsx
content = (
  <PlaylistScreen
    playlist={playlist}
    currentTrack={currentTrack}
    onSelect={onSelect}
  />
);
```

with:

```jsx
content = (
  <PlaylistScreen
    playlist={playlist}
    currentTrack={currentTrack}
    onSelect={onSelect}
    activeTab={activeTab}
    onTabChange={setActiveTab}
    favorites={favorites}
    recent={recent}
  />
);
```

- [ ] **Step 3: Rewrite `src/screens/PlaylistScreen.js`**

Replace the entire file content with:

```jsx
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, FlatList } from "react-native";
import { COLORS } from "../data/constants";

const TABS = [
  { key: "all", label: "全部" },
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
];

function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent }) {
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);

  const subtitle = useMemo(() => {
    if (activeTab === "favorites") return `已收藏 ${filtered.length} 首`;
    if (activeTab === "recent") return `最近播放过 ${filtered.length} 首`;
    return `共 ${playlist.length} 首`;
  }, [activeTab, filtered.length, playlist.length]);

  const renderItem = ({ item }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(playlist.indexOf(item))}
        activeOpacity={0.6}
      >
        <Image source={{ uri: item.artwork }} style={styles.listThumb} />
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, isActive && styles.listTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={styles.listActiveIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>播放列表</Text>
        <Text style={styles.listHeaderCount}>{subtitle}</Text>
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {activeTab === "favorites" ? "还没有收藏的歌曲" : "还没有播放记录"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  listHeaderCount: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  tab: {
    marginRight: 24,
    paddingVertical: 8,
    position: "relative",
  },
  tabText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accent,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  listTitleActive: {
    color: COLORS.accent,
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  listActiveIcon: {
    color: COLORS.accent,
    fontSize: 16,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff10",
    marginLeft: 84,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});

export default PlaylistScreen;
```

- [ ] **Step 4: Verify Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add App.js src/screens/PlaylistScreen.js
git commit -m "Add playlist filter tabs (all/favorites/recent)"
```

---

## Task 5: Verification

Final whole-branch checks: Metro bundle, App.js line count, grep for leftover patterns, manual simulator guidance.

**Files:** none (verification only)

- [ ] **Step 1: Verify Metro bundle builds on final state**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```
Expected: build succeeds, no errors, no warnings about missing modules.

- [ ] **Step 2: Verify App.js line count ≤ 300**

Run:
```bash
wc -l App.js
```
Expected: ≤ 300 lines (estimate ~290).

- [ ] **Step 3: Grep — no leftover `lyrics:` field in playlist.js**

Run:
```bash
grep -n "lyrics:" src/data/playlist.js
```
Expected: no matches (field renamed to `lrc:`).

- [ ] **Step 4: Grep — no leftover `lyricIndex` in PlayerScreen.js**

Run:
```bash
grep -n "lyricIndex" src/screens/PlayerScreen.js
```
Expected: no matches (removed in Task 1).

- [ ] **Step 5: Grep — no hardcoded hex colors in new/modified files**

Run:
```bash
grep -nE "#[0-9a-fA-F]{3,8}" src/components/Lyrics.js src/screens/PlaylistScreen.js src/screens/PlayerScreen.js
```
Expected: only pre-existing `#333` (listThumb background) and `#ffffff10` (listSeparator) in PlaylistScreen — these are P2 carryovers, not P3 additions. No new hardcoded hex in Lyrics.js or PlayerScreen.js.

- [ ] **Step 6: Grep — storage keys are exactly `@mp3player:favorites` and `@mp3player:recent`**

Run:
```bash
grep -rn "@mp3player:" App.js src/
```
Expected: exactly 4 matches in App.js (2 load + 2 save), keys spelled correctly.

- [ ] **Step 7: Manual iOS simulator check (user-driven)**

Start the simulator and verify against the spec's acceptance criteria (§6.1-6.5):

LRC sync:
- Play a song; lyrics scroll with playback position
- Pause; lyrics stop at current position
- Seek via slider; lyrics jump to correct time
- Switch songs; lyrics update to new track

Favorites:
- Heart icon shows `♡` (gray) when not favorited, `♥` (red) when favorited
- Tap toggles state immediately
- Kill app, restart; favorite state persists

Recent plays:
- Play a song; switch to "最近播放" tab; song appears
- Play same song again; no duplicate
- Kill app, restart; recent list persists

Filter tabs:
- Three tabs visible: 全部 / 收藏 / 最近播放
- Active tab has red text + underline
- Subtitle updates per tab
- Empty states: "还没有收藏的歌曲" / "还没有播放记录"

Regression:
- Three-state repeat loop works
- Playback error Alert still fires on error
- ErrorBoundary still wraps App

- [ ] **Step 8: No commit (verification only)**

This task produces no code changes. If any check fails, fix in a new commit and re-run the failing check.

---

## Self-Review

**Spec coverage:**
- §3.1 LRC parser → Task 1 Step 1 ✓
- §3.2 LRC data → Task 1 Step 2 ✓
- §3.3 Lyrics component → Task 1 Step 3 ✓
- §3.4 Favorites (state/load/toggle/UI/props) → Task 2 ✓
- §3.5 Recent plays (state/load/song-change) → Task 3 ✓
- §3.6 Filter tabs (UI/props/filtering/subtitle/empty states) → Task 4 ✓
- §3.7 App.js changes → distributed across Tasks 2/3/4 ✓
- §6.1-6.5 acceptance criteria → Task 5 Step 7 ✓

**Placeholder scan:** No TBD/TODO. All steps have exact code. ✓

**Type consistency:** `parseLRC`/`findCurrentIndex` signatures match between Task 1 Step 1 (definition) and Task 1 Step 3 (consumption in Lyrics.js). `toggleFavorite(id)` matches between Task 2 Step 4 (definition) and Task 2 Step 7 (call site `onToggleFavorite(currentTrack.id)`). `activeTab`/`onTabChange`/`favorites`/`recent` prop names match between Task 4 Step 2 (App.js pass-through) and Task 4 Step 3 (PlaylistScreen signature). ✓

**Task ordering:** Task 1 (LRC) is independent. Task 2 (favorites) adds storage import. Task 3 (recent) reuses storage import from Task 2. Task 4 (tabs) consumes `favorites` (Task 2) and `recent` (Task 3). No circular deps. ✓
