import type { CarTrackDefinition } from './carTrackDefinitions'
import type { ImportedCarTrackId } from './importedCarTrackCatalog'
import { germanyTrackDefinition } from './imported/germany/germanyTrack'
import { unitedKingdomTrackDefinition } from './imported/unitedKingdom/unitedKingdomTrack'
import { volcanoesTrackDefinition } from './imported/volcanoes/volcanoesTrack'

export const IMPORTED_CAR_TRACK_DEFINITIONS = [
  unitedKingdomTrackDefinition,
  germanyTrackDefinition,
  volcanoesTrackDefinition
] satisfies CarTrackDefinition[]

export const IMPORTED_CAR_TRACK_DEFINITIONS_BY_ID: Readonly<Record<ImportedCarTrackId, CarTrackDefinition>> = {
  'united-kingdom': unitedKingdomTrackDefinition,
  germany: germanyTrackDefinition,
  volcanoes: volcanoesTrackDefinition
}

export const findImportedCarTrackDefinitionById = (
  id: ImportedCarTrackId | string | undefined
): CarTrackDefinition | undefined => {
  if (!id) return undefined
  return IMPORTED_CAR_TRACK_DEFINITIONS.find(definition => definition.trackId === id)
}
