# Adding Imported Car Tracks

This is the current workflow for adding a new selectable/raceable car track from a GeoJSON LineString. Elevation is optional, but the imported-track path is already set up for elevated roads, terrain, scenery, local cars, remote cars, start gates, collectibles, and minimaps.

## Required Inputs

For a useful first pass, collect:

- Track id: stable lowercase id, preferably ASCII, for example `uk-country`.
- Display name: user-facing track name, for example `United Kingdom` or `Germany`.
- Source GeoJSON: a `.json` FeatureCollection with one LineString circuit.
- Start gate: explicit world position, direction vector, and gate width.
- Scenery choice: use the generic imported fallback first, then add custom scenery if needed.
- Elevation choice: flat, smoothed DEM elevation, or raw/authentic DEM elevation.
- Attribution: source URL/license for the layout and elevation data.

Do not trust the GeoJSON feature name, bbox, or first point as the final start gate. They are good seeds only. Start gate placement and racing direction should be manually tested in the browser.

## Generate A Custom Track

For license-clean custom layouts, start with the generator instead of perturbing a real-world circuit:

```bash
npm run tracks:generate-custom -- \
  --preset mountain \
  --id custom-mountain \
  --name "Custom Mountain" \
  --elevation hill-climb \
  --elevation-scale 72 \
  --output frontend/src/racing/tracks/imported/customMountain/customMountain.source.json
```

Presets:

- `club` - broad fast club-circuit shape.
- `mountain` - larger sweepers with a hill-climb-friendly profile.
- `technical` - more direction changes while preserving minimum-angle validation.

Elevation modes:

- `flat` - all coordinates use the base elevation.
- `rolling` - closed-loop rolling hills around the circuit.
- `hill-climb` - climbs toward the far side and descends back toward the start.

The generator writes `[lon, lat, elevation]` coordinates and embeds validation metrics in the GeoJSON. It rejects collapsed segments, acute local angles, and non-adjacent track sections that get too close unless `--no-validation` is passed. Treat generated output as a first draft: run it in the browser, author the start gate manually, then decide whether it needs custom scenery.

## File Layout

Create one folder under:

```text
frontend/src/racing/tracks/imported/<track-id>/
```

Recommended files:

```text
<track-id>.json              # original source GeoJSON
<track-id>.elevated.json     # optional derived runtime GeoJSON with [lon, lat, elevation]
<track-id>Track.ts           # runtime definition
<track-id>Track.test.ts      # focused runtime/preview/elevation tests
<track-id>Scenery.tsx        # optional custom scenery
<track-id>SceneryData.ts     # optional pure placement helpers
<track-id>Scenery.test.ts    # optional scenery tests
```

Use a simple ASCII folder/file name when possible. The display name can still include punctuation or accents.

## Add Elevation

The elevation tool reads a GeoJSON LineString, calls OpenTopoData, and writes a derived GeoJSON whose coordinates are `[lon, lat, elevation]`.

Smoothed elevation, good default for most tracks:

```bash
npm run tracks:add-elevations -- \
  --input frontend/src/racing/tracks/imported/<track-id>/<track-id>.json \
  --output frontend/src/racing/tracks/imported/<track-id>/<track-id>.elevated.json \
  --dataset eudem25m \
  --smoothing-passes 4 \
  --interpolation cubic
```

Raw/authentic elevation, useful for checking the real profile before smoothing:

```bash
npm run tracks:add-elevations -- \
  --input frontend/src/racing/tracks/imported/<track-id>/<track-id>.json \
  --output frontend/src/racing/tracks/imported/<track-id>/<track-id>.raw-elevated.json \
  --dataset eudem25m \
  --smoothing-passes 0 \
  --interpolation cubic
```

Notes:

- The script writes OpenTopoData metadata into the output JSON.
- The current playable imported country-themed tracks use authored route-editor elevation. The elevation script remains available for future experiments that intentionally need sampled terrain data.
- Use smoothed elevation first if raw elevation creates road clipping, jagged boards, or abrupt start/finish transitions.
- Keep the original source JSON checked in beside the derived elevated JSON.
- Update `ATTRIBUTIONS.md` for both the layout source and the elevation source.

## Runtime Definition

Create `<track-id>Track.ts` using `createImportedCarTrackDefinition`.

Minimal elevated example:

```ts
import trackGeoJson from './<track-id>.elevated.json'
import { createImportedCarTrackDefinition } from '../../importedCarTrackDefinition'

export const myTrackDefinition = createImportedCarTrackDefinition({
  authoring: {
    id: '<track-id>',
    displayName: '<Display Name>',
    location: '<Location>',
    environment: 'forest',
    layoutSource: 'custom',
    geoJson: {
      jsonPath: 'frontend/src/racing/tracks/imported/<track-id>/<track-id>.elevated.json',
      worldSize: 2500,
      coordinateElevationScale: 1,
      coordinateElevationOffset: -123.456,
      sourceNotes: 'Source layout plus sampled OpenTopoData elevation.'
    },
    startGate: {
      position: [0, 0.1, 0],
      direction: [0, 0, 1],
      gateWidth: 20
    },
    scenery: {
      preset: 'belgium-forest'
    },
    terrain: {
      heightProvider: 'terrain-system',
      currentElevationSource: 'sampled-real-world',
      plannedElevationSource: 'sampled-real-world',
      roadBlendDistance: 42,
      notes: 'Road centerline follows sampled elevation. Road corridor stays laterally level.'
    },
    spatialIndex: {
      samples: 2200
    },
    notes: 'Imported car-track draft. Start gate still needs browser confirmation.'
  },
  geoJsonData: trackGeoJson
})
```

For a flat first pass:

- Import the original `<track-id>.json`.
- Omit `coordinateElevationScale` and `coordinateElevationOffset`.
- Set `terrain.currentElevationSource: 'none'`.
- Set `terrain.heightProvider: 'constant'` or omit `terrain`.

### Elevation Offset

For elevated JSON, set `coordinateElevationOffset` to the negative of the minimum sampled elevation so the lowest point is near world Y `0`.

Example:

```bash
node -e "const f=require('./frontend/src/racing/tracks/imported/<track-id>/<track-id>.elevated.json'); const c=f.features[0].geometry.coordinates; const h=c.map(p=>p[2]).filter(Number.isFinite); console.log(Math.min(...h), Math.max(...h))"
```

If min elevation is `145.441`, use:

```ts
coordinateElevationOffset: -145.441
```

`coordinateElevationScale` can stay `1` at first. Reduce it only if the browser version feels too steep or unstable.

### Closure And Sharp Seams

`convertGeoJSONToWaypoints` already removes a repeated closing coordinate when the first and last lon/lat match. It also appends a synthetic closure point by default when needed.

Only pass `appendClosurePoint: false` to `createImportedCarTrackDefinition` when the synthetic closure point creates a visible or physical seam problem. The Germany imported track uses this because the extra closure control point made the start/finish elevation transition worse.

For tight or highly detailed tracks, increase runtime sampling:

```ts
trackSegments: 3600,
curveArcLengthDivisions: 14400,
spatialIndex: { samples: 7200 }
```

Do this only when needed. Higher sample counts improve road/terrain fidelity but cost more build/runtime work.

## Register The Track

Add the display entry to:

```text
frontend/src/racing/tracks/importedCarTrackCatalog.ts
```

Example:

```ts
{
  id: '<track-id>',
  displayName: '<Display Name>'
}
```

Import and register the runtime definition in:

```text
frontend/src/racing/tracks/importedCarTrackRegistry.ts
```

This makes the track available to the showroom, preview/minimap list, page routing, lap-result display-name validation, and imported-track lookup.

## Scenery

All imported tracks get a usable fallback through:

```text
frontend/src/racing/tracks/imported/ImportedBasicScenery.tsx
```

The fallback supplies quality-scaled trees and terrain-aware full-track advertising boards. It is a starting point, not a final authored scenery layout.

For custom scenery:

1. Add `<track-id>Scenery.tsx` and optional pure data helpers/tests.
2. Register it in `ImportedCarTrackScenery.tsx`.
3. Keep tree positions and advertising-board positions flowing through `onTreesGenerated` and `onBoardsGenerated` so collision remains wired.
4. Pass `getHeightAtPosition` into scenery placements so trees, boards, seating, and decals sit on elevated terrain.

Track-specific scenery should stay track-specific. Advertising-board spans, logo style, stadium seating positions, tree exclusions, barriers, and camera sightlines vary by track.

## Start Gate Authoring

The start gate needs:

- `position: [x, y, z]`
- `direction: [x, 0, z]`
- `gateWidth`

For elevated tracks, X/Z and direction are authored explicitly, but runtime Y is sampled from the terrain path. A placeholder Y like `0.1` is fine.

Suggested process:

1. Seed the start gate from a known line, the first GeoJSON point, or a long straight.
2. Run the track in the browser.
3. Confirm the car starts centered over the road.
4. Confirm the car faces the desired racing direction.
5. Complete a lap and verify the lap inscription/dummy txid path.
6. Adjust start direction if the track runs counter-clockwise when it should run clockwise.

Shortcut prevention currently depends mostly on distance traveled and physical track boundaries. If a track needs strict checkpoint logic, add that deliberately instead of copying San Luis-specific behavior.

## Multiplayer, Stats, And Transactions

Socket server:

- Local/dev default names live in `socket-server/src/index.ts`.
- Production should prefer the `VALID_TRACK_NAMES` environment variable.
- Add the display name exactly, for example `United Kingdom` or `Germany`.

Stats:

- Pixel Racing stats groups by discovered lap-result `trackname`.
- New imported names are included through `importedCarTrackCatalog.ts` and `trackDisplayNames.ts`.
- A new track appears in stats once it has at least one lap record.

Transactions:

- The current transaction server accepts/pass-throughs non-empty `trackname`.
- Frontend lap submission validation uses `trackDisplayNames.ts`, which pulls imported names from the catalog.
- No transaction-server code change is expected unless server-side track-name validation is added later.

Remote players:

- Car tracks send position, yaw rotation, and speed.
- Visual pitch/roll is derived client-side from the remote car position/yaw and the local terrain sampler.
- Do not add pitch/roll to the socket protocol unless future gameplay adds non-deterministic suspension, jumping, or airborne state.

## Tests To Add Or Update

For a new imported track, add focused tests similar to the United Kingdom/Germany imported tracks:

- Runtime definition builds a closed curve.
- Track length is positive.
- Start pose is elevated correctly when using sampled elevation.
- Elevation range is normalized as expected.
- Preview definition shows the right display name.
- Catalog/registry includes the new id/display name.
- Optional scenery placement tests cover tree counts, board generation, and collision placements.

Useful commands:

```bash
npm --workspace frontend run test:core -- --test-name-pattern="<track-id>|imported car track|track preview|lap result"
npm run build:frontend
```

If the socket default list changes:

```bash
npm run check:socket
```

## Manual Browser Checklist

Before calling a new track done:

- Showroom option appears with correct display name.
- Showroom preview/minimap matches the layout.
- Race loads the selected track, not Australia.
- Road, terrain, grass, trees, boards, seating, collectibles, and start gate agree on height.
- Car height follows the road.
- Car visual pitch/roll looks correct uphill, downhill, and sidehill.
- Remote cars still render and filter by same track.
- Lap completes only after enough distance and the authored start gate crossing.
- Dummy txid/lap activity appears.
- Stats accepts and groups the new track name.
- Low/Medium/High quality settings do not crash and produce acceptable scenery density.

## Known Tradeoffs

- The imported road is laterally level across its width. It follows centerline elevation but does not yet support authored camber/banking.
- Road/terrain clipping can happen with raw elevation, tight turns, or sparse source points. Try more `trackSegments`, higher `curveArcLengthDivisions`, more spatial samples, or smoothed elevation before changing shared road rendering.
- Generic advertising boards are good enough for a first pass, but tight corners and logos often need authored spans or custom decal placement.
- Start gate authoring is still manual QA. Automating it from GeoJSON alone has not been reliable.
