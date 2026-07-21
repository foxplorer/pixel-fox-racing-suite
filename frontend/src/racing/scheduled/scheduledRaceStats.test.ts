import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScheduledRaceFinalStatsRow, buildScheduledRaceLapStatsRows } from './scheduledRaceStats'
import type { ScheduledRace } from './scheduledRaceTypes'

const race: ScheduledRace = {
  id: 'Australia-2026-06-30T18:00:00.000Z',
  trackName: 'Australia',
  startsAt: '2026-06-30T18:00:00.000Z',
  status: 'finalizing',
  maxEntrants: 5,
  lapsRequired: 3,
  roster: [
    {
      raceId: 'Australia-2026-06-30T18:00:00.000Z',
      entrantId: 'fox_a_0',
      identityKey: 'identity-a',
      ownerAddress: 'owner-a',
      foxOutpoint: 'fox-a.0',
      foxOriginOutpoint: 'origin-a.0',
      foxName: 'A Fox',
      carColor: '#4ECDC4',
      gridSlot: 1,
      status: 'finished',
      signedUpAt: '2026-06-30T17:50:00.000Z',
      stagedAt: '2026-06-30T17:58:00.000Z',
    },
    {
      raceId: 'Australia-2026-06-30T18:00:00.000Z',
      entrantId: 'fox_b_0',
      identityKey: 'identity-b',
      ownerAddress: 'owner-b',
      foxOutpoint: 'fox-b.0',
      foxOriginOutpoint: 'origin-b.0',
      foxName: 'B Fox',
      carColor: '#FFD166',
      gridSlot: 2,
      status: 'dnf',
      signedUpAt: '2026-06-30T17:51:00.000Z',
      stagedAt: '2026-06-30T17:58:00.000Z',
    },
  ],
  results: [
    {
      raceId: 'Australia-2026-06-30T18:00:00.000Z',
      entrantId: 'fox_a_0',
      finishPosition: 1,
      totalTimeMs: 213000,
      lapTimesMs: [70000, 71000, 72000],
      status: 'finished',
      finishedAt: '2026-06-30T18:03:33.000Z',
    },
    {
      raceId: 'Australia-2026-06-30T18:00:00.000Z',
      entrantId: 'fox_b_0',
      finishPosition: null,
      totalTimeMs: null,
      lapTimesMs: [80000],
      status: 'dnf',
      finishedAt: '2026-06-30T18:05:00.000Z',
    },
  ],
  podium: [],
  finalInscription: {
    raceId: 'Australia-2026-06-30T18:00:00.000Z',
    txid: 'a'.repeat(64),
    status: 'broadcasted',
    dummy: true,
    inscriptionName: 'multiplayer race',
    outputIndex: 0,
    finalInscriptionPayload: {
      raceId: 'Australia-2026-06-30T18:00:00.000Z',
      trackName: 'Australia',
      startsAt: '2026-06-30T18:00:00.000Z',
      lapsRequired: 3,
      results: [],
      recipients: [],
      finalizedAt: '2026-06-30T18:15:00.000Z',
    },
    createdAt: '2026-06-30T18:15:00.000Z',
    updatedAt: '2026-06-30T18:15:00.000Z',
  },
  signupCount: 2,
  stagedCount: 0,
  openSlots: 3,
  serverTime: '2026-06-30T18:05:00.000Z',
}

test('buildScheduledRaceLapStatsRows flattens each recorded group race lap into PixelRacing stats rows', () => {
  const rows = buildScheduledRaceLapStatsRows(race)

  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map(row => row.laptime), ['70', '71', '72', '80'])
  assert.deepEqual(rows.map(row => row.groupRaceLapNumber), [1, 2, 3, 1])
  assert.deepEqual(rows.map(row => row.groupRaceId), [
    race.id,
    race.id,
    race.id,
    race.id,
  ])
})

test('buildScheduledRaceLapStatsRows preserves racer identity and group race context', () => {
  const [winnerLap, winnerLapTwo] = buildScheduledRaceLapStatsRows(race)

  assert.equal(winnerLap.recordVersion, 2)
  assert.equal(winnerLap.owneraddress, '')
  assert.equal(winnerLap.foxname, 'A Fox')
  assert.equal(winnerLap.trackname, 'Australia')
  assert.equal(winnerLap.groupRaceFinishPosition, 1)
  assert.equal(winnerLap.groupRaceTotalTimeMs, 213000)
  assert.equal(winnerLap.groupRaceStatus, 'finished')

  assert.equal(winnerLapTwo.groupRaceStatus, 'finished')
  const partialDnfLap = buildScheduledRaceLapStatsRows(race)[3]
  assert.equal(partialDnfLap.recordVersion, 2)
  assert.equal(partialDnfLap.owneraddress, '')
  assert.equal(partialDnfLap.groupRaceFinishPosition, null)
  assert.equal(partialDnfLap.groupRaceTotalTimeMs, null)
  assert.equal(partialDnfLap.groupRaceStatus, 'dnf')
})

test('buildScheduledRaceFinalStatsRow exposes final race tx without owner address', () => {
  const row = buildScheduledRaceFinalStatsRow(race)

  assert.ok(row)
  assert.equal(row.recordVersion, 2)
  assert.equal(row.owneraddress, '')
  assert.equal(row.originoutpoint, 'origin-a.0')
  assert.equal(row.groupRaceFinal, true)
  assert.equal(row.groupRaceEntrantCount, 2)
  assert.equal(row.groupRaceFinisherCount, 1)
  assert.equal(row.inscriptionName, 'multiplayer race')
  assert.deepEqual(row.groupRaceEntrants?.map(entrant => ({
    foxName: entrant.foxName,
    finishPosition: entrant.finishPosition,
    totalTimeMs: entrant.totalTimeMs,
    lapTimesMs: entrant.lapTimesMs,
    status: entrant.status,
    carColor: entrant.carColor,
  })), [
    {
      foxName: 'A Fox',
      finishPosition: 1,
      totalTimeMs: 213000,
      lapTimesMs: [70000, 71000, 72000],
      status: 'finished',
      carColor: '#4ECDC4',
    },
    {
      foxName: 'B Fox',
      finishPosition: null,
      totalTimeMs: null,
      lapTimesMs: [80000],
      status: 'dnf',
      carColor: '#FFD166',
    },
  ])
})
