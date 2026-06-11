import assert from 'node:assert/strict'
import test from 'node:test'
import {
  registerCarTrackJoinSocketListeners,
  registerRacingSocketConnectionListeners
} from './socketConnection'

test('registerRacingSocketConnectionListeners updates connection state on socket lifecycle events', () => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const connectedStates: boolean[] = []
  const socketIds: Array<string | undefined> = []
  const callbackEvents: string[] = []

  registerRacingSocketConnectionListeners({
    socket: {
      id: 'socket-1',
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    serverUrl: 'http://localhost:5000',
    setIsConnected: isConnected => {
      connectedStates.push(isConnected)
    },
    setSocketId: socketId => {
      socketIds.push(socketId)
    },
    onConnect: () => {
      callbackEvents.push('connect')
    },
    onDisconnect: reason => {
      callbackEvents.push(`disconnect:${reason}`)
    },
    onConnectError: () => {
      callbackEvents.push('connect_error')
    }
  })

  listeners.get('connect')?.()
  listeners.get('disconnect')?.('transport close')
  listeners.get('connect_error')?.(new Error('failed'))

  assert.deepEqual(connectedStates, [true, false, false])
  assert.deepEqual(socketIds, ['socket-1'])
  assert.deepEqual(callbackEvents, ['connect', 'disconnect:transport close', 'connect_error'])
})

test('registerCarTrackJoinSocketListeners dispatches join lifecycle payloads', () => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const calls: string[] = []

  registerCarTrackJoinSocketListeners({
    socket: {
      on(event, listener) {
        listeners.set(event, listener)
      }
    },
    trackLabel: 'Belgium',
    onGameJoined: payload => {
      calls.push(`game:${payload.gameId}`)
    },
    onPlayerJoined: payload => {
      calls.push(`join:${payload.playerId}`)
    },
    onPlayerLeft: payload => {
      calls.push(`left:${payload.playerId}`)
    },
    logPlayerJoined: payload => {
      calls.push(`log:${payload.playerId}`)
    }
  })

  listeners.get('gameJoined')?.({ gameId: 'game-1', position: { x: 1, y: 2, z: 3 } })
  listeners.get('playerJoined')?.({ playerId: 'player-1' })
  listeners.get('playerLeft')?.({ playerId: 'player-2' })

  assert.deepEqual(calls, [
    'game:game-1',
    'log:player-1',
    'join:player-1',
    'left:player-2'
  ])
})
