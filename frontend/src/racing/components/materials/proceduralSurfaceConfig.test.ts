import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRacingSurfaceTextureConfig,
  getSurfaceTextureRepeat
} from './proceduralSurfaceConfig'

test('surface config scales texture budget up with quality', () => {
  for (const surface of ['asphalt', 'grass', 'volcanic-rock', 'road-paint-yellow', 'road-paint-white'] as const) {
    const low = getRacingSurfaceTextureConfig(surface, 'low')
    const medium = getRacingSurfaceTextureConfig(surface, 'medium')
    const high = getRacingSurfaceTextureConfig(surface, 'high')

    assert.ok(low.textureSize < medium.textureSize)
    assert.ok(medium.textureSize < high.textureSize)
    assert.ok(low.detailPasses < medium.detailPasses)
    assert.ok(medium.detailPasses < high.detailPasses)
    assert.ok(low.anisotropy <= medium.anisotropy)
    assert.ok(medium.anisotropy <= high.anisotropy)
  }
})

test('procedural surface normals stay disabled to avoid headlight triangle seams', () => {
  for (const surface of ['asphalt', 'grass', 'volcanic-rock', 'road-paint-yellow', 'road-paint-white'] as const) {
    assert.equal(getRacingSurfaceTextureConfig(surface, 'low').normalMap, false)
    assert.equal(getRacingSurfaceTextureConfig(surface, 'medium').normalMap, false)
    assert.equal(getRacingSurfaceTextureConfig(surface, 'high').normalMap, false)
  }
})

test('unknown quality ids fall back to the medium preset', () => {
  const fallback = getRacingSurfaceTextureConfig('asphalt', 'ultra')
  const medium = getRacingSurfaceTextureConfig('asphalt', 'medium')
  assert.equal(fallback.textureSize, medium.textureSize)
  assert.deepEqual(fallback.palette, medium.palette)
})

test('each surface carries its own distinct palette', () => {
  const asphalt = getRacingSurfaceTextureConfig('asphalt', 'high')
  const grass = getRacingSurfaceTextureConfig('grass', 'high')
  const volcanic = getRacingSurfaceTextureConfig('volcanic-rock', 'high')
  const bases = new Set([asphalt.palette.base, grass.palette.base, volcanic.palette.base])
  assert.equal(bases.size, 3)
})

test('texture repeat tiles a span without going below one and guards bad input', () => {
  assert.equal(getSurfaceTextureRepeat(120, 12), 10)
  assert.equal(getSurfaceTextureRepeat(4, 12), 1)
  assert.equal(getSurfaceTextureRepeat(120, 0), 1)
  assert.equal(getSurfaceTextureRepeat(Number.NaN, 12), 1)
})
