# Background Audio — Design Spec

**Date:** 2026-07-06
**Scope:** Allow audio to continue playing after the screen locks, with lock screen + Control Center controls.

## Problem

When the screen locks, iOS suspends the app and audio stops within a second or two. The user wants audio to continue playing, with lock screen controls (play/pause, skip, artwork, read-only progress bar).

## Root Cause

Two gaps in the current setup:

1. **Missing iOS entitlement.** `ios/MP3Player/Info.plist` does not declare `UIBackgroundModes: [audio]`. Without this key, iOS does not permit background audio and suspends the app on lock.
2. **`TrackPlayer.updateOptions()` is never called.** Without this call, `react-native-track-player` does not declare remote-control capabilities to iOS, so the lock screen / Control Center controls do not appear, and Now Playing metadata is not published to `MPNowPlayingInfoCenter`.

The existing infrastructure is otherwise complete:
- `service.js` already registers `remote-play`, `remote-pause`, `remote-stop`, `remote-next`, `remote-previous` handlers.
- Track objects already include `title`, `artist`, and `artwork` fields — RNTP reads these automatically for Now Playing info.
- RNTP v4 sets the `AVAudioSession` category to `Playback` during `setupPlayer()`, so no native audio session code is needed.

## Approach (chosen: A)

Three approaches were considered:

- **A. Minimal — Info.plist + `updateOptions()`.** No native code, no `service.js` changes. Matches the chosen lock-screen-controls scope. **Chosen.**
- **B. A + explicit native audio session setup.** More code, no real benefit since RNTP v4 handles the audio session category. Rejected.
- **C. A + seek capability.** Adds `Capability.SeekTo` and `remote-seek` handler so the lock screen progress bar is draggable. Rejected as over-scope — user chose "lock screen controls" not "full".

## Component Changes

### 1. `ios/MP3Player/Info.plist`

Add the background audio entitlement to the top-level `<dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

This is the only entitlement required. On modern Xcode (13+), the Info.plist key alone is sufficient — the "Signing & Capabilities" → "Background Modes" UI in Xcode edits this same key, no separate capability file is needed.

### 2. `App.js` — `initPlayer()`

Add `Capability` to the existing `react-native-track-player` import, and call `updateOptions()` after `setupPlayer()`:

```js
import TrackPlayer, { Capability } from "react-native-track-player";

// inside initPlayer(), after TrackPlayer.setupPlayer():
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
```

`updateOptions()` can be called any time after `setupPlayer()`. Placing it immediately after keeps all player configuration in one location.

### 3. No other file changes

- `service.js` — already has the remote-event handlers for the declared capabilities.
- `AppDelegate.mm` — RNTP v4 sets the audio session category to `Playback` during `setupPlayer()`, no native code needed.
- No new npm dependencies.

## Behavior

### What the user will see

- Screen locks → audio continues playing.
- Lock screen and Control Center show: title, artist, artwork, play/pause button, skip-next/previous buttons, and a read-only progress bar.
- Headphone buttons and Bluetooth media controls work (already wired via `service.js`).

### What won't change

- Foreground app behavior is unchanged.
- Playback state, queue, and metadata logic are unchanged.
- Imported tracks (file:// URLs) work the same as remote URLs under background audio mode — no special handling needed.

## Verification

Per the project's verification method (no automated tests):

1. **Metro bundle build** — `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` — catches import errors (especially the new `Capability` import) and syntax issues.
2. **Manual iOS simulator / device check** by the user:
   - Play a song, lock the simulator (`Cmd+L`), confirm audio continues.
   - Open Control Center, confirm MP3Player card shows title / artist / artwork + controls.
   - Tap pause / skip from the lock screen, confirm the app responds.
   - Real-device test is the most reliable confirmation — the simulator's audio session behavior with lock screen can be flaky.

## Out of Scope

- Draggable seek bar on the lock screen (Approach C, deferred).
- Audio interruption handling (`remote-duck`) — RNTP v4 pauses on interruption by default; automatic resumption after interruption is not configured. Matches the chosen scope.
- Background artwork loading reliability for remote URLs on poor networks (RNTP handles artwork loading; if this proves flaky it is a follow-up).
- Android background playback — the project is iOS-only at this time.
