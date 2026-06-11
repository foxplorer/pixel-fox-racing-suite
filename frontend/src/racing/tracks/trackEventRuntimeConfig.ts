import { getTrackEventMetadata, type TrackEventId, type TrackEventMetadata } from './trackEvents'
import { getTrackRuntimeConfig, type TrackRuntimeConfig } from './trackRuntimeConfig'

export interface TrackEventRuntimeConfig {
  event: TrackEventMetadata
  track: TrackRuntimeConfig
}

export const getTrackEventRuntimeConfig = (
  eventId: TrackEventId
): TrackEventRuntimeConfig => {
  const event = getTrackEventMetadata(eventId)

  return {
    event,
    track: getTrackRuntimeConfig(event.trackId)
  }
}
