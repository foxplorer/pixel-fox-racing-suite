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
```

`PORT`, `CORS_ORIGINS`, `INSCRIPTION_APP`, and
`RACE_RESULT_INSCRIPTION_NAME` have defaults shown in `.env.example`.

To exercise every route in real mode, configure:

```dotenv
TRANSACTION_MODE=real
DATABASE_URL=postgres://...
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
