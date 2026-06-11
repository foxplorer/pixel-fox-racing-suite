import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCarTrackGameStateSnapshot } from './gameStateSnapshot'
import type { RacingWorldPlayer } from './worldPlayers'

test('applyCarTrackGameStateSnapshot preserves current track and builds same-track rendered players', () => {
  const previousRenderedPlayers: RacingWorldPlayer[] = [
    {
      id: 'remote-1',
      name: 'Existing Remote',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: '#existing-color',
      carColor: '#existing-car',
      isWalking: false
    }
  ]

  const result = applyCarTrackGameStateSnapshot({
    state: {
      gameId: 'game-1',
      trackName: 'Server Default',
      items: [{ id: 'item-1' }],
      players: [
        {
          id: 'socket-local',
          identityKey: 'local',
          name: 'Local',
          trackName: undefined
        },
        {
          id: 'remote-1',
          identityKey: 'remote-1',
          name: 'Remote',
          trackName: 'Australia',
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 1, z: 0 }
        },
        {
          id: 'remote-2',
          identityKey: 'remote-2',
          name: 'Belgium Remote',
          trackName: 'Belgium'
        }
      ]
    },
    previousCurrentPlayers: [
      {
        id: 'socket-local',
        identityKey: 'local',
        trackName: 'Australia'
      }
    ],
    previousRenderedPlayers,
    socketId: 'socket-local',
    identityKey: 'local',
    currentTrackName: 'Australia',
    defaultTrackName: 'Australia',
    getFallbackColor: index => `fallback-${index}`
  })

  assert.equal(result.gameState.players[0].trackName, 'Australia')
  assert.deepEqual(result.gameState.items, [{ id: 'item-1' }])
  assert.equal(result.currentPlayerInSnapshot?.id, 'socket-local')
  assert.deepEqual(result.renderedPlayers, [
    {
      id: 'remote-1',
      name: 'Remote',
      position: [1, 2, 3],
      rotation: [0, 1, 0],
      color: '#existing-color',
      carColor: '#existing-car',
      isWalking: false,
      originOutpoint: undefined
    }
  ])
})

test('applyCarTrackGameStateSnapshot supports socket-first current-player matching', () => {
  const result = applyCarTrackGameStateSnapshot({
    state: {
      gameId: 'game-1',
      players: [
        {
          id: 'same-identity-remote',
          identityKey: 'local',
          ordinalAddress: 'owner',
          name: 'Remote',
          trackName: 'San Luis'
        }
      ]
    },
    previousRenderedPlayers: [],
    socketId: 'socket-local',
    identityKey: 'local',
    ordinalAddress: 'owner',
    currentTrackName: 'San Luis',
    defaultTrackName: 'San Luis',
    defaultPosition: [0, 0.1, 0],
    getFallbackColor: index => `fallback-${index}`,
    isCurrentPlayer: player => player.id === 'socket-local'
  })

  assert.equal(result.currentPlayerInSnapshot, undefined)
  assert.deepEqual(result.renderedPlayers, [
    {
      id: 'same-identity-remote',
      name: 'Remote',
      position: [0, 0.1, 0],
      rotation: [0, 0, 0],
      color: 'fallback-0',
      carColor: 'fallback-0',
      isWalking: false,
      originOutpoint: undefined
    }
  ])
})
