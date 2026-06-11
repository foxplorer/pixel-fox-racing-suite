import type * as THREE from 'three'
import { trackCurve as australiaTrackCurve } from '../../components/foxracing/TrackData'
import { trackCurve as sanLuisTrackCurve } from '../../components/foxracingsanluis/TrackData'
import { trackCurve as belgiumTrackCurve } from '../../components/foxracingbelgium/TrackData'
import { trackCurve as aspenSnowmobileTrackCurve } from '../../components/snowmobilerace/TrackData'
import type { CarTrackDefinition } from './carTrackDefinitions'
import {
  getTrackEventDisplayName,
  getTrackEventsByVehicleMode,
  type TrackEventId,
  type TrackEventMetadata
} from './trackEvents'
import type { TrackId, VehicleMode } from './trackMetadata'

export interface TrackPreviewDefinition {
  trackName: string
  curve: THREE.CatmullRomCurve3
  vehicleMode: VehicleMode
  eventId?: TrackEventId
  trackId?: TrackId | string
}

const BUILT_IN_TRACK_PREVIEW_CURVES: Record<TrackId, THREE.CatmullRomCurve3> = {
  australia: australiaTrackCurve,
  'san-luis': sanLuisTrackCurve,
  belgium: belgiumTrackCurve,
  aspen: aspenSnowmobileTrackCurve
}

export const createTrackPreviewDefinitionFromEvent = (
  event: TrackEventMetadata
): TrackPreviewDefinition => {
  return {
    trackName: getTrackEventDisplayName(event),
    curve: BUILT_IN_TRACK_PREVIEW_CURVES[event.trackId],
    vehicleMode: event.vehicleMode,
    eventId: event.id,
    trackId: event.trackId
  }
}

export const createImportedCarTrackPreviewDefinition = (
  definition: CarTrackDefinition
): TrackPreviewDefinition => {
  return {
    trackName: definition.metadata.displayName,
    curve: definition.trackCurve,
    vehicleMode: 'car',
    trackId: definition.trackId
  }
}

export const getBuiltInTrackPreviewDefinitionsByVehicleMode = (
  vehicleMode: VehicleMode
): TrackPreviewDefinition[] => {
  return getTrackEventsByVehicleMode(vehicleMode).map(createTrackPreviewDefinitionFromEvent)
}

export const getTrackPreviewDefinitions = (
  vehicleModes: VehicleMode[],
  importedCarTracks: CarTrackDefinition[] = []
): TrackPreviewDefinition[] => {
  const requestedVehicleModes = new Set(vehicleModes)
  const builtInDefinitions = vehicleModes.flatMap(getBuiltInTrackPreviewDefinitionsByVehicleMode)
  const importedDefinitions = requestedVehicleModes.has('car')
    ? importedCarTracks.map(createImportedCarTrackPreviewDefinition)
    : []

  return [...builtInDefinitions, ...importedDefinitions]
}
