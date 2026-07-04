import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMultiplayerRaceInscriptionMetadata,
  buildMultiplayerRaceInscriptionPayload,
  MULTIPLAYER_RACE_INSCRIPTION_NAME,
} from './multiplayerRaceInscription.js'
import type { ScheduledRaceWithRoster } from './scheduledRaceTypes.js'

const race: ScheduledRaceWithRoster = {
  id: 'australia-20260629T130000Z',
  trackName: 'Australia',
  startsAt: '2026-06-29T13:00:00.000Z',
  status: 'finalizing',
  maxEntrants: 6,
  lapsRequired: 3,
  createdAt: '2026-06-29T12:00:00.000Z',
  updatedAt: '2026-06-29T13:15:00.000Z',
  roster: [{
    raceId: 'australia-20260629T130000Z',
    entrantId: 'fox_1',
    identityKey: 'identity-1',
    ownerAddress: 'owner-1',
    foxOutpoint: 'fox-outpoint-1',
    foxOriginOutpoint: 'fox-origin-1',
    foxName: 'Fox 1',
    carColor: '#ff0000',
    gridSlot: 1,
    stagedGridSlot: 1,
    status: 'finished',
    signedUpAt: '2026-06-29T12:01:00.000Z',
    stagedAt: '2026-06-29T12:59:00.000Z',
  }],
  results: [{
    raceId: 'australia-20260629T130000Z',
    entrantId: 'fox_1',
    finishPosition: 1,
    totalTimeMs: 210000,
    lapTimesMs: [69000, 70000, 71000],
    status: 'finished',
    finishedAt: '2026-06-29T13:03:30.000Z',
  }],
  podium: [],
  signupCount: 1,
  stagedCount: 1,
  openSlots: 5,
  serverTime: '2026-06-29T13:15:00.000Z',
}

test('buildMultiplayerRaceInscriptionPayload records the complete group race in one payload', () => {
  const payload = buildMultiplayerRaceInscriptionPayload(race, '2026-06-29T13:15:00.000Z')

  assert.equal(payload.inscriptionName, MULTIPLAYER_RACE_INSCRIPTION_NAME)
  assert.equal(payload.raceId, race.id)
  assert.equal(payload.entrants[0].foxName, 'Fox 1')
  assert.equal('ownerAddress' in payload.entrants[0], false)
  assert.deepEqual(payload.results.map(result => [
    result.entrantId,
    result.finishPosition,
    result.lapsCompleted,
    result.status,
  ]), [
    ['fox_1', 1, 3, 'finished'],
  ])
})

test('buildMultiplayerRaceInscriptionMetadata uses multiplayer race MAP name', () => {
  const payload = buildMultiplayerRaceInscriptionPayload(race, '2026-06-29T13:15:00.000Z')
  const metadata = buildMultiplayerRaceInscriptionMetadata({
    inscriptionApp: 'pixelfoxracing',
    payload,
  })

  assert.equal(metadata.app, 'pixelfoxracing')
  assert.equal(metadata.name, MULTIPLAYER_RACE_INSCRIPTION_NAME)
  assert.equal(metadata.raceId, race.id)
  assert.equal(metadata.lapsRequired, '3')
})
