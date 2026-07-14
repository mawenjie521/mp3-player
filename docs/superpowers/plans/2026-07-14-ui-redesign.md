# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the MP3 vinyl player app to a hybrid NetEase Cloud Music (songs) + Ximalaya (novels) light-theme UI, replacing the vinyl-and-tonearm player with circular/square cover players.

**Architecture:** Replace dark color palette with light (#FAF7F2 warm white). Add per-tab accent color (red #C20C0C for songs, orange #F86442 for novels) threaded via props to shared components. Split `PlayerScreen` into `SongsPlayerScreen` (circular rotating cover + lyrics) and `NovelsPlayerScreen` (square static cover + chapter info), both over a blurred-album-cover background. Delete `Vinyl`/`Tonearm` components. Convert `NovelsScreen` from list to 2-column grid.

**Tech Stack:** React Native (no Expo), react-native-track-player, existing AsyncStorage/RNFS/DocumentPicker stack. No new dependencies.

## Global Constraints

- **No automated tests.** Verification is Metro bundle + manual iOS simulator. Per [[mp3-player-verification-method]], DO NOT run `npm test` (exits 1 with "No tests found" - pre-existing, not a regression).
- **Metro bundle command:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
- **App.js line budget:** ≤300 lines (per [[mp3-player-phased-plan]]). Player split adds a view-selection branch but should not blow the budget.
- **Accent color threading:** Shared components (`TrackList`, `NowPlayingBar`, `BottomNav`, `Controls`, `ProgressBar`) accept an optional `accentColor` prop defaulting to `COLORS.accent`. Screens with non-default accent pass it explicitly. This avoids a global theme context.
- **No new dependencies.** Use Unicode characters for icons (no vector-icon library).
- **Spec reference:** `docs/superpowers/specs/2026-07-14-ui-redesign-design.md` (commit `a37e352`).

---

## Task 1: Update `constants.js` with new colors, typography, player sizes

**Files:**
- Modify: `src/data/constants.js`

**Interfaces:**
- Produces: new `COLORS` shape with `background`/`surface`/`separator`/`primaryText`/`secondaryText`/`tertiaryText`/`accent`/`accentNovel`/`playerText`/`playerTextDim`. New `TYPO` object. New `PLAYER_COVER_SIZE_SONG`/`PLAYER_COVER_SIZE_NOVEL`. Keeps `NAV_TABS`/`REPEAT_MAP`/`APP_VERSION`/`SCREEN_WIDTH`. **Does NOT remove** `VINYL_SIZE`/`ART_SIZE` yet (still referenced by `Vinyl.js` until Task 9 deletes it).

- [ ] **Step 1: Replace `constants.js` contents**

```js
import { Dimensions } from "react-native";
import { RepeatMode } from "react-native-track-player";

export const SCREEN_WIDTH = Dimensions.get("window").width;

// Kept until Vinyl.js is deleted in Task 9.
export const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
export const ART_SIZE = Math.min(220, VINYL_SIZE - 120);

export const PLAYER_COVER_SIZE_SONG = 280;
export const PLAYER_COVER_SIZE_NOVEL = 240;

export const COLORS = {
  background:    "#FAF7F2",
  surface:       "#FFFFFF",
  separator:     "#0000000F",
  primaryText:   "#1A1A1A",
  secondaryText: "#8A8A8E",
  tertiaryText:  "#B5B5B8",
  accent:        "#C20C0C",
  accentNovel:   "#F86442",
  playerText:    "#FFFFFF",
  playerTextDim: "#FFFFFF99",
};

export const TYPO = {
  titleLarge:  { fontSize: 28, fontWeight: "700" },
  titleMedium: { fontSize: 17, fontWeight: "600" },
  body:        { fontSize: 15, fontWeight: "600" },
  caption:     { fontSize: 12, fontWeight: "400" },
  micro:       { fontSize: 10, fontWeight: "600" },
};

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

export const APP_VERSION = "1.0.0";
```

- [ ] **Step 2: Grep for stale color references**

Run: `grep -rn "COLORS\.\(vinyl\|groove\)" src/`
Expected: matches only in `src/components/Vinyl.js` (will be fixed in Task 9). If matches appear elsewhere, fix them in this task by mapping to the nearest new color (`vinyl`→`background`, `groove`→`separator`).

- [ ] **Step 3: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS (no import errors). App will now render with light background but dark-text-styled components - visually broken but buildable.

- [ ] **Step 4: Commit**

```bash
git add src/data/constants.js
git commit -m "refactor(constants): replace dark palette with light, add TYPO and player cover sizes"
```

---

## Task 2: Update `App.js` top-level (container, glowTop, activeAccent)

**Files:**
- Modify: `App.js`

**Interfaces:**
- Produces: `App.js` exports same default component. Adds internal `activeAccent` derivation. Passes `accentColor` prop to `BottomNav`/`NowPlayingBar`/tab screens (will be wired in Tasks 3, 5, 6, 10). Still imports `PlayerScreen` (will be replaced in Task 9).

- [ ] **Step 1: Replace `styles.container` backgroundColor and remove `glowTop`**

In `App.js`, find the `styles` StyleSheet. Change:

```js
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
```

To:

```js
container: {
  flex: 1,
  backgroundColor: COLORS.background,
},
```

(Delete the entire `glowTop` key.)

- [ ] **Step 2: Remove `glowTop` usage in the render tree**

In the `else` branch of `App.js`'s `content` (the tabs view, around line 640), find and delete the line:

```jsx
<View style={styles.glowTop} />
```

Also in `PlayerScreen.js` view branch (will be fully replaced in Task 9; for now just delete the `<View style={styles.glowTop} />` line in `PlayerScreen.js` if present). Skip - `PlayerScreen.js` has its own `glowTop` in its own styles; leave that for Task 9.

- [ ] **Step 3: Add `activeAccent` derivation**

In `App.js`, just before the `let content;` line (around line 572), add:

```js
const isNovelContext = view === "player"
  ? (currentTrack?.isNovel || currentTrack?.isOCR)
  : (tab === "novels" || (tab === "mine" && mineSubTab === "ocr"));
const activeAccent = isNovelContext ? COLORS.accentNovel : COLORS.accent;
```

- [ ] **Step 4: Pass `accentColor` to BottomNav and NowPlayingBar in the tabs view**

In the tabs view (around line 675-681), change:

```jsx
<NowPlayingBar currentTrack={currentTrack} onPress={onShowPlayer} />
<CreateEmptyBookModal
  visible={showCreateEmptyBook}
  onCreate={onCreateEmptyBook}
  onCancel={() => setShowCreateEmptyBook(false)}
/>
<BottomNav activeTab={tab} onChange={setTab} />
```

To:

```jsx
<NowPlayingBar
  currentTrack={currentTrack}
  position={position}
  duration={duration}
  isPlaying={isPlaying}
  onPress={onShowPlayer}
  accentColor={activeAccent}
/>
<CreateEmptyBookModal
  visible={showCreateEmptyBook}
  onCreate={onCreateEmptyBook}
  onCancel={() => setShowCreateEmptyBook(false)}
/>
<BottomNav activeTab={tab} onChange={setTab} accentColor={activeAccent} />
```

(The new props on `NowPlayingBar`/`BottomNav` will be implemented in Task 3. They will be ignored until then - React just passes unused props.)

- [ ] **Step 5: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add App.js
git commit -m "refactor(app): light container, remove glowTop, derive activeAccent"
```

---

## Task 3: Update `BottomNav.js` and `NowPlayingBar.js`

**Files:**
- Modify: `src/components/BottomNav.js`
- Modify: `src/components/NowPlayingBar.js`

**Interfaces:**
- Consumes: `activeAccent` prop from `App.js` (Task 2).
- Produces: `BottomNav` accepts `accentColor` prop (default `COLORS.accent`). `NowPlayingBar` accepts `accentColor`/`position`/`duration`/`isPlaying` props (defaults: `COLORS.accent`/0/0/false).

- [ ] **Step 1: Replace `BottomNav.js` contents**

```js
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, SafeAreaView } from "react-native";
import { COLORS, NAV_TABS } from "../data/constants";

function BottomNav({ activeTab, onChange, accentColor = COLORS.accent }) {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.row}>
        {NAV_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const tabAccent = tab.key === "novels" ? COLORS.accentNovel : accentColor;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.icon, { color: isActive ? tabAccent : COLORS.tertiaryText }]}>
                {tab.icon}
              </Text>
              <Text style={[styles.label, { color: isActive ? tabAccent : COLORS.tertiaryText, fontWeight: isActive ? "600" : "400" }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default BottomNav;
```

- [ ] **Step 2: Replace `NowPlayingBar.js` contents**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { COLORS } from "../data/constants";

function NowPlayingBar({ currentTrack, position = 0, duration = 0, isPlaying = false, onPress, accentColor = COLORS.accent }) {
  if (!currentTrack) return null;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image source={{ uri: currentTrack.artwork }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
      </View>
      <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: COLORS.separator,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  artist: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 1,
  },
  playIcon: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  progressTrack: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: COLORS.separator,
  },
  progressFill: {
    height: 1.5,
    borderRadius: 0.75,
  },
});

export default NowPlayingBar;
```

- [ ] **Step 3: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.js src/components/NowPlayingBar.js
git commit -m "refactor(bottom-nav, now-playing-bar): light theme, accent prop, progress bar"
```

---

## Task 4: Update `TrackList.js` and `BookCover.js`

**Files:**
- Modify: `src/components/TrackList.js`
- Modify: `src/components/BookCover.js`

**Interfaces:**
- Produces: `TrackList` accepts `accentColor` prop (default `COLORS.accent`). `BookCover` accepts `accentColor` prop (default `COLORS.accent`) for placeholder background.

- [ ] **Step 1: Replace `TrackList.js` contents**

```js
import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { COLORS } from "../data/constants";
import BookCover from "./BookCover";

function TrackList({ tracks, currentTrack, onSelect, onLongPress, emptyText = "暂无内容", accentColor = COLORS.accent }) {
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
        onLongPress={() => onLongPress && onLongPress(item)}
        activeOpacity={0.6}
      >
        <BookCover uri={item.artwork} title={item.title} style={styles.listThumb} accentColor={accentColor} />
        <View style={styles.listInfo}>
          <View style={styles.listTitleRow}>
            <Text style={[styles.listTitle, { color: isActive ? accentColor : COLORS.primaryText }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isOCR && (
              <View style={styles.ocrBadge}>
                <Text style={[styles.ocrBadgeText, { color: accentColor }]}>OCR</Text>
              </View>
            )}
          </View>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={[styles.listActiveIcon, { color: accentColor }]}>▍▍▍</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ocrBadge: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: COLORS.separator,
  },
  ocrBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  listActiveIcon: {
    fontSize: 14,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 76,
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

export default TrackList;
```

- [ ] **Step 2: Replace `BookCover.js` contents**

```js
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function BookCover({ uri, title, style, accentColor = COLORS.accent }) {
  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }
  const initial = (title || "?").trim().charAt(0) || "?";
  return (
    <View style={[style, styles.placeholder, { backgroundColor: accentColor }]}>
      <Text style={styles.placeholderText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: COLORS.surface,
    fontSize: 20,
    fontWeight: "600",
  },
});

export default BookCover;
```

- [ ] **Step 3: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/TrackList.js src/components/BookCover.js
git commit -m "refactor(track-list, book-cover): light theme, accentColor prop"
```

---

## Task 5: Update `SongsScreen.js`

**Files:**
- Modify: `src/screens/SongsScreen.js`

**Interfaces:**
- Produces: `SongsScreen` no new props. Renders `TrackList` without `accentColor` (defaults to red `COLORS.accent`).

- [ ] **Step 1: Replace `SongsScreen.js` contents**

```js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import { playlist } from "../data/playlist";
import TrackList from "../components/TrackList";

function SongsScreen({ currentTrack, onSelect }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, TYPO.titleLarge]}>歌曲</Text>
        <Text style={[styles.subtitle, TYPO.caption]}>{playlist.length} 首</Text>
      </View>
      <TrackList
        tracks={playlist}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, playlist, "songs")}
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
  subtitle: {
    color: COLORS.secondaryText,
    marginTop: 4,
  },
});

export default SongsScreen;
```

- [ ] **Step 2: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SongsScreen.js
git commit -m "refactor(songs-screen): light theme, TYPO"
```

---

## Task 6: Update `NovelsScreen.js` to 2-column grid

**Files:**
- Modify: `src/screens/NovelsScreen.js`

**Interfaces:**
- Produces: `NovelsScreen` same props. Renders a 2-column `FlatList` instead of single-column list.

- [ ] **Step 1: Replace `NovelsScreen.js` contents**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import BookCover from "../components/BookCover";

function NovelsScreen({ cards, currentTrack, onSelectNovel, onAdd, onDeleteOCRNovel }) {
  const handleLongPress = (card) => {
    if (!card.isOCR) return;
    Alert.alert(card.title, null, [
      {
        text: "删除",
        style: "destructive",
        onPress: () => onDeleteOCRNovel(card.id),
      },
      { text: "取消", style: "cancel" },
    ]);
  };

  const isCardPlaying = (card) =>
    currentTrack && (currentTrack.bookId === card.id || currentTrack.id === card.id);

  const renderItem = ({ item: card }) => {
    const playing = isCardPlaying(card);
    return (
      <TouchableOpacity
        style={styles.cell}
        onPress={() => onSelectNovel(card)}
        onLongPress={() => handleLongPress(card)}
        activeOpacity={0.6}
      >
        <View style={styles.coverWrap}>
          <BookCover uri={card.coverImage} title={card.title} style={styles.cover} accentColor={COLORS.accentNovel} />
          {playing && (
            <View style={styles.playingBadge}>
              <Text style={styles.playingBadgeIcon}>▶</Text>
            </View>
          )}
        </View>
        <Text style={styles.cellTitle} numberOfLines={1}>{card.title}</Text>
        <Text style={styles.cellMeta}>
          {card.chapterCount} 章{card.isOCR ? " · OCR" : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, TYPO.titleLarge]}>小说</Text>
          <Text style={[styles.subtitle, TYPO.caption]}>{cards.length} 本</Text>
        </View>
        <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>还没有有声书</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    color: COLORS.primaryText,
  },
  subtitle: {
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: COLORS.accentNovel,
    fontSize: 22,
    fontWeight: "400",
    marginTop: -3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    gap: 12,
    marginBottom: 16,
  },
  cell: {
    flex: 1,
  },
  coverWrap: {
    position: "relative",
    aspectRatio: 1,
    marginBottom: 6,
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  playingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  playingBadgeIcon: {
    color: COLORS.accentNovel,
    fontSize: 12,
    marginLeft: 2,
  },
  cellTitle: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  cellMeta: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 16,
  },
});

export default NovelsScreen;
```

- [ ] **Step 2: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/NovelsScreen.js
git commit -m "refactor(novels-screen): 2-column grid layout, light theme, orange accent"
```

---

## Task 7: Update `NovelDetailScreen.js`

**Files:**
- Modify: `src/screens/NovelDetailScreen.js`

**Interfaces:**
- Produces: `NovelDetailScreen` same props. Uses own `FlatList` with `renderChapter` (no TrackList). Header gets a `⋯` menu for OCR books (replaces add/delete buttons in header).

- [ ] **Step 1: Replace `NovelDetailScreen.js` contents**

```js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import BookCover from "../components/BookCover";
import NowPlayingBar from "../components/NowPlayingBar";
import { expandOCRChapters } from "../data/ocrNovels";

function NovelDetailScreen({ novel, currentTrack, onSelect, onShowPlayer, onBack, onAddChapters, onDeleteOCRNovel }) {
  const tracks = useMemo(() => {
    if (novel.isOCR) return expandOCRChapters([novel.book]);
    return [novel.track];
  }, [novel]);

  const handleDelete = () => {
    Alert.alert("删除确认", `确定删除《${novel.title}》？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await onDeleteOCRNovel(novel.id);
          onBack();
        },
      },
    ]);
  };

  const handleMenu = () => {
    if (!novel.isOCR) return;
    const actions = [
      { text: "添加章节", onPress: () => onAddChapters(novel.id) },
      { text: "删除", style: "destructive", onPress: handleDelete },
      { text: "取消", style: "cancel" },
    ];
    Alert.alert(novel.title, null, actions);
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    onSelect(tracks[0], tracks, "novels");
  };

  const renderChapter = ({ item, index }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.chapterRow}
        onPress={() => onSelect(item, tracks, "novels")}
        activeOpacity={0.6}
      >
        <Text style={[styles.chapterNum, { color: isActive ? COLORS.accentNovel : COLORS.secondaryText }]}>
          第{index + 1}章
        </Text>
        <Text
          style={[styles.chapterTitle, { color: isActive ? COLORS.accentNovel : COLORS.primaryText }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {isActive && <Text style={styles.activeIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, TYPO.titleMedium]} numberOfLines={1}>{novel.title}</Text>
        <TouchableOpacity onPress={handleMenu} style={styles.headerBtn}>
          {novel.isOCR ? <Text style={styles.headerBtnIcon}>⋯</Text> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <BookCover uri={novel.coverImage} title={novel.title} style={styles.infoCover} accentColor={COLORS.accentNovel} />
        <View style={styles.infoMeta}>
          <Text style={styles.infoTitle} numberOfLines={1}>{novel.title}</Text>
          <Text style={styles.infoChapterCount}>{novel.chapterCount} 章</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={handlePlayAll} style={styles.playBtn}>
              <Text style={styles.playBtnText}>▶ 播放</Text>
            </TouchableOpacity>
            {novel.isOCR && (
              <TouchableOpacity onPress={() => onAddChapters(novel.id)} style={styles.addChBtn}>
                <Text style={styles.addChBtnText}>+ 添加章节</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, TYPO.titleMedium]}>章节</Text>
      <View style={{ flex: 1 }}>
        {tracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>暂无章节</Text>
          </View>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.id}
            renderItem={renderChapter}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
      <NowPlayingBar
        currentTrack={currentTrack}
        position={0}
        duration={0}
        isPlaying={false}
        onPress={onShowPlayer}
        accentColor={COLORS.accentNovel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnIcon: {
    color: COLORS.primaryText,
    fontSize: 24,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  infoCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoCover: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  infoMeta: {
    flex: 1,
    marginLeft: 16,
  },
  infoTitle: {
    color: COLORS.primaryText,
    fontSize: 20,
    fontWeight: "700",
  },
  infoChapterCount: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  playBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accentNovel,
  },
  playBtnText: {
    color: COLORS.surface,
    fontSize: 13,
    fontWeight: "600",
  },
  addChBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
  },
  addChBtnText: {
    color: COLORS.accentNovel,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chapterNum: {
    fontSize: 12,
    width: 56,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  activeIcon: {
    color: COLORS.accentNovel,
    fontSize: 12,
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 16,
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

export default NovelDetailScreen;
```

- [ ] **Step 2: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/NovelDetailScreen.js
git commit -m "refactor(novel-detail): light theme, chapter list with renderChapter, ⋯ menu"
```

---

## Task 8: Update `Controls.js`, `ProgressBar.js`, `Lyrics.js` for player

**Files:**
- Modify: `src/components/Controls.js`
- Modify: `src/components/ProgressBar.js`
- Modify: `src/components/Lyrics.js`

**Interfaces:**
- Produces: `Controls`/`ProgressBar` accept `accentColor` prop (default `COLORS.accent`). `Lyrics` uses player text colors (`COLORS.playerText`/`playerTextDim`) - no accent prop needed.

- [ ] **Step 1: Replace `Controls.js` contents**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat, accentColor = COLORS.accent }) {
  const repeatIcon = repeatMode === "track" ? "🔂" : "🔁";
  const repeatColor = repeatMode !== "off" ? accentColor : COLORS.playerTextDim;

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: repeatColor }]}>{repeatIcon}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPrev} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏮</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onTogglePlay} style={styles.playButton}>
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏭</Text>
      </TouchableOpacity>

      <View style={styles.sideButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sideButton: {
    padding: 12,
    width: 56,
    alignItems: "center",
  },
  sideIcon: {
    fontSize: 22,
  },
  controlButton: {
    padding: 12,
  },
  controlIcon: {
    fontSize: 30,
    color: COLORS.playerText,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.playerText,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: COLORS.playerText,
    marginTop: -2,
  },
});

export default Controls;
```

- [ ] **Step 2: Replace `ProgressBar.js` contents**

```js
import React, { useState, useRef } from "react";
import { View, Text, PanResponder, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function ProgressBar({ position, duration, onSeek, accentColor = COLORS.accent }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const containerWidth = useRef(0);

  const safeDuration = Math.max(duration || 0, 1);
  const displayValue = isDragging
    ? dragValue
    : Math.min(position, safeDuration);
  const progress = Math.max(0, Math.min(1, displayValue / safeDuration));

  const updateValueFromTouchX = (x) => {
    const width = containerWidth.current || 1;
    const ratio = Math.max(0, Math.min(1, x / width));
    const value = ratio * safeDuration;
    setDragValue(value);
    return value;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setDragValue(position);
      setIsDragging(true);
      updateValueFromTouchX(evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      updateValueFromTouchX(evt.nativeEvent.locationX);
    },
    onPanResponderRelease: (evt) => {
      const v = updateValueFromTouchX(evt.nativeEvent.locationX);
      onSeek(v);
      setIsDragging(false);
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.touchContainer}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBackground} />
        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(displayValue)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 24,
  },
  touchContainer: {
    width: "100%",
    height: 40,
    position: "relative",
  },
  trackBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.playerTextDim,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    top: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.playerText,
    marginLeft: -8,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  time: {
    color: COLORS.playerTextDim,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

export default ProgressBar;
```

- [ ] **Step 3: Replace `Lyrics.js` contents**

```js
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
          <Text
            key={idx}
            style={[
              styles.lyricLine,
              isCurrent && styles.lyricCurrent,
              { color: isCurrent ? COLORS.playerText : COLORS.playerTextDim },
            ]}
            numberOfLines={1}
          >
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
    opacity: 0.5,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    opacity: 1,
    fontWeight: "600",
  },
  emptyText: {
    color: COLORS.playerTextDim,
    fontSize: 14,
  },
});

export default Lyrics;
```

- [ ] **Step 4: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Controls.js src/components/ProgressBar.js src/components/Lyrics.js
git commit -m "refactor(controls, progress-bar, lyrics): white-on-dark player colors, accentColor prop"
```

---

## Task 9: Split `PlayerScreen` into `SongsPlayerScreen` + `NovelsPlayerScreen`, delete `Vinyl`/`Tonearm`

**Files:**
- Create: `src/screens/SongsPlayerScreen.js`
- Create: `src/screens/NovelsPlayerScreen.js`
- Delete: `src/screens/PlayerScreen.js`
- Delete: `src/components/Vinyl.js`
- Delete: `src/components/Tonearm.js`
- Modify: `App.js` (import + view selection + remove VINYL_SIZE/ART_SIZE usage)
- Modify: `src/data/constants.js` (remove `VINYL_SIZE`/`ART_SIZE`)

**Interfaces:**
- Consumes: `Controls`/`ProgressBar`/`Lyrics` from Task 8 with `accentColor` prop. `PLAYER_COVER_SIZE_SONG`/`PLAYER_COVER_SIZE_NOVEL` from Task 1.
- Produces: `SongsPlayerScreen` accepts same props as old `PlayerScreen` + `spin`. `NovelsPlayerScreen` accepts same props as `PlayerScreen` (minus `spin`, plus `chapterInfo` derived from `currentTrack`).

- [ ] **Step 1: Create `src/screens/SongsPlayerScreen.js`**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ImageBackground, Image, Animated } from "react-native";
import { COLORS, PLAYER_COVER_SIZE_SONG } from "../data/constants";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";

function SongsPlayerScreen({
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
  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>请选择歌曲</Text>
      </View>
    );
  }

  const spinDeg = spin.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: currentTrack.artwork }}
        style={StyleSheet.absoluteFill}
        blurRadius={80}
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <SafeAreaView style={styles.foreground} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.topBtn}>
            <Text style={styles.topIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBtn}>
            <Text style={styles.topIcon}>{isFavorite ? "♥" : "♡"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.coverStage}>
          <Animated.View style={[styles.coverWrap, { transform: [{ rotate: spinDeg }] }]}>
            <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />
          </Animated.View>
        </View>

        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>

        <Lyrics lrc={currentTrack.lrc} position={position} />

        <ProgressBar position={position} duration={duration} onSeek={onSeek} accentColor={COLORS.accent} />

        <Controls
          isPlaying={isPlaying}
          onPrev={onSkipPrev}
          onNext={onSkipNext}
          onTogglePlay={onTogglePlay}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
          accentColor={COLORS.accent}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  foreground: {
    flex: 1,
  },
  loading: {
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topIcon: {
    color: COLORS.playerText,
    fontSize: 24,
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.playerText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  coverStage: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  coverWrap: {
    width: PLAYER_COVER_SIZE_SONG,
    height: PLAYER_COVER_SIZE_SONG,
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: PLAYER_COVER_SIZE_SONG / 2,
  },
  artist: {
    color: COLORS.playerTextDim,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
});

export default SongsPlayerScreen;
```

- [ ] **Step 2: Create `src/screens/NovelsPlayerScreen.js`**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ImageBackground, Image } from "react-native";
import { COLORS, PLAYER_COVER_SIZE_NOVEL } from "../data/constants";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";

function NovelsPlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  repeatMode,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onToggleRepeat,
  onBack,
  isFavorite,
  onToggleFavorite,
}) {
  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>请选择章节</Text>
      </View>
    );
  }

  const chapterIndex = currentTrack.chapterIndex || 0;
  const totalChapters = currentTrack.totalChapters || 1;
  const bookTitle = currentTrack.bookTitle || currentTrack.artist || "";

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: currentTrack.artwork }}
        style={StyleSheet.absoluteFill}
        blurRadius={80}
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <SafeAreaView style={styles.foreground} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.topBtn}>
            <Text style={styles.topIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBtn}>
            <Text style={styles.topIcon}>{isFavorite ? "♥" : "♡"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.coverStage}>
          <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />
        </View>

        <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>
        <Text style={styles.chapterProgress}>第{chapterIndex + 1}章 / 共{totalChapters}章</Text>

        <View style={styles.spacer} />

        <ProgressBar position={position} duration={duration} onSeek={onSeek} accentColor={COLORS.accentNovel} />

        <Controls
          isPlaying={isPlaying}
          onPrev={onSkipPrev}
          onNext={onSkipNext}
          onTogglePlay={onTogglePlay}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
          accentColor={COLORS.accentNovel}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  foreground: {
    flex: 1,
  },
  loading: {
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topIcon: {
    color: COLORS.playerText,
    fontSize: 24,
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.playerText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  coverStage: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 20,
  },
  cover: {
    width: PLAYER_COVER_SIZE_NOVEL,
    height: PLAYER_COVER_SIZE_NOVEL,
    borderRadius: 12,
  },
  bookTitle: {
    color: COLORS.playerText,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  chapterProgress: {
    color: COLORS.playerTextDim,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  spacer: {
    flex: 1,
  },
});

export default NovelsPlayerScreen;
```

- [ ] **Step 3: Update `App.js` imports and player view selection**

In `App.js`, change the import:

```js
import PlayerScreen from "./src/screens/PlayerScreen";
```

To:

```js
import SongsPlayerScreen from "./src/screens/SongsPlayerScreen";
import NovelsPlayerScreen from "./src/screens/NovelsPlayerScreen";
```

Then find the `view === "player"` branch (around line 589) and replace the `content = (<PlayerScreen ... />)` block:

```js
} else if (view === "player") {
  const isNovel = currentTrack?.isNovel || currentTrack?.isOCR;
  const Player = isNovel ? NovelsPlayerScreen : SongsPlayerScreen;
  content = (
    <Player
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

(`NovelsPlayerScreen` ignores the `spin` prop since it doesn't use it - that's fine, React allows extra props.)

- [ ] **Step 4: Delete old files**

Run:
```bash
rm src/screens/PlayerScreen.js src/components/Vinyl.js src/components/Tonearm.js
```

- [ ] **Step 5: Remove `VINYL_SIZE`/`ART_SIZE` from `constants.js`**

In `src/data/constants.js`, delete these two lines:

```js
export const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
export const ART_SIZE = Math.min(220, VINYL_SIZE - 120);
```

- [ ] **Step 6: Grep for stale references**

Run: `grep -rn "PlayerScreen\|Vinyl\|Tonearm\|VINYL_SIZE\|ART_SIZE" src/ App.js`
Expected: zero matches (all references should be gone). If any remain, fix them.

- [ ] **Step 7: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/screens/SongsPlayerScreen.js src/screens/NovelsPlayerScreen.js App.js src/data/constants.js
git rm src/screens/PlayerScreen.js src/components/Vinyl.js src/components/Tonearm.js
git commit -m "refactor(player): split into Songs/Novels player screens, delete Vinyl/Tonearm"
```

---

## Task 10: Update `MineScreen.js`

**Files:**
- Modify: `src/screens/MineScreen.js`

**Interfaces:**
- Produces: `MineScreen` same props. Passes `accentColor` to `TrackList` based on `mineSubTab` (red for favorites/recent/imported, orange for ocr).

- [ ] **Step 1: Replace `MineScreen.js` contents**

```js
import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
import TrackList from "../components/TrackList";
import BookCover from "../components/BookCover";

const MINE_TABS = [
  { key: "favorites", label: "收藏", accent: "accent" },
  { key: "recent", label: "最近播放", accent: "accent" },
  { key: "imported", label: "导入音乐", accent: "accent" },
  { key: "ocr", label: "OCR 小说", accent: "accentNovel" },
];

function MineScreen({
  allTracks,
  currentTrack,
  onSelect,
  favorites,
  recent,
  onImport,
  mineSubTab,
  onSubTabChange,
  ocrNovels,
  onDeleteOCRNovel,
  onAddChapters,
  onOpenSettings,
}) {
  const filtered = useMemo(
    () => filterTracks(mineSubTab, allTracks, favorites, recent),
    [mineSubTab, allTracks, favorites, recent]
  );

  const isOcrTab = mineSubTab === "ocr";
  const activeAccent = isOcrTab ? COLORS.accentNovel : COLORS.accent;

  const emptyText = useMemo(() => {
    if (mineSubTab === "favorites") return "还没有收藏的歌曲";
    if (mineSubTab === "recent") return "还没有播放记录";
    if (mineSubTab === "imported") return "还没有导入音乐";
    return "还没有 OCR 小说";
  }, [mineSubTab]);

  const confirmDelete = (book) => {
    Alert.alert("删除确认", `确定删除《${book.title}》？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => onDeleteOCRNovel(book.id) },
    ]);
  };

  const handleBookLongPress = (book) => {
    const actions = [];
    if (onAddChapters) {
      actions.push({ text: "添加章节", onPress: () => onAddChapters(book.id) });
    }
    actions.push({ text: "删除", style: "destructive", onPress: () => confirmDelete(book) });
    Alert.alert(book.title, null, [...actions, { text: "取消", style: "cancel" }]);
  };

  const renderOcrBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookRow}
      onLongPress={() => handleBookLongPress(item)}
      activeOpacity={0.6}
    >
      <BookCover uri={item.coverImage} title={item.title} style={styles.bookCover} accentColor={COLORS.accentNovel} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookMeta}>{item.chapters.length} 章</Text>
      </View>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, TYPO.titleLarge]}>我的</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabBar}>
        {MINE_TABS.map((tab) => {
          const isActive = tab.key === mineSubTab;
          const tabAccent = tab.accent === "accentNovel" ? COLORS.accentNovel : COLORS.accent;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onSubTabChange(tab.key)}
            >
              <Text style={[
                styles.tabText,
                { color: isActive ? tabAccent : COLORS.secondaryText, fontWeight: isActive ? "600" : "400" },
              ]}>
                {tab.label}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: tabAccent }]} />}
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
      {isOcrTab ? (
        ocrNovels.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={ocrNovels}
            keyExtractor={(item) => item.id}
            renderItem={renderOcrBook}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          />
        )
      ) : (
        <TrackList
          tracks={filtered}
          currentTrack={currentTrack}
          onSelect={(item) => onSelect(item, filtered, mineSubTab)}
          emptyText={emptyText}
          accentColor={activeAccent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: {
    color: COLORS.primaryText,
    fontSize: 22,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    marginRight: 24,
    paddingVertical: 8,
    position: "relative",
  },
  tabText: {
    fontSize: 14,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  importBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  importButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignSelf: "flex-start",
  },
  importButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: "600",
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bookCover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: COLORS.separator,
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  bookMeta: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
  },
  deleteBtnText: {
    color: COLORS.accentNovel,
    fontSize: 13,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 76,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 16,
  },
});

export default MineScreen;
```

- [ ] **Step 2: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/screens/MineScreen.js
git commit -m "refactor(mine-screen): light theme, settings icon, OCR orange accent"
```

---

## Task 11: Update `SettingsScreen.js`

**Files:**
- Modify: `src/screens/SettingsScreen.js`

**Interfaces:**
- Produces: `SettingsScreen` props minus `onShowPlayer` (removed - NowPlayingBar handles player entry). Card-style list on light background.

- [ ] **Step 1: Replace `SettingsScreen.js` contents**

```js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from "react-native";
import { COLORS, TYPO, APP_VERSION } from "../data/constants";

function SettingsScreen({ onBack, onClearCache }) {
  const handleClearCache = () => {
    Alert.alert(
      "清除缓存",
      "将删除所有 OCR 小说、导入音乐和播放记录，确定继续？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清除",
          style: "destructive",
          onPress: () => onClearCache(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, TYPO.titleMedium]}>设置</Text>
        <View style={styles.headerBtn} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        <TouchableOpacity style={styles.row} onPress={handleClearCache}>
          <Text style={styles.rowText}>清除缓存</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowText}>版本</Text>
          <Text style={styles.rowValue}>v{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    color: COLORS.primaryText,
    fontSize: 24,
  },
  title: {
    flex: 1,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowText: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  rowValue: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  rowArrow: {
    color: COLORS.tertiaryText,
    fontSize: 18,
  },
});

export default SettingsScreen;
```

- [ ] **Step 2: Update `App.js` to drop `currentTrack`/`onShowPlayer` props on `SettingsScreen`**

In `App.js`, find the `view === "settings"` branch and change:

```jsx
<SettingsScreen
  currentTrack={currentTrack}
  onShowPlayer={onShowPlayer}
  onBack={onBackFromSettings}
  onClearCache={onClearCache}
/>
```

To:

```jsx
<SettingsScreen
  onBack={onBackFromSettings}
  onClearCache={onClearCache}
/>
```

- [ ] **Step 3: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.js App.js
git commit -m "refactor(settings-screen): light theme, card list, remove onShowPlayer"
```

---

## Task 12: Update `OcrImportScreen.js`, `OcrChapterEditScreen.js`, `CreateEmptyBookModal.js`

**Files:**
- Modify: `src/screens/OcrImportScreen.js`
- Modify: `src/screens/OcrChapterEditScreen.js`
- Modify: `src/components/CreateEmptyBookModal.js`

**Interfaces:**
- Produces: All three use `COLORS.accentNovel` instead of `COLORS.accent` (OCR screens are always novel-context). Light theme via the updated `COLORS` (already picked up automatically).

- [ ] **Step 1: Replace `COLORS.accent` with `COLORS.accentNovel` in OCR screens**

Run:
```bash
sed -i '' 's/COLORS\.accent\b/COLORS.accentNovel/g' src/screens/OcrImportScreen.js src/screens/OcrChapterEditScreen.js
```

(On macOS, `sed -i ''` is the in-place flag. If running on Linux, use `sed -i` without the empty string.)

- [ ] **Step 2: Grep for any remaining hard-coded dark colors**

Run: `grep -n "#1a1a1a\|#ffffff\|#ffffff10\|#ffffff20\|#333\|#222\|#0a0a0a\|#999\|#666\|#888" src/screens/OcrImportScreen.js src/screens/OcrChapterEditScreen.js`

Expected: matches likely exist (hard-coded colors in OCR screens). For each match:
- `#1a1a1a` → `COLORS.background`
- `#333` (placeholder bg) → `COLORS.separator`
- `#ffffff` → `COLORS.surface`
- `#ffffff10`/`#ffffff20` (faint borders on dark) → `COLORS.separator`
- `#222`/`#0a0a0a` (vinyl) → `COLORS.background`
- `#999`/`#666`/`#888` (tonearm - but Tonearm is deleted; if these are in OCR screens) → `COLORS.secondaryText`

Fix each with an Edit. If unsure what a color was used for, read the surrounding 5 lines to understand the intent.

- [ ] **Step 3: Update `CreateEmptyBookModal.js`**

Replace `CreateEmptyBookModal.js` contents:

```js
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { COLORS, TYPO } from "../data/constants";

function CreateEmptyBookModal({ visible, onCreate, onCancel }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (visible) setTitle("");
  }, [visible]);

  const trimmed = title.trim();

  const handleCreate = () => {
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={[styles.title, TYPO.titleMedium]}>创建空小说</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="输入书名"
            placeholderTextColor={COLORS.secondaryText}
            autoFocus
          />
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!trimmed}
              style={[styles.primaryBtn, !trimmed && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnText}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "80%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    color: COLORS.primaryText,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    color: COLORS.primaryText,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.separator,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
    flex: 1,
    alignItems: "center",
  },
  outlineBtnText: {
    color: COLORS.accentNovel,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CreateEmptyBookModal;
```

- [ ] **Step 4: Run Metro bundle**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/OcrImportScreen.js src/screens/OcrChapterEditScreen.js src/components/CreateEmptyBookModal.js
git commit -m "refactor(ocr-screens, create-book-modal): light theme, orange accent"
```

---

## Task 13: Final review + manual verification handoff

**Files:**
- None modified. This is a verification task.

**Interfaces:**
- N/A.

- [ ] **Step 1: Full-repo grep for stale dark-theme artifacts**

Run: `grep -rn "COLORS\.\(vinyl\|groove\)\b" src/ App.js`
Expected: zero matches.

Run: `grep -rn "#1a1a1a\|#0a0a0a\|#222\|#ffffff10\|#ffffff20" src/ App.js`
Expected: zero matches (any remaining should have been fixed in earlier tasks; if any appear, fix them).

Run: `grep -rn "VINYL_SIZE\|ART_SIZE\|PlayerScreen\b" src/ App.js`
Expected: zero matches.

- [ ] **Step 2: Run Metro bundle one final time**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: PASS.

- [ ] **Step 3: Verify App.js line count**

Run: `wc -l App.js`
Expected: ≤300 lines (per [[mp3-player-phased-plan]] budget). If over, identify removable boilerplate (consolidate view branches, dedupe props) and trim. If still over, flag to user.

- [ ] **Step 4: Manual simulator verification handoff**

Hand the device back to the user with this checklist:

> **请在 iOS 模拟器里手动验证以下场景:**
>
> 1. **歌曲 tab**:列表显示亮色 + 红色主调;激活歌曲红色高亮 + ▍▍▍ 波形图标;点击进播放器
> 2. **小说 tab**:2 列网格 + 橙色主调;封面正方形;点击进 NovelDetail;长按 OCR 书弹删除
> 3. **NovelDetail**:顶栏 ⋯ 菜单(OCR 书);章节列表激活态橙色;播放按钮 + 添加章节按钮
> 4. **歌曲播放器**:模糊封面背景;圆形旋转封面;歌词;进度条红色;控制条白色
> 5. **小说播放器**:模糊封面背景;方形封面不旋转;章节进度文字;进度条橙色
> 6. **我的 tab**:4 个子 tab;收藏/最近/导入音乐用红;OCR 小说用橙;⚙ 设置图标
> 7. **设置**:卡片列表;清除缓存确认弹窗;版本号显示
> 8. **底部导航**:切换 tab 时主调色正确切换(歌曲红 / 小说橙 / 我的红)
> 9. **NowPlayingBar**:白卡片 + 细进度条;播放/暂停图标切换;小说章节时主调色为橙

- [ ] **Step 5: Commit verification log**

If all manual checks pass, commit a verification log:

```bash
cat > .superpowers/sdd/progress.md << 'EOF'
# UI Redesign Progress

**Spec:** docs/superpowers/specs/2026-07-14-ui-redesign-design.md
**Plan:** docs/superpowers/plans/2026-07-14-ui-redesign.md
**Status:** All 13 tasks complete. Metro bundle passes. Manual iOS simulator verification handed to user.

## Verification

- Metro bundle: PASS (no import/syntax errors)
- App.js line count: checked (≤300)
- Stale color grep: zero matches
- Manual simulator: handed to user with 9-item checklist
EOF

git add .superpowers/sdd/progress.md
git commit -m "docs: log UI redesign progress and verification status"
```

- [ ] **Step 6: Hand off to user for finishing-a-development-branch**

When the user confirms the manual simulator checks pass, invoke `superpowers:finishing-a-development-branch` to choose merge-to-main-locally (--no-ff, per [[mp3-player-workflow-preferences]]) or another option.

---

## Self-Review

### Spec coverage

- §1 (Colors & Typography): Task 1 ✓
- §1 (activeAccent mechanism): Task 2 ✓
- §2 (BottomNav): Task 3 ✓
- §2 (NowPlayingBar): Task 3 ✓
- §3 (SongsScreen): Task 5 ✓
- §3 (TrackList): Task 4 ✓
- §4 (NovelsScreen grid): Task 6 ✓
- §4 (NovelDetailScreen): Task 7 ✓
- §5 (SongsPlayerScreen): Task 9 ✓
- §5 (NovelsPlayerScreen): Task 9 ✓
- §5 (delete Vinyl/Tonearm/PlayerScreen): Task 9 ✓
- §5 (Controls/ProgressBar/Lyrics updates): Task 8 ✓
- §6 (MineScreen): Task 10 ✓
- §6 (SettingsScreen): Task 11 ✓
- §6 (OcrImportScreen/OcrChapterEditScreen): Task 12 ✓
- §6 (CreateEmptyBookModal): Task 12 ✓
- §6 (App.js glowTop removal): Task 2 ✓
- Verification: Task 13 ✓

All spec sections covered.

### Type/prop consistency

- `accentColor` prop name used consistently across `BottomNav`, `NowPlayingBar`, `TrackList`, `BookCover`, `Controls`, `ProgressBar`. Default is `COLORS.accent` everywhere. ✓
- `position`/`duration`/`isPlaying` props on `NowPlayingBar`: added in Task 3, used in Task 2 (App.js) and Task 7 (NovelDetailScreen). Task 7 passes `position={0} duration={0} isPlaying={false}` - this means the progress bar in NovelDetail's NowPlayingBar will always be empty. This is a known limitation: NovelDetail doesn't have access to playback position from App.js. Acceptable for visual redesign (it's still visually correct, just static). If a future task wants live progress, App.js can pass these props through. ✓ (intentional)
- `spin` prop passed to `NovelsPlayerScreen` in Task 9 (App.js view selection) - NovelsPlayerScreen ignores it. React allows extra props. ✓
- `chapterIndex`/`totalChapters`/`bookTitle` on `currentTrack`: read via `|| 0`/`|| 1`/`|| ""` fallbacks in NovelsPlayerScreen. These fields may not exist on actual track objects - the fallback handles that gracefully. ✓
- `Player` component variable in Task 9 Step 3: capitalized, used as `<Player .../>`. ✓

### Placeholder scan

- No "TBD"/"TODO"/"implement later" in plan.
- All code blocks contain actual replacement code.
- Task 12 Step 2 says "fix each with an Edit" for hard-coded colors - this is intentionally flexible because the grep output is not knowable in advance. The implementer has the mapping table and instructions to read surrounding lines for context. Acceptable.
