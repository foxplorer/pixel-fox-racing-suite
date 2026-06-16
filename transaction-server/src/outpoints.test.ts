import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getInvalidRequestOutpointFields,
  isCanonicalOrdinalOutpoint,
} from './outpoints'

const txid = 'a'.repeat(64)

test('accepts only canonical underscore ordinal outpoints', () => {
  assert.equal(isCanonicalOrdinalOutpoint(`${txid}_2`), true)
  assert.equal(isCanonicalOrdinalOutpoint(`${txid}.2`), false)
  assert.equal(isCanonicalOrdinalOutpoint('not-an-outpoint'), false)
})

test('reports invalid game request outpoint fields without changing them', () => {
  const body = {
    playeroutpoint: `${txid}.2`,
    playeroriginoutpoint: `${txid}_238`,
  }
  assert.deepEqual(getInvalidRequestOutpointFields(body), ['playeroutpoint'])
  assert.deepEqual(body, {
    playeroutpoint: `${txid}.2`,
    playeroriginoutpoint: `${txid}_238`,
  })
})
