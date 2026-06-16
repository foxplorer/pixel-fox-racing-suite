import { OneSatServices } from '@1sat/client'
import { PublicKey } from '@bsv/sdk'
import type { Express } from 'express'
import {
  createSdkCollectibleTransactionBuilder,
  type SdkCollectibleTransactionRequest,
  type SdkCollectibleTransactionResult,
} from './sdkCollectibleTransaction.js'
import {
  processCollectibleClaim,
  type CollectibleDelivery,
  type CollectibleKind,
  type ProcessCollectibleClaimOptions,
} from './collectibleClaims.js'

export {
  isIdentityKey,
  processCollectibleClaim,
  type CollectibleClaimBody,
  type CollectibleClaimResult,
  type CollectibleDelivery,
  type CollectibleDeliveryMode,
  type CollectibleDeliveryRequest,
  type CollectibleDeliveryResult,
  type CollectibleDeliveryTarget,
  type CollectibleKind,
  type ProcessCollectibleClaimOptions,
} from './collectibleClaims.js'

interface CollectibleDefinition {
  route: string
  collectionIdEnv: string
  viewBox: string
  serverInstance: string
}

export interface RegisterCollectibleRoutesOptions extends ProcessCollectibleClaimOptions {
  inscriptionApp: string
}

export const COLLECTIBLES: Record<CollectibleKind, CollectibleDefinition> = {
  blueberries: {
    route: '/createblueberries',
    collectionIdEnv: 'BLUEBERRIES_COLLECTION_ID',
    viewBox: '0 0 53.308 53.308',
    serverInstance: 'blueberries-server',
  },
  salad: {
    route: '/createsalad',
    collectionIdEnv: 'SALAD_COLLECTION_ID',
    viewBox: '0 0 55.569 55.569',
    serverInstance: 'salad-server',
  },
  rabbit: {
    route: '/createrabbit',
    collectionIdEnv: 'RABBIT_COLLECTION_ID',
    viewBox: '0 0 416.188 416.188',
    serverInstance: 'rabbit-server',
  },
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function submitToGorillapool(txid: string): Promise<void> {
  try {
    const response = await fetch(`https://ordinals.gorillapool.io/api/tx/${txid}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      console.error('Gorillapool submit failed:', await response.text())
    }
  } catch (error) {
    console.error('Gorillapool submit error:', error)
  }
}

export function createAddressCollectibleDelivery(
  inscriptionApp: string,
  buildTransaction: (
    request: SdkCollectibleTransactionRequest
  ) => Promise<SdkCollectibleTransactionResult> = createSdkCollectibleTransactionBuilder({
    chain: 'main',
    services: new OneSatServices('main'),
  })
): CollectibleDelivery {
  return async ({ kind, deliveryTarget }) => {
    if (deliveryTarget.type !== 'address') {
      throw new Error('Address delivery requires an address')
    }

    const definition = COLLECTIBLES[kind]
    const collectionId = requireEnv(definition.collectionIdEnv)
    const content = `<svg width="100%" height="100%" viewBox="${definition.viewBox}" xmlns="http://www.w3.org/2000/svg">
  <image href="/content/${collectionId}" width="100%" height="100%"/>
</svg>`
    const time = Date.now()
    const result = await buildTransaction({
      serverInstance: definition.serverInstance,
      destinationAddress: deliveryTarget.address,
      content,
      contentType: 'image/svg+xml',
      map: {
        app: inscriptionApp,
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
      deliveryMode: 'address',
    }
  }
}

export function createMetanetCollectibleDelivery(
  inscriptionApp: string,
  buildTransaction: (
    request: SdkCollectibleTransactionRequest
  ) => Promise<SdkCollectibleTransactionResult> = createSdkCollectibleTransactionBuilder({
    chain: 'main',
    services: new OneSatServices('main'),
  }),
  getEnv: (name: string) => string | undefined = name => process.env[name]
): CollectibleDelivery {
  return async ({ kind, deliveryTarget }) => {
    if (deliveryTarget.type !== 'protocol-key') {
      throw new Error('Metanet delivery requires a pixel foxes public key')
    }

    const definition = COLLECTIBLES[kind]
    const collectionId = getEnv(definition.collectionIdEnv)?.trim()
    if (!collectionId) {
      throw new Error(`Missing required environment variable: ${definition.collectionIdEnv}`)
    }
    const time = Date.now()
    const result = await buildTransaction({
      serverInstance: definition.serverInstance,
      destinationAddress: PublicKey.fromString(deliveryTarget.publicKey).toAddress(),
      content: `<svg width="100%" height="100%" viewBox="${definition.viewBox}" xmlns="http://www.w3.org/2000/svg">
  <image href="/content/${collectionId}" width="100%" height="100%"/>
</svg>`,
      contentType: 'image/svg+xml',
      map: {
        app: inscriptionApp,
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
      deliveryMode: 'metanet',
      outputIndex: result.outputIndex,
      outpoint: `${result.txid}_${result.outputIndex}`,
      atomicBEEF: result.atomicBEEF,
      remittance: {
        protocolID: deliveryTarget.protocolID,
        keyID: deliveryTarget.keyID,
        counterparty: deliveryTarget.counterparty,
        basket: deliveryTarget.basket,
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

export function registerCollectibleRoutes(
  app: Express,
  options: RegisterCollectibleRoutesOptions
): void {
  const addressDelivery = options.addressDelivery
    ?? createAddressCollectibleDelivery(options.inscriptionApp)
  const metanetDelivery = options.metanetDelivery
    ?? createMetanetCollectibleDelivery(options.inscriptionApp)

  for (const [kind, definition] of Object.entries(COLLECTIBLES) as Array<
    [CollectibleKind, CollectibleDefinition]
  >) {
    app.post(definition.route, async (req, res) => {
      try {
        const result = await processCollectibleClaim(kind, req.body, {
          ...options,
          metanetDelivery,
          addressDelivery,
          submitTxid: options.submitTxid ?? submitToGorillapool,
        })
        res.status(result.status).json(result.body)
      } catch (error) {
        console.error(`Error creating ${kind}:`, error)
        res.status(500).json({
          error: `failed_create_${kind}`,
          message: error instanceof Error ? error.message : `Failed to create ${kind}`,
        })
      }
    })
  }
}
