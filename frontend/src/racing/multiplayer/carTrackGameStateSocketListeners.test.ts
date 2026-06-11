import assert from 'node:assert/strict'
import test from 'node:test'
import {
  registerCarTrackGameStateSocketListener
} from './carTrackGameStateSocketListeners'
import type { CarTrackGameStateSnapshot } from './gameStateSnapshot'
import type { RacingWorldGameStatePlayer, RacingWorldPlayer } from './worldPlayers'

type Item = { id: string }

test('registerCarTrackGameStateSocketListener applies snapshots and reconnect join state', () => {
  const listeners = new Map<string, (...args: any[]) => void>()
  let gameState: CarTrackGameStateSnapshot<RacingWorldGameStatePlayer, Item> | null = {
    gameId: 'game-1',
    players: [{
      id: 'socket-local',
      identityKey: 'identity-local',
      name: 'Local',
      score: 0,
      trackName: 'Australia'
    }]
  }
  let items: Item[] = []
  let otherPlayers: RacingWorldPlayer[] = []
  let hasJoined = false
  let hasJoinedRef = false

  registerCarTrackGameStateSocketListener<RacingWorldGameStatePlayer, Item>({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    defaultTrackName: 'Australia',
    getSocketId: () => 'socket-local',
    getIdentityKey: () => 'identity-local',
    getCurrentTrackName: () => 'Australia',
    getPreviousCurrentPlayers: () => gameState?.players,
    getPreviousRenderedPlayers: () => otherPlayers,
    getFallbackColor: index => `color-${index}`,
    setGameState: updater => {
      gameState = typeof updater === 'function' ? updater(gameState) : updater
    },
    setItems: nextItems => {
      items = nextItems
    },
    setOtherPlayers: updater => {
      otherPlayers = typeof updater === 'function' ? updater(otherPlayers) : updater
    },
    setHasJoined: nextHasJoined => {
      hasJoined = nextHasJoined
    },
    setHasJoinedRef: nextHasJoined => {
      hasJoinedRef = nextHasJoined
    },
    getHasJoined: () => hasJoined,
    scheduleFrame: callback => callback()
  })

  listeners.get('gameState')?.({
    gameId: 'game-1',
    players: [
      {
        id: 'socket-local',
        identityKey: 'identity-local',
        name: 'Local',
        score: 1,
        position: { x: 0, y: 0, z: 0 }
      },
      {
        id: 'remote-1',
        identityKey: 'identity-remote',
        name: 'Remote',
        score: 2,
        position: { x: 1, y: 0, z: 2 },
        rotation: { x: 0, y: 1, z: 0 },
        trackName: 'Australia'
      }
    ],
    items: [{ id: 'blueberry-1' }]
  })

  assert.equal(gameState?.players[0].trackName, 'Australia')
  assert.deepEqual(items, [{ id: 'blueberry-1' }])
  assert.equal(otherPlayers.length, 1)
  assert.equal(otherPlayers[0].id, 'remote-1')
  assert.equal(hasJoined, true)
  assert.equal(hasJoinedRef, true)
})

test('registerCarTrackGameStateSocketListener supports socket-first current-player matching', () => {
  const listeners = new Map<string, (...args: any[]) => void>()
  let otherPlayers: RacingWorldPlayer[] = []

  registerCarTrackGameStateSocketListener<RacingWorldGameStatePlayer, Item>({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    defaultTrackName: 'San Luis',
    getSocketId: () => 'socket-local',
    getIdentityKey: () => 'shared-identity',
    getOrdinalAddress: () => 'shared-wallet',
    getCurrentTrackName: () => 'San Luis',
    getPreviousCurrentPlayers: () => [],
    getPreviousRenderedPlayers: () => otherPlayers,
    getFallbackColor: index => `color-${index}`,
    setGameState: () => {},
    setItems: () => {},
    setOtherPlayers: updater => {
      otherPlayers = typeof updater === 'function' ? updater(otherPlayers) : updater
    },
    setHasJoined: () => {},
    setHasJoinedRef: () => {},
    getHasJoined: () => true,
    defaultPosition: [0, 0.1, 0],
    isCurrentPlayer: (player, context) => {
      if (context.socketId) {
        return player.id === context.socketId
      }

      if (context.identityKey) {
        return player.identityKey === context.identityKey
      }

      return !!context.ordinalAddress && player.ordinalAddress === context.ordinalAddress
    },
    scheduleFrame: callback => callback()
  })

  listeners.get('gameState')?.({
    gameId: 'game-1',
    players: [
      {
        id: 'socket-local',
        identityKey: 'shared-identity',
        name: 'Local',
        score: 1,
        trackName: 'San Luis'
      },
      {
        id: 'socket-remote',
        identityKey: 'shared-identity',
        ordinalAddress: 'shared-wallet',
        name: 'Same wallet remote',
        score: 2,
        trackName: 'San Luis'
      }
    ]
  })

  assert.equal(otherPlayers.length, 1)
  assert.equal(otherPlayers[0].id, 'socket-remote')
})
