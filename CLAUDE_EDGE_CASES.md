# Multiplayer Scheduled Race — Edge Cases And Issues

Findings from a code review of the open source suite on 2026-07-04
(`transaction-server/src/scheduledRaceStore.ts`, `scheduledRaceLifecycle.ts`,
`scheduledRaceRoutes.ts`, `transaction-server/src/index.ts`,
`socket-server/src/index.ts`, `socket-server/src/scheduledRaceRooms.ts`,
`frontend/src/racing/scheduled/*`). Severity is for the eventual prod
deployment; several items are acceptable in dev but must be fixed before the
prod sync.

2026-07-05 rollout note: user accepted the trust-boundary risk for low-traffic
online testing so the feature can be exercised on real servers sooner. That
does **not** close E2/E3/E7/E8/E9; it only means they are documented,
accepted beta risks until the mode is promoted from testing to trusted
production. See `PROD_SYNC_SCHEDULED_RACES.md` §5a for the online-testing
guardrails.

Target policy being checked against:
- Settle/inscribe at `startsAt + 15min`; unfinished staged foxes get DNF. ✅ implemented
- Also settle **early** as soon as all staged foxes finish 3 laps. ✅ FIXED 2026-07-04 (E1)
- Cancel the race if 1 or fewer foxes show up. ⚠️ improved 2026-07-04 (E4 leave-path fixed); E5 room-cancel propagation and E16 still open

## Fix status (updated 2026-07-04, all in the open source suite, both memory + Postgres stores)

| Case | Status |
| --- | --- |
| E1 early settlement | **FIXED** — `submitResult` settles the race as soon as every staged participant (works for 2-6 racers) has a finished result and the race is `racing`; the socket server announces the settlement immediately from the finish response instead of waiting for T+15m. Covered by new store tests, including a 4-player last-finisher test. |
| E3 result trust | **PARTIAL / ACCEPTED FOR ONLINE TESTING ONLY** — results are now rejected before `startsAt`, rejected for `cancelled`/`settled`/`no_contest`/`finalizing` races, and each lap must be ≥ 40s (`SCHEDULED_RACE_MIN_LAP_TIME_MS`, matching the casual floor). Still open: the endpoint is public (needs an internal token/co-sign before trusted prod) and there is no `finishedAt ≥ startsAt + 3×minLap` or `startsAt + totalTimeMs` wall-clock check yet. |
| E4 leave never unstages | **PARTIAL (main path fixed)** — new `POST /scheduled-races/:raceId/unstage` + `store.unstage` (idempotent, refuses after start); the socket server unstages the entrant on `leaveScheduledRaceRoom` while the room is not yet `racing`. Still open: a raw socket **disconnect** before start intentionally keeps the fox staged (a crash/refresh should not lose the seat) — decide whether a staged-but-disconnected fox at T-0 should count toward min-2. |
| E5 cancelled race still runs in room | **FIXED** (part 5, 2026-07-04) — the socket tick polls `GET /scheduled-races/:raceId` (new route + `store.getRace`) every 5s per active room and broadcasts terminal statuses via `scheduledRaceSettlement`; the client settlement listener freezes the countdown and shows the "Race cancelled" modal. Earlier partial fix (results rejected for cancelled races) still stands. |
| E11 no-contest never announced | **FIXED** — the settlement announcement now fires exactly once for `settled`/`no_contest`/`cancelled` outcomes, always emits `scheduledRaceSettlement`, and emits `newGameTransaction` only when a txid exists; the once-per-second re-settle loop is gone. |
| E13 finish single-path | **FIXED** (later 2026-07-04) — finish now waits for the socket ack and falls back to the idempotent HTTP `/results` endpoint on rejection/timeout/no-socket, with an error banner if both fail (`scheduledRaceFinishDelivery.ts`, wired in all three car-track components). |
| E17 reconnect orphaning | **PARTIAL** (later 2026-07-04) — socket reconnect during an active scheduled race now auto re-joins game + status + grid pose + race room (`scheduledRaceReconnect.ts`). Still open: lap-split rehydration after a full page refresh (needs `lapProgress` exposed in race responses). |
| E6 `?now=` time travel | **FIXED** (part 5, 2026-07-04) — `allowTimeTravelNow` route option: enabled in dummy mode, disabled in real mode unless `SCHEDULED_RACE_ALLOW_TIME_TRAVEL=true`. |
| E10 empty races become no_contest | **FIXED** (part 5, 2026-07-04) — `finalizeRace` (both stores) short-circuits to `cancelled` when fewer than 2 entrants were ever staged, so no tx-less no-contest records pollute completed listings. |
| E2, E7-E9, E12, E14-E16, E18-E26 | Open — see the entries below. E2 (public finalize/settle routes) is the top trusted-prod blocker; acceptable only for low-traffic beta testing with the guardrails in `PROD_SYNC_SCHEDULED_RACES.md` §5a. |

~~New follow-up created by the E1 fix~~ **DONE (part 5, 2026-07-04):** the
frontend now listens for `scheduledRaceSettlement` (via
`registerScheduledRaceSocketListeners`'s `onSettlement`); the finish banner
stops its countdown and shows "Results final — race inscribed ✓" /
"no contest" / "cancelled" as appropriate.

---

## Critical

### E1 — No early settlement when every staged fox finishes
The only settlement driver is the 15s sweep in `transaction-server/src/index.ts:169`
calling `settleDueRaces()`, and both store implementations only pick races where
`now >= startsAt + SCHEDULED_RACE_TIMEOUT_MS` (`scheduledRaceStore.ts:381-390`,
`:976-990`). `submitResult` never checks whether all staged entrants now have
finished results. So even when all 2-6 foxes finish their 3 laps in ~4 minutes,
everyone waits until T+15:00 for the inscription.
**Fix direction:** after a result is accepted in `submitResult`, count
non-withdrawn entrants with status `staged`/`finished`; if every one of them has
a `finished` result, call `settleRace` (or mark the race eligible so the next
sweep settles it). Socket server should then broadcast the settlement to the
room (it already does via `settleAndAnnounceScheduledRace`, but only fires on
the timeout clock at `socket-server/src/index.ts:376-388` — it needs the same
all-finished trigger, or a settlement notification from the tx server).
Note the HUD currently promises "results at startsAt + 15m"
(per plan doc) — the finish banner copy must change to "or sooner if everyone
finishes".

### E2 — `finalize` / `settle` / `final-inscription` endpoints are public and not time-guarded
`scheduledRaceRoutes.ts:132-157` exposes them with no auth and
`finalizeRace` only refuses races already `settled`/`no_contest`/`cancelled`
(`scheduledRaceStore.ts:301-305`). Anyone can `POST /scheduled-races/:id/finalize`
one second after the start: every racer still driving is flipped to DNF, then
`settle` mints the final inscription with bogus standings. In dev this is how we
test; in prod these must be internal/admin-only (shared token from the socket
server, or moved inside the lifecycle tick) **and** `finalizeRace` should refuse
to run before `startsAt + timeout` unless all staged entrants have finished.

### E3 — Results endpoint trusts the client entirely and is reachable directly
`POST /scheduled-races/:raceId/results` is public; the socket server's finish
validation (room membership, entrantId match at `socket-server/src/index.ts:717-741`)
is bypassable by posting straight to the transaction server with any staged
`entrantId`. Validation in `validateResultTiming` (`scheduledRaceStore.ts:435-455`)
only requires positive finite laps — a 3×1 ms finish is accepted. The casual lap
path enforces `laptime >= 40s` (`transaction-server/src/index.ts:197`), the
scheduled path enforces nothing.
**Fix direction (v1):** add per-track min/max lap bounds (reuse the 40s floor at
minimum), reject finishes where `finishedAt < startsAt + 3 * minLap`, and reject
finishes submitted before `startsAt`. For prod, results should carry a
socket-server co-sign or internal token so only socket-observed finishes land
(plan gap G3).

### E4 — A staged fox that leaves/disconnects before the start is never unstaged
`leaveScheduledRaceRoom` and socket disconnect only touch the socket room
(`socket-server/src/index.ts:515-536`, `:758-760`); the transaction-server signup
stays `staged` forever, and `withdraw` is closed once the race leaves
`scheduled`/`staging` (`scheduledRaceStore.ts:213-215`). Consequences:
- Two foxes stage, one closes the tab during countdown → race still counts as
  2 staged, starts, ghost gets DNF, the lone remaining fox "wins" a
  multiplayer inscription against nobody. Violates the min-2 rule's intent.
- The HUD `Leave Race` button during countdown can't actually withdraw the
  entrant server-side.
**Fix direction:** add an `unstage` (or DNS) transition allowed until
`startsAt`; socket server calls it when a staged entrant leaves the room before
racing; the cancel-at-grace check then sees the true staged count.

### E5 — Socket room lifecycle never learns about cancellation (or any tx-server status)
Room status is derived purely from the client-supplied `startsAt` clock
(`scheduledRaceRooms.ts:67-72`). If the tx server cancels the race (fewer than 2
staged at grace, `scheduledRaceLifecycle.ts:117-119`), the room still counts
down, unlocks `racing`, and the lone player drives 3 laps. `submitResult` has
**no race-status guard** (`scheduledRaceStore.ts:247-281`), so it even accepts a
result row for a cancelled race; the race then never settles and the player is
never told anything. **Fix direction:** the socket tick should poll the tx
server for the status of active room races (plan gap G2) and broadcast a
`scheduledRaceCancelled` event; `submitResult` should reject when race status is
`cancelled`/`settled`/`no_contest` (and before `startsAt`).

### E6 — Any anonymous GET can time-travel races via the `now` query param
`GET /scheduled-races` passes `parseNowMs(req.query.now)` into the store
(`scheduledRaceRoutes.ts:45`), and `buildRaceWithRoster` **persists** the
resolved status (memory: mutates `race.status`; Postgres: `UPDATE scheduled_races`
at `scheduledRaceStore.ts:1165-1169`). `finalizing` and `cancelled` are sticky in
`resolveScheduledRaceStatus`. So `GET /scheduled-races?now=2030-01-01T00:00:00Z`
permanently pushes every listed race into `finalizing`/`cancelled` state.
Useful for tests, catastrophic in prod. Gate `now` behind a dev flag or remove
it from the HTTP surface.

---

## High

### E7 — Room `startsAt` comes from the client, and the last joiner overwrites it
`joinRace` re-sets `roomMetadata` on every join (`scheduledRaceRooms.ts:115-119`)
using the joining client's payload. A stale showroom card (or malicious client)
joining with a different `startsAt` shifts the countdown for **everyone already
staged** in that room. The socket server should fetch/validate `startsAt` from
the transaction server once per race and ignore client-provided values
thereafter.

### E8 — Socket entrant identity is self-claimed
`joinScheduledRaceRoom` accepts whatever `entrantId` the socket sends; there is
no check that this socket's wallet/identity actually owns that signup. A second
connection claiming an existing `entrantId` even evicts the real player's
entrant from the room (`scheduledRaceRooms.ts:100-105`). Combined with E3, anyone
who can read the public roster can impersonate and finish (or grief) any
entrant. Minimum v1 fix: bind `entrantId` to the joining socket's `identityKey`
(the tx server knows the signup's `identityKey`) and reject mismatches.

### E9 — One fox/owner can sign up for unlimited overlapping races
Signup conflict checks only scan the roster of *that* race
(`scheduledRaceStore.ts:149-168`). The plan's "one active race per fox / one per
owner address per start window" (G9) is not implemented. With the dev 5-minute
interval and 15-minute timeout, three of a fox's races can be live at once; on
hourly prod cadence a fox can pre-book every track's race in the same hour.

### E10 — Untouched empty races settle as `no_contest` instead of `cancelled`
`settleDueRaces` picks any race past timeout whose stored status isn't
`settled`/`cancelled`/`no_contest`. A race that nobody ever listed/staged still
has stored status `scheduled` (statuses only advance when a request or the sweep
touches the race). `finalizeRace` doesn't re-resolve the time-based status, sees
zero finishers, and marks it `no_contest`, creating a tx-less final-inscription
record. Result: every generated-but-ignored race eventually pollutes
`GET /scheduled-races?status=completed` as `no_contest` (the memory store's
`listCompleted` includes them; same for Postgres). `settleRace` should first
resolve status and short-circuit to `cancelled` when the race never had 2 staged
entrants.

### E11 — No-contest settlements are never announced and re-settle every second
`settleAndAnnounceScheduledRace` returns before adding the raceId to
`announcedScheduledRaceSettlements` when there is no txid
(`socket-server/src/index.ts:362-372`), so for a no-contest race the socket
server POSTs `/settle` once per second until the room empties, and clients in
the room never receive `scheduledRaceSettlement`. Announce (with a
`no_contest`/`cancelled` shape) and mark announced regardless of txid.

---

## Medium

### E12 — Cancelled races silently vanish from the showroom list
`listUpcoming` filters out `cancelled` races (`scheduledRaceStore.ts:95`, `:608`).
A lone signed-up fox watching the card at T-60s sees the card disappear with no
explanation, and no socket event tells a staged client about the courtesy
cancel. Keep cancelled races in the list (with state label) for some minutes, or
emit a cancellation event.

### E13 — Finish delivery has a single path through the socket
The client submits the finish via `reportScheduledRaceFinish` only. If the
socket drops at lap 3 (or the socket server restarts), the finish is lost until
timeout DNFs the fox, even though `scheduledRaceApi.ts` has a direct
`/results` helper. Add an HTTP fallback retry in the frontend finish flow, and
make the duplicate-result check tolerant (currently a byte-identical duplicate
is idempotent, but a reconstructed report differing by 1 ms is a 409
`result_conflict`, `scheduledRaceStore.ts:259-264`).

### E14 — Casual ITT traffic can still touch scheduled racers
- Collisions: a casual player racing the same track sees scheduled racers in the
  global `gameState` (they stay in `serializablePlayers`,
  `socket-server/src/index.ts:186-207`) and can report a collision against one;
  validation only checks same `trackName` + collidable statuses
  (`:140-184`). The pair isn't in the same scheduled race, so the event
  broadcasts to the **global** room — which scheduled racers also sit in
  (`socket.join(ROOM_ID)` on connect). A scheduled racer can get an impulse from
  a car their client doesn't render. Either exclude scheduled racers from casual
  `gameState`/collision acceptance, or require both players casual for
  global-room collision relay.
- Items: `collectItem`/item spawns are global; confirm the frontend disables
  collectible pickups while a scheduled race is active (plan G13 says items
  should be off).

### E15 — Staging window edge mismatches
- `stage` rejects at exactly `nowMs >= startsAt` (`scheduledRaceStore.ts:229`),
  while the lifecycle keeps a 30s late-entry grace before cancelling
  (`scheduledRaceLifecycle.ts:117-122`) and the plan text allowed entry through
  T+30s. Intentional per the 2026-07-01 guard update, but the grace window now
  only serves cancellation — document or remove the constant's "late entry"
  name.
- A signed-up fox that stages at T-1s may still be mid-track-load at T and start
  seconds late with the clock already running; consider requiring staging to
  complete by T-15s (countdown window) in a later pass.

### E16 — Race with 2 staged where one never actually connects to the room
Staging is a tx-server HTTP call; joining the socket room is separate. A fox can
`stage` then never join the room (crash during load). The lifecycle counts them
as staged, so the race is not cancelled; they DNF at timeout. That matches "DNF
foxes who didn't finish", but if this makes the *other* fox race alone, the race
still produces a valid inscription — same family as E4. If min-2 should mean
"2 foxes actually in the room at start", the socket server needs to report room
presence to the tx server at T.

### E17 — In-memory store restart mid-race loses everything (dev only)
Races/signups/results vanish; subsequent finish reports 404
(`race_not_found`) and clients get `scheduledRaceFinishRejected` with no
recovery UI. Acceptable for dev; the Postgres store is the prod answer, but the
socket server also loses room state and does not rebuild rooms from the tx
server (plan G12) — after a socket restart, racers mid-race are orphaned (their
`joinGame`/room membership is gone and finishes will be rejected). Frontend
should auto-rejoin the room on socket reconnect while a scheduled race is
active.

---

## Low / notes

- **E18** — `normalizeEntrantId` uses `String.replace('.', '_')` which replaces
  only the first `.` (`scheduledRaceStore.ts:40`). Fine for `txid.vout`
  outpoints; breaks silently if a future id format has more dots.
- **E19** — Unbounded maps in the socket server: `collisionPairLastAcceptedAt`
  and `announcedScheduledRaceSettlements` never shrink. Slow leak; prune by age.
- **E20** — Postgres `listUpcoming` uses `LIMIT limit + lookaheadPadding` in SQL
  then filters cancelled/rotation in JS; with many per-track races in the window
  the requested count can come back short. Cosmetic.
- **E21** — `settleDueRaces` (Postgres) caps at 24 races per sweep; a long
  outage creates a backlog that drains slowly. Fine at current volume.
- **E22** — Lap-progress length limits disagree: socket validator allows up to
  10 laps (`scheduledRaceRooms.ts:87`), tx store rejects `> lapsRequired`
  (`scheduledRaceStore.ts:458`) — the failure only shows up as a server log line.
  Harmless, but align them.
- **E23** — Tie-break on equal `totalTimeMs` is server arrival time
  (`finishedAt` string compare). Network latency decides exact ties — acceptable
  and worth stating in the plan.
- **E24** — DNF rows reuse `finishedAt` for "finalized at"; if any UI ever shows
  DNF `finishedAt` as a finish time it will look like they finished at T+15:00.
- **E25** — The 15-minute timeout is duplicated as independent constants in
  `scheduledRaceLifecycle.ts:14` and `scheduledRaceRooms.ts:52`; if one is tuned
  (the plan suggested making it configurable pre-prod) the other will silently
  disagree. Single-source it (env var read by both, or shared package).
- **E26** — `buildScheduledRaceSettlementActivity` attributes the settlement
  activity to the first finisher's fox (`socket-server/src/index.ts:331-360`);
  in activity feeds the race record will look like a lap by P1. Cosmetic, but
  consider a dedicated activity shape.
