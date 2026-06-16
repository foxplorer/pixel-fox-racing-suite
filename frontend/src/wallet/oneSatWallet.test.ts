import assert from 'node:assert/strict'
import test from 'node:test'
import type { OrdfsMetadata } from '@1sat/types'
import { PrivateKey, type WalletInterface, type WalletOutput } from '@bsv/sdk'
import {
  derivePixelRacingAddresses,
  isMetanetWalletTransport,
  normalizeMetanetPixelFox,
  normalizePixelRacingOrdinal,
  verifyMetanetPixelFoxAccess,
} from './oneSatWallet'

test('derives Yours payment and ordinal receive addresses through BRC-100 actions context', async () => {
  const identityKey = PrivateKey.fromRandom().toPublicKey().toString()
  const paymentKey = PrivateKey.fromRandom().toPublicKey().toString()
  const ordinalKey = PrivateKey.fromRandom().toPublicKey().toString()
  const calls: unknown[] = []
  const wallet = {
    async getPublicKey(args: unknown) {
      calls.push(args)
      if ((args as { identityKey?: boolean }).identityKey) {
        return { publicKey: identityKey }
      }
      if ((args as { keyID?: string }).keyID === '1sat 0') {
        return { publicKey: paymentKey }
      }
      if ((args as { keyID?: string }).keyID === '1sat 1') {
        return { publicKey: ordinalKey }
      }
      throw new Error('unexpected public key request')
    },
  } as unknown as WalletInterface

  const addresses = await derivePixelRacingAddresses(wallet)

  assert.deepEqual(calls, [
    { identityKey: true },
    { protocolID: [0, 'p 1sat'], keyID: '1sat 0', forSelf: true },
    { protocolID: [0, 'p 1sat'], keyID: '1sat 1', forSelf: true },
  ])
  assert.equal(typeof addresses.bsvAddress, 'string')
  assert.equal(typeof addresses.ordAddress, 'string')
  assert.notEqual(addresses.bsvAddress, '')
  assert.notEqual(addresses.ordAddress, '')
  assert.notEqual(addresses.bsvAddress, addresses.ordAddress)
})

test('rejects Yours address derivation when the BRC-100 identity key is unavailable', async () => {
  const wallet = {} as WalletInterface

  await assert.rejects(
    derivePixelRacingAddresses(wallet),
  )
})

test('normalizes ORDFS collection metadata into the existing fox shape', () => {
  const output = {
    outpoint: 'current_0',
    satoshis: 1,
    spendable: true,
    tags: ['type:image/png', 'origin:origin_0', 'name:Pixel Fox'],
  } satisfies WalletOutput
  const metadata = {
    outpoint: 'current_0',
    origin: 'origin_0',
    sequence: 2,
    contentType: 'image/png',
    contentLength: 100,
    map: {
      name: 'Pixel Fox',
      subTypeData: JSON.stringify({
        collectionId: 'fox_collection_0',
        traits: [{ trait_type: 'Background', value: 'Blue' }],
      }),
    },
  } satisfies OrdfsMetadata

  const ordinal = normalizePixelRacingOrdinal(output, metadata, 'owner-address')

  assert.equal(ordinal.origin.outpoint, 'origin_0')
  assert.equal(ordinal.owner, 'owner-address')
  assert.equal(
    (ordinal.origin.data.map.subTypeData as Record<string, unknown>).collectionId,
    'fox_collection_0',
  )
})

test('uses wallet tags when metadata is incomplete', () => {
  const output = {
    outpoint: 'origin_0',
    satoshis: 1,
    spendable: true,
    tags: ['origin', 'name:Tagged Fox', 'collectionId:tagged_collection_0'],
  } satisfies WalletOutput

  const ordinal = normalizePixelRacingOrdinal(output, null, 'owner-address')

  assert.equal(ordinal.origin.outpoint, 'origin_0')
  assert.equal(ordinal.origin.data.map.name, 'Tagged Fox')
  assert.equal(
    (ordinal.origin.data.map.subTypeData as Record<string, unknown>).collectionId,
    'tagged_collection_0',
  )
})

test('normalizes dot-form wallet and metadata outpoints', () => {
  const currentTxid = 'a'.repeat(64)
  const originTxid = 'b'.repeat(64)
  const output = {
    outpoint: `${currentTxid}.2`,
    satoshis: 1,
    spendable: true,
  } satisfies WalletOutput
  const metadata = {
    outpoint: `${currentTxid}.2`,
    origin: `${originTxid}.238`,
    sequence: 2,
    contentType: 'image/png',
    contentLength: 100,
    map: {},
  } satisfies OrdfsMetadata

  const ordinal = normalizePixelRacingOrdinal(output, metadata, 'owner-address')

  assert.equal(ordinal.outpoint, `${currentTxid}_2`)
  assert.equal(ordinal.origin.outpoint, `${originTxid}_238`)
})

test('checks Metanet access without converting the public key to an address', async () => {
  let receivedArgs: unknown
  const wallet = {
    async getPublicKey(args: unknown) {
      receivedArgs = args
      return {
        publicKey: '02'.padEnd(66, '1'),
      }
    },
  } as unknown as WalletInterface

  await verifyMetanetPixelFoxAccess(wallet)

  assert.deepEqual(receivedArgs, {
    protocolID: [0, 'pixel foxes'],
    keyID: '1',
    counterparty: 'anyone',
    forSelf: true,
  })
})

test('normalizes a Metanet basket fox with no trait metadata', () => {
  const output = {
    outpoint: 'current_0',
    satoshis: 1,
    spendable: true,
    customInstructions: JSON.stringify({
      originOutpoint: 'origin_0',
      foxName: 'Basket Fox',
    }),
  } satisfies WalletOutput

  const ordinal = normalizeMetanetPixelFox(output, null, 'identity-key')
  const subTypeData = ordinal.origin.data.map.subTypeData as Record<string, unknown>

  assert.equal(ordinal.origin.outpoint, 'origin_0')
  assert.equal(ordinal.origin.data.map.name, 'Basket Fox')
  assert.deepEqual(subTypeData.traits, [])
})

test('detects the Metanet HTTP wallet transport without wallet calls', () => {
  const metanetWallet = {
    substrate: { baseUrl: 'http://localhost:3321' },
  } as unknown as WalletInterface
  const yoursWallet = {
    substrate: {},
  } as unknown as WalletInterface

  assert.equal(isMetanetWalletTransport(metanetWallet), true)
  assert.equal(isMetanetWalletTransport(yoursWallet), false)
})
