import {
  VOXEL_REFERENCE_BACKGROUNDS,
  type VoxelBackgroundStrategy
} from './referenceBackgrounds'

export type VoxelBackgroundRemovalStrategy = VoxelBackgroundStrategy | 'default'

export type VoxelPixel = {
  r: number
  g: number
  b: number
  a: number
}

const TRANSPARENT_ALPHA_THRESHOLD = 20
const REFERENCE_BACKGROUND_COLOR_TOLERANCE = 32

export const normalizeVoxelBackgroundTrait = (background?: string | null): string =>
  (background || '').trim().toLowerCase().replace(/\s+/g, ' ')

export const getVoxelBackgroundStrategy = (
  background?: string | null
): VoxelBackgroundRemovalStrategy => {
  const normalized = normalizeVoxelBackgroundTrait(background)
  if (normalized === 'green smoke') return 'green_smoke'
  if (normalized === 'noir') return 'noir'
  if (normalized === 'sleepless nights') return 'sleepless_nights'
  return 'default'
}

const getColorDistance = (c1: VoxelPixel, c2: VoxelPixel): number => Math.sqrt(
  Math.pow(c1.r - c2.r, 2) +
  Math.pow(c1.g - c2.g, 2) +
  Math.pow(c1.b - c2.b, 2)
)

export const buildReferenceBackgroundMask = (
  gridColors: VoxelPixel[][],
  strategy?: VoxelBackgroundRemovalStrategy | null
): boolean[][] | null => {
  if (!strategy || strategy === 'default') return null

  const referenceGrid = VOXEL_REFERENCE_BACKGROUNDS[strategy]
  if (!referenceGrid) return null

  return gridColors.map((row, y) => row.map((targetCell, x) => {
    const referenceCell = referenceGrid[y]?.[x]
    if (!referenceCell) return false

    const [r, g, b, a] = referenceCell
    if (a < TRANSPARENT_ALPHA_THRESHOLD) return false
    if (targetCell.a < TRANSPARENT_ALPHA_THRESHOLD) return false

    return getColorDistance(targetCell, { r, g, b, a }) <= REFERENCE_BACKGROUND_COLOR_TOLERANCE
  }))
}
