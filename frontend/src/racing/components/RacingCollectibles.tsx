import React from 'react'
import type { RacingGameCollectibleItem } from '../collectibles/collectibleTypes'
import type { TerrainHeightSampler } from '../core/roadCorridor'
import { CollectibleItem } from './CollectibleItem'

interface RacingCollectiblesProps {
  items: RacingGameCollectibleItem[]
  getHeightAtPosition?: TerrainHeightSampler
}

export const RacingCollectibles: React.FC<RacingCollectiblesProps> = ({ items, getHeightAtPosition }) => (
  <>
    {items.map((item) => (
      <CollectibleItem
        key={item.id}
        id={item.id}
        type={item.type}
        position={[
          item.position.x,
          (getHeightAtPosition?.(item.position.x, item.position.z) ?? 0) + item.position.y,
          item.position.z
        ]}
      />
    ))}
  </>
)
