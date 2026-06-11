import assert from 'node:assert/strict'
import test from 'node:test'
import {
  registerCarTrackLivePlayerSocketListeners
} from './carTrackPlayerSocketListeners'
import type { PlayerCollisionSocketPayload } from './playerCollision'
import type { PlayerPositionSocketPayload } from './playerPosition'

type RemotePlayer = {
  id: string
  carColor?: string
  position: [number, number, number]
  rotation: [number, number, number]
  isWalking: boolean
  chatMessage?: string
  chatTimestamp?: number
}

type GameState = {
  players: Array<{
    id: string
    trackName?: string
    carColor?: string
  }>
}

test('registerCarTrackLivePlayerSocketListeners applies shared remote player events', () => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const queuedPositions: PlayerPositionSocketPayload[] = []
  let localChatMessage: { text: string; timestamp: number } | null = null
  let gameState: GameState | null = {
    players: [
      { id: 'remote-1', trackName: 'Australia' },
      { id: 'local-1', trackName: 'Australia' }
    ]
  }
  let otherPlayers: RemotePlayer[] = [
    {
      id: 'remote-1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      isWalking: false
    }
  ]

  registerCarTrackLivePlayerSocketListeners<GameState, RemotePlayer>({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    defaultTrackName: 'Australia',
    getSocketId: () => 'local-1',
    getCurrentTrackName: () => 'Australia',
    getGameStatePlayers: () => gameState?.players,
    queueRemotePlayerPositionUpdate: payload => {
      queuedPositions.push(payload)
    },
    setGameState: updater => {
      gameState = typeof updater === 'function' ? updater(gameState) : updater
    },
    setOtherPlayers: updater => {
      otherPlayers = typeof updater === 'function' ? updater(otherPlayers) : updater
    },
    setLocalChatMessage: message => {
      localChatMessage = message
    }
  })

  listeners.get('playerPositionUpdate')?.({
    playerId: 'remote-1',
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 1, z: 0 },
    speed: 4
  })
  listeners.get('playerCarColorUpdate')?.({ playerId: 'remote-1', carColor: '#ff00ff' })
  listeners.get('playerTrackNameUpdate')?.({ playerId: 'remote-1', trackName: 'Belgium' })
  listeners.get('playerChat')?.({ playerId: 'local-1', message: 'local hello' })
  listeners.get('playerChat')?.({ playerId: 'remote-1', message: 'remote hello' })
  listeners.get('playerCollision')?.({
    playerId1: 'remote-1',
    playerId2: 'local-1',
    position1: { x: 5, y: 0, z: 6 },
    position2: { x: 0, y: 0, z: 0 },
    rotation1: { x: 0, y: 2, z: 0 },
    rotation2: { x: 0, y: 0, z: 0 },
    speed1: 7,
    speed2: 0
  } satisfies PlayerCollisionSocketPayload)

  assert.equal(queuedPositions.length, 1)
  assert.equal(gameState?.players[0].carColor, '#ff00ff')
  assert.equal(gameState?.players[0].trackName, 'Belgium')
  assert.equal(otherPlayers[0].carColor, '#ff00ff')
  assert.equal(localChatMessage?.text, 'local hello')
  assert.equal(otherPlayers[0].chatMessage, undefined)
  assert.deepEqual(otherPlayers[0].position, [5, 0, 6])
  assert.deepEqual(otherPlayers[0].rotation, [0, 2, 0])
  assert.equal(otherPlayers[0].isWalking, true)
})
