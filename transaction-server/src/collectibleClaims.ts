export type CollectibleKind = 'blueberries' | 'salad' | 'rabbit'
export type CollectibleDeliveryMode = 'dummy' | 'identity' | 'metanet' | 'address'

export interface CollectibleClaimBody {
  identityKey?: unknown
  deliveryTarget?: unknown
}

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

export interface CollectibleDeliveryRequest {
  kind: CollectibleKind
  identityKey: string
  deliveryTarget: CollectibleDeliveryTarget
}

export interface CollectibleDeliveryResult {
  txid: string
  time: number
  deliveryMode: Exclude<CollectibleDeliveryMode, 'dummy'>
  outputIndex?: number
  outpoint?: string
  atomicBEEF?: number[]
  senderIdentityKey?: string
  remittance?: {
    protocolID: [0 | 1 | 2, string]
    keyID: string
    counterparty: string
    basket: string
    tags: string[]
  }
}

export interface CollectibleClaimResult {
  status: number
  body: {
    txid?: string
    time?: number
    type?: CollectibleKind
    dummy?: boolean
    deliveryMode?: CollectibleDeliveryMode
    recipientIdentityKey?: string
    outputIndex?: number
    outpoint?: string
    atomicBEEF?: number[]
    senderIdentityKey?: string
    remittance?: CollectibleDeliveryResult['remittance']
    error?: string
    message?: string
  }
}

export type CollectibleDelivery = (
  request: CollectibleDeliveryRequest
) => Promise<CollectibleDeliveryResult>

export interface ProcessCollectibleClaimOptions {
  mode: 'dummy' | 'real'
  makeDummyTxid: () => string
  identityDelivery?: CollectibleDelivery
  metanetDelivery?: CollectibleDelivery
  addressDelivery?: CollectibleDelivery
  submitTxid?: (txid: string) => Promise<void>
}

export function isIdentityKey(value: unknown): value is string {
  return typeof value === 'string' && /^(02|03)[0-9a-fA-F]{64}$/.test(value)
}

function parseDeliveryTarget(
  requestBody: CollectibleClaimBody,
  identityKey: string,
): CollectibleDeliveryTarget | null {
  const target = requestBody.deliveryTarget
  if (target && typeof target === 'object') {
    const value = target as Record<string, unknown>
    if (value.type === 'counterparty') {
      return value.identityKey === identityKey
        ? { type: 'counterparty', identityKey }
        : null
    }
    if (
      value.type === 'protocol-key'
      && isIdentityKey(value.publicKey)
      && Array.isArray(value.protocolID)
      && value.protocolID[0] === 0
      && value.protocolID[1] === 'pixel foxes'
      && value.keyID === '1'
      && value.counterparty === 'anyone'
      && value.basket === 'pixel foxes'
    ) {
      return {
        type: 'protocol-key',
        publicKey: value.publicKey,
        protocolID: [0, 'pixel foxes'],
        keyID: '1',
        counterparty: 'anyone',
        basket: 'pixel foxes',
      }
    }
    if (value.type === 'address' && typeof value.address === 'string' && value.address.trim()) {
      return { type: 'address', address: value.address.trim() }
    }
    return null
  }

  return null
}

export async function processCollectibleClaim(
  kind: CollectibleKind,
  requestBody: CollectibleClaimBody,
  options: ProcessCollectibleClaimOptions
): Promise<CollectibleClaimResult> {
  if (!isIdentityKey(requestBody.identityKey)) {
    return {
      status: 400,
      body: {
        error: 'invalid_identity_key',
        message: 'A compressed secp256k1 identity public key is required',
      },
    }
  }

  const identityKey = requestBody.identityKey
  const deliveryTarget = parseDeliveryTarget(requestBody, identityKey)
  if (!deliveryTarget) {
    return {
      status: 400,
      body: {
        error: 'invalid_delivery_target',
        message: 'An explicit collectible deliveryTarget is required and must be supported',
      },
    }
  }

  if (options.mode === 'dummy') {
    const time = Date.now()
    return {
      status: 200,
      body: {
        txid: options.makeDummyTxid(),
        time,
        type: kind,
        dummy: true,
        deliveryMode: 'dummy',
        recipientIdentityKey: identityKey,
      },
    }
  }

  const delivery = deliveryTarget.type === 'protocol-key'
    ? options.metanetDelivery
    : deliveryTarget.type === 'address'
      ? options.addressDelivery
      : options.identityDelivery

  if (!delivery) {
    return {
      status: 501,
      body: {
        error: 'identity_delivery_not_configured',
        message: `The ${deliveryTarget.type} collectible delivery path is not configured`,
      },
    }
  }

  const delivered = await delivery({
    kind,
    identityKey,
    deliveryTarget,
  })
  if (options.submitTxid) {
    void options.submitTxid(delivered.txid)
  }

  return {
    status: 200,
    body: {
      txid: delivered.txid,
      time: delivered.time,
      type: kind,
      deliveryMode: delivered.deliveryMode,
      recipientIdentityKey: identityKey,
      ...(delivered.outputIndex != null ? { outputIndex: delivered.outputIndex } : {}),
      ...(delivered.outpoint ? { outpoint: delivered.outpoint } : {}),
      ...(delivered.atomicBEEF ? { atomicBEEF: delivered.atomicBEEF } : {}),
      ...(delivered.senderIdentityKey ? { senderIdentityKey: delivered.senderIdentityKey } : {}),
      ...(delivered.remittance ? { remittance: delivered.remittance } : {}),
    },
  }
}
