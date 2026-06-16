import assert from 'node:assert/strict'
import test from 'node:test'
import type { WalletInterface } from '@bsv/sdk'
import {
  prepareCollectibleDeliveryTarget,
} from './deliveryTarget'
import {
  METANET_WALLET_PROVIDER,
  YOURS_WALLET_PROVIDER,
} from './walletProviders'

const identityKey = `02${'a'.repeat(64)}`

test('prepares an ordinal-address target for casual Yours collectibles', async () => {
  let getPublicKeyCalled = false
  const wallet = {
    async getPublicKey() {
      getPublicKeyCalled = true
      return { publicKey: identityKey }
    },
  } as unknown as WalletInterface

  const target = await prepareCollectibleDeliveryTarget(
    wallet,
    YOURS_WALLET_PROVIDER,
    identityKey,
    '1ordinal-address',
  )

  assert.deepEqual(target, { type: 'address', address: '1ordinal-address' })
  assert.equal(getPublicKeyCalled, false)
})

test('rejects Yours delivery without an ordinal deposit address', async () => {
  const wallet = {} as WalletInterface

  await assert.rejects(
    prepareCollectibleDeliveryTarget(
      wallet,
      YOURS_WALLET_PROVIDER,
      identityKey,
    ),
    /requires an ordinal deposit address/,
  )
})

test('prepares a complete protocol-key target for Metanet', async () => {
  let receivedArgs: unknown
  const publicKey = `03${'b'.repeat(64)}`
  const wallet = {
    async getPublicKey(args: unknown) {
      receivedArgs = args
      return { publicKey }
    },
  } as unknown as WalletInterface

  const target = await prepareCollectibleDeliveryTarget(
    wallet,
    METANET_WALLET_PROVIDER,
    identityKey,
    null,
  )

  assert.deepEqual(receivedArgs, {
    protocolID: [0, 'pixel foxes'],
    keyID: '1',
    counterparty: 'anyone',
    forSelf: true,
  })
  assert.deepEqual(target, {
    type: 'protocol-key',
    publicKey,
    protocolID: [0, 'pixel foxes'],
    keyID: '1',
    counterparty: 'anyone',
    basket: 'pixel foxes',
  })
})
