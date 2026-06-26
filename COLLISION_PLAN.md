# Player Collision Plan

Pixel Fox Racing needs multiplayer car-to-car collisions that feel like racing contact, not like hitting an invisible wall. The current shared car collision path treats every player contact as a circle overlap and applies one speed multiplier. That makes very different events feel the same: a high-speed bump draft, a side rub, a head-on crash, and a stuck overlap can all collapse into a hard speed loss.

The goal is to classify collision scenarios, resolve them with relative motion, and keep the socket server and frontend synchronized enough that both players see plausible outcomes.

## Current State

Relevant frontend files:

- `frontend/src/racing/vehicles/carCollisionFrame.ts`
- `frontend/src/racing/vehicles/carCircleCollision.ts`
- `frontend/src/racing/vehicles/carHandling.ts`
- `frontend/src/racing/multiplayer/worldPlayers.ts`
- `frontend/src/racing/multiplayer/playerCollision.ts`
- `frontend/src/racing/multiplayer/carTrackPlayerSocketListeners.ts`
- `frontend/src/racing/multiplayer/useBatchedPlayerPositionUpdates.ts`

Relevant socket-server file:

- `socket-server/src/index.ts`

Current behavior:

- Local car collision detection uses circular overlap against remote player positions.
- A player collision applies `vehicleCollisionSpeedMultiplier`, currently `0.4`, regardless of collision type.
- Remote player state includes position, rotation, and speed, but no explicit velocity vector, acceleration, contact normal, collision impulse, or collision sequence ID.
- `PlayerCollisionSocketPayload` exists on the frontend, but the socket server does not currently orchestrate authoritative car-to-car collision events.
- Repeated overlap frames can apply repeated speed loss, making one car stop abruptly.

## Design Goals

- A high-speed rear-end contact between two cars moving in the same direction should keep both cars moving fast after impact.
- The trailing car should lose some closing speed, while the lead car may gain a small push.
- Side rubs should separate cars and cost modest speed without killing forward momentum.
- Head-on or large-angle impacts should be harsher than same-direction contact.
- Low-speed overlap should gently separate cars without repeated full penalties.
- Collision response should be deterministic, testable, and mostly independent from render quality.
- Frontend prediction should feel responsive, while socket orchestration keeps other clients coherent.
- The server should not need full physics simulation on the first pass, but it should validate and relay enough collision context to prevent obvious desync and spam.

## Collision Inputs

Each collision response needs more than position overlap.

Minimum useful local inputs:

- Local player ID.
- Remote player ID.
- Local position.
- Remote position.
- Local yaw or forward vector.
- Remote yaw or forward vector.
- Local scalar speed.
- Remote scalar speed.
- Contact normal from remote car to local car.
- Relative speed along the contact normal.
- Relative heading angle.
- Current game status for both players.
- Track name, so only same-track players collide.
- Last collision timestamp or contact pair state.

Better future inputs:

- Local velocity vector.
- Remote velocity vector.
- Wheelbase or car rectangle footprint.
- Last server position timestamp for interpolation age.
- Per-player latency estimate.
- Player mass or class if future vehicles differ.

## Collision Scenario Types

### 1. High-Speed Rear-End Contact

Example: both cars are going fast in the same direction, and the trailing car catches the lead car.

Desired feel:

- No dead stop.
- Trailing car bleeds toward the lead car's speed.
- Lead car gets a small speed transfer or forward nudge.
- Both cars separate enough to avoid repeated overlap penalties.
- If the trailing car is only slightly faster, treat it as bump drafting with very small loss.

Detection:

- Relative heading angle is small.
- Local car is behind the remote car along the shared forward direction.
- Closing speed is positive.
- Contact normal roughly points from lead car toward trailing car.

Response:

- Clamp the trailing car speed no lower than a high percentage of the lead car speed.
- Transfer part of the closing speed to the lead car, capped.
- Apply small lateral correction if the contact is offset.
- Start a pair cooldown so the same overlap does not apply a full response every frame.

### 2. Low-Speed Rear Tap

Example: cars bunch up near the grid, a corner, or after a spin.

Desired feel:

- Gentle separation.
- Minimal speed loss.
- No ping-pong bouncing.

Detection:

- Same-direction heading.
- Low absolute speed or low closing speed.
- Small overlap.

Response:

- Positional separation is primary.
- Speed correction is small.
- If both cars are nearly stopped, keep speeds near zero and avoid launching either car.

### 3. Same-Direction Side Swipe

Example: two cars are side by side and one drifts into the other.

Desired feel:

- Both cars keep most forward speed.
- The car moving laterally into the other takes more correction.
- Cars deflect apart along the contact normal.

Detection:

- Relative heading angle is small.
- Contact normal is mostly sideways relative to car forward direction.
- Closing speed along the side axis is positive.

Response:

- Preserve most forward component.
- Add lateral separation.
- Apply modest speed loss based on side impact severity.
- Use cooldown to prevent overlap grind from slowing both cars to zero.

### 4. Angled Corner Contact

Example: one car dives inside another at a moderate angle.

Desired feel:

- More disruptive than a side rub.
- Less harsh than head-on.
- Faster or better-aligned car may keep more momentum.

Detection:

- Relative heading angle is moderate.
- Contact normal has both forward/back and side components.
- Closing speed is meaningful.

Response:

- Blend rear-end and side-swipe response.
- Reduce speed based on angle and relative speed.
- Bias penalty toward the car whose forward vector points more into the other car.

### 5. Head-On Collision

Example: two cars drive toward each other.

Desired feel:

- Harsh impact.
- Strong speed loss and deflection.
- Not necessarily symmetric; the faster or more aligned car can "win" the collision.

Detection:

- Relative heading angle is large, near opposite direction.
- Closing speed is high.
- Contact normal points near each car's forward direction.

Response:

- Choose an impact winner from speed, heading alignment, and contact normal.
- Winner keeps reduced momentum and deflects.
- Loser slows more aggressively or spins/deflects more.
- Apply a longer cooldown than rear-end contact.

### 6. T-Bone Collision

Example: one car drives into the side of another at a crossing angle.

Desired feel:

- Impacting car loses meaningful speed.
- Hit car gets lateral/forward shove.
- Stronger than a same-direction side swipe.

Detection:

- One car's forward vector points into the other car's side.
- Other car's forward vector is roughly perpendicular to impact direction.
- Closing speed is meaningful.

Response:

- Impacting car loses a larger share of speed.
- Hit car receives displacement and optional speed impulse in the impact direction.
- Prevent repeated frame penalties while the cars separate.

### 7. Door Rub / Sustained Contact

Example: two cars remain alongside each other through a turn.

Desired feel:

- Light friction and separation.
- No cumulative hard braking.
- Contact can influence line without stopping both cars.

Detection:

- Same pair remains in contact for multiple frames.
- Relative speed is low.
- Contact normal remains mostly lateral.

Response:

- Use persistent contact state.
- Apply reduced friction-like penalties after the first frame.
- Keep positional correction active.

### 8. Stacked Spawn Or Countdown Overlap

Example: players load into the same start location or reconnect during countdown.

Desired feel:

- No race-ruining impact before control begins.
- Cars should separate or ghost until grid placement is valid.

Detection:

- Game status is `loading`, `countdown`, `showroom`, or just joined.
- Same-track players are overlapping near the grid.

Response:

- Disable player collision or use ghost collision during staging.
- Prefer start-grid fixes over physics fixes.
- Re-enable full collision after race start with a short grace window.

### 9. Reconnect Or Teleport Contact

Example: a stale remote player update jumps into another player.

Desired feel:

- No sudden hard crash from network correction.
- Remote interpolation should settle before collision is trusted.

Detection:

- Remote player timestamp is old or jump distance is large.
- Position update implies unrealistic velocity.

Response:

- Ignore collision against stale or teleporting remote players for a short window.
- Smooth remote position before making it collidable.
- Server can mark respawn/reconnect events so clients temporarily ghost that player.

## Frontend Physics Direction

Add a shared collision solver in `frontend/src/racing/vehicles`, separate from obstacle and board collision.

Suggested files:

- `playerVehicleCollision.ts`
- `playerVehicleCollision.test.ts`

Suggested types:

- `PlayerVehicleCollisionKind`
- `PlayerVehicleCollisionInput`
- `PlayerVehicleCollisionResult`
- `PlayerVehicleContactState`
- `PlayerVehicleCollisionConfig`

Core solver responsibilities:

- Classify contact type.
- Compute contact normal and overlap depth.
- Compute relative heading and relative velocity.
- Apply a response to local speed.
- Return optional remote speed impulse metadata for socket sync.
- Return positional correction separate from speed correction.
- Track per-pair cooldown/contact state.

The existing `resolveCarPlayerCollision` can become a lower-level overlap detector. `resolveCarCollisionFrame` should call the richer player collision solver instead of multiplying speed by `vehicleCollisionSpeedMultiplier`.

## Socket Orchestration Direction

The socket server should coordinate collision events without immediately becoming a full authoritative physics server.

### Phase 1: Validated Relay

Client detects a collision and emits a proposed collision event.

Suggested event:

- `reportPlayerCollision`

Suggested payload:

- `collisionId`
- `sequence`
- `trackName`
- `playerId1`
- `playerId2`
- `position1`
- `position2`
- `rotation1`
- `rotation2`
- `speed1`
- `speed2`
- `resultSpeed1`
- `resultSpeed2`
- `collisionKind`
- `contactNormal`
- `overlapDepth`
- `occurredAt`

Server responsibilities:

- Verify both player IDs exist.
- Verify reporter is one of the involved players.
- Verify both players are on the same track.
- Verify both players are in a collidable game status.
- Rate-limit collision reports per player pair.
- Reject impossible reports with extreme distance, speed, or stale timestamps.
- Broadcast accepted collision events to involved players and same-track observers.
- Store a short collision-pair cooldown to reduce duplicate accepted events.

### Phase 2: Server Pair Arbiter

The server still does not simulate every frame, but it arbitrates pair contact.

Server responsibilities:

- Keep last known position, rotation, speed, and update timestamp for each player.
- Recompute approximate overlap and collision kind from server state.
- Choose one accepted result when both clients report the same contact.
- Attach a server collision sequence number.
- Broadcast `playerCollisionResolved`.

### Phase 3: Optional Authoritative Collision

If cheating or desync becomes a problem, move more response calculation server-side.

Server responsibilities:

- Run the same pure collision solver as the frontend in a shared package or duplicated tested module.
- Decide resulting speed corrections.
- Broadcast authoritative corrections.

This should wait until the pure solver is stable; full server authority is more complexity than the current game needs for a first fix.

## Network Events

Existing movement:

- Client emits `updatePosition`.
- Server broadcasts `playerPositionUpdate`.

New collision flow:

1. Client predicts and applies local collision response immediately.
2. Client emits `reportPlayerCollision`.
3. Server validates and broadcasts `playerCollisionResolved`.
4. Each client applies the event only if it is newer than the local pair sequence.
5. Current player ignores stale corrections unless the server event differs materially.
6. Remote players apply corrected position, rotation, speed, and optional impulse.

Important rule:

- Same-track filtering must happen before collision checks and before collision event broadcasts.

## Anti-Spam And Cooldowns

Collision events should be bounded.

Recommended first-pass limits:

- Per pair: accept at most one hard collision every 250-500 ms.
- Per pair sustained contact: allow lightweight contact updates at a lower effect strength.
- Per player: cap collision reports per second.
- During countdown/loading: reject or ghost player collisions.
- Ignore remote players with stale position timestamps.

Cooldown should be pair-based and symmetric:

- `pairKey = sorted(playerId1, playerId2).join(':')`

## Gameplay Tuning Starting Points

These are initial tuning targets, not final constants.

- Bump draft same-direction speed floor: trailing car should usually keep at least 80-95% of lead car speed.
- Rear-end closing speed loss: 20-50% of closing delta depending on severity.
- Lead car speed gain: 5-25% of closing delta, capped.
- Side rub forward speed retention: 85-98%.
- Angled collision speed retention: 50-85%.
- Head-on speed retention: 10-45%, with stronger deflection.
- Sustained overlap penalty after first contact: 0-20% of normal contact penalty.
- Collision grace after race start or reconnect: 0.5-2.0 seconds.

## Tests

Add focused frontend unit tests for the pure solver.

Required scenarios:

- High-speed rear-end where both cars continue fast.
- Low-speed rear tap does not launch cars.
- Same-direction side swipe preserves most forward speed.
- Angled corner contact is harsher than side swipe.
- Head-on impact is harsher than rear-end contact.
- T-bone collision penalizes the impacting car more than the hit car.
- Sustained overlap does not repeatedly multiply speed to zero.
- Countdown/grid overlap produces no hard collision.
- Stale remote update is ignored or ghosted.

Add socket-server tests or lightweight handler tests for:

- Reject collision report when either player is missing.
- Reject collision report across different tracks.
- Reject report from a socket not involved in the collision.
- Rate-limit repeated pair reports.
- Broadcast accepted same-track collision resolution.

## Implementation Phases

### Phase 1: Stop The Dead-Stop Rear-End

- Add a pure player collision solver for same-direction rear-end and side-swipe cases.
- Replace `vehicleCollisionSpeedMultiplier` for player collisions with relative-speed handling.
- Add pair cooldown/contact state on the frontend.
- Add tests for high-speed rear-end and repeated overlap.

### Phase 2: Expand Scenario Classification

- Add angled, head-on, T-bone, and sustained-contact classifications.
- Add separate config constants for each scenario.
- Keep obstacle, board, tree, and gate collisions on their existing paths.

### Phase 3: Socket Collision Events

- Add `reportPlayerCollision` to the client.
- Add validation and rate-limited relay in `socket-server/src/index.ts`.
- Add `playerCollisionResolved` frontend listener.
- Include sequence IDs and pair cooldown handling.

### Phase 4: Grid And Staging Safety

- Disable or soften collisions during loading/countdown.
- Integrate with the planned starting-grid system.
- Add reconnect/teleport ghost windows.

### Phase 5: Polish And Tuning

- Tune constants with real two-client testing.
- Add diagnostics for collision kind, relative speed, and applied response.
- Add a debug overlay or log flag for collision classification.
- Review mobile performance after adding per-pair contact state.

## Acceptance Criteria

- Rear-ending a fast car while both cars are moving quickly no longer stops one player dead.
- Same-direction contact feels like bumping, rubbing, or drafting, not a wall.
- Head-on and T-bone crashes still feel meaningfully disruptive.
- Repeated overlap does not stack full speed loss every frame.
- Players on different tracks do not collide or receive collision events.
- Countdown/start-grid overlap does not ruin the race before control begins.
- Collision behavior is covered by deterministic unit tests.
