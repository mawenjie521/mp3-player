# iOS Audio Session Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure `react-native-track-player` `setupPlayer()` with iOS audio session parameters so audio routes optimally to Bluetooth A2DP, AirPlay, and the built-in speaker.

**Architecture:** Single-point edit to `App.js` — extend the existing `react-native-track-player` import with three iOS enum exports (`IOSCategory`, `IOSCategoryMode`, `IOSCategoryOptions`), and pass an options object to the existing `TrackPlayer.setupPlayer()` call inside `initPlayer()`. No native code, no new dependencies, no other files touched.

**Tech Stack:** React Native 0.75.4, react-native-track-player 4.1.1, iOS-only (no Android build verification).

## Global Constraints

- Project has **no automated tests** — verification is Metro bundle build + manual iOS simulator. Do NOT run `npm test` as a gate (exits 1 with "No tests found", pre-existing).
- ESLint is not configured — do NOT run `npm run lint` as a gate.
- iOS audio session config is applied by RNTP during `play()`, not during `setupPlayer()`. The options passed to `setupPlayer()` are stored and applied on the first `play()` call.
- `iosCategoryOptions` must be an **array**, not a single value. Project is plain JS (no TS type-checking at build time).
- `AllowBluetooth` and `AllowBluetoothA2DP` are mutually exclusive per Apple docs — never combine them.
- Do NOT modify `service.js`, `ios/MP3Player/Info.plist`, `ios/MP3Player/AppDelegate.mm`, or any other file. The change is `App.js` only.
- Background audio (`UIBackgroundModes: [audio]`) and lock-screen controls were implemented in the 2026-07-06 spec — this change must not regress them.

---

### Task 1: Configure iOS audio session parameters in setupPlayer()

**Files:**
- Modify: `App.js:11` (import statement)
- Modify: `App.js:116` (`setupPlayer()` call inside `initPlayer()`)

**Interfaces:**
- Consumes: `IOSCategory`, `IOSCategoryMode`, `IOSCategoryOptions` enums exported by `react-native-track-player` v4.1.1 (defined in `node_modules/react-native-track-player/lib/src/constants/IOSCategory*.js`)
- Produces: an `App.js` whose `initPlayer()` passes a full iOS audio session config to `setupPlayer()`. No other module consumes this — the config is internal to `initPlayer()`.

**Why one task:** The import extension and the `setupPlayer()` call are coupled — using `IOSCategory.Playback` without importing `IOSCategory` would break the bundle. They must land in the same commit. Splitting would create an intermediate state that fails Metro bundle.

- [ ] **Step 1: Extend the `react-native-track-player` import**

Open `App.js`. Find line 11:

```js
import TrackPlayer, { usePlaybackState, State, useProgress, Capability } from "react-native-track-player";
```

Replace with:

```js
import TrackPlayer, {
  usePlaybackState,
  State,
  useProgress,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from "react-native-track-player";
```

- [ ] **Step 2: Pass iOS audio session options to `setupPlayer()`**

In the same file, find the `initPlayer` function. The current call (around line 116) is:

```js
      await TrackPlayer.setupPlayer();
```

Replace with:

```js
      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.DefaultToSpeaker,
        ],
      });
```

Leave the rest of `initPlayer()` unchanged — `updateOptions()`, `add(playlist)`, `setRepeatMode()`, `loadImported()`, `setIsPlayerInitialized(true)` all stay in their current order.

- [ ] **Step 3: Run Metro bundle build to verify no import/syntax errors**

Run:
```
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: command exits 0, prints something like "Writing bundle output to: /tmp/test-bundle.js" followed by "Done writing bundle output". No "Unable to resolve" errors, no "cannot find name 'IOSCategory'" errors.

If the build fails with "Unable to resolve module `IOSCategory`" or similar, the import in step 1 is wrong — verify the enum names against `node_modules/react-native-track-player/lib/src/constants/index.js`.

If the build fails with a syntax error around the `setupPlayer()` call, verify the object literal syntax (trailing comma after `DefaultToSpeaker` is fine; missing comma between options is not).

- [ ] **Step 4: Verify the change is in place**

Run:
```
grep -n "IOSCategory" App.js
```

Expected output (6 lines):
```
11:  IOSCategory,
13:  IOSCategoryOptions,
17:        iosCategory: IOSCategory.Playback,
18:        iosCategoryMode: IOSCategoryMode.Default,
19:        iosCategoryOptions: [
20:          IOSCategoryOptions.AllowBluetoothA2DP,
21:          IOSCategoryOptions.AllowAirPlay,
22:          IOSCategoryOptions.DefaultToSpeaker,
```

(Line numbers are approximate — the import block is multi-line now, so `IOSCategory` appears around line 14, `IOSCategoryMode` around line 15, `IOSCategoryOptions` around line 16. The exact line numbers don't matter; what matters is that all three enums appear in the import AND in the `setupPlayer()` call.)

- [ ] **Step 5: Commit**

Run:
```
git add App.js
git commit -m "$(cat <<'EOF'
Configure iOS audio session for A2DP, AirPlay, speaker routing

Pass iosCategory/iosCategoryMode/iosCategoryOptions to setupPlayer() so
iOS routes audio to Bluetooth A2DP (stereo), enables AirPlay output,
and defaults to the bottom speaker on iPhone instead of the earpiece.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit created, `git status` shows clean working tree.

- [ ] **Step 6: Hand off to user for manual iOS simulator check**

This step is user-driven, not Claude-executable. Inform the user:

> Implementation complete and committed. To verify on the iOS simulator:
> 1. `npx react-native run-ios` (or open `ios/MP3Player.xcworkspace` in Xcode and run)
> 2. Launch app, play any track, confirm audio plays with no errors.
> 3. Lock the simulator (Cmd+L) — confirm audio continues (regression check for background audio).
> 4. Open Control Center — confirm play/pause/skip controls display.
>
> Real-device checks (non-blocking, can't be done on simulator):
> - Bluetooth headphones → confirm A2DP routing in Settings → Bluetooth → device details.
> - Unplug wired headphones → confirm audio from bottom speaker (not earpiece).
> - Control Center → AirPlay button tappable → route to HomePod/Apple TV if available.

---

## Self-Review

**Spec coverage:**
- §Component Changes → App.js import extension: Task 1 Step 1 ✓
- §Component Changes → App.js setupPlayer options: Task 1 Step 2 ✓
- §Component Changes → "No other file changes": Global Constraints + Task 1 file list (only App.js) ✓
- §Parameter Rationale (the three options + exclusions): Task 1 Step 2 code matches spec exactly ✓
- §Verification → Metro bundle: Task 1 Step 3 ✓
- §Verification → Manual simulator: Task 1 Step 6 ✓
- §Verification → Real-device checklist: Task 1 Step 6 (handoff message) ✓
- §Risks (array form, A2DP vs Bluetooth exclusivity): Global Constraints ✓
- §Non-Goals: covered by absence — no EQ, no source change, no Android, no autoHandleInterruptions, no reactive routing in any task ✓

**Placeholder scan:** No "TBD", "TODO", "implement later", or "appropriate error handling" patterns. Every step has exact code or exact commands. ✓

**Type/name consistency:** Enum names (`IOSCategory`, `IOSCategoryMode`, `IOSCategoryOptions`) and their members (`Playback`, `Default`, `AllowBluetoothA2DP`, `AllowAirPlay`, `DefaultToSpeaker`) match between the spec, the import, and the `setupPlayer()` call. Verified against `node_modules/react-native-track-player/lib/src/constants/IOSCategory*.js` during brainstorming. ✓

**Scope check:** Single task, single file, single function. No sub-projects. ✓
