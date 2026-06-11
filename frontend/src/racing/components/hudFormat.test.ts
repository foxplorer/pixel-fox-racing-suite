import assert from 'node:assert/strict'
import test from 'node:test'
import { formatLapTime, shortenTxid } from './hudFormat'

test('formatLapTime formats seconds as MM:SS.mmm', () => {
  assert.equal(formatLapTime(0), '00:00.000')
  assert.equal(formatLapTime(7.123), '00:07.123')
  assert.equal(formatLapTime(65.009), '01:05.009')
  assert.equal(formatLapTime(3599.5), '59:59.500')
})

test('formatLapTime preserves existing floor behavior for milliseconds', () => {
  assert.equal(formatLapTime(12.9999), '00:12.999')
})

test('shortenTxid preserves short ids and shortens long ids', () => {
  assert.equal(shortenTxid('1234567890abcdef'), '1234567890abcdef')
  assert.equal(shortenTxid('1234567890abcdef1234567890abcdef'), '12345678...90abcdef')
})
