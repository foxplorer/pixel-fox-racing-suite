import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PLAYER_COLOR, getPlayerColorByIndex, PLAYER_COLORS } from './playerColors'

test('PLAYER_COLORS preserves the existing palette order', () => {
  assert.deepEqual([...PLAYER_COLORS], [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F'
  ])
})

test('DEFAULT_PLAYER_COLOR is the first palette color', () => {
  assert.equal(DEFAULT_PLAYER_COLOR, '#FF6B6B')
})

test('getPlayerColorByIndex wraps positive and negative indexes', () => {
  assert.equal(getPlayerColorByIndex(0), '#FF6B6B')
  assert.equal(getPlayerColorByIndex(6), '#FF6B6B')
  assert.equal(getPlayerColorByIndex(-1), '#F7DC6F')
})
