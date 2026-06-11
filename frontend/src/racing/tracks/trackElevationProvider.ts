import {
  applyRoadClearance,
  createFlatElevationProvider,
  createFunctionElevationProvider,
  type TrackElevationProvider,
  type TrackElevationSample
} from '../core/trackElevation'
import { getTrackMetadata, type TrackAuthoringMetadata, type TrackId } from './trackMetadata'

type ExternalHeightProvider = (x: number, z: number, trackT?: number) => number

export interface TrackElevationProviderOptions {
  getHeight?: ExternalHeightProvider
  includeRoadClearance?: boolean
}

const elevationSourceToSampleSource = (
  metadata: TrackAuthoringMetadata
): TrackElevationSample['source'] => {
  switch (metadata.terrain.currentElevationSource) {
    case 'procedural':
      return 'procedural'
    case 'sampled-real-world':
      return 'sampled'
    case 'authored':
      return 'authored'
    case 'none':
      return 'flat'
  }
}

const withOptionalRoadClearance = (
  provider: TrackElevationProvider,
  roadClearance: number,
  includeRoadClearance: boolean
): TrackElevationProvider => {
  if (!includeRoadClearance || roadClearance === 0) {
    return provider
  }

  return {
    sample: (x, z, trackT) => applyRoadClearance(provider.sample(x, z, trackT), roadClearance)
  }
}

export const createTrackElevationProvider = (
  trackId: TrackId,
  options: TrackElevationProviderOptions = {}
): TrackElevationProvider => {
  const metadata = getTrackMetadata(trackId)
  const includeRoadClearance = options.includeRoadClearance ?? false

  if (metadata.terrain.heightProvider === 'constant') {
    return withOptionalRoadClearance(
      createFlatElevationProvider(0, 'flat'),
      metadata.terrain.roadClearance,
      includeRoadClearance
    )
  }

  if (!options.getHeight) {
    throw new Error(`${trackId} requires an external terrain height provider`)
  }

  return withOptionalRoadClearance(
    createFunctionElevationProvider(options.getHeight, {
      source: elevationSourceToSampleSource(metadata)
    }),
    metadata.terrain.roadClearance,
    includeRoadClearance
  )
}
