export type WalletCollectibleKind = 'blueberries' | 'salad' | 'rabbit'

export type WalletCollectible = {
  kind: WalletCollectibleKind
  name: string
  outpoint: string
  originOutpoint: string
  imageOutpoint?: string
}

const COLLECTION_KIND_BY_ID: Record<string, WalletCollectibleKind> = {
  d0322f59a802bd15c412e441adaab76c10bb3c9018e2a501117cba374616ea46_0: 'blueberries',
  '66fc7495388f011d273d8ce3ab5ec667121c34084e122e64fa2bc607e469e295_0': 'salad',
  c37ae9cedf11c4fde02a3fee2f0b5d89926a7052ff7c3206fe1a9366b4a76013_0: 'rabbit',
}

function readMap(item: any): Record<string, any> {
  return item?.origin?.data?.map ?? item?.data?.map ?? item?.map ?? {}
}

function readCollectionId(item: any): string | undefined {
  const map = readMap(item)
  const collectionId = map?.subTypeData?.collectionId ?? map?.collectionId
  return typeof collectionId === 'string' ? collectionId : undefined
}

function resolveKind(item: any): WalletCollectibleKind | undefined {
  const map = readMap(item)
  const collectionId = readCollectionId(item)
  if (typeof collectionId === 'string' && COLLECTION_KIND_BY_ID[collectionId]) {
    return COLLECTION_KIND_BY_ID[collectionId]
  }

  const normalizedName = typeof map?.name === 'string'
    ? map.name.trim().toLowerCase()
    : ''
  if (normalizedName === 'blueberry' || normalizedName === 'blueberries') {
    return 'blueberries'
  }
  if (normalizedName === 'salad' || normalizedName === 'rabbit') {
    return normalizedName
  }
  return undefined
}

export function getWalletCollectibles(ordinals: unknown): WalletCollectible[] {
  if (!Array.isArray(ordinals)) return []

  return ordinals.flatMap(item => {
    const kind = resolveKind(item)
    const collectionId = readCollectionId(item)
    const outpoint = typeof item?.outpoint === 'string' ? item.outpoint : ''
    const originOutpoint = typeof item?.origin?.outpoint === 'string'
      ? item.origin.outpoint
      : outpoint
    if (!kind || !outpoint || !originOutpoint) return []

    return [{
      kind,
      name: kind === 'blueberries'
        ? 'Blueberries'
        : `${kind[0].toUpperCase()}${kind.slice(1)}`,
      outpoint,
      originOutpoint,
      ...(collectionId ? { imageOutpoint: collectionId } : {}),
    }]
  })
}
