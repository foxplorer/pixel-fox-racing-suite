export const TRACK_POSITION_COUNTER_RESET_FRAMES = 1000
export const TRACK_POSITION_UPDATE_INTERVAL_FRAMES = 20
export const ON_TRACK_CHECK_INTERVAL_FRAMES = 5

export interface AdvanceTrackPositionFrameResult {
  frame: number
  shouldUpdateTrackPosition: boolean
}

export const advanceTrackPositionFrame = (
  frame: number,
  hasLastTrackPosition: boolean
): AdvanceTrackPositionFrameResult => {
  const nextFrame = (Number.isFinite(frame) && frame >= 0 ? frame + 1 : 1) % TRACK_POSITION_COUNTER_RESET_FRAMES

  return {
    frame: nextFrame,
    shouldUpdateTrackPosition: nextFrame % TRACK_POSITION_UPDATE_INTERVAL_FRAMES === 0 || !hasLastTrackPosition
  }
}

export const shouldRefreshOnTrackState = (frame: number): boolean => {
  return Number.isFinite(frame) && frame % ON_TRACK_CHECK_INTERVAL_FRAMES === 0
}
