# Prod Multiplayer Scheduled Race Port

Use this checklist to move the open-source scheduled race work into the prod
repos without overwriting deployment-specific code.

## Target Repos

- Frontend: `/home/to/Desktop/WORKING 6-28/frontend`
- Socket server: `/home/to/Desktop/WORKING 6-28/foxlive`
- Transaction server: `/home/to/Desktop/WORKING 6-28/transaction-server-prod`

## Transaction Server

1. Back up prod database and current prod server files.
2. Apply `transaction-server/schema.sql` to prod Postgres.
3. Port scheduled race files:
   - `src/scheduledRaceLifecycle.ts`
   - `src/scheduledRaceTypes.ts`
   - `src/scheduledRaceStore.ts`
   - `src/scheduledRaceRoutes.ts`
   - `src/multiplayerRaceInscription.ts`
4. Port `src/index.ts` changes carefully:
   - register scheduled race routes
   - select `MemoryScheduledRaceStore` or `PostgresScheduledRaceStore`
   - run the scheduled settlement sweep
   - keep prod CORS/routes/env handling intact
5. Set prod env:
   - `TRANSACTION_MODE=real`
   - `SCHEDULED_RACE_STORE=postgres`
   - `DATABASE_URL=postgres://...`
   - `SCHEDULED_RACE_INTERVAL_MINUTES=60`
   - `SCHEDULED_RACE_SETTLEMENT_INTERVAL_MS=15000`
6. Confirm `GET /` reports `scheduledRaceStore: "postgres"`.

Owner addresses are used server-side for one-active-signup-per-owner validation.
They are not included in the final multiplayer race inscription payload.

## Socket Server

1. Port scheduled room files:
   - `src/scheduledRaceRooms.ts`
2. Port `src/index.ts` changes carefully:
   - `joinScheduledRaceRoom`
   - `leaveScheduledRaceRoom`
   - scheduled-room countdown loop
   - scheduled lap progress relay
   - scheduled finish relay
   - settlement announcement via transaction server
3. Set prod env:
   - `TRANSACTION_SERVER_URL=<prod transaction server URL>`
   - keep existing prod `CORS_ORIGINS`

Socket server is live presence/relay only. The transaction server/Postgres store
is the source of truth for signups, results, DNFs, and final inscription state.

## Frontend

1. Port scheduled race frontend files:
   - `src/racing/scheduled/*`
   - `src/racing/components/ScheduledRacePanel.tsx`
   - `src/racing/components/ScheduledRaceStandingsPanel.tsx`
2. Port the relevant integrations into existing prod game/showroom files,
   preserving prod-only wallet/routing/config differences.
3. Keep prod Vite env config as the source of server URLs:
   - transaction server URL
   - socket server URL/path
4. Verify the showroom race rack fetches the global rotating schedule. It should
   not pass the current track as a filter unless you intentionally want
   same-track-only cards.

Scheduled stats rows use fox origin identity (`recordVersion: 2`) and avoid
displaying owner addresses in multiplayer race history.

## Validation Order

1. Run prod transaction server against Postgres with `TRANSACTION_MODE=dummy`
   and `SCHEDULED_RACE_STORE=postgres`.
2. Confirm signups persist after server restart.
3. Confirm duplicate prevention:
   - same owner cannot enter two foxes in the same race
   - same fox origin cannot enter twice
   - same identity key cannot enter twice
4. Run a two-player dummy scheduled race.
5. Wait past `startsAt + 15 minutes` or use a short local interval in staging.
6. Confirm final race record persists with a deterministic dummy txid.
7. Confirm connected room players receive Latest Transactions update.
8. Reload frontend and confirm completed multiplayer race appears from stats.
9. Only after dummy/Postgres passes, test `TRANSACTION_MODE=real` with a small
   funded UTXO pool.

## Remaining Real-Broadcast Gap

The Postgres scheduled race store persists the final inscription record and is
ready for idempotent status updates, but the open-source suite still creates a
deterministic dummy txid for the final multiplayer race inscription. Real
broadcast logic for that final race inscription must be wired before relying on
live on-chain settlement.
