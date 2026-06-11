import assert from 'node:assert/strict'
import test from 'node:test'
import { getCountdownColor } from './RacingCountdownDisplay'

test('getCountdownColor preserves countdown urgency colors', () => {
  assert.equal(getCountdownColor(3), '#4ECDC4')
  assert.equal(getCountdownColor(2), '#F7DC6F')
  assert.equal(getCountdownColor(1), '#ff6b6b')
  assert.equal(getCountdownColor(0), '#4ECDC4')
})
