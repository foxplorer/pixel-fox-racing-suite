# Pixel Fox Racing Suite Plan

Pixel Fox Racing Suite is an open-source racing sandbox built around shared racing systems, modular tracks, and fork-friendly content. The current priority is to make seven tracks look better without turning every visual upgrade into a track-specific copy-paste job.

The suite should keep the personality of the existing game while becoming easier to extend: new tracks, better scenery, richer lighting, mobile-friendly performance, and clean hooks for downstream forks.

For lower-level refactor notes, see `REFACTOR.md`.

## Current Track Set

The suite currently has seven named tracks:

- `Australia`
- `San Luis`
- `Belgium`
- `Aspen`
- `United Kingdom`
- `Germany`
- `Volcanoes`

These tracks are not all implemented the same way yet. Some are older custom component folders, and newer car tracks increasingly use shared imported-track definitions, shared terrain, shared car handling, shared multiplayer rendering, and shared quality settings.

The goal is not to make every track visually identical. The goal is to let every track opt into shared budgets and reusable scenery modules while keeping its own theme.

## Graphics Budget Direction

Low, medium, and high graphics settings should be real budgets, not just labels.

Existing shared budget areas:

- Renderer budget: device pixel ratio cap, shadows, and antialiasing.
- Remote-player budget: render distance and maximum visible remote players.
- Minimap budget: update cadence.
- Scenery density budget: shared tree, forest, and placement counts.
- Effect budget: mesh detail scale, active light scale, and particle density scale.

Budget rules:

- Low must reduce expensive work enough for low-end browsers and mobile devices.
- Medium should be the default target for visual quality and stable performance.
- High can add density and polish, but should not change gameplay collision or track layout.
- Quality settings should affect rendering cost, not player advantage.
- Track-specific effects should translate shared budget knobs into local visuals.

Examples:

- Forest tracks use `densityScale` for tree and billboard forest counts.
- Mountain tracks can use `meshDetailScale` for terrain/scenery mesh resolution.
- Night or cave tracks can use `activeLightScale` for live point lights.
- Weather, dust, snow, lava, sparks, and smoke can use `particleDensityScale`.

## Scenery Architecture

Scenery upgrades should be modular enough that tracks can share improvements.

Preferred pattern:

1. Put generic budget helpers in `frontend/src/racing/performance`.
2. Put reusable visual components in `frontend/src/racing/components`.
3. Put shared imported-track scenery in `frontend/src/racing/tracks/imported`.
4. Put unique track flavor in that track's own folder only when it is truly unique.
5. Keep generated placement data deterministic so tests, collisions, and minimaps stay stable.

Reusable scenery modules worth building:

- Quality-scaled forests and tree lines.
- Trackside rocks, shrubs, fences, banners, and small props.
- Terrain-aware advertising boards.
- Distant mountains, volcanoes, skyline silhouettes, or landmark backdrops.
- Weather layers such as snow, fog, rain, dust, ash, and heat haze.
- Shared crowd/stadium visibility budgets.
- Low-cost impostor or billboard versions of expensive scenery.

Tree-system policy:

- Avoid running tiny `SimpleTrees` on tracks that already use the shared billboard forest. The small mesh trees are hard to see next to the larger billboard trees, but they still add draw calls and collision bookkeeping.
- Preserve `SimpleTrees` where they are still part of the older scene identity, especially San Luis and Aspen, until those tracks get their own deliberate scenery migration.
- If a track needs close-up hero trees plus billboard forests, make that an explicit foreground-tree layer with its own budget instead of keeping old `SimpleTrees` by accident.

Track-specific scenery should stay thin:

- Australia can theme shared props toward dry terrain and open-country racing.
- San Luis can emphasize compact technical racing, stadium details, and city/park flavor.
- Belgium can emphasize forest, boards, and rolling countryside.
- Aspen can keep winter/snowmobile-specific visuals and snow terrain.
- United Kingdom can use denser green scenery, hedges, and wet-weather options.
- Germany can use clean road, forest, hillside, and European trackside details.
- Volcanoes can use lava, caves, rocks, smoke, embers, jumps, and volcanic lighting.

## Shared Surface Materials

Procedural asphalt and grass should stay shared surface systems, not per-track texture copies. Asphalt belongs on normal car-track road ribbons. Procedural grass can be used on all standard green terrain tracks, but should not be forced onto tracks where the surface identity is different.

Target surface policy:

- Use shared asphalt on car tracks that render the shared road ribbon.
- Use shared grass on Australia, San Luis, Belgium, United Kingdom, and Germany where their terrain path supports it.
- Keep Aspen on snow/winter terrain.
- Keep Volcanoes on volcanic rock/lava terrain.
- Keep material-quality budgets tied to low/medium/high, but do not force them into scenery/effect budgets until the shape of the shared renderer is clearer.

## Volcanoes Track Notes

`Volcanoes` is the first track using a richer special-effect scenery layer:

- Lava basin and lava pit meshes.
- Lava jump ramps.
- Rock spires and boulders.
- Smoke and ember particles.
- Quality-scaled live lava lighting.

Volcanoes should be treated as a proving ground for modular effect budgets. If an improvement works there, extract the general part so other tracks can reuse it.

Examples:

- Lava particles prove out particle-density budgets.
- Lava lights prove out active-light budgets.
- Lava pool tessellation proves out mesh-detail budgets.
- Rock fields prove out quality-scaled instanced scenery.

## Near-Term Work

1. Audit all seven tracks and document which shared budgets each one consumes.
2. Add a small developer-facing quality-budget table for each track.
3. Move more track scenery toward reusable modules instead of local duplicated JSX.
4. Make imported-track scenery options more data-driven: forest, boards, landmarks, weather, props, and hazards.
5. Add focused tests for budget helpers and deterministic placement generators.
6. Add a simple visual QA checklist for low, medium, and high on each track.
7. Keep build size and runtime cost visible as scenery improves.

## Track Budget Checklist

Every track should eventually answer these questions:

- Does low/medium/high change tree, prop, or crowd density?
- Does low/medium/high change particle count?
- Does low/medium/high change active dynamic lights?
- Does low/medium/high change mesh detail or draw distance?
- Does low/medium/high keep collision and gameplay behavior stable?
- Are expensive effects batched, instanced, or billboarded where practical?
- Can the track run acceptably on medium without special hardware?

## Performance Principles

- Prefer instancing for repeated props.
- Prefer deterministic generated placements over hand-authored arrays when the data can be regenerated safely.
- Prefer shared impostor/billboard systems for far scenery.
- Avoid many dynamic point lights unless quality settings cap them.
- Keep particle systems bounded by explicit budgets.
- Keep collision data separate from decorative density so low settings do not remove gameplay obstacles unless the track explicitly supports that.
- Profile before raising counts that affect every track.

## Gameplay And Systems

Graphics work should support the racing experience rather than burying it.

Ongoing shared-system goals:

- Keep car handling consistent across car tracks.
- Keep snowmobile handling separate where it serves Aspen and winter racing.
- Continue moving lap timing, gates, collisions, camera logic, terrain sampling, and multiplayer rendering into tested shared modules.
- Keep track metadata data-driven enough for selection screens, previews, records, and forks.
- Build track previews that show theme and difficulty without loading the full race world.

## Player-Car Collision Feel

Detailed scenario planning lives in `COLLISION_PLAN.md`.

Multiplayer car-to-car collisions need better behavior. The current collision response can make a fast car feel like it hits an invisible wall: if one player rear-ends or clips another car, repeated collision frames can bring the local car to a dead stop even when both cars are moving quickly.

Desired behavior:

- Rear-end contact at speed should usually become a bump-draft style interaction, not a hard stop.
- If both cars are moving in roughly the same direction, the trailing car should bleed toward the lead car's speed instead of instantly losing most of its velocity.
- Small overlaps should resolve with separation and a modest speed correction.
- Side impacts should still deflect and cost speed, but should not repeatedly multiply speed down to zero while cars remain overlapped.
- Head-on or large-angle impacts should be harsher than same-direction contact, but not necessarily symmetric: one car can "win" the impact based on speed, angle, lane position, or authority, while the other gets deflected or slowed more.
- Collision response should be deterministic and testable in shared vehicle/multiplayer helpers.

Implementation direction:

1. Include enough remote-player motion data for collision response: at minimum current position, heading, and speed.
2. Classify contact by relative heading and approach direction: rear-end, side-swipe, head-on, or low-speed overlap.
3. For head-on or opposite-direction impacts, choose an impact winner from relative speed/heading instead of averaging both cars into the same response.
4. Replace the single `vehicleCollisionSpeedMultiplier` response with a relative-velocity response.
5. Add cooldown or overlap-state handling so one physical contact does not apply full speed loss every frame.
6. Keep visual separation independent from speed transfer so cars do not sink into each other.
7. Add tests for high-speed rear-end contact, same-direction side contact, head-on winner/loser impact, and repeated overlap frames.

## Multiplayer Grid Starts And Remote Orientation

Race starts need proper grid placement. Multiple players currently can appear lumped into the same start position instead of using staggered race-grid slots like a normal track. Remote players can also appear facing the wrong direction until they move, which makes the starting area look broken and can make collisions worse.

Desired behavior:

- Each track should expose a deterministic starting grid based on the start/finish pose, track direction, lane width, and car spacing.
- Players should be assigned stable grid slots for race start, countdown, reconnect, and late join display.
- Grid positions should stagger forward/back and left/right around the start line without placing cars outside the road corridor.
- Spawn placement should use terrain height sampling so cars sit on the road surface.
- Remote players with no fresh rotation update should face the track's start direction, not world zero.
- Remote players should preserve the last known rotation once received, and only fall back to track-aware direction when no useful rotation exists.
- Collision should be disabled or softened during countdown/grid staging so stacked or late-arriving state does not knock cars around before the race starts.

Implementation direction:

1. Add a shared `startGrid` helper that derives grid slots from a track's `startFinishPosition`, `startFinishDirection`, gate width, and optional per-track grid config.
2. Include grid-slot assignment in multiplayer join/game-state data, or derive it deterministically from ordered player IDs when the server does not provide a slot.
3. Replace `[0, 0.1, 0]` and `[0, 0, 0]` remote-player join fallbacks with track-aware default position and rotation.
4. Make remote-player display use track start direction until the first authoritative rotation arrives.
5. Add tests for two-player, four-player, and many-player staggered grids; track-direction fallback rotation; reconnect stability; and no-overlap spacing.

## Scheduled Race Events

The suite should support scheduled multiplayer events, such as an hourly featured race. This can give players a reason to return, concentrate multiplayer activity into predictable windows, and show off the full track catalog.

Desired behavior:

- Run a featured race every hour or on a configurable schedule.
- Rotate the featured track so each hour can highlight a different track.
- Let players sign up before the race starts.
- Show countdown, track name, expected start time, registered players, and prize information.
- Lock or snapshot entries near race start so the grid and bracket are stable.
- Support special prizes for winners, podium finishes, participation, fastest lap, clean race, or track-specific challenges.
- Keep events playable in dummy/local mode without funded prizes.
- Make real prize delivery optional and server-configured so forks can run their own events safely.

Implementation direction:

1. Add event metadata: event ID, track ID, start time, signup window, max players, prize rules, and status.
2. Add a lightweight event scheduler on the server or a deterministic schedule that clients can preview.
3. Add signup/cancel signup endpoints with identity-based duplicate protection.
4. Feed event entrants into the starting-grid system so registered players get stable slots.
5. Store event results separately from casual laps.
6. Reuse the existing collectible/transaction pipeline for prizes only after idempotency and eligibility checks are solid.
7. Add admin/config hooks for forks to define track rotation, prize types, and event cadence.

## Open-Source Standards

- Keep the app easy to run locally.
- Keep private keys, private servers, and non-redistributable assets out of the open-source default.
- Include attribution and license details for third-party assets.
- Keep pull requests focused enough to review.
- Prefer small shared improvements that help multiple tracks.
- Avoid large rewrites unless they retire real duplication or unblock future track work.

## Good First Issues

- Add budget usage notes for one track.
- Add tests around a pure scenery placement helper.
- Convert one repeated prop type to an instanced reusable component.
- Improve one track's low/medium/high visual behavior without changing gameplay.
- Add missing attribution for assets or generated track data.
- Improve README setup or track-authoring documentation.

## Definition Of Done For Graphics Upgrades

A graphics upgrade is ready when:

- It works on low, medium, and high.
- It does not change gameplay collision accidentally.
- It is shared or clearly track-specific.
- It has bounded counts for lights, particles, meshes, or instances.
- It builds successfully.
- Any new assets have source and license notes.
