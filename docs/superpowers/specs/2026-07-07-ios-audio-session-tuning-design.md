# iOS Audio Session Tuning — Design Spec

**Date:** 2026-07-07
**Scope:** Configure `react-native-track-player` `setupPlayer()` with iOS audio session parameters (category, mode, options) so audio routes optimally to Bluetooth A2DP, AirPlay, and the built-in speaker.

## Problem

`App.js` calls `await TrackPlayer.setupPlayer()` with no options. RNTP v4 defaults to `iosCategory: Playback`, which is correct, but does not set `iosCategoryMode` or `iosCategoryOptions`. The result:

- Bluetooth output may fall back to the HFP (hands-free) profile — mono, narrow-band — instead of A2DP (stereo, high bitrate). Muffled sound on Bluetooth headphones/speakers.
- AirPlay routing is not declared, so the AirPlay button may not appear in Control Center.
- On iPhone, audio may route to the earpiece instead of the bottom speaker, sounding thin and quiet.

User reports all three symptoms and selected "iOS 音频会话调优" as the optimization direction.

## Approach (chosen: A)

Three approaches were considered:

- **A. Minimal — pass iOS audio session parameters to `setupPlayer()`.** Single-point change in `App.js`. No native code, no new dependencies. **Chosen.**
- **B. A + `autoHandleInterruptions: true`.** Adds automatic pause/resume on phone-call or Siri interruption. Behavior change is broader than the requested scope. Rejected — separate concern, can be its own phase.
- **C. A + reactive reconfiguration on route change.** Listen for Bluetooth connect/disconnect, AirPlay switching, dynamically re-apply audio session. Over-engineering for this app. Rejected.

## Component Changes

### `App.js`

**Import (line 11) — add three enums:**

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

**`initPlayer()` (line 116) — pass options to `setupPlayer()`:**

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

### No other file changes

- `service.js` — remote-control event handlers unchanged.
- `ios/MP3Player/Info.plist` — `UIBackgroundModes: [audio]` already set by 2026-07-06 background-audio spec, unchanged.
- `ios/MP3Player/AppDelegate.mm` — no native code. RNTP v4 applies the iOS audio session config via SwiftAudioEx during `play()`.
- No new npm dependencies.

## Parameter Rationale

| Parameter | Value | Reason |
|---|---|---|
| `iosCategory` | `Playback` | Standard for music apps. RNTP default, declared explicitly. iOS treats this app as primary audio, stops other apps. |
| `iosCategoryMode` | `Default` | Full-range output, no signal processing. Other modes (`Movie`, `SpokenAudio`, `Measurement`) tailor the signal path for non-music use cases. |
| `iosCategoryOptions` | `AllowBluetoothA2DP` | Forces A2DP profile (stereo, 44.1/48 kHz) over HFP (mono, narrow-band). Fixes Bluetooth quality symptom. |
| | `AllowAirPlay` | Enables AirPlay output routing to HomePod / Apple TV / AirPlay 2 speakers. Fixes AirPlay symptom. |
| | `DefaultToSpeaker` | Routes to bottom speaker on iPhone instead of earpiece. Fixes speaker-output symptom. iPad unaffected (already speaker-only). |

**Options deliberately excluded:**

- `MixWithOthers` / `DuckOthers` — would let other apps' audio play alongside / under this app's music. Music apps should be exclusive.
- `AllowBluetooth` (without `A2DP`) — HFP only, low quality, not for music. Apple also disallows combining `AllowBluetooth` and `AllowBluetoothA2DP`.

## Behavior

### What the user will observe

- **Bluetooth headphones/speaker**: stereo, full-bandwidth A2DP output. Subjectively clearer highs, wider soundstage.
- **iPhone built-in speaker**: audio from the bottom speaker (not earpiece), fuller and louder.
- **AirPlay**: AirPlay button appears in Control Center during playback; can route to HomePod, Apple TV, AirPlay 2 third-party speakers.
- **Background playback**: unchanged. `UIBackgroundModes: [audio]` + lock-screen controls from the 2026-07-06 spec still work.
- **Lock-screen / Control Center controls**: unchanged. Now Playing metadata still published.

### What stays the same

- Imported local MP3s benefit from the same routing improvements.
- `playback-error` Alert flow (App.js:53-65) still fires if a route fails (e.g. Bluetooth disconnects mid-playback) and offers to skip to next track.

### Caveats

- iOS Simulator cannot validate Bluetooth, AirPlay, or speaker routing — these need real-device testing.
- A2DP has inherent ~100–200 ms latency; this is a protocol property, not a regression.

## Verification

Per the project's verification method (no automated tests; Metro bundle + manual iOS simulator):

1. **Metro bundle build** (Claude-executable):
   ```
   npx react-native bundle --platform ios --dev false \
     --entry-file index.js --bundle-output /tmp/test-bundle.js
   ```
   Verifies: imports resolve, no syntax errors, the three enums are exported by RNTP.

2. **Manual iOS simulator check** (user-executable):
   - Launch app, play any track, hear audio, no errors.
   - Lock screen, confirm background playback still works (regression check for 2026-07-06 spec).
   - Control Center: lock-screen controls display correctly.

3. **Real-device checklist** (user-executable, non-blocking):
   - Bluetooth headphones connected → play → confirm A2DP profile in Settings → Bluetooth → device details.
   - Unplug wired headphones → confirm audio from bottom speaker (not earpiece).
   - Control Center → AirPlay button tappable → route to HomePod / Apple TV if available.

**Not verification gates:**

- `npm test` — exits 1 with "No tests found", pre-existing.
- `npm run lint` — ESLint not configured, pre-existing.

## Risks

1. **`iosCategoryOptions` must be an array.** RNTP's TypeScript type requires `IOSCategoryOptions[]`. This project is plain JS (no TS type-checking at build time), so a single-value mistake would not be caught until runtime — the native layer may reject it or silently misbehave. Spec code uses the array form correctly.
2. **`AllowBluetooth` and `AllowBluetoothA2DP` are mutually exclusive** per Apple docs. Spec only enables A2DP, no conflict.
3. **`playback-error` flow unchanged.** Route failures (e.g. Bluetooth disconnect) still trigger the existing Alert at App.js:53-65 offering to skip to next track.
4. **Regression surface is minimal.** Only the `setupPlayer()` call form changes; call site, call order, and other options (`updateOptions`, `add`, `setRepeatMode`) are unchanged. Background audio, lock-screen controls, error handling paths all unaffected.

## Non-Goals

- Equalizer / audio effects (requires AVAudioEngine native module; separate phase).
- Volume normalization / gain boost (requires per-track loudness analysis).
- MP3 source bitrate upgrade (content change, not player change).
- Phone-call / Siri interruption auto-resume (scope of approach B; `autoHandleInterruptions`).
- Android audio session tuning (project is iOS-only, no Android build verification).
- Reactive route-change reconfiguration (scope of approach C; over-engineering).

## References

- Apple: [AVAudioSession.CategoryOptions](https://developer.apple.com/documentation/avfoundation/avaudiosession/1616503-categoryoptions)
- Apple: [AVAudioSession.Mode](https://developer.apple.com/documentation/avfoundation/avaudiosession/1616508-mode)
- `react-native-track-player` v4.1.1 `PlayerOptions` interface: `node_modules/react-native-track-player/lib/src/interfaces/PlayerOptions.d.ts`
- Prior phase specs in `docs/superpowers/specs/` — particularly `2026-07-06-background-audio-design.md` (sets the `UIBackgroundModes` entitlement this spec builds on).
