import * as THREE from 'three'
import { getCurveStartPose } from '../core/trackGeometry'
import { getTrackMetadata, type TrackId } from './trackMetadata'

export interface TrackStartPose {
  position: THREE.Vector3
  direction: THREE.Vector3
  curveT?: number
  straightLength?: number
}

const vectorFromTuple = (value: readonly [number, number, number], fieldName: string): THREE.Vector3 => {
  const vector = new THREE.Vector3(value[0], value[1], value[2])
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || !Number.isFinite(vector.z)) {
    throw new Error(`Invalid ${fieldName}: expected finite x/y/z values`)
  }
  return vector
}

const normalizeStartDirection = (direction: THREE.Vector3, trackId: TrackId): THREE.Vector3 => {
  if (direction.lengthSq() === 0) {
    throw new Error(`Invalid start direction for ${trackId}: direction cannot be zero`)
  }
  const normalized = direction.normalize()
  normalized.set(
    Object.is(normalized.x, -0) ? 0 : normalized.x,
    Object.is(normalized.y, -0) ? 0 : normalized.y,
    Object.is(normalized.z, -0) ? 0 : normalized.z
  )
  return normalized
}

export const findLongestStraightStartPose = (
  trackCurve: THREE.Curve<THREE.Vector3>,
  {
    samples = 1000,
    straightThreshold = 0.05
  }: {
    samples?: number
    straightThreshold?: number
  } = {}
): Required<Pick<TrackStartPose, 'position' | 'direction' | 'curveT' | 'straightLength'>> => {
  const points: THREE.Vector3[] = []
  const tangents: THREE.Vector3[] = []

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples
    points.push(trackCurve.getPointAt(t))
    tangents.push(trackCurve.getTangentAt(t).normalize())
  }

  let longestStraightLength = 0
  let longestStraightStart = 0
  let longestStraightEnd = 0
  let currentStraightStart = 0
  let currentStraightLength = 0

  for (let i = 1; i < points.length; i += 1) {
    const prevTangent = tangents[i - 1]
    const currTangent = tangents[i]
    const angleChange = Math.acos(Math.min(1, Math.max(-1, prevTangent.dot(currTangent))))

    if (angleChange < straightThreshold) {
      currentStraightLength += points[i].distanceTo(points[i - 1])
    } else {
      if (currentStraightLength > longestStraightLength) {
        longestStraightLength = currentStraightLength
        longestStraightStart = currentStraightStart
        longestStraightEnd = i - 1
      }
      currentStraightStart = i
      currentStraightLength = 0
    }
  }

  if (currentStraightLength > longestStraightLength) {
    longestStraightLength = currentStraightLength
    longestStraightStart = currentStraightStart
    longestStraightEnd = points.length - 1
  }

  const startT = longestStraightStart / samples
  const endT = longestStraightEnd / samples
  const curveT = (startT + endT) / 2

  return {
    position: trackCurve.getPointAt(curveT),
    direction: trackCurve.getTangentAt(curveT).normalize(),
    curveT,
    straightLength: longestStraightLength
  }
}

export const resolveTrackStartPose = (trackId: TrackId, trackCurve?: THREE.Curve<THREE.Vector3>): TrackStartPose => {
  const metadata = getTrackMetadata(trackId)
  const start = metadata.start

  if (start.method === 'explicit-pose') {
    if (!start.position || !start.directionVector) {
      throw new Error(`Track ${trackId} uses explicit start pose but is missing position or directionVector metadata`)
    }

    return {
      position: vectorFromTuple(start.position, `${trackId}.start.position`),
      direction: normalizeStartDirection(vectorFromTuple(start.directionVector, `${trackId}.start.directionVector`), trackId)
    }
  }

  if (start.method === 'curve-t') {
    if (!trackCurve) {
      throw new Error(`Track ${trackId} uses curve-t start pose but no runtime curve was provided`)
    }
    if (start.curveT === undefined) {
      throw new Error(`Track ${trackId} uses curve-t start pose but is missing curveT metadata`)
    }

    const pose = getCurveStartPose(trackCurve, start.curveT)
    const direction = start.direction === 'negated-tangent'
      ? pose.direction.clone().negate()
      : pose.direction.clone()

    return {
      position: pose.position,
      direction: normalizeStartDirection(direction, trackId),
      curveT: start.curveT
    }
  }

  if (start.method === 'derived-longest-straight') {
    if (!trackCurve) {
      throw new Error(`Track ${trackId} uses derived-longest-straight start pose but no runtime curve was provided`)
    }

    const pose = findLongestStraightStartPose(trackCurve)
    const direction = start.direction === 'negated-tangent'
      ? pose.direction.clone().negate()
      : pose.direction.clone()

    return {
      position: pose.position,
      direction: normalizeStartDirection(direction, trackId),
      curveT: pose.curveT,
      straightLength: pose.straightLength
    }
  }

  throw new Error(`Unsupported start pose method for ${trackId}: ${start.method}`)
}
