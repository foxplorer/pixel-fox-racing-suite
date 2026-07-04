import assert from 'node:assert/strict'
import test from 'node:test'
import { nextUtcHourMs } from './scheduledRaceLifecycle.js'
import { MemoryScheduledRaceStore } from './scheduledRaceStore.js'
import { ScheduledRaceError } from './scheduledRaceTypes.js'

const baseNowMs = Date.parse('2026-06-29T12:12:00.000Z')

const signupInput = (index: number) => ({
  identityKey: `identity-${index}`,
  ownerAddress: `1RaceAddress${index}`,
  foxOutpoint: `${String(index).padStart(64, '0')}_0`,
  foxOriginOutpoint: `${String(index).padStart(64, '1')}_0`,
  foxName: `Fox ${index}`,
  carColor: index % 2 === 0 ? '#4ECDC4' : '#FF6B6B',
})

test('listUpcoming generates the next hourly races for a selected track', async () => {
  const store = new MemoryScheduledRaceStore()
  const races = await store.listUpcoming({
    trackName: 'Australia',
    limit: 3,
    nowMs: baseNowMs,
  })

  assert.equal(races.length, 3)
  assert.deepEqual(races.map(race => race.trackName), ['Australia', 'Australia', 'Australia'])
  assert.deepEqual(races.map(race => race.startsAt), [
    '2026-06-29T13:00:00.000Z',
    '2026-06-29T14:00:00.000Z',
    '2026-06-29T15:00:00.000Z',
  ])
  assert.equal(races[0].maxEntrants, 6)
  assert.equal(races[0].lapsRequired, 3)
  assert.equal(races[0].openSlots, 6)
})

test('listUpcoming rotates car tracks by hour when no track is selected', async () => {
  const store = new MemoryScheduledRaceStore()
  const races = await store.listUpcoming({
    limit: 4,
    nowMs: baseNowMs,
  })

  assert.equal(races.length, 4)
  assert.deepEqual(races.map(race => race.startsAt), [
    '2026-06-29T13:00:00.000Z',
    '2026-06-29T14:00:00.000Z',
    '2026-06-29T15:00:00.000Z',
    '2026-06-29T16:00:00.000Z',
  ])
  assert.deepEqual(new Set(races.map(race => race.trackName)).size, 4)
})

test('listUpcoming supports a short local testing interval', async () => {
  const store = new MemoryScheduledRaceStore(5 * 60 * 1000)
  const races = await store.listUpcoming({
    limit: 4,
    nowMs: Date.parse('2026-06-29T12:12:00.000Z'),
  })

  assert.equal(races.length, 4)
  assert.deepEqual(races.map(race => race.startsAt), [
    '2026-06-29T12:15:00.000Z',
    '2026-06-29T12:20:00.000Z',
    '2026-06-29T12:25:00.000Z',
    '2026-06-29T12:30:00.000Z',
  ])
  assert.deepEqual(new Set(races.map(race => race.trackName)).size, 4)
})

test('listUpcoming skips cancelled races and fills from later starts', async () => {
  const store = new MemoryScheduledRaceStore()
  const races = await store.listUpcoming({
    limit: 3,
    nowMs: Date.parse('2026-06-29T12:59:30.000Z'),
  })

  assert.equal(races.length, 3)
  assert.deepEqual(races.map(race => race.startsAt), [
    '2026-06-29T14:00:00.000Z',
    '2026-06-29T15:00:00.000Z',
    '2026-06-29T16:00:00.000Z',
  ])
  assert.ok(races.every(race => race.status !== 'cancelled'))
})

test('signUp requires wallet and fox fields', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'Belgium', nowMs: baseNowMs })

  await assert.rejects(
    () => store.signUp(race.id, { ...signupInput(1), ownerAddress: '' }, baseNowMs),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'missing_field'
  )
})

test('signUp assigns stable grid slots and caps a race at six active entrants', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs: baseNowMs })

  let updated = race
  for (let index = 1; index <= 6; index++) {
    updated = await store.signUp(race.id, signupInput(index), baseNowMs + index)
  }

  assert.equal(updated.signupCount, 6)
  assert.equal(updated.openSlots, 0)
  assert.deepEqual(updated.roster.map(signup => signup.gridSlot), [1, 2, 3, 4, 5, 6])

  await assert.rejects(
    () => store.signUp(race.id, signupInput(7), baseNowMs + 7),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'race_full'
  )
})

test('signUp rejects multiple active foxes from the same owner address', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs: baseNowMs })
  const first = signupInput(1)
  const second = {
    ...signupInput(2),
    ownerAddress: first.ownerAddress,
  }

  await store.signUp(race.id, first, baseNowMs)

  await assert.rejects(
    () => store.signUp(race.id, second, baseNowMs + 1),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'owner_already_signed_up'
  )
})

test('signUp rejects active fox overwrite from another owner address', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs: baseNowMs })
  const first = signupInput(1)
  const impostor = {
    ...signupInput(9),
    foxOutpoint: first.foxOutpoint,
    foxOriginOutpoint: first.foxOriginOutpoint,
    foxName: first.foxName,
  }

  await store.signUp(race.id, first, baseNowMs)

  await assert.rejects(
    () => store.signUp(race.id, impostor, baseNowMs + 1),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'fox_already_signed_up'
  )
})

test('signUp rejects multiple active entries from the same identity key', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs: baseNowMs })
  const first = signupInput(1)
  const second = {
    ...signupInput(2),
    identityKey: first.identityKey,
  }

  await store.signUp(race.id, first, baseNowMs)

  await assert.rejects(
    () => store.signUp(race.id, second, baseNowMs + 1),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'identity_already_signed_up'
  )
})

test('signUp rejects active current fox outpoint reuse', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs: baseNowMs })
  const first = signupInput(1)
  const second = {
    ...signupInput(2),
    foxOutpoint: first.foxOutpoint,
  }

  await store.signUp(race.id, first, baseNowMs)

  await assert.rejects(
    () => store.signUp(race.id, second, baseNowMs + 1),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'fox_already_signed_up'
  )
})

test('withdraw frees the lowest grid slot for a later signup', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'Germany', nowMs: baseNowMs })

  await store.signUp(race.id, signupInput(1), baseNowMs)
  await store.signUp(race.id, signupInput(2), baseNowMs)
  await store.signUp(race.id, signupInput(3), baseNowMs)
  await store.withdraw(race.id, signupInput(2).foxOriginOutpoint, baseNowMs)
  const updated = await store.signUp(race.id, signupInput(4), baseNowMs)

  assert.deepEqual(
    updated.roster.map(signup => [signup.foxName, signup.gridSlot]),
    [['Fox 1', 1], ['Fox 4', 2], ['Fox 3', 3]]
  )
})

test('re-signing a withdrawn entrant uses the next available grid slot', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'Germany', nowMs: baseNowMs })

  await store.signUp(race.id, signupInput(1), baseNowMs)
  await store.signUp(race.id, signupInput(2), baseNowMs)
  await store.withdraw(race.id, signupInput(1).foxOriginOutpoint, baseNowMs)
  await store.signUp(race.id, signupInput(3), baseNowMs)
  const updated = await store.signUp(race.id, signupInput(1), baseNowMs)

  assert.deepEqual(
    updated.roster.map(signup => [signup.foxName, signup.gridSlot]),
    [['Fox 3', 1], ['Fox 2', 2], ['Fox 1', 3]]
  )
})

test('stage only works in the staging window and records staged count', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  const staged = await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)

  assert.equal(staged.status, 'staging')
  assert.equal(staged.stagedCount, 1)
  assert.equal(staged.roster[0].status, 'staged')
  assert.equal(staged.roster[0].stagedGridSlot, 1)
  assert.equal(staged.roster[0].stagedAt, new Date(nowMs).toISOString())
})

test('stage compacts entered racers into front grid slots when earlier signups no-show', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.signUp(race.id, signupInput(3), nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  const updated = await store.stage(race.id, signupInput(3).foxOriginOutpoint, nowMs + 1000)

  const stagedEntrants = updated.roster
    .filter(signup => signup.status === 'staged')
    .map(signup => [signup.foxName, signup.gridSlot, signup.stagedGridSlot])

  assert.deepEqual(stagedEntrants, [
    ['Fox 2', 2, 1],
    ['Fox 3', 3, 2],
  ])
})

test('submitResult only settles early after the last of several staged entrants finishes', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Germany', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  for (let index = 1; index <= 4; index++) {
    await store.signUp(race.id, signupInput(index), nowMs)
    await store.stage(race.id, signupInput(index).foxOriginOutpoint, nowMs)
  }

  for (let index = 1; index <= 3; index++) {
    const partial = await store.submitResult(race.id, {
      entrantId: signupInput(index).foxOriginOutpoint,
      totalTimeMs: 210000 + index * 1000,
      lapTimesMs: [69000, 70000, 71000 + index * 1000],
    }, startsAtMs + 210_000 + index * 1000)
    assert.equal(partial.status, 'racing')
    assert.equal(partial.finalInscription, null)
  }

  const settled = await store.submitResult(race.id, {
    entrantId: signupInput(4).foxOriginOutpoint,
    totalTimeMs: 218000,
    lapTimesMs: [69000, 70000, 79000],
  }, startsAtMs + 218_000)

  assert.equal(settled.status, 'settled')
  assert.ok(settled.finalInscription?.txid)
  assert.deepEqual(settled.results.map(result => result.finishPosition), [1, 2, 3, 4])
  assert.ok(settled.results.every(result => result.status === 'finished'))
})

test('unstage returns a staged entrant to signed_up and frees the staged slot before the start', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.signUp(race.id, signupInput(3), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  const unstaged = await store.unstage(race.id, signupInput(1).foxOriginOutpoint, nowMs + 1000)

  assert.equal(unstaged.stagedCount, 1)
  const first = unstaged.roster.find(signup => signup.entrantId === signupInput(1).foxOriginOutpoint.replace('.', '_'))
  assert.equal(first?.status, 'signed_up')
  assert.equal(first?.stagedGridSlot, null)
  assert.equal(first?.stagedAt, null)

  const restaged = await store.stage(race.id, signupInput(3).foxOriginOutpoint, nowMs + 2000)
  assert.equal(
    restaged.roster.find(signup => signup.entrantId === signupInput(3).foxOriginOutpoint.replace('.', '_'))?.stagedGridSlot,
    1
  )
})

test('unstage is idempotent for entrants that are not staged', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  const unchanged = await store.unstage(race.id, signupInput(1).foxOriginOutpoint, nowMs + 1000)

  assert.equal(unchanged.roster[0].status, 'signed_up')
})

test('unstage rejects once the scheduled start time has arrived', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  await assert.rejects(
    () => store.unstage(race.id, signupInput(1).foxOriginOutpoint, startsAtMs),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'unstage_closed'
  )
})

test('stage rejects before the staging window opens', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs: baseNowMs })
  await store.signUp(race.id, signupInput(1), baseNowMs)

  await assert.rejects(
    () => store.stage(race.id, signupInput(1).foxOriginOutpoint, baseNowMs),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'staging_closed'
  )
})

test('stage rejects once the scheduled start time has arrived', async () => {
  const store = new MemoryScheduledRaceStore()
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs: baseNowMs })
  const startsAtMs = Date.parse(race.startsAt)
  await store.signUp(race.id, signupInput(1), baseNowMs)
  await store.signUp(race.id, signupInput(2), baseNowMs)

  await assert.rejects(
    () => store.stage(race.id, signupInput(1).foxOriginOutpoint, startsAtMs),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'staging_closed'
  )
})

test('listUpcoming hides a race after signup close when fewer than two players signed up', async () => {
  const store = new MemoryScheduledRaceStore()
  const startsAtMs = nextUtcHourMs(baseNowMs)
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs: baseNowMs })
  await store.signUp(race.id, signupInput(1), baseNowMs)

  const races = await store.listUpcoming({
    trackName: 'Australia',
    nowMs: startsAtMs - 60 * 1000,
  })

  assert.equal(races.length, 3)
  assert.ok(races.every(candidate => candidate.id !== race.id))
  assert.ok(races.every(candidate => candidate.status !== 'cancelled'))
})

test('submitResult stores staged entrant result and assigns finish position', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  const updated = await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)

  assert.equal(updated.status, 'racing')
  assert.equal(updated.results.length, 1)
  assert.deepEqual(updated.results[0], {
    raceId: race.id,
    entrantId: signupInput(1).foxOriginOutpoint.replace('.', '_'),
    finishPosition: 1,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
    status: 'finished',
    finishedAt: new Date(startsAtMs + 213_500).toISOString(),
  })
  assert.equal(updated.roster[0].status, 'finished')
})

test('submitResult rejects results before the scheduled start', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 213000,
      lapTimesMs: [70000, 71000, 72000],
    }, nowMs + 10_000),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'race_not_started'
  )
})

test('submitResult rejects laps faster than the 40 second floor', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 173000,
      lapTimesMs: [30000, 71000, 72000],
    }, startsAtMs + 173_500),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'invalid_lap_time'
  )
})

test('submitResult rejects results once the race is cancelled for a short field', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 213000,
      lapTimesMs: [70000, 71000, 72000],
    }, startsAtMs + 213_500),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'race_not_accepting_results'
  )
})

test('submitResult settles the race early when every staged entrant finishes', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.signUp(race.id, signupInput(3), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  const afterFirst = await store.submitResult(race.id, {
    entrantId: signupInput(2).foxOriginOutpoint,
    totalTimeMs: 210000,
    lapTimesMs: [69000, 70000, 71000],
  }, startsAtMs + 210_500)
  assert.equal(afterFirst.status, 'racing')
  assert.equal(afterFirst.finalInscription, null)

  const settled = await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)

  assert.equal(settled.status, 'settled')
  assert.match(settled.finalInscription?.txid || '', /^[0-9a-f]{64}$/)
  assert.deepEqual(settled.results.map(result => [result.status, result.finishPosition]), [
    ['finished', 1],
    ['finished', 2],
  ])
  assert.ok(settled.results.every(result => result.status !== 'dnf'))
  assert.equal(
    settled.roster.find(signup => signup.entrantId === signupInput(3).foxOriginOutpoint.replace('.', '_'))?.status,
    'signed_up'
  )
})

test('submitResult is idempotent for identical duplicate result', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Belgium', nowMs })
  const startsAtMs = Date.parse(race.startsAt)

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)
  const duplicate = await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 214_500)

  assert.equal(duplicate.results.length, 1)
  assert.equal(duplicate.results[0].finishedAt, new Date(startsAtMs + 213_500).toISOString())
})

test('submitResult rejects conflicting duplicate result', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'San Luis', nowMs })

  const startsAtMs = Date.parse(race.startsAt)
  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 214000,
      lapTimesMs: [70000, 71000, 73000],
    }, startsAtMs + 214_500),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'result_conflict'
  )
})

test('submitResult validates staged entrant, lap count, and total time', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Germany', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 213000,
      lapTimesMs: [70000, 71000, 72000],
    }, nowMs + 10_000),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'entrant_not_staged'
  )

  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 141000,
      lapTimesMs: [70000, 71000],
    }, nowMs + 10_000),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'invalid_lap_count'
  )

  await assert.rejects(
    () => store.submitResult(race.id, {
      entrantId: signupInput(1).foxOriginOutpoint,
      totalTimeMs: 213500,
      lapTimesMs: [70000, 71000, 72000],
    }, nowMs + 10_000),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'result_total_mismatch'
  )
})

test('finalizeRace marks unfinished staged entrants dnf and exposes podium order', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  const startsAtMs = Date.parse(race.startsAt)
  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.signUp(race.id, signupInput(3), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(3).foxOriginOutpoint, nowMs)
  await store.submitResult(race.id, {
    entrantId: signupInput(2).foxOriginOutpoint,
    totalTimeMs: 210000,
    lapTimesMs: [69000, 70000, 71000],
  }, startsAtMs + 210_500)
  await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)
  await store.recordLapProgress(race.id, {
    entrantId: signupInput(3).foxOriginOutpoint,
    lapTimesMs: [72000, 73500],
  }, startsAtMs + 214_000)

  const finalized = await store.finalizeRace(race.id, startsAtMs + 220_000)

  assert.equal(finalized.status, 'finalizing')
  assert.deepEqual(finalized.results.map(result => [result.entrantId, result.status, result.finishPosition]), [
    [signupInput(2).foxOriginOutpoint.replace('.', '_'), 'finished', 1],
    [signupInput(1).foxOriginOutpoint.replace('.', '_'), 'finished', 2],
    [signupInput(3).foxOriginOutpoint.replace('.', '_'), 'dnf', null],
  ])
  assert.deepEqual(finalized.podium.map(result => result.entrantId), [
    signupInput(2).foxOriginOutpoint.replace('.', '_'),
    signupInput(1).foxOriginOutpoint.replace('.', '_'),
  ])
  assert.deepEqual(
    finalized.results.find(result => result.entrantId === signupInput(3).foxOriginOutpoint.replace('.', '_'))?.lapTimesMs,
    [72000, 73500]
  )
  assert.equal(finalized.roster.find(signup => signup.entrantId === signupInput(3).foxOriginOutpoint.replace('.', '_'))?.status, 'dnf')
})

test('finalizeRace marks no contest when no staged entrants finish', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)

  const finalized = await store.finalizeRace(race.id, nowMs + 20_000)

  assert.equal(finalized.status, 'no_contest')
  assert.equal(finalized.podium.length, 0)
  assert.deepEqual(finalized.results.map(result => result.status), ['dnf', 'dnf'])
  assert.deepEqual(finalized.roster.map(signup => signup.status), ['dnf', 'dnf'])
})

test('finalizeRace cancels races that never had a two-fox staged field instead of marking no contest', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Germany', nowMs })

  // Lone staged fox: the race can never legitimately produce multiplayer results.
  await store.signUp(race.id, signupInput(1), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)

  const finalized = await store.finalizeRace(race.id, Date.parse(race.startsAt) + 16 * 60 * 1000)

  assert.equal(finalized.status, 'cancelled')
  assert.equal(finalized.finalInscription, null)
  assert.equal(finalized.results.length, 0)
})

test('settleDueRaces cancels untouched empty races without minting a no-contest inscription record', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  const sweepMs = Date.parse(race.startsAt) + 16 * 60 * 1000
  const swept = await store.settleDueRaces(sweepMs)
  const sweptRace = swept.find(candidate => candidate.id === race.id)

  assert.equal(sweptRace?.status, 'cancelled')
  assert.equal(sweptRace?.finalInscription, null)

  const completed = await store.listCompleted({ trackName: 'Volcanoes', limit: 5, nowMs: sweepMs })
  assert.equal(completed.some(candidate => candidate.id === race.id), false, 'cancelled races stay out of completed listings')

  // Idempotent: the next sweep leaves the cancelled race alone.
  const secondSweep = await store.settleDueRaces(sweepMs + 15_000)
  assert.equal(secondSweep.some(candidate => candidate.id === race.id), false)
})

test('listCompleted returns finalized race results for stats', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Belgium', nowMs })

  const startsAtMs = Date.parse(race.startsAt)
  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)
  await store.finalizeRace(race.id, startsAtMs + 220_000)

  const completed = await store.listCompleted({
    trackName: 'Belgium',
    limit: 3,
    nowMs: startsAtMs + 220_000,
  })

  assert.equal(completed.length, 1)
  assert.equal(completed[0].id, race.id)
  assert.equal(completed[0].results.length, 2)
  assert.deepEqual(completed[0].podium.map(result => result.finishPosition), [1])
})

test('createFinalInscription creates deterministic dummy multiplayer race inscription and is idempotent', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Volcanoes', nowMs })

  const startsAtMs = Date.parse(race.startsAt)
  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.signUp(race.id, signupInput(3), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(3).foxOriginOutpoint, nowMs)
  await store.submitResult(race.id, {
    entrantId: signupInput(2).foxOriginOutpoint,
    totalTimeMs: 210000,
    lapTimesMs: [69000, 70000, 71000],
  }, startsAtMs + 210_500)
  await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, startsAtMs + 213_500)
  await store.finalizeRace(race.id, startsAtMs + 220_000)

  const settled = await store.createFinalInscription(race.id, startsAtMs + 230_000)
  const duplicate = await store.createFinalInscription(race.id, startsAtMs + 240_000)

  assert.equal(settled.status, 'settled')
  assert.equal(settled.finalInscription?.status, 'broadcasted')
  assert.equal(settled.finalInscription?.dummy, true)
  assert.equal(settled.finalInscription?.inscriptionName, 'multiplayer race')
  assert.equal(settled.finalInscription?.outputIndex, 0)
  assert.match(settled.finalInscription?.txid || '', /^[0-9a-f]{64}$/)
  assert.equal(settled.finalInscription?.finalInscriptionPayload.inscriptionName, 'multiplayer race')
  assert.equal(settled.finalInscription?.finalInscriptionPayload.outputIndex, 0)
  assert.deepEqual(settled.finalInscription?.finalInscriptionPayload.recipients, [])
  assert.deepEqual(
    (settled.finalInscription?.finalInscriptionPayload.inscriptionPayload as { results: Array<{ entrantId: string; finishPosition: number | null; lapsCompleted: number }> }).results.map(result => [
      result.entrantId,
      result.finishPosition,
      result.lapsCompleted,
    ]),
    [
      [signupInput(2).foxOriginOutpoint.replace('.', '_'), 1, 3],
      [signupInput(1).foxOriginOutpoint.replace('.', '_'), 2, 3],
      [signupInput(3).foxOriginOutpoint.replace('.', '_'), null, 0],
    ]
  )
  assert.deepEqual(
    settled.finalInscription?.finalInscriptionPayload.results.flatMap(result => result.lapTimesMs),
    [69000, 70000, 71000, 70000, 71000, 72000]
  )
  assert.equal(duplicate.finalInscription?.txid, settled.finalInscription?.txid)
  assert.equal(duplicate.finalInscription?.createdAt, settled.finalInscription?.createdAt)
})

test('createFinalInscription records no contest without a final inscription tx', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)
  await store.stage(race.id, signupInput(1).foxOriginOutpoint, nowMs)
  await store.stage(race.id, signupInput(2).foxOriginOutpoint, nowMs)
  await store.finalizeRace(race.id, nowMs + 20_000)

  const settled = await store.createFinalInscription(race.id, nowMs + 30_000)

  assert.equal(settled.status, 'no_contest')
  assert.equal(settled.finalInscription?.status, 'no_contest')
  assert.equal(settled.finalInscription?.dummy, true)
  assert.equal(settled.finalInscription?.inscriptionName, 'multiplayer race')
  assert.equal(settled.finalInscription?.outputIndex, null)
  assert.equal(settled.finalInscription?.txid, null)
  assert.equal(settled.finalInscription?.finalInscriptionPayload.outputIndex, null)
  assert.equal(settled.finalInscription?.finalInscriptionPayload.inscriptionName, 'multiplayer race')
  assert.deepEqual(settled.finalInscription?.finalInscriptionPayload.recipients, [])
})

test('createFinalInscription rejects races before finalization', async () => {
  const store = new MemoryScheduledRaceStore()
  const nowMs = Date.parse('2026-06-29T12:56:00.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Belgium', nowMs })

  await store.signUp(race.id, signupInput(1), nowMs)
  await store.signUp(race.id, signupInput(2), nowMs)

  await assert.rejects(
    () => store.createFinalInscription(race.id, nowMs + 10_000),
    (error: unknown) => error instanceof ScheduledRaceError && error.code === 'race_not_finalized'
  )
})

test('dummy scheduled race path signs up, stages, finishes, finalizes, creates final inscription, and lists completed race', async () => {
  const store = new MemoryScheduledRaceStore(5 * 60 * 1000)
  const nowMs = Date.parse('2026-06-29T12:10:00.000Z')
  const stagingMs = Date.parse('2026-06-29T12:11:00.000Z')
  const finishedMs = Date.parse('2026-06-29T12:15:45.000Z')
  const finalizedMs = Date.parse('2026-06-29T12:16:00.000Z')
  const settledMs = Date.parse('2026-06-29T12:16:10.000Z')
  const [race] = await store.listUpcoming({ trackName: 'Australia', limit: 1, nowMs })

  assert.equal(race.startsAt, '2026-06-29T12:15:00.000Z')

  let updated = await store.signUp(race.id, signupInput(1), nowMs)
  updated = await store.signUp(race.id, signupInput(2), nowMs + 1000)
  updated = await store.stage(race.id, signupInput(1).foxOriginOutpoint, stagingMs)
  updated = await store.stage(race.id, signupInput(2).foxOriginOutpoint, stagingMs + 1000)

  assert.equal(updated.signupCount, 2)
  assert.equal(updated.stagedCount, 2)
  assert.deepEqual(updated.roster.map(signup => [signup.foxName, signup.status, signup.stagedGridSlot]), [
    ['Fox 1', 'staged', 1],
    ['Fox 2', 'staged', 2],
  ])

  await store.submitResult(race.id, {
    entrantId: signupInput(2).foxOriginOutpoint,
    totalTimeMs: 209000,
    lapTimesMs: [69000, 70000, 70000],
  }, finishedMs)
  const afterAllFinished = await store.submitResult(race.id, {
    entrantId: signupInput(1).foxOriginOutpoint,
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  }, finishedMs + 1000)

  assert.equal(afterAllFinished.status, 'settled')
  assert.ok(afterAllFinished.finalInscription?.txid)

  const finalized = await store.finalizeRace(race.id, finalizedMs)
  assert.equal(finalized.status, 'settled')
  assert.deepEqual(finalized.podium.map(result => [result.entrantId, result.finishPosition]), [
    [signupInput(2).foxOriginOutpoint.replace('.', '_'), 1],
    [signupInput(1).foxOriginOutpoint.replace('.', '_'), 2],
  ])

  const settled = await store.createFinalInscription(race.id, settledMs)
  assert.equal(settled.status, 'settled')
  assert.equal(settled.finalInscription?.dummy, true)
  assert.equal(settled.finalInscription?.inscriptionName, 'multiplayer race')
  assert.equal(settled.finalInscription?.outputIndex, 0)
  assert.equal(settled.finalInscription?.finalInscriptionPayload.results.length, 2)
  assert.equal(settled.finalInscription?.finalInscriptionPayload.inscriptionName, 'multiplayer race')
  assert.equal(settled.finalInscription?.finalInscriptionPayload.outputIndex, 0)
  assert.deepEqual(settled.finalInscription?.finalInscriptionPayload.recipients, [])
  assert.deepEqual(
    (settled.finalInscription?.finalInscriptionPayload.inscriptionPayload as { entrants: Array<{ foxName: string }>; results: Array<{ finishPosition: number | null }> }).entrants.map(entrant => entrant.foxName),
    ['Fox 1', 'Fox 2']
  )

  const completed = await store.listCompleted({ trackName: 'Australia', limit: 3, nowMs: settledMs })
  assert.equal(completed.length, 1)
  assert.equal(completed[0].id, race.id)
  assert.equal(completed[0].status, 'settled')
  assert.equal(completed[0].finalInscription?.txid, settled.finalInscription?.txid)
  assert.deepEqual(completed[0].results.map(result => result.lapTimesMs.length), [3, 3])
})
