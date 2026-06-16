import type { ConnectWalletResult, WalletProviderConfig } from '@1sat/connect'
import { WalletClient, type WalletInterface } from '@bsv/sdk'

export const YOURS_WALLET_PROVIDER = 'yours'
export const METANET_WALLET_PROVIDER = 'metanet'

type WalletClientFactory = (substrate: 'window.CWI' | 'json-api') => WalletInterface

const defaultWalletClientFactory: WalletClientFactory = substrate => (
  new WalletClient(substrate)
)

export async function connectPixelRacingWallet(
  provider: typeof YOURS_WALLET_PROVIDER | typeof METANET_WALLET_PROVIDER,
  createWallet: WalletClientFactory = defaultWalletClientFactory,
): Promise<ConnectWalletResult> {
  const substrate = provider === YOURS_WALLET_PROVIDER
    ? 'window.CWI'
    : 'json-api'
  const wallet = createWallet(substrate)

  await wallet.waitForAuthentication({})
  const { publicKey } = await wallet.getPublicKey({ identityKey: true })

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
