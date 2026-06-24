import * as THREE from 'three'
import { SeededRandom } from '../../../core/seededRandom'
import type { TerrainHeightSampler } from '../../../core/roadCorridor'
import type { RacingQualityPreset } from '../../../performance/qualitySettings'
import {
  createBillboardForestPlacements,
  type BillboardForestOptions
} from '../../../components/forest/billboardForestPlacement'
import type { CarJumpZone } from '../../../vehicles/carJump'
import type { CarRampZone } from '../../../vehicles/carRamp'

export interface VolcanoRockPlacement {
  x: number
  z: number
  scale: number
  rotation: number
  variant: number
}

export interface LavaCrossingPlacement {
  x: number
  z: number
  angle: number
  width: number
  length: number
  phase: number
  /** Normalized arc-length position of the pit on the track curve (0..1). */
  t: number
}

export interface LavaBasinPlacement {
  centerX: number
  centerZ: number
  radius: number
  boundary: Array<{ x: number; z: number }>
}

export interface LavaTrackInterval {
  startT: number
  endT: number
}

export interface LavaPitPool {
  /** Local origin (the pool centroid) the geometry is built around. */
  centerX: number
  centerZ: number
  /** Travel centerline samples from mid up-ramp to mid down-ramp, world XZ. */
  centerline: Array<{ x: number; z: number }>
  /**
   * The two amoeba edges, one entry per centerline sample (world XZ). They taper to
   * the centerline at both ends (rounded caps) and bulge through the middle. Built
   * as parallel rows so the renderer can sweep a terrain-draped ribbon between them
   * rather than a single flat plane (which floats/buries on sloped pits).
   */
  leftEdge: Array<{ x: number; z: number }>
  rightEdge: Array<{ x: number; z: number }>
  /** Base half-width across the track (for ember scatter / lighting). */
  halfWidth: number
}

export interface VolcanoCavePlacements {
  rocks: VolcanoRockPlacement[]
  lavaBasin: LavaBasinPlacement
  lavaCrossings: LavaCrossingPlacement[]
}

// Five molten pits straddling the racing line around the lap — fixed across all
// quality presets so the layout (and the jumps that will follow) is consistent.
const LAVA_PIT_COUNT = 5

const ROCK_FOREST_OPTIONS = (
  exclusionZones: BillboardForestOptions['exclusionZones']
): BillboardForestOptions => ({
  baseCount: 2600,
  minimumCount: 800,
  variantCount: 4,
  seed: 73000,
  // Hug the track tightly so the rock walls feel like a cave corridor.
  minDistanceFromTrack: 26,
  maxDistanceFromTrack: 300,
  minHeight: 10,
  maxHeight: 52,
  edgeBias: 1.5,
  exclusionZones
})

const BASIN_BOUNDARY_SAMPLE_COUNT = 160
const BASIN_INSET_SCALE = 0.58

export const createVolcanoLavaBasin = (
  trackCurve: THREE.CatmullRomCurve3
): LavaBasinPlacement => {
  const samples: THREE.Vector3[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (let i = 0; i < BASIN_BOUNDARY_SAMPLE_COUNT; i++) {
    const point = trackCurve.getPointAt(i / BASIN_BOUNDARY_SAMPLE_COUNT)
    samples.push(point.clone())
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const boundary = samples.map(point => ({
    x: centerX + (point.x - centerX) * BASIN_INSET_SCALE,
    z: centerZ + (point.z - centerZ) * BASIN_INSET_SCALE
  }))
  const radius = boundary.reduce((largest, point) => {
    const dx = point.x - centerX
    const dz = point.z - centerZ
    return Math.max(largest, Math.sqrt(dx * dx + dz * dz))
  }, 0)

  return { centerX, centerZ, radius, boundary }
}

const isPointInsidePolygon = (
  point: { x: number; z: number },
  polygon: Array<{ x: number; z: number }>
): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const intersects = (a.z > point.z) !== (b.z > point.z)
      && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

// The lava sheet floats just above the lowest terrain inside the basin so it reads
// as a pool settled in the bottom of the bowl. Shared by the visual plane and the
// (height-aware) collision gate so both agree on exactly where molten lava sits.
export const LAVA_BASIN_SURFACE_OFFSET = 0.35

const BASIN_HEIGHT_SAMPLE_STEPS = 32

// Lowest terrain height anywhere inside the basin outline (the plane the lava sheet
// rests on). Where the terrain rises above this, rock pokes through the lava.
const sampleLowestBasinHeight = (
  basin: LavaBasinPlacement,
  sampler: TerrainHeightSampler | undefined
): number => {
  if (!sampler) return -3

  const xs = basin.boundary.map(point => point.x)
  const zs = basin.boundary.map(point => point.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  let lowest = Infinity

  for (let zIndex = 0; zIndex <= BASIN_HEIGHT_SAMPLE_STEPS; zIndex++) {
    const z = minZ + ((maxZ - minZ) * zIndex) / BASIN_HEIGHT_SAMPLE_STEPS
    for (let xIndex = 0; xIndex <= BASIN_HEIGHT_SAMPLE_STEPS; xIndex++) {
      const x = minX + ((maxX - minX) * xIndex) / BASIN_HEIGHT_SAMPLE_STEPS
      if (!isPointInsidePolygon({ x, z }, basin.boundary)) continue
      lowest = Math.min(lowest, sampler(x, z))
    }
  }

  return Number.isFinite(lowest) ? lowest : sampler(basin.centerX, basin.centerZ)
}

// Y of the visible lava sheet over the central basin. Both the rendered plane
// (VolcanoCaveScenery) and the collision gate (FoxRacingWorld) read this so the
// kill zone lines up with the lava the player can actually see.
export const computeLavaBasinSurfaceY = (
  basin: LavaBasinPlacement,
  sampler: TerrainHeightSampler | undefined
): number => sampleLowestBasinHeight(basin, sampler) + LAVA_BASIN_SURFACE_OFFSET

// Lava "pits" the track jumps over: molten gaps cutting straight across the
// racing line at five evenly spaced points around the lap. `length` runs along
// the direction of travel (the gap the car launches over) and `width` spans
// across the track (wider than the road so the pit clearly severs it). Shared by
// the scenery (visual slabs + ramps) and by the car jump zones so both agree on
// exactly where the pits are.
export const createLavaCrossings = (
  trackCurve: THREE.CatmullRomCurve3
): LavaCrossingPlacement[] => {
  const crossingRng = new SeededRandom(60600 + LAVA_PIT_COUNT)
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const lavaCrossings: LavaCrossingPlacement[] = []
  for (let i = 0; i < LAVA_PIT_COUNT; i++) {
    const t = (i + 0.5) / LAVA_PIT_COUNT
    trackCurve.getPointAt(t, point)
    trackCurve.getTangentAt(t, tangent).normalize()
    lavaCrossings.push({
      x: point.x,
      z: point.z,
      angle: Math.atan2(tangent.x, tangent.z),
      // Spans far beyond the racing surface (well into the flanking rock field) so
      // the fox can't simply steer around the side of the pit to skip the jump.
      width: 150 + crossingRng.next() * 70,
      // Gap along the direction of travel — the distance the car launches over.
      // Long enough that the takeoff and landing ramps sit well apart with a real
      // pit between them (the jump zone / ramp lips derive from this).
      length: 56 + crossingRng.next() * 20,
      phase: crossingRng.next() * Math.PI * 2,
      t
    })
  }
  return lavaCrossings
}

// Geometry of the takeoff/landing ramps flanking each pit. Shared by the scenery
// (the visual slabs) and the car-ramp surface field (the height the car climbs) so
// the car physically rides up exactly the ramp the player sees. `RAMP_LENGTH` is
// the run from ground up to the lip; `RAMP_LIP_HEIGHT` the height gained over it.
export const LAVA_PIT_RAMP_LENGTH = 26
// Only slightly wider than the 18-unit road, so the ramp reads as the track itself
// with a small shoulder either side rather than a giant launch pad.
export const LAVA_PIT_RAMP_WIDTH = 24
export const LAVA_PIT_RAMP_LIP_HEIGHT = 6

// Visual lava should run under the middle of the takeoff and landing ramps: from
// halfway down one ramp, across the open gap, to halfway down the opposite ramp.
export const getLavaCrossingVisualHalfLength = (crossing: LavaCrossingPlacement): number =>
  crossing.length / 2 + LAVA_PIT_RAMP_LENGTH / 2

const wrapTrackT = (t: number): number => {
  const wrapped = t % 1
  return wrapped < 0 ? wrapped + 1 : wrapped
}

export const createVolcanoLavaPitRoadExclusionIntervals = (
  trackCurve: THREE.CatmullRomCurve3
): LavaTrackInterval[] => {
  const curveLength = trackCurve.getLength()
  return createLavaCrossings(trackCurve).map(crossing => {
    const halfT = getLavaCrossingVisualHalfLength(crossing) / curveLength
    return {
      startT: wrapTrackT(crossing.t - halfT),
      endT: wrapTrackT(crossing.t + halfT)
    }
  })
}

// Smooth amoeba lava pools for the five jump pits. Each pool hugs the actual
// (curving) racing line from halfway up the takeoff ramp, across the open gap, to
// halfway down the landing ramp — so the molten edge always starts/ends at the
// ramp midpoints and never bleeds onto the open road before the ramp or stops short
// of it, even where the track curves. The outline is a ribbon swept along the curve
// centerline: full width through the middle, tapering to a rounded cap at each end,
// with independent low-frequency lobes per side so it reads as an organic blob
// rather than a rectangle or a symmetric lens.
const LAVA_POOL_CENTERLINE_STEPS = 30

export const createVolcanoLavaPitPools = (
  trackCurve: THREE.CatmullRomCurve3
): LavaPitPool[] => {
  const curveLength = trackCurve.getLength()
  const point = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  return createLavaCrossings(trackCurve).map((crossing, index) => {
    const halfLenT = getLavaCrossingVisualHalfLength(crossing) / curveLength
    const halfWidth = crossing.width / 2
    const rng = new SeededRandom(7000 + index)
    const leftPhaseA = rng.next() * Math.PI * 2
    const leftPhaseB = rng.next() * Math.PI * 2
    const rightPhaseA = rng.next() * Math.PI * 2
    const rightPhaseB = rng.next() * Math.PI * 2
    const leftAmpA = 0.16 + rng.next() * 0.12
    const leftAmpB = 0.08 + rng.next() * 0.07
    const rightAmpA = 0.16 + rng.next() * 0.12
    const rightAmpB = 0.08 + rng.next() * 0.07

    const leftEdge: Array<{ x: number; z: number }> = []
    const rightEdge: Array<{ x: number; z: number }> = []
    const centerline: Array<{ x: number; z: number }> = []
    let sumX = 0
    let sumZ = 0
    for (let i = 0; i <= LAVA_POOL_CENTERLINE_STEPS; i++) {
      const s = i / LAVA_POOL_CENTERLINE_STEPS
      const t = wrapTrackT(crossing.t - halfLenT + 2 * halfLenT * s)
      trackCurve.getPointAt(t, point)
      trackCurve.getTangentAt(t, tangent).normalize()
      // Perpendicular to travel in the XZ plane.
      const perpX = tangent.z
      const perpZ = -tangent.x
      // Rounded cap: 0 at the ramp-midpoint ends, full through the middle. The lobe
      // wobble (always > 0) keeps each side inside its half so the ribbon never
      // self-intersects.
      const profile = Math.sin(Math.PI * s)
      const leftScale =
        profile *
        (1 + leftAmpA * Math.sin(3 * Math.PI * s + leftPhaseA) + leftAmpB * Math.sin(7 * Math.PI * s + leftPhaseB))
      const rightScale =
        profile *
        (1 + rightAmpA * Math.sin(3 * Math.PI * s + rightPhaseA) + rightAmpB * Math.sin(7 * Math.PI * s + rightPhaseB))
      leftEdge.push({ x: point.x + perpX * halfWidth * leftScale, z: point.z + perpZ * halfWidth * leftScale })
      rightEdge.push({ x: point.x - perpX * halfWidth * rightScale, z: point.z - perpZ * halfWidth * rightScale })
      centerline.push({ x: point.x, z: point.z })
      sumX += point.x
      sumZ += point.z
    }
    return {
      centerX: sumX / (LAVA_POOL_CENTERLINE_STEPS + 1),
      centerZ: sumZ / (LAVA_POOL_CENTERLINE_STEPS + 1),
      centerline,
      leftEdge,
      rightEdge,
      halfWidth
    }
  })
}

// Jump launch zones derived from the lava pits — a circle around each pit center
// sized to the pit lip (`length / 2`) so the car launches right as it crests the
// top of the approach ramp and arcs across the gap.
export const createVolcanoLavaPitJumpZones = (
  trackCurve: THREE.CatmullRomCurve3
): CarJumpZone[] =>
  createLavaCrossings(trackCurve).map(crossing => ({
    x: crossing.x,
    z: crossing.z,
    radius: crossing.length / 2
  }))

// Ramp surface field derived from the lava pits — the raised ground the car climbs
// on the approach and descends on the landing. Two ramps per pit (one each side),
// each anchored on the *actual* racing line at the same on-curve points the visual
// slab uses (`VolcanoCaveScenery` JumpRamps): the outer foot a full ramp length out
// from the gap edge, the lip at the gap edge (`length / 2`). Anchoring on the curve
// — rather than a single straight box along the pit-center tangent — keeps the
// physics footprint aligned with the visual ramp where the corridor curves, so the
// car climbs every ramp (including the outer pits) instead of passing through it.
export const createVolcanoLavaPitRampZones = (
  trackCurve: THREE.CatmullRomCurve3
): CarRampZone[] => {
  const curveLength = trackCurve.getLength()
  const wrap = (v: number) => v - Math.floor(v) // keep t in [0,1) on the closed lap
  const outer = new THREE.Vector3()
  const inner = new THREE.Vector3()
  return createLavaCrossings(trackCurve).flatMap(crossing => {
    const gapHalf = crossing.length / 2
    // side -1 / +1 = the two ramps flanking the pit.
    return [-1, 1].map<CarRampZone>(side => {
      trackCurve.getPointAt(wrap(crossing.t + (side * (gapHalf + LAVA_PIT_RAMP_LENGTH)) / curveLength), outer)
      trackCurve.getPointAt(wrap(crossing.t + (side * gapHalf) / curveLength), inner)
      const upX = inner.x - outer.x
      const upZ = inner.z - outer.z
      const length = Math.hypot(upX, upZ) || 1
      return {
        x: outer.x,
        z: outer.z,
        upX: upX / length,
        upZ: upZ / length,
        rampLength: LAVA_PIT_RAMP_LENGTH,
        halfWidth: LAVA_PIT_RAMP_WIDTH / 2,
        lipHeight: LAVA_PIT_RAMP_LIP_HEIGHT
      }
    })
  })
}

export const createVolcanoCavePlacements = (
  trackCurve: THREE.CatmullRomCurve3,
  qualityPreset: RacingQualityPreset,
  exclusionZones: BillboardForestOptions['exclusionZones'] = []
): VolcanoCavePlacements => {
  const lavaBasin = createVolcanoLavaBasin(trackCurve)

  const rocks = createBillboardForestPlacements(
    trackCurve,
    qualityPreset,
    ROCK_FOREST_OPTIONS(exclusionZones)
  )
    .filter(placement => !isPointInsidePolygon(placement, lavaBasin.boundary))
    .map<VolcanoRockPlacement>(placement => ({
      x: placement.x,
      z: placement.z,
      // Forest "height" (10..52) maps to a chunky spire scale.
      scale: placement.height / 9,
      rotation: placement.phase,
      variant: placement.variant
    }))

  const lavaCrossings = createLavaCrossings(trackCurve)

  return { rocks, lavaBasin, lavaCrossings }
}
