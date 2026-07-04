# Graphics Improvements — Visual & Efficiency Per LOD

Claude-owned. Companion to `CLAUDE_IMPROVEMENT_PLAN.md` (Track C lives here now)
and `CLAUDE_EDGE_CASES.md`. Purpose: one organized view of **everything the
Low/Medium/High quality presets touch**, what was changed, and the ranked list
of wins still available. Updated 2026-07-04.

---

## 1. LOD inventory — what each preset actually affects

The preset object lives in `frontend/src/racing/performance/qualitySettings.ts`;
derived scenery knobs in `performance/sceneryQuality.ts`. Everything below was
verified in code, not assumed.

| System | Knob | Low | Medium | High | Where consumed |
| --- | --- | --- | --- | --- | --- |
| Render resolution | `renderer.pixelRatioCap` (dpr) | 1 | 1.5 | 2 | `getRacingCanvasQualitySettings` → Canvas |
| Antialias | derived (`id !== 'low'`) | off | on | on | same |
| Shadow maps | `renderer.shadows` | off | on | on | same |
| Remote cars visible | `remotePlayers.maxVisible` | 8 | 16 | 32 | `filterRemotePlayersForQuality` |
| Remote car distance cull | `remotePlayers.renderDistance` | 180 | 300 | 600 | same |
| Minimap redraw | `minimap.updateEveryFrames` | every 4 | every 2 | every 1 | `getRacingMinimapQualitySettings` |
| Scenery object counts | `scenery.densityScale` | 0.55 | 0.8 | 1.0 | `getQualityScaledCount` — consumers below |
| — Billboard forest trees | densityScale (base 2500, min 700) | ~1375 | ~2000 | 2500 | `billboardForestPlacement.ts` |
| — Birds | densityScale | scaled | scaled | full | `birdFlockPlacement.ts` |
| — Rain (Australia) | densityScale (base 1400, min 400) | ~770 | ~1120 | 1400 | `FoxRacingWorld.tsx:349` |
| — Snowfall (Aspen) | densityScale (min 250) | scaled | scaled | full | `SnowmobileWorld.tsx:2490` |
| Scenery detail distance | `scenery.detailDistanceScale` | 0.65 | 0.85 | 1.0 | **was a dead knob — first consumer added 2026-07-04** (board tessellation, below) |
| Rolling hill layers | `rollingHillLayers` | 2 | 3 | 4 | `sceneryQuality.ts` → `RollingHills` |
| Effect mesh detail | `effects.meshDetailScale` | 0.5 | 0.75 | 1.0 | audit consumers (lava explosion etc.) |
| Active lights | `effects.activeLightScale` | 0.35 | 0.65 | 1.0 | audit consumers |
| Particle density | `effects.particleDensityScale` | 0.45 | 0.7 | 1.0 | audit consumers |
| Road/grass/paint textures | `SURFACE_QUALITY_TABLE` | 256px | 512px | 1024px | `materials/proceduralSurfaceConfig.ts` (asphalt, grass, volcanic-rock, yellow/white paint) |
| — Baked detail passes | same table (asphalt) | 380 | 1400 | 4200 | same — grass 900/3200/…, per surface |
| — Anisotropy | same table | 1 | 4 | 8 | same |
| — Tile world size | **constant by design** | = | = | = | shrinking it kills detail via mipping (see file comment) |
| Terrain mesh resolution | `renderBudget.sampledTerrain.resolution` per preset | budget | budget | budget | `FoxRacingWorld.tsx` `resolveQualityNumberBudget` |
| Advertising boards | `segmentScale` (NEW) | 65/130 segs | 85/170 | 100/200 | `CurvedBoard` — wired on imported tracks via `detailDistanceScale` |
| 3D instanced trees | `TreeInstances` castShadow (NEW on imported) | n/a (shadows off) | **no longer cast** | cast | `ImportedBasicScenery` |

**Tier architecture that already exists (good bones):**
- Trees have two tiers: full 3D instanced (`TreeInstances`, 4 instanced meshes =
  4 draw calls per field) vs billboard forest (`BillboardForest`, ONE instanced
  quad draw call with atlas texture + wind shader). Tracks opt in per track —
  imported tracks use the billboard forest; bespoke tracks (Australia, Belgium,
  San Luis, Aspen) use per-track `SimpleTrees` → `TreeInstances`.
- Stadium foxes are already a single instanced billboard atlas draw call
  (`BillboardStadiumFoxes`), with a hop animation on 30% waves.
- Cars: local player gets the detailed model, remote players get simpler
  rendering plus the distance/count culling above.

**Not scaled by quality today (findings):**
- Stadium fox hop animation runs the same per-frame instanced-matrix updates on
  every tier; fox count is not preset-scaled (draw calls fine, CPU not).
- Stadium seating has no quality knob.
- Bespoke-track boards (Australia `foxracing/AdvertisingBoards`, Belgium,
  Aspen, UK scenery) don't pass `segmentScale` yet — imported tracks do.
- `SimpleTrees` on bespoke tracks: fixed count (e.g. 400), always cast shadows.
- `effects.*` scales exist but consumers need an audit pass — some effects may
  ignore them.

---

## 2. Changes made

### 2026-07-04 — board tessellation LOD + tree shadow tier
- `CurvedBoard` (`components/foxracingbelgium/AdvertisingBoards.tsx`, shared by
  all car tracks + Aspen) gained `segmentScale?: number` (default **1** — all
  existing callers render byte-identical). All face strips index one shared
  `curvePoints` sampling, so faces can never desync from the spine.
- Floors kept deliberately high (min 60 face / 120 length segments) because the
  sharp-corner perpDir smoothing (`dot < 0.7` blend) and per-point terrain
  height sampling on hilly tracks get touchy when samples spread out.
- Wired on imported tracks only (`ImportedBasicScenery`), using the previously
  dead `detailDistanceScale` knob → 65/85/100 face segments on Low/Med/High.
- `TreeInstances` on imported non-forest tracks now cast shadows **only on
  High** (medium kept shadow maps but paid for thousands of shadow-casting tree
  cones; car/board shadows unaffected).
- Win profile: ~35% less board vertex work + geometry-build CPU on Low (~15%
  Medium), faster track mount, headroom for density knobs; draw calls
  unchanged. Shadow-pass load drops on Medium for imported tracks with 3D
  trees.
- Verified: `npm run test:frontend-core` (573 pass), `npm run build:frontend`.
- **Manual QA still needed (browser):** board seams at sharp corners and on
  hilly imported tracks (Germany especially) at Low/Medium; confirm medium-tier
  tree shadow removal reads fine.

---

### 2026-07-04 (later) — board tier auto-wired to Belgium/UK + stadium fox hop LOD
- `CurvedBoard` now defaults `segmentScale` from the **stored quality preset**
  when the caller doesn't pass one. This auto-applies the tessellation tier to
  Belgium's full-track barrier ribbons (**16 ribbons × ~2k verts — the single
  biggest board load in the game**) and UK scenery, with zero call-site
  changes. Explicit props (ImportedBasicScenery) still win.
- **Win:** on Low, Belgium's barrier walls drop ~35% of their vertex and
  geometry-build cost; Medium ~15%. Same sharp-corner-safe floors as before.
- `BillboardStadiumFoxes` hop waves now scale by the preset's
  `particleDensityScale`: Low crowds hop in ~13.5% waves instead of 30%,
  Medium ~21%, High unchanged. **Win:** hop animation rewrites instanced
  matrices every frame while foxes are mid-hop — smaller waves mean fewer
  per-frame matrix uploads and less CPU on Low/Medium; the crowd still reads
  as alive.
- Note: quality is read from localStorage at component mount — a mid-race
  preset change applies on next race entry (the quality selector lives in the
  showroom, so this matches the real flow).
- Verified: `test:frontend-core` (582), `build:frontend`.

### Track/folder architecture note (why board code exists 3×)
The 6 car tracks run through **three** game components:
`components/foxracing/FoxRacingGame.tsx` (Australia **and** all
imported-method tracks: UK, Germany, Volcanoes),
`components/foxracingbelgium/` (Belgium), `components/foxracingsanluis/`
(San Luis); `components/foxracingaspen/` is snowmobile-only and outside
multiplayer. The **shared** `CurvedBoard` lives in
`foxracingbelgium/AdvertisingBoards.tsx` (used by Belgium, UK, imported
tracks). **Australia and Aspen each keep their own forked copies** of a board
component — those forks did not receive the tessellation tier. Merging the
forks into the shared component is the right long-term dedup, but it's a
careful refactor (each fork has track-specific placement quirks) — tracked
below as a remaining win, not done opportunistically.

## 3. Ranked remaining wins

### Efficiency (highest value first)
1. ~~Wire `segmentScale` into Belgium/UK boards~~ **DONE** via stored-preset
   default. Remaining: Australia's and Aspen's **forked** board components
   (see architecture note) — port the same `faceSegments` pattern or,
   better, merge the forks into the shared `CurvedBoard`.
2. ~~Stadium fox hop LOD~~ **DONE** — hop waves scale by
   `particleDensityScale`.
3. **Merge each board's ~7 meshes** (front/back/edges/caps/posts) into 1-2
   geometries/draw calls. Bigger lift, best done after C1 measurements.
4. **`effects.*` consumer audit:** confirm lava explosion, headlight beams,
   collectible sparkles actually read `meshDetailScale` / `activeLightScale` /
   `particleDensityScale`; wire the ones that don't.
5. **SimpleTrees quality threading on bespoke tracks:** preset-scaled count +
   High-only castShadow (mirrors today's imported-track change).
6. **Procedural texture cache per preset:** avoid full canvas rebuilds when
   switching quality; measure rebuild cost first.
7. **Remote car mesh LOD:** simple mesh beyond ~1/2 renderDistance, detailed
   inside. The culling bands already exist; this adds a mid tier.
8. **Terrain resolution budgets on imported tracks:** `FoxRacingWorld` has
   per-preset terrain resolution budgets; confirm the imported world shell
   honors equivalent budgets, add if missing.

### Visual roadmap per system (tracks look good; this is the "even better" pass)

Rule of thumb: every visual upgrade below is funded by an efficiency win above —
land the headroom first, then spend it where the player looks most (road ahead,
trees beside the road, weather in the air).

**Trees**
- Hybrid forest ring: near-road ring of 3D instanced trees in front of the
  billboard forest on imported tracks (visual-only, no collision change) —
  biggest "looks better" per cost; billboards currently start at 46u out.
  Low: billboards only · Med: small ring · High: full ring + shadowed.
- Billboard atlas upgrades on High: more variants (6 → 10+) and higher texture
  resolution so repetition stops being findable; Low keeps current atlas.
- 3D tree geometry facelift: current cones read as classic low-poly — a second
  species (irregular deciduous blob canopy) mixed ~30/70 would break the
  uniformity on every track that uses `TreeInstances`, at near-zero cost since
  it's still instanced.

**Track surface + paint**
- Racing-line wear: darkened tire-line pass along the driving line at Med/High
  — the procedural pipeline already supports extra passes per tier.
- Skid/scuff decals at corner apexes on High (static decal quads, a handful per
  track, authored from the track curve's curvature peaks).
- Edge paint chipping already reads well; add curb-style red/white paint on the
  tightest corners at Med/High (same paint-ribbon system, new palette).
- Wet-look variant of asphalt palette (darker base, higher highlight) — pairs
  with rain weather below; texture swap only, no new shader.

**Grass**
- High tier: sparse instanced grass-tuft billboards in a ~20u strip beside the
  road (same one-draw-call pattern as the billboard forest, tiny quads). This
  is the single biggest ground realism jump; Low/Med keep painted texture only.
- Mow-stripe pass (alternating light/dark bands) in the grass texture at
  Med/High — free at bake time, big manicured-circuit vibe on wide tracks.

**Weather (new types, designed per LOD from day one)**
- Existing: Australia rain (1400 drops, density-scaled), Aspen snowfall. Both
  follow the player — the pattern to reuse.
- New candidates, each with an explicit L/M/H recipe so they "look great at
  every LOD" instead of degrading accidentally:
  - **Heat shimmer** (Volcanoes): Low = tinted fog only · Med = slow ember
    particles (density-scaled) · High = embers + subtle screen-space wobble on
    the horizon band.
  - **Ground mist** (UK/Belgium mornings): Low = fog pushed closer · Med = 2-3
    big soft alpha planes hugging dips · High = more planes + slow drift.
  - **Drizzle/storm tiers for existing rain**: reuse the drop system with
    palette + count + slant presets; storm adds a distant lightning flash
    (light intensity blink — cheap at every tier).
  - Weather should be a per-track ambient choice (or scheduled-race flavor)
    behind one `weather` prop, so scheduled races can later announce "rain
    race" without new plumbing.
- Fog distance is the master LOD lever: pull fog in on Low (hides pop, saves
  overdraw), push it out on High. Today fog is per-track static — make
  near/far preset-aware (`fogDistanceScale` per preset, consumed by each
  world shell) and tune per environment.

**Cars (all 3 relationships: local, remote-near, remote-far)**
- Local (detailed model): High = add subtle clear-coat env reflection +
  emissive brake glow already exists; Med = current look; Low = current look.
  Paint metallic-flake normal variation is a material tweak, not new geometry.
- Remote-near: today remote cars are simpler than the local car — promote
  remote cars inside ~40u to the detailed model on High so wheel-to-wheel
  racing looks as good as your own hood (scheduled races put cars side by
  side — this matters more now than in solo time trials).
- Remote-far: add the cheap silhouette tier beyond ~1/2 renderDistance (win #7
  above) so Med/High can afford the near-tier promotion.
- Shared: bake one blob-shadow texture used by all cars when shadow maps are
  off (Low currently has no car ground contact — a blob shadow is the single
  cheapest "looks planted" fix).

**Fog / horizon / sky**
- Per-environment fog palette pass (warm haze for Australia, cool blue-grey for
  UK, ash tint for Volcanoes) — color-only change, every tier benefits.
- Low-tier fog pulled in ~20% (pairs with terrain/scenery savings); High pushed
  out with distant mountains/volcanoes still visible above the fog band.

### Measure first (before wins 3+)
Use `RacingFpsCounter` + `renderer.info` (calls, triangles) per track per
preset; record here:

| Track | Preset | FPS | Draw calls | Triangles |
| --- | --- | --- | --- | --- |
| (fill during C1 baseline pass) | | | | |

---

## 4. Known touchy areas (do not regress)

- **Sharp curves:** board perpDir smoothing depends on sample spacing; that's
  why segment floors are 60/120 and scaling uses the gentle
  `detailDistanceScale`, not `meshDetailScale` (0.5). Any further reduction
  needs per-track browser checks (Germany corners; San Luis is bespoke and
  currently unscaled).
- **Hilly tracks:** board Y follows per-sample terrain height; too-sparse
  sampling can clip the board into rises between samples.
- **Tile world size on surfaces is an art constant** — never shrink it per
  tier (GPU mips repeated tiles to mush; see comment in
  `proceduralSurfaceConfig.ts`).
- **Billboard forest `frustumCulled={false}` is required** (shader displaces
  vertices; culling by origin bounds would blink the forest out).
- **`TreeInstances` must `computeBoundingSphere()` after matrix writes**
  (already handled — don't remove; instanced bounds otherwise cull the field).
