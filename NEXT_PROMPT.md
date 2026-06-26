# Next Prompt: Graphics Budgets and Modular Scenery

Continue working in:

`/home/to/Desktop/pixel-fox-racing-suite`

This is the open-source Pixel Fox Racing Suite. Keep changes modular, reviewable, and fork-friendly. Do not copy production directories wholesale.

## Current Direction

The suite now has seven tracks:

- `Australia`
- `San Luis`
- `Belgium`
- `Aspen`
- `United Kingdom`
- `Germany`
- `Volcanoes`

The priority is shared low/medium/high graphics budgets and modular scenery upgrades that tracks can reuse. Avoid adding more per-track scenery forks unless the visual is genuinely unique to that track.

Read `PLAN.md` first. It now describes the graphics budget direction, scenery architecture, Volcanoes notes, and definition of done for graphics upgrades.

## Current Worktree State

There is current uncommitted work around shared scenery quality budgets:

- `PLAN.md` rewritten around seven tracks, shared budgets, and modular scenery.
- `frontend/src/racing/performance/sceneryQuality.ts` now exposes shared effect budgets:
  - `meshDetailScale`
  - `activeLightScale`
  - `particleDensityScale`
- `frontend/src/racing/performance/sceneryQuality.test.ts` updated for those budgets.
- `frontend/src/racing/tracks/imported/volcanoes/VolcanoCaveScenery.tsx` consumes those budgets for:
  - lava mesh detail
  - lava basin shape segments
  - live lava light density
  - smoke and ember emitter density
  - particles per emitter

Verification already run for this work:

- `npm run test:core` from `frontend` passed.
- `npm run build` from `frontend` passed.

The build still reports the existing large chunk warning. Do not hide that warning; report it separately if relevant.

There is also shared procedural surface-material work from Claude:

- `frontend/src/racing/components/materials/proceduralSurfaceConfig.ts`
- `frontend/src/racing/components/materials/proceduralSurfaceConfig.test.ts`
- `frontend/src/racing/components/materials/proceduralSurfaceTextures.ts`
- `frontend/src/racing/components/materials/RacingSurfaceMaterial.tsx`
- `frontend/src/components/racing/Track.tsx`
- `frontend/src/racing/components/SampledTerrainMesh.tsx`
- `frontend/src/components/foxracing/FoxRacingWorld.tsx`
- `frontend/src/components/foxracingbelgium/FoxRacingWorld.tsx`
- `frontend/src/components/foxracingsanluis/FoxRacingWorld.tsx`

This work adds quality-aware procedural asphalt, grass, and volcanic-rock textures.
It is modular and shared — driven by one `RacingSurfaceMaterial` component, not per-track
texture copies — and now spans every track the surface policy targets, not Australia-only.

## Procedural Surface Materials Work

The shared surface system now covers three procedural surfaces, all driven by one
`RacingSurfaceMaterial` component (single source of truth) and one quality-keyed config:

- `asphalt` — tiled tarmac (grain + cracks) for the shared car-track `Track.tsx`.
- `grass` — tiled turf (blades) for ground/terrain meshes.
- `volcanic-rock` — tiled scorched orange dirt (grain + charred lava fissures) for Volcanoes.

Quality-keyed texture budgets (same shape for all three surfaces):

- Low: 256px, sparse detail, no normal map, 1x anisotropy.
- Medium: 512px, moderate detail, no normal map, 4x anisotropy.
- High: 1024px, dense detail, baked normal map, 8x anisotropy.

Key properties:

- `tileWorldSize` is held CONSTANT across quality tiers per surface. An earlier pass shrank
  the tile as quality rose, which multiplied the texture repeat until the GPU mipped every
  tile down to its average colour — so detail vanished and higher settings only looked
  darker. Tile size is now a fixed world-scale value (asphalt 7, grass 26, volcanic-rock 22),
  so quality changes sharpness and relief, not average brightness.
- Cached deterministic canvas generation (painted once per surface+quality, reused).
- DOM-safe fallback: returns a flat tinted material in tests/SSR and for `surface: 'none'`.

Surface policy coverage (per `PLAN.md`):

- Shared asphalt: car tracks that render the shared `Track.tsx` road ribbon
  (Australia, Belgium; imported tracks).
- Shared grass: Australia, Belgium, San Luis, United Kingdom, Germany.
  - Australia / UK / Germany get it through the shared `SampledTerrainMesh` terrain path.
  - Belgium and San Luis get it on their flat ground planes via `RacingSurfaceMaterial`.
- Volcanoes: `volcanic-rock` surface (was previously `none`).
- Aspen: opts out, keeps snow/winter terrain.

San Luis note: only its GRASS plane uses the shared material. Its road still renders the
legacy `racingsanluis/Track`, not the shared ribbon, so it intentionally does not get the
shared asphalt — that stays out of scope until/unless San Luis adopts the shared road ribbon.

Verification reported:

- `npm run build` passed.
- `npm run test:core` passed (505 tests, includes the surface-config tests).
- `npx tsc --noEmit` had no new type errors in the surface-material files; remaining type
  errors are pre-existing.

Coordinate conceptually by keeping budget/scenery work separate from material surface authoring.

Good boundaries:

- Let asphalt/grass work own procedural road and ground material visuals.
- Let graphics-budget work own shared quality knobs, placement counts, effect counts, LOD, lights, particles, and reusable scenery composition.
- If asphalt/grass needs budget inputs, expose a small typed budget hook/helper instead of hard-coding track-specific logic.

## Budget Adoption Status

Shared quality settings exist globally, but adoption is uneven.

Works broadly today:

- Renderer budget: DPR cap, shadows, antialiasing.
- Remote-player budget: render distance and maximum visible remote players.
- Minimap budget: update cadence.
- Scenery density: shared forest/tree placement that uses `getQualityScaledCount`.

Partially adopted:

- Effect budgets. Volcanoes currently consumes them; other tracks can use them but are not wired yet.

Next useful step:

1. Audit all seven tracks and write down which budgets each track consumes.
2. Add a small budget adoption table in docs or a focused markdown note.
3. Wire one non-Volcanoes reusable scenery feature into the shared effect budgets.
4. Keep asphalt/grass changes separate unless they need a shared budget value.
5. San Luis grass now uses the shared material; decide whether San Luis should also adopt the shared road ribbon (and thus shared asphalt) or keep its legacy `racingsanluis/Track` until a larger San Luis refactor.

## Track Notes

### Australia

Treat Australia as the car-track reference for shared systems. Tune shared car-track visuals here first when possible.

### San Luis

Keep useful as a narrow-track compatibility case. Do not break its older tree/scenery setup while moving shared systems forward.

San Luis now receives the shared procedural GRASS via `RacingSurfaceMaterial` on its ground
plane. Its road still uses the separate `racingsanluis/Track`, so it intentionally keeps the
legacy road material (no shared asphalt) until a larger San Luis refactor adopts the shared
road ribbon. Prefer threading shared material helpers over copying texture code.

### Belgium

Good candidate for forest, boards, rolling countryside, and shared prop-density improvements.

### Aspen

Snowmobile/winter-specific. Keep snowmobile handling separate from car handling. Quality budgets can still apply to snow, trees, particles, and draw distance.

### United Kingdom

Good candidate for hedges, dense greenery, damp/wet-weather visuals, and quality-scaled vegetation.

### Germany

Good candidate for clean road visuals, forest, hills, signs, and shared imported-track scenery options.

### Volcanoes

Special-effects proving ground. It already has lava, jump ramps, rocks, smoke, embers, and quality-scaled lava lighting. Its terrain floor now uses the shared `volcanic-rock` procedural surface (orange scorched dirt with charred fissures), so it benefits from the same low/medium/high surface budgets as grass and asphalt. Extract general parts from Volcanoes only after the reusable shape is clear.

## Implementation Guidelines

- Prefer shared helpers in `frontend/src/racing/performance`.
- Prefer reusable visual components in `frontend/src/racing/components`.
- Prefer imported-track scenery options in `frontend/src/racing/tracks/imported`.
- Keep unique visuals inside the track folder only when they are truly unique.
- Keep placement generation deterministic.
- Keep collision and decorative density separate.
- Quality settings should change render cost, not gameplay advantage.
- Low/medium/high should be visible in cost and polish, but stable in track layout and hazards.

## Scenery Budget Checklist

For any track or scenery module, answer:

- Does low/medium/high change density?
- Does it change particle count?
- Does it change live dynamic light count?
- Does it change mesh detail or draw distance?
- Does it keep collision stable?
- Is repeated geometry instanced or billboarded?
- Is the feature bounded by explicit counts?

## Suggested Next Tasks

Pick one small task:

1. Add `docs/` or markdown notes with a seven-track budget adoption table.
2. Wire shared effect budgets into a reusable non-Volcanoes effect, such as weather particles, crowd visibility, distant scenery detail, or billboard impostor density.
3. Add tests for a pure budget helper or deterministic placement helper.
4. Add a `check` script using `tsc --noEmit` if missing.
5. Smoke-test low/medium/high on Australia and Volcanoes after any renderer/scenery changes.

Avoid starting with a broad visual rewrite.

## Pending Backlog (added 2026-06-25)

Two follow-ups raised during the road-paint work. Both are paused, not started.

### 1. Advertising boards: consolidate, then add low/medium/high blue "paint"

The blue board panels read as flat plain blue (panel fill `#36bffa`), the same way the
edge/centre line paint did before it got a procedural texture. We want the board's blue
surface to get a shared procedural panel texture (subtle tonal variation, fine brushed/
scuffed grain, faint grime) with low/medium/high tiers, ideally driven through the existing
`proceduralSurface*` material system rather than per-board copies. Logos stay untouched.

Blocker discovered: there are FOUR near-duplicate board components (copy-paste descendants of
one original `CurvedBoard` that have since drifted), so adding the texture naively means
editing the same blue-fill path four times:

- `frontend/src/components/foxracing/AdvertisingBoards.tsx` — Australia. `meshStandardMaterial`,
  blue `#36bffa`, logos baked into the canvas.
- `frontend/src/components/foxracingbelgium/AdvertisingBoards.tsx` — shared by Belgium, Germany,
  and United Kingdom (imported tracks import its `CurvedBoard` / `BoardLogoDecal`).
  `meshBasicMaterial` + `#777777` colour modulation, separate `BoardLogoDecal`, and a gradual
  GPU texture-upload throttle (`showTextureLogos`).
- `frontend/src/components/foxracingaspen/AdvertisingBoards.tsx` — Aspen (snow), close to Australia.
- `frontend/src/components/snowmobilerace/TerrainAwareAdvertisingBoards.tsx` — Snowmobile,
  terrain-aware variant (height sampling, `globalTrackLength`, `cumulativeLengthBefore`).

Volcanoes and San Luis render NO boards, so they are out of scope by definition.

No board component currently receives `qualityPresetId`; it would need threading from each
world (the worlds already have it). User scope decision on record: apply to ALL boarded tracks
(the 4 car tracks plus Aspen and Snowmobile), not car-tracks-only.

Recommended order: CONSOLIDATE the four into one parameterised `CurvedBoard` first
(props for material mode, terrain sampler, logo strategy), delete the duplicates, THEN add the
blue panel texture once. The geometry building (front/back/edge/top-bottom faces, UV
orientation toggles, support posts) is ~60-70% identical across the four. If a full refactor is
too risky in one pass, fallback is to build the shared `proceduralBoardPanel` texture module
once and wire it into all four with quality plumbing, then consolidate later.

### 2. Headlights don't consistently illuminate track, grass, or boards

While driving, the car headlights sometimes stop shining on the track/grass surfaces, and they
do not shine on the advertising boards at all. Likely causes to investigate: per-material light
limits / `onBeforeCompile` light counts, the boards using `meshBasicMaterial` (unlit — would
never receive headlight light by design), surfaces falling outside the spotlight cone/range as
the car moves, or shared `activeLightScale` budget culling the headlight. Confirm whether boards
are intended to be self-lit (Belgium boards deliberately use `meshBasicMaterial` for perf) before
"fixing" them to receive light. Relevant: `frontend/src/racing/components/CarHeadlightBeam.tsx`
and the per-surface materials.

## Verification Requirements

For code changes:

- Run focused tests for changed modules.
- Run `npm run test:core` from `frontend` when touching shared racing code.
- Run `npm run build` from `frontend` before handing off.
- If adding type-check scripts, run them and document any failures.

For markdown-only changes:

- No test run is required.
- Read the markdown back once for stale paths, incorrect track names, or misleading ownership notes.

## Working Rules

- Preserve uncommitted work you did not create.
- Inspect diffs before editing files that another agent may be touching.
- Do not revert unrelated changes.
- Do not overwrite `frontend/src/racing/components/materials/` without preserving Claude's asphalt/grass work.
- Keep changes small enough to review independently.
- Explain behavior changes that affect terrain shape, handling, lap timing, wallet delivery, or transaction safety.
