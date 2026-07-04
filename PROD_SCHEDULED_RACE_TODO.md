# Prod Scheduled Race TODO

Living checklist for moving scheduled multiplayer races from the open-source
suite into prod.

## Current Goal

Move the open-source scheduled race implementation into prod while preserving
prod-specific frontend, socket server, transaction server, env, routes, and
deployment behavior.

## Prod Repos

- Frontend: `/home/to/Desktop/WORKING 6-28/frontend`
- Socket server: `/home/to/Desktop/WORKING 6-28/foxlive`
- Transaction server: `/home/to/Desktop/WORKING 6-28/transaction-server-prod`
- Open-source source repo: `/home/to/Desktop/WORKING 6-28/pixel-fox-racing-suite`

## Blockers Before Real Prod Broadcast

- [ ] Port transaction-server scheduled race files into prod.
- [ ] Apply scheduled race schema to prod Postgres.
- [ ] Set `SCHEDULED_RACE_STORE=postgres` in prod transaction server.
- [ ] Set `SCHEDULED_RACE_INTERVAL_MINUTES=60` in prod transaction server.
- [ ] Confirm prod transaction health endpoint reports `scheduledRaceStore: "postgres"`.
- [ ] Port socket scheduled-room files and event handlers into prod socket server.
- [ ] Confirm prod socket server points at prod transaction server with `TRANSACTION_SERVER_URL`.
- [ ] Port frontend scheduled race components/helpers into prod frontend.
- [ ] Confirm prod frontend Vite config points at prod transaction and socket servers.
- [ ] Run dummy/Postgres end-to-end race in prod-like environment.
- [ ] Implement real final `multiplayer race` inscription broadcast.
- [ ] Test real broadcast with a small funded UTXO pool before public launch.

## Transaction Server Tasks

- [ ] Copy/merge:
  - `transaction-server/src/scheduledRaceLifecycle.ts`
  - `transaction-server/src/scheduledRaceTypes.ts`
  - `transaction-server/src/scheduledRaceStore.ts`
  - `transaction-server/src/scheduledRaceRoutes.ts`
  - `transaction-server/src/multiplayerRaceInscription.ts`
- [ ] Carefully merge `transaction-server/src/index.ts` scheduled race setup.
- [ ] Carefully merge `transaction-server/src/db.ts` pool export if prod does not already expose it.
- [ ] Apply or migrate `transaction-server/schema.sql`.
- [ ] Confirm these tables exist:
  - `scheduled_races`
  - `scheduled_race_signups`
  - `scheduled_race_lap_progress`
  - `scheduled_race_results`
  - `scheduled_race_final_inscriptions`
  - `payment_utxos`
- [ ] Confirm unique constraints/indexes block:
  - same owner address entering twice in one race
  - same identity key entering twice in one race
  - same fox origin entering twice in one race
  - same current fox outpoint entering twice in one race
  - duplicate staged grid slots
- [ ] Confirm final inscription payload does not include `ownerAddress`.
- [ ] Confirm owner address is only used server-side for duplicate signup prevention.
- [ ] Confirm scheduled settlement sweep is running.

## Socket Server Tasks

- [ ] Copy/merge `socket-server/src/scheduledRaceRooms.ts`.
- [ ] Carefully merge `socket-server/src/index.ts` scheduled race changes:
  - scheduled race room join/leave
  - countdown broadcast
  - room-scoped position updates
  - room-scoped collision updates
  - lap progress relay
  - finish relay
  - settlement announcement
- [ ] Confirm `TRANSACTION_SERVER_URL` points to prod transaction server.
- [ ] Confirm connected players receive final race transaction activity after settlement.
- [ ] Confirm disconnected players can still see completed race after reload via stats.

## Frontend Tasks

- [ ] Copy/merge `frontend/src/racing/scheduled/*`.
- [ ] Copy/merge:
  - `frontend/src/racing/components/ScheduledRacePanel.tsx`
  - `frontend/src/racing/components/ScheduledRaceStandingsPanel.tsx`
- [ ] Carefully merge scheduled race integration into prod showroom/game files.
- [ ] Confirm Vite env continues to control transaction/socket URLs.
- [ ] Confirm race rack uses global rotating schedule, not current-track-only filtering.
- [ ] Confirm scheduled stats rows use fox origin identity and do not display owner address.
- [ ] Confirm Latest Transactions shows final multiplayer race transaction.
- [ ] Confirm completed multiplayer races appear after page reload.

## Schedule Rules

- Prod race cadence: hourly.
- Prod env: `SCHEDULED_RACE_INTERVAL_MINUTES=60`.
- Track rotation:
  - Australia
  - San Luis
  - Belgium
  - United Kingdom
  - Germany
  - Volcanoes
  - repeat
- Showroom should show the next global rotating race cards.
- Track-specific filtering should only be used if intentionally showing same-track-only races.

## Privacy Rules

- Owner address is required for server-side one-owner-per-race validation.
- Owner address should not be included in final `multiplayer race` inscription text.
- Owner address should not be included in final `multiplayer race` metadata.
- Multiplayer stats should rank/display by fox origin outpoint.
- Scheduled race stat rows should use `recordVersion: 2` and blank `owneraddress`.

## Dummy/Postgres Validation

- [ ] Start prod transaction server with:
  - `TRANSACTION_MODE=dummy`
  - `SCHEDULED_RACE_STORE=postgres`
  - `DATABASE_URL=...`
- [ ] Confirm scheduled races persist after transaction server restart.
- [ ] Sign up two players.
- [ ] Confirm signup roster appears in both showrooms.
- [ ] Attempt duplicate owner signup and confirm rejection.
- [ ] Attempt duplicate fox signup and confirm rejection.
- [ ] Stage both players.
- [ ] Confirm both enter same socket room.
- [ ] Complete one or both races.
- [ ] Confirm lap progress persists.
- [ ] Let race pass `startsAt + 15 minutes`.
- [ ] Confirm DNF rows are created for unfinished staged racers.
- [ ] Confirm final dummy multiplayer txid is persisted.
- [ ] Confirm connected room players see Latest Transactions update.
- [ ] Reload frontend and confirm completed race appears in stats.

## Real Broadcast Validation

- [ ] Fund a small prod/test UTXO pool.
- [ ] Set `TRANSACTION_MODE=real`.
- [ ] Confirm `GROUP_SIGNING_WIF`, `PAYMENT_WIF`, and `CHANGE_ADDRESS` are set.
- [ ] Create one scheduled race with finishers.
- [ ] Confirm final inscription status moves through a safe idempotent path:
  - `pending`
  - `broadcasting`
  - `broadcasted`
- [ ] Confirm final txid is real and viewable.
- [ ] Confirm failed broadcast leaves enough error info to retry safely.
- [ ] Confirm two transaction server instances cannot double-broadcast the same race.

## Deferred Questions

- [ ] Add admin retry tooling later if live final inscription failures need manual recovery.
- [ ] Decide whether completed scheduled races need pagination beyond current limits.
- [ ] Decide whether no-contest races should appear in public stats or only admin/history views.
