# Pixel Fox Racing Mobile Mode Plan

Mobile mode should be a focused racing experience, not a compressed copy of the desktop UI. Three.js can run on modern phones, but the mobile version needs its own input surface, simplified HUD, landscape-first layout, and aggressive render budgets.

The goal is to support browser-based mobile racing first. Native app packaging can come later if the browser version proves the controls, performance, and layout.

## Core Position

Three.js is not the blocker. Scene budget is the blocker.

The current game should be expected to struggle on phones at desktop medium/high settings because mobile browsers are sensitive to:

- Retina/high-DPR rendering.
- Dynamic shadows.
- Dense scenery, stadiums, particles, and remote vehicles.
- Long sessions that trigger thermal throttling.
- iOS Safari fullscreen, audio unlock, and orientation limits.

Mobile mode should reuse the existing racing logic wherever possible. It should not fork car physics or create separate mobile-only vehicle behavior unless a real handling problem is measured.

## Scope: Which Canvas Gets Mobile Mode

The suite has three separate `<Canvas>` mounts, and they are not equally ready:

- `frontend/src/racing/components/CarTrackWorldShell.tsx` and `CarTrackShowroomShell.tsx` — already accept `canvasQuality` (dpr, shadows) from the preset system. This is the mobile target.
- `frontend/src/components/foxracingaspen/FoxRacingWorld.tsx` — hardcodes `shadows` and camera props directly on its Canvases; not preset-driven.
- `frontend/src/components/snowmobilerace/SnowmobileWorld.tsx` — same, and it is a ~2600-line monolith.

Mobile mode should ship for the car track suite only. FoxRacingWorld and SnowmobileWorld would each need to be threaded through the quality preset system before mobile is even measurable there — treat that as separate refactoring work, not part of this plan. On mobile, the other experiences can show a "best on desktop" notice rather than silently running at desktop budgets.

One more scene-budget note: the scenery is procedural (instanced trees, `SampledTerrainMesh`, `DistantMountains`, billboard stadium foxes) rather than downloaded GLTF, so mobile's problem is not asset transfer — it is geometry generation time at track load and per-frame draw calls. Expect the first-load stall to be more noticeable on phones; if it exceeds a couple of seconds, chunk the scenery generation across frames behind the existing loading overlay rather than blocking.

## Product Shape

Mobile racing should prioritize:

- Landscape gameplay.
- Fullscreen canvas after a user tap.
- Four large touch controls: left, right, gas, brake.
- Minimal racing HUD.
- Collapsed or hidden desktop panels during live racing.
- A lightweight showroom with only the primary choices visible first.

Desktop should keep the richer panels, keyboard hints, chat, camera tools, and larger stats surfaces.

## Device Detection

Use feature detection first, user-agent fallback only where needed.

Create a shared hook such as `useRacingDeviceProfile()` under `frontend/src/racing/platform` or `frontend/src/racing/components`.

It should expose:

```ts
interface RacingDeviceProfile {
  isTouchDevice: boolean
  isCoarsePointer: boolean
  isSmallViewport: boolean
  isLandscape: boolean
  prefersMobileRacingUi: boolean
}
```

Detection inputs:

- `window.matchMedia('(pointer: coarse)')`
- `window.matchMedia('(hover: none)')`
- `navigator.maxTouchPoints > 0` (catches iPadOS Safari, which masquerades as macOS in its user agent)
- viewport width and height
- orientation derived from dimensions
- optional iOS/Android fallback for fullscreen/orientation quirks

Subscribe to the media queries and to `resize`/`orientationchange` rather than sampling once — foldables and rotation change these mid-session, and the rotate overlay depends on live values.

Do not rely only on screen width. Tablets, foldables, and desktop touchscreens need sensible behavior.

## Input Architecture

Mobile controls should write to the same key-state map used by keyboard controls.

Existing car controls read these keys:

- Gas: `KeyW`, `ArrowUp`, `KeyG`
- Brake: `KeyS`, `ArrowDown`
- Left: `KeyA`, `ArrowLeft`
- Right: `KeyD`, `ArrowRight`

Add a touch input layer that sets those same keys on pointer down/up:

- left button sets `ArrowLeft`
- right button sets `ArrowRight`
- gas button sets `KeyW`
- brake button sets `KeyS`

This keeps keyboard and mobile input compatible with the existing car handling code.

**Key insight from the current code:** writing to `keys.current` directly is not enough. `useCarKeyboardControls` couples gas audio start/stop, `preventDefault`, and the headlight toggle to its `window`-level `keydown`/`keyup` handlers — a touch layer that only flips the key map would drive the car silently. Two viable wirings:

1. **Synthetic events (spike only):** have the touch buttons dispatch `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))` and the matching `keyup`. The existing handlers read `event.code` and listen on `window`, so gas audio, key-state, and status gating all work unchanged. The `isEditableKeyboardTarget` guard passes because the target is not an input.
2. **Shared handler extraction (production):** pull the press/release logic out of `useCarKeyboardControls` into `pressCarControl(code)` / `releaseCarControl(code)` functions that both the keyboard hook and `MobileDrivingControls` call.

Synthetic events are for the performance spike only — they let the spike ship with zero changes to existing code. They are not the final architecture: synthetic `KeyboardEvent`s are conceptually indirect (touch pretending to be a keyboard), some event fields behave inconsistently across browsers, and any future listener that checks `event.isTrusted` would silently ignore them. Before mobile controls merge for real users, extract the shared press/release handlers and have both input paths call them directly.

Implementation direction:

1. Add a reusable `MobileDrivingControls` component.
2. Thread the vehicle `keys` ref or an input adapter into the race overlay boundary.
3. Use `pointerdown`, `pointerup`, `pointercancel`, and `lostpointercapture`, and call `setPointerCapture` on down so a finger sliding off a button still releases it.
4. Prevent page scroll/zoom gestures on the control surface: `touch-action: none` on the buttons, `overscroll-behavior: none` on the race container, and suppress the iOS long-press callout (`-webkit-touch-callout: none`) and text selection.
5. Support multi-touch from the start — steering with one thumb while holding gas with the other is the core gesture. Track pointers by `pointerId`; never assume one active pointer.
6. Preserve gas audio start/stop behavior when touch gas is pressed/released (free with the synthetic-event approach).
7. Keep the drei `OrbitControls` in `CarTrackWorldShell` disabled on mobile during racing so its touch handlers never compete with the driving buttons.

Avoid adding separate mobile physics. If touch steering feels poor, tune steering smoothing or control layout after testing. Buttons are binary just like keys, so handling will match keyboard behavior exactly — that is a feature for fairness in multiplayer, not a limitation to fix.

## Fullscreen And Orientation

Treat landscape as required for real racing.

Browser limitations:

- Android Chrome can usually request fullscreen and sometimes orientation lock after a user gesture (`screen.orientation.lock('landscape')` only works while fullscreen).
- iOS Safari does not implement `Element.requestFullscreen` for arbitrary elements at all — the current `useFullscreenToggle` will land in its `.catch` on every iPhone. It needs a CSS "fake fullscreen" fallback: pin the race container `position: fixed; inset: 0; height: 100dvh` and hide the surrounding page. iPadOS supports the prefixed `webkitRequestFullscreen`, so try prefixed APIs before falling back.
- Orientation lock should be best-effort, not a hard dependency.

Recommended flow:

1. On mobile showroom or race entry, show a compact "Enter fullscreen" action.
2. Request fullscreen from the user tap using the existing fullscreen helper.
3. If the device is portrait, show a rotate-device overlay above the game.
4. Use CSS viewport units that behave on mobile browsers, especially `100dvh`. `racingGameViewport.ts` currently sizes the race view with `80vh`/`90vh`/`100vh` plus a `900px` max-height — on mobile Safari, `vh` includes the retracted address bar, so the HUD's bottom edge ends up under browser chrome. Mobile should use `dvh` and drop the max-height clamp.
5. Do not start live racing controls under a portrait overlay unless explicitly allowed later.
6. Set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` and pad HUD/touch controls with `env(safe-area-inset-*)` so the notch and home-indicator bar never cover the gas button in landscape.

The app should encourage landscape rather than pretending it can reliably force it everywhere.

## Mobile Quality Preset

Add a dedicated `mobile` quality preset instead of silently mapping phones to `low`.

Suggested first budget:

```ts
mobile: {
  renderer: {
    pixelRatioCap: 1,
    shadows: false
  },
  remotePlayers: {
    renderDistance: 120,
    maxVisible: 4
  },
  minimap: {
    updateEveryFrames: 6
  },
  scenery: {
    densityScale: 0.35,
    detailDistanceScale: 0.45
  }
}
```

Adding the preset touches more than the presets table. Concrete wiring in `qualitySettings.ts` and friends:

- Extend the `RacingQualityPresetId` union (`'low' | 'medium' | 'high'`) with `'mobile'`.
- Update `resolveRacingQualityPresetId`, which string-matches the three existing ids when reading localStorage — otherwise a stored `'mobile'` silently resolves back to `'medium'`.
- Update `getRacingCanvasQualitySettings`, where antialias is currently `preset.id !== 'low'` — replace with an explicit `antialias` flag on the preset rather than growing the id comparison.
- Add the option to `RacingQualitySelector` so mobile users can override upward.
- Auto-selection belongs in `useRacingQualitySetting`: on first run (no `pixelFoxRacing.qualityPreset` key in localStorage) with a coarse-pointer profile, default to `mobile` instead of `medium`. An existing stored choice always wins.

Two renderer-level additions worth making at the same time:

- Pass `gl={{ powerPreference: 'high-performance' }}` on the mobile Canvas so phones with dual GPUs pick the fast one.
- Consider a shorter camera far plane on mobile (the race camera currently uses `far: 10000`) paired with fog, so distant scenery can be culled instead of drawn tiny. This is the cheapest triangle win available and needs no art changes.

Also reduce or disable on mobile:

- Antialiasing.
- Showroom spotlights/shadows.
- Weather particles.
- Lava/smoke/ember density.
- Stadium fox/crowd density.
- Far scenery detail.
- Remote vehicle detail and count.

Mobile should auto-select this preset for first-time mobile users, but players should still be able to override it.

## Audio On Mobile

The audio layer (`audioElements.ts`, `carGasAudio.ts`) is built on `HTMLAudioElement`, and iOS Safari has specific behavior that will bite:

- **Volume is ignored on iOS.** Setting `audioElement.volume` is a no-op on iPhone — `createPreloadedAudio`'s volume option and the idle-audio `volume = 0.4` will play at full volume. If mixing matters, the fix is routing through Web Audio (`MediaElementAudioSourceNode` + `GainNode`); if not, accept full volume on iOS and note it.
- **Unlock requires a gesture per element.** Autoplay policy blocks `play()` until a user gesture, and iOS historically tracks this per media element. Add a one-time unlock on the first touch (fullscreen tap or race start): call `play()` then immediately `pause()` on each preloaded element so later programmatic starts (countdown, gas, crash) succeed. The touch-gas path via synthetic key events counts as a gesture-initiated start, which helps.
- **The idle-loop workaround gets throttled.** `useLoopingIdleAudio` loops by polling `currentTime` on a 50ms `setInterval`; mobile browsers throttle timers aggressively when the tab loses focus or the screen dims, so the loop can stall. Prefer the element's native `loop = true` on mobile, or move the loop check into the render loop.
- **Fewer simultaneous elements.** Mobile Safari handles many concurrent `HTMLAudioElement`s poorly. During mobile racing, keep gas plus at most one or two effect channels; skip ambient layers.

## Lifecycle And WebGL Context Loss

There is currently no `visibilitychange` or `webglcontextlost` handling in the frontend, and mobile makes both routine rather than exceptional:

- **Backgrounding is constant on phones** — incoming calls, notification pulls, app switches. On `visibilitychange` → hidden, pause gas/idle audio and release all pressed touch keys (the browser will not deliver the `pointerup` you were waiting for). On return, resync from actual pointer state instead of resuming stale keys. Multiplayer position batching (`useBatchedPlayerPositionUpdates`, 30ms) keeps running in a hidden tab at throttled-timer cadence; decide whether a hidden racer should keep transmitting or be treated as paused.
- **Mobile GPUs drop WebGL contexts under memory pressure.** Listen for `webglcontextlost` (call `preventDefault` to allow restore) and `webglcontextrestored` on the canvas. R3F recreates GPU resources on restore, but the game should show a brief "restoring" state rather than a frozen frame, and a lost context during a live multiplayer race needs a defined outcome (rejoin as spectator, or resume at server-authoritative position).
- **Thermal throttling is gradual, not an event.** A phone that starts at 55 FPS can sink to 20 after ten minutes. The FPS counter path (`RacingFpsCounter`) already measures frame timing — reuse that signal for a simple adaptive rule: if average FPS stays below ~24 for 10+ seconds, drop pixel ratio toward 0.75 and cut scenery density another notch. Do not change physics timing, only render cost.

## Battery And Network

- The 30ms position batch interval is fine for gameplay but keeps the radio hot. If battery drain is measured to be a problem, 50–60ms on mobile is a safe first lever — remote interpolation already smooths gaps.
- Socket reconnect matters more on mobile: phones hop between Wi-Fi and cellular mid-race. Verify the socket client's reconnect behavior during the spike by toggling airplane mode for two seconds mid-race and observing recovery.

## Wallet Support On Mobile

Wallet availability changes on mobile, and the connect UI must reflect it (`frontend/src/wallet/walletProviders.ts`):

- **Yours Wallet** connects over the `window.CWI` extension substrate. Browser extensions do not exist on mobile browsers, so Yours is **desktop only** for now. On the mobile device profile, hide or disable the Yours option with a short "desktop only" note — the current retry loop (`WALLET_AUTH_MAX_ATTEMPTS = 6` at 1s intervals) would otherwise spin for ~6 seconds against an extension that can never appear.
- **Metanet** uses the `json-api` substrate and works when the game is opened **inside the Metanet mobile browser**, not in stock Safari/Chrome.
- **SHUAllet** is an in-page wallet (`public/SHUAllet.js`, keys in browser storage), so it works in any mobile browser and is the default mobile wallet path.

Practical consequences:

- A player in stock mobile Safari/Chrome effectively has one option: SHUAllet. The mobile connect flow should lead with it rather than presenting a three-way choice where two options fail.
- Detecting the Metanet browser (user agent / injected API check) is worth a small helper so Metanet can be offered exactly where it works.
- Wallet-gated flows (collectible pickups, transaction panels) should be verified on mobile against SHUAllet specifically during the spike, since that is what most mobile players will actually use.

## Racing UI Changes

During `countdown` and `racing` on mobile:

- Show touch controls.
- Hide `RacingControlsHelper`.
- Shrink `RacingHudMetrics`.
- Collapse chat, scheduled race panels, player panels, and transaction/status detail.
- Keep only critical status: lap/time/speed/countdown.
- Move fullscreen and pause/exit to compact icon buttons.
- Include an always-reachable escape hatch: a compact menu (single icon button, top corner, safe-area padded) with **Back to showroom**, **Switch track**, and **Exit race**. On desktop these live in the surrounding page; on mobile fullscreen there is no surrounding page, so without this the player is trapped in the race. Route "switch track" back through the showroom track selector rather than building a second track picker.
- Avoid manual camera controls by default.

Desktop camera orbit buttons are not important while racing on phone. Keep follow camera as the default mobile camera mode.

## Showroom UI Changes

**Current state: the showroom is not responsive, and fixing that helps desktop too.** The showroom/race chrome in `frontend/src/components/racing/RacingUI.tsx` (and the per-track `FoxRacingWorld` shells that reuse the same pattern) is built from inline-styled, absolutely-positioned panels with fixed pixel offsets — `top: 220, left: 10`, `width: '166px'`, and similar — and there is not a single `@media` query or layout breakpoint anywhere under `frontend/src/racing`. Panels overlap and clip at narrow widths today, on any device.

So treat responsive showroom layout as a shared prerequisite, not a mobile-only feature:

1. First pass (benefits desktop immediately): replace fixed pixel offsets with a real layout — a flex/grid frame around the canvas with panels that wrap and scroll, sized in relative units with sensible min/max widths. Small desktop windows stop breaking at the same time phones do.
2. Second pass (mobile-specific): on the coarse-pointer profile, collapse secondary panels behind expandable sections and reorder for the priorities below.

This ordering matters: if the mobile showroom is built as a separate layout while the desktop one stays absolutely-positioned, every future panel gets implemented twice. One responsive layout with a mobile collapse tier is cheaper than two layouts.

Mobile showroom should become a simple setup surface.

First screen priorities:

- Selected vehicle/fox preview.
- Start/race action.
- Track selection.
- Color/vehicle customization.
- Quality/performance setting.

Secondary or collapsed:

- Full stats strip.
- Scheduled race details.
- Wallet detail.
- Chat.
- Long explanations or dense tables.

The showroom canvas should use the same mobile quality budget. Expensive lighting should be scaled down because showroom performance affects first impressions.

## Performance Spike

Before building the full mobile UI, run a mobile performance spike.

Spike scope:

1. Add a temporary mobile preset.
2. Auto-select it on coarse pointer devices.
3. Test the heaviest track in mobile landscape.
4. Capture approximate FPS, renderer draw calls, triangles, and memory if available. `RacingFpsCounter` already exists for FPS; draw calls and triangles come free from the R3F `gl.info.render` object — surface them in the same debug overlay for the spike.
5. Test on at least one iPhone Safari and one Android Chrome device. Vite dev already binds `0.0.0.0:5173`, so phones on the same network can hit the dev server directly; use Safari's remote Web Inspector (Mac + cable) and `chrome://inspect` for on-device consoles. For iOS without a Mac, a temporary on-screen error overlay (or eruda) is the pragmatic fallback.
6. While in there, run the two resilience checks: toggle airplane mode for two seconds mid-race (socket recovery) and background/foreground the tab (audio, touch keys, and timers recover).

Pass condition:

- Stable enough for playable racing around 30 FPS on a current phone.
- No severe input latency.
- No immediate thermal collapse in a short race.
- No broken audio start from touch gas.
- No layout overlap in landscape.

If this fails, reduce scene budgets before investing in polished UI.

## Implementation Sequence

1. Add `useRacingDeviceProfile`.
2. Add a `mobile` quality preset (union type, resolver, canvas settings, selector UI) and first-entry auto-selection.
3. Make the racing viewport use mobile-safe height rules (`dvh`, safe-area insets, drop the `900px` clamp).
4. Add the iOS fake-fullscreen fallback to `useFullscreenToggle` and a portrait/rotate overlay.
5. Add `MobileDrivingControls` wired via synthetic keyboard events into the existing key-state path (spike only).
6. Verify touch gas audio start/stop and add the one-time mobile audio unlock.
6b. Before production merge: extract shared `pressCarControl`/`releaseCarControl` handlers from `useCarKeyboardControls` and switch `MobileDrivingControls` off synthetic events.
7. Add mobile HUD layout rules, including the escape-hatch menu (back to showroom / switch track / exit race).
8. Hide or collapse desktop-only panels during mobile racing.
9. Make the showroom layout responsive (shared desktop + mobile benefit), then add the mobile collapse tier.
10. Add lifecycle handling: `visibilitychange` key/audio release, `webglcontextlost` recovery state.
11. Run real-device performance tests and tune budgets; add the adaptive FPS downgrade only if thermals demand it.

## Files Likely To Change

Likely shared files:

- `frontend/src/racing/performance/qualitySettings.ts`
- `frontend/src/racing/performance/useRacingQualitySetting.ts` (first-run mobile auto-selection)
- `frontend/src/racing/components/RacingQualitySelector.tsx` (expose the mobile option)
- `frontend/src/racing/components/useFullscreenToggle.ts` (iOS fallback)
- `frontend/src/racing/components/racingGameViewport.ts` (`dvh`, clamp removal)
- `frontend/src/racing/components/audioElements.ts` (unlock, native loop on mobile)
- `frontend/src/racing/components/RacingHudMetrics.tsx`
- `frontend/src/racing/components/RacingControlsHelper.tsx`
- `frontend/src/racing/components/RacingCameraControlButtons.tsx`
- `frontend/src/racing/components/CarTrackShowroomShell.tsx`
- `frontend/src/racing/components/CarTrackWorldShell.tsx` (powerPreference, context-loss listeners)
- `frontend/src/components/racing/RacingUI.tsx` (responsive layout pass, escape-hatch menu)

Likely new files:

- `frontend/src/racing/platform/useRacingDeviceProfile.ts`
- `frontend/src/racing/components/MobileDrivingControls.tsx`
- `frontend/src/racing/components/MobileOrientationOverlay.tsx`
- `frontend/src/racing/components/MobileRaceMenu.tsx` (back to showroom / switch track / exit)

Vehicle integration points:

- `frontend/src/racing/vehicles/useCarKeyboardControls.ts`
- car `FreeRoamCar` implementations that own the `keys` ref
- snowmobile controls later, after car mobile mode proves out

## Open Questions

- Should mobile support scheduled multiplayer races at launch, or start with solo/time-trial racing?
- Should chat be fully disabled during mobile races or available through a paused/collapsed panel?
- Should mobile default to cars only before snowmobile controls are adapted?
- Should mobile showroom force the mobile preset or only recommend it?
- Should touch steering be button-based first, or should tilt/virtual wheel be explored later?

## Recommendation

Start with car racing only, landscape only, mobile quality only, and button controls only.

That scope is small enough to validate the hard parts: Three.js performance, touch latency, fullscreen/orientation behavior, HUD density, and input correctness. Once that works, snowmobile controls, richer mobile showroom flows, and optional multiplayer polish can follow.
