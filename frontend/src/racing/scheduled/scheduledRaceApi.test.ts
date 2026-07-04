import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createScheduledRaceFinalInscription,
  fetchCompletedScheduledRaces,
  fetchScheduledRaces,
  finalizeScheduledRace,
  getScheduledRaceEntrantId,
  signUpForScheduledRace,
  stageScheduledRaceEntrant,
  submitScheduledRaceResult,
  withdrawScheduledRaceSignup,
} from './scheduledRaceApi'

test('fetchScheduledRaces requests selected track and limit', async () => {
  let requestedUrl = ''
  const races = await fetchScheduledRaces({
    transactionServerUrl: 'https://tx.example/',
    trackName: 'Australia',
    limit: 2,
    fetcher: async url => {
      requestedUrl = String(url)
      return new Response(JSON.stringify({ races: [] }), { status: 200 })
    },
  })

  assert.deepEqual(races, [])
  assert.equal(requestedUrl, 'https://tx.example/scheduled-races?trackName=Australia&limit=2')
})

test('fetchCompletedScheduledRaces requests completed scheduled races', async () => {
  let requestedUrl = ''
  const races = await fetchCompletedScheduledRaces({
    transactionServerUrl: 'https://tx.example/',
    limit: 12,
    fetcher: async url => {
      requestedUrl = String(url)
      return new Response(JSON.stringify({ races: [] }), { status: 200 })
    },
  })

  assert.deepEqual(races, [])
  assert.equal(requestedUrl, 'https://tx.example/scheduled-races?limit=12&status=completed')
})

test('signUpForScheduledRace posts required identity and fox payload', async () => {
  let requestBody: unknown = null
  const race = await signUpForScheduledRace({
    transactionServerUrl: 'https://tx.example',
    raceId: 'australia-20260629T130000Z',
    signup: {
      identityKey: 'identity',
      ownerAddress: '1Owner',
      foxOutpoint: `${'0'.repeat(64)}_0`,
      foxOriginOutpoint: `${'1'.repeat(64)}_0`,
      foxName: 'Speed Fox',
      carColor: '#4ECDC4',
    },
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'scheduled',
          maxEntrants: 5,
          lapsRequired: 3,
          roster: [],
          signupCount: 0,
          stagedCount: 0,
          openSlots: 5,
          serverTime: '2026-06-29T12:00:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(race.id, 'australia-20260629T130000Z')
  assert.deepEqual(requestBody, {
    identityKey: 'identity',
    ownerAddress: '1Owner',
    foxOutpoint: `${'0'.repeat(64)}_0`,
    foxOriginOutpoint: `${'1'.repeat(64)}_0`,
    foxName: 'Speed Fox',
    carColor: '#4ECDC4',
  })
})

test('getScheduledRaceEntrantId normalizes origin outpoints for roster matching', () => {
  assert.equal(getScheduledRaceEntrantId('abc.0'), 'abc_0')
  assert.equal(getScheduledRaceEntrantId('abc_0'), 'abc_0')
  assert.equal(getScheduledRaceEntrantId(''), null)
})

test('stageScheduledRaceEntrant posts entrant id to stage endpoint', async () => {
  let requestedUrl = ''
  let requestBody: unknown = null
  const race = await stageScheduledRaceEntrant({
    transactionServerUrl: 'https://tx.example',
    raceId: 'australia-20260629T130000Z',
    entrantId: 'origin_0',
    fetcher: async (url, init) => {
      requestedUrl = String(url)
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'staging',
          maxEntrants: 5,
          lapsRequired: 3,
          roster: [],
          signupCount: 1,
          stagedCount: 1,
          openSlots: 4,
          serverTime: '2026-06-29T12:56:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(requestedUrl, 'https://tx.example/scheduled-races/australia-20260629T130000Z/stage')
  assert.deepEqual(requestBody, { entrantId: 'origin_0' })
  assert.equal(race.status, 'staging')
})

test('withdrawScheduledRaceSignup deletes signup with entrant id query', async () => {
  let requestedUrl = ''
  let requestedMethod = ''
  const race = await withdrawScheduledRaceSignup({
    transactionServerUrl: 'https://tx.example/',
    raceId: 'australia-20260629T130000Z',
    entrantId: 'origin_0',
    fetcher: async (url, init) => {
      requestedUrl = String(url)
      requestedMethod = String(init?.method)
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'scheduled',
          maxEntrants: 5,
          lapsRequired: 3,
          roster: [],
          results: [],
          podium: [],
          signupCount: 0,
          stagedCount: 0,
          openSlots: 5,
          serverTime: '2026-06-29T12:56:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(requestedUrl, 'https://tx.example/scheduled-races/australia-20260629T130000Z/signup?entrantId=origin_0')
  assert.equal(requestedMethod, 'DELETE')
  assert.equal(race.id, 'australia-20260629T130000Z')
})

test('submitScheduledRaceResult posts lap result payload', async () => {
  let requestedUrl = ''
  let requestBody: unknown = null
  const race = await submitScheduledRaceResult({
    transactionServerUrl: 'https://tx.example/',
    raceId: 'australia-20260629T130000Z',
    entrantId: 'origin_0',
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
    fetcher: async (url, init) => {
      requestedUrl = String(url)
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'finalizing',
          maxEntrants: 6,
          lapsRequired: 3,
          roster: [],
          results: [],
          podium: [],
          signupCount: 2,
          stagedCount: 1,
          openSlots: 4,
          serverTime: '2026-06-29T13:04:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(requestedUrl, 'https://tx.example/scheduled-races/australia-20260629T130000Z/results')
  assert.deepEqual(requestBody, {
    entrantId: 'origin_0',
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  })
  assert.equal(race.status, 'finalizing')
})

test('finalizeScheduledRace posts finalize action', async () => {
  let requestedUrl = ''
  let method = ''
  const race = await finalizeScheduledRace({
    transactionServerUrl: 'https://tx.example/',
    raceId: 'australia-20260629T130000Z',
    fetcher: async (url, init) => {
      requestedUrl = String(url)
      method = String(init?.method)
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'finalizing',
          maxEntrants: 6,
          lapsRequired: 3,
          roster: [],
          results: [],
          podium: [],
          signupCount: 2,
          stagedCount: 0,
          openSlots: 4,
          serverTime: '2026-06-29T13:05:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(requestedUrl, 'https://tx.example/scheduled-races/australia-20260629T130000Z/finalize')
  assert.equal(method, 'POST')
  assert.equal(race.status, 'finalizing')
})

test('createScheduledRaceFinalInscription posts final inscription action', async () => {
  let requestedUrl = ''
  let method = ''
  const race = await createScheduledRaceFinalInscription({
    transactionServerUrl: 'https://tx.example/',
    raceId: 'australia-20260629T130000Z',
    fetcher: async (url, init) => {
      requestedUrl = String(url)
      method = String(init?.method)
      return new Response(JSON.stringify({
        race: {
          id: 'australia-20260629T130000Z',
          trackName: 'Australia',
          startsAt: '2026-06-29T13:00:00.000Z',
          status: 'settled',
          maxEntrants: 6,
          lapsRequired: 3,
          roster: [],
          results: [],
          podium: [],
          finalInscription: {
            raceId: 'australia-20260629T130000Z',
            txid: 'a'.repeat(64),
            status: 'broadcasted',
            dummy: true,
            inscriptionName: 'multiplayer race',
            outputIndex: 0,
            finalInscriptionPayload: {
              raceId: 'australia-20260629T130000Z',
              trackName: 'Australia',
              startsAt: '2026-06-29T13:00:00.000Z',
              lapsRequired: 3,
              results: [],
              recipients: [],
              inscriptionName: 'multiplayer race',
              outputIndex: 0,
              inscriptionPayload: {
                recordVersion: 1,
                inscriptionName: 'multiplayer race',
                raceId: 'australia-20260629T130000Z',
                trackName: 'Australia',
                startsAt: '2026-06-29T13:00:00.000Z',
                finalizedAt: '2026-06-29T13:05:00.000Z',
                lapsRequired: 3,
                entrants: [],
                results: [],
              },
              finalizedAt: '2026-06-29T13:05:00.000Z',
            },
            createdAt: '2026-06-29T13:05:00.000Z',
            updatedAt: '2026-06-29T13:05:00.000Z',
          },
          signupCount: 2,
          stagedCount: 0,
          openSlots: 4,
          serverTime: '2026-06-29T13:05:00.000Z',
        },
      }), { status: 200 })
    },
  })

  assert.equal(requestedUrl, 'https://tx.example/scheduled-races/australia-20260629T130000Z/final-inscription')
  assert.equal(method, 'POST')
  assert.equal(race.status, 'settled')
  assert.equal(race.finalInscription?.txid, 'a'.repeat(64))
})
