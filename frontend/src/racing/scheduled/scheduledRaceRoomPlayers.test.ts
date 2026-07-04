import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import type { RacingWorldPlayer } from '../multiplayer/worldPlayers'
import { buildScheduledRaceGridSlots } from './gridSlots'
import { buildScheduledRaceRoomPlayers } from './scheduledRaceRoomPlayers'
import type { ScheduledRaceRoomSnapshot } from './scheduledRaceSocket'

const gridSlots = buildScheduledRaceGridSlots({
  startPosition: new THREE.Vector3(10, 0, 20),
  startDirection: new THREE.Vector3(1, 0, 0),
  slotCount: 6,
  yOffset: 0.1,
})

const snapshot: ScheduledRaceRoomSnapshot = {
  raceId: 'race-1',
  roomId: 'scheduled_race:race-1',
  trackName: 'Australia',
  startsAt: '2026-06-30T13:00:00.000Z',
  serverTime: '2026-06-30T12:59:58.000Z',
  status: 'countdown',
  secondsUntilStart: 2,
  entrants: [
    {
      playerId: 'socket-local',
      identityKey: 'local',
      name: 'Local',
      carColor: '#local',
      entrantId: 'local-origin',
      gridSlot: 1,
      joinedAt: 1,
      speed: 0,
    },
    {
      playerId: 'remote-2',
      identityKey: 'remote-2',
      name: 'Remote Two',
      carColor: '#222222',
      originOutpoint: 'origin-outpoint-2',
      entrantId: 'origin-2',
      gridSlot: 2,
      joinedAt: 2,
      speed: 0,
      headlightsEnabled: true,
    },
    {
      playerId: 'remote-1',
      identityKey: 'remote-1',
      name: 'Remote One',
      carColor: '#111111',
      entrantId: 'origin-1',
      gridSlot: 3,
      joinedAt: 3,
      speed: 0,
    },
  ],
}

test('buildScheduledRaceRoomPlayers leaves casual rendered players unchanged without an active matching race', () => {
  const existingPlayers: RacingWorldPlayer[] = [
    {
      id: 'casual',
      name: 'Casual',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: '#fff',
      carColor: '#fff',
      isWalking: false,
    },
  ]

  assert.equal(buildScheduledRaceRoomPlayers({
    snapshot,
    activeRaceId: null,
    socketId: 'socket-local',
    existingPlayers,
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  }), existingPlayers)
})

test('buildScheduledRaceRoomPlayers builds active remote roster in grid-slot order', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot,
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.deepEqual(players.map(player => player.id), ['remote-2', 'remote-1'])
  assert.deepEqual(players[0], {
    id: 'remote-2',
    name: 'Remote Two',
    position: gridSlots[1].position.toArray(),
    rotation: [0, gridSlots[1].rotationY, 0],
    color: 'fallback-0',
    carColor: '#222222',
    isWalking: false,
    speed: 0,
    originOutpoint: 'origin-outpoint-2',
    headlightsEnabled: true,
    chatMessage: undefined,
    chatTimestamp: undefined,
  })
})

test('buildScheduledRaceRoomPlayers uses grid-slot pose before racing even when a stale live pose exists', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot,
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [
      {
        id: 'remote-2',
        name: 'Live Remote',
        position: [50, 0.2, 60],
        rotation: [0, 2, 0],
        color: '#existing-color',
        carColor: '#existing-car',
        isWalking: true,
        speed: 8,
        headlightsEnabled: true,
      },
    ],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.equal(players[0].id, 'remote-2')
  assert.deepEqual(players[0].position, gridSlots[1].position.toArray())
  assert.deepEqual(players[0].rotation, [0, gridSlots[1].rotationY, 0])
  assert.equal(players[0].color, '#existing-color')
  assert.equal(players[0].carColor, '#222222')
  assert.equal(players[0].speed, 8)
  assert.equal(players[0].headlightsEnabled, true)
})

test('buildScheduledRaceRoomPlayers lets scheduled room snapshots override stale headlight state', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot: {
      ...snapshot,
      entrants: [
        {
          ...snapshot.entrants[1],
          headlightsEnabled: true,
        },
      ],
    },
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [
      {
        id: 'remote-2',
        name: 'Live Remote',
        position: [50, 0.2, 60],
        rotation: [0, 2, 0],
        color: '#existing-color',
        carColor: '#existing-car',
        isWalking: true,
        speed: 8,
        headlightsEnabled: false,
      },
    ],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.equal(players[0].headlightsEnabled, true)
  assert.deepEqual(players[0].position, gridSlots[1].position.toArray())
  assert.deepEqual(players[0].rotation, [0, gridSlots[1].rotationY, 0])
})

test('buildScheduledRaceRoomPlayers preserves live pose once the room is racing', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot: {
      ...snapshot,
      status: 'racing',
    },
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [
      {
        id: 'remote-2',
        name: 'Live Remote',
        position: [50, 0.2, 60],
        rotation: [0, 2, 0],
        color: '#existing-color',
        carColor: '#existing-car',
        isWalking: true,
        speed: 8,
        headlightsEnabled: true,
      },
    ],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.deepEqual(players[0].position, [50, 0.2, 60])
  assert.deepEqual(players[0].rotation, [0, 2, 0])
})

test('buildScheduledRaceRoomPlayers preserves explicit scheduled headlight off state', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot: {
      ...snapshot,
      entrants: [
        {
          ...snapshot.entrants[1],
          headlightsEnabled: false,
        },
      ],
    },
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.equal(players[0].headlightsEnabled, false)
})

test('buildScheduledRaceRoomPlayers defaults scheduled headlights on over stale existing off state', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot: {
      ...snapshot,
      entrants: [
        {
          ...snapshot.entrants[2],
          headlightsEnabled: undefined,
        },
      ],
    },
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [
      {
        id: 'remote-1',
        name: 'Live Remote',
        position: [50, 0.2, 60],
        rotation: [0, 2, 0],
        color: '#existing-color',
        carColor: '#existing-car',
        isWalking: false,
        speed: 0,
        headlightsEnabled: false,
      },
    ],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.equal(players[0].headlightsEnabled, true)
})

test('buildScheduledRaceRoomPlayers falls back to entrant id for fox outpoint metadata', () => {
  const players = buildScheduledRaceRoomPlayers({
    snapshot: {
      ...snapshot,
      entrants: [
        {
          ...snapshot.entrants[1],
          originOutpoint: null,
          entrantId: 'fallback-origin-outpoint',
        },
      ],
    },
    activeRaceId: 'race-1',
    socketId: 'socket-local',
    existingPlayers: [],
    gridSlots,
    getFallbackColor: index => `fallback-${index}`,
  })

  assert.equal(players[0].originOutpoint, 'fallback-origin-outpoint')
  assert.equal(players[0].headlightsEnabled, true)
})
