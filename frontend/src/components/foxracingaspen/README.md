# Aspen Component Notes

The official Aspen event is `aspen-snowmobile`.

The live app route renders `FoxRacingGame.tsx`, which uses `../snowmobilerace/SnowmobileWorld`.
Aspen is not currently an official car event and should not be treated as a shared-car track.

Files in this folder are mixed because Aspen was built before the current event/vehicle split:

- `FoxRacingGame.tsx` is the active Aspen snowmobile wrapper.
- Shared Aspen scenery that is used by the live snowmobile world should move toward `frontend/src/components/aspen`.
- `StadiumSeating.tsx` has already moved to `frontend/src/components/aspen/StadiumSeating.tsx`.
- Deterministic scenery randomness now lives in `frontend/src/racing/core/seededRandom.ts`, so live Aspen scenery no longer imports this utility from the legacy folder.
- Remaining scenery files such as `SimpleTrees.tsx`, terrain, mountains, lake, and advertising boards may still be reused or moved during later cleanup.
- `FreeRoamCar.tsx`, `FreeRoamSnowmobile.tsx`, and `FoxRacingWorld.tsx` are legacy Aspen-local vehicle/world paths unless they are deliberately reintroduced through an official track event.

Do not add an Aspen car event by importing legacy car files directly. If an Aspen car mode is ever wanted, add a real `aspen-car` event in `racing/tracks/trackEvents.ts`, declare its handling model and wall collision policy, and route it explicitly.
