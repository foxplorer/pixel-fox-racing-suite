import type { PixelRacingGameResult } from './lapResult'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from './ordinalLinks'
import type { RacingCollectibleImageUrls, RacingCollectibleType } from '../collectibles/collectibleTypes'

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
}

export type CollectibleTransactionFetch = (
  url: string,
  init: RequestInit
) => Promise<{ json(): Promise<CollectibleTransactionResponse> }>

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
  ordinalAddress: string
): CollectibleTransactionRequest => ({
  url: `${transactionServerUrl}${getCollectibleTransactionEndpoint(itemType)}`,
  init: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ordinalAddress })
  }
})

export const submitCollectibleTransaction = async (
  transactionServerUrl: string,
  itemType: RacingCollectibleType,
  ordinalAddress: string,
  fetcher: CollectibleTransactionFetch = fetch
): Promise<CollectibleTransactionResponse> => {
  const request = buildCollectibleTransactionRequest(transactionServerUrl, itemType, ordinalAddress)
  const response = await fetcher(request.url, request.init)
  return response.json()
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
  outpoint: identity.outpoint,
  originoutpoint: identity.originOutpoint,
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
  foxOutpoint: identity.outpoint,
  foxName: identity.foxName,
  originOutpoint: identity.originOutpoint,
  ownerAddress: identity.ownerAddress,
  dummy: dummy === true
})
