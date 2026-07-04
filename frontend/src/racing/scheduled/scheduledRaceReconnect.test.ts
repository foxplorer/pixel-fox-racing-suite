import assert from 'node:assert/strict'
import test from 'node:test'
import {
  registerScheduledRaceReconnectListener,
  type ScheduledRaceReconnectState,
} from './scheduledRaceReconnect'

const makeState = (): ScheduledRaceReconnectState => ({
  roomJoin: {
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 2,
    startsAt: '2026-07-04T13:00:00.000Z',
  },
  spawnPosition: { x: 4, y: 0.1, z: -12 },
  rotationY: 1.25,
})

class FakeSocket {
  private connectListener: (() => void) | null = null
  emitted: Array<{ event: string; payload?: unknown }> = []

  on(_event: 'connect', listener: () => void): void {
    this.connectListener = listener
  }

  emit(event: string, payload?: unknown): void {
    this.emitted.push({ event, payload })
  }

  fireConnect(): void {
    this.connectListener?.()
  }
}

test('reconnect listener is a no-op without an active scheduled race', () => {
  const socket = new FakeSocket()
  registerScheduledRaceReconnectListener({
    socket,
    getActiveRaceId: () => null,
    getReconnectState: makeState,
    buildJoinGamePayload: () => ({ identityKey: 'id-1' }),
  })

  socket.fireConnect()
  assert.equal(socket.emitted.length, 0)
})

test('reconnect listener re-joins game, status, grid pose, and room for the active race', () => {
  const socket = new FakeSocket()
  registerScheduledRaceReconnectListener({
    socket,
    getActiveRaceId: () => 'race-1',
    getReconnectState: makeState,
    buildJoinGamePayload: state => ({ identityKey: 'id-1', trackName: state.roomJoin.trackName }),
    getGameStatus: () => 'racing',
  })

  socket.fireConnect()

  assert.deepEqual(socket.emitted.map(entry => entry.event), [
    'joinGame',
    'updateGameStatus',
    'updatePosition',
    'joinScheduledRaceRoom',
  ])
  assert.deepEqual(socket.emitted[0].payload, { identityKey: 'id-1', trackName: 'Australia' })
  assert.deepEqual(socket.emitted[1].payload, { gameStatus: 'racing' })
  assert.deepEqual(socket.emitted[2].payload, {
    position: { x: 4, y: 0.1, z: -12 },
    rotation: { x: 0, y: 1.25, z: 0 },
    speed: 0,
    headlightsEnabled: true,
  })
  assert.deepEqual(socket.emitted[3].payload, makeState().roomJoin)
})

test('reconnect listener ignores stale room state from a previous race', () => {
  const socket = new FakeSocket()
  registerScheduledRaceReconnectListener({
    socket,
    getActiveRaceId: () => 'race-2',
    getReconnectState: makeState,
    buildJoinGamePayload: () => ({ identityKey: 'id-1' }),
  })

  socket.fireConnect()
  assert.equal(socket.emitted.length, 0)
})
