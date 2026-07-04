import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getScheduledRaceCountdownState,
  parseScheduledRaceSettlement,
  registerScheduledRaceSocketListeners,
  shouldApplyScheduledRaceSnapshot,
  type ScheduledRaceRoomSnapshot,
  type ScheduledRaceSettlementPayload,
  type ScheduledRaceSettlementRace,
} from './scheduledRaceSocket'

const snapshot: ScheduledRaceRoomSnapshot = {
  raceId: 'race-1',
  roomId: 'scheduled_race:race-1',
  trackName: 'Australia',
  startsAt: '2026-06-30T13:00:00.000Z',
  serverTime: '2026-06-30T12:59:58.000Z',
  status: 'countdown',
  secondsUntilStart: 2,
}

test('getScheduledRaceCountdownState freezes staged cars and shows server time to start', () => {
  assert.deepEqual(getScheduledRaceCountdownState({
    status: 'staging',
    secondsUntilStart: 240,
  }), {
    gameStatus: 'countdown',
    countdown: 240,
  })
})

test('getScheduledRaceCountdownState shows server countdown seconds before start', () => {
  assert.deepEqual(getScheduledRaceCountdownState({
    status: 'countdown',
    secondsUntilStart: 10,
  }), {
    gameStatus: 'countdown',
    countdown: 10,
  })

  assert.deepEqual(getScheduledRaceCountdownState({
    status: 'countdown',
    secondsUntilStart: 3,
  }), {
    gameStatus: 'countdown',
    countdown: 3,
  })
})

test('getScheduledRaceCountdownState unlocks racing at server start', () => {
  assert.deepEqual(getScheduledRaceCountdownState({
    status: 'racing',
    secondsUntilStart: 0,
  }), {
    gameStatus: 'racing',
    countdown: 0,
  })
})

test('shouldApplyScheduledRaceSnapshot filters snapshots to the active scheduled race', () => {
  assert.equal(shouldApplyScheduledRaceSnapshot(snapshot, 'race-1'), true)
  assert.equal(shouldApplyScheduledRaceSnapshot(snapshot, 'race-2'), false)
  assert.equal(shouldApplyScheduledRaceSnapshot(snapshot, null), false)
  assert.equal(shouldApplyScheduledRaceSnapshot(null, 'race-1'), false)
})

test('registerScheduledRaceSocketListeners plays final countdown beeps once per active race', () => {
  const listeners = new Map<string, (payload: ScheduledRaceRoomSnapshot | null) => void>()
  const appliedStates: number[] = []
  const beepRaceIds: string[] = []

  registerScheduledRaceSocketListeners({
    socket: {
      on: (event, listener) => {
        listeners.set(event, listener)
      },
    },
    getActiveRaceId: () => 'race-1',
    onCountdownState: state => {
      appliedStates.push(state.countdown)
    },
    onFinalCountdownStart: payload => {
      beepRaceIds.push(payload.raceId)
    },
  })

  listeners.get('scheduledRaceCountdown')?.({ ...snapshot, secondsUntilStart: 4 })
  listeners.get('scheduledRaceCountdown')?.({ ...snapshot, secondsUntilStart: 3 })
  listeners.get('scheduledRaceCountdown')?.({ ...snapshot, secondsUntilStart: 2 })
  listeners.get('scheduledRaceCountdown')?.({ ...snapshot, raceId: 'race-2', secondsUntilStart: 3 })

  assert.deepEqual(appliedStates, [4, 3, 2])
  assert.deepEqual(beepRaceIds, ['race-1'])
})

test('registerScheduledRaceSocketListeners forwards active race lap progress and finish splits', () => {
  const listeners = new Map<string, (payload: { raceId: string; entrantId: string; lapTimesMs: number[] }) => void>()
  const progress: number[][] = []

  registerScheduledRaceSocketListeners({
    socket: {
      on: (event, listener) => {
        listeners.set(event, listener as (payload: { raceId: string; entrantId: string; lapTimesMs: number[] }) => void)
      },
    },
    getActiveRaceId: () => 'race-1',
    onCountdownState: () => {},
    onLapProgress: payload => {
      progress.push(payload.lapTimesMs)
    },
  })

  listeners.get('scheduledRaceLapProgress')?.({ raceId: 'race-1', entrantId: 'fox-1', lapTimesMs: [70000] })
  listeners.get('scheduledRaceLapProgress')?.({ raceId: 'race-2', entrantId: 'fox-2', lapTimesMs: [71000] })
  listeners.get('scheduledRaceFinishAccepted')?.({ raceId: 'race-1', entrantId: 'fox-1', lapTimesMs: [70000, 69000, 68000] })

  assert.deepEqual(progress, [[70000], [70000, 69000, 68000]])
})

test('parseScheduledRaceSettlement keeps only settlements for the active race', () => {
  const settled: ScheduledRaceSettlementRace = { id: 'race-1', status: 'settled', finalInscription: { txid: 'tx-1' } }

  assert.deepEqual(parseScheduledRaceSettlement({ race: settled }, 'race-1'), settled)
  assert.equal(parseScheduledRaceSettlement({ race: settled }, 'race-2'), null)
  assert.equal(parseScheduledRaceSettlement({ race: settled }, null), null)
  assert.equal(parseScheduledRaceSettlement({ race: null }, 'race-1'), null)
  assert.equal(parseScheduledRaceSettlement(undefined, 'race-1'), null)
  assert.equal(
    parseScheduledRaceSettlement({ race: { id: 'race-1', status: 'racing' as 'settled' } }, 'race-1'),
    null,
    'non-terminal statuses are ignored'
  )
})

test('registerScheduledRaceSocketListeners forwards settled, no-contest, and cancelled settlements for the active race only', () => {
  const listeners = new Map<string, (payload: ScheduledRaceSettlementPayload) => void>()
  const settlements: ScheduledRaceSettlementRace[] = []

  registerScheduledRaceSocketListeners({
    socket: {
      on: (event, listener) => {
        listeners.set(event, listener as (payload: ScheduledRaceSettlementPayload) => void)
      },
    },
    getActiveRaceId: () => 'race-1',
    onCountdownState: () => {},
    onSettlement: race => {
      settlements.push(race)
    },
  })

  const emit = listeners.get('scheduledRaceSettlement')
  emit?.({ race: { id: 'race-1', status: 'settled', finalInscription: { txid: 'tx-1' } } })
  emit?.({ race: { id: 'race-2', status: 'settled', finalInscription: { txid: 'tx-2' } } })
  emit?.({ race: { id: 'race-1', status: 'no_contest' } })
  emit?.({ race: { id: 'race-1', status: 'cancelled' } })
  emit?.({ race: null })

  assert.deepEqual(settlements.map(race => race.status), ['settled', 'no_contest', 'cancelled'])
  assert.equal(settlements[0].finalInscription?.txid, 'tx-1')
})
