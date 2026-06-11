import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRoadClearance, createFlatElevationProvider, createFunctionElevationProvider } from './trackElevation'

test('createFlatElevationProvider returns stable flat height and up normal', () => {
  const provider = createFlatElevationProvider(3)
  const sample = provider.sample(10, 20)

  assert.equal(sample.height, 3)
  assert.equal(sample.normal.y, 1)
  assert.equal(sample.roadInfluence, 1)
  assert.equal(sample.source, 'flat')
})

test('createFunctionElevationProvider samples height and approximate normal', () => {
  const provider = createFunctionElevationProvider((x, z) => x * 0.5 + z * 0.25, {
    source: 'sampled'
  })
  const sample = provider.sample(10, 20)

  assert.equal(sample.height, 10)
  assert.equal(sample.source, 'sampled')
  assert.equal(sample.normal.y > 0.85, true)
  assert.equal(sample.normal.x < 0, true)
  assert.equal(sample.normal.z < 0, true)
})

test('applyRoadClearance raises a sampled road height without changing source', () => {
  const provider = createFlatElevationProvider(2, 'authored')
  const raised = applyRoadClearance(provider.sample(0, 0), 0.3)

  assert.equal(raised.height, 2.3)
  assert.equal(raised.source, 'authored')
})
