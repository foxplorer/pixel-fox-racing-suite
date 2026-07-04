# Socket Server

Socket.IO server that manages shared game state for the Pixel Fox Racing Suite: connected players, collectible item positions, and real-time position updates.

## Transport

- Socket.IO path: `/pixelfoxracing`
- Default port: `5000`
- Default CORS: `http://localhost:5173`

## Configuration

Copy `.env.example` to `.env` to override defaults:

```dotenv
PORT=5000
CORS_ORIGINS=http://localhost:5173
VALID_TRACK_NAMES=Australia,San Luis,Belgium,Aspen,United Kingdom,Germany,Volcanoes
TRANSACTION_SERVER_URL=http://localhost:9000
```

`VALID_TRACK_NAMES` controls which track names are accepted for multiplayer filtering. Add a new track's display name here when it is added to the suite.

## Player Identity

Each connected player carries:

- `identityKey` — BRC-100 wallet identity public key. Used as the primary player identifier for multiplayer matching, current-player display, and collectible delivery.
- `originOutpoint` — selected Pixel Fox origin outpoint. The stable fox identifier.
- `ordinalAddress` — optional ordinal receive address carried for compatibility with activity payloads.

`identityKey` is currently client-asserted. The server does not verify wallet control through a challenge/signature flow.

## Game State

The server holds one shared game room (`global_pixelfoxracing_world`) with:

- A map of connected players keyed by socket ID.
- Up to 10 active collectible items (blueberries, salad, rabbit). When one is collected, a replacement spawns.

On connect, the server immediately emits the current `gameState` snapshot to the new client. `gameState` is re-emitted to all clients on any player or item state change.

## Socket Events

### Client → Server

| Event | Required fields | Description |
|---|---|---|
| `joinGame` | `identityKey` | Join the shared world. Sets player name, color, track, and starting position. |
| `joinScheduledRaceRoom` | `raceId`, `trackName`, `entrantId`, `gridSlot`, `startsAt` | Join a race-specific live room after transaction-server staging. The server returns a snapshot and begins authoritative countdown ticks. |
| `leaveScheduledRaceRoom` | none | Leave the current scheduled race room and return to casual shared-world routing. |
| `updateGameStatus` | `gameStatus` | Update player status: `idle`, `showroom`, `loading`, `countdown`, `racing`, `crashed`, `finished`. |
| `updatePosition` | `position`, `rotation`, `speed` | Broadcast position to other players. Only forwarded when player is past showroom. |
| `updateCarColor` | `carColor` | Update and broadcast car color. |
| `updateTrackName` | `trackName` | Update and broadcast selected track. Must be in `VALID_TRACK_NAMES`. |
| `playerChat` | `message` | Send a chat message (truncated to 50 characters). |
| `reportPlayerCollision` | player IDs, positions, rotations, speeds | Report a predicted player-to-player vehicle collision. The server validates same-track players, racing status, plausible distance/speed, and pair cooldown before relaying. |
| `reportScheduledRaceFinish` | `raceId`, `entrantId`, `totalTimeMs`, `lapTimesMs` | Report an active scheduled race finish. The server validates that the socket is staged in that scheduled room before accepting. |
| `collectItem` | `itemId` | Claim a collectible item. Server removes it, updates player score, spawns a replacement. |
| `shareTransaction` | item transaction data | Broadcast a collectible transaction to all clients. |
| `shareGameTransaction` | lap transaction data | Broadcast a lap transaction to all clients. |
| `playerLapComplete` | `lapTime`, `score` | Report a completed lap. Server updates best lap time and broadcasts to all. |

### Server → Client

| Event | Description |
|---|---|
| `gameState` | Full snapshot of serialized players and item positions. |
| `gameJoined` | Confirmation of `joinGame` with starting position. |
| `scheduledRaceRoomJoined` | Confirmation snapshot for the race-specific room. |
| `scheduledRaceRoomSnapshot` | Current race room entrants sorted by grid slot. |
| `scheduledRaceCountdown` | Server-clock race room snapshot emitted every second while entrants are staged. |
| `scheduledRaceRoomError` | Scheduled race room validation failure. |
| `playerJoined` | Another player has connected with their details. |
| `playerLeft` | A player has disconnected. |
| `playerPositionUpdate` | Real-time position, rotation, and speed from another player. |
| `playerCarColorUpdate` | A player changed their car color. |
| `playerTrackNameUpdate` | A player changed their selected track. |
| `playerChat` | A chat message from another player. |
| `playerCollisionResolved` | A validated collision report accepted by the server. |
| `playerCollision` | Legacy collision relay alias for older clients. |
| `scheduledRaceFinishAccepted` | A scheduled finish report was accepted for an entrant in the active room. |
| `scheduledRaceFinishRejected` | A scheduled finish report failed room or entrant validation. |
| `itemCollected` | An item was collected, with updated score and item type. |
| `itemSpawned` | A new item has spawned at a position. |
| `newItemTransaction` | A collectible transaction was broadcast. |
| `newGameTransaction` | A lap result transaction was broadcast. |
| `playerLapComplete` | A player completed a lap, with lap time and best lap. |

Scheduled race rooms are scoped as `scheduled_race:{raceId}`. Once a player joins one,
their position updates and same-race collision relays are sent to that room instead of
the global casual room, so scheduled race traffic can be isolated from casual racers on
the same track.

Scheduled finish reports are persisted through the transaction server before
`scheduledRaceFinishAccepted` is broadcast. In local development, run the
transaction server on `TRANSACTION_SERVER_URL` alongside the socket server.

## Collectible Items

Items are blueberries (10 points), salad (20 points), or rabbit (50 points). The server maintains up to 10 items at a time and spawns replacements after collection. Item positions are randomized around the circuit area, avoiding the start line and other items.

## Checks

Run from the suite root:

```bash
npm run check:socket
npm run test:socket
```
