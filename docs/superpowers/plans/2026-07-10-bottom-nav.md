# Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-tab bottom navigation (歌曲/小说/我的) that restructures the current single-playlist view. The novels tab introduces audiobook playback reusing the existing player; the mine tab consolidates favorites/recent/imported into one personal-content destination.

**Architecture:** Custom `tab`/`view` state in `App.js` (no navigation library). A `BottomNav` component plus three tab screens (Songs/Novels/Mine) compose with a shared `TrackList`. `PlayerScreen` remains a full-screen overlay that hides the bottom nav. A separate `scope` state (distinct from `tab`) tracks the queue source for persistence - `tab` is UI position, `scope` is locked at play time.

**Tech Stack:** React Native 0.75.4, `react-native-track-player` 4.1.1, `@react-native-async-storage/async-storage`. No new dependencies.

## Global Constraints

- **No automated tests** - this project has no test suite. Verification is Metro bundle build + manual iOS simulator check by the user. Do NOT run `npm test` (it exits 1 with "No tests found" - pre-existing, not a regression).
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` must exit 0 with `info Done writing bundle output`.
- **eslint is not configured** - do not add lint steps.
- **Commit style:** Capitalized verb-first subject (e.g., "Add novels data and extend filterTracks"), with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer. Use HEREDOC for the commit message.
- **AsyncStorage keys:** Existing - `@mp3player:favorites`, `@mp3player:recent`, `@mp3player:imported`, `@mp3player:playback`. The `playback` key's shape changes from `{trackId, position, activeTab, repeatMode}` to `{trackId, position, tab, scope, repeatMode}` - old format is migrated on read.
- **Valid `tab` values:** `"songs"`, `"novels"`, `"mine"` (keys of `NAV_TABS` defined in Task 1).
- **Valid `scope` values:** `"songs"`, `"novels"`, `"favorites"`, `"recent"`, `"imported"`.
- **Valid `repeatMode` values:** `"off"`, `"queue"`, `"track"` (keys of `REPEAT_MAP` in `src/data/constants.js`).
- **`REPEAT_MAP`** is in `src/data/constants.js` as `{ off: RepeatMode.Off, queue: RepeatMode.Queue, track: RepeatMode.Track }`. Already imported in App.js.
- **`loadJSON` / `saveJSON`** are in `src/data/storage.js`, imported in App.js. Both catch errors silently and return fallback / no-op.
- **`COLORS`** in `src/data/constants.js`: `background: "#1a1a1a"`, `accent: "#C20C0C"`, `primaryText: "#ffffff"`, `secondaryText: "#b3b3b3"`, `vinyl: "#0a0a0a"`, `groove: "#222"`.
- **Track shape:** `{ id: string, url: string, title: string, artist: string, artwork: string, lrc?: string, category?: string, isImported?: boolean, isNovel?: boolean }`. Novel entries get `isNovel: true`; imported entries keep `isImported: true`.
- **Novel audio URLs are placeholders** - the 3 URLs in `novels.js` reuse known-working song MP3s from `playlist.js` so the bundle and playback work end-to-end. They can be swapped to real audiobook URLs later without code changes.

## File Structure

- **`src/data/novels.js`** (new, ~35 lines): 3 sample audiobook entries with `isNovel: true`. Same field shape as `playlist` entries.
- **`src/data/constants.js`** (modify, +6 lines): Add `NAV_TABS` array - the single source of truth for bottom-nav tab definitions (key/label/icon), consumed by `BottomNav`.
- **`src/data/filterTracks.js`** (modify, ~10 lines changed): Rename param `activeTab` -> `scope`, add `"songs"` and `"novels"` branches. Existing branches (`"favorites"`/`"recent"`/`"imported"`/default) unchanged in behavior.
- **`src/components/TrackList.js`** (new, ~110 lines): Reusable FlatList + now-playing card, extracted from `PlaylistScreen`. Props: `tracks`, `currentTrack`, `onSelect`, `onShowPlayer`, `emptyText`. Generic - no awareness of songs vs novels vs personal content.
- **`src/components/BottomNav.js`** (new, ~55 lines): Three-tab bottom navigation. Renders `NAV_TABS`, highlights active tab. Props: `activeTab`, `onChange`.
- **`src/screens/SongsScreen.js`** (new, ~35 lines): Songs tab - header + `<TrackList tracks={playlist}>`. No filter tabs, no import.
- **`src/screens/NovelsScreen.js`** (new, ~35 lines): Novels tab - header + `<TrackList tracks={novels}>`. Structurally identical to SongsScreen.
- **`src/screens/MineScreen.js`** (new, ~85 lines): Mine tab - 3 sub-tabs (favorites/recent/imported) + import button + `<TrackList>`. Local `mineSubTab` state, initialized from `initialSubTab` prop.
- **`App.js`** (modify, ~80 lines changed): Add `tab`/`scope` state, rename `view` values, wire new screens + `BottomNav`, extend `onSelect` signature, update save/restore logic with old-format migration, extend `allTracks` to include novels.
- **`src/screens/PlaylistScreen.js`** (delete): Replaced by the three new screens + `TrackList`.

---

### Task 1: Data layer - novels, NAV_TABS, filterTracks extension

Pure data-layer changes. No UI impact - `novels.js` is not yet imported by anything, `NAV_TABS` is additive, and `filterTracks` extensions are dead code until Task 4 wires them in. Existing callers (`PlaylistScreen`, `App.js` restore) still pass old scope values (`"all"`/`"favorites"`/`"recent"`/`"imported"`) which all behave identically after this task.

**Files:**
- Create: `src/data/novels.js`
- Modify: `src/data/constants.js` (add `NAV_TABS` after `REPEAT_MAP`)
- Modify: `src/data/filterTracks.js` (full rewrite, 10 lines)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `novels` (named export from `src/data/novels.js`) - `Track[]` with `isNovel: true` on each entry.
  - `NAV_TABS` (named export from `src/data/constants.js`) - `Array<{ key: "songs"|"novels"|"mine", label: string, icon: string }>`.
  - `filterTracks(scope, allTracks, favorites, recent) -> Track[]` (from `src/data/filterTracks.js`) - first param renamed from `activeTab`; new `"songs"`/`"novels"` branches added.

- [ ] **Step 1: Create `src/data/novels.js`**

Write the file with this exact content. The URLs are placeholders reused from `playlist.js` so playback works end-to-end during manual testing:

```js
export const novels = [
  {
    id: "n1",
    url: "https://sound2.yywz123.com/english96ad/lesson/song50/27840cedffaacebdb.mp3",
    title: "示例有声书 一",
    artist: "演播者",
    artwork: "https://picsum.photos/seed/novel1/600/600",
    lrc: "",
    category: "有声书",
    isNovel: true,
  },
  {
    id: "n2",
    url: "https://sound2.yywz123.com/english96ad/lesson/song50/27839efadbdacfecb.mp3",
    title: "示例有声书 二",
    artist: "演播者",
    artwork: "https://picsum.photos/seed/novel2/600/600",
    lrc: "",
    category: "有声书",
    isNovel: true,
  },
  {
    id: "n3",
    url: "https://sound2.yywz123.com/english96ad/lesson/song50/27838dbedbacafecf.mp3",
    title: "示例有声书 三",
    artist: "演播者",
    artwork: "https://picsum.photos/seed/novel3/600/600",
    lrc: "",
    category: "有声书",
    isNovel: true,
  },
];
```

- [ ] **Step 2: Add `NAV_TABS` to `src/data/constants.js`**

The current file ends with the `REPEAT_MAP` export (lines 18-22). Append `NAV_TABS` after it. Use the Edit tool with `old_string` = the full `REPEAT_MAP` block:

```js
export const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};
```

And `new_string` = the same block plus the new `NAV_TABS`:

```js
export const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};

export const NAV_TABS = [
  { key: "songs", label: "歌曲", icon: "♫" },
  { key: "novels", label: "小说", icon: "▤" },
  { key: "mine", label: "我的", icon: "☻" },
];
```

- [ ] **Step 3: Rewrite `src/data/filterTracks.js`**

The current content (6 lines) is:

```js
export function filterTracks(activeTab, allTracks, favorites, recent) {
  if (activeTab === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (activeTab === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
```

Replace the entire file content with:

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

Use the Write tool to overwrite `src/data/filterTracks.js` (the file is small enough that a full rewrite is cleaner than multiple edits). Read the file first if the Edit tool requires it, then use Write.

**Compatibility note:** Existing callers pass `"all"` (hits default -> returns `allTracks`, same as before), `"favorites"`, `"recent"`, `"imported"` (all unchanged). The new `"songs"`/`"novels"` branches are dead code until Task 4.

- [ ] **Step 4: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`. If it fails, check for typos in `novels.js`/`constants.js`/`filterTracks.js`.

- [ ] **Step 5: Commit**

```bash
git add src/data/novels.js src/data/constants.js src/data/filterTracks.js
git commit -m "$(cat <<'EOF'
Add novels data, NAV_TABS, and extend filterTracks

New novels.js with 3 sample audiobooks (isNovel: true). Add NAV_TABS
constant for the bottom nav. Extend filterTracks with songs/novels
scopes and rename the first param to scope. No UI changes yet -
novels.js and the new scopes are dead code until the screens and
App.js wiring land.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Shared components - TrackList and BottomNav

Two new presentational components. Neither is imported by anything yet, so the bundle passes with them as unused modules. `TrackList` is extracted from `PlaylistScreen`'s list + now-playing card; `BottomNav` renders `NAV_TABS` from Task 1.

**Files:**
- Create: `src/components/TrackList.js`
- Create: `src/components/BottomNav.js`

**Interfaces:**
- Consumes: `COLORS` from `../data/constants` (TrackList, BottomNav); `NAV_TABS` from `../data/constants` (BottomNav, added in Task 1).
- Produces:
  - `TrackList` (default export from `src/components/TrackList.js`) - props: `{ tracks: Track[], currentTrack: Track|null, onSelect: (item: Track) => void, onShowPlayer: () => void, emptyText?: string }`. Renders the now-playing card (if `currentTrack` is truthy) above a FlatList of tracks.
  - `BottomNav` (default export from `src/components/BottomNav.js`) - props: `{ activeTab: "songs"|"novels"|"mine", onChange: (tab: string) => void }`.

- [ ] **Step 1: Create `src/components/TrackList.js`**

Write the file with this exact content:

```jsx
import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList } from "react-native";
import { COLORS } from "../data/constants";

function TrackList({ tracks, currentTrack, onSelect, onShowPlayer, emptyText = "暂无内容" }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    }
  }, [currentTrack?.id, tracks]);

  const renderItem = ({ item }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(item)}
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
    <>
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
      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          onScrollToIndexFailed={() => {
            setTimeout(() => {
              const idx = tracks.findIndex((t) => currentTrack && t.id === currentTrack.id);
              if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5 });
            }, 100);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
});

export default TrackList;
```

- [ ] **Step 2: Create `src/components/BottomNav.js`**

Write the file with this exact content:

```jsx
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, NAV_TABS } from "../data/constants";

function BottomNav({ activeTab, onChange }) {
  return (
    <View style={styles.container}>
      {NAV_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.6}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ffffff20",
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  icon: {
    fontSize: 22,
    color: COLORS.secondaryText,
  },
  iconActive: {
    color: COLORS.accent,
  },
  label: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  labelActive: {
    color: COLORS.accent,
    fontWeight: "600",
  },
});

export default BottomNav;
```

- [ ] **Step 3: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrackList.js src/components/BottomNav.js
git commit -m "$(cat <<'EOF'
Add TrackList and BottomNav components

TrackList is a reusable FlatList + now-playing card extracted from
PlaylistScreen (not yet wired in). BottomNav renders the three-tab
navigation using NAV_TABS from constants. Both are unused modules
until the tab screens and App.js wiring land.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Three tab screens - Songs, Novels, Mine

Three new screen components. None is imported by `App.js` yet, so the bundle passes with them as unused modules. Each composes a header with the shared `TrackList` from Task 2. `MineScreen` adds sub-tabs and the import button (mirroring the current `PlaylistScreen`'s filter-tab pattern, minus the "all" tab).

**Files:**
- Create: `src/screens/SongsScreen.js`
- Create: `src/screens/NovelsScreen.js`
- Create: `src/screens/MineScreen.js`

**Interfaces:**
- Consumes:
  - `playlist` from `../data/playlist` (SongsScreen)
  - `novels` from `../data/novels` (NovelsScreen, created in Task 1)
  - `filterTracks` from `../data/filterTracks` (MineScreen, extended in Task 1)
  - `COLORS` from `../data/constants` (all three)
  - `TrackList` from `../components/TrackList` (all three, created in Task 2)
- Produces:
  - `SongsScreen` (default export) - props: `{ currentTrack, onSelect, onShowPlayer }`. Calls `onSelect(item, playlist, "songs")`.
  - `NovelsScreen` (default export) - props: `{ currentTrack, onSelect, onShowPlayer }`. Calls `onSelect(item, novels, "novels")`.
  - `MineScreen` (default export) - props: `{ allTracks, currentTrack, onSelect, onShowPlayer, favorites, recent, onImport, initialSubTab }`. Local `mineSubTab` state initialized from `initialSubTab`. Calls `onSelect(item, filtered, mineSubTab)`.

**`onSelect` contract for all screens:** the `onSelect` prop received from `App.js` has signature `(item: Track, tracks: Track[], scopeKey: string) => void`. Each screen wraps it for `TrackList`'s simpler `(item) => void` interface.

- [ ] **Step 1: Create `src/screens/SongsScreen.js`**

Write the file with this exact content:

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { playlist } from "../data/playlist";
import TrackList from "../components/TrackList";

function SongsScreen({ currentTrack, onSelect, onShowPlayer }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>歌曲</Text>
        <Text style={styles.subtitle}>共 {playlist.length} 首</Text>
      </View>
      <TrackList
        tracks={playlist}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, playlist, "songs")}
        onShowPlayer={onShowPlayer}
        emptyText="还没有歌曲"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
});

export default SongsScreen;
```

**Note:** `container` has no `backgroundColor` - the `SafeAreaView` in `App.js` (Task 4) provides the background and the decorative `glowTop`, which shows through the transparent screen.

- [ ] **Step 2: Create `src/screens/NovelsScreen.js`**

Write the file with this exact content:

```jsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { novels } from "../data/novels";
import TrackList from "../components/TrackList";

function NovelsScreen({ currentTrack, onSelect, onShowPlayer }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>小说</Text>
        <Text style={styles.subtitle}>共 {novels.length} 本</Text>
      </View>
      <TrackList
        tracks={novels}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, novels, "novels")}
        onShowPlayer={onShowPlayer}
        emptyText="还没有有声书"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
});

export default NovelsScreen;
```

**Note:** `container` has no `backgroundColor` - same rationale as `SongsScreen`.

- [ ] **Step 3: Create `src/screens/MineScreen.js`**

Write the file with this exact content:

```jsx
import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
import TrackList from "../components/TrackList";

const MINE_TABS = [
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
  { key: "imported", label: "导入音乐" },
];

function MineScreen({ allTracks, currentTrack, onSelect, onShowPlayer, favorites, recent, onImport, initialSubTab = "favorites" }) {
  const [mineSubTab, setMineSubTab] = useState(initialSubTab);

  const filtered = useMemo(
    () => filterTracks(mineSubTab, allTracks, favorites, recent),
    [mineSubTab, allTracks, favorites, recent]
  );

  const emptyText = useMemo(() => {
    if (mineSubTab === "favorites") return "还没有收藏的歌曲";
    if (mineSubTab === "recent") return "还没有播放记录";
    return "还没有导入音乐";
  }, [mineSubTab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>我的</Text>
      </View>
      <View style={styles.tabBar}>
        {MINE_TABS.map((tab) => {
          const isActive = tab.key === mineSubTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setMineSubTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {mineSubTab === "imported" && (
        <View style={styles.importBar}>
          <TouchableOpacity onPress={onImport} style={styles.importButton}>
            <Text style={styles.importButtonText}>+ 导入音乐</Text>
          </TouchableOpacity>
        </View>
      )}
      <TrackList
        tracks={filtered}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, filtered, mineSubTab)}
        onShowPlayer={onShowPlayer}
        emptyText={emptyText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
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
  importBar: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  importButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignSelf: "flex-start",
  },
  importButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MineScreen;
```

- [ ] **Step 4: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SongsScreen.js src/screens/NovelsScreen.js src/screens/MineScreen.js
git commit -m "$(cat <<'EOF'
Add Songs, Novels, and Mine tab screens

Three new tab screens composing the shared TrackList with their own
headers. SongsScreen and NovelsScreen are thin wrappers over TrackList
with playlist/novels data. MineScreen adds the favorites/recent/imported
sub-tabs and the import button. Not yet wired into App.js.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire App.js to the new tab structure and delete PlaylistScreen

The integrating task. All new files from Tasks 1-3 are imported and used. `App.js` gains `tab`/`scope` state, switches `view` between `"tabs"`/`"player"`, renders the active tab screen plus `BottomNav`, extends `onSelect` to accept a `scopeKey`, and migrates the old `activeTab` persistence format on restore. `PlaylistScreen.js` is deleted at the end since nothing references it.

This task has many small edits to `App.js`. Apply them in order - each edit is independent, but the bundle only passes after all of them land (the intermediate states reference missing imports or renamed symbols).

**Files:**
- Modify: `App.js` (imports, state, `allTracks`, `playbackRef`, save `useEffect`, `AppState` listener, `initPlayer` restore, `onSelect`, render logic)
- Delete: `src/screens/PlaylistScreen.js`

**Interfaces:**
- Consumes:
  - `novels` from `./src/data/novels` (Task 1)
  - `NAV_TABS` from `./src/data/constants` (Task 1, for type info - not directly referenced in App.js but `tab` values match its keys)
  - `BottomNav` from `./src/components/BottomNav` (Task 2)
  - `SongsScreen`, `NovelsScreen`, `MineScreen` from `./src/screens/*` (Task 3)
  - `filterTracks` (extended, Task 1) - already imported
- Produces: the integrated app with three-tab bottom navigation.

- [ ] **Step 1: Update imports in `App.js`**

The current import block (lines 1-28) has three groups: react-native, react-native-track-player, and local imports. Make four changes:

**1a. Add `SafeAreaView` to the react-native import.**

Current (lines 2-11):

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

Replace with:

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
  SafeAreaView,
} from "react-native";
```

**1b. Add the `novels` import.** Current line 21 is `import { playlist } from "./src/data/playlist";`. Replace it with:

```js
import { playlist } from "./src/data/playlist";
import { novels } from "./src/data/novels";
```

**1c. Replace the `PlaylistScreen` import with the three new screens + `BottomNav`.** Current lines 26-28 are:

```js
import PlayerScreen from "./src/screens/PlayerScreen";
import PlaylistScreen from "./src/screens/PlaylistScreen";
import ErrorBoundary from "./src/error/ErrorBoundary";
```

Replace with:

```js
import PlayerScreen from "./src/screens/PlayerScreen";
import SongsScreen from "./src/screens/SongsScreen";
import NovelsScreen from "./src/screens/NovelsScreen";
import MineScreen from "./src/screens/MineScreen";
import BottomNav from "./src/components/BottomNav";
import ErrorBoundary from "./src/error/ErrorBoundary";
```

- [ ] **Step 2: Replace `activeTab` state with `tab` + `scope`, and rename `view` initial value**

Current state declarations (lines 31-41):

```js
  const [currentTrack, setCurrentTrack] = useState(null);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [importedTracks, setImportedTracks] = useState([]);
```

Replace with (note: `view` initial value `"list"` -> `"tabs"`, `activeTab` line becomes two lines for `tab` + `scope`):

```js
  const [currentTrack, setCurrentTrack] = useState(null);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("tabs");
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [tab, setTab] = useState("songs");
  const [scope, setScope] = useState("songs");
  const [importedTracks, setImportedTracks] = useState([]);
```

- [ ] **Step 3: Extend `allTracks` to include novels**

Current (line 42):

```js
  const allTracks = useMemo(() => [...playlist, ...importedTracks], [importedTracks]);
```

Replace with:

```js
  const allTracks = useMemo(() => [...playlist, ...novels, ...importedTracks], [importedTracks]);
```

- [ ] **Step 4: Update `playbackRef` to capture `tab` + `scope` instead of `activeTab`**

Current (lines 85-88):

```js
  const playbackRef = useRef(null);
  useEffect(() => {
    playbackRef.current = { currentTrack, activeTab, repeatMode };
  });
```

Replace with:

```js
  const playbackRef = useRef(null);
  useEffect(() => {
    playbackRef.current = { currentTrack, tab, scope, repeatMode };
  });
```

- [ ] **Step 5: Update the save `useEffect` to write `tab` + `scope` instead of `activeTab`**

Current (lines 99-117):

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

Replace with:

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
          tab,
          scope,
          repeatMode,
        });
      } catch {
        // 静默失败 - 存储不可用不应阻断 UI
      }
    })();
    return () => { cancelled = true; };
  }, [currentTrack?.id, scope, repeatMode]);
```

**Note:** the deps array drops `activeTab` and adds `scope`. `tab` is intentionally NOT in the deps array - it is saved opportunistically via the existing triggers (track change, scope change, repeat change, app background) rather than getting its own save trigger. See the design spec's "Save logic" section for rationale.

- [ ] **Step 6: Update the `AppState` listener to save `tab` + `scope`**

Current (lines 119-137):

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

Replace with:

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
          tab: snap.tab,
          scope: snap.scope,
          repeatMode: snap.repeatMode,
        });
      } catch {
        // 静默失败
      }
    });
    return () => sub.remove();
  }, []);
```

- [ ] **Step 7: Update `initPlayer` restore logic with old-format migration**

The current restore block (lines 200-223) reads `savedPlayback` and uses `activeTab`:

```js
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
```

Replace with (migration: detect old `activeTab` field and map to `tab`+`scope`; new format uses `tab`+`scope` directly):

```js
      if (savedPlayback && savedPlayback.trackId) {
        const { trackId, position, repeatMode: savedRepeat } = savedPlayback;
        const safeRepeat = REPEAT_MAP[savedRepeat] ? savedRepeat : "off";

        let savedTab;
        let savedScope;
        if (typeof savedPlayback.activeTab === "string") {
          const map = {
            all: { tab: "songs", scope: "songs" },
            favorites: { tab: "mine", scope: "favorites" },
            recent: { tab: "mine", scope: "recent" },
            imported: { tab: "mine", scope: "imported" },
          };
          const mapped = map[savedPlayback.activeTab] || { tab: "songs", scope: "songs" };
          savedTab = mapped.tab;
          savedScope = mapped.scope;
        } else {
          savedTab = ["songs", "novels", "mine"].includes(savedPlayback.tab) ? savedPlayback.tab : "songs";
          savedScope = ["songs", "novels", "favorites", "recent", "imported"].includes(savedPlayback.scope) ? savedPlayback.scope : "songs";
        }

        setRepeatMode(safeRepeat);
        await TrackPlayer.setRepeatMode(REPEAT_MAP[safeRepeat]);
        setTab(savedTab);
        setScope(savedScope);

        const allTracksForRestore = [...playlist, ...novels, ...imported];
        const filtered = filterTracks(savedScope, allTracksForRestore, savedFavs, savedRecent);
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
```

**Key changes:**
- Old `activeTab` field is detected via `typeof savedPlayback.activeTab === "string"` and mapped to `tab`+`scope` using the migration table from the spec.
- New format reads `savedPlayback.tab` and `savedPlayback.scope` directly, with validation against the valid value lists.
- The local `allTracks` variable is renamed to `allTracksForRestore` to avoid shadowing the component-level `allTracks` useMemo, and now includes `novels`.
- `setActiveTab(safeTab)` is replaced with `setTab(savedTab)` + `setScope(savedScope)`.
- `filterTracks(safeTab, ...)` becomes `filterTracks(savedScope, ...)`.

- [ ] **Step 8: Update `onSelect` to the new signature**

Current (lines 277-285):

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

Replace with:

```js
  const onSelect = async (item, tracks, scopeKey) => {
    await TrackPlayer.setQueue(tracks);
    const index = tracks.findIndex((t) => t.id === item.id);
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
    setScope(scopeKey);
    setView("player");
  };
```

**Key changes:**
- Second param renamed `scope` -> `tracks` (it was always the track array, just misnamed).
- Third param `scopeKey` added (the string for persistence).
- `setScope(scopeKey)` stores the queue source so save logic and restore can rebuild the queue.

- [ ] **Step 9: Update the `onBack` handler**

Current (lines 287-289):

```js
  const onBack = () => {
    setView("list");
  };
```

Replace with:

```js
  const onBack = () => {
    setView("tabs");
  };
```

- [ ] **Step 10: Update the render logic**

The current render block (lines 316-368) branches on `initError`, `isPlayerInitialized`, and `view`. Replace the whole `let content; if (...) { ... }` block.

Current:

```js
  let content;
  if (initError) {
    content = (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!isPlayerInitialized) {
    content = (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  } else if (view === "list") {
    content = (
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
    );
  } else {
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
  }
```

Replace with:

```js
  const initialMineSubTab = ["favorites", "recent", "imported"].includes(scope) ? scope : "favorites";

  let content;
  if (initError) {
    content = (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!isPlayerInitialized) {
    content = (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  } else if (view === "player") {
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
  } else {
    content = (
      <SafeAreaView style={styles.container}>
        <View style={styles.glowTop} />
        <View style={{ flex: 1 }}>
          {tab === "songs" && (
            <SongsScreen
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
            />
          )}
          {tab === "novels" && (
            <NovelsScreen
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
            />
          )}
          {tab === "mine" && (
            <MineScreen
              allTracks={allTracks}
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
              favorites={favorites}
              recent={recent}
              onImport={handleImport}
              initialSubTab={initialMineSubTab}
            />
          )}
        </View>
        <BottomNav activeTab={tab} onChange={setTab} />
      </SafeAreaView>
    );
  }
```

**Key changes:**
- `initialMineSubTab` computed inline from `scope` - if `scope` is a mine sub-scope, MineScreen opens on that sub-tab; otherwise defaults to `"favorites"`.
- The `view === "list"` branch is renamed to `view === "player"` (moved up since it's now the simpler case), and the `else` branch renders the tab view.
- `PlaylistScreen` is replaced with the three new screens, conditionally rendered by `tab`.
- The tab view is wrapped in `SafeAreaView` (the screens themselves use plain `View` and have no `backgroundColor` - the SafeAreaView provides it).
- `<View style={styles.glowTop} />` is the first child of the SafeAreaView. This style already exists in `App.js` (lines 376-384, currently dead code) - it renders the subtle red glow at the top, visible through the transparent screen containers. This preserves the visual identity of the current `PlaylistScreen`/`PlayerScreen` which both have the glow.
- `BottomNav` sits below the active screen, inside the `SafeAreaView`.

- [ ] **Step 11: Delete `src/screens/PlaylistScreen.js`**

Run:

```bash
git rm src/screens/PlaylistScreen.js
```

This stages the deletion. The file is no longer referenced by `App.js` after step 1c.

- [ ] **Step 12: Run Metro bundle build**

Run:

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: exits 0, last line `info Done writing bundle output`. If it fails with a "Cannot find module" error referencing `PlaylistScreen`, double-check step 1c (the import removal) and step 10 (the render logic replacement - no `PlaylistScreen` references should remain).

- [ ] **Step 13: Commit**

```bash
git add App.js
git commit -m "$(cat <<'EOF'
Wire bottom navigation into App.js and remove PlaylistScreen

App.js gains tab/scope state replacing activeTab. The render branch
switches between SongsScreen/NovelsScreen/MineScreen + BottomNav (in a
SafeAreaView) and the full-screen PlayerScreen. onSelect takes a
scopeKey for persistence. initPlayer migrates the old activeTab
persistence format to tab+scope. PlaylistScreen is deleted - its list
rendering lives in TrackList, its filter tabs live in MineScreen.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

The `git rm` in step 11 already staged the deletion, so this commit captures both the `App.js` changes and the `PlaylistScreen.js` removal. (If `git rm` was not used - e.g. the file was deleted with `rm` - run `git add -A src/screens/PlaylistScreen.js` instead before committing.)

---

## Manual Verification (user-driven, after all tasks)

After Task 4 lands and the Metro bundle passes, the user should run the app in the iOS simulator and verify:

1. **Tab switching:** tapping 歌曲/小说/我的 switches the screen and highlights the active tab in `COLORS.accent`.
2. **Songs tab:** shows the built-in song list; tapping a song enters the full-screen player.
3. **Novels tab:** shows 3 sample audiobooks; tapping one enters the player and audio plays.
4. **Mine tab:** three sub-tabs (收藏/最近播放/导入音乐) switch correctly. The import button appears only under 导入音乐. Tapping it opens the document picker.
5. **Now-playing card:** visible on all three tabs (even when the current track is a novel and the user is on the songs tab). Tapping it opens the player.
6. **Player back button:** returns to the tab the user was on (not always songs).
7. **Restore:** kill the app and relaunch. The saved tab opens, the saved track is loaded at the saved position (paused, no auto-play).
8. **Migration test (optional):** clear AsyncStorage, write an old-format `{trackId, position, activeTab: "favorites", repeatMode}` object under `@mp3player:playback`, relaunch. The app should open on the Mine tab with the favorites sub-tab active, and the track should restore within the favorites scope.

## Out of Scope (per design spec)

- Novel-specific player features (chapters, sleep timer, playback speed)
- Importing novels (imports remain song-type)
- Search across songs/novels
- Bottom-nav transitions/animations
- `handleImport` queue-contamination fix (pre-existing issue, not introduced by this change)
