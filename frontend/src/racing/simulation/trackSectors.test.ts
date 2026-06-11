import assert from 'node:assert/strict'
import test from 'node:test'
import { createEvenTrackSectors, getSectorIndexForTrackT } from './trackSectors'

test('createEvenTrackSectors creates normalized sectors', () => {
  const sectors = createEvenTrackSectors(3)

  assert.deepEqual(sectors, [
    { index: 0, startT: 0, endT: 1 / 3 },
    { index: 1, startT: 1 / 3, endT: 2 / 3 },
    { index: 2, startT: 2 / 3, endT: 1 }
  ])
})

test('getSectorIndexForTrackT normalizes wrapped track positions', () => {
  const sectors = createEvenTrackSectors(3)

  assert.equal(getSectorIndexForTrackT(0.1, sectors), 0)
  assert.equal(getSectorIndexForTrackT(0.5, sectors), 1)
  assert.equal(getSectorIndexForTrackT(0.9, sectors), 2)
  assert.equal(getSectorIndexForTrackT(1.1, sectors), 0)
  assert.equal(getSectorIndexForTrackT(-0.1, sectors), 2)
})

test('createEvenTrackSectors rejects invalid sector counts', () => {
  assert.throws(() => createEvenTrackSectors(0), /positive integer/)
  assert.throws(() => createEvenTrackSectors(1.5), /positive integer/)
})
