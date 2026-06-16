import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCollectibleActivityResult,
  buildMetanetCollectibleInternalizeAction,
  buildCollectibleTransactionRequest,
  buildSharedCollectibleTransactionPayload,
  getCollectibleImageUrl,
  getCollectibleScore,
  getCollectibleScoreText,
  getCollectibleTransactionEndpoint,
  internalizeMetanetCollectibleDeliveryWithRetry,
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
    buildCollectibleTransactionRequest(
      'http://localhost:9000',
      'blueberry',
      '02identity',
      { type: 'address', address: 'owner' }
    ),
    {
      url: 'http://localhost:9000/createblueberries',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityKey: '02identity',
          deliveryTarget: { type: 'address', address: 'owner' }
        })
      }
    }
  )
})

test('buildCollectibleTransactionRequest omits the compatibility address when unavailable', () => {
  const request = buildCollectibleTransactionRequest(
    'http://localhost:9000',
    'salad',
    '03identity',
    { type: 'counterparty', identityKey: '03identity' }
  )

  assert.equal(request.init.body, JSON.stringify({
    identityKey: '03identity',
    deliveryTarget: { type: 'counterparty', identityKey: '03identity' }
  }))
})

test('buildCollectibleTransactionRequest includes Metanet delivery material', () => {
  const request = buildCollectibleTransactionRequest(
    'http://localhost:9000',
    'rabbit',
    '03identity',
    {
      type: 'protocol-key',
      publicKey: '02metanet',
      protocolID: [0, 'pixel foxes'],
      keyID: '1',
      counterparty: 'anyone',
      basket: 'pixel foxes'
    }
  )

  assert.equal(request.init.body, JSON.stringify({
    identityKey: '03identity',
    deliveryTarget: {
      type: 'protocol-key',
      publicKey: '02metanet',
      protocolID: [0, 'pixel foxes'],
      keyID: '1',
      counterparty: 'anyone',
      basket: 'pixel foxes'
    }
  }))
})

test('submitCollectibleTransaction posts the collectible request and returns response JSON', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const result = await submitCollectibleTransaction(
    'http://localhost:9000',
    'rabbit',
    '02identity',
    { type: 'address', address: 'owner' },
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
        body: JSON.stringify({
          identityKey: '02identity',
          deliveryTarget: { type: 'address', address: 'owner' }
        })
      }
    }
  ])
  assert.deepEqual(result, { txid: 'txid', dummy: true })
})

test('buildMetanetCollectibleInternalizeAction builds a Metanet pixel foxes basket insertion', () => {
  const action = buildMetanetCollectibleInternalizeAction({
    txid: 'txid',
    deliveryMode: 'metanet',
    atomicBEEF: [1, 2, 3],
    outputIndex: 0,
    remittance: {
      protocolID: [0, 'pixel foxes'],
      keyID: '1',
      counterparty: 'anyone',
      basket: 'pixel foxes',
      tags: ['type:image/svg+xml', 'origin', 'name:blueberries']
    }
  })

  assert.equal(action.outputs?.[0]?.insertionRemittance?.basket, 'pixel foxes')
  assert.equal(
    action.outputs?.[0]?.insertionRemittance?.customInstructions,
    JSON.stringify({
      protocolID: [0, 'pixel foxes'],
      keyID: '1',
      counterparty: 'anyone'
    })
  )
})

test('buildMetanetCollectibleInternalizeAction rejects non-Metanet receipts', () => {
  assert.throws(
    () => buildMetanetCollectibleInternalizeAction({
      txid: 'txid',
      deliveryMode: 'identity'
    }),
    /missing Metanet delivery material/
  )
})

test('internalizeMetanetCollectibleDeliveryWithRetry retries transient wallet rejection', async () => {
  let calls = 0
  const delays: number[] = []
  const retryAttempts: number[] = []
  const wallet = {
    async internalizeAction() {
      calls += 1
      return { accepted: calls >= 3 }
    }
  }

  await internalizeMetanetCollectibleDeliveryWithRetry(
    wallet as never,
    {
      txid: 'txid',
      deliveryMode: 'metanet',
      atomicBEEF: [1, 2, 3],
      outputIndex: 0,
      remittance: {
        protocolID: [0, 'pixel foxes'],
        keyID: '1',
        counterparty: 'anyone',
        basket: 'pixel foxes',
        tags: ['origin']
      }
    },
    {
      initialDelayMs: 10,
      sleep: async delayMs => { delays.push(delayMs) },
      onRetry: attempt => { retryAttempts.push(attempt) }
    }
  )

  assert.equal(calls, 3)
  assert.deepEqual(delays, [10, 20])
  assert.deepEqual(retryAttempts, [1, 2])
})

test('internalizeMetanetCollectibleDeliveryWithRetry gives up after configured attempts', async () => {
  let calls = 0
  const wallet = {
    async internalizeAction() {
      calls += 1
      return { accepted: false }
    }
  }

  await assert.rejects(
    internalizeMetanetCollectibleDeliveryWithRetry(
      wallet as never,
      {
        txid: 'txid',
        deliveryMode: 'metanet',
        atomicBEEF: [1, 2, 3],
        outputIndex: 0,
        remittance: {
          protocolID: [0, 'pixel foxes'],
          keyID: '1',
          counterparty: 'anyone',
          basket: 'pixel foxes',
          tags: ['origin']
        }
      },
      {
        maxAttempts: 3,
        initialDelayMs: 0,
        sleep: async () => {}
      }
    ),
    /Wallet rejected collectible internalization/
  )
  assert.equal(calls, 3)
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
