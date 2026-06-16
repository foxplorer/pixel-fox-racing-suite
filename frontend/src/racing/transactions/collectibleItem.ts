import type { PixelRacingGameResult } from './lapResult'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from './ordinalLinks'
import type { RacingCollectibleImageUrls, RacingCollectibleType } from '../collectibles/collectibleTypes'
import { normalizeOrdinalOutpoint } from './ordinalOutpoint'
import type { InternalizeActionArgs, WalletInterface } from '@bsv/sdk'
import type { CollectibleDeliveryTarget } from '../../wallet/deliveryTarget'

export type { RacingCollectibleImageUrls, RacingCollectibleType } from '../collectibles/collectibleTypes'

export interface CollectiblePlayerIdentity {
  ownerAddress: string
  outpoint: string
  originOutpoint: string
  foxName: string
}

export interface CollectibleTransactionPayloadInput {
  identity: CollectiblePlayerIdentity
  itemType: RacingCollectibleType
  itemImage: string
  timestampMs: number
  txid: string
  trackName: string
  dummy?: boolean
}

export interface PixelRacingSharedCollectibleTransactionPayload {
  txid: string
  itemType: RacingCollectibleType
  itemImage: string
  score: number
  trackName: string
  time: string
  foxOutpoint: string
  foxName: string
  originOutpoint: string
  ownerAddress: string
  dummy: boolean
}

export interface CollectibleTransactionRequest {
  url: string
  init: RequestInit
}

export interface CollectibleTransactionResponse {
  txid?: string
  dummy?: boolean
  deliveryMode?: 'dummy' | 'identity' | 'metanet' | 'address'
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
  error?: string
  message?: string
}

export type CollectibleTransactionFetch = (
  url: string,
  init: RequestInit
) => Promise<{ json(): Promise<CollectibleTransactionResponse> }>

export interface InternalizeMetanetCollectibleDeliveryWithRetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  sleep?: (delayMs: number) => Promise<void>
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void
}

const COLLECTIBLE_ENDPOINTS: Record<RacingCollectibleType, string> = {
  blueberry: '/createblueberries',
  salad: '/createsalad',
  rabbit: '/createrabbit'
}

const COLLECTIBLE_SCORES: Record<RacingCollectibleType, number> = {
  blueberry: 10,
  salad: 20,
  rabbit: 50
}

export const getCollectibleTransactionEndpoint = (
  itemType: RacingCollectibleType
): string => COLLECTIBLE_ENDPOINTS[itemType]

export const getCollectibleScore = (
  itemType: RacingCollectibleType
): number => COLLECTIBLE_SCORES[itemType]

export const getCollectibleScoreText = (
  itemType: RacingCollectibleType
): string => getCollectibleScore(itemType).toString()

export const getCollectibleImageUrl = (
  itemType: RacingCollectibleType,
  imageUrls: RacingCollectibleImageUrls
): string => imageUrls[itemType]

export const buildCollectibleTransactionRequest = (
  transactionServerUrl: string,
  itemType: RacingCollectibleType,
  identityKey: string,
  deliveryTarget: CollectibleDeliveryTarget,
): CollectibleTransactionRequest => ({
  url: `${transactionServerUrl}${getCollectibleTransactionEndpoint(itemType)}`,
  init: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identityKey,
      deliveryTarget,
    })
  }
})

export const submitCollectibleTransaction = async (
  transactionServerUrl: string,
  itemType: RacingCollectibleType,
  identityKey: string,
  deliveryTarget: CollectibleDeliveryTarget,
  requestFetcher: CollectibleTransactionFetch = fetch
): Promise<CollectibleTransactionResponse> => {
  const request = buildCollectibleTransactionRequest(
    transactionServerUrl,
    itemType,
    identityKey,
    deliveryTarget,
  )
  const response = await requestFetcher(request.url, request.init)
  return response.json()
}

export const buildMetanetCollectibleInternalizeAction = (
  response: CollectibleTransactionResponse
): InternalizeActionArgs => {
  if (
    response.deliveryMode !== 'metanet'
    || !response.atomicBEEF
    || response.outputIndex == null
    || !response.remittance
  ) {
    throw new Error('Collectible response is missing Metanet delivery material')
  }

  return {
    tx: response.atomicBEEF,
    outputs: [{
      outputIndex: response.outputIndex,
      protocol: 'basket insertion',
      insertionRemittance: {
        basket: response.remittance.basket,
        tags: response.remittance.tags,
        customInstructions: JSON.stringify({
          protocolID: response.remittance.protocolID,
          keyID: response.remittance.keyID,
          counterparty: response.remittance.counterparty
        })
      }
    }],
    description: 'Receive Pixel Racing collectible'
  }
}

export const internalizeMetanetCollectibleDelivery = async (
  wallet: WalletInterface,
  response: CollectibleTransactionResponse
): Promise<void> => {
  if (response.deliveryMode !== 'metanet') return

  const result = await wallet.internalizeAction(
    buildMetanetCollectibleInternalizeAction(response)
  )
  if (!result.accepted) {
    throw new Error('Wallet rejected collectible internalization')
  }
}

const sleep = (delayMs: number): Promise<void> => new Promise(resolve => {
  globalThis.setTimeout(resolve, delayMs)
})

export const internalizeMetanetCollectibleDeliveryWithRetry = async (
  wallet: WalletInterface,
  response: CollectibleTransactionResponse,
  {
    maxAttempts = 3,
    initialDelayMs = 500,
    sleep: sleepFn = sleep,
    onRetry
  }: InternalizeMetanetCollectibleDeliveryWithRetryOptions = {}
): Promise<void> => {
  const attempts = Math.max(1, Math.floor(maxAttempts))
  let nextDelayMs = Math.max(0, initialDelayMs)
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await internalizeMetanetCollectibleDelivery(wallet, response)
      return
    } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      onRetry?.(attempt, error, nextDelayMs)
      if (nextDelayMs > 0) {
        await sleepFn(nextDelayMs)
      }
      nextDelayMs *= 2
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Collectible internalization failed after retries')
}

export const buildCollectibleActivityResult = ({
  identity,
  itemType,
  itemImage,
  timestampMs,
  txid,
  trackName,
  dummy
}: CollectibleTransactionPayloadInput): PixelRacingGameResult => ({
  owneraddress: identity.ownerAddress,
  outpoint: normalizeOrdinalOutpoint(identity.outpoint),
  originoutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
  foxname: identity.foxName,
  laptime: getCollectibleScoreText(itemType),
  time: timestampMs.toString(),
  txid,
  foxinfolink: getOrdinalContentUrl(identity.originOutpoint),
  foximagelink: getOrdinalInscriptionUrl(identity.outpoint),
  itemType,
  itemImage,
  trackname: trackName,
  dummy: dummy === true
})

export const buildSharedCollectibleTransactionPayload = ({
  identity,
  itemType,
  itemImage,
  timestampMs,
  txid,
  trackName,
  dummy
}: CollectibleTransactionPayloadInput): PixelRacingSharedCollectibleTransactionPayload => ({
  txid,
  itemType,
  itemImage,
  score: getCollectibleScore(itemType),
  trackName,
  time: timestampMs.toString(),
  foxOutpoint: normalizeOrdinalOutpoint(identity.outpoint),
  foxName: identity.foxName,
  originOutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
  ownerAddress: identity.ownerAddress,
  dummy: dummy === true
})
