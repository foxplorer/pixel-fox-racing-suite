import type { WalletInterface } from '@bsv/sdk'
import { METANET_WALLET_PROVIDER } from './walletProviders'

export type CollectibleDeliveryTarget =
  | {
      type: 'counterparty'
      identityKey: string
    }
  | {
      type: 'protocol-key'
      publicKey: string
      protocolID: [0 | 1 | 2, string]
      keyID: string
      counterparty: string
      basket: string
    }
  | {
      type: 'address'
      address: string
    }

const isMetanetIdentityKey = (value: string): boolean => /^(02|03)[0-9a-fA-F]{64}$/.test(value)

export async function prepareCollectibleDeliveryTarget(
  wallet: WalletInterface | null | undefined,
  providerType: string | null,
  identityKey: string,
  ordinalAddress?: string | null,
): Promise<CollectibleDeliveryTarget> {
  if (providerType === METANET_WALLET_PROVIDER && isMetanetIdentityKey(identityKey)) {
    if (!wallet) {
      throw new Error('Metanet collectible delivery requires a connected wallet')
    }

    const protocolID: [0, string] = [0, 'pixel foxes']
    const keyID = '1'
    const counterparty = 'anyone'
    const { publicKey } = await wallet.getPublicKey({
      protocolID,
      keyID,
      counterparty,
      forSelf: true,
    })

    return {
      type: 'protocol-key',
      publicKey,
      protocolID,
      keyID,
      counterparty,
      basket: 'pixel foxes',
    }
  }

  if (!ordinalAddress) {
    throw new Error('Address collectible delivery requires an ordinal deposit address')
  }

  return {
    type: 'address',
    address: ordinalAddress,
  }
}
