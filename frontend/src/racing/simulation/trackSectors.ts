export interface TrackSectorDefinition {
  index: number
  startT: number
  endT: number
}

export const createEvenTrackSectors = (sectorCount: number): TrackSectorDefinition[] => {
  if (!Number.isInteger(sectorCount) || sectorCount <= 0) {
    throw new Error('sectorCount must be a positive integer')
  }

  return Array.from({ length: sectorCount }, (_, index) => ({
    index,
    startT: index / sectorCount,
    endT: (index + 1) / sectorCount
  }))
}

export const getSectorIndexForTrackT = (
  trackT: number,
  sectors: TrackSectorDefinition[]
): number | null => {
  if (sectors.length === 0 || !Number.isFinite(trackT)) {
    return null
  }

  const normalizedT = ((trackT % 1) + 1) % 1
  const sector = sectors.find(({ startT, endT }) => normalizedT >= startT && normalizedT < endT)

  return sector?.index ?? sectors[sectors.length - 1].index
}
