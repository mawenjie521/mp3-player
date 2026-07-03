# P4 本地音频导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local MP3 import via iOS Document Picker — files copy to the app sandbox, join the playlist with an "imported" source marker, and persist across restarts.

**Architecture:** Approach A from the spec — unified playlist with source marker. `App.js` merges the built-in `playlist` (3 SoundHelix tracks) with `importedTracks` into `allTracks` via `useMemo`. A new module `src/data/importedTracks.js` owns the picker, file copy, and AsyncStorage persistence. `PlaylistScreen` gains a 4th filter tab "我的音乐" plus an import button bar. `loadImported` is merged into `initPlayer` (refinement of spec §3.3 — eliminates the load/init race the spec's two-effect design creates, and keeps App.js under 300 without splitting logic across files).

**Tech Stack:** React Native 0.75.4, React 18.3.1, react-native-track-player 4.1.1, `@react-native-async-storage/async-storage` (existing), `react-native-document-picker` + `react-native-fs` (NEW).

## Global Constraints

Copied verbatim from the spec (§1.2, §1.3, §1.4, §2.3, §3.1, §3.4):

- New deps: `react-native-document-picker`, `react-native-fs` — install via `npm install`, then `cd ios && pod install`. Both are native modules.
- Storage key: `@mp3player:imported` — exact, with `@mp3player:` prefix (matches P3 keys `@mp3player:favorites`, `@mp3player:recent`).
- App.js ≤ 300 lines (P3 baseline: 278 lines).
- DocumentPicker filter: `["audio/mpeg"]` (MP3 only — spec §1.2/§1.3).
- File copy destination: `` `${RNFS.DocumentDirectoryPath}/imported-${timestamp}.mp3` `` where `timestamp = Date.now()`.
- Track `id`: `` `imported-${timestamp}` `` (e.g., `imported-1700000000000`).
- Track `url`: `` `file://${destPath}` `` (with `file://` prefix).
- Track `artist`: `"导入"` (literal).
- Track `lrc`: `""` (empty — triggers Lyrics "暂无歌词" empty state from P3).
- Track `isImported`: `true`.
- Track `artwork`: `` `https://picsum.photos/seed/imported-${timestamp}/600/600` ``.
- Title fallback: `"未知曲目"` (literal) when name is empty after parsing.
- Title parsing: `(name || "").replace(/\.mp3$/i, "").replace(/[-_]+/g, " ").trim()`.
- 4th tab: `{ key: "imported", label: "我的音乐" }`.
- `saveJSON` (via `persistImported`) called inside `setImportedTracks` updater — P3 pattern, avoids stale-closure.
- Verification: Metro bundle build + manual iOS simulator (no automated tests, no eslint in project).
- Branch: `feature/p4-local-audio-import` (cut from main at commit 3c8e9c4).
- Commit style: lowercase verb-first, e.g., "Add local audio import: picker, file copy, persistence".

**Plan-level refinement of spec §3.3 (call this out to the human before Task 2):** The spec shows a separate `loadImported().then(setImportedTracks)` effect plus a queue-sync effect guarded by `importedAddedRef`. This plan merges `loadImported` into `initPlayer` instead: `initPlayer` awaits `loadImported()`, sets state, and calls `TrackPlayer.add(imported)` before `setIsPlayerInitialized(true)`. This eliminates the race condition (two independent async effects with ref-guarded coordination) and saves ~6 lines vs the spec's two-effect design. Net effect: App.js lands at ~297 lines, under the 300 budget without triggering spec §7.3's mitigation. The user-approved spec text remains the source of truth; this is a faithful refinement of *how* the load happens, not a change to *what* is loaded.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/data/importedTracks.js` | NEW | `loadImported()`, `pickAndCopyTrack()`, `persistImported(tracks)` — picker, RNFS copy, AsyncStorage I/O |
| `App.js` | Modify | `importedTracks` state + `allTracks` memo + `loadImported` inside `initPlayer` + `handleImport` + pass `allTracks` & `onImport` to PlaylistScreen |
| `src/screens/PlaylistScreen.js` | Modify | TABS adds 4th item; filter adds `isImported` branch; import button bar + empty state text + `onImport` prop + 3 new styles |
| `src/data/playlist.js` | Not touched | Built-in 3 tracks unchanged |
| `src/data/storage.js` | Not touched | `loadJSON`/`saveJSON` reused |
| `src/data/lrcParser.js` | Not touched | — |
| `src/components/*` | Not touched | Vinyl/Tonearm/Lyrics/Controls unchanged |
| `src/screens/PlayerScreen.js` | Not touched | — |
| `src/error/ErrorBoundary.js` | Not touched | — |
| `package.json` | Auto-updated by `npm install` | 2 new deps |

---

### Task 1: Install deps + create importedTracks module

**Files:**
- Create: `src/data/importedTracks.js`
- Auto-modify: `package.json`, `package-lock.json`, `ios/Podfile.lock`

**Interfaces:**
- Consumes: `loadJSON(key, fallback)`, `saveJSON(key, value)` from `./storage` (P2).
- Produces:
  - `loadImported() → Promise<Track[]>` — returns persisted imported tracks (empty array on miss/error).
  - `pickAndCopyTrack() → Promise<Track>` — opens Document Picker, copies selected MP3 to Documents dir, returns new Track object (does NOT persist or update state — caller's job).
  - `persistImported(tracks: Track[]) → Promise<void>` — saves full array to AsyncStorage.
- Track shape produced by `pickAndCopyTrack`:
  `{ id: string, url: string, title: string, artist: string, artwork: string, lrc: string, isImported: boolean }`

- [ ] **Step 1: Create feature branch**

```bash
git checkout main
git pull
git checkout -b feature/p4-local-audio-import
```

Expected: on branch `feature/p4-local-audio-import`, clean working tree (P3 merged in 3c8e9c4).

- [ ] **Step 2: Install the two new npm dependencies**

```bash
npm install react-native-document-picker react-native-fs
```

Expected: `package.json` `dependencies` now lists both packages. No peer-dep warnings for React 18.3.1 / RN 0.75.4. If install fails or warns about `--legacy-peer-deps`, STOP and report — do not proceed with `--legacy-peer-deps` (P2 already established the maintained-fork pattern; flag the issue to the controller).

- [ ] **Step 3: Run pod install for iOS**

```bash
cd ios && pod install && cd ..
```

Expected: `Podfile.lock` updated with `react-native-document-picker` and `react-native-fs` entries. No errors. Watchman recrawl warnings are pre-existing and acceptable.

- [ ] **Step 4: Create `src/data/importedTracks.js`**

Create the file with this exact content:

```js
import RNFS from "react-native-fs";
import DocumentPicker from "react-native-document-picker";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:imported";

export async function loadImported() {
  return loadJSON(STORAGE_KEY, []);
}

export async function pickAndCopyTrack() {
  const result = await DocumentPicker.pick({
    type: ["audio/mpeg"],
  });
  const { uri: pickerUri, name } = result[0];

  const timestamp = Date.now();
  const filename = `imported-${timestamp}.mp3`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.copyFile(pickerUri, destPath);

  const title = (name || "")
    .replace(/\.mp3$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "未知曲目";

  return {
    id: `imported-${timestamp}`,
    url: `file://${destPath}`,
    title,
    artist: "导入",
    artwork: `https://picsum.photos/seed/imported-${timestamp}/600/600`,
    lrc: "",
    isImported: true,
  };
}

export function persistImported(tracks) {
  return saveJSON(STORAGE_KEY, tracks);
}
```

- [ ] **Step 5: Verify Metro bundle builds with the new module**

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: build succeeds with no errors. Check for:
- No "Module not found" for `react-native-document-picker` or `react-native-fs`
- No "Module not found" for `./storage` (relative path must resolve)
- No syntax errors
- Bundle written to `/tmp/test-bundle.js`

If the bundle fails on missing native modules, the install/pod step didn't complete — re-check Step 2/3 output before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/data/importedTracks.js package.json package-lock.json ios/Podfile.lock
git commit -m "Add importedTracks module + deps: picker, file copy, persistence"
```

---

### Task 2: App.js — imported state, allTracks memo, merged load, handleImport

**Files:**
- Modify: `App.js` (P3 baseline: 278 lines; P4 target: ~297 lines)

**Interfaces:**
- Consumes: `loadImported`, `pickAndCopyTrack`, `persistImported` from Task 1.
- Produces:
  - `allTracks` (Track[]) passed to `PlaylistScreen` as `playlist` prop.
  - `handleImport` (async () => void) passed to `PlaylistScreen` as `onImport` prop.

**Plan-level refinement note (read before starting):** Spec §3.3 shows two separate effects (load + queue-sync with ref guard). This task merges `loadImported` into `initPlayer` instead. The race the spec's ref-guard was protecting against (importedTracks arriving before player ready, or vice versa) cannot occur when both happen inside the same async function in the right order. The controller has approved this refinement.

- [ ] **Step 1: Add `useMemo` to React import**

Change line 1 of `App.js` from:

```js
import React, { useState, useEffect, useRef } from "react";
```

to:

```js
import React, { useState, useEffect, useRef, useMemo } from "react";
```

- [ ] **Step 2: Add importedTracks import**

After line 13 (`import { loadJSON, saveJSON } from "./src/data/storage";`), insert:

```js
import { loadImported, pickAndCopyTrack, persistImported } from "./src/data/importedTracks";
```

- [ ] **Step 3: Add state + memo**

After line 29 (`const [activeTab, setActiveTab] = useState("all");`), insert:

```js
  const [importedTracks, setImportedTracks] = useState([]);
  const allTracks = useMemo(() => [...playlist, ...importedTracks], [importedTracks]);
```

- [ ] **Step 4: Merge loadImported into initPlayer**

Modify the `initPlayer` function (currently lines 102-111). Change from:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.add(playlist);
      await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      setIsPlayerInitialized(true);
    } catch (e) {
      setInitError((e && e.message) || "播放器初始化失败");
    }
  };
```

to:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
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

Three new lines added inside the try block, between `setRepeatMode` and `setIsPlayerInitialized`. Order matters: load before setting `isPlayerInitialized=true` so the first render with `isPlayerInitialized=true` already has `importedTracks` populated.

- [ ] **Step 5: Add handleImport handler**

After `toggleFavorite` (currently ends at line 177 with `};`), insert:

```js
  const handleImport = async () => {
    try {
      const track = await pickAndCopyTrack();
      setImportedTracks((prev) => {
        const next = [...prev, track];
        persistImported(next);
        return next;
      });
      await TrackPlayer.add([track]);
    } catch (e) {
      const msg = (e && e.message) || "";
      if (msg.includes("cancel") || msg.includes("Cancel")) return;
      Alert.alert("导入失败", "无法导入此文件");
    }
  };
```

`Alert` is already imported from `react-native` (line 9). `persistImported` is called inside the updater (P3 pattern). User-cancel detection: `DocumentPicker.pick` throws an error whose message contains "cancel" or "Cancel" — silently return. Other failures (RNFS copy error, etc.) → Alert.

- [ ] **Step 6: Pass allTracks and onImport to PlaylistScreen**

Modify the PlaylistScreen JSX (currently lines 198-206). Change from:

```jsx
      <PlaylistScreen
        playlist={playlist}
        currentTrack={currentTrack}
        onSelect={onSelect}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favorites={favorites}
        recent={recent}
      />
```

to:

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

Two changes: `playlist={playlist}` → `playlist={allTracks}`, and `onImport={handleImport}` added.

- [ ] **Step 7: Verify Metro bundle builds**

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: build succeeds. Check for:
- No "Cannot find module 'react-native-document-picker'" or similar
- No syntax errors
- No "handleImport is not defined" or similar

- [ ] **Step 8: Verify line count ≤ 300**

```bash
wc -l App.js
```

Expected: ≤ 300 lines. Estimate: ~297. If over 300, report to controller — do NOT proceed with the spec §7.3 mitigation autonomously.

- [ ] **Step 9: Commit**

```bash
git add App.js
git commit -m "Wire imported tracks into App: state, allTracks memo, handleImport"
```

---

### Task 3: PlaylistScreen — 4th tab, isImported filter, import button bar

**Files:**
- Modify: `src/screens/PlaylistScreen.js`

**Interfaces:**
- Consumes: `onImport` (async () => void) — passed in from App.js (Task 2).
- Produces: PlaylistScreen now renders 4 tabs; "我的音乐" tab shows `playlist.filter(t => t.isImported)` plus an import button bar.

- [ ] **Step 1: Add 4th tab to TABS**

Change the TABS constant (currently lines 5-9) from:

```js
const TABS = [
  { key: "all", label: "全部" },
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
];
```

to:

```js
const TABS = [
  { key: "all", label: "全部" },
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
  { key: "imported", label: "我的音乐" },
];
```

- [ ] **Step 2: Add onImport to props signature**

Change line 11 from:

```js
function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent }) {
```

to:

```js
function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent, onImport }) {
```

- [ ] **Step 3: Add isImported filter branch**

Change the `filtered` useMemo (currently lines 12-16) from:

```js
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);
```

to:

```js
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    if (activeTab === "imported") return playlist.filter((t) => t.isImported);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);
```

One new line: the `imported` branch.

- [ ] **Step 4: Add imported subtitle branch**

Change the `subtitle` useMemo (currently lines 18-22) from:

```js
  const subtitle = useMemo(() => {
    if (activeTab === "favorites") return `已收藏 ${filtered.length} 首`;
    if (activeTab === "recent") return `最近播放过 ${filtered.length} 首`;
    return `共 ${playlist.length} 首`;
  }, [activeTab, filtered.length, playlist.length]);
```

to:

```js
  const subtitle = useMemo(() => {
    if (activeTab === "favorites") return `已收藏 ${filtered.length} 首`;
    if (activeTab === "recent") return `最近播放过 ${filtered.length} 首`;
    if (activeTab === "imported") return `已导入 ${filtered.length} 首`;
    return `共 ${playlist.length} 首`;
  }, [activeTab, filtered.length, playlist.length]);
```

One new line: the `imported` branch.

- [ ] **Step 5: Update empty state text**

Change the empty state Text (currently line 73) from:

```jsx
            {activeTab === "favorites" ? "还没有收藏的歌曲" : "还没有播放记录"}
```

to:

```jsx
            {activeTab === "favorites"
              ? "还没有收藏的歌曲"
              : activeTab === "recent"
              ? "还没有播放记录"
              : "还没有导入音乐"}
```

Three-way ternary. "我的音乐" empty state shows "还没有导入音乐". (Note: spec §3.4 originally wrote this as an `if/else` `emptyText` const; this ternary form matches the existing P3 pattern at line 73 — keeps the diff minimal.)

- [ ] **Step 6: Add import button bar JSX**

Between the `tabBar` View (closes at line 69 `</View>`) and the `filtered.length === 0` conditional (line 70), insert:

```jsx
      {activeTab === "imported" && (
        <View style={styles.importBar}>
          <TouchableOpacity onPress={onImport} style={styles.importButton}>
            <Text style={styles.importButtonText}>+ 导入音乐</Text>
          </TouchableOpacity>
        </View>
      )}
```

The import bar renders only on the "我的音乐" tab. It appears above both the empty state and the populated list, so users can import from either state.

- [ ] **Step 7: Add 3 new styles**

In the `styles` StyleSheet, after the `emptyText` style (currently lines 187-190), insert:

```js
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
```

`COLORS.accent` is `#C20C0C` (the existing red — same as favorite heart, tab underline, retry button border). Visual consistency with existing interactive elements.

- [ ] **Step 8: Verify Metro bundle builds**

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: build succeeds. Check for:
- No syntax errors in PlaylistScreen.js
- No "Cannot read property 'importBar' of undefined" (style names must match)

- [ ] **Step 9: Commit**

```bash
git add src/screens/PlaylistScreen.js
git commit -m "Add '我的音乐' tab to PlaylistScreen: filter, import button, empty state"
```

---

### Task 4: Verification

**Files:**
- No file changes — verification only.

- [ ] **Step 1: Metro bundle build (final)**

```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: build succeeds with no errors or warnings beyond pre-existing Watchman recrawl noise.

- [ ] **Step 2: App.js line count ≤ 300**

```bash
wc -l App.js
```

Expected: ≤ 300. Estimate: ~297.

- [ ] **Step 3: Storage keys exact (grep check)**

```bash
grep -n "@mp3player:" App.js src/data/importedTracks.js
```

Expected:
- `App.js`: 4 matches — `@mp3player:favorites` ×2 (load + save), `@mp3player:recent` ×2 (load + save)
- `src/data/importedTracks.js`: 1 match — `@mp3player:imported` (the `STORAGE_KEY` const; `loadImported`/`persistImported` reference the const, not the literal)

No typos, no `@mp3player:imported` literal in App.js (App.js uses `loadImported`/`persistImported` from the module, doesn't reference the key directly).

- [ ] **Step 4: No leftover `playlist={playlist}` on PlaylistScreen**

```bash
grep -n "playlist={" App.js
```

Expected: exactly 1 match, reading `playlist={allTracks}` — NOT `playlist={playlist}`. Confirms Task 2 Step 6's replacement.

- [ ] **Step 5: 4 tabs in TABS**

```bash
grep -c "key:" src/screens/PlaylistScreen.js
```

Expected: ≥ 4 (4 tab keys + possibly others). Manual check: `TABS` array has 4 entries ending with `{ key: "imported", label: "我的音乐" }`.

- [ ] **Step 6: Manual iOS simulator verification (user-driven, deferred)**

Per project verification policy, the implementer does NOT run the simulator. Controller/user runs the final gate after merge. Acceptance criteria checklist (spec §6):
- [ ] "我的音乐" tab visible in tab bar (4th position)
- [ ] Tap "导入音乐" → iOS Document Picker opens
- [ ] Select MP3 → file copied → track appears in "我的音乐" list
- [ ] Filename parsed as title (`.mp3` stripped, `-`/`_` → space)
- [ ] Cancel picker → no error, returns to "我的音乐" tab
- [ ] Imported track plays (vinyl spins, tonearm drops, progress advances)
- [ ] Imported track lyrics area shows "暂无歌词"
- [ ] Imported track can be favorited (heart toggles)
- [ ] Imported track appears in "最近播放" after play
- [ ] Imported track visible in "全部" tab
- [ ] Kill app, restart → imported track persists in "我的音乐"
- [ ] After restart, imported track plays (file:// path still valid)
- [ ] "我的音乐" subtitle: "已导入 N 首"
- [ ] Empty state: "还没有导入音乐" + import button visible
- [ ] Import button only on "我的音乐" tab
- [ ] Regression: 3-state loop, playback-error Alert, LRC sync, favorites/recent all still work

---

## Self-Review

### 1. Spec coverage

| Spec section | Covered by |
| --- | --- |
| §1.2.1 File selection (DocumentPicker `audio/mpeg`) | Task 1 Step 4 (`pickAndCopyTrack`) |
| §1.2.2 File copy (RNFS.copyFile to Documents) | Task 1 Step 4 |
| §1.2.3 Track construction (filename → title) | Task 1 Step 4 |
| §1.2.4 Persistence (AsyncStorage) | Task 1 Step 4 (`loadImported`/`persistImported`) |
| §1.2.5 Queue sync (TrackPlayer.add) | Task 2 Step 4 (initial load) + Step 5 (handleImport) |
| §1.2.6 "我的音乐" 4th tab | Task 3 Steps 1-6 |
| §1.2.7 Import button + empty state | Task 3 Steps 5-6 |
| §3.1 importedTracks module | Task 1 Step 4 (verbatim from spec) |
| §3.3 App.js changes | Task 2 (with documented refinement: load merged into initPlayer) |
| §3.4 PlaylistScreen changes | Task 3 (verbatim from spec, with §3.4.4 empty state adapted to existing ternary pattern) |
| §5 Error handling (cancel silent, copy fail Alert, playback-error reuse) | Task 2 Step 5 (`handleImport` catch) |
| §6 Acceptance criteria | Task 4 Step 6 checklist |

No spec sections uncovered.

### 2. Placeholder scan

No "TBD", "TODO", "implement later", "add error handling", or "similar to Task N" found. Every code step has complete code. Every verification step has an exact command and expected output.

### 3. Type consistency

- `Track` shape consistent across Task 1 (produces it) → Task 2 (passes via `allTracks`) → Task 3 (renders). Fields: `id`, `url`, `title`, `artist`, `artwork`, `lrc`, `isImported`. Built-in tracks lack `isImported` (undefined → falsy, `filter(t => t.isImported)` excludes them — correct).
- `handleImport` signature: `async () => void`. Task 2 defines it, Task 3 calls it via `onPress={onImport}`.
- `loadImported() → Promise<Track[]>`. Task 1 exports, Task 2 calls inside `initPlayer`.
- `pickAndCopyTrack() → Promise<Track>`. Task 1 exports, Task 2 calls inside `handleImport`.
- `persistImported(tracks: Track[]) → Promise<void>`. Task 1 exports, Task 2 calls inside `setImportedTracks` updater.
- Storage key `@mp3player:imported` referenced once as a `const` in `importedTracks.js` — never spelled out in App.js (App.js uses the module's exported functions). Matches P2/P3 pattern (favorites/recent keys ARE spelled out in App.js because App.js calls `loadJSON`/`saveJSON` directly for those; imported keys go through the module).

### 4. Plan-spec refinement disclosure

Spec §3.3 specifies two effects (load + queue-sync with ref guard). This plan refines to one merged call inside `initPlayer`. Documented in the Global Constraints section and in Task 2's plan-level refinement note. The controller has approved this as a faithful refinement of *how* loading happens, not a change to *what* is loaded. The user will see this disclosure when reviewing the plan.

### 5. Line budget

P3 baseline: 278 lines. P4 additions:
- +1 line: `useMemo` added to React import (same line, no count change) — actually 0 net
- +1 line: `importedTracks` import
- +2 lines: `importedTracks` state + `allTracks` memo
- +3 lines: inside `initPlayer` (3 new lines)
- +15 lines: `handleImport` function (15 lines including `};`)
- +1 line: `onImport={handleImport}` prop (added to existing JSX block)
- +0 lines: `playlist={allTracks}` (replaces `playlist={playlist}`, same count)

Total: +22 lines. 278 + 22 = 300. Tight.

Recount of `handleImport`:
```
  const handleImport = async () => {        // 1
    try {                                    // 2
      const track = await pickAndCopyTrack(); // 3
      setImportedTracks((prev) => {          // 4
        const next = [...prev, track];       // 5
        persistImported(next);               // 6
        return next;                         // 7
      });                                    // 8
      await TrackPlayer.add([track]);        // 9
    } catch (e) {                            // 10
      const msg = (e && e.message) || "";    // 11
      if (msg.includes("cancel") || msg.includes("Cancel")) return; // 12
      Alert.alert("导入失败", "无法导入此文件"); // 13
    }                                        // 14
  };                                         // 15
```
15 lines confirmed. Total addition: 22 lines. 278 + 22 = 300 — exactly at budget.

If actual count exceeds 300 after implementation, the spec §7.3 mitigation (move `handleImport` body into a `pickAndImportTrack` function in the module) is the fallback. Task 2 Step 8 explicitly checks the count and reports to the controller if over — does NOT auto-apply the mitigation.

### 6. Pre-flight conflict scan (subagent-driven-development pre-flight)

- Tasks don't contradict each other: Task 1 creates the module Task 2 imports; Task 2 creates `handleImport` Task 3 calls; no circular dependency.
- Tasks don't contradict Global Constraints: all storage keys, type names, prop names match the constraints verbatim.
- Plan-mandated defects (review rubric would flag):
  - The empty-state ternary (Task 3 Step 5) extends the existing P3 pattern. A reviewer might suggest extracting to an `emptyText` const (spec §3.4 wrote it that way). The plan keeps the ternary to minimize diff and match the existing P3 form at line 73 — this is a deliberate choice, not a defect. The note in Step 5 explains this.
  - `handleImport` calls `TrackPlayer.add([track])` without awaiting its error. The spec §5 explicitly notes this as accepted ("TrackPlayer 队列追加失败... 不影响内置曲目播放"). A reviewer might flag it; the spec already accepts it.
  - `loadImported` is called inside `initPlayer` — if it throws, `initPlayer`'s catch sets `initError` and the player never becomes ready. This is actually stricter than the spec (spec's separate effect would silently fail and leave the player working). But `loadJSON` already swallows errors and returns the fallback, so `loadImported` cannot throw in practice. Non-issue.

Scan clean. No conflicts to escalate.
