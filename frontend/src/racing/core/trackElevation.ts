import * as THREE from 'three'

export interface TrackElevationSample {
  height: number
  normal: THREE.Vector3
  roadInfluence: number
  source: 'flat' | 'procedural' | 'sampled' | 'authored'
}

export interface TrackElevationProvider {
  sample(x: number, z: number, trackT?: number): TrackElevationSample
}

export const WORLD_UP = new THREE.Vector3(0, 1, 0)

export const createFlatElevationProvider = (
  height = 0,
  source: TrackElevationSample['source'] = 'flat'
): TrackElevationProvider => {
  return {
    sample: () => ({
      height,
      normal: WORLD_UP.clone(),
      roadInfluence: 1,
      source
    })
  }
}

export const createFunctionElevationProvider = (
  getHeight: (x: number, z: number, trackT?: number) => number,
  options: {
    source: TrackElevationSample['source']
    normalSampleDistance?: number
  }
): TrackElevationProvider => {
  const normalSampleDistance = options.normalSampleDistance ?? 1

  return {
    sample: (x, z, trackT) => {
      const height = getHeight(x, z, trackT)
      const left = getHeight(x - normalSampleDistance, z, trackT)
      const right = getHeight(x + normalSampleDistance, z, trackT)
      const down = getHeight(x, z - normalSampleDistance, trackT)
      const up = getHeight(x, z + normalSampleDistance, trackT)
      const normal = new THREE.Vector3(left - right, normalSampleDistance * 2, down - up).normalize()

      return {
        height,
        normal,
        roadInfluence: 0,
        source: options.source
      }
    }
  }
}

export const applyRoadClearance = (
  sample: TrackElevationSample,
  roadClearance: number
): TrackElevationSample => {
  return {
    ...sample,
    height: sample.height + roadClearance
  }
}
