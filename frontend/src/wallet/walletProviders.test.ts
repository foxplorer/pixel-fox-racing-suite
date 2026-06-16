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
