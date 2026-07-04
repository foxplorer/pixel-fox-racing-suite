import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScheduledRaceLapProgress } from './scheduledRaceFinish'

const activeRace = {
  raceId: 'race-1',
  entrantId: 'origin-1',
  lapsRequired: 3,
}

test('buildScheduledRaceLapProgress ignores casual laps', () => {
  assert.equal(buildScheduledRaceLapProgress({
    activeRace: null,
    previousLapTimes: [],
    completedLapTimeSeconds: 71.2,
  }), null)
})

test('buildScheduledRaceLapProgress records scheduled lap before finish', () => {
  assert.deepEqual(buildScheduledRaceLapProgress({
    activeRace,
    previousLapTimes: [70.1],
    completedLapTimeSeconds: 71.2,
  }), {
    lapTimes: [70.1, 71.2],
    finished: false,
  })
})

test('buildScheduledRaceLapProgress builds finish report at required lap count', () => {
  assert.deepEqual(buildScheduledRaceLapProgress({
    activeRace,
    previousLapTimes: [70.1, 71.2],
    completedLapTimeSeconds: 72.345,
  }), {
    lapTimes: [70.1, 71.2, 72.345],
    finished: true,
    finishReport: {
      raceId: 'race-1',
      entrantId: 'origin-1',
      lapTimesMs: [70100, 71200, 72345],
      totalTimeMs: 213645,
    },
  })
})
