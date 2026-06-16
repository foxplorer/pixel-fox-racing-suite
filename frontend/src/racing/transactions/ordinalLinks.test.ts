import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOrdinalContentUrl,
  getOrdinalInscriptionUrl,
  getWhatsOnChainTransactionUrl,
  ORDINAL_CONTENT_BASE_URL,
  ORDINAL_INSCRIPTION_BASE_URL,
  WHATSONCHAIN_TRANSACTION_BASE_URL
} from './ordinalLinks'

test('getOrdinalContentUrl preserves the ORDFS content URL format', () => {
  assert.equal(ORDINAL_CONTENT_BASE_URL, 'https://ordfs.network/content')
  assert.equal(getOrdinalContentUrl('origin-outpoint'), 'https://ordfs.network/content/origin-outpoint')
})

test('getOrdinalInscriptionUrl preserves the 1Sat inscription image URL format', () => {
  assert.equal(ORDINAL_INSCRIPTION_BASE_URL, 'https://alpha.1satordinals.com/outpoint')
  assert.equal(getOrdinalInscriptionUrl('fox-outpoint'), 'https://alpha.1satordinals.com/outpoint/fox-outpoint/inscription')
})

test('ordinal URL helpers return empty strings for missing outpoints', () => {
  assert.equal(getOrdinalContentUrl(null), '')
  assert.equal(getOrdinalInscriptionUrl(undefined), '')
})

test('ordinal URL helpers canonicalize legacy dot outpoints', () => {
  const txid = '5db53d12a0b8ca7dd36df9b0d1de6fec7522aff59afd6ee6040f7d5548f01601'
  assert.equal(
    getOrdinalInscriptionUrl(`${txid}.0`),
    `https://alpha.1satordinals.com/outpoint/${txid}_0/inscription`
  )
})

test('getWhatsOnChainTransactionUrl preserves the transaction URL format', () => {
  assert.equal(WHATSONCHAIN_TRANSACTION_BASE_URL, 'https://whatsonchain.com/tx')
  assert.equal(getWhatsOnChainTransactionUrl('abc123'), 'https://whatsonchain.com/tx/abc123')
  assert.equal(getWhatsOnChainTransactionUrl(''), '')
})
