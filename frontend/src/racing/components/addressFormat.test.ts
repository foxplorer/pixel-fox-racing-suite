import assert from 'node:assert/strict'
import test from 'node:test'
import { formatShortAddress } from './addressFormat'

test('formatShortAddress returns an empty string for missing addresses', () => {
  assert.equal(formatShortAddress(null), '')
  assert.equal(formatShortAddress(undefined), '')
  assert.equal(formatShortAddress(''), '')
})

test('formatShortAddress preserves short addresses', () => {
  assert.equal(formatShortAddress('abcdef123456'), 'abcdef123456')
  assert.equal(formatShortAddress('short'), 'short')
})

test('formatShortAddress shortens long addresses to first and last six characters', () => {
  assert.equal(formatShortAddress('abcdef1234567890'), 'abcdef...567890')
})
