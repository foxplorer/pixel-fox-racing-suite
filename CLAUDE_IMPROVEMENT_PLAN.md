# Claude Improvement Plan — Multiplayer Races + 6-Track Graphics

Claude-owned plan and progress tracker, kept **separate** from
`MULTIPLAYER_SCHEDULED_RACE_PLAN.md` (codex's doc). Check items off here as
they land. Companion file: `CLAUDE_EDGE_CASES.md` (E1-E26 findings + fix
status table, reviewed 2026-07-04).

**Status snapshot (2026-07-04):** scheduled multiplayer works in local dev
(`npm run dev`, dummy inscriptions, 5-min races via
`SCHEDULED_RACE_INTERVAL_MINUTES=5`). No full end-to-end race has been run even
in dev yet. All work targets the open source suite (3 local servers); every
store change is implemented in **both** the memory store and the Postgres store
so prod migration is `SCHEDULED_RACE_STORE=postgres` + pushing
`transaction-server/schema.sql` (verified: current schema already covers the
new code — no schema change was needed for this session's fixes).

## Work log

### Session 2026-07-06 (Claude) — mobile mode phase 1 (branch `mobile-mode`)

Context: began implementing `MOBILE_MODE_PLAN.md` (steps 1–6 of its
implementation sequence) on the experimental `mobile-mode` branch — same repo,
not a separate one, so racing logic/preset fixes never need double-porting.

- **`useRacingDeviceProfile`** (new `racing/platform/`): feature detection
  (pointer: coarse, hover: none, maxTouchPoints, viewport) with live
  media-query/resize/orientationchange subscriptions. `prefersMobileRacingUi`
  = touch + coarse primary pointer, so tablets/foldables get mobile UI while
  desktop touchscreens (fine primary pointer) keep desktop UI. Pure
  `computeRacingDeviceProfile` is unit-tested (6 device shapes).
- **`mobile` quality preset**: added to the `RacingQualityPresetId` union with
  the plan's budget (dpr cap 1, no shadows, 4 remotes @120m, minimap every 6
  frames, scenery 0.35/0.45). Antialias became an explicit per-preset flag
  (was `id !== 'low'` string-matching). Resolver accepts `'mobile'` from
  localStorage; selector shows 4 options; `useRacingQualitySetting`
  auto-selects mobile on first run (no stored key) for coarse-pointer devices
  without persisting, so an explicit choice remains the only stored value.
  **The union extension type-forced mobile rows into every preset-keyed budget
  table** — start-gate marquee, procedural surface textures (5 surfaces, low
  res + ~half detail passes to cut the main-thread texture-gen stall at track
  load), remote-player LOD (2 near @60m), scenery effects (1 rolling-hill
  layer, 0.25 light scale), and tree billboard atlas (64px cells) — which is
  exactly the "reduce on mobile" list from the plan, enforced by tsc.
- **Viewport**: `getCarRacingGameViewportStyle(status, { useMobileViewportUnits })`
  returns `dvh` heights, drops the 900px clamp, adds `overscroll-behavior:
  none` (mobile Safari `vh` includes retracted browser chrome). Wired in the
  three car-track `FoxRacingGame` shells via the device profile.
- **Fullscreen**: `useFullscreenToggle` now tries standard →
  `webkitRequestFullscreen` (iPadOS) → CSS fake-fullscreen fallback (iPhone
  Safari has no element fullscreen API). Fallback is returned as a
  `fallbackFullscreenStyle` object the container merges declaratively, so
  React re-renders can't clobber imperative style mutations. Hook return stays
  backward-compatible (aspen/snowmobile untouched).
- **Touch controls (spike wiring)**: `MobileDrivingControls` — 4 buttons
  (◀ ▶ / BRAKE GAS) dispatching synthetic window KeyboardEvents so the
  existing keyboard hook (incl. gas-audio start/stop and status gating) works
  unchanged; per the plan this is spike-only and switches to extracted
  press/release handlers before production. Pointer-capture per pointerId,
  multi-touch (unit-tested press tracker: one keydown per control across
  multiple fingers), releases all keys on visibilitychange/blur/unmount,
  safe-area-inset positioning, `touch-action: none`.
- **Rotate overlay**: `MobileOrientationOverlay` shown over the game when
  mobile + portrait during countdown/racing.
- **RacingUI**: on mobile during live driving — touch controls shown; keyboard
  controls helper, quality panel, and camera-mode selector hidden (follow cam
  stays default, so drei OrbitControls never competes with the buttons).
- **Audio**: `unlockAudioElementsForTouch` in `audioElements.ts` (muted
  play→pause per element, WeakSet-tracked, retriable) — exported but not yet
  wired to a first-tap site; that lands with the escape-hatch menu.
- Gates: `test:core` 598/598 (24 new tests), `tsc --noEmit` diffed against
  main: no new errors (51 pre-existing on both).
- **Still open from the plan** (next sessions): escape-hatch race menu (plan
  step 7), collapsing desktop panels/HUD shrink (step 8), responsive showroom
  (step 9), visibilitychange/webglcontextlost lifecycle (step 10), real-device
  performance spike + audio-unlock wiring (step 11), Yours-wallet
  "desktop only" gating in the connect flow.

### Session 2026-07-04, part 6 (Claude) — Multiplayer Races stats section

Context: user ran the first real two-browser dummy race — it worked end to end
(early settle on 1/2 finishers + DNF, banner flipped to "Results final — race
inscribed ✓"), but there was no dedicated stats view for multiplayer races.

- **New "Multiplayer" tab in `PixelRacingStats`** (current era only, between
  the track tabs and Championship): lists completed multiplayer race finals —
  winner fox + race time, X/Y finishers, track, inscription name, tx +
  inscription links, dummy-mode note. Empty state invites signing up.
- **Live population:** a `groupRaceFinal` activity arriving over the socket
  (`newGameTransaction` on settlement) now lands in `multiplayerRaceActivity`
  immediately — finish a race and the tab shows it without a refresh.
- **Bug fixed while wiring:** `groupRaceFinal` live activities were previously
  falling into the `!itemType` branch and being inserted into lap
  history/leaderboards, where the winner's ~3-minute total race time ranked as
  a (terrible) single lap. They now go only to the activity feed + multiplayer
  section.
- **Data-source seam (user direction):** the section renders
  `PixelRacingGameResult` rows only. Today they come from the tx server's
  completed-races list (`fetchCompletedScheduledRaces` →
  `buildScheduledRaceFinalStatsRow`); in prod the same rows will come from the
  prod database or a gorillapool metadata search on inscription
  name = "multiplayer race" (`MULTIPLAYER_RACE_INSCRIPTION_NAME`). Swapping
  the source requires no UI change. That fetch/fallback is a follow-up.
- Gates: `test:frontend-core` (584), `build:frontend` clean.

### Session 2026-07-04, part 5 (Claude) — settlement push, E10/E6, prod-sync doc

Why this batch: these were the last correctness/consistency gaps before the
prod sync can be "copy files + run schema" (user goal), plus the settlement
listener the E1 fix left open.

- **Settlement listener shipped (A1 last item + P3 client half).**
  `registerScheduledRaceSocketListeners` gained `onSettlement` (validated by new
  `parseScheduledRaceSettlement`, filtered to the active race); the finish
  banner now takes a `settlement` prop — countdown stops and the line flips to
  "Results final — race inscribed ✓" / "no contest" / "cancelled". Wired in all
  three car-track components. A `cancelled` settlement also raises the existing
  "Race cancelled" modal and freezes the countdown (guard ref in
  `onCountdownState`, otherwise the 1 Hz tick would clear it).
- **E5 remainder shipped (P3 server half).** New `GET /scheduled-races/:raceId`
  (+ `store.getRace` in both stores); the socket tick now polls each active
  room's authoritative status every 5s and pushes terminal states
  (`settled`/`no_contest`/`cancelled`) into the room as `scheduledRaceSettlement`
  — a lone player in a cancelled race finally hears about it. Poll map is
  pruned with room lifecycle (no E19-style leak).
- **E10 shipped.** `finalizeRace` (both stores) short-circuits to `cancelled`
  when the race never had ≥2 ever-staged entrants (`staged`/`finished`/`dnf`),
  so untouched/lone races no longer mint tx-less `no_contest` records or
  pollute `?status=completed`. 2 new store tests.
- **E6 shipped.** `?now=` time travel is now behind
  `allowTimeTravelNow` — on in dummy mode, off in real mode unless
  `SCHEDULED_RACE_ALLOW_TIME_TRAVEL=true`.
- **Prod-sync playbook written:** `PROD_SYNC_SCHEDULED_RACES.md` (verified prod
  dir layout: flat, no scheduledRace files, no db.ts — pure additive copy; exact
  file list, index.ts wiring block, schema note, env table, pre-launch blockers
  E2/E3/E7/E8/E9).
- Found (not fixed, pre-existing): `sdkCollectibleTransaction.test.ts` first
  test is flaky ~1 in 5 (`getContent()` empty, random-key dependent). Unrelated
  to racing.
- Gates: `test:transactions` (53, +2), `test:socket` (12), `test:frontend-core`
  (584, +2), `check:transactions`, `check:socket`, `build:frontend` all green.

### Session 2026-07-04 (Claude)
- Wrote `CLAUDE_EDGE_CASES.md` (26 findings) from a full review of the
  scheduled-race code across all three servers.
- **A1 early settlement shipped:** `submitResult` (memory + Postgres) settles
  the race the moment every staged participant (2-6 racers — it keys off the
  full staged roster, not a fixed count) has a valid finished result and the
  race is `racing`. Socket server announces settlement right away from the
  finish response (`scheduledRaceSettlement` + `newGameTransaction`).
- **Result guards shipped (E3/E5 partial):** results rejected before
  `startsAt` (`race_not_started`), rejected once the race is
  `cancelled`/`settled`/`no_contest`/`finalizing`
  (`race_not_accepting_results`), and every lap (result + progress) must be
  ≥ 40s (`SCHEDULED_RACE_MIN_LAP_TIME_MS` in `scheduledRaceLifecycle.ts`).
  Idempotent duplicate finishes still return cleanly.
- **E4 unstage shipped:** `store.unstage` + `POST /scheduled-races/:raceId/unstage`
  (idempotent; `unstage_closed` after start); socket server unstages the
  entrant on `leaveScheduledRaceRoom` while the room is pre-`racing`, so
  Leave Race / Switch Track / back-to-showroom before the start frees the seat
  and the min-2 cancel check sees the true staged count.
- **E11 shipped:** settlement announcements fire once for
  settled/no_contest/cancelled; no-contest no longer re-settles every second.
- HUD finish banner now says "Finalizes in M:SS — sooner if everyone finishes".
- Gates run clean: `test:transactions` (51), `check:transactions`,
  `test:socket` (12), `check:socket`, `test:frontend-core` (573),
  `build:frontend`.
- Not committed to git yet — working tree holds this session's changes.

### Session 2026-07-04, part 3 (Claude) — reliability parity P1 + P2 shipped

- **P1 finish delivery hardening (E13) — DONE.** New shared helper
  `frontend/src/racing/scheduled/scheduledRaceFinishDelivery.ts`: the lap-3
  finish now waits for the server's `scheduledRaceFinishAccepted` ack (matched
  to this race + entrant); on rejection or a 5s timeout it automatically
  resubmits through the transaction server's `/results` endpoint (idempotent,
  so socket+HTTP overlap is safe); if even that fails the player sees the
  existing lap-submission error banner instead of silence. Wired into all
  three car-track game components (Australia/imported, Belgium, San Luis).
  6 new tests cover accept, foreign-ack filtering, reject→HTTP, timeout→HTTP,
  no-socket→HTTP, and double-failure error surfacing.
- **P2 reconnect recovery — DONE (rejoin half).** New shared helper
  `frontend/src/racing/scheduled/scheduledRaceReconnect.ts`: when socket.io
  reconnects during an active scheduled race, the client automatically re-runs
  the entry socket sequence (`joinGame` → `updateGameStatus` →
  grid-pose `updatePosition` → `joinScheduledRaceRoom`), so a brief network
  blip no longer makes the car invisible and the finish rejectable. No-op on
  first connect and when no scheduled race is active; stale race state is
  ignored. Wired into all three components (San Luis keeps its existing
  casual-race auto-join, which deliberately skips scheduled mode — this fills
  that hole). 3 new tests.
  - Remaining P2 half (follow-up): lap-progress **rehydration** after a full
    page refresh — needs the tx server to expose `lapProgress` in race
    responses; refresh mid-race currently still loses local splits.
- **P3 deliberately deferred** (room cancel propagation + settlement banner
  listener) — user chose to prioritize graphics headroom next. Why it's safe
  to defer: since the result guards landed, a cancelled race **cannot** produce
  results or an inscription anymore, so P3 is now a UX/consistency gap (lone
  player still sees a countdown/start; banner keeps counting to T+15m after an
  early settle), not a results-integrity gap. Do it before prod sync.
- Gates: `test:frontend-core` (582, +9 new), `build:frontend` clean.

### Session 2026-07-04, part 4 (Claude) — graphics headroom round 2

- `CurvedBoard` tessellation tier now defaults from the stored quality preset,
  auto-covering **Belgium's 16 full-track barrier ribbons** (biggest board
  load in the game: ~35% vertex/build savings on Low, ~15% Medium) and UK —
  no call-site changes; explicit props still win.
- Stadium fox hop waves scale by `particleDensityScale` (Low ~13.5% per wave
  vs 30%): fewer per-frame instanced-matrix uploads while the crowd still
  reads as alive.
- Documented the track/folder architecture (3 game components for 6 car
  tracks; Australia + Aspen carry forked board components that still need the
  tier — merge tracked in the graphics file).
- Gates: `test:frontend-core` (582), `build:frontend` clean.

### Session 2026-07-04, part 2 (Claude) — graphics/LOD
- Built the full **LOD inventory** (every system the Low/Med/High presets
  touch, verified in code) in the new
  `CLAUDE_GRAPHICS_IMPROVEMENTS_VISUAL_AND_EFFICIENCY_PER_LOD.md` — Track C
  details now live there; this file keeps only the checklist.
- Findings: `scenery.detailDistanceScale` was a **dead knob** (defined, never
  consumed); stadium fox hop + seating and bespoke `SimpleTrees` have no
  quality scaling; bespoke-track boards not tessellation-scaled.
- Shipped: `CurvedBoard` `segmentScale` prop (default 1 = zero change for
  existing callers; conservative floors for sharp-corner/hilly safety), wired
  via `detailDistanceScale` on imported tracks; imported-track 3D trees cast
  shadows on High only.
- Verified: `test:frontend-core` (573), `build:frontend`. Manual browser QA of
  boards at sharp corners/hills on Low still pending.

---

## Reliability parity verdict (analyzed 2026-07-04, second pass)

**Question:** will multiplayer scheduled races work as reliably as traditional
time trials? **Answer: on a clean run, yes — under real-world conditions, not
yet.** Three gaps make multiplayer more fragile than ITT, all in the
client/socket layer (the transaction-server state machine is now in good
shape: deterministic tick, early settlement, idempotent inscriptions, DNF
preservation, row-locked Postgres store).

Why ITT is inherently robust: one client → one HTTP call per lap → inscription,
with a visible `lapSubmissionError` on failure and every lap independent.
Multiplayer adds a shared clock, a socket room, and a server state machine —
and today the one call that matters most has less protection than an ITT lap:

> **Status update, later 2026-07-04:** P1 and P2 (rejoin half) are now
> **implemented** — see the part-3 work log entry. P3 remains open. With P1/P2
> in, a finished race can no longer be silently lost to a dropped packet or a
> brief reconnect; the remaining gap vs ITT is the cancelled-race/settlement
> push (P3) and refresh rehydration.

- **P1 — Finish delivery is one fire-and-forget socket emit**
  (`FoxRacingGame.tsx` `handleLapComplete` → `emit('reportScheduledRaceFinish')`).
  Verified: **no frontend listener exists for `scheduledRaceFinishRejected`
  or `scheduledRaceFinishAccepted`** in any game component, no ack tracking,
  no HTTP fallback (the `/results` API helper exists but is never used as a
  fallback). A rejected or dropped finish is silent: the local HUD shows
  "finished", the server records nothing, the fox DNFs at settlement.
  Fix: treat finish like an ITT lap — await `scheduledRaceFinishAccepted`,
  retry via HTTP `/results` on rejection/timeout, surface an error banner.
- **P2 — No mid-race reconnect recovery.** Verified: game components have
  **no `socket.on('connect')` re-join handler** (socket.io auto-reconnects,
  but the new socket.id has no `joinGame` player record and no room
  membership, so position/progress/finish emits are silently dropped).
  A 2-second wifi blip mid-race = invisible car + lost finish = DNF, while an
  ITT racer would lose nothing. Also no rehydration of lap progress from the
  server (page refresh loses laps 1-2 locally even though
  `recordLapProgress` persisted them). Fix: on reconnect while a scheduled
  race is active, re-emit `joinGame` + `updatePosition` + `joinScheduledRaceRoom`
  and rehydrate lap progress from the race response.
- **P3 — Socket room never learns tx-server status** (E5 remainder): a
  cancelled race still counts down and starts for the lone staged player, and
  the finish banner never hears `scheduledRaceSettlement`, so early
  settlements still show the T+15m countdown. Fix: room status poll or
  settlement/cancel push into the room + a client listener.

With P1-P3 done, multiplayer reliability should genuinely match ITT: every
other failure mode (server restart mid-race on the Postgres store, duplicate
finishes, no-shows, short fields, timeout DNFs) is already handled
server-side. Remaining lower-rank items (E14 casual collision bleed, E16
staged-but-never-connected, E10/E6/E2 prod hardening) are listed in Track A.

## Track A — Multiplayer race lifecycle correctness

Priority order. E-numbers reference `edgecases.md`.

### A1. Settlement timing (the user-stated contract)
- [x] **Early settle when all staged foxes finish 3 laps (E1).** Done
      2026-07-04 in `submitResult` (both stores); settles when the full staged
      roster (any size 2-6) has finished results and the race is `racing`.
- [x] Broadcast early settlement to the socket room. Done 2026-07-04 — the
      finish handler announces when the tx response shows settled/no_contest.
- [x] Update the finish banner/HUD copy. Done 2026-07-04 — "sooner if everyone
      finishes".
- [x] Frontend `scheduledRaceSettlement` listener: stop the T+15m countdown in
      the banner when the race settles early and show "Results final" (activity
      feed already shows the tx via `newGameTransaction`). Done 2026-07-04
      part 5.
- [ ] Keep 15-min timeout DNF behavior as-is (already works) but single-source
      the timeout constant (E25 — still duplicated in
      `scheduledRaceLifecycle.ts` and `scheduledRaceRooms.ts`).

### A2. Cancellation correctness (≤1 fox shows up)
- [x] Unstage when a staged entrant deliberately leaves the room before
      `racing` (E4). Done 2026-07-04 (unstage store method + route + socket
      leave handler).
- [ ] Decide + handle the disconnect-before-start case: a crashed/refreshed
      client stays staged today (keeps their seat); should a
      staged-but-disconnected fox at T-0 count toward min-2?
- [x] Propagate `cancelled` to the socket room + client UI; room must not count
      down/unlock a cancelled race (E5 remainder). Done 2026-07-04 part 5 —
      socket tick polls `GET /scheduled-races/:raceId` every 5s per active room
      and pushes terminal statuses as `scheduledRaceSettlement`; client freezes
      countdown + shows the cancel modal.
- [x] Reject `submitResult` for `cancelled`/`settled`/`no_contest`/`finalizing`
      races and before `startsAt` (E5, E3). Done 2026-07-04.
- [x] Untouched empty races should end `cancelled`, not `no_contest` (E10).
      Done 2026-07-04 part 5 — `finalizeRace` cancels when the race never had
      2 ever-staged entrants, both stores.
- [ ] Show cancelled state in the showroom instead of silently dropping the
      card (E12).

### A3. Trust boundaries (needed before trusted prod; accepted beta risk for online testing)
- [ ] Guard `finalize`/`settle`/`final-inscription`/`unstage` routes (internal
      token or time guard) (E2). 2026-07-05 decision: low-traffic online testing
      may happen before this lands, but multiplayer records are not
      tamper-resistant until fixed; see `PROD_SYNC_SCHEDULED_RACES.md` §5a.
- [x] Server-side lap-time floor for scheduled results and lap progress (≥40s
      like the casual path). Done 2026-07-04.
- [ ] Reject finishes arriving before `startsAt + 3×minLap` and before
      `startsAt + totalTimeMs` wall-clock (E3 remainder).
- [ ] Bind socket room `entrantId` to the socket's `identityKey` (E8).
- [ ] Socket server owns `startsAt` per room (fetch from tx server; ignore
      client value after room creation) (E7).
- [x] Remove/dev-gate the `now` query param on `GET /scheduled-races` (E6).
      Done 2026-07-04 part 5 — allowed only in dummy mode or with
      `SCHEDULED_RACE_ALLOW_TIME_TRAVEL=true`.
- [ ] Enforce one active race per fox / per owner per start window (E9).

### A4. Robustness
- [ ] HTTP fallback for finish submission when the socket path fails; tolerant
      duplicate handling (E13).
- [ ] Frontend auto-rejoin of the scheduled room on socket reconnect (E17).
- [x] Announce no-contest settlements once instead of re-settling every second
      (E11). Done 2026-07-04.
- [ ] Keep casual and scheduled worlds separate: exclude scheduled racers from
      casual collision acceptance, confirm collectibles are off in scheduled
      races (E14).

## Track B — Testing to-dos (nothing raced end-to-end yet)

- [ ] **First full dummy race, 2 browsers:** sign up 2 foxes, stage, server
      countdown at T, 3 laps each, finish accepted, race **settles as soon as
      the second fox finishes** (early-settle path, new 2026-07-04), inscription
      record + stats rows appear. Use `SCHEDULED_RACE_INTERVAL_MINUTES=5`.
      Note: laps must be ≥40s now — don't shortcut-test with instant laps.
- [ ] Same race but one fox stops after lap 1 → verify DNF at T+15m with
      partial lap times preserved (timeout path still applies when someone
      doesn't finish).
- [ ] One fox signs up, nobody else → courtesy cancel at T-60s visible in UI.
- [ ] Two stage, one clicks Leave Race/Switch Track during countdown → verify
      the unstage lands in the tx server (roster shows `signed_up`, staged slot
      freed) and the race cancels at start if only one fox remains staged
      (fix shipped 2026-07-04; needs manual browser verification).
- [ ] Disconnect/reconnect mid-race → standings keep the fox, reconnect rejoins
      room, finish still accepted.
- [ ] Per-track grid verification pass (2x2x2 behind line, correct yaw, no
      snap-back): Australia, Belgium, San Luis, United Kingdom, Germany,
      Volcanoes. (Australia + Volcanoes + San Luis partially done per codex
      plan; UK/Germany not yet.)
- [ ] Casual ITT on the same track during a scheduled race: no collisions/items
      bleed (E14).
- [ ] Regression gates after each fix: `npm run test:frontend-core`,
      `npm run test:socket`, `npm run test:transactions`,
      `npm run check:socket`, `npm run check:transactions`,
      `npm run build:frontend`.

## Track C — 6-car-track graphics & efficiency (Low/Med/High)

> **Moved:** the LOD inventory, change log, ranked wins, and touchy-area notes
> now live in `CLAUDE_GRAPHICS_IMPROVEMENTS_VISUAL_AND_EFFICIENCY_PER_LOD.md`.
> The checklists below remain the to-do tracker.

Grounding: quality presets live in
`frontend/src/racing/performance/qualitySettings.ts` (pixel ratio cap, shadows,
remote-player culling, minimap frame skip, scenery density/detail scales) and
`performance/sceneryQuality.ts` (rolling-hill layers, mesh/light/particle
scales). Scenery: `tracks/imported/ImportedBasicScenery.tsx` +
`ImportedCarTrackScenery.tsx` (UK/Germany/Volcanoes/custom), bespoke scenery for
Australia/Belgium/San Luis, shared components `RollingHills.tsx`,
`DistantMountains.tsx`, `DistantVolcanoes.tsx`, `SampledTerrainMesh.tsx`,
`BillboardStadiumFoxes.tsx`, `components/forest/*`, `components/birds/*`,
materials in `components/materials/*`. Cars:
`CarTrackVehicleModel.tsx` vs `CarTrackVehicleModelDetailed.tsx`.

### C1. Measure first
- [ ] Capture baseline FPS + draw calls + triangle counts per track per quality
      preset (use `RacingFpsCounter` + `renderer.info`; record in this file).
- [ ] Identify the worst two tracks/presets before touching visuals.

### C2. Efficiency (likely wins, verify against C1 numbers)
- [ ] Instancing audit: trees, advertising boards, seating, stadium foxes —
      ensure `InstancedMesh`/merged geometry rather than per-object meshes.
- [ ] Distance-based LOD for remote cars: swap Detailed ↔ simple car model by
      distance and quality preset (`remotePlayers.renderDistance` already
      exists; reuse its bands).
- [ ] Quality-scaled road/terrain tessellation: `trackSegments`,
      `curveArcLengthDivisions`, terrain sampling currently fixed per track —
      derive from preset (low can take ~half the segments).
- [ ] Cache procedural surface textures per quality
      (`materials/proceduralSurfaceTextures.ts`) so preset switches don't
      rebuild everything.
- [ ] Frustum-cull/chunk static scenery on large imported tracks (UK, Germany).
- [ ] Verify shadow config: high = real shadows; medium/low = blob/baked
      shadows under cars instead of shadow maps.

### C2b. More LOD/efficiency win candidates (from the 2026-07-04 code survey)
- [ ] **Scenery LOD tiers, not just density.** `scenery.densityScale` thins
      object counts, but each remaining tree/board keeps full geometry. Add
      2-3 detail tiers per scenery type (full mesh near, simplified mid,
      billboard/impostor far) driven by `detailDistanceScale`, shared through
      `ImportedBasicScenery` so all imported tracks inherit it.
- [ ] **Static geometry merging per chunk:** trees/boards/seating that never
      move can merge into a handful of draw calls per track sector
      (`BufferGeometryUtils.mergeGeometries`), keeping collision data separate
      (positions already flow through `onTreesGenerated`/`onBoardsGenerated`).
- [ ] **Remote-car update decimation by distance:** distant remote cars can
      interpolate at lower frequency (skip frames like the minimap's
      `updateEveryFrames` pattern) instead of per-frame pose updates.
- [ ] **Minimap render-to-texture reuse:** verify the minimap redraws only
      every N frames on low/medium (`minimap.updateEveryFrames` exists — audit
      that all 6 tracks + Aspen actually respect it).
- [ ] **Particle/effect budget per preset:** `particleDensityScale` exists in
      `sceneryQuality.ts`; audit lava explosion (`CarLavaExplosion`), headlight
      beams, and bird flocks to confirm they all scale by it and pause when
      off-screen.
- [ ] **Texture size caps per preset:** procedural surface textures could
      generate at half resolution on low (fill-rate + memory win on laptops).
- [ ] **Geometry share between showroom and race:** the showroom car/fox and
      the in-race detailed car should share geometry/materials so entering a
      race doesn't re-upload; check `CarTrackShowroomShell` vs
      `CarTrackVehicleModelDetailed`.
- [ ] **Terrain mesh resolution by preset:** `SampledTerrainMesh` samples the
      elevation grid at fixed resolution; halve grid resolution on low and
      blend with fog.
- [ ] **Rolling-hill layer count** already scales (2/3/4 by preset) — apply the
      same pattern to `DistantMountains`/`DistantVolcanoes` ring counts.

### C3. Looks (after efficiency headroom exists)
- [ ] Per-track scenery upgrade pass for imported tracks still on
      `ImportedBasicScenery` (UK, Germany, Volcanoes): authored tree bands,
      board spans on straights, environment-matched palettes.
- [ ] Road surface material polish: subtle normal/rough variation, tire-line
      darkening on the racing line at med/high.
- [ ] Distance fog + horizon tuning per environment so low-detail distant
      geometry reads as atmosphere instead of pop-in.
- [ ] Start-gate/grid area dressing for scheduled races (per-track authored
      grid paint — deferred by codex plan, still desirable).

### C4. Aspen snowmobile sharing
- [ ] Inventory which shared components Aspen already uses (RollingHills,
      DistantMountains, forest, materials, quality presets).
- [ ] Make C2 improvements land in the shared components so Aspen benefits for
      free; anything track-specific stays in the 6 car tracks.
- [ ] Light Aspen smoke test after shared-component changes (it is not part of
      scheduled races, so only rendering needs checking).

---

## Next prompt (start here next session)

State after the 2026-07-04 part-5 session: settlement push (listener + room
status poll, E5), E10, E6, and the prod-sync playbook
(`PROD_SYNC_SCHEDULED_RACES.md`) are **implemented and green** on all gates.
The remaining reliability items are prod-launch blockers (E2 auth, E3
remainder, E7/E8/E9) and manual browser QA — nothing else blocks dev racing.

Suggested next prompt:

> Read CLAUDE_IMPROVEMENT_PLAN.md, CLAUDE_EDGE_CASES.md, and
> PROD_SYNC_SCHEDULED_RACES.md. Then: (1) run the first full two-browser dummy
> race (Track B item 1, `SCHEDULED_RACE_INTERVAL_MINUTES=5`) and verify early
> settlement flips the banner to "Results final"; also verify a lone-fox race
> shows the cancel modal within ~5s of the courtesy cancel; (2) implement E2
> (internal token guard on finalize/settle/final-inscription/unstage) since it
> is the top prod blocker; (3) continue Track C graphics (C1 baseline
> measurements, then SimpleTrees quality threading + effects.* audit).

Also worth a look sometime: `sdkCollectibleTransaction.test.ts` first test is
flaky ~1 in 5 runs (pre-existing, collectibles SDK, unrelated to racing).
