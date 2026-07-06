# Background Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow audio to keep playing after the screen locks, with lock screen + Control Center controls (play/pause, skip, artwork, read-only progress bar).

**Architecture:** Approach A from the spec — minimal change filling two gaps. (1) Add `UIBackgroundModes: [audio]` to `ios/MP3Player/Info.plist` so iOS permits background audio. (2) Call `TrackPlayer.updateOptions()` in `App.js` `initPlayer()` so RNTP declares remote-control capabilities to iOS and publishes Now Playing metadata. No native code changes; `service.js` already has the remote-event handlers; RNTP v4 sets the `AVAudioSession` category to `Playback` during `setupPlayer()`.

**Tech Stack:** React Native 0.75.4, react-native-track-player 4.1.1, iOS Info.plist.

## Global Constraints

Copied verbatim from the spec:

- Background mode key: `UIBackgroundModes` (exact), value: array containing the single string `audio`.
- `updateOptions` capabilities: `Capability.Play`, `Capability.Pause`, `Capability.Stop`, `Capability.SkipToNext`, `Capability.SkipToPrevious` (exact enum names from `react-native-track-player` v4).
- `updateOptions` `compactCapabilities`: `Capability.Play`, `Capability.Pause`, `Capability.SkipToNext` (the three buttons shown in the compact Control Center layout).
- Import in `App.js`: `import TrackPlayer, { Capability } from "react-native-track-player";` (replaces the existing `import TrackPlayer from "react-native-track-player";`).
- `updateOptions()` call placement: inside `initPlayer()`, immediately after `await TrackPlayer.setupPlayer();` and before `await TrackPlayer.add(playlist);`.
- Verification: Metro bundle build (`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`) + manual iOS simulator/device check (no automated tests, no eslint in project).
- Branch: `feature/background-audio` (cut from main).
- Commit style: lowercase verb-first (matches existing history, e.g., "Add background audio: UIBackgroundModes + updateOptions").

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `ios/MP3Player/Info.plist` | Modify | Add `UIBackgroundModes: [audio]` entitlement |
| `App.js` | Modify | Import `Capability`; call `TrackPlayer.updateOptions()` in `initPlayer()` |
| `service.js` | Not touched | Remote-event handlers already in place |
| `ios/MP3Player/AppDelegate.mm` | Not touched | RNTP v4 sets audio session category internally |
| `src/**` | Not touched | No component/screen changes |
| `package.json` | Not touched | No new deps |

---

### Task 1: Add `UIBackgroundModes` entitlement to Info.plist

**Files:**
- Modify: `ios/MP3Player/Info.plist`

**Interfaces:**
- Consumes: nothing (pure plist edit).
- Produces: an Info.plist that declares the `audio` background mode — required by iOS for any app that wants audio to continue when the screen locks.

- [ ] **Step 1: Create feature branch**

```bash
git checkout main
git pull
git checkout -b feature/background-audio
```

Expected: on branch `feature/background-audio`, clean working tree.

- [ ] **Step 2: Read the current Info.plist to confirm the insertion point**

Run: `cat ios/MP3Player/Info.plist`

Expected: a standard React Native Info.plist. Confirm there is no existing `UIBackgroundModes` key (if there is, this plan is stale — STOP and re-evaluate). The insertion will go inside the top-level `<dict>`, before the closing `</dict>`.

- [ ] **Step 3: Add the UIBackgroundModes key**

In `ios/MP3Player/Info.plist`, insert this block immediately before the closing `</dict>` (after the existing `UIViewControllerBasedStatusBarAppearance` entry):

```xml
	<key>UIBackgroundModes</key>
	<array>
		<string>audio</string>
	</array>
```

The indentation uses tabs (one tab for `<key>`/`<array>`, two tabs for `<string>`) to match the existing file's tab-indented style.

- [ ] **Step 4: Validate the plist is well-formed XML**

Run: `plutil -lint ios/MP3Player/Info.plist`

Expected output: `ios/MP3Player/Info.plist: OK`

If it prints a syntax error, the XML is malformed — fix the indentation/structure before committing.

- [ ] **Step 5: Commit**

```bash
git add ios/MP3Player/Info.plist
git commit -m "Add UIBackgroundModes audio entitlement for background playback"
```

Expected: one file changed, ~3 insertions.

---

### Task 2: Declare playback capabilities via `TrackPlayer.updateOptions()`

**Files:**
- Modify: `App.js`

**Interfaces:**
- Consumes: `TrackPlayer.setupPlayer()` (already called in `initPlayer`) — `updateOptions` must be called after setup.
- Produces: an initialized player that has declared its remote-control capabilities to iOS, causing RNTP to publish Now Playing metadata and accept lock-screen / Control Center button events. The existing `service.js` handlers process those events.

- [ ] **Step 1: Confirm the current `initPlayer` and import shape**

Run: `grep -n "TrackPlayer\|initPlayer\|setupPlayer" App.js`

Expected output includes:
- Line ~1: `import TrackPlayer from "react-native-track-player";` (other named imports like `usePlaybackState`, `State`, `useProgress` follow on a separate line — verify but do not change them).
- The `initPlayer` function definition with `await TrackPlayer.setupPlayer();` as its first call.

If `TrackPlayer.updateOptions` already appears anywhere in App.js, STOP — this plan is stale.

- [ ] **Step 2: Update the TrackPlayer import to include `Capability`**

In `App.js`, change line 7 (the bare TrackPlayer import):

From:
```js
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
```

To:
```js
import TrackPlayer, { usePlaybackState, State, useProgress, Capability } from "react-native-track-player";
```

(If the existing import line is on a different line number or uses different named imports, preserve them — only add `Capability` to the existing named-import list.)

- [ ] **Step 3: Add `updateOptions()` call inside `initPlayer`**

In `App.js`, find the `initPlayer` function. It currently looks like this:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.add(playlist);
```

Insert a new `updateOptions` call between `setupPlayer()` and `add(playlist)`:

```js
  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
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
```

Do not change any other line in `initPlayer`. The rest of the function (`setRepeatMode`, `loadImported`, `setImportedTracks`, `setIsPlayerInitialized`) stays exactly as-is.

- [ ] **Step 4: Verify the Metro bundle builds**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: output ends with `Done writing bundle output` and exits 0. The bundle file `/tmp/test-bundle.js` is created.

If the build fails with `Cannot find module 'Capability'` or similar, the import in Step 2 was not applied correctly — re-check that `Capability` is in the named-import list and that no other import line was accidentally broken.

If the build fails with a syntax error, re-check Step 3 — the `await TrackPlayer.updateOptions({...})` call must be inside the `try` block, before `await TrackPlayer.add(playlist);`, and the object literal must be properly closed with `})`.

- [ ] **Step 5: Commit**

```bash
git add App.js
git commit -m "Declare playback capabilities to enable lock screen controls"
```

Expected: one file changed, ~14 insertions (1 modified import line + ~13 lines for the `updateOptions` call).

---

### Task 3: Final verification — Metro bundle + manual simulator check

**Files:**
- No file changes. This task is verification only.

- [ ] **Step 1: Re-run the Metro bundle build on the full branch state**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: `Done writing bundle output`, exit 0. (Re-running catches any regression introduced between Task 2's commit and now.)

- [ ] **Step 2: Confirm both commits are present on the feature branch**

Run: `git log --oneline main..HEAD`

Expected: two commits, most-recent-first:
1. `Declare playback capabilities to enable lock screen controls`
2. `Add UIBackgroundModes audio entitlement for background playback`

Run: `git diff main..HEAD --stat`

Expected: exactly two files changed:
- `App.js` (~14 insertions)
- `ios/MP3Player/Info.plist` (~3 insertions)

If extra files appear, investigate before proceeding — they were not part of this plan.

- [ ] **Step 3: Hand off to user for manual simulator / device check**

The remaining verification is manual and must be done by the user (per the project's verification method — Claude cannot drive the iOS simulator). Provide this checklist to the user:

```
Manual verification checklist (user-driven):
1. Build and run on simulator or device: npx react-native run-ios
2. Open the app, tap a song, confirm it plays.
3. Lock the device (Cmd+L on simulator, or side button on real device).
   → Expected: audio continues playing.
4. Wake the screen — lock screen should show MP3Player card with:
   - title and artist
   - artwork thumbnail
   - play/pause button
   - skip-next / skip-previous buttons
   - read-only progress bar
5. Open Control Center (swipe down from top-right on devices with Face ID).
   → Expected: same MP3Player card with compact controls (play/pause + skip-next).
6. Tap pause from the lock screen — audio should pause. Tap play — should resume.
7. Tap skip-next — should advance to the next track.
8. (Optional) Test with an imported track from "我的音乐" tab — file:// URLs
   should behave the same as remote URLs.
```

If any step fails, capture the symptom (what was expected vs. what happened) and report back — do not commit fixes speculatively.

- [ ] **Step 4: Branch handoff**

Once manual verification passes, hand off to the finishing-a-development-branch skill to merge `feature/background-audio` back to main. Per the project's workflow preferences, the default is merge-to-main-locally with `--no-ff` (preserves branch history via merge commit). The finishing skill will confirm this choice with the user.

---

## Self-Review

**1. Spec coverage:**
- Spec §"Component Changes" → 1. Info.plist UIBackgroundModes: covered by Task 1. ✓
- Spec §"Component Changes" → 2. App.js updateOptions(): covered by Task 2. ✓
- Spec §"Component Changes" → 3. "No other file changes" / service.js / AppDelegate.mm untouched: enforced by Task 3 Step 2's `git diff --stat` check. ✓
- Spec §"Verification" → Metro bundle: covered by Task 2 Step 4 and Task 3 Step 1. ✓
- Spec §"Verification" → Manual simulator: covered by Task 3 Step 3. ✓
- Spec §"Out of Scope" items (seek, remote-duck, Android, artwork loading reliability): not implemented — correct, none of these have tasks. ✓

**2. Placeholder scan:**
- No "TBD", "TODO", "fill in details", "implement later", "appropriate error handling", or "similar to Task N" found.
- Every code step shows the exact code to write.
- Every command step shows the exact command and expected output.

**3. Type consistency:**
- `Capability` enum name matches across Task 2 Step 2 (import) and Step 3 (usage). ✓
- `updateOptions` is the correct method name on `TrackPlayer` in RNTP v4. ✓
- Capability values (`Play`, `Pause`, `Stop`, `SkipToNext`, `SkipToPrevious`) are the exact enum keys exported by RNTP v4.1.1. ✓
- `UIBackgroundModes` plist key and `audio` string value are the exact iOS-specified names. ✓

No issues found. Plan is ready for execution.
