import type { ImportedCarTrackAuthoringMetadata } from './importedCarTrackAuthoring'

export type CarTrackIntegrationArea =
  | 'authoring'
  | 'rendering'
  | 'routing'
  | 'multiplayer'
  | 'stats'
  | 'transactions'
  | 'scenery'
  | 'terrain'

export interface CarTrackIntegrationChecklistItem {
  area: CarTrackIntegrationArea
  label: string
  required: boolean
  satisfied: boolean
  notes: string
}

export interface CarTrackIntegrationChecklistOptions {
  hasRuntimeDefinition?: boolean
  hasTrackEvent?: boolean
  socketAllowedTrackNames?: string[]
  statsSupportsDiscoveredTrackNames?: boolean
  transactionServerAcceptsArbitraryTrackName?: boolean
  hasSceneryFile?: boolean
  hasHeightProvider?: boolean
}

export const buildCarTrackIntegrationChecklist = (
  metadata: ImportedCarTrackAuthoringMetadata,
  options: CarTrackIntegrationChecklistOptions = {}
): CarTrackIntegrationChecklistItem[] => {
  const socketAllowedTrackNames = options.socketAllowedTrackNames ?? []
  const expectsExternalHeight = metadata.terrain.heightProvider !== 'constant'

  return [
    {
      area: 'authoring',
      label: 'Track name and GeoJSON source',
      required: true,
      satisfied: Boolean(metadata.displayName && metadata.layout.curveSource.endsWith('.json')),
      notes: 'A contributor track needs a display name and a .json GeoJSON circuit source.'
    },
    {
      area: 'authoring',
      label: 'Start gate pose and size',
      required: true,
      satisfied: Boolean(metadata.start.position && metadata.start.directionVector && metadata.start.gateWidth > 0),
      notes: 'Start position, direction, gate width, and lap-crossing dimensions must be explicit.'
    },
    {
      area: 'rendering',
      label: 'Runtime car-track definition',
      required: true,
      satisfied: options.hasRuntimeDefinition ?? false,
      notes: 'The imported metadata must be paired with runtime curve, frames, length, and gate presentation data.'
    },
    {
      area: 'routing',
      label: 'Track event registration',
      required: true,
      satisfied: options.hasTrackEvent ?? false,
      notes: 'The track must be reachable through the event/showroom routing layer before it is playable.'
    },
    {
      area: 'multiplayer',
      label: 'Socket server accepts track name',
      required: true,
      satisfied: socketAllowedTrackNames.includes(metadata.displayName),
      notes: 'Set socket-server VALID_TRACK_NAMES so same-track remote filtering and Current Players state work.'
    },
    {
      area: 'stats',
      label: 'Stats discover track name from lap records',
      required: true,
      satisfied: options.statsSupportsDiscoveredTrackNames ?? true,
      notes: 'Pixel Racing stats groups by lap-result trackname, so new names appear once records are emitted.'
    },
    {
      area: 'transactions',
      label: 'Transaction server trackname policy',
      required: true,
      satisfied: options.transactionServerAcceptsArbitraryTrackName ?? true,
      notes: 'The current transaction server passes non-empty trackname through; tighten this only if server-side validation is added.'
    },
    {
      area: 'scenery',
      label: 'Scenery file or preset',
      required: true,
      satisfied: Boolean(options.hasSceneryFile || metadata.contributorSceneryFile || metadata.scenery.preset),
      notes: 'Track-specific scenery belongs outside the shared car-track shell.'
    },
    {
      area: 'terrain',
      label: 'Road-corridor height readiness',
      required: expectsExternalHeight,
      satisfied: !expectsExternalHeight || Boolean(options.hasHeightProvider),
      notes: expectsExternalHeight
        ? 'Hilly tracks need a height provider that can be sampled through the road-corridor terrain path.'
        : 'Flat tracks can start with constant height while keeping road-corridor metadata ready.'
    }
  ]
}

export const getMissingRequiredCarTrackIntegrationItems = (
  items: CarTrackIntegrationChecklistItem[]
): CarTrackIntegrationChecklistItem[] => {
  return items.filter(item => item.required && !item.satisfied)
}
