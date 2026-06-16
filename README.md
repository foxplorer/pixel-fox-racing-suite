# Pixel Fox Racing Suite

Pixel Fox Racing Suite is an open-source browser racing game workspace with a React/Three.js frontend, a Socket.IO realtime server, and a BSV ordinal transaction server. It is designed to run locally in dummy transaction mode by default, while still giving builders a clear path to wire in their own real transaction infrastructure, branding, tracks, assets, and on-chain metadata.

The suite is intended as a forkable starting point for racing games, experiments, and community improvements. Pixel Racing Classic can live separately as the original pre-refactor version. This open-source Pixel Fox Racing codebase is the expandable foundation: it should keep the same playful racing personality, but it can grow into new cars, tracks, customization, platforms, graphics, and gameplay that are much deeper than the classic version. You can run it as-is, rebrand it for your own project, add tracks or collectibles, or use pieces of the code in another app under the MIT license.

## GitHub Metadata

Suggested repository description:

```text
Open-source Pixel Fox Racing game suite with React frontend, Socket.IO server, and BSV ordinal transaction server.
```

Suggested topics:

```text
react
vite
threejs
socketio
bsv
ordinals
racing-game
open-source
```

## Workspace

This repo contains the Pixel Fox Racing app split into three deployable folders:

- `frontend` - Vite React Pixel Fox Racing frontend at `/pixelfoxracing`
- `socket-server` - Pixel Fox Racing Socket.IO server at path `/pixelfoxracing`
- `transaction-server` - Pixel Fox Racing transaction API routes

## Tracks

The frontend includes these playable track environments:

- `Australia` - custom country-themed circuit layout authored for this project.
- `San Luis` - custom, hand-authored in-game circuit layout that is narrower than the other current tracks.
- `Belgium` - custom country-themed circuit layout authored for this project.
- `Aspen` - custom winter/snow mountain layout authored for this project.
- `United Kingdom` - custom imported GeoJSON layout with authored elevation and custom starter scenery.
- `Germany` - custom imported GeoJSON layout with authored elevation and generic imported-track scenery.

Track and asset provenance is documented in `ATTRIBUTIONS.md`. New tracks should include clear notes about whether the layout is original, public domain, MIT-compatible, or requires attribution. The current imported GeoJSON/elevation workflow is documented in `ADDING_IMPORTED_TRACKS.md`.

## Collaboration Plan

Project direction and contribution ideas are tracked in `PLAN.md`. The focused track and shared-systems refactor plan is in `REFACTOR.md`. The roadmap is intentionally open-ended: the goal is to see how good Pixel Fox Racing can become when any human builder or coding agent can run it, fork it, test ideas, and contribute focused improvements back.

## Local Ports

- Frontend: `5173`
- Socket server: `5000`
- Transaction server: `9000`

## Local Setup

Install dependencies once from the suite root:

```bash
cd pixel-fox-racing-suite
npm install
```

The app runs locally without env files:

- Frontend defaults to `http://localhost:5173`
- Socket server defaults to `http://localhost:5000`
- Transaction server defaults to `http://localhost:9000`
- Transaction server defaults to dummy mode, so no signing WIFs, database, or pay UTXOs are required.
- Default CORS allows only `http://localhost:5173`.
- Frontend racing diagnostics are off by default. Set `VITE_RACING_DIAGNOSTICS=true` in `frontend/.env` to enable track and vehicle debug logs.

Start the frontend and both servers from the suite root:

```bash
npm run dev
```

Open `http://localhost:5173/pixelfoxracing`.

You can also run each service in its own terminal:

```bash
# Terminal 1
cd pixel-fox-racing-suite/socket-server
npm run dev

# Terminal 2
cd pixel-fox-racing-suite/transaction-server
npm run dev

# Terminal 3
cd pixel-fox-racing-suite/frontend
npm run dev
```

## Transaction Routes

The transaction server exposes these Pixel Fox Racing routes:

- `POST /createpixelracing`
- `POST /createblueberries`
- `POST /createsalad`
- `POST /createrabbit`

## Wallet Behavior

The frontend supports two explicit wallet choices. The landing page does not
auto-connect or probe wallets before the player clicks a wallet button.

- `Connect Yours Wallet` uses the modern BRC-100 flow through `@1sat/react`,
  `@bsv/sdk`, and `@1sat/actions`. The app creates an actions context with
  `createContext(wallet, { chain: 'main', services })`, derives the payment and
  ordinal receive addresses with `deriveDepositAddresses`, and lists foxes with
  `getOrdinals` from the wallet-managed `p 1sat ordinals` basket. The
  deprecated legacy `window.yours` provider is not used.
- `Connect Metanet` uses the local Metanet JSON API wallet transport. Foxes are
  listed from the app-specific `pixel foxes` basket, and race collectibles are
  delivered through the same Metanet protocol-key/basket path.

Race collectibles intentionally use different receive mechanics per wallet:

- Yours collectibles are minted and broadcast to the derived ordinal receive
  address. In practice this is the Yours/1Sat ordinal path, backed by the
  wallet's `p 1sat ordinals` basket. The Yours extension automatically tracks
  that address, so collectibles appear in the wallet without any frontend
  action. The frontend does not call `internalizeAction` for Yours rewards.
- Metanet collectibles are minted and broadcast to a BRC-42 address derived from
  the player's `[0, 'pixel foxes']` protocol public key. The transaction server
  returns Atomic BEEF, output details, and remittance metadata for the
  app-specific `pixel foxes` basket. The frontend then calls `internalizeAction`
  on the Metanet client to import the output into that `pixel foxes` basket.
  This intentionally avoids the `p 1sat ordinals` basket/module path because
  Metanet Client can reject that path with missing `p` module errors. If this
  basket import step fails, the frontend retries three times with exponential
  backoff. If all retries fail, the broadcast transaction remains on-chain and
  visible in activity.

The transaction server receives a validated `deliveryTarget` union from the
frontend. The current modes are `address` for Yours-style address delivery and
`protocol-key` for Metanet basket delivery. Legacy names such as
`address-fallback` are not part of the current main request contract.

## Real Transaction Mode

Dummy mode returns fake 64-character hex txids so people can build locally without infrastructure.

The frontend leaderboard/history searches Gorillapool by MAP metadata rather than a fixed destination address. It reads historical `app=foxplorer`, `name=pixelracingtimes` results and the configured open-source result namespace, then merges them. By default, new open-source lap results use `app=pixelfoxracing`, `name=pixelracingtimes`.

When a fork runs in real transaction mode, its on-chain identity comes from its own signing keys, payment keys, destination addresses, and collectible collection IDs. Forks can also customize lap-result MAP metadata with `INSCRIPTION_APP` and `RACE_RESULT_INSCRIPTION_NAME`. If you customize those server values, set the frontend `VITE_PIXELRACING_RESULTS_APP` and `VITE_PIXELRACING_RESULTS_NAME` to the same values so stats can discover the inscriptions.

To create and broadcast real inscriptions, copy `transaction-server/.env.example` to `transaction-server/.env` and set:

- `TRANSACTION_MODE=real`
- `INSCRIPTION_APP=pixelfoxracing` - MAP `app` value for new inscriptions
- `RACE_RESULT_INSCRIPTION_NAME=pixelracingtimes` - MAP `name` value for lap-result inscriptions
- `DATABASE_URL`
- `GROUP_SIGNING_WIF`
- `PAYMENT_WIF`
- `CHANGE_ADDRESS` - your own change address
- `PIXELRACING_RESULTS_ADDRESS` - address that receives lap-result inscriptions in real mode; stats discovery does not depend on this address
- `BLUEBERRIES_COLLECTION_ID` - your own blueberries collection parent outpoint
- `SALAD_COLLECTION_ID` - your own salad collection parent outpoint
- `RABBIT_COLLECTION_ID` - your own rabbit collection parent outpoint

Real mode expects a `payment_utxos` table. See `transaction-server/schema.sql` for a starter schema.

## Release Checks

Before publishing a fork or release, run:

```bash
npm run build:frontend
npm run test:frontend-core
npm run check:socket
npm run check:transactions
npm run test:transactions
```

Manual wallet smoke tests should cover both wallet buttons, fox selection, one
Yours collectible broadcast to the ordinal address, and one Metanet collectible
internalization with retry behavior.
