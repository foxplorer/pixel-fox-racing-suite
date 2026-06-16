import { OneSatServices } from '@1sat/client'
import { createContext, deriveDepositAddresses, getOrdinals } from '@1sat/actions'
import type { OrdfsMetadata } from '@1sat/types'
import type { WalletInterface, WalletOutput } from '@bsv/sdk'
import { normalizeOrdinalOutpoint } from '../racing/transactions/ordinalOutpoint'

const services = new OneSatServices('main')
const DEFAULT_PAGE_SIZE = 500
const PIXEL_FOXES_BASKET = 'pixel foxes'
const PIXEL_FOXES_COLLECTION_ID =
  '1611d956f397caa80b56bc148b4bce87b54f39b234aeca4668b4d5a7785eb9fa_0'

export type PixelRacingWalletAddresses = {
  bsvAddress: string
  ordAddress: string
}

type LegacyOrdinal = {
  outpoint: string
  owner: string
  origin: {
    outpoint: string
    data: {
      map: Record<string, unknown>
    }
  }
  data: {
    map: Record<string, unknown>
  }
  map: Record<string, unknown>
  tags?: string[]
  walletOutput: WalletOutput
}

export async function derivePixelRacingAddresses(
  wallet: WalletInterface,
): Promise<PixelRacingWalletAddresses> {
  const ctx = createContext(wallet, { chain: 'main', services })
  const result = await deriveDepositAddresses.execute(ctx, { startIndex: 0, count: 2 })
  const [paymentAddress, ordinalAddress] = result.derivations

  return {
    bsvAddress: paymentAddress?.address ?? '',
    ordAddress: ordinalAddress?.address ?? '',
  }
}

function readTag(tags: string[] | undefined, prefix: string): string | undefined {
  const tag = tags?.find(value => value.startsWith(`${prefix}:`))
  return tag?.slice(prefix.length + 1)
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function normalizeMap(
  metadata: OrdfsMetadata | null | undefined,
  output: WalletOutput,
): Record<string, unknown> {
  const rawMap = metadata?.map ?? {}
  const map = Object.fromEntries(
    Object.entries(rawMap).map(([key, value]) => [key, parseJsonValue(value)]),
  )
  const parsedSubTypeData = parseJsonValue(map.subTypeData)
  const subTypeData = parsedSubTypeData && typeof parsedSubTypeData === 'object'
    ? { ...(parsedSubTypeData as Record<string, unknown>) }
    : {}

  const collectionId = readTag(output.tags, 'collectionId')
  if (collectionId && !subTypeData.collectionId) {
    subTypeData.collectionId = collectionId
  }

  const name = readTag(output.tags, 'name')
  if (name && !map.name) {
    map.name = name
  }

  if (Object.keys(subTypeData).length > 0) {
    map.subTypeData = subTypeData
  }

  return map
}

function resolveOrigin(output: WalletOutput, metadata?: OrdfsMetadata | null): string {
  const taggedOrigin = readTag(output.tags, 'origin')
  if (taggedOrigin) return normalizeOrdinalOutpoint(taggedOrigin)
  if (output.tags?.includes('origin')) return normalizeOrdinalOutpoint(output.outpoint)
  return normalizeOrdinalOutpoint(metadata?.origin ?? output.outpoint)
}

export function normalizePixelRacingOrdinal(
  output: WalletOutput,
  metadata: OrdfsMetadata | null | undefined,
  ownerAddress: string,
): LegacyOrdinal {
  const map = normalizeMap(metadata, output)

  return {
    outpoint: normalizeOrdinalOutpoint(output.outpoint),
    owner: ownerAddress,
    origin: {
      outpoint: resolveOrigin(output, metadata),
      data: { map },
    },
    data: { map },
    map,
    tags: output.tags,
    walletOutput: output,
  }
}

async function fetchMetadata(outputs: WalletOutput[]): Promise<Map<string, OrdfsMetadata | null>> {
  const metadataByOutpoint = new Map<string, OrdfsMetadata | null>()
  const batchSize = 100

  for (let index = 0; index < outputs.length; index += batchSize) {
    const batch = outputs.slice(index, index + batchSize)
    const requests = batch.map(output => `${output.outpoint}:-2`)

    try {
      const response = await services.ordfs.bulkMetadata(requests)
      batch.forEach((output, batchIndex) => {
        metadataByOutpoint.set(
          output.outpoint,
          response[requests[batchIndex]] ?? response[output.outpoint] ?? null,
        )
      })
    } catch {
      const fallback = await Promise.all(batch.map(async output => {
        try {
          return await services.ordfs.getMetadata(output.outpoint, -2)
        } catch {
          return null
        }
      }))
      batch.forEach((output, batchIndex) => {
        metadataByOutpoint.set(output.outpoint, fallback[batchIndex])
      })
    }
  }

  return metadataByOutpoint
}

function parseBasketInstructions(output: WalletOutput): Record<string, unknown> {
  if (!output.customInstructions) return {}

  try {
    const parsed = JSON.parse(output.customInstructions)
    return parsed && typeof parsed === 'object'
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function normalizeMetanetPixelFox(
  output: WalletOutput,
  metadata: OrdfsMetadata | null | undefined,
  ownerAddress: string,
): LegacyOrdinal {
  const ordinal = normalizePixelRacingOrdinal(output, metadata, ownerAddress)
  const instructions = parseBasketInstructions(output)
  const map = { ...ordinal.map }
  const existingSubTypeData = map.subTypeData && typeof map.subTypeData === 'object'
    ? map.subTypeData as Record<string, unknown>
    : {}
  const traits = Array.isArray(existingSubTypeData.traits)
    ? existingSubTypeData.traits
    : Array.isArray(instructions.traits)
      ? instructions.traits
      : []

  map.name = map.name ?? instructions.pixelFoxName ?? instructions.foxName
  map.subType = map.subType ?? 'collectionItem'
  map.subTypeData = {
    ...existingSubTypeData,
    collectionId: existingSubTypeData.collectionId ?? PIXEL_FOXES_COLLECTION_ID,
    traits,
  }

  const originOutpoint = typeof instructions.originOutpoint === 'string'
    ? normalizeOrdinalOutpoint(instructions.originOutpoint)
    : ordinal.origin.outpoint

  return {
    ...ordinal,
    origin: {
      outpoint: originOutpoint,
      data: { map },
    },
    data: { map },
    map,
  }
}

export async function verifyMetanetPixelFoxAccess(
  wallet: WalletInterface,
): Promise<void> {
  await wallet.getPublicKey({
    protocolID: [0, PIXEL_FOXES_BASKET],
    keyID: '1',
    counterparty: 'anyone',
    forSelf: true,
  })
}

export function isMetanetWalletTransport(
  wallet: WalletInterface,
): boolean {
  const substrate = (
    wallet as WalletInterface & {
      substrate?: { baseUrl?: unknown }
    }
  ).substrate

  return substrate?.baseUrl === 'http://localhost:3321'
}

export async function loadMetanetPixelFoxes(
  wallet: WalletInterface,
  ownerAddress: string,
  limit?: number,
): Promise<{ ordinals: LegacyOrdinal[]; hasMore: boolean }> {
  const requestedLimit = limit ?? Number.POSITIVE_INFINITY
  const listBasketOutputs = async (basket: string): Promise<WalletOutput[]> => {
    const outputs: WalletOutput[] = []

    while (outputs.length < requestedLimit) {
      const remaining = requestedLimit - outputs.length
      const pageSize = Number.isFinite(remaining)
        ? Math.min(DEFAULT_PAGE_SIZE, remaining)
        : DEFAULT_PAGE_SIZE
      const result = await wallet.listOutputs({
        basket,
        include: 'locking scripts',
        includeCustomInstructions: true,
        includeTags: true,
        limit: pageSize,
        offset: outputs.length,
      })

      outputs.push(...result.outputs)
      if (result.outputs.length < pageSize) break
    }

    return outputs
  }

  const outputs = await listBasketOutputs(PIXEL_FOXES_BASKET)

  const metadataByOutpoint = await fetchMetadata(outputs)
  return {
    ordinals: outputs.map(output => normalizeMetanetPixelFox(
      output,
      metadataByOutpoint.get(output.outpoint),
      ownerAddress,
    )),
    hasMore: Number.isFinite(requestedLimit) && outputs.length >= requestedLimit,
  }
}

export async function loadPixelRacingOrdinals(
  wallet: WalletInterface,
  ownerAddress: string,
  limit?: number,
): Promise<{ ordinals: LegacyOrdinal[]; hasMore: boolean }> {
  const ctx = createContext(wallet, { chain: 'main', services })
  const outputs: WalletOutput[] = []
  const requestedLimit = limit ?? Number.POSITIVE_INFINITY

  while (outputs.length < requestedLimit) {
    const remaining = requestedLimit - outputs.length
    const pageSize = Number.isFinite(remaining)
      ? Math.min(DEFAULT_PAGE_SIZE, remaining)
      : DEFAULT_PAGE_SIZE
    const result = await getOrdinals.execute(ctx, {
      limit: pageSize,
      offset: outputs.length,
    })

    outputs.push(...result.outputs)
    if (result.outputs.length < pageSize) break
  }

  const metadataByOutpoint = await fetchMetadata(outputs)
  const ordinals = outputs.map(output => normalizePixelRacingOrdinal(
    output,
    metadataByOutpoint.get(output.outpoint),
    ownerAddress,
  ))

  return {
    ordinals,
    hasMore: Number.isFinite(requestedLimit) && outputs.length >= requestedLimit,
  }
}
