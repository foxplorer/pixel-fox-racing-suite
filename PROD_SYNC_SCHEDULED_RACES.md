# Prod Sync — Scheduled Multiplayer Races (transaction server)

How to move the scheduled-race system from this open source suite into
`../transaction-server-prod` when the time comes. Written 2026-07-04 after
verifying the prod directory layout. **Goal: the sync is copy-files + paste one
wiring block + run schema.sql — nothing else.** Not executed yet.

## Current state of the two servers

- Suite: `transaction-server/src/*` (ESM, `node --import tsx`, files import each
  other with `./name.js` specifiers).
- Prod: flat directory, TypeScript files at the root (Bun lockfile present;
  `pg` 8.16, `express` 4.19, `cors` present). **No `scheduledRace*` files, no
  `multiplayerRaceInscription*`, no `db.ts`, and no schema.sql exist there yet**
  — nothing to merge, only additions.
- Prod already uses `DATABASE_URL`-backed pg pools (see `courier-db.ts`), so the
  scheduled-race Postgres store fits the existing config pattern.

## 1. Files to copy (suite → prod root, no renames, no edits)

From `pixel-fox-racing-suite/transaction-server/src/`:

| File | Why |
| --- | --- |
| `scheduledRaceTypes.ts` | shared types + `ScheduledRaceError` + store interface |
| `scheduledRaceLifecycle.ts` | status resolution, timing constants, race id/rotation |
| `scheduledRaceStore.ts` | memory + Postgres stores (all fixes live in **both**) |
| `scheduledRaceRoutes.ts` | HTTP surface incl. `GET /scheduled-races/:raceId` |
| `multiplayerRaceInscription.ts` | final-inscription payload builder |
| `db.ts` | exports the `pool` used by the Postgres store — **see note** |
| `scheduledRaceStore.test.ts`, `multiplayerRaceInscription.test.ts` | keep the suite green in prod too |

The whole set is self-contained: its only imports are each other, `./db.js`,
`express`, and `pg`. Relative specifiers stay valid because prod is flat and the
files sit side by side, same as in `src/`.

**`db.ts` note:** prod has no file named `db.ts`, so the copy is non-conflicting.
It creates its own `Pool` from `DATABASE_URL` (same pattern as `courier-db.ts`)
plus payment-UTXO helpers prod may not need — harmless duplicates. If you prefer,
copy only the first ~25 lines (the `pool` export); `scheduledRaceStore.ts`
imports nothing else from it.

## 2. index.ts wiring (paste into prod `index.ts`)

Imports at top:

```ts
import { registerScheduledRaceRoutes } from './scheduledRaceRoutes.js'
import { MemoryScheduledRaceStore, PostgresScheduledRaceStore } from './scheduledRaceStore.js'
import type { ScheduledRaceStore } from './scheduledRaceTypes.js'
```

After the express `app` exists (mirror of suite `index.ts:159-189`):

```ts
const scheduledRaceIntervalMinutes = Number(process.env.SCHEDULED_RACE_INTERVAL_MINUTES)
const scheduledRaceIntervalMs = Number.isFinite(scheduledRaceIntervalMinutes) && scheduledRaceIntervalMinutes > 0
  ? scheduledRaceIntervalMinutes * 60 * 1000
  : undefined // undefined = hourly prod cadence
const scheduledRaceStoreMode = (process.env.SCHEDULED_RACE_STORE || 'memory').trim().toLowerCase()
const scheduledRaceStore: ScheduledRaceStore = scheduledRaceStoreMode === 'postgres'
  ? new PostgresScheduledRaceStore(scheduledRaceIntervalMs)
  : new MemoryScheduledRaceStore(scheduledRaceIntervalMs)
const scheduledRaceSettlementIntervalMs = Number(process.env.SCHEDULED_RACE_SETTLEMENT_INTERVAL_MS || 15_000)

setInterval(() => {
  scheduledRaceStore.settleDueRaces?.().catch(error => {
    console.error('Scheduled race settlement sweep failed:', error)
  })
}, Number.isFinite(scheduledRaceSettlementIntervalMs) && scheduledRaceSettlementIntervalMs > 0
  ? scheduledRaceSettlementIntervalMs
  : 15_000)

registerScheduledRaceRoutes(app, {
  store: scheduledRaceStore,
  // E6 guard: `?now=` time travel persists resolved race statuses. Leave OFF in prod.
  allowTimeTravelNow: process.env.SCHEDULED_RACE_ALLOW_TIME_TRAVEL === 'true',
})
```

(The suite gates time travel with `!USE_REAL_TRANSACTIONS || env`; prod should
use the env-only form above since prod is always real mode.)

## 3. Database schema

Run `pixel-fox-racing-suite/transaction-server/schema.sql` against the prod
database. Every statement is `CREATE TABLE IF NOT EXISTS` / additive, so it is
safe on a live DB; `payment_utxos` already existing in prod is fine. Tables the
scheduled-race code needs:

- `scheduled_races`
- `scheduled_race_signups`
- `scheduled_race_lap_progress`
- `scheduled_race_results`
- `scheduled_race_final_inscriptions`

Verified 2026-07-04: the current schema.sql covers everything the store code
touches (this session's fixes — E10 cancel short-circuit, `getRace` — required
no schema change).

## 4. Environment for prod

| Var | Value | Note |
| --- | --- | --- |
| `SCHEDULED_RACE_STORE` | `postgres` | memory store loses races on restart |
| `DATABASE_URL` | (already set) | shared with existing prod pools |
| `SCHEDULED_RACE_INTERVAL_MINUTES` | unset | unset = hourly; `5` only for testing |
| `SCHEDULED_RACE_SETTLEMENT_INTERVAL_MS` | unset | defaults to 15s sweep |
| `SCHEDULED_RACE_ALLOW_TIME_TRAVEL` | unset | **must stay unset in prod (E6)** |

## 5. Blockers to close BEFORE announcing prod races (not before copying)

From `CLAUDE_EDGE_CASES.md` — copying the files is safe today, but these must
land before real players race for real inscriptions:

1. **E2** — `finalize` / `settle` / `final-inscription` / `unstage` (and ideally
   `results`/`progress`) are unauthenticated. Add a shared internal token
   checked by the routes and sent by the socket server, or move
   finalize/settle entirely into the lifecycle sweep.
2. **E3 remainder** — reject finishes where `finishedAt < startsAt + 3×minLap`;
   longer term, socket-server co-sign on results.
3. **E7/E8** — socket room `startsAt` and `entrantId` are client-claimed; bind
   entrant to the socket's `identityKey` and fetch `startsAt` from the tx server.
4. **E9** — one active race per fox / per owner per start window.
5. Remember the **socket server** and **frontend** also need their prod deploys
   pointed at the prod transaction server (this doc covers only the tx server).

## 5a. Online testing exception — acceptable known risk

For low-traffic online testing, it is acceptable to deploy the current
open-source scheduled-race implementation before closing §5, as long as the
deployment is treated as a **test/beta feature** and not announced as a trusted
competitive mode.

Known risk accepted for testing:

1. `POST /scheduled-races/:raceId/results` and `/progress` are public. A caller
   who knows a staged `entrantId` can bypass the socket server and submit
   client-claimed lap data.
2. `POST /scheduled-races/:raceId/finalize`, `/final-inscription`, and `/settle`
   are public. A caller can force state transitions earlier than intended.
3. Result timing has only basic validation: results are rejected before
   `startsAt`, after terminal/finalizing states, and when any lap is below 40s,
   but the store does **not** yet require the HTTP submission wall-clock to be
   at least `startsAt + totalTimeMs` or `startsAt + 3×minLap`.
4. Socket room identity is still client-claimed (`entrantId` and `startsAt`
   should eventually be verified against the transaction server).

Operational guardrails while testing online:

1. Label multiplayer races as beta/test in any admin/deploy notes.
2. Prefer dummy/test races until the trust-boundary fixes are done.
3. Monitor completed race rows for impossible total times, unexpected early
   finalization, and duplicate/conflicting entrant behavior.
4. Do not use the resulting multiplayer records for prizes, rankings, or any
   durable public claims until §5 is closed.
5. If tampering appears, disable the scheduled-race UI first; the current API
   surface is intentionally not hardened enough to rely on obscurity.

Promotion criteria from online testing to trusted production:

1. Add an internal/admin auth boundary for finalize/settle/final-inscription and
   a socket-server co-sign or internal token for result/progress writes.
2. Add wall-clock validation for finish submissions.
3. Bind socket room joins to the staged signup identity and authoritative
   `startsAt`.
4. Re-run the full two-browser scheduled-race flow on the prod stack after those
   fixes land.

## 6. Post-sync verification

1. `bun test` (or prod's test runner) — `scheduledRaceStore.test.ts` passes
   against the copied files.
2. `GET /scheduled-races` returns hourly races; `GET /scheduled-races/:raceId`
   returns one race.
3. `GET /scheduled-races?now=2030-01-01T00:00:00Z` **ignores** the param
   (statuses unchanged afterward) — proves the E6 gate is active.
4. Two-fox dummy race end-to-end on a staging DB before real inscriptions.

## Known flake (pre-existing, unrelated)

`sdkCollectibleTransaction.test.ts` › "buildCollectibleLockingScript creates a
spendable inscription" fails ~1 in 5 runs (`inscription.getContent()` comes back
empty — random-key dependent). Present in both suite and prod copies of that
file; not caused by scheduled-race work. Worth fixing separately.
