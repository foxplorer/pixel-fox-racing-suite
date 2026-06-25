import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CarTrackDefinition } from '../../carTrackDefinitions'
import type { TerrainHeightSampler } from '../../../core/roadCorridor'
import type { RacingQualityPreset } from '../../../performance/qualitySettings'
import type { BillboardForestOptions } from '../../../components/forest/billboardForestPlacement'
import { SeededRandom } from '../../../core/seededRandom'
import {
  getRacingSceneryQualitySettings,
  getScaledQualityValue
} from '../../../performance/sceneryQuality'
import type {
  ImportedSceneryAdvertisingBoard,
  ImportedSceneryTreePlacement
} from '../ImportedCarTrackScenery'
import {
  computeLavaBasinSurfaceY,
  createVolcanoCavePlacements,
  createVolcanoLavaPitPools,
  LAVA_PIT_RAMP_LENGTH,
  LAVA_PIT_RAMP_LIP_HEIGHT,
  LAVA_PIT_RAMP_WIDTH,
  type LavaBasinPlacement,
  type LavaCrossingPlacement,
  type LavaPitPool,
  type VolcanoRockPlacement
} from './volcanoCavePlacement'
import { createLavaSurfaceMaterial, createSoftSpriteTexture } from './volcanoCaveMaterials'

interface VolcanoCaveSceneryProps {
  trackDefinition: CarTrackDefinition
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  forestOptions?: BillboardForestOptions
  onTreesGenerated?: (trees: ImportedSceneryTreePlacement[]) => void
  onBoardsGenerated?: (boards: ImportedSceneryAdvertisingBoard[]) => void
}

const LAVA_LIGHT_COLOR = new THREE.Color('#ff6a1f')

const spireGeometry = new THREE.ConeGeometry(1, 2, 6)
const boulderGeometry = new THREE.DodecahedronGeometry(1, 0)

// Sits the molten surface just above the ground so it never z-fights the terrain.
const LAVA_POOL_SURFACE_LIFT = 0.3
// Cross-width tessellation: the pit pools are wide (up to ~75u across) and the terrain
// underneath them undulates, so a ribbon with only the two amoeba edges as its across
// vertices spans each quad as a single flat sheet — wherever the ground bulges higher
// than that flat interpolation, rock pokes through as bands of "dry land" along the
// pit. Subdividing across (each interior vertex draped to its own ground height) lets
// the molten sheet hug those bumps so it reads as a filled pool, not strips.
const BASE_LAVA_POOL_ACROSS_COLUMNS = 12
const BASE_LAVA_BASIN_SHAPE_SEGMENTS = 48
const BASE_BASIN_EMITTER_COUNT = 24
const BASE_EMITTERS_PER_POOL = 10
const BASE_PARTICLES_PER_SOURCE = 6
const BASE_BASIN_LIGHT_BOUNDARY_STRIDE = 24
const BASE_CROSSING_LIGHT_COUNT = 5

const getVolcanoEffectQuality = (qualityPreset: RacingQualityPreset) => {
  const { effects } = getRacingSceneryQualitySettings(qualityPreset)
  return {
    lavaPoolAcrossColumns: getScaledQualityValue(BASE_LAVA_POOL_ACROSS_COLUMNS, effects.meshDetailScale, 6),
    lavaBasinShapeSegments: getScaledQualityValue(BASE_LAVA_BASIN_SHAPE_SEGMENTS, effects.meshDetailScale, 20),
    basinEmitterCount: getScaledQualityValue(BASE_BASIN_EMITTER_COUNT, effects.particleDensityScale, 8),
    emittersPerPool: getScaledQualityValue(BASE_EMITTERS_PER_POOL, effects.particleDensityScale, 3),
    particlesPerSource: getScaledQualityValue(BASE_PARTICLES_PER_SOURCE, effects.particleDensityScale, 2),
    basinLightBoundaryStride: Math.max(
      BASE_BASIN_LIGHT_BOUNDARY_STRIDE,
      Math.round(BASE_BASIN_LIGHT_BOUNDARY_STRIDE / effects.activeLightScale)
    ),
    crossingLightStride: Math.max(
      1,
      Math.ceil(BASE_CROSSING_LIGHT_COUNT / getScaledQualityValue(BASE_CROSSING_LIGHT_COUNT, effects.activeLightScale, 1))
    )
  }
}

// Builds a terrain-draped ribbon spanning the pool's two amoeba edges. Each vertex
// takes its own ground height (+lift), so the lava hugs sloped/bumpy pits instead of
// floating in front of the up ramp / burying behind the down ramp the way a single
// flat plane does, and the across subdivision keeps mid-span terrain bumps covered.
// Positions are local to (centerX, centerZ) for float precision; the caller places the
// mesh there with no rotation (Y is already world height). UVs carry the world-scaled
// XZ so the lava shader's molten-cell size matches the basin and every other pit.
const createLavaPoolGeometry = (
  pool: LavaPitPool,
  sampler: TerrainHeightSampler | undefined,
  acrossColumns: number
): THREE.BufferGeometry => {
  const rows = pool.centerline.length
  const cols = acrossColumns
  const vertsPerRow = cols + 1
  const positions = new Float32Array(rows * vertsPerRow * 3)
  const uvs = new Float32Array(rows * vertsPerRow * 2)
  for (let i = 0; i < rows; i++) {
    const left = pool.leftEdge[i]
    const right = pool.rightEdge[i]
    for (let j = 0; j <= cols; j++) {
      const f = j / cols // 0 at the left edge, 1 at the right edge
      const worldX = left.x + (right.x - left.x) * f
      const worldZ = left.z + (right.z - left.z) * f
      const vi = i * vertsPerRow + j
      positions[vi * 3] = worldX - pool.centerX
      positions[vi * 3 + 1] = sampleHeight(sampler, worldX, worldZ) + LAVA_POOL_SURFACE_LIFT
      positions[vi * 3 + 2] = worldZ - pool.centerZ
      uvs[vi * 2] = worldX - pool.centerX
      uvs[vi * 2 + 1] = worldZ - pool.centerZ
    }
  }
  const indices: number[] = []
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * vertsPerRow + j // row i, left of cell
      const b = i * vertsPerRow + j + 1 // row i, right of cell
      const c = (i + 1) * vertsPerRow + j // row i+1, left of cell
      const d = (i + 1) * vertsPerRow + j + 1 // row i+1, right of cell
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

const sampleHeight = (sampler: TerrainHeightSampler | undefined, x: number, z: number) =>
  sampler ? sampler(x, z) : 0

const RockSpires: React.FC<{
  rocks: VolcanoRockPlacement[]
  getHeightAtPosition?: TerrainHeightSampler
}> = ({ rocks, getHeightAtPosition }) => {
  const spireRef = useRef<THREE.InstancedMesh>(null)
  const boulderRef = useRef<THREE.InstancedMesh>(null)

  const { spires, boulders } = useMemo(() => {
    const spires = rocks.filter(rock => rock.variant !== 0)
    const boulders = rocks.filter(rock => rock.variant === 0)
    return { spires, boulders }
  }, [rocks])

  useEffect(() => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()

    if (spireRef.current) {
      spires.forEach((rock, index) => {
        const base = sampleHeight(getHeightAtPosition, rock.x, rock.z)
        const heightScale = rock.scale * (1.6 + (rock.variant % 2) * 0.8)
        scale.set(rock.scale, heightScale, rock.scale)
        position.set(rock.x, base + heightScale - 0.5, rock.z)
        euler.set((rock.variant % 2) * 0.08, rock.rotation, 0)
        quaternion.setFromEuler(euler)
        matrix.compose(position, quaternion, scale)
        spireRef.current!.setMatrixAt(index, matrix)
      })
      spireRef.current.instanceMatrix.needsUpdate = true
      // Instance matrices don't update the mesh bounds automatically; without this
      // the bounds stay a unit cone at the origin and the whole field gets frustum
      // culled the moment the origin leaves view (spires pop in/out while moving).
      spireRef.current.computeBoundingSphere()
    }

    if (boulderRef.current) {
      boulders.forEach((rock, index) => {
        const base = sampleHeight(getHeightAtPosition, rock.x, rock.z)
        scale.set(rock.scale * 1.3, rock.scale, rock.scale * 1.3)
        position.set(rock.x, base + rock.scale * 0.6, rock.z)
        euler.set(rock.rotation * 0.3, rock.rotation, rock.rotation * 0.2)
        quaternion.setFromEuler(euler)
        matrix.compose(position, quaternion, scale)
        boulderRef.current!.setMatrixAt(index, matrix)
      })
      boulderRef.current.instanceMatrix.needsUpdate = true
      boulderRef.current.computeBoundingSphere()
    }
  }, [boulders, getHeightAtPosition, spires])

  return (
    <>
      {spires.length > 0 && (
        <instancedMesh ref={spireRef} args={[spireGeometry, undefined, spires.length]} castShadow receiveShadow>
          <meshStandardMaterial color="#241d1a" roughness={0.96} metalness={0.04} />
        </instancedMesh>
      )}
      {boulders.length > 0 && (
        <instancedMesh ref={boulderRef} args={[boulderGeometry, undefined, boulders.length]} castShadow receiveShadow>
          <meshStandardMaterial color="#2b2420" roughness={0.95} metalness={0.05} />
        </instancedMesh>
      )}
    </>
  )
}

const LavaField: React.FC<{
  basin: LavaBasinPlacement
  crossings: LavaCrossingPlacement[]
  pools: LavaPitPool[]
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
}> = ({ basin, crossings, pools, qualityPreset, getHeightAtPosition }) => {
  const material = useMemo(() => createLavaSurfaceMaterial(), [])
  const lightRefs = useRef<THREE.PointLight[]>([])
  const effectQuality = useMemo(() => getVolcanoEffectQuality(qualityPreset), [qualityPreset])

  useEffect(() => () => material.dispose(), [material])

  const basinSurface = useMemo(() => {
    const shape = new THREE.Shape()
    basin.boundary.forEach((point, index) => {
      const x = point.x - basin.centerX
      const y = point.z - basin.centerZ
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    const geometry = new THREE.ShapeGeometry(shape, effectQuality.lavaBasinShapeSegments)
    const y = computeLavaBasinSurfaceY(basin, getHeightAtPosition)
    return {
      geometry,
      position: [basin.centerX, y, basin.centerZ] as [number, number, number]
    }
  }, [basin, effectQuality.lavaBasinShapeSegments, getHeightAtPosition])

  useEffect(() => () => basinSurface.geometry.dispose(), [basinSurface])

  // Each pit's molten pool is an amoeba that follows the curving racing line from
  // mid takeoff-ramp to mid landing-ramp (see createVolcanoLavaPitPools), so the
  // edge always lands on the ramp midpoints instead of squaring off onto the road or
  // stopping short. The bend is baked into the outline, so each pool lays flat with a
  // plain -PI/2 X rotation and no per-pool yaw.
  const crossingPools = useMemo(
    () =>
      pools.map((pool, index) => ({
        key: `${index}`,
        geometry: createLavaPoolGeometry(pool, getHeightAtPosition, effectQuality.lavaPoolAcrossColumns),
        position: [pool.centerX, 0, pool.centerZ] as [number, number, number]
      })),
    [effectQuality.lavaPoolAcrossColumns, pools, getHeightAtPosition]
  )

  useEffect(
    () => () => crossingPools.forEach(pool => pool.geometry.dispose()),
    [crossingPools]
  )

  const litSources = useMemo(() => {
    const basinLights = [
      {
        x: basin.centerX,
        z: basin.centerZ,
        radius: basin.radius,
        phase: 0
      },
      ...basin.boundary
        .filter((_, index) => index % effectQuality.basinLightBoundaryStride === 0)
        .map((point, index) => ({
          x: point.x,
          z: point.z,
          radius: basin.radius * 0.42,
          phase: index * 1.7
        }))
    ].map(source => ({
      ...source,
      y: sampleHeight(getHeightAtPosition, source.x, source.z) + 10
    }))
    // Light only the quality-selected crossing subset; the unlit molten surface
    // still glows on its own, so this keeps the live point-light count bounded.
    const crossingLights = crossings
      .filter((_, index) => index % effectQuality.crossingLightStride === 0)
      .map(crossing => ({
        x: crossing.x,
        y: sampleHeight(getHeightAtPosition, crossing.x, crossing.z) + 9,
        z: crossing.z,
        radius: crossing.width,
        phase: crossing.phase
      }))
    return [...basinLights, ...crossingLights]
  }, [basin, crossings, effectQuality.basinLightBoundaryStride, effectQuality.crossingLightStride, getHeightAtPosition])

  useFrame(state => {
    const t = state.clock.elapsedTime
    material.uniforms.uTime.value = t
    lightRefs.current.slice(0, litSources.length).forEach((light, index) => {
      if (!light) return
      const phase = litSources[index]?.phase ?? 0
      light.intensity = 2.4 + Math.sin(t * 5.5 + phase) * 0.7 + Math.sin(t * 13.0 + phase * 2.0) * 0.3
    })
  })

  return (
    <>
      <mesh
        geometry={basinSurface.geometry}
        material={material}
        position={basinSurface.position}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      {crossingPools.map(pool => (
        <mesh
          key={`lava-pool-${pool.key}`}
          geometry={pool.geometry}
          material={material}
          position={pool.position}
        />
      ))}
      {litSources.map((source, index) => (
        <pointLight
          key={`lava-light-${index}`}
          ref={element => {
            if (element) lightRefs.current[index] = element
          }}
          position={[source.x, source.y, source.z]}
          color={LAVA_LIGHT_COLOR}
          intensity={2.6}
          distance={source.radius * 9}
          decay={2}
        />
      ))}
    </>
  )
}

// Takeoff + landing ramps at each lava pit so the track visibly "curls up" into
// each jump. Each ramp is a wedge that tapers from zero height where it meets the
// track up to the pit lip, so it grows cleanly out of the road instead of sitting on
// it as a blunt box. Its top surface reproduces the carRamp height field (0 at the
// outer end → lipHeight at the lip), so the car rides exactly on the visible surface
// and never sinks into it. Dimensions come from the shared lava-pit ramp consts so
// the slab the player sees matches the surface the car physically climbs.
const RAMP_LENGTH = LAVA_PIT_RAMP_LENGTH
const RAMP_WIDTH = LAVA_PIT_RAMP_WIDTH
const RAMP_LIP_HEIGHT = LAVA_PIT_RAMP_LIP_HEIGHT
const RAMP_HALF_WIDTH = RAMP_WIDTH / 2

// Wedge built in a local frame whose origin is the outer-end center on the terrain:
// +X across the ramp, +Z horizontal toward the lip, +Y up. `delta` is the terrain
// rise from the outer end to the inner (lip) end, baked in so both ends sit flush on
// the ground even where the corridor is sloped. The outer edge has zero height (top
// meets bottom) so the ramp tapers into the track cleanly with no blunt step.
const buildRampWedgeGeometry = (delta: number): THREE.BufferGeometry => {
  const hw = RAMP_HALF_WIDTH
  const L = RAMP_LENGTH
  const top = delta + RAMP_LIP_HEIGHT
  const positions = new Float32Array([
    -hw, 0, 0, //     0 outer-left  (top == bottom: zero height, flush with track)
    hw, 0, 0, //      1 outer-right
    -hw, top, L, //   2 inner-top-left (the lip)
    hw, top, L, //    3 inner-top-right
    -hw, delta, L, // 4 inner-bottom-left
    hw, delta, L //   5 inner-bottom-right
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([
    0, 2, 3, 0, 3, 1, // top (drive surface)
    4, 3, 2, 4, 5, 3, // inner lip face
    0, 1, 5, 0, 5, 4, // bottom
    0, 4, 2, //         left side (outer end is a single edge → triangle)
    1, 3, 5 //          right side
  ])
  geometry.computeVertexNormals()
  return geometry
}

// Road paint matching the regular track (yellow edge lines + white center markings)
// but with forward-pointing chevrons instead of dashes so the ramp reads as a launch.
// The yellow lines sit at the same lateral offset as the track's edge lines (±9 for
// the 18-unit road, line width 0.6) so they line up with the track paint at the seam
// and the ramp reads as the road continuing up into the jump. Paint lives in a
// sub-frame tilted to lie flat on the sloped drive surface; within it +Z runs up the
// slope toward the lip and +X is across the ramp.
const TRACK_EDGE_LINE_OFFSET = 9 // half the 18-unit road width — matches Track.tsx
const TRACK_EDGE_LINE_WIDTH = 0.6 // 2 × Track.tsx lineWidth (0.3)
const RAMP_PAINT_LIFT = 0.08 // sit just above the drive surface to avoid z-fighting
const RAMP_STRIPE_LENGTH_FRACTION = 0.92
// Unit-length stripe scaled to each ramp's slope length at render time.
const rampStripeGeometry = new THREE.BoxGeometry(TRACK_EDGE_LINE_WIDTH, 0.12, 1)
const rampStripeMaterial = new THREE.MeshBasicMaterial({ color: '#FFD700', side: THREE.DoubleSide })

// Filled triangle arrow lying flat in the local XZ plane, apex toward +Z (up-ramp).
const RAMP_CHEVRON_HALF_WIDTH = RAMP_WIDTH * 0.17
const RAMP_CHEVRON_HALF_LENGTH = RAMP_LENGTH * 0.11
const rampChevronGeometry = (() => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, RAMP_CHEVRON_HALF_LENGTH, // apex (points up-ramp, toward the lip)
        -RAMP_CHEVRON_HALF_WIDTH, 0, -RAMP_CHEVRON_HALF_LENGTH,
        RAMP_CHEVRON_HALF_WIDTH, 0, -RAMP_CHEVRON_HALF_LENGTH
      ],
      3
    )
  )
  geometry.setIndex([0, 1, 2])
  geometry.computeVertexNormals()
  return geometry
})()
const rampChevronMaterial = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide })
// Three chevrons marching up the slope, as fractions of the slope length.
const RAMP_CHEVRON_FRACTIONS = [0.22, 0.5, 0.78]

const JumpRamps: React.FC<{
  crossings: LavaCrossingPlacement[]
  trackCurve: THREE.CatmullRomCurve3
  getHeightAtPosition?: TerrainHeightSampler
}> = ({ crossings, trackCurve, getHeightAtPosition }) => {
  const ramps = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const curveLength = trackCurve.getLength()
    const wrap = (v: number) => v - Math.floor(v) // keep t in [0,1) on the closed lap
    const outerPoint = new THREE.Vector3()
    const innerPoint = new THREE.Vector3()
    return crossings.flatMap((crossing, index) => {
      const gapHalf = crossing.length / 2
      // side -1 / +1 = the two ramps flanking the pit.
      return [-1, 1].map(side => {
        // Anchor the ramp ends on the actual track curve at their arc positions (t is
        // arc-length parameterized, so world distance maps linearly to Δt). The outer
        // end is a full ramp length out from the lip; the inner end is the lip. This
        // keeps the seam with the track and the lip centered on the real (curving)
        // racing line, so the ramp's yellow lines line up with the track's instead of
        // drifting off the straight tangent. The height profile still matches the
        // straight-tangent physics field (carRamp) in arc distance, so the car neither
        // sinks nor floats.
        trackCurve.getPointAt(wrap(crossing.t + (side * (gapHalf + RAMP_LENGTH)) / curveLength), outerPoint)
        trackCurve.getPointAt(wrap(crossing.t + (side * gapHalf) / curveLength), innerPoint)
        const outerBaseY = sampleHeight(getHeightAtPosition, outerPoint.x, outerPoint.z)
        const innerBaseY = sampleHeight(getHeightAtPosition, innerPoint.x, innerPoint.z)
        const delta = innerBaseY - outerBaseY
        // Local +Z runs horizontally from the outer end toward the lip (the chord
        // between the two on-curve points); +X across. crossVectors keeps the basis
        // right-handed so the wedge isn't mirrored.
        const towardLip = new THREE.Vector3(innerPoint.x - outerPoint.x, 0, innerPoint.z - outerPoint.z).normalize()
        const acrossAxis = new THREE.Vector3().crossVectors(up, towardLip).normalize()
        const basis = new THREE.Matrix4().makeBasis(acrossAxis, up, towardLip)
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis)
        return {
          key: `${index}-${side}`,
          geometry: buildRampWedgeGeometry(delta),
          position: [outerPoint.x, outerBaseY, outerPoint.z] as [number, number, number],
          quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [
            number,
            number,
            number,
            number
          ],
          // Tilt + length of the sloped drive surface, for laying paint flat on it.
          pitch: Math.atan2(delta + RAMP_LIP_HEIGHT, RAMP_LENGTH),
          slopeLength: Math.hypot(RAMP_LENGTH, delta + RAMP_LIP_HEIGHT),
          // Travel runs opposite the track tangent, so on one ramp the car climbs
          // toward the lip (local +Z) and on the other it descends away (local −Z).
          // Point the chevrons the way you drive.
          chevronYaw: side === -1 ? Math.PI : 0
        }
      })
    })
  }, [crossings, getHeightAtPosition, trackCurve])

  useEffect(() => () => ramps.forEach(ramp => ramp.geometry.dispose()), [ramps])

  return (
    <>
      {ramps.map(ramp => (
        <group key={`jump-ramp-${ramp.key}`} position={ramp.position} quaternion={ramp.quaternion}>
          <mesh geometry={ramp.geometry} castShadow receiveShadow>
            <meshStandardMaterial color="#2c221d" roughness={0.9} metalness={0.06} side={THREE.DoubleSide} />
          </mesh>
          {/* Paint tilted to lie flat on the sloped drive surface. */}
          <group rotation={[-ramp.pitch, 0, 0]} position={[0, RAMP_PAINT_LIFT, 0]}>
            {/* Yellow edge lines aligned with the track's edge lines (±9). */}
            <mesh
              geometry={rampStripeGeometry}
              material={rampStripeMaterial}
              position={[-TRACK_EDGE_LINE_OFFSET, 0, ramp.slopeLength / 2]}
              scale={[1, 1, ramp.slopeLength * RAMP_STRIPE_LENGTH_FRACTION]}
            />
            <mesh
              geometry={rampStripeGeometry}
              material={rampStripeMaterial}
              position={[TRACK_EDGE_LINE_OFFSET, 0, ramp.slopeLength / 2]}
              scale={[1, 1, ramp.slopeLength * RAMP_STRIPE_LENGTH_FRACTION]}
            />
            {/* White chevrons marching in the direction of travel. */}
            {RAMP_CHEVRON_FRACTIONS.map((fraction, i) => (
              <mesh
                key={`chevron-${i}`}
                geometry={rampChevronGeometry}
                material={rampChevronMaterial}
                position={[0, 0, ramp.slopeLength * fraction]}
                rotation={[0, ramp.chevronYaw, 0]}
              />
            ))}
          </group>
        </group>
      ))}
    </>
  )
}

const CaveParticles: React.FC<{
  sources: Array<{ x: number; y: number; z: number; radius: number }>
  qualityPreset: RacingQualityPreset
}> = ({ sources, qualityPreset }) => {
  const sprite = useMemo(() => createSoftSpriteTexture(), [])
  const smokeRef = useRef<THREE.Points>(null)
  const emberRef = useRef<THREE.Points>(null)

  useEffect(() => () => sprite.dispose(), [sprite])

  const { smoke, embers } = useMemo(() => {
    const { particlesPerSource } = getVolcanoEffectQuality(qualityPreset)
    const rng = new SeededRandom(90100 + sources.length)
    const buildLayer = (height: number) => {
      const total = sources.length * particlesPerSource
      const positions = new Float32Array(total * 3)
      const speeds = new Float32Array(total)
      const spans = new Float32Array(total)
      const bases = new Float32Array(total)
      let i = 0
      for (const source of sources) {
        for (let p = 0; p < particlesPerSource; p++) {
          const angle = rng.next() * Math.PI * 2
          const r = rng.next() * source.radius * 0.8
          positions[i * 3] = source.x + Math.cos(angle) * r
          positions[i * 3 + 1] = source.y + rng.next() * height
          positions[i * 3 + 2] = source.z + Math.sin(angle) * r
          speeds[i] = 0.4 + rng.next() * 0.8
          spans[i] = height
          bases[i] = source.y
          i++
        }
      }
      return { positions, speeds, spans, bases }
    }
    // Tall ember column so the molten pools throw visible flame tracers upward.
    return { smoke: buildLayer(90), embers: buildLayer(54) }
  }, [qualityPreset, sources])

  useFrame((_, delta) => {
    const advance = (
      ref: React.RefObject<THREE.Points>,
      data: { positions: Float32Array; speeds: Float32Array; spans: Float32Array; bases: Float32Array },
      rate: number
    ) => {
      const geometry = ref.current?.geometry
      const attribute = geometry?.getAttribute('position') as THREE.BufferAttribute | undefined
      if (!attribute) return
      const array = attribute.array as Float32Array
      for (let i = 0; i < data.speeds.length; i++) {
        array[i * 3 + 1] += data.speeds[i] * rate * delta
        if (array[i * 3 + 1] > data.bases[i] + data.spans[i]) {
          array[i * 3 + 1] = data.bases[i]
        }
      }
      attribute.needsUpdate = true
    }
    advance(smokeRef, smoke, 8)
    advance(emberRef, embers, 18)
  })

  if (sources.length === 0) return null

  return (
    <>
      <points ref={smokeRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[smoke.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color="#2a2326"
          size={34}
          sizeAttenuation
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </points>
      <points ref={emberRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[embers.positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sprite}
          color="#ff8a3a"
          size={2.4}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  )
}

export const VolcanoCaveScenery: React.FC<VolcanoCaveSceneryProps> = ({
  trackDefinition,
  qualityPreset,
  getHeightAtPosition,
  forestOptions,
  onTreesGenerated,
  onBoardsGenerated
}) => {
  const placements = useMemo(
    () => createVolcanoCavePlacements(trackDefinition.trackCurve, qualityPreset, forestOptions?.exclusionZones),
    [forestOptions?.exclusionZones, qualityPreset, trackDefinition.trackCurve]
  )
  const effectQuality = useMemo(() => getVolcanoEffectQuality(qualityPreset), [qualityPreset])

  // Amoeba lava pools for the five jump pits, shared by the rendered surface and the
  // flame emitters so both sit exactly on the molten footprint.
  const lavaPools = useMemo(
    () => createVolcanoLavaPitPools(trackDefinition.trackCurve),
    [trackDefinition.trackCurve]
  )

  const collidableRocks = useMemo<ImportedSceneryTreePlacement[]>(
    () =>
      placements.rocks.map(rock => ({
        x: rock.x,
        z: rock.z,
        scale: rock.scale,
        radius: rock.scale * (rock.variant === 0 ? 1.4 : 1.0)
      })),
    [placements.rocks]
  )

  const particleSources = useMemo(() => {
    const sources: Array<{ x: number; y: number; z: number; radius: number }> = []
    const basin = placements.lavaBasin
    const basinY = computeLavaBasinSurfaceY(basin, getHeightAtPosition)
    const basinRng = new SeededRandom(33000 + basin.boundary.length)
    for (let i = 0; i < effectQuality.basinEmitterCount; i++) {
      const edge = basin.boundary[Math.floor(basinRng.next() * basin.boundary.length)]
      const reach = 0.16 + basinRng.next() * 0.68
      const x = basin.centerX + (edge.x - basin.centerX) * reach
      const z = basin.centerZ + (edge.z - basin.centerZ) * reach
      sources.push({ x, y: basinY, z, radius: 9 })
    }

    // Flame tracers rise from every pit. Emitters are scattered along each pool's
    // centerline and out across its width (staying clear of the tapered travel ends),
    // so the molten lava throws up rising embers across its whole footprint.
    lavaPools.forEach((pool, poolIndex) => {
      const poolRng = new SeededRandom(81000 + poolIndex)
      const radius = Math.min(pool.halfWidth * 0.28, 18)
      const samples = pool.centerline.length
      for (let i = 0; i < effectQuality.emittersPerPool; i++) {
        // Bias toward the wide middle of the pool; skip the narrow caps at the ends.
        const sampleIndex = Math.floor((0.12 + poolRng.next() * 0.76) * (samples - 1))
        const center = pool.centerline[sampleIndex]
        const across = (poolRng.next() - 0.5) * pool.halfWidth * 0.9
        const along = (poolRng.next() - 0.5) * radius
        // Offset across the pool using the local travel tangent (from neighbours).
        const prev = pool.centerline[Math.max(0, sampleIndex - 1)]
        const next = pool.centerline[Math.min(samples - 1, sampleIndex + 1)]
        const tx = next.x - prev.x
        const tz = next.z - prev.z
        const tlen = Math.hypot(tx, tz) || 1
        const perpX = tz / tlen
        const perpZ = -tx / tlen
        const x = center.x + perpX * across + (tx / tlen) * along
        const z = center.z + perpZ * across + (tz / tlen) * along
        sources.push({ x, y: sampleHeight(getHeightAtPosition, x, z) + 0.3, z, radius })
      }
    })
    return sources
  }, [effectQuality.basinEmitterCount, effectQuality.emittersPerPool, getHeightAtPosition, placements.lavaBasin, lavaPools])

  useEffect(() => {
    onTreesGenerated?.(collidableRocks)
  }, [collidableRocks, onTreesGenerated])

  useEffect(() => {
    onBoardsGenerated?.([])
  }, [onBoardsGenerated])

  return (
    <>
      <RockSpires rocks={placements.rocks} getHeightAtPosition={getHeightAtPosition} />
      <LavaField
        basin={placements.lavaBasin}
        crossings={placements.lavaCrossings}
        pools={lavaPools}
        qualityPreset={qualityPreset}
        getHeightAtPosition={getHeightAtPosition}
      />
      <JumpRamps
        crossings={placements.lavaCrossings}
        trackCurve={trackDefinition.trackCurve}
        getHeightAtPosition={getHeightAtPosition}
      />
      <CaveParticles sources={particleSources} qualityPreset={qualityPreset} />
    </>
  )
}
