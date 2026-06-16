# Pixel Fox Racing Refactor Plan

Pixel Fox Racing currently works, but the frontend grew one track at a time. Australia, San Luis, Belgium, Aspen, United Kingdom, and Germany share a lot of ideas while still keeping too much game state, track data, world rendering, minimaps, vehicles, lap timing, start gates, CSS, and UI in track-era folders. Some folder and module names still reflect older implementation or provenance names, but public track display names now use country-themed names.

This document is the practical refactor plan. `PLAN.md` remains the broad product roadmap. This file focuses on making the current playable tracks easier to understand, improve, test, and ship on more platforms.

Pixel Racing Classic can live on separately as the original pre-refactor code and feel. The refactor does not need to preserve every subtle handling quirk from the sequentially built tracks. The open-source Pixel Fox Racing version is the prompt anyone can build on: it should keep the same personality, but the new foundation can become deeper, better-looking, easier to maintain, and eventually hardly recognizable from the classic version.

## Refactor Goals

- Keep the current playable tracks recognizable while reducing duplicated game code.
- Make track differences data-driven where possible, especially start gate position, racing direction, surface, scenery, vehicle type, collectibles, minimap, and lap rules.
- Establish one shared car behavior model for all car tracks. Australia, San Luis, and Belgium may have different widths, scenery, terrain, and layouts, but car acceleration, braking, steering, drift/grip, camera response, reset behavior, and lap-crossing rules should come from one car system.
- Keep snowmobile behavior separate from car behavior because Aspen/snowmobile play is intentionally different.
- Keep the first refactor focused on car-track convergence, Aspen/snowmobile containment, and the imported-track pipeline. New tracks should become easier, but the existing tracks still need to look and feel excellent.
- Split large components into small systems with clear ownership so humans and coding agents can change one behavior without touching every track folder.
- Keep forkability: branded assets, wallet metadata, tracks, servers, and platform builds should be configurable without rewriting core racing code.
- Treat React Three Fiber / Three.js as the current renderer, while keeping the core game rules and data portable enough for future platforms, engines, or languages.
- Improve confidence before mobile, iPhone, Android, Steam, or other packaged releases.

## Architecture Principles

React Three Fiber and Three.js can support a polished browser racing game, especially with disciplined asset, render-loop, and state management. The refactor should still avoid coupling the whole game to React components. The long-term goal is a solid game foundation that can be optimized in the browser now and reused or ported later.

Use this split as a guide:

- Simulation: lap timing, gate crossing, race state, vehicle state, collision rules, scoring, AI or ghost rules, and terrain queries.
- Track data: curves, widths, start direction, terrain metadata, scenery presets, attribution, and validation rules.
- Rendering: Three.js meshes, materials, particles, shadows, post-processing, instancing, and level-of-detail.
- UI: React menus, HUD, settings, wallet flows, stats, and transaction status.
- Platform: browser input, touch controls, controller support, storage, graphics settings, service URLs, wallet/auth adapters, and packaging concerns.
- Assets: portable manifests for models, textures, sounds, fonts, and track-specific scenery.

Core racing logic should be written as pure TypeScript where practical. React components should orchestrate and render that state, not own the only copy of the rules. If the project later moves deeper into native mobile, desktop, Steam-style packaging, or a different engine, the core concepts should be clear enough to reuse directly or translate.

The current GeoJSON circuit files are useful source data, but GeoJSON should be treated as an importer format, not the core racing model. A serious racing foundation should normalize any source layout into runtime track data: centerline, width, surface, elevation, start gate, sectors, bounds, checkpoints, scenery anchors, and collision metadata. Future tracks could come from GeoJSON, hand-authored points, editor output, splines, heightfields, or another toolchain without changing vehicle physics or lap rules.

## Current Duplication

The main duplication is in these folders:

- `frontend/src/components/foxracing` - Australia-era car racing code plus shared GeoJSON track assets.
- `frontend/src/components/foxracingsanluis` - San Luis custom car racing variant with a narrower hand-authored track.
- `frontend/src/components/foxracingbelgium` - Belgium car racing variant using a custom country-themed layout.
- `frontend/src/components/foxracingaspen` - Aspen winter racing variant with car and snowmobile code, using a custom mountain layout.
- `frontend/src/components/snowmobilerace` - snowmobile-specific race code.
- `frontend/src/components/racing` and `frontend/src/components/racingsanluis` - older/shared racing UI and showroom pieces.

Large files that should be split carefully:

- `FoxRacingGame.tsx` copies are roughly 1,800-2,200 lines each.
- `FoxRacingWorld.tsx` copies are roughly 500-700 lines each.
- Vehicle components own movement, camera, collision, lap detection, start reset, and rendering details.
- Track data files mix track loading, scaling, start/finish discovery, spatial hashes, interior calculation, and rendering helpers.

## Non-Negotiable Outcomes

Before refactoring a track, capture the behavior that must remain correct:

- The player spawns at the correct start/finish position.
- The vehicle faces the correct racing direction.
- The visible start gate, lights, stadium elements, minimap flag, and lap detection all agree on the same start line.
- A lap only completes when the player crosses the line in the intended direction after traveling enough of the track.
- Wrong-way crossings, tiny loops around the gate, teleports, resets, or overlapping track sections do not produce valid laps.
- Track-specific scenery still fits the layout and does not block the gate, driving line, or camera.
- Collectibles, multiplayer avatars, and transaction submission still work in dummy mode.
- Lap submission must stay non-blocking for gameplay. The local lap time should appear immediately, the txid can fill in asynchronously, and the UI can keep showing a small loader while the transaction server responds.
- Frontend duplicate guards are not enough for real transaction safety. Lap and collectible transaction submissions should eventually carry server-verifiable idempotency keys so the transaction server can reject or return the existing result for duplicate requests instead of creating multiple inscriptions.
- Competitive gameplay must be anchored to elapsed time, not frame count. Faster computers must not get faster vehicles, faster timers, or easier lap submissions. Vehicle movement should integrate from delta seconds with explicit caps for frame spikes, while lap timing should use a monotonic browser clock when available.
- The track still runs acceptably on lower-end mobile browsers.

Exact old handling is not a non-negotiable outcome. The car tracks should converge toward one improved car feel. Track-specific differences should come from track width, layout, terrain, surface presets, scenery, camera presets, and event rules, not from hidden copies of car physics.

Start gate and direction deserve special care. Today the tracks do not all express this the same way:

- San Luis declares `startFinishPosition` and `startFinishDirection` directly.
- Belgium and Aspen derive a `START_FINISH_T` on the curve and then negate the tangent for their racing direction.
- Australia finds a start/finish position from the longest straight and also flips direction.
- Snowmobile race code has gate/checkpoint concepts that should not be lost when unifying car and snow behavior.

The refactor should make these differences explicit in track metadata instead of hiding them in component-specific math.

Track provenance and geometry should also stay explicit:

- San Luis is a custom, hand-authored track and is narrower than the other current tracks.
- Australia, Belgium, and Aspen now use custom/original layouts authored for this project.
- The refactor should preserve these differences instead of normalizing all tracks to the same width, elevation, or scenery assumptions.
- Hilly terrain was difficult to add cleanly to Australia, San Luis, and Belgium in the current structure. The refactor should not force those tracks to become hilly immediately, but it should remove the assumptions that make future elevation work hard.
- Road and terrain must be track-first. The road centerline, elevation profile, width, shoulder, and blend corridor should shape nearby terrain. Terrain should not randomly clip through a road mesh that was drawn after the hills were generated.

## Target Shape

Aim for a structure like this over several small pull requests:

```text
frontend/src/racing/
  core/
    RacingGameShell.tsx
    RaceStateProvider.tsx
    lapTiming.ts
    startGate.ts
    trackGeometry.ts
    terrainHeight.ts
    roadCorridor.ts
    spatialTrackIndex.ts
    vehiclePhysics.ts
    cameraRig.ts
    collisions.ts
  simulation/
    raceState.ts
    scoring.ts
    ghostRacer.ts
  components/
    StartGate.tsx
    StartLights.tsx
    Minimap.tsx
    RacingHud.tsx
    TrackSurface.tsx
    AdvertisingBoards.tsx
    StadiumSeating.tsx
    CollectibleItem.tsx
    OtherPlayerVehicle.tsx
  tracks/
    australia.ts
    sanLuis.ts
    belgium.ts
    aspen.ts
    unitedKingdom.ts
    germany.ts
  vehicles/
    car.tsx
    snowmobile.tsx
  render-three/
    materials.ts
    lod.ts
    instancing.ts
  platform/
    input.ts
    graphicsSettings.ts
    storage.ts
  assets/
    assetManifest.ts
```

The exact folder names can change, but the ownership should become clear:

- Track metadata describes what is unique.
- Core systems implement rules and math.
- Simulation modules stay independent from React and Three.js when possible.
- Components render reusable pieces.
- Render adapters own Three.js-specific materials, meshes, effects, level-of-detail, and performance details.
- Vehicle modules own vehicle-specific physics, model, sound hooks, and control tuning. There should be one shared car module for car tracks and a separate snowmobile module for snowmobile tracks.
- Platform modules handle browser, mobile, controller, and packaged-app differences.

During the migration, `frontend/src/racing` is the reusable racing library: pure systems, shared game components, transaction builders, multiplayer helpers, track metadata, and tested utilities should land there. `frontend/src/components/racing` is legacy route-facing UI/world support that still exists for compatibility (`RacingUI`, `Showroom`, `Track`, `TrackPreviewMinimap`, `UnifiedShowroom`). When a file in `components/racing` becomes broadly reusable, move the implementation to `src/racing` and leave a small compatibility re-export only if existing imports need it.

## Prior Art

This project is not the first open-source racing game architecture. Speed Dreams, TORCS, VDrift, Trigger Rally, and SuperTuxKart are useful references for track definitions, vehicle handling, race lifecycle, cameras, terrain/scenery organization, AI/ghost racing, and modular content.

The unusual part of this project is the web stack and product integration: React + Three.js rendering, browser multiplayer/socket state, wallet identity, ordinal fox assets, and collectible/transaction flows. The refactor should borrow proven racing-game structure where it applies while keeping those web-specific constraints explicit.

## Track Metadata Contract

Each track should eventually export one typed `TrackDefinition`. The first checked-in step is static authoring metadata in `frontend/src/racing/tracks/trackMetadata.ts`; the eventual runtime definition should go deeper and include geometry, sectors, terrain, barriers, and render budgets:

```ts
type TrackDefinition = {
  id: string
  displayName: string
  location: string
  environment: 'city-park' | 'desert' | 'forest' | 'winter'
  vehicleMode: 'car' | 'snowmobile'
  handlingModel: 'shared-car' | 'snowmobile'
  curve: THREE.CatmullRomCurve3
  length: number
  width: number
  shoulderWidth: number
  elevation: {
    mode: 'flat' | 'hilly'
    heightProvider: 'constant' | 'sampled-heightfield' | 'procedural'
    roadFollowsTerrain: boolean
    maxGrade?: number
  }
  roadCorridor: {
    roadWidth: number
    shoulderWidth: number
    blendDistance: number
    roadClearance: number
  }
  start: {
    position: THREE.Vector3
    direction: THREE.Vector3
    curveT: number
    gateWidth: number
    lapCrossingWidth: number
    lapCrossingDepth: number
  }
  spawn: {
    position: THREE.Vector3
    direction: THREE.Vector3
    cameraPreset: string
  }
  scenery: {
    terrain: string
    treePreset?: string
    waterPreset?: string
    mountainPreset?: string
    stadiumPreset?: string
    adBoardPreset?: string
  }
  validation: {
    minLapDistanceRatio: number
    minLapSeconds: number
    maxLapSeconds: number
    wrongWayGraceSeconds: number
  }
  attribution: {
    layoutSource: 'custom'
    sourceUrl?: string
    license: string
    notes?: string
  }
}
```

This contract should be introduced after the existing behavior is documented. Do not try to migrate every field in one huge PR.

AAA-style track definitions should eventually include additional authoring sections:

- Layout source: imported GeoJSON, hand spline, editor export, sampled centerline, and source attribution.
- Road model: width profile, shoulders, cambers, curbs, barriers, wall collision, runoff, and edge geometry.
- Start and race control: spawn pose, start gate, timing line, sectors, checkpoints, wrong-way rules, reset zones, and pit/shortcut rules if added later.
- Terrain contract: height provider, road corridor, clearance, grade limits, surface normals, and off-track blending.
- Scenery zones: tree exclusion, ad-board anchors, stadium placement, mountains/water, collision props, LOD groups, and authored no-spawn/no-camera volumes.
- Camera and presentation: camera presets, start camera, replay or ghost cameras, minimap bounds, lighting, weather, and track intro data.
- Platform budgets: draw-call targets, triangle and instance budgets, texture memory budgets, mobile fallback presets, and streaming or LOD status.

Terrain should be treated as a track system, not just scenery. Even when a track is flat today, the shared code should support asking for height, surface normal, road grade, road influence, and off-track height at a world position. That keeps Australia, San Luis, and Belgium eligible for more realistic hilly terrain later without changing lap timing, start gate math, collisions, minimap projection, or vehicle spawn logic again.

The road corridor is the contract between track geometry and terrain. It should define the guaranteed road ribbon, shoulder blend, clearance above terrain, and how far hills are pushed down or blended away from the driveable surface. Aspen can remain the current hilly proof track, but the same corridor API should be available to every track.

Belgium and Australia should eventually be able to use real-world elevation changes. The metadata now distinguishes current elevation from planned elevation: Belgium and Australia are flat-current but marked for sampled real-world elevation, San Luis is flat-current with likely authored elevation, and Aspen is hilly-current. The refactor should make elevation a sampled track property, not a one-off terrain mesh trick, so the road, vehicle height, collision, camera, minimap, and scenery all agree on the same heights.

The first shared elevation provider contract now exists. It supports flat height sampling, function-backed/procedural sampling, approximate surface normals, and road clearance. Future Belgium or Australia elevation work should plug sampled real-world or authored height data into this provider shape, then let road corridor and rendering systems consume it instead of adding one-off terrain math inside a track component. GeoJSON import now also preserves optional third-coordinate elevation values with scale/offset controls, while the current Australia/Belgium/Aspen source files remain 2D and therefore flat. Vehicle visual pitch/roll is now part of the shared elevation helper layer as a visual-only response to sampled terrain; it does not change the parent vehicle pose used by physics, collision, lap timing, camera targeting, or multiplayer. Visual tilt application builds a local surface-normal frame/quaternion from sampled forward and side slopes rather than composing independent Euler pitch/roll rotations, so sidehilling can align the car more perpendicular to the surface. Roll currently samples a wider 4-unit side span and uses a stronger visual scale than pitch so sidehilling is readable. Remote car pitch/roll is derived client-side from the remote car's received position/yaw and the local terrain sampler, so the socket protocol does not need to send car-track pitch/roll.

## Phased Work

### Current Extraction Status

The `frontend/src/racing/` directory is the reusable racing library. Significant shared systems have been extracted and are in use across the six playable track events:

- **Track geometry**: GeoJSON conversion, closed curves, horizontal and parallel-transport frames, spatial hash indexing, nearest-track lookup, start pose resolution.
- **Start gate and lap validation**: shared gate projection and crossing detection, minimum-distance rule, San Luis reached-end rule, monotonic race timing.
- **Car handling**: key mapping, acceleration, braking, steering, slope-aware downhill speed, camera configuration, off-track bounce, circle collision (trees, poles, ad boards, remote players), visual pitch/roll.
- **Race lifecycle**: countdown flow, loading timers, restart/reset helpers, race state dispatcher.
- **Multiplayer**: join/leave, position batching (30 ms), appearance sync, chat routing, game state snapshots, remote player LOD (near/mid tiers, per-quality-preset caps), fake load testing support.
- **Collectibles**: pickup detection, item actions, socket events, collectible socket state.
- **Transactions**: lap submission workflow, collectible item builders, socket activity helpers, ordinal URL formatting.
- **HUD and UI**: metrics, lap times, camera mode selector, controls helper, crash overlay, loading overlay, countdown display, FPS counter, chat input bar, color picker, sound toggle, current players panel.
- **Audio**: gas sound helpers, looping idle audio, preloaded audio elements.
- **Rendering**: rolling hills, tree instances, distant mountains, minimap, start lights, showroom, billboard stadium foxes, stadium seating helpers, collectible item renderer, remote player cars.
- **Performance**: quality presets (Low/Medium/High), remote-player LOD, scenery quality budgets.
- **Track metadata and runtime config**: authoring metadata, surface profiles, proximity thresholds, terrain contracts, road corridor influence.
- **Imported track pipeline**: `createImportedCarTrackDefinition`, catalog, registry, `ImportedCarTrackScenery`, `ImportedBasicScenery`. United Kingdom and Germany are playable imported tracks with custom scenery and authored elevation.

Australia, San Luis, Belgium, Aspen, United Kingdom, and Germany use these shared systems. San Luis keeps its narrower road profile, explicit start pose, and stricter reached-end lap validation as authored track differences, not separate car physics. The official Aspen event is `aspen-snowmobile` through `SnowmobileWorld`; legacy Aspen car files remain present only as migration references.

The clearest success criteria: a new imported track can be added from a track name, GeoJSON file, start gate pose/direction, and scenery module without copying a full event folder. United Kingdom and Germany are working examples of that path.

Next extraction targets are typed track definitions, shared renderer-facing track systems, and the snowmobile vehicle path after in-game checks on all six playable events.

### Phase 1: Inventory and Safety

- Add a short per-track behavior note for Australia, San Luis, Belgium, Aspen, United Kingdom, and Germany.
- Document current start/finish position, direction source, vehicle type, track length, lap validation, and known quirks.
- Identify track-specific car handling differences that should be removed when the shared car model lands.
- Add focused tests for pure helpers before moving them.
- Add a simple manual QA checklist for each track.
- Keep all current route names and transaction payloads stable.

Suggested first tests:

- GeoJSON-to-waypoint conversion removes duplicate closing points.
- Track curves close cleanly.
- Start gate projection detects crossing direction correctly.
- Lap validation rejects too-short laps.
- Track metadata has normalized start direction vectors.

### Phase 2: Extract Pure Track Systems

- Move GeoJSON conversion into one shared helper.
- Move track interior calculation into one shared helper.
- Move terrain height / surface normal lookup into one shared helper with a flat default.
- Move road corridor influence / terrain blending into one shared helper.
- Move spatial hash / nearest-track lookup into one shared helper.
- Move track frame generation into shared helpers, with horizontal frames for current flat roads and slope-aware frames available for future hilly roads.
- Move track width, shoulder width, proximity, scenery clearance, and board/wall offsets into shared profile metadata.
- Move start gate math into one shared helper.
- Move lap crossing and lap distance validation into one shared helper.
- Keep track folders importing the new helpers while still rendering through their current components.

Acceptance check: every existing track still plays, starts, laps, resets, and submits dummy results. Exact old car feel does not need to be preserved if the new shared car behavior is intentional and consistent.

### Phase 3: Normalize Track Definitions

- Create typed track definitions for all six playable track events.
- Replace per-folder start/finish constants with track metadata.
- Use the shared curve start-pose helper for simple curve-T start lines and keep complex derived start-line logic explicit until it can become metadata.
- Make start direction explicit instead of requiring every track to remember whether to negate a tangent.
- Add track-specific overrides for gate placement, scenery exclusions, minimap scale, vehicle type, and lap validation.
- Add track-specific terrain metadata so flat tracks and hilly tracks use the same height API.
- Add road corridor metadata so future hilly terrain is designed around the road instead of clipping through it.
- Add width/profile metadata so San Luis remains narrow, standard car tracks remain wider, snow tracks keep their wall/board spacing, and future tracks can choose or author profiles intentionally.
- Keep generated and hand-authored tracks supported.

Acceptance check: a contributor can open one track file and understand the track's curve, start gate, direction, spawn, terrain, and scenery configuration.

### Phase 4: Shared Race State and UI

- Extract race status, countdown, timer, completed laps, lap txids, submission status, and errors into shared state.
- Keep shared race state usable outside React components so it can be tested and reused by another renderer or platform adapter.
- Extract transaction submission into one service that accepts track/player/lap data.
- Extract wallet/auth state into a platform service separate from race simulation. Future Yours/BRC-100 authentication should be able to verify a wallet-controlled Pixel Fox Racing auth basket/token and session freshness without coupling auth checks to vehicle physics, lap timing, or track components.
- Extract shared HUD, lap table, start lights, minimap, showroom, and track preview behavior.
- Keep wallet and transaction behavior optional so dummy mode remains easy.

Acceptance check: adding a lap UI, transaction, or auth freshness fix should require one shared change, and wallet/auth changes should not touch vehicle movement, start gates, lap validation, or track rendering.

### Phase 5: Shared World Rendering

- Extract reusable track surface rendering.
- Extract terrain rendering and height sampling so Aspen-style hills are not hardcoded to one track folder.
- Extract start gate rendering so poles, arch, lights, collisions, and scenery exclusions use the same source of truth.
- Extract reusable ad boards, stadium seating, tree placement, mountains, water, collectibles, and other-player rendering.
- Add renderer-facing asset manifests and presets for models, textures, materials, effects, level-of-detail, batching, and instancing.
- Keep environment presets for visual identity rather than copying whole world files.

Acceptance check: each track still has its own personality, but repeated objects share implementation, and flat tracks can later opt into hilly terrain without replacing their game component.

### Phase 6: Vehicle and Camera Systems

- Separate input, physics, collision, camera, and vehicle model rendering.
- Build one shared car behavior model for every car track.
- Keep snowmobile behavior separate through its own vehicle module.
- Let car bodies, colors, decals, and cosmetic parts vary without changing the baseline car handling unless a future tuning system is intentionally added.
- Put track-specific car variation behind explicit surface or assist settings, not copied physics code.
- Add mobile/touch controls through the shared input system.
- Add controller support through the same input abstraction.
- Keep camera presets per track and vehicle so the start gate and road remain readable.

Acceptance check: a handling change for cars applies consistently to every car track and does not accidentally change snowmobile behavior unless intentionally configured.

### Phase 7: Platform Readiness

- Make browser performance measurable with simple FPS and memory checks.
- Add graphics quality presets for low-end mobile, high-end desktop, and packaged builds.
- Audit touch targets, safe areas, orientation, and viewport behavior for iPhone and Android.
- Plan the Yours/BRC-100 auth adapter as platform code. The preferred future flow is a configurable Pixel Fox Racing auth basket containing a reusable auth token: login proves wallet control by spending or cycling that token and returning it to the same basket, while the app/server use the latest verified activity timestamp to decide whether the session is fresh enough.
- Keep auth-basket names, token metadata, freshness thresholds, and fallback behavior configurable for forks and local dummy mode.
- Keep service URLs and transaction mode configurable for hosted web, mobile web, packaged desktop, and future Steam-style builds.
- Decide later whether packaging should use Tauri, Electron, Capacitor, or another tool after the web version is stable.
- Keep the simulation/data layer independent enough that future native ports or rewrites do not have to reverse-engineer gameplay from React component trees.

Acceptance check: platform work builds on stable shared systems instead of duplicating platform-specific fixes per track, and wallet/auth changes do not require per-track racing changes.

### Phase 8: Future Renderer and Portability

- Keep Three.js-specific code behind renderer modules instead of mixing it into gameplay rules.
- Keep track and asset data serializable where practical.
- Document which systems are portable TypeScript, which systems are browser-only, and which systems are Three.js-specific.
- Avoid adding new gameplay rules that depend on React lifecycle behavior.
- If another engine, native app shell, or language becomes useful later, start from the shared track definitions, simulation rules, terrain API, and asset manifests.

Acceptance check: a contributor can explain how to run the current React Three version and also identify what code would survive a future renderer, mobile shell, or language port.

## PR Strategy

Prefer small pull requests in this order:

1. Add tests or docs for one behavior.
2. Extract one pure helper.
3. Point one track at the helper.
4. Point the remaining tracks at the helper.
5. Delete the duplicated code only after all tracks use the shared version.

Avoid PRs that rewrite all tracks, all UI, and all vehicle code at once. The tracks have subtle differences, and large mechanical changes make it too easy to lose them.

## Manual QA Checklist

Run this checklist for Australia, San Luis, Belgium, Aspen, United Kingdom, and Germany after any refactor touching racing code:

- Start a race from the showroom or track selector.
- Confirm countdown, start lights, camera, and spawn direction feel correct.
- Drive through the start gate in the intended direction and confirm the timer starts or continues as expected.
- Drive backward through the gate and confirm it does not create a valid lap.
- Complete a full lap and confirm the lap time appears once.
- Try a short loop near the start gate and confirm it is rejected.
- Reset or restart and confirm the vehicle returns to the correct start position and direction.
- Confirm vehicle height, camera target, shadows, and collision still make sense on the track surface.
- Confirm minimap flag, start gate, stadium, ad boards, trees, collectibles, and other-player markers align with the track.
- Confirm dummy transaction mode records or skips data exactly as expected.
- Check desktop and mobile viewport sizes for UI overlap.

## Definition of Done

The refactor is successful when:

- The six playable track events are still playable and visually better than before.
- Australia, San Luis, and Belgium use one shared car behavior model.
- Snowmobile handling remains a separate model.
- Start gate, direction, lap timing, minimap, camera, and transaction submission share one reliable model.
- Shared systems have focused tests where practical.
- Track-specific files are mostly metadata, presets, and unique scenery.
- Flat and hilly tracks use the same terrain height API, so Australia, San Luis, and Belgium can become hillier later without another structural rewrite.
- Adding a new track does not require copying a 1,800-line game component.
- Core racing behavior is not trapped inside JSX-heavy components.
- Three.js rendering is treated as an adapter over portable track, simulation, terrain, and asset data.
- A new contributor can understand where to change track data, vehicle behavior, UI, rendering, transactions, and platform settings.
- Mobile web is usable enough to guide Android and iPhone packaging decisions.
- The codebase feels like a maintainable game suite, not a set of sequential prototypes.
