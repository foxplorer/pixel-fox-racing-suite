import { OFFICIAL_TRACK_DISPLAY_NAMES } from './trackEvents'
import { IMPORTED_CAR_TRACK_DISPLAY_NAMES } from './importedCarTrackCatalog'

export const IMPORTED_TRACK_DISPLAY_NAMES = IMPORTED_CAR_TRACK_DISPLAY_NAMES

export const SUBMITTABLE_TRACK_DISPLAY_NAMES = [
  ...OFFICIAL_TRACK_DISPLAY_NAMES,
  ...IMPORTED_TRACK_DISPLAY_NAMES
] as const

export const isSubmittableTrackDisplayName = (trackName: string): boolean => {
  return SUBMITTABLE_TRACK_DISPLAY_NAMES.includes(trackName as typeof SUBMITTABLE_TRACK_DISPLAY_NAMES[number])
}
