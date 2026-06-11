import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPixelRacingGameResult,
  buildPixelRacingActivityFromTransaction,
  buildPixelRacingLapInscriptionPayload,
  buildPixelRacingSharedLapTransactionPayload,
  buildLapPlayerIdentity,
  getMissingLapPlayerIdentityFields,
  MAX_SUBMITTABLE_LAP_TIME_SECONDS,
  MIN_SUBMITTABLE_LAP_TIME_SECONDS,
  validateLapSubmissionCandidate,
  validateSubmittableLapTime
} from './lapResult'
import { SUBMITTABLE_TRACK_DISPLAY_NAMES } from '../tracks/trackDisplayNames'

const identity = {
  ownerAddress: 'owner-address',
  outpoint: 'fox-outpoint',
  originOutpoint: 'origin-outpoint',
  foxName: 'Test Fox'
}

test('validateSubmittableLapTime enforces shared server-aligned lap bounds', () => {
  assert.deepEqual(validateSubmittableLapTime(MIN_SUBMITTABLE_LAP_TIME_SECONDS), { valid: true })
  assert.deepEqual(validateSubmittableLapTime(MAX_SUBMITTABLE_LAP_TIME_SECONDS), { valid: true })
  assert.deepEqual(validateSubmittableLapTime(MIN_SUBMITTABLE_LAP_TIME_SECONDS - 0.001), {
    valid: false,
    reason: 'too-fast'
  })
  assert.deepEqual(validateSubmittableLapTime(MAX_SUBMITTABLE_LAP_TIME_SECONDS + 0.001), {
    valid: false,
    reason: 'too-slow'
  })
  assert.deepEqual(validateSubmittableLapTime(Number.NaN), {
    valid: false,
    reason: 'non-finite'
  })
})

test('buildLapPlayerIdentity only returns complete lap identity data', () => {
  assert.deepEqual(buildLapPlayerIdentity(identity), identity)
  assert.equal(buildLapPlayerIdentity({ ...identity, outpoint: '' }), null)
  assert.deepEqual(getMissingLapPlayerIdentityFields({
    ownerAddress: 'owner',
    foxName: 'Fox'
  }), ['outpoint', 'originOutpoint'])
})

test('validateLapSubmissionCandidate returns a complete identity for submit-ready laps', () => {
  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'racing',
    trackName: 'Australia',
    lapTimeSeconds: 75,
    identity
  }), {
    valid: true,
    identity
  })

  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'racing',
    trackName: 'United Kingdom',
    lapTimeSeconds: 75,
    identity
  }), {
    valid: true,
    identity
  })
})

test('validateLapSubmissionCandidate reports standard lap submission failures', () => {
  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'showroom',
    trackName: 'Australia',
    lapTimeSeconds: 75,
    identity
  }), {
    valid: false,
    message: 'game status is "showroom", must be "racing"'
  })

  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'racing',
    trackName: 'Unknown',
    lapTimeSeconds: 75,
    identity
  }), {
    valid: false,
    message: `track name "Unknown" is not a valid track. Valid tracks: ${SUBMITTABLE_TRACK_DISPLAY_NAMES.join(', ')}`
  })

  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'racing',
    trackName: 'Belgium',
    lapTimeSeconds: 20,
    identity
  }), {
    valid: false,
    message: `lap time 20.000s is too fast (minimum: ${MIN_SUBMITTABLE_LAP_TIME_SECONDS}s)`
  })

  assert.deepEqual(validateLapSubmissionCandidate({
    gameStatus: 'racing',
    trackName: 'Aspen',
    lapTimeSeconds: 75,
    identity: { ...identity, originOutpoint: '' }
  }), {
    valid: false,
    message: 'missing originOutpoint'
  })
})

test('buildPixelRacingGameResult creates the shared leaderboard result shape', () => {
  assert.deepEqual(buildPixelRacingGameResult({
    identity,
    lapTimeSeconds: 72.345,
    timestampMs: 123456789,
    txid: 'txid',
    carColor: '#ff0000',
    trackName: 'Australia',
    dummy: true
  }), {
    owneraddress: 'owner-address',
    outpoint: 'fox-outpoint',
    originoutpoint: 'origin-outpoint',
    foxname: 'Test Fox',
    laptime: '72.345',
    time: '123456789',
    txid: 'txid',
    foxinfolink: 'https://ordfs.network/content/origin-outpoint',
    foximagelink: 'https://alpha.1satordinals.com/outpoint/fox-outpoint/inscription',
    carcolor: '#ff0000',
    trackname: 'Australia',
    dummy: true
  })
})

test('buildPixelRacingLapInscriptionPayload creates the transaction server payload shape', () => {
  assert.deepEqual(buildPixelRacingLapInscriptionPayload({
    identity,
    lapTimeSeconds: 80,
    timestampMs: 987654321,
    carColor: '#00ff00',
    trackName: 'Belgium'
  }), {
    playerowner: 'owner-address',
    playeroutpoint: 'fox-outpoint',
    playeroriginoutpoint: 'origin-outpoint',
    playerfoxname: 'Test Fox',
    laptime: '80',
    time: '987654321',
    carcolor: '#00ff00',
    trackname: 'Belgium'
  })
})

test('buildPixelRacingSharedLapTransactionPayload creates the socket broadcast payload shape', () => {
  assert.deepEqual(buildPixelRacingSharedLapTransactionPayload({
    identity,
    lapTimeSeconds: 91.5,
    timestampMs: 555,
    txid: 'txid',
    trackName: 'Aspen',
    dummy: false
  }), {
    txid: 'txid',
    score: 91.5,
    time: '555',
    foxOutpoint: 'fox-outpoint',
    foxName: 'Test Fox',
    originOutpoint: 'origin-outpoint',
    ownerAddress: 'owner-address',
    trackName: 'Aspen',
    dummy: false
  })
})

test('buildPixelRacingActivityFromTransaction creates shared activity rows from socket data', () => {
  assert.deepEqual(buildPixelRacingActivityFromTransaction({
    txid: 'txid',
    ownerAddress: 'owner',
    foxOutpoint: 'fox-outpoint',
    originOutpoint: 'origin-outpoint',
    foxName: 'Socket Fox',
    score: 101.25,
    time: '999',
    itemType: 'blueberry',
    itemImage: 'image.svg',
    dummy: true
  }, 'San Luis', 123), {
    owneraddress: 'owner',
    outpoint: 'fox-outpoint',
    originoutpoint: 'origin-outpoint',
    foxname: 'Socket Fox',
    laptime: '101.25',
    time: '999',
    txid: 'txid',
    foxinfolink: 'https://ordfs.network/content/origin-outpoint',
    foximagelink: 'https://alpha.1satordinals.com/outpoint/fox-outpoint/inscription',
    trackname: 'San Luis',
    itemType: 'blueberry',
    itemImage: 'image.svg',
    dummy: true
  })
})
