# Pixel Fox Racing Frontend

Vite React frontend for the Pixel Fox Racing Suite.

## Wallet Flow

The landing page is intentionally browseable without a wallet. Wallet work only
starts after the player clicks one of the explicit buttons:

- `Connect Yours Wallet`
- `Connect Metanet`

### Yours Wallet

Yours uses the modern BRC-100 flow, not the deprecated legacy `window.yours`
provider.

The current path is:

1. `@1sat/react` supplies the connected wallet from `useWallet()`.
2. `walletProviders.ts` creates a BRC-100 `WalletClient('window.CWI')` for the
   Yours button.
3. `oneSatWallet.ts` creates an actions context:

   ```ts
   createContext(wallet, { chain: 'main', services })
   ```

4. Pixel Foxes are listed with `getOrdinals.execute(ctx, ...)`.
5. Payment and ordinal receive addresses are derived with
   `deriveDepositAddresses.execute(ctx, { startIndex: 0, count: 2 })`.
6. Race collectibles are sent to the derived ordinal address with
   `deliveryTarget: { type: 'address' }`.

The frontend must not call `internalizeAction` for Yours rewards.

### Metanet

Metanet uses `WalletClient('json-api')`, currently expected at the local Metanet
JSON API transport.

The current path is:

1. The frontend verifies access to the `pixel foxes` protocol key.
2. Pixel Foxes are listed from the `pixel foxes` basket with `wallet.listOutputs`.
3. Race collectibles use `deliveryTarget: { type: 'protocol-key' }` with the
   protocol ID, key ID, counterparty, destination basket, and public key derived
   from the player's protocol key.
4. The transaction server derives a BRC-42 address from the player's protocol key,
   mints and broadcasts the collectible reliably, and returns Atomic BEEF plus
   the actual output index and remittance metadata.
5. The frontend calls `internalizeAction` on the Metanet client with the returned
   receipt to import the output into the `pixel foxes` basket. This basket import
   step is what the three exponential-backoff retry attempts cover - not the
   server broadcast, which has already succeeded.

Metanet is a first-class selected wallet, not a fallback for Yours.

Basket naming is wallet-specific:

- Yours receives collectibles at the derived ordinal address. The Yours/1Sat
  wallet path manages those ordinals under `p 1sat ordinals`; the frontend does
  not internalize them.
- Metanet receives collectibles through the `[0, 'pixel foxes']` protocol key and
  internalizes them into the `pixel foxes` basket. Do not switch Metanet to
  `p 1sat ordinals`: Metanet Client can reject that path with missing `p` module
  errors.

## Checks

Run from this folder:

```bash
npm run test:core
npm run build
```

Run from the suite root for the full open-source workspace:

```bash
npm run check:socket
npm run check:transactions
npm run test:transactions
```
