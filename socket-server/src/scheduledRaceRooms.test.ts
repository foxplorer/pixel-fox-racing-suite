import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ScheduledRaceRoomRegistry,
  getScheduledRaceRoomId,
  getScheduledRaceRoomStatus,
  isValidScheduledRaceFinishReport,
  isValidScheduledRaceLapProgressReport,
  isValidScheduledRaceRoomJoinInput,
} from './scheduledRaceRooms.js'

const entrant = {
  playerId: 'socket-1',
  identityKey: 'identity-1',
  name: 'Fox',
  carColor: '#ff6b6b',
  position: { x: 1, y: 0.1, z: 2 },
  rotation: { x: 0, y: 1.5, z: 0 },
  speed: 0,
  gameStatus: 'countdown',
}

test('scheduled race room ids are scoped away from the global world', () => {
  assert.equal(getScheduledRaceRoomId('race-1'), 'scheduled_race:race-1')
})

test('scheduled race room join payload validation rejects incomplete or invalid entries', () => {
  assert.equal(isValidScheduledRaceRoomJoinInput({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-origin',
    gridSlot: 3,
    startsAt: '2026-06-30T13:00:00.000Z',
  }), true)

  assert.equal(isValidScheduledRaceRoomJoinInput({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-origin',
    gridSlot: 6,
    startsAt: '2026-06-30T13:00:00.000Z',
  }), true)

  assert.equal(isValidScheduledRaceRoomJoinInput({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-origin',
    gridSlot: 7,
    startsAt: '2026-06-30T13:00:00.000Z',
  }), false)

  assert.equal(isValidScheduledRaceRoomJoinInput({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-origin',
    gridSlot: 1,
    startsAt: 'not-a-date',
  }), false)
})

test('scheduled race finish report validation rejects incomplete or invalid reports', () => {
  assert.equal(isValidScheduledRaceFinishReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    totalTimeMs: 210000,
    lapTimesMs: [70000, 71000, 69000],
  }), true)

  assert.equal(isValidScheduledRaceFinishReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    totalTimeMs: 0,
    lapTimesMs: [70000],
  }), false)

  assert.equal(isValidScheduledRaceFinishReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    totalTimeMs: 70000,
    lapTimesMs: [],
  }), false)
})

test('scheduled race lap progress validation accepts partial splits only for scoped entrants', () => {
  assert.equal(isValidScheduledRaceLapProgressReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    lapTimesMs: [70000, 71000],
  }), true)

  assert.equal(isValidScheduledRaceLapProgressReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    lapTimesMs: [],
  }), true)

  assert.equal(isValidScheduledRaceLapProgressReport({
    raceId: 'race-1',
    entrantId: '',
    lapTimesMs: [70000],
  }), false)

  assert.equal(isValidScheduledRaceLapProgressReport({
    raceId: 'race-1',
    entrantId: 'origin-1',
    lapTimesMs: [0],
  }), false)
})

test('scheduled race room status uses staging, countdown, and racing windows', () => {
  const startsAtMs = Date.parse('2026-06-30T13:00:00.000Z')
  assert.equal(getScheduledRaceRoomStatus(startsAtMs, startsAtMs - 60_000), 'staging')
  assert.equal(getScheduledRaceRoomStatus(startsAtMs, startsAtMs - 5_000), 'countdown')
  assert.equal(getScheduledRaceRoomStatus(startsAtMs, startsAtMs), 'racing')
})

test('scheduled race room registry keeps entrants sorted by grid slot', () => {
  const registry = new ScheduledRaceRoomRegistry()
  const nowMs = Date.parse('2026-06-30T12:59:55.000Z')
  const startsAt = '2026-06-30T13:00:00.000Z'

  registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-2',
    gridSlot: 2,
    startsAt,
  }, {
    ...entrant,
    playerId: 'socket-2',
    identityKey: 'identity-2',
  }, nowMs)

  const snapshot = registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt,
  }, entrant, nowMs + 1)

  assert.equal(snapshot.status, 'countdown')
  assert.equal(snapshot.secondsUntilStart, 5)
  assert.deepEqual(snapshot.entrants.map(item => item.entrantId), ['fox-1', 'fox-2'])
})

test('scheduled race room registry removes empty rooms when players leave', () => {
  const registry = new ScheduledRaceRoomRegistry()

  registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt: '2026-06-30T13:00:00.000Z',
  }, entrant, Date.parse('2026-06-30T12:59:00.000Z'))

  assert.deepEqual(registry.getActiveRaceIds(), ['race-1'])
  assert.equal(registry.leavePlayer('socket-1', Date.parse('2026-06-30T12:59:30.000Z')), 'race-1')
  assert.deepEqual(registry.getActiveRaceIds(), [])
})

test('scheduled race room registry keeps entrants in snapshots if they leave during racing', () => {
  const registry = new ScheduledRaceRoomRegistry()
  const startsAt = '2026-06-30T13:00:00.000Z'
  const racingMs = Date.parse('2026-06-30T13:00:10.000Z')

  registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt,
  }, entrant, Date.parse('2026-06-30T12:59:00.000Z'))

  assert.equal(registry.leavePlayer('socket-1', racingMs), 'race-1')

  const snapshot = registry.getSnapshot('race-1', racingMs)
  assert.deepEqual(snapshot.entrants.map(item => item.entrantId), ['fox-1'])
  assert.equal(snapshot.entrants[0].gameStatus, 'disconnected')
  assert.equal(snapshot.entrants[0].speed, 0)
  assert.equal(registry.getEntrantForPlayer('socket-1'), null)
})

test('scheduled race room registry replaces a disconnected entrant if the same entrant rejoins', () => {
  const registry = new ScheduledRaceRoomRegistry()
  const startsAt = '2026-06-30T13:00:00.000Z'
  const racingMs = Date.parse('2026-06-30T13:00:10.000Z')

  registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt,
  }, entrant, Date.parse('2026-06-30T12:59:00.000Z'))
  registry.leavePlayer('socket-1', racingMs)

  const snapshot = registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt,
  }, {
    ...entrant,
    playerId: 'socket-2',
    identityKey: 'identity-2',
    gameStatus: 'racing',
  }, racingMs + 1000)

  assert.equal(snapshot.entrants.length, 1)
  assert.equal(snapshot.entrants[0].playerId, 'socket-2')
  assert.equal(snapshot.entrants[0].gameStatus, 'racing')
  assert.equal(registry.getEntrantForPlayer('socket-1'), null)
  assert.equal(registry.getEntrantForPlayer('socket-2')?.entrantId, 'fox-1')
})

test('scheduled race room registry can look up an entrant by player id', () => {
  const registry = new ScheduledRaceRoomRegistry()

  registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt: '2026-06-30T13:00:00.000Z',
  }, entrant, Date.parse('2026-06-30T12:59:00.000Z'))

  assert.equal(registry.getEntrantForPlayer('socket-1')?.entrantId, 'fox-1')
  assert.equal(registry.getEntrantForPlayer('missing'), null)
})

test('scheduled race room registry snapshots preserve entrant headlight state', () => {
  const registry = new ScheduledRaceRoomRegistry()

  const snapshot = registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt: '2026-06-30T13:00:00.000Z',
  }, {
    ...entrant,
    headlightsEnabled: true,
  }, Date.parse('2026-06-30T12:59:00.000Z'))

  assert.equal(snapshot.entrants[0].headlightsEnabled, true)

  const updated = registry.updateEntrant('socket-1', { headlightsEnabled: false })
  assert.equal(updated?.entrants[0].headlightsEnabled, false)
})

test('scheduled race room registry defaults entrant headlights on', () => {
  const registry = new ScheduledRaceRoomRegistry()

  const snapshot = registry.joinRace({
    raceId: 'race-1',
    trackName: 'Australia',
    entrantId: 'fox-1',
    gridSlot: 1,
    startsAt: '2026-06-30T13:00:00.000Z',
  }, {
    ...entrant,
    headlightsEnabled: undefined,
  }, Date.parse('2026-06-30T12:59:00.000Z'))

  assert.equal(snapshot.entrants[0].headlightsEnabled, true)
})
