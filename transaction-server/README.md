# Transaction Server

The open-source transaction server is local-first by default. It is safe to run
in dummy mode without keys, funds, or PostgreSQL. Real mode is available for
fork maintainers who want to test their own funded BSV ordinal transaction
pipeline before operating it with production funds.

The server handles two public real-mode collectible delivery paths and a dummy
mode for local development:

- `dummy`: returns a fake 64-character hex txid so any player can build and test locally without infrastructure.
- `address` (real mode for Yours Wallet): the server mints and broadcasts the
  collectible to the ordinal receive address supplied by the Yours Wallet
  frontend. No client internalization step is needed because the Yours extension
  automatically tracks addresses it controls.
- `protocol-key` (real mode for Metanet): the server mints and broadcasts the
  collectible to a BRC-42 address derived from the player's `[0, 'pixel foxes']`
  protocol public key. The server returns Atomic BEEF plus the actual output
  index and remittance metadata. The Metanet frontend then calls
  `internalizeAction` to import the output into the app-specific `pixel foxes`
  basket.

No server wallet database is required. `GROUP_SIGNING_WIF` provides a stable
server identity key for deterministic BRC-42 derivation and also signs the
collectible's Sigma issuer proof. PostgreSQL remains the payment UTXO store.

Yours and Metanet intentionally use different wallet storage paths. Yours uses
an address delivery path that the Yours/1Sat wallet tracks under
`p 1sat ordinals`. Metanet uses the `pixel foxes` protocol and basket because
Metanet Client can reject the `p 1sat ordinals` module path with missing `p`
module errors.

## Environment

Dummy mode needs no secrets or database:

```dotenv
TRANSACTION_MODE=dummy
SCHEDULED_RACE_STORE=memory
```

`PORT`, `CORS_ORIGINS`, `INSCRIPTION_APP`, and
`RACE_RESULT_INSCRIPTION_NAME` have defaults shown in `.env.example`.

To exercise every route in real mode, configure:

```dotenv
TRANSACTION_MODE=real
DATABASE_URL=postgres://...
SCHEDULED_RACE_STORE=postgres
GROUP_SIGNING_WIF=...
PAYMENT_WIF=...
CHANGE_ADDRESS=...
PIXELRACING_RESULTS_ADDRESS=...
BLUEBERRIES_COLLECTION_ID=...
SALAD_COLLECTION_ID=...
RABBIT_COLLECTION_ID=...
```

The payment table and pool may be omitted when using
`transaction-server/schema.sql`. Its defaults are `payment_utxos` and
`default`. Existing deployments can override both values. `BSV_NETWORK`
defaults to `main`, the collectible fee rate defaults to `100 sat/KB`, and
`WHATSONCHAIN_API_KEY` is optional.

Route-specific requirements:

- Lap results require `PIXELRACING_RESULTS_ADDRESS`.
- Each collectible route requires only its corresponding collection ID.
- Every real transaction requires PostgreSQL funding, `PAYMENT_WIF`,
  `CHANGE_ADDRESS`, and `GROUP_SIGNING_WIF`.

## Scheduled Race Routes

Scheduled race development routes are available in dummy/local mode:

- `GET /scheduled-races`
- `POST /scheduled-races/:raceId/signup`
- `DELETE /scheduled-races/:raceId/signup`
- `POST /scheduled-races/:raceId/stage`
- `POST /scheduled-races/:raceId/results`
- `POST /scheduled-races/:raceId/finalize`
- `POST /scheduled-races/:raceId/final-inscription`
- `POST /scheduled-races/:raceId/settle`

Scheduled race state defaults to `SCHEDULED_RACE_STORE=memory` so the open
source suite runs locally without PostgreSQL. After applying
`transaction-server/schema.sql`, set `SCHEDULED_RACE_STORE=postgres` and
`DATABASE_URL=postgres://...` to persist scheduled races, signups, staged grid
slots, lap progress, results, and final multiplayer race inscription records.
The frontend API contract is unchanged; deployments only need the usual
frontend transaction-server URL config.

`GET /scheduled-races?status=completed` returns finalized, settled, and
no-contest races with roster/results/podium data for local stats integration.

Schema setup for Postgres-backed scheduled races:

```bash
psql "$DATABASE_URL" -f transaction-server/scheduled-races-schema.sql
```

or, when running from inside the transaction-server directory:

```bash
psql "$DATABASE_URL" -f scheduled-races-schema.sql
```

Optional timing overrides:

```dotenv
SCHEDULED_RACE_INTERVAL_MINUTES=5
SCHEDULED_RACE_SETTLEMENT_INTERVAL_MS=15000
```

The default scheduled-race cadence is hourly. `SCHEDULED_RACE_INTERVAL_MINUTES`
is useful for local or low-traffic online testing; set it back to `60` or unset
it before treating the schedule as a production event cadence.

`POST /scheduled-races/:raceId/results` accepts `entrantId`, `totalTimeMs`, and
`lapTimesMs`. The in-memory store validates that the entrant was staged, the lap
count matches the race's `lapsRequired`, and the total time matches the summed
lap times. Duplicate identical results are idempotent; conflicting duplicates
are rejected. Accepted results mark entrants finished, rank finish positions by
total time, and expose a `podium` array with the top three finishers.

`POST /scheduled-races/:raceId/finalize` marks any unfinished staged entrants as
`dnf`, keeps DNF result rows with nullable `totalTimeMs`, and moves the race to
`no_contest` when no entrant finished.

`POST /scheduled-races/:raceId/final-inscription` creates/fetches the final
race inscription record for an already-finalized race.

`POST /scheduled-races/:raceId/settle` finalizes unfinished staged entrants and
creates/fetches the final race inscription record in one idempotent call. In the
current open-source suite that final inscription still uses a deterministic
dummy txid with `outputIndex: 0`; the Postgres store persists that record so the
same endpoint can be promoted to real broadcast status updates in production.
The persisted table is `scheduled_race_final_inscriptions`.
The inscription payload contains the roster, finishers, DNFs, lap arrays, race
ID, track, start time, and finalization time. Separate trophy outputs are
intentionally not part of the current model; trophy/no-trophy UI is inferred
from finish position.

Settlement rules:

- If fewer than two entrants ever stage, the race is cancelled and no final
  inscription record is created.
- If two or more entrants stage and nobody finishes before the timeout, staged
  entrants are recorded as DNF, the race becomes `no_contest`, and no on-chain
  inscription tx is required.
- If at least one entrant finishes, unfinished staged entrants are recorded as
  DNF and the final race payload includes both finishers and DNFs.
- If every staged entrant finishes before the 15-minute timeout, the race may
  settle early instead of waiting for the timeout.

Frontend stats integration currently reads completed multiplayer races from the
scheduled-race API, not from GorillaPool. `GET /scheduled-races?status=completed`
is flattened into per-lap rows for current-era track leaderboards, while the
final race inscription txid appears in the Multiplayer activity tab.

Production deployments can replace the dummy final-inscription creator with a
real broadcaster. The Pixel Fox production deployment uses the legacy Pixel
Racing payment UTXO path, sends final multiplayer inscriptions to
`PIXELRACING_RESULTS_ADDRESS`, records payment reservations with
`server_instance = "pixelracing-multiplayer-server"`, and submits successful
txids to GorillaPool for indexing.

## Metanet Protocol-Key Delivery Test

Metanet protocol-key delivery spends a reserved PostgreSQL payment UTXO. Before
using it with real funds:

1. Apply `transaction-server/schema.sql` and ensure `payment_utxos` has an
   available row in the `default` pool. Override `PAYMENT_UTXO_TABLE` and
   `PAYMENT_UTXO_POOL` for an existing compatible database.
2. Set the three collectible collection IDs.
3. Set `GROUP_SIGNING_WIF`, `PAYMENT_WIF`, `CHANGE_ADDRESS`, and optionally
   `WHATSONCHAIN_API_KEY`.
   The collectible fee rate defaults to `100 sat/KB` and can be overridden with
   `SDK_FEE_RATE_SAT_PER_KB`.
4. Set `TRANSACTION_MODE=real`; protocol-key delivery is available when the
   transaction server has the real-mode signing and payment settings above.
5. Collect one item with a connected test wallet.
6. Confirm the HTTP response includes Atomic BEEF, the actual output index
   from the transaction, `remittance.protocolID: [0, 'pixel foxes']`,
   `remittance.keyID: '1'`, `remittance.counterparty: 'anyone'`,
   `remittance.basket: 'pixel foxes'`, and tags. Never assume the ordinal is at
   output index `0`.
7. Confirm the frontend internalizes the output into the Metanet `pixel foxes`
   basket.
8. Reload the wallet and verify the outpoint is still listed and spendable.

For production operation, add the operational controls your deployment needs:
funding recovery, idempotency, authentication, monitoring, and retry
persistence. Dummy mode remains the recommended default for ordinary local
development.

The suite builder adds Sigma issuer signatures to collectible outputs.
`GROUP_SIGNING_WIF` signs the collectible output; `PAYMENT_WIF` separately signs
the PostgreSQL funding input. The server returns Atomic BEEF to the client and
broadcasts the raw transaction through WhatsOnChain.
