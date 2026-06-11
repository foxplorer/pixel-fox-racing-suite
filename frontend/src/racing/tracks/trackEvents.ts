import { getTrackMetadata } from './trackMetadata'
import type { HandlingModel, TrackId, VehicleMode } from './trackMetadata'

export type TrackEventId =
  | 'australia-car'
  | 'san-luis-car'
  | 'belgium-car'
  | 'aspen-snowmobile'

export interface TrackEventMetadata {
  id: TrackEventId
  trackId: TrackId
  vehicleMode: VehicleMode
  handlingModel: HandlingModel
  defaultCameraPreset: 'car-standard' | 'snowmobile-standard'
  wallCollisionMode: 'track-default' | 'vehicle-barriers' | 'invisible-high-walls'
  notes: string
}

export const TRACK_EVENT_METADATA: Record<TrackEventId, TrackEventMetadata> = {
  'australia-car': {
    id: 'australia-car',
    trackId: 'australia',
    vehicleMode: 'car',
    handlingModel: 'shared-car',
    defaultCameraPreset: 'car-standard',
    wallCollisionMode: 'vehicle-barriers',
    notes: 'Standard shared-car event on the Australia country-themed track.'
  },
  'san-luis-car': {
    id: 'san-luis-car',
    trackId: 'san-luis',
    vehicleMode: 'car',
    handlingModel: 'shared-car',
    defaultCameraPreset: 'car-standard',
    wallCollisionMode: 'track-default',
    notes: 'Narrow custom San Luis car event.'
  },
  'belgium-car': {
    id: 'belgium-car',
    trackId: 'belgium',
    vehicleMode: 'car',
    handlingModel: 'shared-car',
    defaultCameraPreset: 'car-standard',
    wallCollisionMode: 'vehicle-barriers',
    notes: 'Standard shared-car event on the flat Belgium country-themed track.'
  },
  'aspen-snowmobile': {
    id: 'aspen-snowmobile',
    trackId: 'aspen',
    vehicleMode: 'snowmobile',
    handlingModel: 'snowmobile',
    defaultCameraPreset: 'snowmobile-standard',
    wallCollisionMode: 'invisible-high-walls',
    notes: 'Snowmobile event uses high invisible wall collision because sleds can jump over visible boards.'
  }
}

export const TRACK_EVENT_IDS = Object.keys(TRACK_EVENT_METADATA) as TrackEventId[]

export const getTrackEventMetadata = (eventId: TrackEventId): TrackEventMetadata => {
  return TRACK_EVENT_METADATA[eventId]
}

export const getTrackEventsByVehicleMode = (vehicleMode: VehicleMode): TrackEventMetadata[] => {
  return TRACK_EVENT_IDS
    .map(getTrackEventMetadata)
    .filter(event => event.vehicleMode === vehicleMode)
}

export const getTrackEventDisplayName = (event: TrackEventMetadata): string => {
  return getTrackMetadata(event.trackId).displayName
}

export const findTrackEventByDisplayName = (
  trackName: string,
  vehicleMode?: VehicleMode
): TrackEventMetadata | undefined => {
  return TRACK_EVENT_IDS
    .map(getTrackEventMetadata)
    .find(event => {
      const isDisplayNameMatch = getTrackEventDisplayName(event) === trackName
      return isDisplayNameMatch && (!vehicleMode || event.vehicleMode === vehicleMode)
    })
}

export const OFFICIAL_TRACK_DISPLAY_NAMES = Array.from(
  new Set(TRACK_EVENT_IDS.map(eventId => getTrackEventDisplayName(getTrackEventMetadata(eventId))))
)

export const isOfficialTrackDisplayName = (trackName: string): boolean => {
  return OFFICIAL_TRACK_DISPLAY_NAMES.includes(trackName)
}
