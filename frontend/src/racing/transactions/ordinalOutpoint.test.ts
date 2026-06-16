import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOutpointTxid,
  normalizeOrdinalOutpoint,
} from './ordinalOutpoint'

const txid = 'a'.repeat(64)

test('normalizes legacy dot ordinal outpoints to underscore form', () => {
  assert.equal(normalizeOrdinalOutpoint(`${txid}.238`), `${txid}_238`)
  assert.equal(normalizeOrdinalOutpoint(`${txid}_238`), `${txid}_238`)
  assert.equal(normalizeOrdinalOutpoint('display.name'), 'display.name')
})

test('extracts a txid after normalizing an ordinal outpoint', () => {
  assert.equal(getOutpointTxid(`${txid}.2`), txid)
  assert.equal(getOutpointTxid(`${txid}_2`), txid)
  assert.equal(getOutpointTxid('invalid'), null)
})
