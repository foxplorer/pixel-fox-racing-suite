import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getScheduledRaceCountdownState,
  registerScheduledRaceSocketListeners,
  shouldApplyScheduledRaceSnapshot,
  type ScheduledRaceRoomSnapshot,
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
