export type RacingCollectibleType = 'blueberry' | 'salad' | 'rabbit'

export type RacingCollectibleImageUrls = Record<RacingCollectibleType, string>

export interface RacingGameCollectibleItem {
  id: string
  type: RacingCollectibleType
  position: { x: number; y: number; z: number }
  value: number
}
