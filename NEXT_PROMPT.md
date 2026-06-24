# Next Prompt: Refactor and Production-Code Migration

Continue working in:

`/home/to/Desktop/working/pixel-fox-racing-suite OPEN SOURCE`

Compare against:

- `/home/to/Desktop/working/frontend-prod`
- `/home/to/Desktop/working/transaction-server-prod`

Do not copy either production directory wholesale. The open-source suite contains its own architecture, documentation, dummy transaction mode, server split, and open-source-only work. Move changes as focused, reviewable features.

## Current Uncommitted Work

The open-source frontend now has:

- Shared procedural billboard-tree art under `frontend/src/racing/components/forest/`.
- Quality-scaled billboard forests at approximately:
  - Low: 1,375 trees
  - Medium: 2,000 trees
  - High: 2,500 trees
- New forests enabled for Australia, Belgium, Germany, United Kingdom, and Volcanoes.
- San Luis and Aspen intentionally retain their old tree systems.
- Australia's old `SimpleTrees` rendering removed.
- Larger stadium exclusion zones to prevent billboard foliage intersecting seating.
- Volcanoes track, elevated GeoJSON source, tests, catalog registration, documentation, and attribution ported from production.

The frontend production build passed using the dependencies installed in `frontend-prod`. The open-source checkout itself currently lacks installed dependencies. Its test script also expects `tsx`, which is not declared/installed correctly and should be fixed.

## Product Direction

Treat Australia as the reference track:

- Develop and tune shared car-track systems there first.
- Keep the other tracks playable as compatibility/experimental tracks.
- Do not delete the other tracks.
- Do not introduce more per-track copies of game, vehicle, terrain, or scenery code.
- San Luis remains useful for narrow-track compatibility.
- Aspen remains useful for snowmobile/winter compatibility.

## Immediate Terrain Concern

The tree port did not change terrain geometry, but it changed visual perception:

- Terrain-aware fog was changed from `250–2000` to `150–1100`.
- Large billboard trees can hide terrain shape.
- The open-source imported terrain still has an abrupt drop when the local spatial-index lookup stops finding a track sample.
- Production instead eases authored track elevation to base height over a fixed `700` world-unit distance, which looks too gradual.

Recommended next step:

1. Restore or retune fog independently from terrain.
2. Add typed per-track terrain settings such as:
   - `lateralFalloffDistance`
   - `baseHeight`
3. Use smooth terrain falloff, but start around `400–500` units for hilly imported tracks rather than a global `700`.
4. Preserve a visible slope away from the road corridor without restoring the cliff.
5. Add tests for near-road height, midpoint falloff, base height, and tracks with no authored elevation.

Do not copy production's global terrain-falloff implementation without making it configurable.

## Height-Sampling and Volcanoes Performance

Volcanoes can become choppy because hilly vehicle rendering repeatedly samples terrain.

Existing shared optimizations already present:

- Track-position calculation every 20 frames.
- On-track refresh every 5 frames.
- Spatial-track index for nearest-track queries.

Remaining concern:

- `getHeightAtPosition` can be called around ten times per frame for vehicle height, next position, slope, bounce, and visual pitch/roll.
- Imported tracks can also fall back to a terrain mesh resolution of 420 at every quality setting.

Recommended shared refactor:

1. Add a per-frame terrain sample cache keyed by quantized `x`, `z`, and relevant track context.
2. Keep essential current/next vehicle-height sampling every frame.
3. Recalculate visual pitch/roll every 2–3 frames and smoothly interpolate.
4. Add low/medium/high imported-terrain mesh budgets.
5. Measure before and after on Australia and Volcanoes.
6. Keep optimization in shared car/terrain systems, not Volcanoes-specific branches.

## Frontend Refactor Priorities

Prefer incremental extraction:

1. Make imported/reference tracks use one shared `CarTrackGame` and `CarTrackWorld`.
2. Keep track differences in typed definitions:
   - geometry
   - elevation
   - road corridor
   - terrain falloff
   - scenery preset
   - render budgets
   - start gate
   - camera settings
3. Avoid adding another `foxracing<track>` directory.
4. Split oversized files carefully, especially:
   - `SnowmobileWorld.tsx`
   - stats components
   - legacy per-track game/world components
5. Keep simulation and terrain math pure TypeScript where practical.
6. Preserve current lap, multiplayer, collectible, and wallet behavior while extracting.

## Production Frontend Changes to Evaluate

Classify every production difference before moving it:

### Move as shared engine work

- Performance fixes.
- Quality settings and render budgets.
- Terrain and road-corridor improvements.
- Shared trees and scenery systems.
- Imported-track authoring and validation.
- Tests for reusable racing, wallet, and transaction behavior.

### Move as public content

- Volcanoes and other original tracks with documented provenance.
- Publicly licensed assets with attribution.

### Move only behind optional configuration

- Faucet UI/client behavior.
- Production-only service integrations.
- Features requiring funded inventory or databases.

### Never copy into source control

- `.env` values.
- WIFs or other private keys.
- Database URLs.
- Funded UTXO inventories.
- Production database contents.
- Deployment-specific secrets.

## Faucet Architecture Concern

The production Pixel Racing faucet is useful but should not force two manually maintained frontends.

Preferred design:

- Keep optional faucet capability in the open-source suite.
- Disable it by default.
- Provide dummy/local behavior without funded inventory.
- Enable production through environment configuration.
- Keep production inventory and secrets private.

Before porting the faucet, address:

- Server-side eligibility verification.
- One-claim-per-identity/address enforcement.
- Proof of delivery-target ownership.
- Rate limiting.
- Duplicate and concurrent claim tests.
- Clear disabled/empty/error behavior.

The current production route claims to be for wallets holding zero foxes, but the server route does not itself enforce that ownership rule. Do not present the faucet as secure until this is fixed.

## Server Refactor Priorities

For `transaction-server-prod`, avoid copying the large server wholesale.

Extract by domain:

- Application/bootstrap and middleware.
- Racing transaction routes.
- Collectible delivery.
- Optional faucet routes.
- Faucet inventory repository.
- Database schema/migrations.
- Chain/indexer clients.

The open-source transaction server must retain dummy mode and forkability.

## Verification Requirements

Before completing the next migration/refactor:

- Install/fix declared frontend development dependencies, including `tsx`.
- Add a frontend `check` script using `tsc --noEmit`.
- Run focused tests for changed modules.
- Run the complete frontend core test command.
- Run the frontend production build.
- Run transaction-server type checks and tests if server code changes.
- Smoke-test Australia and Volcanoes.
- Confirm San Luis and Aspen still use only their old tree systems.
- Report bundle-size warnings separately; do not hide them.

## Working Rules

- Preserve existing uncommitted work.
- Inspect diffs before applying production changes.
- Do not overwrite open-source files with entire production copies unless they are verified identical except for the intended feature.
- Keep commits/features small enough to review independently.
- Prefer configuration and composition over track-specific conditionals.
- Explain any behavior change that affects terrain shape, handling, lap timing, wallet delivery, or transaction safety.
