import assert from 'node:assert/strict'
import test from 'node:test'
import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import { createIdentityCollectibleDelivery } from './identityCollectibleDelivery'

const recipientIdentityKey = `02${'a'.repeat(64)}`
const senderIdentityKey = `03${'b'.repeat(64)}`

test('identity collectible delivery returns recipient internalization material', async () => {
  const destinationKey = PrivateKey.fromRandom().toPublicKey()
  const delivery = createIdentityCollectibleDelivery({
    chain: 'test',
    services: {} as never,
    async getPublicKey(args) {
      assert.deepEqual(args.protocolID, [0, 'p 1sat'])
      assert.equal(args.keyID, 'inscribe-test')
      assert.equal(args.counterparty, recipientIdentityKey)
      return { publicKey: destinationKey.toString() }
    },
    senderIdentityKey,
    inscriptionApp: 'pixelfoxracing',
    getEnv: name => name === 'BLUEBERRIES_COLLECTION_ID' ? 'collection_0' : undefined,
    makeKeyID: () => 'inscribe-test',
    async buildTransaction(request) {
      assert.equal(request.serverInstance, 'blueberries-server')
      assert.equal(request.destinationAddress, destinationKey.toAddress())
      assert.equal(request.contentType, 'image/svg+xml')
      assert.equal(request.map.subType, 'collectionItem')
      return { txid: 'txid', outputIndex: 0, atomicBEEF: [1, 2, 3] }
    },
  })

  const result = await delivery({
    kind: 'blueberries',
    identityKey: recipientIdentityKey,
    deliveryTarget: {
      type: 'counterparty',
      identityKey: recipientIdentityKey,
    },
  })

  assert.equal(result.deliveryMode, 'identity')
  assert.equal(result.outputIndex, 0)
  assert.equal(result.outpoint, 'txid_0')
  assert.deepEqual(result.atomicBEEF, [1, 2, 3])
  assert.deepEqual(result.remittance, {
    protocolID: [0, 'p 1sat'],
    keyID: 'inscribe-test',
    counterparty: senderIdentityKey,
    basket: 'p 1sat ordinals',
    tags: [
      'type:image/svg+xml',
      'origin',
      'name:blueberries',
      'collectionId:collection_0',
    ],
  })
})

test('stateless counterparties derive the same recipient key', async () => {
  const senderKey = PrivateKey.fromRandom()
  const recipientKey = PrivateKey.fromRandom()
  const sender = new ProtoWallet(senderKey)
  const recipient = new ProtoWallet(recipientKey)
  const protocolID: [0, string] = [0, 'p 1sat']
  const keyID = 'inscribe-test'

  const sent = await sender.getPublicKey({
    protocolID,
    keyID,
    counterparty: recipientKey.toPublicKey().toString(),
  })
  const received = await recipient.getPublicKey({
    protocolID,
    keyID,
    counterparty: senderKey.toPublicKey().toString(),
    forSelf: true,
  })

  assert.equal(sent.publicKey, received.publicKey)
})
