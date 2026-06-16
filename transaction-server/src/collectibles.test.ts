import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMetanetCollectibleDelivery,
  isIdentityKey,
  processCollectibleClaim,
  type CollectibleDelivery,
} from './collectibles'

const identityKey = `02${'a'.repeat(64)}`

test('isIdentityKey accepts compressed secp256k1 public keys', () => {
  assert.equal(isIdentityKey(identityKey), true)
  assert.equal(isIdentityKey(`04${'a'.repeat(128)}`), false)
  assert.equal(isIdentityKey('owner-address'), false)
})

test('dummy collectible claims use the explicit delivery-target request contract', async () => {
  const result = await processCollectibleClaim(
    'blueberries',
    { identityKey, deliveryTarget: { type: 'counterparty', identityKey } },
    {
      mode: 'dummy',
      makeDummyTxid: () => 'dummy-txid',
    }
  )

  assert.deepEqual(result, {
    status: 200,
    body: {
      txid: 'dummy-txid',
      time: result.body.time,
      type: 'blueberries',
      dummy: true,
      deliveryMode: 'dummy',
      recipientIdentityKey: identityKey,
    },
  })
})

test('explicit counterparty targets select identity delivery', async () => {
  const calls: string[] = []
  const submitted: string[] = []
  const identityDelivery: CollectibleDelivery = async () => {
    calls.push('identity')
    return {
      txid: 'identity-txid',
      time: 123,
      deliveryMode: 'identity',
      outputIndex: 2,
      outpoint: 'identity-txid_2',
      atomicBEEF: [1, 2, 3],
      senderIdentityKey: `03${'b'.repeat(64)}`,
    }
  }
  const addressDelivery: CollectibleDelivery = async () => {
    calls.push('address')
    throw new Error('address delivery should not run')
  }

  const result = await processCollectibleClaim(
    'rabbit',
    {
      identityKey,
      deliveryTarget: { type: 'counterparty', identityKey },
    },
    {
      mode: 'real',
      makeDummyTxid: () => 'unused',
      identityDelivery,
      addressDelivery,
      async submitTxid(txid) {
        submitted.push(txid)
      },
    }
  )

  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, ['identity'])
  assert.deepEqual(submitted, ['identity-txid'])
  assert.equal(result.body.deliveryMode, 'identity')
  assert.equal(result.body.outputIndex, 2)
  assert.deepEqual(result.body.atomicBEEF, [1, 2, 3])
})

test('explicit address targets select address delivery', async () => {
  const addressDelivery: CollectibleDelivery = async request => {
    assert.deepEqual(request.deliveryTarget, {
      type: 'address',
      address: '1ordinal-address',
    })
    return {
      txid: 'address-txid',
      time: 456,
      deliveryMode: 'address',
    }
  }

  const result = await processCollectibleClaim(
    'salad',
    {
      identityKey,
      deliveryTarget: { type: 'address', address: ' 1ordinal-address ' },
    },
    {
      mode: 'real',
      makeDummyTxid: () => 'unused',
      addressDelivery,
    }
  )

  assert.equal(result.status, 200)
  assert.equal(result.body.deliveryMode, 'address')
})

test('explicit protocol-key targets select protocol delivery', async () => {
  const calls: string[] = []
  const metanetDelivery: CollectibleDelivery = async request => {
    calls.push('metanet')
    assert.equal(
      request.deliveryTarget.type === 'protocol-key'
        ? request.deliveryTarget.publicKey
        : undefined,
      identityKey,
    )
    return {
      txid: 'metanet-txid',
      time: 789,
      deliveryMode: 'metanet',
      outputIndex: 0,
      atomicBEEF: [1, 2, 3],
      remittance: {
        protocolID: [0, 'pixel foxes'],
        keyID: '1',
        counterparty: 'anyone',
        basket: 'pixel foxes',
        tags: ['origin'],
      },
    }
  }

  const result = await processCollectibleClaim(
    'rabbit',
    {
      identityKey,
      deliveryTarget: {
        type: 'protocol-key',
        publicKey: identityKey,
        protocolID: [0, 'pixel foxes'],
        keyID: '1',
        counterparty: 'anyone',
        basket: 'pixel foxes',
      },
    },
    {
      mode: 'real',
      makeDummyTxid: () => 'unused',
      metanetDelivery,
      identityDelivery: async () => {
        calls.push('identity')
        throw new Error('identity delivery should not run')
      },
    }
  )

  assert.deepEqual(calls, ['metanet'])
  assert.equal(result.body.deliveryMode, 'metanet')
  assert.equal(result.body.remittance?.basket, 'pixel foxes')
})

test('Metanet delivery pays the supplied protocol public key', async () => {
  let destinationAddress = ''
  const delivery = createMetanetCollectibleDelivery(
    'pixelfoxracing',
    async request => {
      destinationAddress = request.destinationAddress
      return { txid: 'txid', outputIndex: 0, atomicBEEF: [1, 2, 3] }
    },
    name => name === 'BLUEBERRIES_COLLECTION_ID' ? 'collection_0' : undefined
  )

  const result = await delivery({
    kind: 'blueberries',
    identityKey,
    deliveryTarget: {
      type: 'protocol-key',
      publicKey: identityKey,
      protocolID: [0, 'pixel foxes'],
      keyID: '1',
      counterparty: 'anyone',
      basket: 'pixel foxes',
    },
  })

  assert.ok(destinationAddress.length > 20)
  assert.equal(result.deliveryMode, 'metanet')
  assert.equal(result.remittance?.basket, 'pixel foxes')
})

test('claims without an explicit delivery target fail clearly', async () => {
  const result = await processCollectibleClaim('salad', { identityKey }, {
    mode: 'real',
    makeDummyTxid: () => 'unused',
  })

  assert.deepEqual(result, {
    status: 400,
    body: {
      error: 'invalid_delivery_target',
      message: 'An explicit collectible deliveryTarget is required and must be supported',
    },
  })
})

test('real explicit counterparty claims fail clearly until server delivery is configured', async () => {
  const result = await processCollectibleClaim(
    'salad',
    { identityKey, deliveryTarget: { type: 'counterparty', identityKey } },
    {
      mode: 'real',
      makeDummyTxid: () => 'unused',
    }
  )

  assert.deepEqual(result, {
    status: 501,
    body: {
      error: 'identity_delivery_not_configured',
      message: 'The counterparty collectible delivery path is not configured',
    },
  })
})
