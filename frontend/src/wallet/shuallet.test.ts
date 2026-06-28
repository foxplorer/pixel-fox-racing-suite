import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExistingShualletSession,
  logoutShualletWallet,
} from './shuallet'

function installLocalStorageFixture(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key: string) {
        return store.get(key) ?? null
      },
      setItem(key: string, value: string) {
        store.set(key, value)
      },
      removeItem(key: string) {
        store.delete(key)
      },
    },
  })

  return store
}

test('reads SHUAllet ord address as the racing identity key', () => {
  installLocalStorageFixture({
    ownerAddress: '1ord-address',
    walletAddress: '1pay-address',
    ownerPublicKey: '02public-key',
  })

  assert.deepEqual(getExistingShualletSession(), {
    ordinalAddress: '1ord-address',
    paymentAddress: '1pay-address',
    identityKey: '1ord-address',
  })
})

test('ignores incomplete SHUAllet sessions', () => {
  installLocalStorageFixture({
    ownerAddress: '1ord-address',
  })

  assert.equal(getExistingShualletSession(), null)
})

test('logout clears SHUAllet wallet storage', () => {
  const store = installLocalStorageFixture({
    ownerAddress: '1ord-address',
    walletAddress: '1pay-address',
    ownerKey: 'owner-key',
    walletKey: 'wallet-key',
  })

  logoutShualletWallet()

  assert.equal(store.has('ownerAddress'), false)
  assert.equal(store.has('walletAddress'), false)
  assert.equal(store.has('ownerKey'), false)
  assert.equal(store.has('walletKey'), false)
})
