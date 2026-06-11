# Pixel Fox Racing Suite Plan

This plan is a shared place for contributors to discuss useful improvements. The long-term idea is to see how good Pixel Fox Racing can become when any human builder or coding agent can contribute, fork, test ideas, and send back improvements.

The current frontend grew track-by-track, so some game code is duplicated and each track has subtle differences. Refactors should be careful and incremental. Small focused pull requests are easier to review, merge, and reuse.

For the detailed track and shared-systems refactor plan, see `REFACTOR.md`.

Pixel Racing Classic can live separately as the original pre-refactor code and feel. The open-source Pixel Fox Racing Suite is the prompt anyone can build on: keep the personality, but let the shared version become deeper, better-looking, easier to maintain, and eventually different enough that it is not limited by the classic implementation.

## Goals

- Keep the suite easy to run locally with one install and simple dev commands.
- Keep the open-source default clean of private keys, private servers, and non-redistributable assets.
- Make it straightforward for forks to rebrand the app, change routes, add tracks, and configure their own transaction metadata.
- Improve the shared racing code in ways that help both this project and downstream forks.
- Improve the feel, look, depth, and replay value of the racing experience over time.
- Welcome contributions from people and agents while keeping code changes reviewable and understandable.

## Current App Shape

- `frontend` - Vite, React, Three.js racing frontend at `/pixelfoxracing`.
- `socket-server` - Socket.IO server for shared world state and collectible pickups.
- `transaction-server` - Express API for dummy or real BSV ordinal transaction creation.

## Track Work

Existing tracks:

- `Australia` - custom country-themed layout authored for this project.
- `San Luis` - custom hand-authored in-game layout that is narrower than the other current tracks.
- `Belgium` - custom country-themed layout authored for this project.
- `Aspen` - custom winter mountain layout authored for this project.
- `United Kingdom` - custom imported GeoJSON layout with authored elevation.
- `Germany` - custom imported GeoJSON layout with authored elevation.

Useful track improvements:

- Improve track graphics, scenery, lighting, weather, and environmental detail.
- Add a clearer track selection UI with track previews and metadata.
- Normalize shared track APIs so new tracks can be added with less copied game code.
- Build terrain around the road corridor instead of drawing roads over arbitrary hills. The road centerline, width, shoulders, grade, and blend zone should shape terrain so future hilly Australia, San Luis, and Belgium variants do not clip through the road.
- Add contributor documentation for building a new track environment.
- Add more original or permissively licensed tracks.
- Review track names and attributions whenever a real-world layout is adapted into a fictional setting.

## Gameplay Ideas

- Add career mode with progression, events, unlocks, records, and long-term goals.
- Add more race formats, such as time trials, ghost laps, seasons, tournaments, or multiplayer challenges.
- Establish one shared car handling model for every car track so Australia, San Luis, and Belgium feel consistent even as cars, customization, and track art improve.
- Keep snowmobile handling separate because Aspen/snow racing is intentionally a different vehicle experience.
- Add collectible, upgrade, or reward systems that can work in dummy mode and real transaction mode.
- Add better AI or ghost competitors for solo play.
- Add difficulty settings and assist options for different players.

## Car Customization

- Add more customizable car bodies, colors, decals, wheels, and visual parts.
- Add saved car presets per player or wallet.
- Keep car customization mostly visual at first so different car bodies do not fragment the shared car handling model.
- Add optional performance tuning only if it fits the game balance and can be applied consistently across car tracks.
- Keep customization fork-friendly so builders can add their own asset packs.

## Platforms

- Improve desktop browser support first.
- Improve mobile browser controls, layout, and performance.
- Explore packaged desktop builds if the browser version becomes stable enough.
- Explore controller support.
- Keep deployment simple for web hosting and local development.

## Architecture Direction

- Treat React and Three.js as the current web renderer, not as the whole game architecture.
- Move racing rules, track metadata, road corridor terrain shaping, terrain height, lap timing, gates, collisions, input mapping, and scoring toward portable TypeScript modules.
- Current shared racing modules cover track geometry, spatial track lookup, start gates, road corridor influence, lap validation, monotonic race timing, and the first shared car control/handling functions. Keep expanding this layer with tests before deleting old track folders or merging vehicle components.
- Keep camera follow logic tied to stable normalized vehicle heading. The old car/camera failure around full 360-degree rotation should remain covered by shared rotation helpers instead of track-specific camera hacks.
- Keep camera tuning in shared helpers where practical: follow distance, height, smoothing, frame delta caps, and camera reset thresholds should be testable before deeper camera refactors.
- Preserve the current multiple camera modes as named presets until better profiling or playtesting says otherwise; they can help different browsers and machines avoid flicker or choppiness.
- Move collision math toward shared helpers so obstacle, gate, vehicle, and future track-boundary collisions can be tuned consistently.
- Keep rendering, UI, wallet flows, servers, and platform adapters separated from core simulation logic.
- Make assets and track definitions data-driven so better renderers, mobile packages, desktop builds, or future ports can reuse the same game design.
- Avoid burying gameplay behavior inside large JSX components because that makes future optimization, deeper simulation, or ports to other engines and languages harder.

## Frontend Ideas

- Refactor cautiously because the track components were added one at a time and do not all behave exactly the same.
- Split large game components into reusable systems for shared car control, separate snowmobile control, lap timing, collectibles, and transaction submission.
- Add a settings panel for graphics quality, camera behavior, and audio.
- Improve loading states and empty states across wallet, stats, and transaction views.
- Add responsive polish for small screens and touch controls.
- Add optional sound packs that forks can install separately with clear licensing.

## Wallet Integration Ideas

- Evaluate migrating from the current Panda wallet provider path to the current Yours Wallet / BRC-100 provider flow.
- Explore a BRC-100 authentication flow using a Pixel Fox Racing auth basket. A wallet could keep a reusable Pixel Fox Racing auth token in that basket, spend or move it during login, and return it to the same basket so the app can verify wallet control and track the most recent authenticated login.
- Use auth-token recency as a session freshness signal. If the last verified basket/token activity is older than a configured threshold, ask the player to authenticate again by spending or cycling the token through the wallet flow.
- Keep the BRC-100 auth token separate from race results, collectibles, and lap submissions. It should prove wallet control/session freshness, not become gameplay state or a required on-chain write for every race.
- Design this so every compatible BRC-100 wallet can support the same Pixel Fox Racing auth basket pattern, while forks can rename/configure their own auth basket and token metadata.
- Keep wallet support optional so dummy-mode local development still works without a browser wallet.
- Verify address loading, ordinal selection, collectible ownership, transaction signing, and error states against the updated wallet API.
- Document supported wallet APIs and fallback behavior so forks can choose their own BSV ordinal wallet integration.

## Graphics Ideas

- Improve vehicle models and animations.
- Improve trackside scenery, materials, sky, lighting, particles, and effects.
- Add graphics quality presets for low-end and high-end machines.
- Keep the graphics pipeline modular enough to support better asset formats, level-of-detail, batching, instancing, texture compression, and future renderer/platform changes.
- Keep expensive crowd and scenery rendering behind shared distance/quality systems. Stadium fox crowds, billboard atlases, instancing, and visibility thresholds should be tunable once for desktop/mobile instead of copied per track.
- Add more polished loading transitions between menus and tracks.
- Add screenshots or short GIFs to the README once visuals are stable.

## Socket Server Ideas

- Add lightweight health and version endpoints.
- Add room configuration so forks can run multiple game worlds.
- Treat multiplayer above 4-5 simultaneous players as uncharted until tested. Add a dev-only fake-player/load harness so rendering, socket update cadence, interpolation, collision budgets, and Current Players UI can be tested at 20, 50, and 100 remote players without needing real users.
- Make multiplayer rendering capability-aware: low-end devices should render fewer/farther-cheaper players, while high-end devices can show more remote players with smoother interpolation and richer models.
- Early Australia fake-load testing with 50 configured remote players confirmed the quality caps: Low renders 8, Medium renders 16, and High renders 32. High measured roughly 30-50 FPS on the tested machine, so remote-player LOD and cheaper mid/far representations should come before raising caps.
- Add stronger validation around player state and collectible pickup events.
- Document deployment options for low-cost public multiplayer servers.

## Transaction Server Ideas

- Keep dummy mode useful for local development and demos.
- Improve real-mode setup docs with a clear checklist.
- Add server-side idempotency for lap-result and collectible transaction routes. Frontend duplicate guards are useful, but real transaction mode should accept an idempotency key, persist request/result state, and return the existing txid for repeated equivalent requests instead of creating duplicate inscriptions.
- Add safer startup validation for real transaction mode.
- Add tests around transaction payloads, MAP metadata, and error responses.
- Keep inscription app/name fields configurable for forks.

## Documentation Ideas

- Add screenshots or short GIFs once release visuals are stable.
- Add a contributor guide for adding tracks, collectibles, and transaction routes.
- Add deployment notes for frontend-only, full-stack local, and full-stack hosted setups.
- Add examples for rebranding a fork without accidentally keeping Pixel Fox Racing-specific metadata.

## Good First Issues

- Improve README clarity where setup is confusing.
- Add missing comments only where the code is hard to follow.
- Add small UI polish fixes that do not change transaction behavior.
- Add tests for pure helpers and server request validation.
- Improve attribution notes for any added assets or track data.

## Contribution Notes

Pull requests should be focused and should include enough context to review the change. If a contribution adds third-party assets, track data, fonts, sounds, or external code, include source and license details in `ATTRIBUTIONS.md`.

Contributions are accepted under the project MIT license so merged improvements can remain part of the shared suite and can also be reused by forks.
