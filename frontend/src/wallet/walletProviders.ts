import type { ConnectWalletResult, WalletProviderConfig } from '@1sat/connect'
import { WalletClient, type WalletInterface } from '@bsv/sdk'

export const YOURS_WALLET_PROVIDER = 'yours'
export const METANET_WALLET_PROVIDER = 'metanet'
export const SHUALLET_WALLET_PROVIDER = 'shuallet'

type WalletClientFactory = (substrate: 'window.CWI' | 'json-api') => WalletInterface

const defaultWalletClientFactory: WalletClientFactory = substrate => (
  new WalletClient(substrate)
)

// A fresh/locked BRC-100 extension (Yours) often isn't reachable on the very
// first call: that initial click is what wakes the extension up, so the in-flight
// authentication throws even though the user then grants the prompt. Retrying the
// handshake a few times lets a single click recover automatically instead of
// surfacing a "could not be reached" error and forcing the user to click again.
export const WALLET_AUTH_MAX_ATTEMPTS = 6
export const WALLET_AUTH_RETRY_DELAY_MS = 1000

export type ConnectPixelRacingWalletOptions = {
  maxAttempts?: number
  retryDelayMs?: number
  delay?: (ms: number) => Promise<void>
}

const defaultDelay = (ms: number): Promise<void> => new Promise(resolve => {
  globalThis.setTimeout(resolve, ms)
})

async function authenticateWithRetry(
  wallet: WalletInterface,
  { maxAttempts, retryDelayMs, delay }: Required<ConnectPixelRacingWalletOptions>,
): Promise<string> {
  const attempts = Math.max(1, Math.floor(maxAttempts))
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await wallet.waitForAuthentication({})
      const { publicKey } = await wallet.getPublicKey({ identityKey: true })
      return publicKey
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await delay(retryDelayMs)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Wallet authentication failed')
}

export async function connectPixelRacingWallet(
  provider: typeof YOURS_WALLET_PROVIDER | typeof METANET_WALLET_PROVIDER,
  createWallet: WalletClientFactory = defaultWalletClientFactory,
  options: ConnectPixelRacingWalletOptions = {},
): Promise<ConnectWalletResult> {
  const substrate = provider === YOURS_WALLET_PROVIDER
    ? 'window.CWI'
    : 'json-api'
  const wallet = createWallet(substrate)

  const publicKey = await authenticateWithRetry(wallet, {
    maxAttempts: options.maxAttempts ?? WALLET_AUTH_MAX_ATTEMPTS,
    retryDelayMs: options.retryDelayMs ?? WALLET_AUTH_RETRY_DELAY_MS,
    delay: options.delay ?? defaultDelay,
  })

  return {
    wallet,
    provider,
    identityKey: publicKey,
    disconnect: () => {},
  }
}

export const pixelRacingWalletProviders: WalletProviderConfig[] = [
  {
    type: YOURS_WALLET_PROVIDER,
    name: 'Yours Wallet',
    connect: () => connectPixelRacingWallet(YOURS_WALLET_PROVIDER),
  },
  {
    type: METANET_WALLET_PROVIDER,
    name: 'Metanet',
    connect: () => connectPixelRacingWallet(METANET_WALLET_PROVIDER),
  },
]
