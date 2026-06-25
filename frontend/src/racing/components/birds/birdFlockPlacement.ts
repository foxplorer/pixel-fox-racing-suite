import * as THREE from 'three'
import { SeededRandom } from '../../core/seededRandom'
import { getQualityScaledCount } from '../../performance/sceneryQuality'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import type { TerrainHeightSampler } from '../../core/roadCorridor'

// A single bird's flight is a slow horizontal orbit around a flock centre, animated
// entirely in the shader from these parameters so the CPU never touches per-frame
// positions. Birds sharing a flock orbit the same centre at a similar radius/speed so
// they read as a loose group drifting over the track.
export interface BirdPlacement {
  centerX: number
  centerY: number
  centerZ: number
  radius: number
  angularSpeed: number
  phase: number
  flapSpeed: number
  scale: number
}

export interface BirdFlockOptions {
  baseCount?: number
  minimumCount?: number
  birdsPerFlock?: number
  seed?: number
  minAltitude?: number
  maxAltitude?: number
  spreadFromTrack?: number
}

const DEFAULTS = {
  // Quality scaling yields roughly 24 / 36 / 48 birds for Low / Medium / High.
  baseCount: 48,
  minimumCount: 10,
  birdsPerFlock: 6,
  seed: 73000,
  minAltitude: 55,
  maxAltitude: 130,
  spreadFromTrack: 140
}

export const createBirdFlockPlacements = (
  trackCurve: THREE.CatmullRomCurve3,
  qualityPreset: RacingQualityPreset,
  getHeightAtPosition?: TerrainHeightSampler,
  options: BirdFlockOptions = {}
): BirdPlacement[] => {
  const resolved = { ...DEFAULTS, ...options }
  const count = getQualityScaledCount(resolved.baseCount, qualityPreset, resolved.minimumCount)
  if (count <= 0) return []

  const rng = new SeededRandom(resolved.seed + count)
  const flockCount = Math.max(1, Math.ceil(count / resolved.birdsPerFlock))
  const birds: BirdPlacement[] = []

  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  for (let flock = 0; flock < flockCount && birds.length < count; flock++) {
    const t = (flock + rng.next()) / flockCount
    trackCurve.getPointAt(t % 1, point)
    trackCurve.getTangentAt(t % 1, tangent).normalize()
    right.copy(up).cross(tangent).normalize()

    const side = rng.next() < 0.5 ? -1 : 1
    const lateral = rng.next() * resolved.spreadFromTrack
    const along = (rng.next() - 0.5) * 60
    const centerX = point.x + right.x * side * lateral + tangent.x * along
    const centerZ = point.z + right.z * side * lateral + tangent.z * along
    const ground = getHeightAtPosition?.(centerX, centerZ) ?? 0
    const altitude = resolved.minAltitude + rng.next() * (resolved.maxAltitude - resolved.minAltitude)
    const flockRadius = 28 + rng.next() * 46
    const angularSpeed = (0.12 + rng.next() * 0.16) * (rng.next() < 0.5 ? -1 : 1)
    const basePhase = rng.next() * Math.PI * 2
    const flockFlap = 7 + rng.next() * 3

    const flockSize = Math.min(resolved.birdsPerFlock, count - birds.length)
    for (let i = 0; i < flockSize; i++) {
      birds.push({
        centerX,
        centerY: ground + altitude + (rng.next() - 0.5) * 12,
        centerZ,
        radius: flockRadius * (0.82 + rng.next() * 0.34),
        angularSpeed,
        phase: basePhase + i * 0.22 + (rng.next() - 0.5) * 0.4,
        flapSpeed: flockFlap * (0.9 + rng.next() * 0.2),
        scale: 4.5 + rng.next() * 3
      })
    }
  }

  return birds
}
