# Forking and Rebranding

Pixel Fox Racing Suite is designed to be forked. The default settings run locally without private infrastructure, and production identity is configured through environment variables where possible.

## Public Branding

Common user-facing branding lives in:

- `frontend/src/assets/pixel_racing_logo.png` - topbar and modal logo
- `frontend/index.html` - browser title
- `frontend/public/manifest.json` and `frontend/public/site.webmanifest` - installable app name
- `frontend/src/components/FooterHome.tsx` - footer links
- `README.md`, `CONTRIBUTING.md`, and `LICENSE` - repository name and contributor identity

The footer project link can be changed without code edits:

```env
VITE_PIXELRACING_GITHUB_URL=https://github.com/your-org/your-repo
```

## Server URLs

The frontend defaults to local development servers:

```env
VITE_PIXELRACING_SOCKET_URL=http://localhost:5000
VITE_PIXELRACING_TRANSACTION_URL=http://localhost:9000
```

Set these in `frontend/.env` for a deployed fork.

## On-Chain Metadata

Lap-result inscriptions are discovered by MAP metadata. If you customize the server metadata, set the matching frontend discovery values.

Transaction server:

```env
INSCRIPTION_APP=pixelfoxracing
RACE_RESULT_INSCRIPTION_NAME=pixelracingtimes
```

Frontend:

```env
VITE_PIXELRACING_RESULTS_APP=pixelfoxracing
VITE_PIXELRACING_RESULTS_NAME=pixelracingtimes
```

The frontend also reads legacy `app=foxplorer`, `name=pixelracingtimes` records so historical results can remain visible.

## Private Infrastructure

Do not commit private deployment settings:

- `.env` files
- signing WIFs
- payment WIFs
- database URLs
- production collection IDs you do not intend to publish

Use `transaction-server/.env.example`, `socket-server/.env.example`, and `frontend/.env.example` as templates.
