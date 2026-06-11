import assert from 'node:assert/strict'
import test from 'node:test'
import { createTrackElevationProvider } from './trackElevationProvider'

test('createTrackElevationProvider creates flat providers for current flat tracks', () => {
  const provider = createTrackElevationProvider('san-luis')
  const sample = provider.sample(10, 20)

  assert.equal(sample.height, 0)
  assert.equal(sample.normal.y, 1)
  assert.equal(sample.source, 'flat')
})

test('createTrackElevationProvider can include road clearance separately', () => {
  assert.throws(() => createTrackElevationProvider('australia'), /external terrain height provider/)
  assert.throws(() => createTrackElevationProvider('belgium'), /external terrain height provider/)

  const provider = createTrackElevationProvider('australia', {
    getHeight: () => 4,
    includeRoadClearance: true
  })

  const sample = provider.sample(0, 0)
  assert.equal(sample.height, 4.1)
  assert.equal(sample.source, 'authored')
})

test('createTrackElevationProvider samples authored custom track terrain', () => {
  const provider = createTrackElevationProvider('belgium', {
    getHeight: () => 6
  })

  const sample = provider.sample(0, 0)
  assert.equal(sample.height, 6)
  assert.equal(sample.source, 'authored')
})

test('createTrackElevationProvider requires an injected height function for terrain-system tracks', () => {
  assert.throws(() => createTrackElevationProvider('aspen'), /external terrain height provider/)

  const provider = createTrackElevationProvider('aspen', {
    getHeight: (x, z) => x + z
  })

  const sample = provider.sample(2, 3)
  assert.equal(sample.height, 5)
  assert.equal(sample.source, 'procedural')
  assert.equal(sample.normal.y < 1, true)
})
