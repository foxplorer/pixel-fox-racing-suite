import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areRacingRenderStatsFresh,
  formatTriangleCount,
  getRacingRenderStats,
  RENDER_STATS_FRESH_MS,
  reportRacingRenderStats
} from './racingRenderStats'

test('reported render stats are readable and freshness expires', () => {
  reportRacingRenderStats(120, 350000, 1000)

  assert.equal(getRacingRenderStats().drawCalls, 120)
  assert.equal(getRacingRenderStats().triangles, 350000)
  assert.equal(areRacingRenderStatsFresh(1000 + RENDER_STATS_FRESH_MS), true)
  assert.equal(areRacingRenderStatsFresh(1001 + RENDER_STATS_FRESH_MS), false)
})

test('formatTriangleCount compacts large counts', () => {
  assert.equal(formatTriangleCount(0), '0')
  assert.equal(formatTriangleCount(-5), '0')
  assert.equal(formatTriangleCount(842), '842')
  assert.equal(formatTriangleCount(35400), '35k')
  assert.equal(formatTriangleCount(1_260_000), '1.3M')
})
