export interface ShualletSession {
  ordinalAddress: string
  paymentAddress: string
  identityKey: string
}

interface ShualletBackup {
  ownerKey?: string
  walletKey?: string
  ordPk?: string
  payPk?: string
  avatar?: string
  displayName?: string
}

declare global {
  interface Window {
    setupWallet?: () => Promise<void>
    backupWallet?: () => void
    restoreWallet?: (
      ownerPrivateKey: string,
      paymentPrivateKey: string,
      newWallet?: boolean,
      avatar?: string,
      displayName?: string
    ) => void
    getWalletBalance?: (address?: string) => Promise<number>
    bsv?: {
      PrivateKey: {
        fromWIF: (wif: string) => {
          toWIF: () => string
          toString: () => string
          toPublicKey: () => { toHex: () => string }
        }
      }
      Address: {
        fromPrivateKey: (privateKey: unknown) => { toString: () => string }
      }
    }
    newPK?: () => string
    getAddressFromPrivateKey?: (privateKeyWif: string) => string
  }
}

const SHUALLET_STORAGE_KEYS = [
  'walletKey',
  'ownerKey',
  'walletAddress',
  'ownerAddress',
  'ownerPublicKey',
  'displayName',
  'avatar',
  'identityKey',
  'identityAddress',
]

export const SHUALLET_CONNECTED_EVENT = 'pixelracing:shuallet-connected'

export function isShualletLoaded(): boolean {
  return typeof window !== 'undefined'
    && typeof window.newPK === 'function'
    && typeof window.backupWallet === 'function'
    && Boolean(window.bsv?.PrivateKey && window.bsv?.Address)
}

export function getExistingShualletSession(): ShualletSession | null {
  if (typeof localStorage === 'undefined') return null

  const ordinalAddress = localStorage.getItem('ownerAddress')?.trim() ?? ''
  const paymentAddress = localStorage.getItem('walletAddress')?.trim() ?? ''
  const identityKey = ordinalAddress

  if (!ordinalAddress || !paymentAddress) return null

  return {
    ordinalAddress,
    paymentAddress,
    identityKey,
  }
}

export function createShualletWallet(): ShualletSession {
  if (!isShualletLoaded() || !window.newPK) {
    throw new Error('SHUAllet wallet scripts are not loaded')
  }

  const paymentPrivateKey = window.newPK()
  const ownerPrivateKey = window.newPK()
  persistShualletWallet(ownerPrivateKey, paymentPrivateKey)

  const session = getExistingShualletSession()
  if (!session) {
    throw new Error('SHUAllet wallet was created but no address was stored')
  }

  return session
}

export async function restoreShualletBackup(file: File): Promise<ShualletSession> {
  if (!isShualletLoaded()) {
    throw new Error('SHUAllet wallet scripts are not loaded')
  }

  const text = await file.text()
  const backup = JSON.parse(text) as ShualletBackup
  const ownerPrivateKey = backup.ownerKey ?? backup.ordPk
  const paymentPrivateKey = backup.walletKey ?? backup.payPk

  if (!ownerPrivateKey || !paymentPrivateKey) {
    throw new Error('Invalid SHUAllet backup file')
  }

  persistShualletWallet(ownerPrivateKey, paymentPrivateKey, backup.avatar, backup.displayName)

  const session = getExistingShualletSession()
  if (!session) {
    throw new Error('SHUAllet wallet was restored but no address was stored')
  }

  return session
}

export function backupShualletWallet(): void {
  if (!window.backupWallet) {
    throw new Error('SHUAllet backup is not available')
  }

  window.backupWallet()
}

export function logoutShualletWallet(): void {
  SHUALLET_STORAGE_KEYS.forEach(key => localStorage.removeItem(key))
}

export function emitShualletConnected(): void {
  window.dispatchEvent(new CustomEvent(SHUALLET_CONNECTED_EVENT))
}

function persistShualletWallet(
  ownerPrivateKey: string,
  paymentPrivateKey: string,
  avatar?: string,
  displayName?: string
): void {
  if (!window.bsv?.PrivateKey || !window.bsv?.Address) {
    throw new Error('SHUAllet BSV library is not loaded')
  }

  const paymentKey = window.bsv.PrivateKey.fromWIF(paymentPrivateKey)
  const ownerKey = window.bsv.PrivateKey.fromWIF(ownerPrivateKey)
  const paymentAddress = window.bsv.Address.fromPrivateKey(paymentKey).toString()
  const ownerAddress = window.bsv.Address.fromPrivateKey(ownerKey).toString()

  localStorage.setItem('ownerKey', ownerKey.toWIF())
  localStorage.setItem('ownerAddress', ownerAddress)
  localStorage.setItem('walletAddress', paymentAddress)
  localStorage.setItem('walletKey', paymentKey.toString())
  localStorage.setItem('ownerPublicKey', ownerKey.toPublicKey().toHex())

  if (displayName) localStorage.setItem('displayName', displayName)
  if (avatar) localStorage.setItem('avatar', avatar)
}
