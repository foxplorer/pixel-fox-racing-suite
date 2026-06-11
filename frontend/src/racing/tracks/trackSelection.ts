import type { CarTrackDefinition } from './carTrackDefinitions'
import { findTrackEventByDisplayName, type TrackEventMetadata } from './trackEvents'
import type { VehicleMode } from './trackMetadata'

export type ResolvedTrackSelection =
  | {
      kind: 'official-event'
      event: TrackEventMetadata
    }
  | {
      kind: 'imported-car-track'
      definition: CarTrackDefinition
    }

export const findImportedCarTrackByDisplayName = (
  trackName: string,
  importedCarTracks: CarTrackDefinition[] = []
): CarTrackDefinition | undefined => {
  return importedCarTracks.find(definition => definition.metadata.displayName === trackName)
}

export const resolveTrackSelectionByDisplayName = (
  trackName: string,
  options: {
    vehicleMode?: VehicleMode
    importedCarTracks?: CarTrackDefinition[]
  } = {}
): ResolvedTrackSelection | undefined => {
  const event = findTrackEventByDisplayName(trackName, options.vehicleMode)
  if (event) {
    return {
      kind: 'official-event',
      event
    }
  }

  if (options.vehicleMode && options.vehicleMode !== 'car') {
    return undefined
  }

  const importedCarTrack = findImportedCarTrackByDisplayName(trackName, options.importedCarTracks)
  if (!importedCarTrack) return undefined

  return {
    kind: 'imported-car-track',
    definition: importedCarTrack
  }
}
