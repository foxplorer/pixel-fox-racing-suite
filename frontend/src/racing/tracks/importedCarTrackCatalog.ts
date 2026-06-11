export const IMPORTED_CAR_TRACK_CATALOG = [
  {
    id: 'united-kingdom',
    displayName: 'United Kingdom'
  },
  {
    id: 'germany',
    displayName: 'Germany'
  }
] as const

export type ImportedCarTrackId = typeof IMPORTED_CAR_TRACK_CATALOG[number]['id']
export type ImportedCarTrackDisplayName = typeof IMPORTED_CAR_TRACK_CATALOG[number]['displayName']

export const IMPORTED_CAR_TRACK_DISPLAY_NAMES = IMPORTED_CAR_TRACK_CATALOG.map(track => track.displayName)

export const findImportedCarTrackCatalogEntryByDisplayName = (
  displayName: string
): typeof IMPORTED_CAR_TRACK_CATALOG[number] | undefined => {
  return IMPORTED_CAR_TRACK_CATALOG.find(track => track.displayName === displayName)
}
