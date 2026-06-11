# Pixel Fox Racing Refactor Plan

Pixel Fox Racing currently works, but the frontend grew one track at a time. Australia, San Luis, Belgium, Aspen, and the first imported-track proofs in United Kingdom and Germany share a lot of ideas while still keeping too much game state, track data, world rendering, minimaps, vehicles, lap timing, start gates, CSS, and UI in track-era folders. Some folder and module names still reflect older internal/provenance names, but public track display names now use fictional or country-themed names.

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

This refactor has started with pure systems that are easy to test and safe to share across the existing track folders:

- Overall direction remains good: the refactor is getting less confusing as shared behavior moves into typed, tested modules and track-specific differences stay track-owned. The clearest success criteria is now "can a new track be added from a track name, GeoJSON JSON file, start gate pose/size/direction, and scenery module without copying a full old event folder?" United Kingdom is the first working proof of that path.

- Shared track geometry helpers now cover GeoJSON waypoint conversion, closed curve creation, smoothed hand-authored paths, horizontal road frames, parallel transport frames, and track interior checks.
- Shared curve start-pose lookup now covers the repeated “position at curve T plus tangent direction” logic for Belgium, Aspen snowmobile, legacy Aspen car files, and the legacy Belgium data file. Australia’s longest-straight start finder remains intentionally separate until start metadata is normalized.
- Shared spatial indexing now builds track samples and nearest-track hashes from a curve, including optional height providers for hilly tracks.
- Shared start gate math now projects vehicles onto a start gate, reports enter/leave transitions, and updates the mutable inside/outside gate state. Australia, Belgium, San Luis, legacy Aspen car, and legacy Aspen-local snowmobile use this shared logic while preserving their existing gate widths and local diagnostics.
- Shared car-track start-gate rendering now lives in `frontend/src/racing/components/CarTrackStartGate.tsx`, with Australia, Belgium, and San Luis using the same checkered strip, arch columns, arch top, and start-light composition while preserving San Luis' narrower strip and centered arch. Shared collectible rendering now lives in `frontend/src/racing/components/RacingCollectibles.tsx`, giving the car worlds a small common dynamic-object boundary without moving track-specific scenery yet.
- Australia, Belgium, and San Luis now share the first car-track world composition shell in `frontend/src/racing/components/CarTrackWorldShell.tsx`. The shell owns the racing Canvas, initial camera setup, start gate, collectibles, remote-player slot, and OrbitControls, while each track keeps its own static scenery and local car props. Manual camera toggling and car-position target tracking now live in `frontend/src/racing/components/useCarTrackManualCamera.ts`, with San Luis keeping its lighter per-frame OrbitControls update behavior through hook options.
- The shell now has a small car-track definition bridge in `frontend/src/racing/components/useCarTrackWorldRuntime.ts`. Australia, Belgium, and San Luis declare runtime inputs for start pose, gate width/layout, curve/frames/segments, track length, manual-camera behavior, and authoring metadata; the hook owns quality resolution, scenery quality, start-gate pole calculation, track-length publishing, race-world lifecycle callbacks, and manual-camera setup.
- Car-track runtime definitions now live in `frontend/src/racing/tracks/carTrackDefinitions.ts` instead of inside the large world components. Definitions attach `TrackAuthoringMetadata` to the playable car-track geometry, so the next new-track path can grow around a single “track metadata + geometry + presentation overrides” contract. `carTrackRenderConfigs.ts` remains as a compatibility re-export for now. Tests cover the current car-track definition set, positive runtime geometry, metadata alignment, San Luis' custom gate presentation, and the manual-camera tuning differences.
- Imported car-track authoring now has a first explicit contract in `frontend/src/racing/tracks/importedCarTrackAuthoring.ts`: track id/name, GeoJSON `.json` path, explicit start-gate position/direction/size, scenery preset/file, road profile, and terrain/elevation defaults. The default is flat, but the contract already carries coordinate elevation scale/offset, height-provider intent, road-corridor blend distance, and road clearance for future hilly tracks. `frontend/src/racing/tracks/carTrackIntegrationChecklist.ts` records the cross-system wiring a new track needs: runtime definition, event routing, socket accepted track name, stats/lap-record accepted track name, transaction trackname policy, scenery, and terrain height provider when non-flat.
- Imported car-track runtime assembly now has a small adapter in `frontend/src/racing/tracks/importedCarTrackDefinition.ts`. The intended new-track module imports its own `some-track.json`, passes that JSON plus authoring metadata into `createImportedCarTrackDefinition`, and receives the same `CarTrackDefinition` shape used by the shared car-track world shell. This is the future handoff point for “track name + GeoJSON + start gate + scenery file” without copying a full event folder.
- Imported track registration is now split into a lightweight catalog and a runtime registry. `frontend/src/racing/tracks/importedCarTrackCatalog.ts` exposes display names and ids for page-level selection without importing heavy geometry into the initial page chunk. `frontend/src/racing/tracks/importedCarTrackRegistry.ts` imports actual `CarTrackDefinition` objects for lazy racing chunks that need runtime curves, terrain, and previews. Future imported tracks should add one catalog entry plus one registry definition entry instead of adding page-level special cases.
- United Kingdom has a concrete imported-track module in `frontend/src/racing/tracks/imported/unitedKingdom/unitedKingdomTrack.ts`, backed by `unitedKingdom.source.json`. It uses custom route-editor geometry with authored elevation.
- Germany has a concrete imported-track module in `frontend/src/racing/tracks/imported/germany/germanyTrack.ts`, backed by `germany.raw-elevated.json` and `germany.source.json`. Both files use the same custom route-editor geometry with authored elevation.
- `scripts/add-geojson-elevations.mjs` is the reusable imported-track elevation enrichment tool. It samples OpenTopoData elevations for GeoJSON LineString coordinates, smooths the closed-loop profile, and writes a derived elevated GeoJSON. This keeps external source layout data and derived runtime elevation data separate while proving that future imported tracks can carry `[lon, lat, elevation]` coordinates through the same runtime geometry adapter.
- Showroom track previews now resolve through `frontend/src/racing/tracks/trackPreviewDefinitions.ts` instead of a hardcoded curve map inside `RacingUI`. Built-in previews keep the current Australia, San Luis, Belgium, Aspen ordering, and imported car definitions can be appended to the preview list once a generic imported event renderer exists. Track selection resolution now lives in `frontend/src/racing/tracks/trackSelection.ts`, which distinguishes official events from imported car-track definitions while the page still rejects imported selections until routing is implemented.
- United Kingdom and Germany are now selectable and raceable from the showroom. `RacingUI` includes imported-track previews/minimaps by default when car tracks are listed, `FoxRacing.tsx` routes imported selections into the car wrapper through the lightweight catalog id, and the Australia car wrapper can now run against a supplied/imported `CarTrackDefinition`. The in-game minimap receives the active definition's curve/start pose, and the world can run a basic imported scenery mode that avoids Australia-specific rain, lake, and Australia-specific scenery placement while still using the shared road, hills, start gate, collectibles, local car, and remote-player rendering.
- United Kingdom now owns its first track-specific scenery component in `frontend/src/racing/tracks/imported/unitedKingdom/unitedKingdomScenery.tsx`, with pure placement helpers in `unitedKingdomSceneryData.ts`. The component keeps scenery layout track-owned instead of inheriting Australia or Belgium placement: Low/Medium/High scale tree counts, trees pushed outside the board corridor, full curved advertising boards around both sides of the track with collision data, sunny Belgium-style lighting, and Belgium-style stadium seating on both sides of the authored start line.
- Imported car-track scenery now routes through `frontend/src/racing/tracks/imported/ImportedCarTrackScenery.tsx`. Registered tracks such as United Kingdom can provide full custom scenery. Germany uses `ImportedBasicScenery` with Belgium-style board texture logos enabled. New imported tracks without a custom scenery renderer fall back to `ImportedBasicScenery` without texture logos, which supplies quality-scaled position-aware trees and terrain-aware full-track curved advertising boards while still receiving shared imported world basics from the car-track world: lighting/sky, terrain or flat ground, rolling hills, road, start gate, collectibles, local/remote cars, and start-line stadium seating. This gives a new GeoJSON track a useful first-pass environment without modifying the existing Australia/Belgium/San Luis advertising-board components or forcing United Kingdom's authored scenery onto every future track.
- Shared car-track road now uses curvature-limited inside offsets when a tight corner radius would otherwise make the road edge self-intersect. The attempted matching `CurvedBoard` curvature-limit/length-sampling change made Germany's tight inside-corner boards worse, so shared `CurvedBoard` is back to Belgium-style fixed-sample geometry. Future board fixes should use authored board spans or a real offset-curve join system instead of changing the global Belgium board renderer.
- Imported car worlds render sampled grass terrain at `resolution={420}` with `yOffset={-0.12}` so terrain sits closer to the road at elevation changes. Imported car minimap/race HUD labels use track display names, while authoring metadata can still keep separate country-themed locations.
- Generic imported scenery data now lives in `frontend/src/racing/tracks/imported/importedBasicSceneryData.ts`, with tests covering quality-scaled tree counts, track-corridor clearance, and full-curve board placement on both sides. The fallback is deliberately basic; track-specific scenery modules should still own custom board spans, logos, stadium locations, tree exclusions, weather, and landmark placement.
- United Kingdom board/logo work produced an important scenery-rule lesson: advertising board geometry can be shared, but logo placement should be authored per track. Texture-painting logos onto curved board UVs caused compressed/stretched logos at curve and segment boundaries. United Kingdom now uses plain curved board shells plus sparse fixed-size `BoardLogoDecal` overlays only on safe spans. The result is less dense than Belgium, but predictable. Future tracks should be free to use Belgium-style texture boards, fixed decals, custom authored board segments, or no boards; do not force one global advertising-board layout.
- Stadium seating follows the same track-authored scenery rule. Stand positions, orientation, and size are track-specific, while spectator density can be quality-scaled. The Belgium/United Kingdom stadium path now supports `foxDensityScale`; United Kingdom passes the active quality preset density so Low/Medium/High keep the authored stands stable while rendering fewer or more deterministic spectator foxes. The same hook should be applied to the remaining Australia/Belgium/San Luis/Aspen stadium usages for consistent quality behavior.
- Imported hilly tracks now pass the terrain sampler into road, grass terrain, car height, start gate, collectibles, stadium seating, trees, and board placement. United Kingdom renders a sampled terrain mesh under the road, while the road corridor keeps the road/shoulder clear of terrain clipping. The current imported road stays laterally level while following centerline elevation, leaving intentional camber/banking as a future authored feature rather than an accidental terrain artifact.
- Start-line authoring remains an explicit manual QA step for imported tracks. A new GeoJSON should be mounted first, then the in-game position/direction logger should be used to capture a real start gate pose and clockwise/counterclockwise direction. The importer should not assume the GeoJSON first coordinate, bbox, or circuit name gives the correct racing start.
- United Kingdom and Germany lap submissions are now accepted by frontend validation through `frontend/src/racing/tracks/trackDisplayNames.ts`, a lightweight display-name registry that includes official event names plus imported track names without importing imported-track geometry into the page chunk. The transaction server already accepted arbitrary non-empty `trackname`; the missing dummy txid for the first imported track was the frontend rejecting the imported display name before POST.
- Imported car tracks now keep Australia/Belgium-style lap completion by default: after enough driven distance, crossing the authored start gate completes the lap. United Kingdom depends on its planned physical walls/barriers for shortcut prevention instead of San-Luis-style `requiresReachedEnd` progress gating.
- The socket server now reads accepted multiplayer track names from `VALID_TRACK_NAMES` with the current `Australia,San Luis,Belgium,Aspen,United Kingdom,Germany` default. This keeps same-track remote-player filtering and Current Players track state configurable when a new contributed track is added, without editing socket-server source for every track.
- Pixel Racing stats now groups leaderboard and championship data by discovered lap-result `trackname` values through `frontend/src/racing/stats/pixelRacingStatsTracks.ts`, with the legacy blank-trackname records still counted as San Luis. Official event names keep their preferred tab order, and newly discovered track names get their own stats tabs instead of being dropped by a hardcoded four-track split.
- Australia, Belgium, and San Luis now render their local car through `frontend/src/racing/components/CarTrackLocalVehicle.tsx`. The adapter owns the shared `FreeRoamCar` prop wiring, manual-camera updates, remote-player collision target conversion, item/gas/lap callbacks, and socket position forwarding behavior. Track-specific scenery stays outside the adapter: Australia/Belgium still generate and render their own advertising boards and stadium seating, and only pass board collision placements into the local vehicle; San Luis keeps its custom socket emit rule through an adapter option.
- Australia, Belgium, and San Luis now share the visible car/fox-driver JSX through `frontend/src/racing/components/CarTrackVehicleModel.tsx`. Their `FreeRoamCar` controllers still own movement, lap, collision, and camera orchestration for now, but the repeated model mesh is no longer copied across every car track.
- Australia, Belgium, and San Luis now share `frontend/src/racing/components/CarTrackShowroomShell.tsx` for showroom Canvas quality, camera setup, background, ambient light, and auto-rotating OrbitControls. The shell accepts track-specific showroom content as children and an optional overlay, so Australia keeps its loading overlay while Belgium and San Luis stay plain.
- Removed the misleading distant-mountain collision/barrier plumbing from the car-track adapter and worlds. Australia does not render mountains, and San Luis mountains remain visual scenery only; car collision resolution still covers track bounds, trees, start-gate poles, remote players, and track-specific advertising boards.
- Shared lap validation now owns the minimum-distance / start-crossing rule. Shared lap-completion attempts now also own the “validate, compute lap time, update lap refs before callback, then call completion” ordering for Australia, Belgium, San Luis, legacy Aspen car, and legacy Aspen-local snowmobile. Shared lap-frame finalization now clears the duplicate-crossing guard after leaving the gate and publishes cumulative distance updates. San Luis still passes its stricter reached-end requirement and resets `maxTrackT` after a valid lap because its custom layout used that extra protection.
- Shared track-progress accumulation now covers San Luis' reached-end lap guard. `updateTrackProgressAccumulator` in `frontend/src/racing/simulation/lapTiming.ts` owns track-T distance accumulation, closed-loop wrap handling, near-track-gated max progress, and large closest-point jump filtering, so San Luis can keep its narrower/custom lap metadata without carrying private progress logic in its car controller.
- Shared race clock timing now uses monotonic browser time for lap timing and visual lap timers. Wall-clock `Date.now()` remains appropriate for leaderboard timestamps, chat timestamps, logs, and persisted records. Shared simulation delta sanitization now clamps non-finite, negative, and spike frame deltas before vehicle movement uses them.
- Shared lap-counter reset helpers now own the race-start/countdown reset values for lap start time, last lap distance, start-line flags, optional total traveled distance, optional previous-distance position, and San Luis `maxTrackT`. The car controllers now use a shared game-status dispatcher for racing/countdown lap resets, while legacy Aspen-local snowmobile still calls the explicit reset helpers because its reset effect also owns snowmobile-specific lean and sled pose work.
- Shared distance tracking helpers now own the horizontal X/Z movement delta, the current `0.1` stop-speed threshold, previous-position initialization/copying, stopped tracking reset, and total-distance accumulation for actual-movement lap distance. Australia, Belgium, legacy Aspen car, and legacy Aspen-local snowmobile use this accumulator while San Luis intentionally keeps its track-T distance model and max-track anti-cheat path.
- Shared display update helpers now own the current six-frame throttle cadence, lap display-time fallback to zero before the timer starts, absolute speed display value, mutable display-counter advancement, and callback notification for lap-time/speed displays. Australia, San Luis, Belgium, legacy Aspen car, and legacy Aspen-local snowmobile use these helpers while preserving each component's existing callback order in the frame loop.
- Shared vehicle loaded notification now owns the delayed loading-state callback and loaded-ref guard for Australia, Belgium, San Luis, legacy Aspen car, and legacy Aspen-local snowmobile. Components can still pass optional loaded-time work, such as the existing minimap position refresh, without duplicating the timeout/reset logic.
- Shared vehicle status callbacks now own the countdown-start minimap position refresh trigger for Australia, Belgium, legacy Aspen car, and legacy Aspen-local snowmobile. The components still provide the actual position/rotation/speed callback, but the repeated status-effect wrapper is gone.
- Shared reported-spawn-position hooks now own the one-shot spawn-position minimap refresh guard for Australia, Belgium, legacy Aspen car, and legacy Aspen-local snowmobile. Components still provide the height sampler and position refs so flat and future hilly vehicle placement stay track-owned.
- Shared vehicle frame callbacks now own manual-camera control notification, per-frame position update callback forwarding, vehicle pose commits, one-shot spawn-position pose application, and the common reset of position/rotation/smoothed-rotation/speed/camera-rotation refs for Australia, Belgium, San Luis, legacy Aspen car, and legacy Aspen-local snowmobile. The pose helper preserves Australia's tiny-rotation write threshold for moving frames while Belgium, San Luis, and legacy Aspen car still write rotation every moving frame; Australia, Belgium, and legacy Aspen car also use the reset helper for race-start/countdown pose commits where rotation is reset. Vehicle components still decide what counts as active controls and where in the frame loop callbacks are fired.
- Shared track-frame cadence helpers now own the current track-position counter reset at 1000 frames, informational track-position recalculation every 20 frames or when `lastTrackT` is missing, and cached on-track refresh every 5 frames for Australia, Belgium, legacy Aspen car, and legacy Aspen-local snowmobile.
- Shared car handling now owns the car key mapping, acceleration, braking, speed caps, reverse cap, friction, turn speed, speed-based steering sensitivity, rotation normalization, speed integration, and steering integration used by Australia, Belgium, San Luis, and any remaining legacy car component files.
- Shared car handling now supports slope-aware downhill speed. Hilly/elevated tracks can sample terrain height ahead of the car, raise downhill top speed within configured limits, and bleed overspeed naturally when the car returns to flat/uphill terrain instead of snapping speed down abruptly. Off-track downhill has its own lower boosted cap so carrying speed off the road still feels physical without making off-track travel competitive.
- Shared car handling also owns gas audio volume mapping and the movement frame-delta cap. The movement cap is important for browser/computer variability because it prevents frame drops from turning into large vehicle teleports.
- Shared car gas audio helpers now own gas-sound start, stop, mute cleanup, initial volume, per-frame volume updates, playback error callbacks, pressed/released callbacks, and looping preloaded audio element creation for Australia, Belgium, San Luis, and legacy Aspen car. Track components still own keyboard event wiring, but direct audio element manipulation is no longer repeated in every car file.
- Shared car keyboard controls now own browser keydown/keyup listeners, movement-key `preventDefault`, gas-key state tracking, gas-sound start/stop, and gas-sound cleanup for Australia, Belgium, San Luis, and legacy Aspen car. Track components still keep their shared key-state ref so frame-loop movement reads the same live input state as before.
- Shared car control-frame helpers now own the pure per-frame car control math for Australia, Belgium, San Luis, and legacy Aspen car: key-state mapping, on/off-track max speed selection, speed integration, and steering integration. Components still preserve callback/audio ordering and track-specific movement/collision paths.
- Shared car inactive-frame helpers now own the "only racing advances movement" status check plus countdown/loading speed decay and stop-threshold snap for Australia, Belgium, San Luis, and legacy Aspen car. Track components still preserve their own early-return side effects, such as forcing flat ride height while waiting.
- Shared car handling owns the forward-vector convention used by the car tracks. Shared car movement-frame helpers now also own forward-vector writes, optional board-tangent projection, velocity writes, capped movement delta, and next-position calculation for Australia, Belgium, San Luis, and legacy Aspen car while preserving each component's existing scratch vectors. That keeps movement direction tied to the same stable heading model that protects the camera around full rotations.
- Shared car off-track bounce now owns the current flat car ground height, off-track bounce intensity/frequency, two-wave oscillation, stopped/on-track ground reset, and off-track speed-factor clamp used by Australia, San Luis, Belgium, and legacy Aspen car.
- Shared car rotation now has an explicit stability rule: before movement or camera logic uses vehicle heading, the angle is finite and normalized to the `[-π, π]` range. This preserves the old fixes for the camera-loses-car bug around full 360-degree rotation while making the rule testable and reusable.
- Shared car camera configuration now owns follow distance, height, distance clamps, frame-delta caps, smoothing rates, velocity prediction time, and target-smooth reset distance. The track components still render and orchestrate camera modes, but the important numeric behavior is no longer copied independently.
- Shared vehicle elevation helpers now own the current flat-track vehicle ride height, flat car model height offset, flat car height-at-position adapter, safe sampled-height fallback, moving-frame flat-car next-position Y snap, frame-step surface snap/smoothing, and terrain-derived visual pitch/roll helpers used by Australia, Belgium, and legacy Aspen-local vehicle files. This intentionally preserves the existing `0.01` clearance, `0.05` car model offset, `0.1` minimum fallback, and floating-prevention thresholds instead of switching vehicle placement to track road-clearance metadata, because road-clearance metadata is for road/terrain shaping and would visibly change vehicle height. The pitch/roll path is applied to a child visual group in the shared local car component and in remote car rendering when a terrain sampler is available, keeping simulation, collision, and socket state on the parent position/yaw path. `vehicleVisualSurfaceFrame.ts` owns the Three.js quaternion application for the visual group, while the current rendered tilt scale is visual-only and can be tuned without changing the terrain math.
- The existing five camera modes should be treated as presets for now, not removed. They gave slightly different feel and were useful while fighting browser/computer-specific flicker and choppiness. Future work should measure and improve them from shared helpers instead of deleting them during cleanup.
- Shared circle collision response now owns the low-level 2D overlap / push-out math. Shared car circle collision now owns the tree, start-gate pole, and other-player collision loops for Australia, Belgium, San Luis, and legacy Aspen car, including the standard tree quick-reject distance where those tracks use it and the vehicle min-distance guard. Shared car collision-frame orchestration now owns tree, pole, optional advertising-board, and player collision ordering plus speed-multiplier application for Australia, Belgium, San Luis, and legacy Aspen car while preserving Belgium/Aspen diagnostic callbacks and boardless San Luis behavior. Shared car handling config owns the collision radius, push margins, near-zero guard, tree check distance, and speed-loss multipliers.
- Shared car handling now also owns advertising-board collision thickness, margin, push padding, board-sliding tangent threshold, board-sliding direction selection, and the per-frame board-sliding forward-adjustment decision for Australia, Belgium, and legacy Aspen car. Shared car board collision now owns the curved-board quick-distance check, sampled nearest-point/segment search, push-out, and sliding tangent calculation while reusing each vehicle component's existing scratch vectors to preserve frame-loop allocation behavior. The board collision margin/push padding were increased after United Kingdom testing so cars do not visibly enter the wall as much, but future barrier work should still prefer authored physical wall geometry over endlessly tuning visual board collision.
- Shared spatial track helpers now own nearest-sample lookup and brute-force closest-curve search. Australia and Belgium still use their spatial hashes for fast track proximity checks; Aspen snowmobile uses hilly track samples; San Luis uses the shared brute-force helper while preserving its narrower track thresholds.
- Shared spatial track helpers now also own the standard indexed informational track-position lookup: use the nearest indexed sample `t` when available, otherwise fall back to coarse-only curve search. Shared indexed track query helpers now bundle the repeated on-track, near-track, and informational track-position wrappers for Australia, Belgium, and legacy Aspen car while San Luis and legacy Aspen-local snowmobile keep their different lookup implementations for now.
- Shared track proximity config now owns on-track distance, near-track distance, and start tolerance for standard car tracks, San Luis, and snow tracks. This keeps San Luis narrow without hiding special thresholds in its vehicle component.
- Shared track proximity helpers now also own indexed near-track checks and indexed on-track checks for the standard spatial-index path. Australia, Belgium, and legacy Aspen car use shared helpers for `nearTrackDistance`, start tolerance, on-track distance, and the 60-sample coarse fallback while San Luis and legacy Aspen-local snowmobile keep their different proximity implementations for now.
- Shared track surface profiles now own track width, shoulder width, total width, edge clearance, and current centerline offsets for boards/walls. Australia, Belgium, San Luis tree placement, snowmobile track/wall systems, and remaining legacy track data now pull those numbers from named profiles instead of local magic constants.
- Shared horizontal track frames now preserve the current flat-track right-vector convention (`worldUp x tangent`) used by road rendering. The parallel-transport frame helper remains available for future hilly road work where the road should follow changing terrain normals instead of forcing a world-up surface.
- Static track-authoring metadata now records each current track's identity, layout source, road profile, start-line method, terrain intent, scenery/barrier status, lap-validation policy, camera modes, and performance budgets. This is the first step toward treating tracks as authored data assets instead of copied component folders.
- Track-authoring metadata distinguishes current elevation source from planned elevation source. Belgium and Australia can remain flat for now while the codebase is prepared for sampled real-world elevation later.
- Track runtime config now resolves metadata profile keys into the actual shared surface profile and proximity config. This is the bridge from authored track data to runtime systems, and it prevents a track from declaring profile names that the game cannot use.
- Track data, advertising boards, tree placement, and snow wall placement now read road width/offset data through track runtime config instead of importing profile constants directly. This moves road/scenery spacing toward authored track data while preserving the current values.
- Spatial track index settings are now explicit metadata. The current four tracks all use the same spatial hash defaults: grid size `50` and `2200` samples. Their world extents are still not identical: GeoJSON layouts are normalized through the importer, San Luis is hand-authored in its own coordinate range, and snowmobile terrain has its own chunk grid.
- Track data now consumes spatial index metadata when building runtime hashes, so grid size and sample count can vary by track later without editing component logic.
- GeoJSON import world size is now explicit metadata for imported tracks. Australia, Belgium, and Aspen currently preserve the existing `2500` world-size normalization, while San Luis remains hand-authored without GeoJSON scaling.
- GeoJSON waypoint import now supports optional `[lon, lat, elevation]` coordinates and `coordinateElevationScale` / `coordinateElevationOffset` controls, while preserving the existing `getY` override hook. United Kingdom and Germany both use elevated runtime JSON files; this remains the foundation for future enriched elevation sources on additional tracks.
- Aspen snowmobile terrain mesh grid settings are now explicit metadata and consumed by `SnowmobileWorld`: segment size `400`, resolution `80`, and render distance `2000`. This is separate from the track spatial hash grid.
- Runtime config now derives a road corridor config from each track's surface profile and terrain metadata: road width, shoulder width, blend distance, and road clearance. This gives future hilly Belgium/Australia/San Luis terrain one shared road-first contract.
- Legacy road-height influence falloff is now centralized in the road corridor module and driven by runtime road-corridor config. It preserves the current `0.8` road-width flat zone and `1.2` total-width outer blend behavior for now, but gives the future terrain system one place to replace that with proper corridor shaping.
- Road-corridor terrain sampling now has a reusable height-sampler wrapper in `frontend/src/racing/core/roadCorridor.ts`. Terrain renderers can feed natural terrain height through the corridor sampler so the road and shoulder stay at track height and nearby terrain blends back out, creating the channel/trench behavior needed to prevent future hilly terrain from clipping through the road.
- Lap validation calls now read the minimum lap distance ratio and reached-end requirement from track metadata. This preserves the current 90% distance rule and San Luis's stricter reached-end validation while making lap rules track-authored.
- Track metadata now includes planned sector/checkpoint authoring, and runtime config resolves simple evenly spaced sectors. Live lap validation has not switched to checkpoint enforcement yet, but the foundation is in place for proper sector timing and stronger anti-shortcut validation.
- Track metadata now separates visual start-gate width from lap-crossing timing-line width/depth. Vehicle start-line projection now constructs its timing gate from track runtime config, preserving the current standard-track 18-unit crossing width, San Luis 12-unit crossing width, and 4-unit crossing depth.
- Start-line pose resolution now has a shared runtime helper in `frontend/src/racing/tracks/trackStartPose.ts`. Australia resolves its current longest-straight start pose through the shared derived method, Belgium resolves its start position from track metadata `curveT` plus direction policy, and San Luis resolves its explicit start position/direction from metadata.
- San Luis now uses the same shared initial race-camera setup path as Australia and Belgium. The racing Canvas camera position and first look-at target are derived from the track start pose rather than a hardcoded San Luis camera position, keeping countdown/start framing aligned with authored start-line data.
- Start-gate presentation math now has a shared helper in `frontend/src/racing/components/startGatePresentation.ts`. Australia, Belgium, and San Luis derive gate pole positions, checkered-strip rotation, and start-light facing from the resolved start pose while preserving the current visual/collision gate offsets.
- Track metadata now separates visual barriers from wall collision behavior. Aspen snowmobile keeps its intentionally tall/invisible wall collision profile because snowmobiles can jump over visible boards; that behavior now lives in metadata instead of only in `SnowmobileWorld.tsx`.
- Shared elevation providers now model flat, procedural, sampled, and authored height sources with normals and road clearance. They are not fully wired into every track yet, but they define the API that Belgium/Australia real-world elevation and future San Luis authored hills should use.
- Track elevation provider resolution now creates flat providers for current flat tracks and requires an injected height function for terrain-system tracks like Aspen. This prevents future hilly tracks from accidentally falling back to flat terrain when their height data is missing.
- Track events are now separate from track identity. Aspen is authored as a snowmobile-only track/event, preserving snowmobile handling plus invisible high wall collision without implying an official Aspen car event.
- The shared showroom/track preview UI now reads playable options from official track events and can filter them by vehicle mode. Car-only views expose Australia, San Luis, and Belgium; the Aspen wrapper exposes the Aspen snowmobile event instead of importing the legacy Aspen car track as a car option.
- The main app entry showroom can expose all official playable events, including Aspen, but selection is routed by `TrackEventId`. Aspen now switches to the Aspen snowmobile wrapper instead of being interpreted as a car-track variant.
- Showroom track selection now notifies the page-level event router immediately, without starting the race. This keeps the selected-event preview honest: choosing Aspen mounts the Aspen snowmobile showroom instead of leaving the fox displayed in the currently mounted car showroom until START RACE.
- The page-level track router now uses `selectedEventId` plus `pendingStartEventId` instead of separate selected-track strings and one start flag per non-Australia track. Australia is an explicit `australia-car` render case, not the implicit fallback, so the initial default event can change later without hiding routing behavior.
- Australia, San Luis, Belgium, and Aspen wrappers now receive the same page-level event-change callback. Their showrooms can expose the official event list and hand off on START if the selected event belongs to a different wrapper.
- The Australia car game wrapper no longer imports legacy Aspen track data or routes an Aspen selection from the car showroom. Its showroom world now renders a car explicitly; Aspen snowmobile remains owned by the Aspen wrapper and `SnowmobileWorld`.
- Lap track-name validation now reads the official event display-name list instead of repeated hardcoded arrays. This keeps transaction validation aligned with the authored playable events while preserving current leaderboard track names.
- Lap result, transaction-server payload, and multiplayer lap-transaction broadcast payload construction now live in shared transaction modules. The four track wrappers re-export the same `PixelRacingGameResult` type, use a shared `/createpixelracing` submission service, and Australia/Belgium/Aspen use shared server-aligned lap-time bounds for submission validation.
- San Luis now uses the same lap submission candidate validation path as Australia and Belgium. Completed San Luis laps must pass racing-status, official-track, lap-time, and complete fox identity checks before building/submitting a lap result, so missing wallet/fox data no longer creates fallback empty lap identities.
- Lap completion submission now has one shared transaction workflow that builds the inscription payload, posts to the transaction server, returns the stats activity row, and returns the multiplayer socket payload. The wrappers still add the lap locally before awaiting the server, preserving the current non-blocking gameplay and small txid loader behavior.
- Australia, Belgium, and San Luis now call `runPixelRacingLapCompletionWorkflow` in `frontend/src/racing/transactions/lapSubmission.ts` for the wrapper-level lap-completion flow. Duplicate-submit guarding, validation, lap result construction, transaction submission, txid/lap activity/socket side effects, error cleanup, and lap timer reset are shared while each wrapper keeps its local React state callbacks.
- Current duplicate-submission protection is mostly frontend-side. Lap submissions are guarded while a request is in flight, and collectible item transactions are guarded by collected/submitted item ids in the browser, while the socket server ignores already-removed items. The transaction server does not yet enforce idempotency for `/createpixelracing` or collectible routes, so real-mode transaction safety still needs server-side idempotency keys and persistence.
- Lap player identity validation now lives in the shared transaction result module. Australia, Belgium, San Luis, and Aspen use the shared complete-identity guard before submission so wallet/fox identity handling no longer diverges between car tracks.
- Standard lap-submission candidate validation now lives in the shared transaction result module. Australia, Belgium, and Aspen no longer duplicate the game-status, official-track-name, server-aligned lap-time, and complete-identity checks in their wrappers.
- Successful lap-submission side effects now run through a shared callback-based helper. The wrappers still own their React state and socket refs, but txid assignment, lap txid indexing, latest activity publishing, and socket broadcast application are no longer copied as one-off blocks.
- Lap completion callbacks now include the player color and distance traveled values they read in their dependency lists, reducing stale metadata risk in lap result construction and diagnostics.
- Shared race lifecycle reset now exists for start, immediate-start, and restart paths. Australia, San Luis, Belgium, and Aspen use callback-based helpers to set joined/loading state where appropriate, clear score/distance/lap timers/lap txids, reset countdown before started races, and return restart flows to the showroom without duplicating state-reset blocks.
- Australia, Belgium, and San Luis now use `startRaceForSelectedTrack` in `frontend/src/racing/simulation/raceLifecycle.ts` for showroom START handling. The helper centralizes "handoff to another selected event or start this wrapper's local race", applies the shared race-start reset, and preserves spawn position for the race minimap when available.
- Australia, Belgium, and San Luis now share the showroom-entry guard, and Belgium/San Luis share the immediate-start lifecycle helper in `frontend/src/racing/simulation/raceLifecycle.ts`. The event wrappers no longer duplicate the immediate loading-state reset; San Luis' default no-spawn minimap position is represented as an explicit fallback option.
- San Luis countdown/loading and restart behavior now matches Australia/Belgium more closely: it uses the default shared loading timeout in `useRaceCountdownFlow` and clears `carPosition` on restart through the shared restart handler.
- Shared multiplayer join-game payload construction now lives in a dedicated multiplayer module. Australia, San Luis, Belgium, and Aspen use one builder for identity key fallback, player display name, wallet/origin fields, player color, optional start-finish position, and track name. This is a future hook for stronger auth/session proof without embedding auth details in track wrappers.
- Shared multiplayer join guards now cover showroom-only joins and active-race/immediate-start joins. The wrappers still choose their track-specific join mode, but the long socket/fox/connection/joined status conditions are no longer copied inline.
- Shared multiplayer current-player matching now covers standard socket-id and identity-key checks. Australia, Belgium, Aspen, and the simpler San Luis paths use one matcher for local player updates, duplicate-player checks, other-player filtering, and current-player display overrides. San Luis keeps its stricter diagnostic socket-priority fallback blocks where ordinal-address matching is intentionally different.
- Current-player multiplayer state patching now uses `patchCurrentMultiplayerPlayer` in `frontend/src/racing/multiplayer/playerIdentity.ts`. Australia, Belgium, and Aspen share local current-player color and track-name patches, while San Luis shares the local track-name patch and preserves its existing no-local-color-patch behavior.
- Incoming `gameState` current-player track preservation now uses `preserveCurrentMultiplayerPlayerTrackName` in `frontend/src/racing/multiplayer/playerIdentity.ts`. Australia, Belgium, San Luis, and Aspen share the rule that keeps the local player's selected track name when the server's per-player state omits it, while their other-player filtering and track-specific logging remain local.
- Incoming `gameState` reconnection checks now use `findMultiplayerPlayerBySocketId` in `frontend/src/racing/multiplayer/playerIdentity.ts`. Australia, Belgium, San Luis, and Aspen share the current-socket lookup before setting `hasJoined` from server state, while keeping the local state/ref side effects in their wrappers.
- Racing quality presets now live in `frontend/src/racing/performance/qualitySettings.ts`. The first wired consumer is remote-player rendering/collision culling: Australia, Belgium, San Luis, and Aspen use the selected preset to keep nearby players first, cap visible remote players, and preserve Aspen's existing 300-unit medium remote-player distance as shared configuration instead of local hardcoded filtering. A shared showroom quality selector now exposes Low, Medium, and High settings, persists the choice in `localStorage`, and feeds the selected preset into the playable event wrappers.
- Quality presets now also drive Canvas renderer budgets in the playable worlds. Australia, Belgium, San Luis, and Aspen use the selected preset for DPR caps and shadow enablement; Aspen snowmobile also uses the preset to choose antialiasing for showroom/race Canvas setup. This keeps the first performance controls device-aware without changing vehicle physics, lap timing, or socket protocol.
- Dev-only fake multiplayer load generation now starts in `frontend/src/racing/multiplayer/fakeRemotePlayers.ts`. Australia can opt into deterministic fake remote players with `VITE_RACING_FAKE_PLAYERS=<count>` so quality presets, remote-player culling, rendering, and collision budgets can be tested at higher player counts without needing real users. `VITE_RACING_FAKE_PLAYER_SPEED=<scale>` can multiply fake remote movement speed for smoothing/interpolation stress tests. The helper clamps to 100 fake players and defaults to zero, so normal gameplay is unchanged unless the env flag is set.
- Shared race UI now shows an FPS counter during countdown/racing and exposes the Low/Medium/High quality selector during active race UI, not only in the showroom. During active car races, quality uses a left-side vertical panel below the camera-mode selector, with FPS embedded in that panel so the upper-right lap/speed/distance HUD stays clear. When Australia fake remote players are enabled, the same panel reports visible/configured fake remote counts so quality-preset culling can be measured without trying to visually count scattered cars. Fake players now default to a close first ring around the local car so load testing is visually obvious.
- Manual Australia fake-load validation with `VITE_RACING_FAKE_PLAYERS=50` confirmed the selected preset is applied end to end: Low shows 8/50 fake remotes, Medium shows 16/50, and High shows 32/50. High measured roughly 30-50 FPS on the tested machine, which makes remote-player LOD the next useful scalability target instead of simply increasing visible-player caps.
- Australia remote-player LOD now starts in `frontend/src/racing/multiplayer/remotePlayerLod.ts`. The helper keeps the existing preset caps, sorts by local distance with stable index tie-breaks, and assigns near/mid tiers with preset-specific near budgets. It now accepts the previous visible ids and previous LOD tiers so Australia can retain already-visible remotes within a small distance buffer and apply near/mid hysteresis instead of churning every frame near culling or detail boundaries. Australia fake-load remotes are anchored around the start line instead of being regenerated around the local car every position update, and they move deterministically at a low simulated network cadence so culling/interpolation can be tested against moving remote cars. Australia renders near remotes as the full car plus ordinal fox/chat details, while mid remotes use a simplified car and skip fox texture/chat work. High-quality fake-load reuses the local player's fox texture for near-tier fake remotes to pressure-test the expensive fox path, while Low/Medium fake-load cars stay cheaper.
- Belgium and San Luis now use the same `remotePlayerLod` classifier for real remote players. Australia remains the fake-load testbed, but all car tracks now share near/mid remote rendering behavior: near remotes keep fox/chat details, while mid remotes use the cheaper car model and skip fox/chat work.
- Car-track remote LOD rendering now has a shared wrapper hook in `frontend/src/racing/multiplayer/useRemotePlayerLodRendering.ts`. Australia, Belgium, and San Luis no longer duplicate visible-id retention, tier hysteresis state, ordinal fox URL mapping, or near/mid detail stripping in their route wrappers. Aspen still shares the quality preset and packet-batching foundation, but its snowmobile remote renderer remains separate.
- Remote car rendering now separates the moving interpolation wrapper from memoized near/mid visual model subtrees in `frontend/src/components/foxracing/OtherPlayerCar.tsx`. Batched position/rotation updates still reach the wrapper refs, but static mesh trees avoid React re-render work when only remote position changes.
- Australia, Belgium, and San Luis worlds now share `frontend/src/components/foxracing/RemotePlayerCars.tsx` for the remote-car render layer. This removes repeated `otherPlayers.map(...)` rendering in each car world while deliberately keeping the component beside the existing shared `OtherPlayerCar` implementation until that larger renderer is ready to move.
- Server game-state remote-player mapping now uses `buildRacingWorldPlayersForTrack` in `frontend/src/racing/multiplayer/worldPlayers.ts`. Australia, Belgium, and San Luis share current-player exclusion, same-track filtering, existing remote color preservation, fallback color assignment, and rendered-player construction. San Luis still passes a socket-first current-player matcher so multiple local test clients using the same identity/wallet do not hide each other when socket ids are available.
- Incoming car-track `gameState` snapshots now use `applyCarTrackGameStateSnapshot` in `frontend/src/racing/multiplayer/gameStateSnapshot.ts`. Australia, Belgium, and San Luis share current-player track preservation, rendered remote-player rebuilding, and reconnect current-player detection while keeping socket listener registration, requestAnimationFrame scheduling, item state updates, and San Luis diagnostic logging wrapper-local.
- Multiplayer appearance helpers now cover optional server-side `carColor` fields as well as rendered remote players. Australia, Belgium, and San Luis use `applyPlayerCarColorUpdate` for both remote-player color state and Current Players display state, keeping the car tracks aligned for player appearance updates.
- Local car-track appearance sync now uses `frontend/src/racing/multiplayer/useCarTrackPlayerAppearanceSync.ts`. Australia, Belgium, and San Luis share the same joined-player color/track-name emit behavior and immediate Current Players self-patching, so local player appearance updates no longer drift between car tracks.
- Incoming car-track `playerJoined` state now uses `applyJoinedCarTrackPlayer` in `frontend/src/racing/multiplayer/playerJoined.ts`. Australia, Belgium, and San Luis share Current Players append, local-player rendered append skipping, and remote rendered-player append behavior. San Luis still passes socket-first current-player matching for same-wallet local testing, but the state transition itself is no longer wrapper-local.
- Incoming car-track `playerLeft` state now uses `applyLeftCarTrackPlayer` in `frontend/src/racing/multiplayer/playerJoined.ts`. Australia, Belgium, and San Luis share removal from both Current Players state and rendered remote-player state instead of duplicating two separate array filters in each wrapper.
- Incoming car-track `gameJoined` state now uses `applyCarTrackGameJoined` in `frontend/src/racing/multiplayer/gameJoined.ts`. Australia, Belgium, and San Luis preserve existing spawn position and emit current game status after join when already past showroom. San Luis still explicitly replaces existing current-player state through an option, but spawn and status-emission behavior now align across car tracks.
- Car-track join lifecycle listener registration now uses `registerCarTrackJoinSocketListeners` in `frontend/src/racing/multiplayer/socketConnection.ts`. Australia, Belgium, and San Luis share `gameJoined`, `playerJoined`, and `playerLeft` registration/logging shape while wrapper callbacks still own track-specific state details; San Luis keeps socket-first identity matching and diagnostic logs for same-wallet local testing.
- Car-track `gameState` socket listener registration now uses `registerCarTrackGameStateSocketListener` in `frontend/src/racing/multiplayer/carTrackGameStateSocketListeners.ts`. Australia, Belgium, and San Luis share requestAnimationFrame scheduling, snapshot application, item updates, rendered remote-player replacement, and reconnect `hasJoined` recovery while San Luis keeps socket-first current-player matching and diagnostic logs through options.
- Car-track live player socket listener registration now uses `registerCarTrackLivePlayerSocketListeners` in `frontend/src/racing/multiplayer/carTrackPlayerSocketListeners.ts`. Australia, Belgium, and San Luis share `playerPositionUpdate`, car-color updates, track-name updates, chat routing, and collision update registration while wrappers pass their default track label, socket id getter, and local state callbacks.
- The route-facing Pixel Fox Racing page now lazy-loads the four event wrappers instead of importing all event worlds eagerly. The production entry chunk dropped from roughly 1.83 MB JS / 534 kB gzip to roughly 594 kB JS / 192 kB gzip, and the event wrappers now build as separate chunks. One shared racing/vendor chunk remains around 952 kB JS / 265 kB gzip, so the bundle warning is reduced but still a real follow-up target for deeper renderer/vendor chunking.
- Shared scenery quality budgets now live in `frontend/src/racing/performance/sceneryQuality.ts`. The helper exposes tested Low/Medium/High density, detail-distance, rolling-hill-layer, and scaled-count settings for non-gameplay visual cost. Australia uses it for rain particle count and distant rolling hills, Belgium uses it for distant rolling hills, and Aspen snowmobile uses it for snowfall and snow-spray particle counts. Australia/Belgium/San Luis tree counts and San Luis mountain layers are intentionally unchanged for now because those rendered placements also feed collision targets, and quality presets should not silently change the obstacle layout.
- Player-left cleanup now uses `removeMultiplayerPlayerById` in `frontend/src/racing/multiplayer/playerIdentity.ts`. Australia, Belgium, San Luis, and Aspen share the removal rule for both Current Players state and rendered `otherPlayers`.
- `gameJoined` current-player insertion now uses `upsertCurrentMultiplayerPlayer` in `frontend/src/racing/multiplayer/playerIdentity.ts`. Australia, Belgium, and Aspen share merge-over-existing behavior, while San Luis preserves its previous replace-existing behavior through an explicit option.
- `gameJoined` spawn-position resolution now lives in `frontend/src/racing/multiplayer/gameJoined.ts`. Australia, Belgium, and Aspen share preserve-existing-spawn behavior, while San Luis still resets spawn/minimap position on join using the same server-position-or-default resolver.
- `gameJoined` current-player construction now uses `buildGameJoinedCurrentPlayer` in `frontend/src/racing/multiplayer/gameJoined.ts`. Australia, Belgium, San Luis, and Aspen share socket id, identity, name, score, wallet address, origin outpoint, color, and track-name normalization before upserting into Current Players state.
- Incoming `playerJoined` Current Players state construction now uses `buildJoinedGameStatePlayer` in `frontend/src/racing/multiplayer/playerJoined.ts`. Australia, Belgium, and Aspen share the initial position/rotation/speed shape, while San Luis keeps its leaner state shape plus stored car color.
- Shared multiplayer track matching now covers same-track filtering for rendered other players. Fallback track names are now wrapper-local compatibility defaults: Australia falls back to `Australia`, Belgium to `Belgium`, San Luis to `San Luis`, and Aspen to `Aspen` when older socket payloads omit `trackName`.
- Shared multiplayer player patching now covers simple player-list updates by id. Car color updates, track-name updates, and chat same-track guards now reuse multiplayer helpers instead of repeating inline player mapping and track comparison logic.
- Incoming socket activity rows for item pickups and completed laps now use one shared transaction-to-activity builder instead of repeating owner/outpoint/link/dummy/track fallback mapping in each wrapper. Belgium and Aspen now fall back to their own track names when socket data is missing a `trackName`, so Australia is not treated as a hidden global default.
- Socket listener registration for `newItemTransaction` and `newGameTransaction` now lives in `frontend/src/racing/transactions/socketActivity.ts`. The four wrappers pass their local fallback track name and latest-activity callback instead of duplicating item/game transaction listener bodies.
- Socket connection lifecycle registration now lives in `frontend/src/racing/multiplayer/socketConnection.ts`. Australia, Belgium, San Luis, and Aspen share connect/disconnect/connect-error state updates and logging, while San Luis keeps its active-race reconnect auto-join behavior as a wrapper-local callback.
- Track-data construction diagnostics now route through `frontend/src/racing/debug/diagnostics.ts` and only print when `VITE_RACING_DIAGNOSTICS=true`. This prevents route/showroom imports from making a Belgium run look like Australia and Aspen are actively loading, while keeping geometry diagnostics available when needed.
- Vehicle frame-loop diagnostics now use the same diagnostics helper for performance samples, camera traces, gate traces, collision debug, and routine gas-audio play failures. True runtime error paths still use direct console errors so invalid simulation state remains visible during normal dev testing.
- Spatial track lookup now handles `refineSamples: 0` as a valid coarse-only query instead of producing `NaN` curve parameters. This fixes the San Luis near-track check crash path that surfaced as repeated `distanceToSquared` errors in the render loop.
- Existing Aspen car component files may still be present during the refactor, but they should be treated as legacy/unofficial unless deliberately reintroduced as a supported event later.
- The Aspen component folder now documents that the official live route is `aspen-snowmobile` through `snowmobilerace/SnowmobileWorld`. Legacy Aspen-local `FreeRoamCar`, `FreeRoamSnowmobile`, and `FoxRacingWorld` files are marked as migration references so contributors do not confuse them with the official event path.
- Shared Aspen scenery has started moving out of the confusing legacy vehicle folder. `StadiumSeating.tsx` now lives under `frontend/src/components/aspen`, and both the live snowmobile world and legacy Aspen-local world import it from that neutral Aspen scenery path.
- Deterministic scenery randomness now lives in `frontend/src/racing/core/seededRandom.ts`. Australia, Belgium, San Luis, Aspen legacy scenery, Aspen shared scenery, and the live snowmobile world use the same RNG and world seed instead of keeping duplicate track-folder implementations.
- Shared distant mountain rendering now lives in `frontend/src/racing/components/DistantMountains.tsx` for car-track scenery, using instanced meshes instead of per-mountain meshes. San Luis keeps its explicit `radius={2000}` and `layers={5}` usage, while unused duplicate local mountain files were removed. Aspen snowmobile mountains remain local for now because their winter placement, color, and height profile differ.
- Shared tree instanced rendering now lives in `frontend/src/racing/components/TreeInstances.tsx`. Australia, Belgium, San Luis, and legacy Aspen tree placement still stays track-local because each file has different exclusion rules for road width, boards, lakes, start gates, stadiums, snow palette, and culling. The duplicate trunk/foliage mesh setup is now shared without normalizing track identity.
- Australia, Belgium, and San Luis tree placement now reports generated collision trees from effects instead of updating parent state during render. This keeps the same deterministic tree positions while removing render-phase state updates from car-track scenery.
- Belgium's static racing-world scenery is now isolated behind a memoized scene boundary so collectible item removal can update the dynamic pickup layer without walking Belgium's heavier board, tree, track, hill, and stadium JSX subtree.
- Shared rolling hill rendering now lives in `frontend/src/racing/components/RollingHills.tsx`. Australia and Belgium use the default green hill palette, while legacy Aspen passes an explicit snow color scheme to preserve its winter look. Duplicate local rolling-hill renderers were removed.
- Stadium left/right stand placement now uses shared `getStadiumStandPlacement` math. Australia, Belgium, San Luis, and Aspen still render their existing stadium structures locally, but the perpendicular offset, ground-height application, and stand-facing rotations are no longer copied by hand.
- Stadium expensive-detail visibility now uses shared `shouldRenderStadiumDetail` and shared default distances. Australia, Belgium, and San Luis still hide only fox billboards at distance so structures remain visible; Aspen keeps its current behavior of hiding the whole stadium structure and foxes together for winter-track performance.
- Stadium fox shuffling and seat placement now use shared `shuffleStadiumFoxes` and `getStadiumFoxPlacements`. This preserves deterministic crowd layout, repeated fox selection when seats outnumber unique foxes, side-specific rendering, and the current billboard placement offsets while removing the copied batching math from each stadium component.
- The shared billboard stadium fox renderer, voxel preload path, and texture-atlas builder now live in `frontend/src/racing/components/BillboardStadiumFoxes.tsx`. Track stadium components still own local structure geometry, but the expensive billboard crowd renderer is no longer a root-level legacy component.
- Stadium fox preload, deterministic shuffle, texture-atlas lifecycle, and seat placement now run through shared `useStadiumFoxes`. Australia, Belgium, San Luis, and Aspen still own their structure geometry and distance-visibility choices, including Aspen's full-stadium hide behavior.
- The active Aspen wrapper now uses vehicle/snowmobile naming for its minimap position and loading state. The remaining `onCarLoaded` and `carPosition` names are component prop contracts that should be renamed later when the shared minimap and snowmobile world APIs are extracted.
- Shared minimap geometry now lives in `frontend/src/racing/components/minimapGeometry.ts`, and the duplicated canvas renderer now lives in `frontend/src/racing/components/TrackMinimap.tsx`. Australia, Belgium, legacy Aspen, and snowmobile minimap files remain thin track adapters so their existing `carPosition` prop contracts and default track data stay stable while the actual bounds sampling, flipped projection, checkered flag, draw layers, and position-change throttling are shared.
- Shared HUD formatting now lives in `frontend/src/racing/components/hudFormat.ts`. The main racing UI and San Luis legacy UI use the same lap-time and txid-shortening helpers while keeping their current JSX layout differences.
- The lap-times HUD list now lives in `frontend/src/racing/components/RacingLapTimesList.tsx`. The main racing UI keeps its larger top offset and San Luis keeps its compact offset, but the completed-lap row rendering, pending tx spinner, latest-lap highlight, and txid display are no longer duplicated.
- Countdown number rendering now lives in `frontend/src/racing/components/RacingCountdownDisplay.tsx`. Main racing, San Luis, and snowmobile UI share the same countdown color mapping while snowmobile keeps its stronger shadow/monospace variant.
- Distance, speed, current lap time, and optional lap-list HUD metrics now render through `frontend/src/racing/components/RacingHudMetrics.tsx`. Main racing, San Luis, and snowmobile UI share the same metric typography and unit formatting while car tracks keep lap-time/lap-list display and snowmobile stays distance/speed-only.
- Camera mode selector rendering now lives in `frontend/src/racing/components/RacingCameraModeSelector.tsx`. Main racing, San Luis, and snowmobile UI share the same mode order, labels, hover behavior, and selected-state styling while preserving their current panel positions.
- Controls helper rendering now lives in `frontend/src/racing/components/RacingControlsHelper.tsx`. Car UIs keep the `G / W / up-arrow` gas binding text, while snowmobile keeps its `W / up-arrow` and ride-specific camera snap copy.
- Wallet/connect idle overlays now render through `frontend/src/racing/components/RacingConnectOverlay.tsx`. Car tracks and snowmobile keep their current background images and class names while sharing the backdrop and Faucet Panda button structure.
- Showroom color swatches now render through `frontend/src/racing/components/RacingColorPicker.tsx`. Main racing and San Luis keep the compact 30px swatches, while snowmobile keeps its larger 36px hover-scale variant through props.
- Snowmobile showroom controls now live in `frontend/src/racing/components/SnowmobileShowroomControls.tsx`, keeping the Aspen-specific title, sled color label, hover styling, and start-riding action out of the route-level `SnowmobileUI` wrapper.
- Car-track crash overlays now render through `frontend/src/racing/components/RacingCrashOverlay.tsx`, keeping the crashed modal text, distance display, and restart action in one shared UI component.
- FPS counter timing and color thresholds now live in `frontend/src/racing/components/RacingFpsCounter.tsx`. Snowmobile UI and world overlays share the same counter while preserving their current top offsets and z-index behavior.
- The FPS counter can also render statically inside another HUD panel. The active car-race quality panel uses that mode so FPS updates stay isolated inside the memoized counter instead of forcing the broader racing UI to update every animation frame.
- Player online-count badges now render through `frontend/src/racing/components/RacingOnlineBadge.tsx`, giving multiplayer overlays a shared small status badge instead of keeping that styling inside the snowmobile UI file.
- Manual/follow camera control buttons now render through `frontend/src/racing/components/RacingCameraControlButtons.tsx`. Aspen snowmobile world still owns camera state and zoom/rotate handlers, but the repeated control cluster, fullscreen button, titles, and active manual-camera styling are shared UI.
- Fullscreen container state and toggle handling now lives in `frontend/src/racing/components/useFullscreenToggle.ts`. Standalone snowmobile and legacy Aspen snowmobile wrappers share the same request/exit fullscreen flow, ESC-key synchronization, and error logging.
- Preloaded audio element construction now lives in `frontend/src/racing/components/audioElements.ts`. Car tracks and snowmobile wrappers still own playback, mute, looping, and event timing, but repeated `new Audio` preload/volume/loop setup has one helper.
- Simple audio playback/reset/error logging now also routes through `playAudioElement` in `frontend/src/racing/components/audioElements.ts`, so ding and countdown-beep calls share one wrapper while preserving their existing reset behavior and log messages.
- Repeated idle background-audio toggle state now lives in `useLoopingIdleAudio` in `frontend/src/racing/components/audioElements.ts`. Australia, San Luis, Belgium, and legacy Aspen still own when to autoplay/pause/resume audio, but mute/unmute state, loaded-metadata duration tracking, early loop rewind, and cleanup have one implementation.
- Gas press/release idle-audio pause and resume now also route through `useLoopingIdleAudio`. Australia, San Luis, Belgium, and legacy Aspen pass shared callbacks into their worlds instead of carrying local `wasIdlePlayingBeforeGas` logic in each route wrapper.
- Loading overlay rendering now lives in `frontend/src/racing/components/RacingLoadingOverlay.tsx`. Australia, Belgium, San Luis, and Aspen use the shared black/white spinner overlay, while the Aspen snowmobile UI uses the same component with its blue spinner, `LOADING WORLD...` label, and lower z-index.
- Choose Player modal loading now waits for wallet address lookup and ord/bsv ordinal fetches before rendering empty search results. This keeps the white search-results loader visible while data is still pending and prevents a premature "You don't have any foxes" empty state; the separate modal preloader remains a black PulseLoader.
- Shared player color defaults now live in `frontend/src/racing/core/playerColors.ts`. Racing UI color pickers, car-track multiplayer fallback colors, and Aspen snowmobile defaults use the same palette/order, with fallback indexing routed through the shared `getPlayerColorByIndex` helper instead of local modulo expressions.
- Current Players panel rendering now lives in `frontend/src/racing/components/CurrentPlayersPanel.tsx`. Australia, Belgium, San Luis, and Aspen still own socket/game-state updates and pass their track fallback labels, but the sorted player cards, color/fox thumbnail display, abbreviated ordinal address, and wallet item totals are shared.
- Current Players parent-callback rendering now lives in `frontend/src/racing/components/useCurrentPlayersPanelRender.tsx`. Australia, Belgium, San Luis, and Aspen pass the same panel inputs through one hook instead of duplicating the `onCurrentPlayersRender` effect in every wrapper.
- Local player fox/address panel rendering now lives in `frontend/src/racing/components/RacingPlayerInfoPanel.tsx`. The Aspen wrapper and older standalone snowmobile simulator pass their own colors, image sizing, address rows, copy behavior, and wallet item counts without duplicating the linked fox image/name and short-address layout.
- Chat send handling now lives in `frontend/src/racing/components/useRacingChatSender.ts`. Australia, Belgium, San Luis, Aspen, and the older standalone snowmobile simulator share trim/empty-message guard, max-length clipping, `playerChat` emit, local echo, and input clearing while preserving the simulator's longer 50-character limit.
- Collectible pickup and item transaction actions now live in `frontend/src/racing/components/useCollectibleItemActions.ts`. Australia, Belgium, San Luis, and Aspen share duplicate-pickup guarding, optimistic ding playback, `collectItem` emit, transaction submission, latest-activity updates, wallet count callback, and shared transaction broadcast construction while wrappers still decide where collected items are rendered.
- Collectible socket state updates and listener registration now live in `frontend/src/racing/collectibles/collectibleSocketEvents.ts`. Australia, Belgium, and San Luis share collected-item removal, collected-player score updates, current-player item transaction triggering, and duplicate-safe spawned-item insertion while Aspen keeps collectibles disabled for the Aspen track.
- Australia, Belgium, and San Luis now treat local collectible pickup as authoritative for local feedback: the wrapper removes the collected item immediately and schedules the item transaction locally, while the socket `itemCollected` echo still updates shared item/player state. Item transaction submission is guarded by item id so a local pickup and its server echo cannot submit duplicate dummy transactions.
- Collectible removal now preserves the existing item array when a socket echo references an already-removed item, avoiding a redundant React update after local authoritative pickup.
- Collectible pickup transaction work now follows the lap-completion model more closely: collection emits leave the vehicle frame via a queued task, and current-player item transaction submission waits for browser idle time with a timeout fallback. This keeps immediate pickup feedback while reducing driving-frame stalls from inscription work.
- Collectible vehicle pickup detection now lives in `frontend/src/racing/collectibles/collectiblePickup.ts`. Australia, Belgium, San Luis, legacy Aspen car, and legacy Aspen-local snowmobile share the same two-unit collection radius and first-nearby-item-per-frame rule instead of repeating distance checks inside their vehicle frame loops.
- Multiplayer collision socket state updates now live in `frontend/src/racing/multiplayer/playerCollision.ts`. Australia, Belgium, San Luis, and Aspen share the same "skip the current socket, sync the remote collision players" position/rotation/isWalking update while keeping their wrapper-level socket logs and follow-up position-update behavior.
- Multiplayer position socket state updates now live in `frontend/src/racing/multiplayer/playerPosition.ts`, and shared 30ms batching now lives in `frontend/src/racing/multiplayer/useBatchedPlayerPositionUpdates.ts`. Australia, Belgium, San Luis, and Aspen queue incoming `playerPositionUpdate` packets and apply the latest update per remote player in batches, reducing React state churn while preserving `OtherPlayerCar`/snowmobile interpolation between batches.
- Multiplayer appearance socket state now has shared `frontend/src/racing/multiplayer/playerAppearance.ts` helpers for remote car/sled color updates and Current Players track-name updates. Australia, Belgium, San Luis, and Aspen no longer duplicate the `otherPlayers` color array-copy patch or `gameState.players` track-name patch, while each wrapper still preserves its existing Current Players color update behavior.
- Incoming multiplayer chat routing now lives in `frontend/src/racing/multiplayer/playerChat.ts`. Australia, Belgium, San Luis, and Aspen share blank-message filtering, local echo detection, same-track remote-message gating, and rendered player chat-bubble updates while preserving their existing fallback track labels.
- Race restart cleanup now lives in `frontend/src/racing/components/useRaceRestartHandler.ts`. Australia, Belgium, San Luis, and Aspen share showroom reset, collected-item clearing, player chat-bubble clearing, and local chat clearing while Australia, Belgium, and Aspen still pass their own minimap position reset.
- Socket transaction activity mapping now lives in `frontend/src/racing/transactions/socketActivity.ts`. Australia, Belgium, San Luis, and Aspen share `txid` validation, fallback-track activity construction, and latest-activity callback handling while preserving the item-transaction log/error behavior.
- Racing world multiplayer display/collision player shapes now live in `frontend/src/racing/multiplayer/worldPlayers.ts`. Australia, Belgium, San Luis, and legacy Aspen worlds still render their own car/snowmobile components, but the full visual player contract and the reduced `{ id, position }` collision target mapping are no longer repeated inline.
- Incoming `gameState` other-player render mapping now uses `buildRacingWorldPlayer` in `frontend/src/racing/multiplayer/worldPlayers.ts`. Australia, Belgium, San Luis, and Aspen share server/existing/fallback color priority, tuple position/rotation conversion, walking-state derivation, and origin-outpoint normalization while keeping track-specific filtering, San Luis' raised default Y position, and Aspen's speed field explicit.
- Incoming `playerJoined` rendered-player creation now uses `buildJoinedRacingWorldPlayer` / `appendJoinedRacingWorldPlayerIfMissing` in `frontend/src/racing/multiplayer/worldPlayers.ts`. Australia and Belgium share duplicate-safe append behavior, San Luis keeps its diagnostic duplicate logging while sharing player construction, and Aspen keeps its same-track gate plus speed field.
- Racing world loading/countdown lifecycle timers now live in `frontend/src/racing/components/useRaceWorldLifecycle.ts`. Australia, Belgium, San Luis, and legacy Aspen keep their own scene composition, but the delayed `onWorldLoaded` and one-shot `onSceneReady` effects are shared.
- Route-level race countdown flow now lives in `frontend/src/racing/components/useRaceCountdownFlow.ts`. Australia, Belgium, San Luis, and Aspen share the world/vehicle-loaded gate, 200ms countdown transition delay, five-second pre-countdown wait, beep trigger, interval cleanup, and transition to `racing`, while preserving San Luis' no-timeout behavior and Aspen's duplicate-scene-ready guard.
- Initial race camera placement and one-shot canvas look-at initialization now live in `frontend/src/racing/components/raceCameraSetup.tsx`. Australia, Belgium, and legacy Aspen share the same start-direction camera offset math while keeping their own scene lighting, terrain, and vehicle rendering.
- Start-light rendering now lives in `frontend/src/racing/components/StartLight.tsx`. The old `frontend/src/components/racing/StartLight.tsx` and `frontend/src/components/racingsanluis/StartLight.tsx` paths are compatibility re-exports so existing world imports keep working while the implementation has one owner.
- Shared car showroom rendering now lives in `frontend/src/racing/components/Showroom.tsx`. The old main and San Luis showroom component paths are compatibility re-exports so track worlds can keep their current imports while the duplicate rotating car preview has one implementation.
- Showroom track preview minimap rendering now lives in `frontend/src/racing/components/TrackPreviewMinimap.tsx`. The old `frontend/src/components/racing/TrackPreviewMinimap.tsx` path is a compatibility re-export for `RacingUI`.
- Unified car/snowmobile showroom rendering now lives in `frontend/src/racing/components/UnifiedShowroom.tsx`. The old `frontend/src/components/racing/UnifiedShowroom.tsx` path is a compatibility re-export for the current Australia and legacy Aspen worlds.
- Chat input bar rendering now lives in `frontend/src/racing/components/RacingChatInputBar.tsx`. Australia, Belgium, San Luis, and Aspen still own chat state and socket sends, but the input/button layout, Enter key handling, propagation stop, placeholder, and 30-character limit are shared.
- Snowmobile chat now also uses `frontend/src/racing/components/RacingChatInputBar.tsx` through compact props, preserving its lower-left placement, player-color send button, 50-character limit, and game-key-only propagation handling.
- Sound toggle rendering now lives in `frontend/src/racing/components/RacingSoundToggle.tsx`. Australia, Belgium, San Luis, and Aspen still own audio state/playback, but the volume icon pair, top-right placement, shadow styling, and 24px icon size are shared.
- Car-track game viewport sizing now lives in `frontend/src/racing/components/racingGameViewport.ts`. Australia, Belgium, and San Luis share the same idle/showroom/race container dimensions, while Aspen keeps its snowmobile-specific `calc(100vh - 60px)` viewport.
- Collectible item transaction metadata, request construction/submission, and payload builders now live in `frontend/src/racing/transactions/collectibleItem.ts`. Australia, Belgium, San Luis, and Aspen still own transaction success side effects and socket emission, but endpoint routes, POST setup, JSON response handling, item score values, item image selection, stats activity payloads, and socket share payloads are no longer repeated in each wrapper.
- Collectible item world rendering now lives in `frontend/src/racing/components/CollectibleItem.tsx`, with the shared blueberry/salad/rabbit item type in `frontend/src/racing/collectibles/collectibleTypes.ts`. Australia, Belgium, San Luis, and legacy Aspen worlds no longer carry identical local `CollectibleItem.tsx` files or duplicate `GameItem` interfaces in their game/world/vehicle props.
- Ordinal content, inscription, and transaction explorer URL formatting now lives in `frontend/src/racing/transactions/ordinalLinks.ts`. Lap result builders, item activity payloads, current-player thumbnails, other-player texture URLs, showroom/free-roam fox textures, New Game search results, snowmobile fox info links, and Pixel Racing stats use the shared URL helpers instead of repeating ORDFS, 1Sat, and Whatsonchain URL templates.
- Short address display now lives in `frontend/src/racing/components/addressFormat.ts`. Current Players, Pixel Racing stats, snowmobile wallet display, and Aspen fox info panels share the same missing/short/long address behavior.
- San Luis now has component-folder notes documenting why it remains special during the refactor: custom hand-authored layout, narrower road profile, explicit start pose, stricter reached-end lap validation, no authored wall/ad-board collision system, and migration-era multiplayer/socket fallbacks. These are supported track differences, not reasons to fork car handling.
- Advertising board placement needs a real edge/offset-curve system. Current boards that follow centerline distance plus per-sample perpendicular offsets can look good on straights and broad curves, but at sharp inside turns the offset path can cross itself and form X-shaped discontinuities. Future board and barrier placement should use track-edge geometry, offset-curve joins, or authored anchor segments instead of raw centerline offset sampling.
- Shared road corridor influence exists as the first terrain contract for future hilly-track work. It should become the bridge between track geometry and terrain mesh generation.
- Core tests now cover track geometry, spatial indexing, start gates, track elevation providers, track proximity, track profiles, track-authoring metadata, track runtime config, road corridor influence, lap validation, race timing, race lifecycle reset, multiplayer join payload construction, multiplayer current-player matching, lap result/payload/activity construction, lap submission response handling, car handling, car camera helpers, and circle collision response.

The next major extraction should be typed track definitions and shared renderer-facing track systems. The car behavior model is already converging; the remaining duplication is now mostly track metadata, world rendering, scenery placement, minimaps, HUD/race state, and the snowmobile-specific vehicle path. This should continue in small steps after the current start gate, lap validation, proximity, and profile behavior has been manually checked in-game on all four tracks.

### Phase 1: Inventory and Safety

- Add a short per-track behavior note for Australia, San Luis, Belgium, and Aspen.
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

- Create typed track definitions for the four existing tracks.
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

Run this checklist for each of Australia, San Luis, Belgium, and Aspen after any refactor touching racing code:

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

- The four existing tracks are still playable and visually better than before.
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
- The codebase feels like a maintainable game suite, not four sequential prototypes.
