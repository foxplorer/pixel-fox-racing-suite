import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCollectibleActivityResult,
  buildCollectibleTransactionRequest,
  buildSharedCollectibleTransactionPayload,
  getCollectibleImageUrl,
  getCollectibleScore,
  getCollectibleScoreText,
  getCollectibleTransactionEndpoint,
  submitCollectibleTransaction
} from './collectibleItem'

test('getCollectibleTransactionEndpoint preserves collectible transaction routes', () => {
  assert.equal(getCollectibleTransactionEndpoint('blueberry'), '/createblueberries')
  assert.equal(getCollectibleTransactionEndpoint('salad'), '/createsalad')
  assert.equal(getCollectibleTransactionEndpoint('rabbit'), '/createrabbit')
})

test('getCollectibleScore preserves collectible scoring', () => {
  assert.equal(getCollectibleScore('blueberry'), 10)
  assert.equal(getCollectibleScore('salad'), 20)
  assert.equal(getCollectibleScore('rabbit'), 50)
})

test('getCollectibleScoreText preserves score strings used in activity payloads', () => {
  assert.equal(getCollectibleScoreText('blueberry'), '10')
  assert.equal(getCollectibleScoreText('salad'), '20')
  assert.equal(getCollectibleScoreText('rabbit'), '50')
})

test('getCollectibleImageUrl selects the matching item image URL', () => {
  const imageUrls = {
    blueberry: 'blueberry.svg',
    salad: 'salad.svg',
    rabbit: 'rabbit.svg'
  }

  assert.equal(getCollectibleImageUrl('blueberry', imageUrls), 'blueberry.svg')
  assert.equal(getCollectibleImageUrl('salad', imageUrls), 'salad.svg')
  assert.equal(getCollectibleImageUrl('rabbit', imageUrls), 'rabbit.svg')
})

test('buildCollectibleTransactionRequest preserves POST request construction', () => {
  assert.deepEqual(
    buildCollectibleTransactionRequest('http://localhost:9000', 'blueberry', 'owner'),
    {
      url: 'http://localhost:9000/createblueberries',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'owner' })
      }
    }
  )
})

test('submitCollectibleTransaction posts the collectible request and returns response JSON', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const result = await submitCollectibleTransaction(
    'http://localhost:9000',
    'rabbit',
    'owner',
    async (url, init) => {
      calls.push({ url, init })
      return {
        async json() {
          return { txid: 'txid', dummy: true }
        }
      }
    }
  )

  assert.deepEqual(calls, [
    {
      url: 'http://localhost:9000/createrabbit',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'owner' })
      }
    }
  ])
  assert.deepEqual(result, { txid: 'txid', dummy: true })
})

test('buildCollectibleActivityResult preserves item activity payload shape', () => {
  assert.deepEqual(
    buildCollectibleActivityResult({
      identity: {
        ownerAddress: 'owner',
        outpoint: 'fox-outpoint',
        originOutpoint: 'origin-outpoint',
        foxName: 'Fox'
      },
      itemType: 'rabbit',
      itemImage: 'rabbit.svg',
      timestampMs: 1234,
      txid: 'txid',
      trackName: 'Australia',
      dummy: true
    }),
    {
      owneraddress: 'owner',
      outpoint: 'fox-outpoint',
      originoutpoint: 'origin-outpoint',
      foxname: 'Fox',
      laptime: '50',
      time: '1234',
      txid: 'txid',
      foxinfolink: 'https://ordfs.network/content/origin-outpoint',
      foximagelink: 'https://alpha.1satordinals.com/outpoint/fox-outpoint/inscription',
      itemType: 'rabbit',
      itemImage: 'rabbit.svg',
      trackname: 'Australia',
      dummy: true
    }
  )
})

test('buildSharedCollectibleTransactionPayload preserves socket share payload shape', () => {
  assert.deepEqual(
    buildSharedCollectibleTransactionPayload({
      identity: {
        ownerAddress: 'owner',
        outpoint: 'fox-outpoint',
        originOutpoint: 'origin-outpoint',
        foxName: 'Fox'
      },
      itemType: 'salad',
      itemImage: 'salad.svg',
      timestampMs: 1234,
      txid: 'txid',
      trackName: 'Belgium',
      dummy: false
    }),
    {
      txid: 'txid',
      itemType: 'salad',
      itemImage: 'salad.svg',
      score: 20,
      trackName: 'Belgium',
      time: '1234',
      foxOutpoint: 'fox-outpoint',
      foxName: 'Fox',
      originOutpoint: 'origin-outpoint',
      ownerAddress: 'owner',
      dummy: false
    }
  )
})
