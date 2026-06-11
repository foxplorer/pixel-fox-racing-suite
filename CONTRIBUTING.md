# Contributing

Pixel Fox Racing Suite is MIT licensed so builders can fork it, remix it, and ship their own versions.

If you make improvements that could help the shared project, pull requests are welcome. The goal is a healthy ecosystem of forks, experiments, and reusable racing code.

Pixel Fox Racing Suite is intended to be easy to improve with human or AI-assisted development.

By contributing to this project, you agree that your contributions are licensed under the MIT License.

Before opening a PR:

- Keep changes scoped to one concern.
- Run the relevant command:
  - `npm run build:frontend`
  - `npm run check:socket`
  - `npm run check:transactions`
- Include screenshots or short screen recordings for frontend changes.
- Do not commit `.env` files, signing WIFs, database URLs, or generated folders.
- Prefer local dummy transaction mode for development unless the change specifically needs real inscriptions.

Useful local URLs:

- Frontend: `http://localhost:5173/pixelfoxracing`
- Socket server health: `http://localhost:5000`
- Transaction server health: `http://localhost:9000`
