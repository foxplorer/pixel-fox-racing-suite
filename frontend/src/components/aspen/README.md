# Aspen Shared Components

This folder holds Aspen-specific pieces that are shared by the live snowmobile event or by Aspen migration work.

The official Aspen event is `aspen-snowmobile`. It renders through `../foxracingaspen/FoxRacingGame.tsx`, which uses `../snowmobilerace/SnowmobileWorld`.

- `StadiumSeating.tsx` is live Aspen scenery used by `SnowmobileWorld`.
- Deterministic scenery randomness now lives in `frontend/src/racing/core/seededRandom.ts`.

Keep active snowmobile dependencies here or in `snowmobilerace`. Do not make live Aspen snowmobile code depend on legacy Aspen car/world files unless an explicit `aspen-car` event is intentionally added.
