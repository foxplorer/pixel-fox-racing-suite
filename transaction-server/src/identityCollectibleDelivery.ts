import {
  ORDINALS_BASKET,
  P1SAT_PROTOCOL,
} from '@1sat/actions'
import { PublicKey, type Beef } from '@bsv/sdk'
import type {
  CollectibleDelivery,
  CollectibleDeliveryRequest,
  CollectibleKind,
} from './collectibles.js'
import {
  createSdkCollectibleTransactionBuilder,
  type SdkCollectibleTransactionRequest,
  type SdkCollectibleTransactionResult,
} from './sdkCollectibleTransaction.js'

interface IdentityCollectibleDefinition {
  collectionIdEnv: string
  viewBox: string
}

const IDENTITY_COLLECTIBLES: Record<CollectibleKind, IdentityCollectibleDefinition> = {
  blueberries: {
    collectionIdEnv: 'BLUEBERRIES_COLLECTION_ID',
    viewBox: '0 0 53.308 53.308',
  },
  salad: {
    collectionIdEnv: 'SALAD_COLLECTION_ID',
    viewBox: '0 0 55.569 55.569',
  },
  rabbit: {
    collectionIdEnv: 'RABBIT_COLLECTION_ID',
    viewBox: '0 0 416.188 416.188',
  },
}

export interface IdentityCollectibleDeliveryOptions {
  chain: 'main' | 'test'
  services: {
    getBeefForTxid(txid: string): Promise<Beef>
  }
  getPublicKey(args: {
    protocolID: [0 | 1 | 2, string]
    keyID: string
    counterparty: string
  }): Promise<{ publicKey: string }>
  senderIdentityKey: string
  inscriptionApp: string
  getEnv?: (name: string) => string | undefined
  buildTransaction?: (
    request: SdkCollectibleTransactionRequest
  ) => Promise<SdkCollectibleTransactionResult>
  makeKeyID?: () => string
}

function requireValue(value: string | undefined, name: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`Missing required environment variable: ${name}`)
  return normalized
}

function buildContent(viewBox: string, collectionId: string): string {
  return `<svg width="100%" height="100%" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
  <image href="/content/${collectionId}" width="100%" height="100%"/>
</svg>`
}

export function createIdentityCollectibleDelivery(
  options: IdentityCollectibleDeliveryOptions
): CollectibleDelivery {
  const getEnv = options.getEnv ?? (name => process.env[name])
  const buildTransaction = options.buildTransaction
    ?? createSdkCollectibleTransactionBuilder({
      chain: options.chain,
      services: options.services,
      getEnv,
    })
  const makeKeyID = options.makeKeyID
    ?? (() => `inscribe-${Date.now()}-${crypto.randomUUID()}`)

  return async ({ kind, identityKey, deliveryTarget }: CollectibleDeliveryRequest) => {
    if (deliveryTarget.type !== 'counterparty') {
      throw new Error('Identity delivery requires a counterparty target')
    }
    const definition = IDENTITY_COLLECTIBLES[kind]
    const collectionId = requireValue(
      getEnv(definition.collectionIdEnv),
      definition.collectionIdEnv
    )
    const time = Date.now()
    const keyID = makeKeyID()
    const { publicKey } = await options.getPublicKey({
      protocolID: P1SAT_PROTOCOL,
      keyID,
      counterparty: identityKey,
    })
    const destinationAddress = PublicKey.fromString(publicKey).toAddress()
    const result = await buildTransaction({
      serverInstance: `${kind}-server`,
      destinationAddress,
      content: buildContent(definition.viewBox, collectionId),
      contentType: 'image/svg+xml',
      map: {
        app: options.inscriptionApp,
        name: kind,
        type: 'ord',
        time: String(time),
        subType: 'collectionItem',
        subTypeData: JSON.stringify({ collectionId }),
      },
    })

    return {
      txid: result.txid,
      time,
      deliveryMode: 'identity',
      outputIndex: result.outputIndex,
      outpoint: `${result.txid}_${result.outputIndex}`,
      atomicBEEF: result.atomicBEEF,
      senderIdentityKey: options.senderIdentityKey,
      remittance: {
        protocolID: P1SAT_PROTOCOL,
        keyID,
        counterparty: options.senderIdentityKey,
        basket: ORDINALS_BASKET,
        tags: [
          'type:image/svg+xml',
          'origin',
          `name:${kind}`,
          `collectionId:${collectionId}`,
        ],
      },
    }
  }
}
