import type { RacingGameCollectibleItem } from './collectibleTypes'

export interface CollectiblePickupPosition {
  x: number
  y: number
  z: number
}

export interface FindCollectiblePickupOptions<TItem extends Pick<RacingGameCollectibleItem, 'id' | 'position'>> {
  items: TItem[]
  position: CollectiblePickupPosition
  collectionRadius?: number
}

export const DEFAULT_COLLECTIBLE_COLLECTION_RADIUS = 2

export const findCollectiblePickup = <TItem extends Pick<RacingGameCollectibleItem, 'id' | 'position'>>({
  items,
  position,
  collectionRadius = DEFAULT_COLLECTIBLE_COLLECTION_RADIUS
}: FindCollectiblePickupOptions<TItem>): TItem | null => {
  const collectionRadiusSq = collectionRadius * collectionRadius

  for (const item of items) {
    const dx = position.x - item.position.x
    const dz = position.z - item.position.z
    const distSq = dx * dx + dz * dz

    if (distSq < collectionRadiusSq) {
      return item
    }
  }

  return null
}

export const collectFirstNearbyItem = <TItem extends Pick<RacingGameCollectibleItem, 'id' | 'position'>>(
  options: FindCollectiblePickupOptions<TItem> & {
    onCollectItem?: (itemId: string) => void
  }
): TItem | null => {
  if (!options.onCollectItem || options.items.length === 0) {
    return null
  }

  const item = findCollectiblePickup(options)
  if (!item) {
    return null
  }

  options.onCollectItem(item.id)
  return item
}
