# Multiplayer Scheduled Race Plan

Pixel Fox Racing currently supports casual multiplayer presence and individual
lap submissions. Scheduled races should add a second mode: group starts on the
hour in UTC, visible signups in the showroom, a shared start-gate countdown, a
three-lap race, and one final `multiplayer race` inscription containing the
complete race record.

Initial work belongs in the open source suite. Prod frontend, prod socket
server, and prod transaction server should be synced later with care because
prod has deployment-specific routes, state, and UI that should be preserved.

## Implementation Update, 2026-07-04

- Manual Volcanoes scheduled-race testing after the new start-gate design found
  a regression where staged entrants skipped the scheduled countdown and stacked
  at the centered start line.
- Root cause: the visual start gate was not starting the race. Scheduled entry
  still called the normal casual `startRaceForSelectedTrack` path after joining
  the scheduled room. That path could activate ordinary race loading/start
  state before the server-owned scheduled-room countdown snapshot controlled
  the client.
- A second staging issue was in the shared spawn helper: it recomputed yaw from
  the nearest track tangent and ignored the scheduled grid slot's explicit
  `initialRotationY`, so local cars could lose their assigned grid-facing pose.
- Added `applyScheduledRaceStartState` and switched scheduled entry handlers in
  Australia/imported car tracks, Belgium, and San Luis to use it instead of the
  casual race-start helper.
- `applyVehicleSpawnPositionOnce` now honors an explicit initial rotation for
  scheduled grid placement, with regression coverage.
- Follow-up San Luis manual testing still showed immediate countdown/default
  start placement. Root cause: San Luis retained older active-race casual socket
  join paths for `startRaceImmediately` and connection/reconnection recovery.
  During a scheduled race, those casual joins could arrive late and overwrite
  the scheduled grid spawn with the normal centered start-line spawn.
- Scheduled San Luis mode now blocks casual `joinGame` emission and ignores
  late casual `gameJoined` spawn writes while an active scheduled race is set.
  It also reasserts the assigned scheduled grid pose to the room while the
  client is in scheduled `loading`/`countdown`.
- Follow-up note: the same countdown/grid failure can affect other tracks, not
  only San Luis, because the socket server requires a normal `joinGame` player
  before accepting `joinScheduledRaceRoom`. Scheduled entry now defensively
  emits `joinGame` with the assigned grid pose before `updatePosition` and
  `joinScheduledRaceRoom` in Australia/imported car tracks, Belgium, and San
  Luis, so the scheduled room has a player record to snapshot at the correct
  grid slot.
- Cross-track scheduled entry now survives route/component handoff. If a player
  enters a scheduled race for a track that is not the currently mounted track,
  the page stores the pending `{ race, signup }`, switches to the target track,
  and the newly mounted target track consumes that pending scheduled entry.
  This prevents the target component from mounting clean and falling back to the
  normal local race countdown/default start-line spawn.
- The showroom now has separate `Multiplayer` and `ITT` modes. Multiplayer mode
  hides normal `START RACE` controls and shows scheduled-race cards/`Enter`;
  ITT mode shows track/color/quality controls, `START RACE`, and latest laps.
- Showroom browsing no longer emits a casual `joinGame` presence record. A fox
  is only added to socket-server current players when the user starts an ITT
  race or enters a scheduled race. This avoids defaulting a browsing fox into
  Australia, San Luis, or any other track before they actually race.
- Scheduled race HUD now exposes `Leave Race` during scheduled loading/countdown.
  If only one fox is staged, the HUD explains that two racers are required and
  offers `Time Trial Mode`; the race should not produce a multiplayer
  inscription unless a second staged racer joins before start.
- Verified after this patch:
  - `npm --workspace frontend run test:core -- joinGamePayload scheduledRaceRoomPlayers gridSlots raceLifecycle vehicleFrameCallbacks scheduledRaceSocket`
  - `npm run build:frontend`

## Implementation Update, 2026-07-02

- Direction update: final group-race settlement should use **one**
  `multiplayer race` inscription output containing the complete race record,
  not three separate trophy outputs plus a fourth summary output. Places,
  trophy/no-trophy UI, DNFs, lap arrays, roster identity, track, start time,
  finalization time, and race ID should all be inferred from that single
  inscription payload.
- The UI can still show gold/silver/bronze trophy graphics in the finish modal
  or top-center race banner while players keep driving after lap 3. Those are
  presentation artifacts derived from finish position, not separate trophy
  inscription outputs.
- The scheduled race API now uses final-inscription naming for the final group
  race record. The direct endpoint is
  `POST /scheduled-races/:raceId/final-inscription`; the normal server-driven
  path is `POST /scheduled-races/:raceId/settle`.
- Open-source dev mode should implement this first with a deterministic dummy tx
  flag/txid and output index `0`. The dummy final inscription response now
  exposes `dummy: true`, `inscriptionName: "multiplayer race"`, `outputIndex`,
  `txid`, and the complete `finalInscriptionPayload.inscriptionPayload`.
  Postgres persistence is implemented behind `SCHEDULED_RACE_STORE=postgres`;
  real-mode funding, UTXO selection, broadcasting, and retry remain a later prod
  migration.
- Socket server should eventually notify clients still in the race room when
  the final multiplayer race inscription is available, using the same kind of
  latest-transaction activity pattern as lap/item inscriptions. Players who
  leave can still discover the inscription once multiplayer race records are
  merged into PixelRacing stats.
- Scheduled race HUD now swaps the normal lap/txid list for a memoized
  multiplayer standings panel during scheduled races.
- The panel shows the 1-6 staged entrants with compact ordinal thumbnails,
  current order, completed-lap count, and latest split or finished total.
- The standings panel now keeps per-racer lap history visible as blank/filled
  Lap 1, Lap 2, and Lap 3 slots instead of replacing the previous completed
  lap with only the latest split.
- When the local scheduled racer finishes the required third lap, the HUD shows
  the locked finish place plus the results finalization time in local time and
  UTC. That finalization time is derived from `startsAt + 15 minutes`.
- After lap 3, the local car stays in `racing` so the player can keep driving
  for fun. Additional laps are ignored for scheduled-race result submission.
- The finish state now appears as a top-center race banner instead of a row
  message in the standings panel. 1st/2nd/3rd show gold/silver/bronze trophy
  art; 4th/5th/6th show a no-trophy result line.
- Finished racer ordering is now first-finish order in the client standings, so
  later finish packets do not push an already-finished racer down to a lower
  place.
- The local entrant is visually called out with a glowing thumbnail outline and
  subtle row highlight.
- Socket server accepts `reportScheduledRaceLapProgress` from the matching
  scheduled-race entrant and broadcasts `scheduledRaceLapProgress` only inside
  that race room, so split updates are shared before the final result.
- Scheduled race lifecycle timeout is now 15 minutes after start. After that,
  unfinished races move to `finalizing`, and missing finishers can be treated as
  DNF for settlement.
- The in-race `Switch Track` button is hidden during scheduled multiplayer
  races.
- If a staged entrant disconnects after the scheduled race has started, the
  socket room keeps them in snapshots as `disconnected` so the standings list
  and race history still show they were part of the race.
- Socket lap-progress packets are now also persisted through the transaction
  server. When the 15-minute race window finalizes, unfinished staged racers are
  recorded as DNF with any completed lap times preserved instead of losing
  partial progress.
- The physical podium scene idea is intentionally skipped for now.

## Implementation Update, 2026-07-01

Manual two-player staging uncovered three regressions that are now patched in
the open source suite.

- Upcoming race rack is back to the rotating Track Series view. It no longer
  filters the next three cards to the currently selected track, so Australia
  should not fill all three upcoming slots unless the rotation itself lands
  there.
- Scheduled room entrants now carry `headlightsEnabled` when they join, and the
  socket server compares both the global player and scheduled entrant headlight
  state before broadcasting room snapshots. This should make pre-start
  headlight toggles visible to the second/later joined player.
- Root cause note: staged cars are often static while waiting for the scheduled
  start, so normal movement updates are not a reliable carrier for pre-race
  appearance state. Scheduled-room snapshots now own static pre-start state like
  headlights; movement packets can still update pose/speed once racing starts.
- Rear red brake/tail lights are restored as glowing emissive lenses on the
  detailed car model.
- Added socket room regression coverage for preserving and updating scheduled
  entrant headlight state.
- Verified after this patch:
  - `npm run test:frontend-core`
  - `npm run test:socket`
  - `npm run test:transactions`
  - `npm run build:frontend`
  - `npm run check:socket`
  - `npm run check:transactions`
- Added a dummy end-to-end scheduled race store test path covering local
  signup, staging, two 3-lap finish submissions, finalization, dummy final
  inscription creation, idempotent completed-race retrieval, and final
  inscription payload shape.
- Added frontend API helper coverage for result submission, finalize, and final
  inscription endpoint calls.
- Verified after this coverage pass:
  - `npm --workspace frontend run test:core`
  - `npm --workspace transaction-server run test`
  - `npm run check:transactions`
  - `npm run check:socket`
  - `npm run build:frontend`

## Implementation Update, 2026-06-29

Foundation work has started in the open source suite only.

- Transaction server now has shared scheduled-race types, lifecycle constants,
  an in-memory local/dummy store, and HTTP routes for listing races, signing up,
  withdrawing, and staging.
- `transaction-server/schema.sql` now includes durable table definitions for
  scheduled races, signups, results, and final inscriptions. The live route implementation is
  still the local in-memory store; a Postgres adapter remains future work before
  prod.
- The frontend now has scheduled-race API helpers and a compact showroom race
  rack that can show the next few races, visible roster avatars, countdowns,
  slot counts, and small signup buttons.
- The car showroom paths for Australia/shared imported car tracks, Belgium, and
  San Luis pass wallet/fox identity into the race rack. Aspen snowmobile remains
  outside this implementation.
- A shared scheduled grid helper now derives five staggered grid slots and the
  correct initial `rotationY` from each track's start direction. This is the
  basis for making staged local and remote cars face the right way before anyone
  moves.
- Current race rack signup is available when the required wallet/fox fields are
  present.
- The race rack now stages an already-signed-up entrant through the transaction
  server and supports `Enter` during the staging/countdown/racing window.
- Local scheduled entry now computes the assigned grid slot, enters the car
  world, spawns at that slot, and passes the derived initial yaw into the car so
  the local staged car faces the right track direction immediately.
- Socket race rooms, server-owned countdown, remote staged-car snapshots,
  three-lap finish validation, and final race inscription creation are not
  implemented yet.
- Verified after this foundation pass:
  - `npm run test:frontend-core`
  - `npm run build:frontend`
  - `npm run check:socket`
  - `npm run check:transactions`
  - `npm run test:transactions`

## Implementation Update, 2026-06-30

Socket-room foundation work has started in the open source suite only.

- Socket server now has a scheduled race room registry with race-scoped room IDs,
  validated room join payloads, sorted entrant snapshots, and server-clock
  staging/countdown/racing status derivation.
- Socket server exposes `joinScheduledRaceRoom` and `leaveScheduledRaceRoom`.
  After joining, an entrant receives `scheduledRaceRoomJoined`, room members
  receive `scheduledRaceRoomSnapshot`, and the room receives
  `scheduledRaceCountdown` once per second.
- Scheduled race entrants now route position updates to `scheduled_race:{raceId}`
  instead of the global casual room. Same-race collision relays also target the
  scheduled race room when both players are in the same scheduled race.
- Frontend scheduled entry now emits the assigned grid-slot position/rotation to
  the socket server and joins the scheduled race room after transaction-server
  staging succeeds.
- Socket server README documents the scheduled room events, and a socket test
  script covers the pure room registry.
- Still not done after the socket-room foundation: client countdown/unlock,
  remote scheduled-room roster rendering, three-lap finish validation, and final
  race inscription creation remain future work.
- Verified after this pass:
  - `npm run test:socket`
  - `npm run check:socket`
  - `npm run test:frontend-core`
  - `npm run build:frontend`

### Client Countdown Update, 2026-06-30

- Frontend now has a shared scheduled-race socket helper that filters room
  snapshots by the active race ID and converts server room state into local race
  state.
- Scheduled race entrants now consume `scheduledRaceRoomJoined`,
  `scheduledRaceRoomSnapshot`, and `scheduledRaceCountdown` in Australia/shared
  imported car tracks, Belgium, and San Luis.
- While a scheduled race is active, the existing local three-second countdown
  timer is disabled. Server snapshots keep cars frozen in local `countdown`
  state during staging/countdown, show only the final `3, 2, 1`, and unlock local
  `racing` when the server room reaches `racing`.
- Scheduled group starts now play the existing race-start beep audio once when
  the active server countdown first enters the final visible `3, 2, 1` window.
- Entering casual race mode, returning to showroom, or restarting clears the
  active scheduled race and leaves the scheduled socket room so the normal local
  countdown flow works again.
- Still not done after this client countdown pass: remote scheduled-room roster
  rendering, three-lap finish validation, and final race inscription creation
  remain future work.
- Verified after this client countdown pass:
  - `npm run test:frontend-core`
  - `npm run check:socket`
  - `npm run build:frontend`

### Remote Room Roster Rendering Update, 2026-06-30

- Frontend scheduled room snapshots now carry typed entrant rosters.
- A shared `buildScheduledRaceRoomPlayers` helper converts the active room roster
  into rendered remote racers, filters out the local socket, sorts by grid slot,
  and uses each entrant's grid slot/yaw for staged fallback placement.
- If a live `playerPositionUpdate` has already produced an existing remote
  player, the helper preserves that live position/rotation/speed instead of
  snapping back to the static grid slot.
- Australia/shared imported car tracks, Belgium, and San Luis now use the
  scheduled-room roster while an active scheduled race is selected. Casual
  multiplayer rendering remains unchanged when no scheduled race is active.
- Added focused tests for active race filtering, grid-slot fallback placement,
  and live pose preservation.
- Verified after this room roster pass:
  - `npm run test:frontend-core`
  - `npm run check:socket`
  - `npm run build:frontend`

### Scheduled Finish Report Update, 2026-06-30

- Frontend now tracks scheduled-race lap progress separately from casual lap
  inscription flow while an active scheduled race is selected.
- Scheduled laps append to the local lap list and reset the current lap timer,
  but they do not call the casual `createpixelracing` inscription workflow.
- Scheduled lap progress is still fed only by the existing car-world
  `onLapComplete` callback. That callback comes from the normal track lap
  validation path (`attemptLapCompletion`), so scheduled races inherit each
  track's existing track-length, minimum-distance, start-gate, and
  reached-end/progress requirements instead of counting arbitrary client-side
  lap button events.
- Once the active race's `lapsRequired` count is reached, the client emits
  `reportScheduledRaceFinish` with race ID, entrant ID, total time in
  milliseconds, and lap times in milliseconds, then marks the local race
  `finished`.
- Socket server validates finish report shape, verifies that the reporting
  socket is in the matching scheduled race room, and verifies the entrant ID
  before emitting `scheduledRaceFinishAccepted` to that race room.
- Socket server emits `scheduledRaceFinishRejected` for invalid or mismatched
  finish reports.
- This pass is intentionally not durable yet; transaction-server result storage,
  finalization, idempotency, and trophy awards remain future work.
- Verified after this finish-report pass:
  - `npm run test:frontend-core`
  - `npm run test:socket`
  - `npm run check:socket`
  - `npm run build:frontend`

### Durable Result Storage Update, 2026-06-30

- Transaction server store now supports scheduled race results with one result
  per `(race_id, entrant_id)`.
- `POST /scheduled-races/:raceId/results` accepts `entrantId`, `totalTimeMs`,
  and `lapTimesMs`.
- Result submission validates staged entrant status, required lap count,
  positive finite lap times, and total-time consistency.
- Duplicate identical results are idempotent. Conflicting duplicate results are
  rejected.
- Accepted results mark the signup `finished`, assign finish positions by total
  time, and move the race to `finalizing`.
- Socket server now forwards validated `reportScheduledRaceFinish` reports to
  the transaction server before broadcasting `scheduledRaceFinishAccepted`.
  Storage failures emit `scheduledRaceFinishRejected`.
- Still future work: Postgres-backed adapter for scheduled race routes,
  finalization policy for DNF/no-contest, trophy award idempotency, and result
  podium UI.
- Verified after this durable result pass:
  - `npm run test:transactions`
  - `npm run check:transactions`
  - `npm run test:socket`
  - `npm run check:socket`

### Finalization And Podium Update, 2026-06-30

- Transaction server now exposes `POST /scheduled-races/:raceId/finalize`.
- Finalization marks unfinished staged entrants as `dnf` and writes DNF result
  rows with nullable `totalTimeMs`/empty lap arrays.
- Finalization leaves non-staged signups out of results; they are not counted as
  finishers or DNFs for the race that actually ran.
- If at least one entrant finished, the race remains in `finalizing`; if no
  staged entrant finished, the race moves to `no_contest`.
- Result sorting now ranks only `finished` rows by total time, assigns DNF rows
  no finish position, and exposes a `podium` array containing finished positions
  1-3.
- The showroom scheduled-race card now understands `results`/`podium` response
  fields and shows a compact podium or no-contest line under the roster.
- Frontend now has a scheduled-race stats adapter that flattens result
  `lapTimesMs` into PixelRacing-style lap rows, one row per racer per recorded
  lap, while preserving `groupRaceId`, lap number, finish position, total race
  time, and finished/DNF status for group-race context.
- Transaction server now supports `GET /scheduled-races?status=completed` for
  dummy/local completed race results, and the PixelRacing stats screen merges
  those flattened scheduled-race lap rows into the current-season stats when the
  local transaction server is available.
- Transaction server now supports dummy/local
  `POST /scheduled-races/:raceId/final-inscription` for creating/fetching the
  final `multiplayer race` inscription record: one deterministic dummy txid,
  one output index `0`, and no trophy-recipient outputs. No-contest final
  inscription records stay tx-less.
- Real funded inscription broadcasting remains out of scope until the
  open-source dummy contract is testable end to end.
- Verified after this finalization/podium pass:
  - `npm run test:frontend-core`
  - `npm run build:frontend`
  - `npm run test:transactions`
  - `npm run check:transactions`

### Dummy Final Inscription Update, 2026-06-30

- Transaction server now has an in-memory scheduled race final inscription model
  exposed through `POST /scheduled-races/:raceId/final-inscription`.
- Final inscription creation is idempotent per race. Repeating the request
  returns the existing final inscription record instead of creating a new dummy
  tx.
- Final inscription payloads include the full result rows and a complete
  `finalInscriptionPayload.inscriptionPayload` for the single `multiplayer race`
  inscription. The legacy `recipients` field is intentionally an empty
  compatibility array.
- No-contest races record a final inscription status of `no_contest` with no
  txid and no inscription tx.
- The showroom race card can show a compact settled/no-contest state once the
  scheduled race response includes a final inscription record.
- This is still open-source dummy behavior only. Real inscription broadcasting,
  Postgres persistence, retries, and funded UTXO handling remain prod migration
  work.

### Grid Staging And Rooms Reality Check, 2026-06-30

- Scheduled race socket rooms already exist as `scheduled_race:{raceId}`.
  Position updates and same-race collision relays are routed to that room for
  staged scheduled entrants, so casual time-trial players are not included in
  scheduled race traffic.
- Entering a scheduled race stages the player through the transaction server,
  joins the scheduled socket room, and places the local car on a derived grid
  slot with the correct starting yaw.
- Staged grid assignment is now separate from signup order. `gridSlot` remains
  the signup/roster slot, while `stagedGridSlot` is assigned only when a player
  actually enters the starting grid. No-shows therefore do not leave front-row
  gaps; entered players fill staged slots from the start gate back.
- Staged cars use simple two-wide rows behind the start line instead of a
  centered pole-sitter slot. The race limit is now six, so a full grid renders
  as rows of `2, 2, 2`.
- The in-memory store, socket room validation, and `transaction-server/schema.sql`
  now target six-player races.
- San Luis and Belgium use narrower staged grid spacing than wider tracks so
  their two-wide rows fit tighter start straights. San Luis is the narrowest
  current layout.
- Grid rows are placed behind the start/finish line on the track's authored
  approach side using the start-direction frame, while car yaw still faces along
  the start direction toward the start gate/lights. Verify this visually per
  track because imported/legacy track metadata may encode the start tangent
  differently.
- Manual Australia staging retest passed after correcting the grid-side
  convention: staged racers line up behind the start line and face the start
  gate/race direction.
- Every scheduled car track still needs a manual grid verification pass before
  upload/prod sync: Australia, Belgium, San Luis, United Kingdom, Germany, and
  Volcanoes. Confirm 2x2x2 placement, behind-line side, yaw toward gate/lights,
  and no snap back to the solo start line when countdown/racing snapshots arrive.
- The showroom race cards now use blue Sign Up buttons and green Enter buttons.
  The extra race-ready popup was removed because it duplicated the card action.
- Still not done: per-track authored start-grid paint, no-show/DNS finalization
  display, live standings, authoritative group race result flow, and trophy
  minting.
- Verified after this dummy award pass:
  - `npm run test:transactions`
  - `npm run check:transactions`
  - `npm run test:frontend-core`
  - `npm run build:frontend`

### Grid Spawn Correction Update, 2026-06-30

- The shared grid helper now offsets slot 1 behind the start/finish line, and
  Australia/Belgium countdown/racing resets honor `spawnPosition` instead of
  snapping scheduled entrants back to the solo time-trial start line.
- The generic rendered grid-paint experiment was removed. It looked wrong on
  United Kingdom and may be wrong on other imported tracks because start-line
  paint needs track-specific authored placement/orientation rather than a shared
  overlay derived only from start direction.
- Future visual grid paint should be done as per-track authoring data, then
  rendered only when the placement has been checked for that track.
- Verified after this grid-spawn correction pass:
  - `npm run test:frontend-core`
  - `npm run build:frontend`

### Scheduled Entry Guard Update, 2026-07-01

- The showroom scheduled-race rack now lists races for the currently selected
  track instead of mixing all tracks into every track showroom. This avoids
  entering a scheduled race through a different mounted track and losing the
  intended staged grid spawn during track handoff.
- Scheduled race entry is now closed once `startsAt` has arrived. The frontend
  only enables `Enter` for signed-up races in `staging`/`countdown` before the
  scheduled start, and the transaction server rejects late staging attempts.
- This should prevent stale cards from jumping entrants directly into `racing`
  and should keep entered cars on their assigned two-wide staged grid positions
  until the server-timed start.
- Verified after this guard pass:
  - `npm run test:transactions`
  - `npm run test:frontend-core`
  - `npm run check:transactions`
  - `npm run build:frontend`
  - `npm run test:socket`
  - `npm run check:socket`

### End Of Session Status, 2026-06-30

Open-source scheduled multiplayer is now usable enough to sign up for local
dummy races and click `Enter` from the showroom race cards. This is still not
ready for prod sync.

- The open-source showroom can list upcoming scheduled races, rotate tracks,
  sign up with the connected fox, show roster avatars, and enter a signed-up
  race.
- Local testing is configured for five-minute scheduled races via
  `SCHEDULED_RACE_INTERVAL_MINUTES=5`.
- Signup buttons are blue; Enter buttons are green. The duplicate race-ready
  popup was removed.
- `Switch Track` is available during loading/countdown/racing/crashed states.
  It returns to the track picker/showroom and leaves any scheduled race socket
  room. The socket itself stays connected for the showroom, but remote active
  tracks now filter out `idle`/`showroom` players so the car should disappear
  for observers instead of lingering at its last position.
- Scheduled race entrants use compact two-wide rows behind the start line
  (`2, 2, 2` with the current six-player cap). Individual time trials still
  start centered on the normal start line.
- The generic white grid-line overlay was removed. We do not need visible grid
  lines for the first working version, and generic placement was unreliable on
  United Kingdom/imported tracks.
- Current scheduled race rooms isolate group-race position updates and
  same-race collision relays from casual time-trial players.

Needs testing/development next:

- Verify on multiple tracks that scheduled entrants actually line up behind the
  start line in the two-wide rows, with correct yaw, and do not snap back to the
  solo start line when server countdown/racing state arrives.
- Verify server-timed race start end to end: staging → final countdown → racing
  at the scheduled `startsAt` time, not from the normal solo time-trial local
  countdown.
- Verify final `3, 2, 1` display and race-start beeps fire once, at the proper
  time, for scheduled races.
- Test with at least two browser sessions signed up for the same five-minute
  race to confirm room roster rendering, no-show compaction, and that observers
  no longer see players after `Switch Track`.
- Add/finish a local dummy end-to-end race harness: sign up entrants, stage,
  start, finish 3 laps, finalize, award dummy trophies, and confirm completed
  scheduled laps appear in PixelRacing stats.

Verified at session end:

- `npm run test:frontend-core`
- `npm run build:frontend`

### Next Scheduled Multiplayer Slice

The next useful slice is an open-source dummy end-to-end scheduled race test path.

- First, run/manual-test the actual group start: two signed-up entrants, staged
  behind the start line, server countdown at scheduled time, final beeps, and
  unlock into racing.
- Then add a small local test harness or documented manual flow that signs up
  two or more dummy entrants, stages them, submits finish results, finalizes,
  awards, and confirms completed race laps appear in PixelRacing stats.
- Add frontend API helper coverage for `finalize`/`award` if those actions become
  visible from local test UI.
- Keep real-mode inscription broadcasting and Postgres adapters as the later
  prod migration phase after dummy behavior is proven.

### Open Source First, Then Prod

The current multiplayer work remains open-source-suite-only until the dummy flow
is testable end to end.

- Finish and test the dummy/local contract first: signup, staging, group start,
  validated 3-lap finish, finalization, completed-race stats rows, and dummy
  trophy award responses.
- Keep the open-source transaction server's in-memory store as the proving
  ground for API shape, UI behavior, and tests.
- After dummy mode works, create a separate prod migration plan covering
  Postgres tables/adapters, lifecycle ticks, award idempotency records, funding
  and retry behavior, server environment variables, and data backfill/indexing.
- Prod frontend/socket/transaction sync should be a separate pass with explicit
  deployment checks; do not assume open-source local state maps directly to prod.

## Product Shape

- Scheduled races start at the top of each UTC hour.
- The showroom shows the next few races above the player's latest lap times.
- Each race card shows track, UTC start time, countdown, entrants, and open
  slots.
- Players can see who is signed up before joining.
- Players sign up first, then click `Enter Race` for a race they joined.
- Max entrants starts at 6.
- Races are 3 laps.
- Casual lap mode remains available exactly as it is today.
- First implementation should target the six car tracks: Australia, San Luis,
  Belgium, United Kingdom, Germany, and Volcanoes.
- Aspen snowmobile is not part of the first scheduled-race implementation unless
  a later task explicitly adds snowmobile support.

## UX In The Showroom

The scheduled race module should live inside the existing showroom overlay, near
`frontend/src/racing/components/RacingShowroomStatsStrip.tsx`.

Recommended layout:

- Top section: `Upcoming Races`
- Show 2-3 upcoming hourly races for the selected track, or all car tracks if
  we want cross-track browsing.
- Each race card includes:
  - track name
  - UTC start time
  - countdown such as `starts in 12:34`
  - entrant count, e.g. `3 / 5`
  - visible roster rows with fox image/name/color
  - state label: `Open`, `Full`, `Staging`, `Live`, `Final`
  - primary action:
    - `Sign Up` when open and not signed up
    - `Enter Race` when signed up
    - `Full` disabled when full
    - `Race Started` disabled after staging closes

The player's latest laps should remain below this module. The scheduled race
cards should be compact and scan-friendly so they do not hide the rotating
vehicle/fox showroom.

Because the showroom is already crowded, this panel should behave like a compact
schedule rack rather than a full dashboard. Show only the next few races by
default, keep signup buttons small, make rosters dense but readable, and avoid
large explanatory copy. If more races are available, use a small expand/view-all
control instead of growing the first viewport indefinitely.

## Race Lifecycle

Use explicit server state. Do not infer race state only from client countdowns.

1. `scheduled`
   Race exists and accepts signups.
2. `staging`
   Starts a few minutes before the hour. Signed-up players can enter and are
   placed at assigned grid slots.
3. `countdown`
   Server publishes the authoritative countdown target. Clients show the start
   gate countdown.
4. `racing`
   Race starts at the UTC hour. Clients unlock throttle and begin the 3-lap run.
5. `finalizing`
   Server computes result order from submitted race finish records.
6. `settled`
   Transaction server has created/broadcast the final `multiplayer race`
   inscription.
7. `cancelled`
   Fewer than the minimum 2 players. Set by the lifecycle tick at signup close
   (fewer than 2 signups) or at start (fewer than 2 staged). No results, no
   final inscription. See the start policy below.

Recommended first-pass start policy:

- **Minimum field is 2.** A race needs at least two players or it is cancelled -
  one fox alone is not a race and should not create a "won" race inscription.
- **One active race per fox.** A fox origin outpoint may have only one active
  signup across scheduled/countdown/racing/finalizing races. Signing that same
  fox up for a different active race should either move the signup before
  signup close or reject with a clear `fox_already_signed_up` error.
- **One active race per owner address per start window.** An ordinal owner
  address may sign up only one fox for a given scheduled start time. This prevents
  one wallet from filling several simultaneous track races or occupying multiple
  race-history slots. A later team/multi-fox mode can relax this behind an
  explicit event rule.
- Two cancel checkpoints:
  - **Courtesy cancel at signup close (`T - 60s`):** if fewer than 2 signups,
    move the race to `cancelled` immediately so the lone player is told early and
    can pick another race or casual mode (no pointless staging).
  - **Authoritative cancel at start (`T`, after a short grace):** if fewer than 2
    entrants actually staged, cancel even if 2+ had signed up (the second player
    signed up but never entered, or dropped).
- Close new signups at `T - 60s`.
- Allow signed-up players to enter from `T - 5m` through `T + 30s`.
- If a signed-up player does not enter, keep them in the roster but mark
  `not staged`; they do not receive a result.
- A cancelled race creates no final inscription and writes no result rows; it ends in
  `cancelled` (distinct from `no_contest`, which is a race that *ran* but had zero
  valid finishers — see G4).

### Settlement Policy

Do not create the final `multiplayer race` inscription before the scheduled race
is finalized. The inscription is the canonical settlement snapshot, so early
creation can publish disputed standings if a slower staged entrant later submits
a valid finish inside the allowed window.

The transaction-server lifecycle tick should finalize a running race at the
earliest of:

- all staged entrants have submitted valid 3-lap finishes; or
- `starts_at + raceTimeout` has passed.

Use a bounded first-pass `raceTimeout` so rewards are timely while still giving
slower players a fair finish window. A practical v1 default is 10 minutes after
the scheduled start for the current 3-lap races; make it configurable before
prod sync.

At finalization:

- rank only valid finished entrants by `totalTimeMs`, with ties broken by
  earliest accepted `finishedAt`;
- mark unfinished staged entrants as `dnf` and include DNF result rows with
  empty/partial lap arrays as supported by the result model;
- leave signed-up entrants who never staged out of race results, or mark them as
  `not_staged` in roster/status displays only;
- set `no_contest` when the race ran but no staged entrant produced a valid
  finish.

After finalization, create exactly one final `multiplayer race` inscription when
there is at least one valid finisher. The transaction has one race-record output
at index `0`; podium places and no-trophy results are inferred from the payload.
Zero valid finishers produces `no_contest` and no transaction.

This gives players one canonical settlement snapshot including finishers, DNFs,
recorded lap times, roster identity, track, race ID, start time, and
finalization time.

### Live Race HUD And Splits

Scheduled races should preserve the immediacy players expect from casual lap
inscriptions without minting a separate ordinal for every scheduled lap.

During the race, every player should see:

- their completed lap splits as soon as each lap is validated (`Lap 1`, `Lap 2`,
  `Lap 3`);
- their current total elapsed race time;
- current lap number out of `lapsRequired`;
- live place/running order throughout the race;
- final finish position, final total time, and all three lap splits at the end.

The live standings UI should be compact enough for active driving:

- show one row per staged entrant, sorted by current live running order;
- include a small fox thumbnail/avatar, fox name, and car color indicator;
- show position (`P1`, `P2`, etc.), current lap, latest split/total time, and
  finished/DNF status when available;
- visually highlight the local player's row so they can find themselves without
  scanning;
- animate/reorder rows when live place changes, but avoid large layout shifts
  that interfere with driving;
- keep this visible in the racing HUD and show the finalized order in the
  post-race/results state.

Prefer replacing the normal right-middle lap-times/txid panel during scheduled
races instead of adding another floating HUD. In casual mode that area continues
to show normal lap times and inscription txids. In scheduled mode it becomes a
`ScheduledRaceStandingsPanel` that shows live place, fox identity, lap progress,
splits, total time, and finish status.

Suggested component boundary:

- `ScheduledRaceStandingsPanel`
  - input: local entrant ID, race ID, roster/fox thumbnails, provisional
    standings, local lap splits, final result/award state;
  - output: compact right-side race table with highlighted local row;
  - no socket or transaction side effects inside the component.
- `scheduledRaceStandings` helper
  - input: scheduled room roster, live position/progress events, accepted lap
    split events, finish accepted events;
  - output: sorted provisional standings rows for the panel.

Ownership for live order should move toward the socket server because it already
sees scheduled-room position updates and countdown timing. The frontend may
compute an initial/local-only provisional order for the first dummy pass, but the
production path should broadcast shared standings from the scheduled race room
so all players see the same order.

For scheduled races, lap 1/lap 2/lap 3 splits are live race data first, not
immediate individual lap inscriptions. The final settlement/trophy payload is
the durable inscription record for the group race. If we later want standalone
per-lap scheduled inscriptions, add them as a separate opt-in product decision so
they do not delay podium settlement or multiply transaction load.

Maintain a hard route split between casual and scheduled lap completion:

- casual one-lap/time-trial mode may continue to call the normal
  `/createpixelracing` inscription route immediately on lap completion;
- scheduled race mode must never call `/createpixelracing` for lap 1, lap 2, or
  lap 3;
- scheduled lap completions update local HUD splits and live standings only;
- the only scheduled race persistence call after racing starts is the scheduled
  finish/result path after `lapsRequired` validated laps are complete
  (`reportScheduledRaceFinish` through the socket server and/or
  `/scheduled-races/:raceId/results` in the transaction server flow);
- add regression tests around the shared lap-completion handler so an active
  scheduled race cannot accidentally fall through into the casual inscription
  workflow.

Live running order should be server-owned, or at least server-observed, because
it affects a trophy-paying race:

- before anyone finishes, order by highest completed lap, then farthest progress
  around the current lap, then earliest server-observed timestamp for that
  progress;
- after a player finishes, rank finished entrants by valid total time ahead of
  non-finished entrants;
- show DNFs/no-shows only after finalization, not as live podium positions;
- broadcast standings updates through the scheduled race room so all players see
  the same order.

The final standings used for trophy awards must come from finalized transaction
server results, not a client-only HUD estimate. The HUD can show provisional
place during the race, but trophy output indexes are assigned only after
settlement finalization.

## Grid And Start Gate

Visible start-grid paint is optional. Generic placement was not reliable across
imported tracks, and the current staged-start design can work without painted
lines by placing entrants in two-wide rows behind the start line.

Implementation direction:

- Add shared grid-slot helpers under `frontend/src/racing/core` or
  `frontend/src/racing/tracks`.
- Derive grid slots from each track's start pose:
  - slot 1 on the racing line
  - slot 2 offset left/right and slightly behind
  - slot 3 opposite offset and further behind
  - slots 4-5 repeat the stagger
- Render white painted start boxes/lines only after each track has explicit
  checked placement/orientation metadata.
- When entering a scheduled race, spawn the player at their assigned slot
  instead of the casual start position.
- Spawned local and remote cars must immediately face the correct track
  direction for their grid slot. Do not wait for the first movement update to
  correct remote car orientation.
- During scheduled countdown, freeze throttle/brake input and keep cars staged.
- At countdown zero, switch to `racing` and unlock movement.

This should reuse the existing local countdown presentation where possible, but
the scheduled-race countdown target must come from the socket server.

## Data Ownership

Use the transaction server database for durable race data. Use the socket server
for live updates and synchronized countdown.

### Transaction Server Owns

- Scheduled race rows
- Signup rows
- Entrant identity and ordinal payout address
- Final race results
- Trophy transaction status
- Idempotency for award minting

### Socket Server Owns

- Live staged/connected status
- Race room membership
- Server clock snapshots
- Countdown broadcasts
- Position/collision updates within a race room
- Finish reports forwarded to durable validation

### Frontend Owns

- Showroom schedule display
- Signup/enter actions
- Local rendering of roster/countdown/grid slots
- Local lap detection and 3-lap progress UI
- Submitting finish evidence to the socket/transaction server

## Database Plan

Add tables to `transaction-server/schema.sql`.

Suggested tables:

```sql
CREATE TABLE scheduled_races (
  id TEXT PRIMARY KEY,
  track_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  max_entrants INTEGER NOT NULL DEFAULT 5,
  laps_required INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (track_name, starts_at)
);

CREATE TABLE scheduled_race_signups (
  race_id TEXT NOT NULL REFERENCES scheduled_races(id),
  entrant_id TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  fox_outpoint TEXT NOT NULL,
  fox_origin_outpoint TEXT NOT NULL,
  fox_name TEXT NOT NULL,
  car_color TEXT,
  grid_slot INTEGER,
  status TEXT NOT NULL,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staged_at TIMESTAMPTZ,
  PRIMARY KEY (race_id, entrant_id),
  UNIQUE (race_id, grid_slot)
);

CREATE TABLE scheduled_race_results (
  race_id TEXT NOT NULL REFERENCES scheduled_races(id),
  entrant_id TEXT NOT NULL,
  finish_position INTEGER,
  total_time_ms INTEGER,
  lap_times_ms JSONB NOT NULL,
  status TEXT NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status = 'dnf' OR total_time_ms > 0),
  PRIMARY KEY (race_id, entrant_id)
);

CREATE TABLE scheduled_race_final_inscriptions (
  race_id TEXT PRIMARY KEY REFERENCES scheduled_races(id),
  txid TEXT,
  status TEXT NOT NULL,
  final_inscription_payload JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`entrant_id` should be stable across reconnects. A normalized fox origin
outpoint is a good first candidate, with identity key and ordinal address stored
alongside it for validation. Owner address should not be included in the final
multiplayer race inscription payload.

## Transaction Server API

Add endpoints:

- `GET /scheduled-races?trackName=Australia&limit=3`
  Returns upcoming races with roster details and current signup state.
- `POST /scheduled-races/:raceId/signup`
  Adds or updates a signup. Enforces max 5 entrants and assigns grid slot.
- `DELETE /scheduled-races/:raceId/signup`
  Optional first-pass withdrawal before signup close.
- `POST /scheduled-races/:raceId/stage`
  Marks a signed-up entrant as entering the race.
- `POST /scheduled-races/:raceId/results`
  Records a 3-lap finish. Should be idempotent per entrant.
- `POST /scheduled-races/:raceId/finalize`
  Marks unfinished staged entrants as DNF and exposes final podium/no-contest
  state.
- `POST /scheduled-races/:raceId/final-inscription`
  Admin/server-only endpoint, or internal function, that creates/fetches the
  final `multiplayer race` inscription record after finalization.
- `POST /scheduled-races/:raceId/settle`
  Finalizes unfinished staged entrants and creates/fetches the final inscription
  record in one idempotent call.

In dummy mode, all endpoints should work with fake IDs and no funds. Real
transaction mode should only be needed for final inscription broadcasting.

## Socket Server Events

Keep casual global multiplayer intact. Scheduled races should use race-scoped
rooms so casual drivers and scheduled racers do not leak state into each other.

New client-to-server events:

- `joinScheduledRaceRoom`
  `{ raceId, entrantId }`
- `leaveScheduledRaceRoom`
  `{ raceId }`
- `scheduledRaceEntered`
  `{ raceId, entrantId, gridSlot }`
- `scheduledRaceLapComplete`
  `{ raceId, lapNumber, lapTimeMs, totalTimeMs }`
- `scheduledRaceFinished`
  `{ raceId, totalTimeMs, lapTimesMs }`

New server-to-client events:

- `scheduledRaceSnapshot`
  Race status, roster, staged players, server time, startsAt.
- `scheduledRaceRosterUpdated`
  Emitted after signup/stage/withdraw changes.
- `scheduledRaceCountdown`
  Server time, startsAt, remainingMs, status.
- `scheduledRaceStarted`
  Race id and authoritative startedAt.
- `scheduledRaceFinished`
  Entrant result update.
- `scheduledRaceFinalized`
  Final standings and award status.

Collision and position events should include optional `raceId`. If present,
emit inside that race room. If absent, keep the current casual global behavior.

## Frontend Architecture

Add shared scheduled-race modules so all car tracks can use one flow:

- `frontend/src/racing/scheduled/scheduledRaceTypes.ts`
- `frontend/src/racing/scheduled/scheduledRaceApi.ts`
- `frontend/src/racing/scheduled/scheduledRaceSocket.ts`
- `frontend/src/racing/scheduled/scheduledRaceClock.ts`
- `frontend/src/racing/scheduled/gridSlots.ts`
- `frontend/src/racing/components/ScheduledRacePanel.tsx`
- `frontend/src/racing/components/ScheduledRaceRoster.tsx`
- `frontend/src/racing/components/ScheduledRaceCountdown.tsx`
- `frontend/src/racing/components/ScheduledRaceGridMarkers.tsx`

Game component changes:

- Add local `raceMode: 'casual' | 'scheduled'`.
- Store selected `scheduledRaceId`, assigned `gridSlot`, and scheduled start
  metadata.
- `Sign Up` talks to the transaction server.
- `Enter Race` sets scheduled mode, joins the socket race room, and spawns at
  the assigned grid slot.
- Scheduled mode uses 3-lap completion before finish submission.
- Casual mode keeps current one-lap inscription behavior unchanged.

Showroom changes:

- `RacingShowroomStatsStrip` should become a small showroom dashboard, or wrap a
  new `ScheduledRacePanel` above the existing latest-laps list.
- Race cards must show actual entrant names/images/colors so players can choose
  which race to join.
- Poll schedule data every 15-30 seconds and also update immediately from socket
  roster events.

## Awards And Inscriptions

The current durable award model is one transaction with one ordinal output. Zero
valid finishers is `no_contest` with no tx. Output `0` is a
`multiplayer race` inscription containing the full race record:

- race id
- track name
- UTC start time
- UTC finalization time
- laps required
- final standings
- every recorded lap time for every racer, keyed by entrant and lap number
- entrant fox names/origin outpoints
- server timestamp

Gold/silver/bronze trophy art can still appear in the UI for positions 1-3, but
those are derived display states, not separate on-chain outputs.

Important transaction-server requirements:

- Award minting must be idempotent per `race_id`.
- If broadcasting succeeds but the HTTP response fails, the server must not
  create a duplicate final race inscription on retry.
- Store `txid`, output index `0`, payload, and status in `scheduled_race_final_inscriptions`.
- In dummy mode, return a fake txid and deterministic output index `0`.

## Validation Rules

First-pass validation should be practical and hard to abuse casually:

- Only signed-up entrants can stage or finish.
- Race finish accepted only after scheduled start time.
- Finish must include exactly 3 lap times.
- Each lap must pass existing min/max lap-time bounds.
- Total time must equal lap-time sum within a small tolerance.
- Duplicate finish submissions for the same race/entrant are ignored unless the
  existing result is failed/incomplete.
- Podium is sorted by valid `total_time_ms`; ties break by earliest
  `finished_at`.

Later validation can add start-gate proof, checkpoint sectors, or socket
observed position history.

## Plan Review — Gaps To Close (grounded in current code)

This section was added after reading the current implementation
(`socket-server/src/index.ts`, `transaction-server/src/index.ts`,
`transaction-server/schema.sql`, `frontend/src/racing/transactions/lapSubmission.ts`).
Several parts of the plan assume infrastructure that does not exist yet. Resolve
these before/while building the phases; severities noted.

### G1 — No lifecycle driver exists. Who advances race state? (CRITICAL)

The lifecycle lists seven states but nothing owns the transitions. Today the
**socket server is in-memory with no timer/cron**, and the **transaction server
is pure request/response** — neither generates hourly races or advances status.
Without an owner, every race is stuck in `scheduled` forever.

Resolution: the **transaction server runs a periodic tick** (e.g. every 5–10s)
that (a) generates upcoming hourly rows idempotently
(`INSERT ... ON CONFLICT (track_name, starts_at) DO NOTHING`), (b) advances
`status` off wall-clock vs `starts_at`, and (c) enqueues awards at `finalizing`.
DB `status` is the source of truth; the tick moves it. This is **Phase 0** below.

### G2 — Socket server and transaction server have no link (CRITICAL)

The plan gives the socket server "countdown broadcasts" and "server clock
snapshots," but `starts_at` and the roster live in the transaction-server DB, and
the two services currently never communicate. Decide the coupling:

- v1 (recommended): the socket server periodically `GET`s an active-window
  `/scheduled-races` from the transaction server, caches raceId/startsAt/roster,
  and broadcasts countdown from its own monotonic clock anchored to `starts_at`.
  Finish + award stay client→transaction-server HTTP. Add a shared internal
  token for the socket→ts read if the endpoint isn't already public.
- Avoid in OSS: socket server reading Postgres directly (tighter coupling).

### G3 — Finish timing is fully client-authoritative; trophies add real payout incentive (CRITICAL)

Confirmed in code: `lapSubmission.ts` posts lap times straight to
`/createpixelracing`; the socket server only relays `playerLapComplete` for live
UI; the **only** server validation is `lapTime ≥ 40s`. Casual mode tolerates this
because results inscribe to a **central results address** (a leaderboard), not to
the player — faking a lap just pollutes a board. **Trophies deliver real ordinals
to the winner's address**, so client-claimed `total_time_ms` becomes directly
exploitable.

Resolution for v1: the socket server is the only server that sees live positions,
so make it the timing authority — it stamps each entrant's authoritative **start**
(at the UTC gate) and **lap-completion** times from its own clock, and it (not the
raw client) reports the finish to the transaction server, or co-signs the client
report. Reject finishes for laps the socket never observed. Until checkpoint/sector
validation lands, **state explicitly whether v1 trophies are cosmetic or carry
transferable value** — keep them low/symbolic if the anti-cheat is this thin.

### G4 — Variable podium size (1–3 finishers) (HIGH)

The award model assumes exactly three outputs. The minimum field is 2 (races with
fewer are `cancelled`, not awarded), but a race that *runs* can still finish with
1 or 2 valid finishers when entrants DNF or drop. So the award tx must emit 1–3
outputs, and 0 valid finishers is a distinct `no_contest` outcome (race ran, no
trophies — separate from `cancelled`, which never started). Make the award builder
+ idempotency handle 1–3 outputs and the `no_contest` case.

### G4b — Group-race lap stats must stay queryable as lap stats (HIGH)

Scheduled races are multi-lap group records, but PixelRacing stats are currently
organized around individual lap rows. Do not bury scheduled lap times only inside
trophy metadata. The stats contract must include every recorded lap time for
every racer in a shape the PixelRacing stats screen can flatten/group by track,
while also preserving race context (`raceId`, lap number, entrant, finish
position, total time, finished/DNF status). This lets group-race lap times appear
in the existing stats experience without losing the fact that they came from the
same scheduled race.

### G5 — Award durability, retry, and UTXO-pool exhaustion (HIGH)

Minting pulls a payment UTXO from the pool (`getAndReservePaymentUtxo`). The lap
flow returns `no_utxos_available` and releases on failure — acceptable for a
user-initiated lap, but an **award must never be silently dropped**. Need a
retry worker (on the same tick) that re-attempts `pending`/`failed` awards, and
pool-exhaustion handling that keeps the award `pending` instead of marking the
race done. Up to 6 tracks/hour is steady minting load — size/throttle the pool.

### G6 — Idempotent award under partial failure: write-ahead pattern (HIGH)

Make the "broadcast succeeded but HTTP failed → no double-mint" guarantee
concrete: (1) `INSERT scheduled_race_final_inscriptions(race_id, status='broadcasting', payload)`
keyed on the `race_id` PK — if the row exists, stop; (2) build + broadcast;
(3) on success `UPDATE ... status='broadcasted', txid=...`; (4) on failure leave
`broadcasting` / set `failed` for the retry worker. Never re-mint when a `txid` is
already stored.

### G7 — Grid-slot and max-entrants concurrency (MEDIUM)

`UNIQUE (race_id, grid_slot)` + max 5 needs transactional assignment, or two
concurrent signups can exceed five or collide on a slot. Assign the lowest free
slot inside a transaction (count check + slot pick under row locks, or
insert-and-retry on unique violation). Define slot reuse on withdrawal (free it;
later signups fill the lowest gap).

### G8 — Stable entrant identity inside the socket server (MEDIUM)

Today `player.id = socket.id`, which changes on every reconnect. Scheduled rooms
key on a stable `entrantId` (fox origin outpoint). The socket server must track
`entrantId` per connection (sent on `joinScheduledRaceRoom`), map
`entrantId → current socketId` so a reconnect rejoins the same seat and position
routing survives, and evict a stale socket when the same `entrantId` reconnects.

### G9 — One entry per wallet vs per fox (MEDIUM)

`entrant_id` = fox origin outpoint lets one wallet enter several foxes in the same
race unless signup concurrency is constrained. Resolved for v1: one fox can have
only one active scheduled-race signup at a time, and one owner address can have
only one active signup per scheduled start window across all tracks. Use
database constraints/queries equivalent to `UNIQUE (race_id, fox_origin_outpoint)`
for a single race, plus an active-race lookup by `fox_origin_outpoint`, and an
active same-start lookup by `owner_address`.

### G10 — Awards require an ordinal address, so signup must too (MEDIUM)

`scheduled_race_signups.owner_address` is `NOT NULL` and trophies deliver there.
So signup must require a wallet/fox/ordinal address — guests can view but not sign
up (this answers the "guest signup" open question by dependency). If an address is
missing/no-show at award time, skip or hold that tier.

### G11 — Reconcile the lifecycle windows + add settlement finalization (MEDIUM)

Pin the exact transitions the tick applies: → `staging` at T−5m, signups close at
T−60s (**cancel if fewer than 2 signups**), → `countdown` at ~T−15s, → `racing` at
T (**cancel if fewer than 2 staged**, after a short grace), → `finalizing` at
the settlement boundary (**immediately when all staged entrants finish, otherwise
T + raceTimeout** so a race with non-finishers still resolves), → `awarded` after
mint. Note that staging intentionally opens before signups close.

### G12 — Socket-server restart loses live race state (LOW)

In-memory only: a restart drops countdown/room state. It must rebuild active races
from the transaction server (G2) and re-derive countdown from `starts_at`; durable
signups/results survive. Acceptable for v1 if documented.

### G13 — Casual and scheduled worlds must not bleed together (LOW)

There is one global room, one shared item field, and a single global
`pixelRacingState.trackName`. While racing, route position/collision to the race
room only (the plan's optional `raceId`), suppress the global broadcast, and hide
racers from casual `gameState`. Confirm pickup items are **off** inside scheduled
races (it is a timed race, not an item hunt).

### G14 — Use the repo's real test/CI scripts in each phase (LOW)

Per the READMEs, the actual gates are `npm run build:frontend`,
`npm run test:frontend-core`, `npm run check:socket`, and
`npm run check:transactions` — reference these, not generic "tests."

### G15 — Showroom density can crowd the first viewport (MEDIUM)

The showroom already has vehicle/fox presentation, controls, online state, and
latest lap results. The scheduled-race UI must show useful information without
becoming a second page inside the showroom. Keep the default rack to the next
few races, show only compact roster rows, and preserve the latest-laps strip
below it. Put deeper browsing behind a small expand/view-all control.

### G16 — Initial remote-car facing must be deterministic (MEDIUM)

Current multiplayer can briefly show another player's car facing the wrong
direction until that player drives and sends a corrected rotation. Scheduled
grid staging makes this much more visible because cars sit still before the
start. Grid-slot data must include the derived start rotation/yaw, and
`joinGame` / race-room snapshots / initial `gameState` should carry that
rotation so every client renders staged cars facing the correct track direction
immediately.

## Rollout Phases

### Phase 0: Lifecycle Driver And Service Coordination

- Add the transaction-server periodic tick: idempotent hourly race generation,
  wall-clock status advancement, and an award/retry queue (G1, G5, G6, G11).
- Decide and stub the socket↔transaction-server read path for active races (G2).
- Land this skeleton (even with an empty schedule) before UI, so later phases have
  a real state machine to attach to.

### Phase 1: Static Schedule And Showroom UI

- Add transaction-server schedule tables and dummy API.
- Generate upcoming hourly races for selected car tracks.
- Add showroom scheduled race cards above latest laps.
- Show full visible rosters and open slots.
- Add signup and withdrawal.
- Tests: schedule generation, signup max 5, duplicate signup, roster response.

### Phase 2: Enter Race And Grid Staging

- Add grid slot helper using two-wide rows behind the start line. Defer white
  staggered start paint unless per-track placement metadata becomes necessary.
- Add `Enter Race` action for signed-up players.
- Spawn scheduled entrants into their assigned grid slots.
- Include grid-slot yaw/rotation in staged-player snapshots so local and remote
  cars face the correct track direction before anyone moves.
- Add scheduled race room join in socket server.
- Keep casual mode unchanged.
- Tests: grid slot math, enter-race state, socket room membership.

### Phase 3: Server-Owned Countdown

- Add race status transitions and server time snapshots.
- Broadcast countdown from socket server.
- Freeze controls during scheduled countdown.
- Start all staged entrants at the same UTC target.
- Tests: countdown status transitions, late entry behavior, reconnect snapshot.

### Phase 4: Three-Lap Race Results

- Add scheduled race HUD lap counter.
- Stop scheduled race after 3 laps instead of submitting every lap as a casual
  lap inscription.
- Submit final result to durable API.
- Broadcast live/final standings.
- Tests: 3-lap completion, invalid lap rejection, result ordering.

### Phase 5: Final Race Inscription

- Add settlement finalization: finalize immediately when all staged entrants
  finish, otherwise at `starts_at + raceTimeout`; mark non-finishers DNF before
  awarding.
- Add `multiplayer race` JSON inscription generation.
- Mint one transaction with one final race-record output when at least one
  entrant finishes.
- Store award status and txid.
- Show final race inscription links in results.
- Tests: dummy output index `0`, idempotent award retry, full race payload.

### Phase 6: Prod Sync

- Port only the reviewed open source changes.
- Preserve prod frontend-only features and prod socket/transaction server
  differences.
- Re-run focused frontend, socket, and transaction-server checks before upload.

## Open Questions

- Should races be per selected track every hour, or should each hour rotate one
  featured track? (Affects schedule generation volume and award/UTXO load — see G5.)
- ~~Should signup require a wallet/fox, or allow guest viewing but block signup?~~
  Resolved by G10: signup requires an ordinal address; guests view only.
- ~~Should players be allowed to sign up for multiple races in the same hour on
  different tracks?~~ Resolved: no for v1. One fox gets one active scheduled race,
  and one owner address gets one active signup per scheduled start window across
  all tracks.
- Should awards go to ordinal addresses only, or support Metanet protocol-key
  delivery too? (Prod uses protocol-key delivery; OSS v1 can stay address-only.)
- Should no-show entrants remain visible after race start as `DNS`? (Ties to the
  `not staged` roster status and the finalize timeout in G11.)
- Resolved: v1 trophy graphics are cosmetic UI only. The durable artifact is the
  single final race inscription.

## Recommended First Decision

Use one standalone `multiplayer race` inscription carrying the full race info.
Skip separate trophy inscriptions for v1. It keeps settlement simple, gives the
stats page one canonical record to index, and lets every current/future viewer
infer places, DNFs, and trophy/no-trophy presentation from the same payload.
