# Contributing

Pixel Fox Racing Suite is MIT licensed so builders can fork it, remix it, and ship their own versions.

If you make improvements that could help the shared project, pull requests are welcome. The goal is a healthy ecosystem of forks, experiments, and reusable racing code.

Pixel Fox Racing Suite is intended to be easy to improve with human or AI-assisted development.

By contributing to this project, you agree that your contributions are licensed under the MIT License.

Before opening a PR:

- Keep changes scoped to one concern.
- Run the relevant command:
  - `npm run test:frontend-core`
  - `npm run build:frontend`
  - `npm run check:socket`
  - `npm run check:transactions`
  - `npm run test:transactions`
- Include screenshots or short screen recordings for frontend changes.
- Do not commit `.env` files, signing WIFs, database URLs, or generated folders.
- Prefer local dummy transaction mode for development unless the change specifically needs real inscriptions.

## Mobile pre-merge gate

Changes to mobile controls, rendering, performance, fullscreen, cameras, or the
race HUD must be tested on at least one real touch-first phone before they are
merged into the default branch. Desktop testing and browser device emulation
are useful for initial layout checks, but they do not satisfy this requirement.

Test the exact commit or deployed branch that will be merged. In landscape
orientation, complete the countdown and at least one lap on each of these
routes:

- Australia
- Belgium
- San Luis
- Aspen

During the phone test, verify:

- Steering remains responsive while gas is held with another finger.
- Gas, brake/reverse, and release behavior do not leave controls stuck.
- Fullscreen entry, exit, and orientation changes preserve the race layout.
- Camera controls, minimap, chat, sound, and the compact race HUD do not overlap
  the driving controls.
- Movement and camera motion remain stable during low-FPS moments, without
  severe frame-rate spikes or obvious slow-motion movement.
- A lap completes normally and collectible pickup still works in the suite's
  default dummy transaction mode.

Record the phone model, operating system, browser, tested commit, and result in
the pull request. Do not merge a mobile-specific change until this real-device
check passes. If a change affects another track, test that track as well.

Useful local URLs:

- Frontend: `http://localhost:5173/pixelfoxracing`
- Socket server health: `http://localhost:5000`
- Transaction server health: `http://localhost:9000`
