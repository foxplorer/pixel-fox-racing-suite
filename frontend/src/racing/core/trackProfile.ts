export interface TrackSurfaceProfile {
  trackWidth: number
  shoulderWidth: number
}

export type TrackProfileKey = 'standard-car' | 'san-luis' | 'snow'

export const STANDARD_CAR_TRACK_PROFILE: TrackSurfaceProfile = {
  trackWidth: 18,
  shoulderWidth: 30
}

export const SAN_LUIS_TRACK_PROFILE: TrackSurfaceProfile = {
  trackWidth: 12,
  shoulderWidth: 30
}

export const SNOW_TRACK_PROFILE: TrackSurfaceProfile = {
  trackWidth: 18,
  shoulderWidth: 30
}

export const TRACK_SURFACE_PROFILES: Record<TrackProfileKey, TrackSurfaceProfile> = {
  'standard-car': STANDARD_CAR_TRACK_PROFILE,
  'san-luis': SAN_LUIS_TRACK_PROFILE,
  snow: SNOW_TRACK_PROFILE
}

export const getTrackSurfaceProfile = (profileKey: TrackProfileKey): TrackSurfaceProfile => {
  return TRACK_SURFACE_PROFILES[profileKey]
}

export const getTotalTrackWidth = (profile: TrackSurfaceProfile): number => {
  return profile.trackWidth + profile.shoulderWidth
}

export const getTrackRadius = (profile: TrackSurfaceProfile): number => {
  return profile.trackWidth / 2
}

export const getTrackEdgeClearance = (
  profile: TrackSurfaceProfile,
  clearanceFromEdge: number
): number => {
  return getTrackRadius(profile) + clearanceFromEdge
}

export const getCenterlineOffset = (
  profile: TrackSurfaceProfile,
  extraOffset = 0
): number => {
  return profile.trackWidth + extraOffset
}
