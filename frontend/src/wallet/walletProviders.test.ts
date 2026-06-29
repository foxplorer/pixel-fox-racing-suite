import assert from 'node:assert/strict'
import test from 'node:test'
import type { WalletInterface } from '@bsv/sdk'
import {
  connectPixelRacingWallet,
  METANET_WALLET_PROVIDER,
  YOURS_WALLET_PROVIDER,
} from './walletProviders'

function createWalletFixture() {
  const calls: string[] = []
  const wallet = {
    async waitForAuthentication() {
      calls.push('authenticate')
      return { authenticated: true as const }
    },
    async getPublicKey() {
      calls.push('identity')
      return { publicKey: '02'.padEnd(66, '1') }
    },
  } as unknown as WalletInterface

  return { wallet, calls }
}

test('connects Yours through only the window.CWI substrate', async () => {
  const fixture = createWalletFixture()
  const substrates: string[] = []

  const result = await connectPixelRacingWallet(
    YOURS_WALLET_PROVIDER,
    substrate => {
      substrates.push(substrate)
      return fixture.wallet
    },
  )

  assert.deepEqual(substrates, ['window.CWI'])
  assert.deepEqual(fixture.calls, ['authenticate', 'identity'])
  assert.equal(result.provider, YOURS_WALLET_PROVIDER)
  assert.equal(result.wallet, fixture.wallet)
})

test('retries the handshake when the extension is not reachable on the first attempt', async () => {
  const calls: string[] = []
  let attempts = 0
  const wallet = {
    async waitForAuthentication() {
      attempts += 1
      if (attempts < 3) {
        throw new Error('Yours Wallet could not be reached')
      }
      calls.push('authenticate')
      return { authenticated: true as const }
    },
    async getPublicKey() {
      calls.push('identity')
      return { publicKey: '02'.padEnd(66, '1') }
    },
  } as unknown as WalletInterface

  const delays: number[] = []
  const result = await connectPixelRacingWallet(
    YOURS_WALLET_PROVIDER,
    () => wallet,
    { retryDelayMs: 5, delay: async ms => { delays.push(ms) } },
  )

  assert.equal(attempts, 3)
  assert.deepEqual(calls, ['authenticate', 'identity'])
  assert.deepEqual(delays, [5, 5])
  assert.equal(result.identityKey, '02'.padEnd(66, '1'))
})

test('gives up after exhausting retries and throws the last error', async () => {
  const wallet = {
    async waitForAuthentication() {
      throw new Error('Yours Wallet could not be reached')
    },
    async getPublicKey() {
      return { publicKey: '02'.padEnd(66, '1') }
    },
  } as unknown as WalletInterface

  await assert.rejects(
    connectPixelRacingWallet(
      YOURS_WALLET_PROVIDER,
      () => wallet,
      { maxAttempts: 3, retryDelayMs: 0, delay: async () => {} },
    ),
    /could not be reached/,
  )
})

test('connects Metanet through only the localhost JSON API substrate', async () => {
  const fixture = createWalletFixture()
  const substrates: string[] = []

  const result = await connectPixelRacingWallet(
    METANET_WALLET_PROVIDER,
    substrate => {
      substrates.push(substrate)
      return fixture.wallet
    },
  )

  assert.deepEqual(substrates, ['json-api'])
  assert.deepEqual(fixture.calls, ['authenticate', 'identity'])
  assert.equal(result.provider, METANET_WALLET_PROVIDER)
})
