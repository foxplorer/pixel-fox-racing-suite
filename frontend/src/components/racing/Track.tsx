import React, { useMemo } from 'react'
import * as THREE from 'three'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import { getRacingSurfaceTextureConfig, getSurfaceTextureRepeat } from '../../racing/components/materials/proceduralSurfaceConfig'
import { RacingSurfaceMaterial } from '../../racing/components/materials/RacingSurfaceMaterial'

const TRACK_WIDTH = 18

interface TrackProps {
  curve: THREE.CatmullRomCurve3
  frames: {
    tangents: THREE.Vector3[]
    normals: THREE.Vector3[]
    binormals: THREE.Vector3[]
  }
  segments: number
  getHeight?: (x: number, z: number) => number
  excludedIntervals?: Array<{ startT: number; endT: number }>
  /** Quality tier driving asphalt texture resolution/detail. Defaults to medium. */
  qualityPresetId?: RacingQualityPresetId
}

const wrapTrackT = (t: number): number => {
  if (t < 0) return t + 1
  if (t > 1) return t - 1
  return t
}

const getCurvatureLimitedOffset = (
  curve: THREE.CatmullRomCurve3,
  t: number,
  sampleStep: number,
  offset: number,
  minInsideOffset: number
): number => {
  if (Math.abs(offset) <= minInsideOffset) return offset

  const previous = curve.getPointAt(wrapTrackT(t - sampleStep))
  const current = curve.getPointAt(t)
  const next = curve.getPointAt(wrapTrackT(t + sampleStep))
  const previousDirection = new THREE.Vector3(current.x - previous.x, 0, current.z - previous.z)
  const nextDirection = new THREE.Vector3(next.x - current.x, 0, next.z - current.z)

  if (previousDirection.lengthSq() < 0.0001 || nextDirection.lengthSq() < 0.0001) return offset

  previousDirection.normalize()
  nextDirection.normalize()

  const turn = previousDirection.x * nextDirection.z - previousDirection.z * nextDirection.x
  const isInsideTurn = (offset < 0 && turn > 0.0001) || (offset > 0 && turn < -0.0001)
  if (!isInsideTurn) return offset

  const dot = Math.min(Math.max(previousDirection.dot(nextDirection), -1), 1)
  const angle = Math.acos(dot)
  if (angle < 0.0001) return offset

  const arcLength = previous.distanceTo(current) + current.distanceTo(next)
  const radius = arcLength / angle
  const cappedOffset = Math.max(minInsideOffset, radius * 0.65)

  return Math.sign(offset) * Math.min(Math.abs(offset), cappedOffset)
}

const CENTER_DASH_LENGTH = 8
const CENTER_DASH_GAP = 14
const MIN_CURVATURE_LIMITED_ROAD_OFFSET = 8.9

const isTrackTExcluded = (
  t: number,
  intervals: readonly { startT: number; endT: number }[]
): boolean => intervals.some(interval => {
  if (interval.startT <= interval.endT) {
    return t >= interval.startT && t <= interval.endT
  }
  return t >= interval.startT || t <= interval.endT
})

export const Track: React.FC<TrackProps> = ({ curve, frames, segments, getHeight, excludedIntervals = [], qualityPresetId = 'medium' }) => {
  // Procedural asphalt — tarmac speckle (+ a baked normal map on high) instead of a
  // flat grey fill. Shared by every track that renders this ribbon, so improving it
  // here lifts Australia, Belgium and the imported tracks at once. The texture is
  // tiled per world-unit so tarmac grain stays a consistent size on any track length:
  // the ribbon's U spans the road width and its V spans the full track length.
  const asphaltRepeat = useMemo(() => {
    const tileWorldSize = getRacingSurfaceTextureConfig('asphalt', qualityPresetId).tileWorldSize
    return {
      x: getSurfaceTextureRepeat(TRACK_WIDTH, tileWorldSize),
      y: getSurfaceTextureRepeat(curve.getLength(), tileWorldSize)
    }
  }, [curve, qualityPresetId])

  const geometry = useMemo(() => {
    // Create a custom ribbon geometry manually
    // This avoids the ExtrudeGeometry "twist" issues by explicitly using our computed frames

    const width = TRACK_WIDTH // Wider track for better racing
    const tubularSegments = segments
    const sampleStep = 1 / tubularSegments
    
    const geometry = new THREE.BufferGeometry()
    const vertices = []
    const normals = []
    const uvs = []
    const indices = []
    
    // Generate vertices
    // CRITICAL: For closed curves, generate vertices for i=0 to i=tubularSegments-1
    // The last segment will connect back to the first vertices (reusing them)
    // This ensures perfect closure without duplicate vertices
    for (let i = 0; i < tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      
      // If a height function is provided, snap the point to the terrain
      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }
      
      // Get frame vectors
      const idx = Math.min(i, segments) // Clamp to prevent out-of-bounds
      
      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]
      const tangent = frames.tangents[idx]
      
      // In Three.js ExtrudeGeometry with closed path:
      // The frames are usually computed with 'closed=true' in computeFrenetFrames.
      // We'll assume 'frames' passed in are correct and consistent.
      
      // We want the road width to extend along the 'Normal' or 'Binormal' vector.
      // In Frenet frames, 'Tangent' is forward.
      // Usually 'Normal' points to center of curvature (sideways in a flat turn, up/down in a loop).
      // 'Binormal' is perpendicular to both (Up in a flat turn, sideways in a loop).
      // To avoid the 90-degree flip artifact (The "Wall"), we need to pick the vector that is "Horizontal" relative to the track surface.
      // But the track surface IS defined by these vectors.
      // The issue with Frenet frames is that at inflection points (curvature zero), the Normal flips.
      // SOLUTION: We rely on the RacingWorld component to compute *Parallel Transport* frames, NOT Frenet frames.
      // If we receive good frames, we just use 'binormal' (or whichever is the "Right" vector) for width.
      // Let's assume 'binormal' is the "Right" vector and 'normal' is the "Up" vector (Surface Normal).
      
      // CRITICAL: binormal (right vector) is always horizontal (y=0) to keep track flat
      // normal is always world-up (0,1,0) to keep track horizontal
      // This ensures left and right sides are always at the same elevation
      const right = binormal.clone() // Horizontal right vector (y=0)
      const up = normal.clone()      // Always world-up (0,1,0)
      const leftOffset = getCurvatureLimitedOffset(curve, t, sampleStep, -width / 2, MIN_CURVATURE_LIMITED_ROAD_OFFSET)
      const rightOffset = getCurvatureLimitedOffset(curve, t, sampleStep, width / 2, MIN_CURVATURE_LIMITED_ROAD_OFFSET)
      
      // Left vertex - same Y as center point since right.y = 0
      const leftPos = point.clone().add(right.clone().multiplyScalar(leftOffset))
      vertices.push(leftPos.x, leftPos.y, leftPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(0, i / tubularSegments)
      
      // Right vertex - same Y as center point since right.y = 0
      const rightPos = point.clone().add(right.clone().multiplyScalar(rightOffset))
      vertices.push(rightPos.x, rightPos.y, rightPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(1, i / tubularSegments)
    }
    
    // Generate indices
    // CRITICAL: Since we only generated vertices for i=0 to i=tubularSegments-1,
    // the last segment connects back to the first vertices (index 0) for perfect closure
    for (let i = 0; i < tubularSegments; i++) {
      const segmentMidT = (i + 0.5) / tubularSegments
      if (isTrackTExcluded(segmentMidT >= 1 ? segmentMidT - 1 : segmentMidT, excludedIntervals)) continue
      const a = i * 2
      const b = i * 2 + 1
      // For closure, last segment connects to first vertices (index 0)
      const c = (i === tubularSegments - 1) ? 0 : (i + 1) * 2
      const d = (i === tubularSegments - 1) ? 1 : (i + 1) * 2 + 1
      
      // Face 1
      indices.push(a, b, d)
      // Face 2
      indices.push(a, d, c)
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    // Don't call computeVertexNormals() - we've manually set all normals to world-up (0,1,0)
    // This ensures consistent shading across the entire flat track surface
    
    return geometry
  }, [curve, frames, segments, getHeight, excludedIntervals])

  // Create line geometry for markings
  const lineGeometry = useMemo(() => {
    const width = TRACK_WIDTH // Wider track for better racing
    const linePositions = []
    const dashedLinePositions = []
    
    const tubularSegments = segments
    const sampleStep = 1 / tubularSegments
    const centerDashCycleLength = CENTER_DASH_LENGTH + CENTER_DASH_GAP
    let centerlineDistance = 0
    
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      
      // Snap to terrain if height function provided
      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }

      const idx = Math.min(i, segments) // Clamp to prevent out-of-bounds
      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]
      
      const right = binormal.clone()
      const up = normal.clone().multiplyScalar(0.05) // Slightly above road
      
      // Left Yellow Line (-5.5)
      const leftLine = point.clone().add(right.clone().multiplyScalar(-5.5)).add(up)
      // Right Yellow Line (+5.5)
      const rightLine = point.clone().add(right.clone().multiplyScalar(5.5)).add(up)
      // Center Dashed Line (0)
      const centerLine = point.clone().add(up)
      
      // Solid lines need 2 triangles per segment -> ribbon
      // For simplicity in this "voxel" style, we can use LineSegments or Points, but ribbons look best.
      // Actually, lets just create offset vertices for 3 separate ribbons
    }
    // Let's skip manual geometry for lines and use simple lines with GL width? 
    // No, thick lines are hard in WebGL. Ribbon meshes are better.
    
    const yellowGeom = new THREE.BufferGeometry()
    const whiteGeom = new THREE.BufferGeometry()
    
    const yellowVerts = []
    const whiteVerts = []
    const yellowIndices = []
    const whiteIndices = [] // Disjoint triangles for center dashes
    
    const lineWidth = 0.3
    
    // CRITICAL: For closed curves, generate vertices for i=0 to i=tubularSegments-1 only
    // The last segment will connect back to the first vertices (reusing them) for perfect closure
    // This ensures the yellow lines join smoothly without any visual artifacts
    for (let i = 0; i < tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      
      // Snap to terrain if height function provided
      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }

      const idx = Math.min(i, segments) // Clamp to prevent out-of-bounds
      
      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]
      
      const right = binormal.clone()
      const up = normal.clone().multiplyScalar(0.01) // Just above road surface
      const leftOuterOffset = -9 - lineWidth
      const leftInnerOffset = -9 + lineWidth
      const rightInnerOffset = 9 - lineWidth
      const rightOuterOffset = 9 + lineWidth
      
      // Left Edge - positioned at half track width (9 units from center for 18 unit wide track)
      const l1 = point.clone().add(right.clone().multiplyScalar(leftOuterOffset)).add(up)
      const l2 = point.clone().add(right.clone().multiplyScalar(leftInnerOffset)).add(up)
      
      // Right Edge - positioned at half track width (9 units from center for 18 unit wide track)
      const r1 = point.clone().add(right.clone().multiplyScalar(rightInnerOffset)).add(up)
      const r2 = point.clone().add(right.clone().multiplyScalar(rightOuterOffset)).add(up)
      
      // Add vertices (4 per segment: left inner, left outer, right inner, right outer for yellow)
      yellowVerts.push(l1.x, l1.y, l1.z, l2.x, l2.y, l2.z)
      yellowVerts.push(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z)
    }
    
    // Indices
    // CRITICAL: Since we're reusing first vertices for closure, the last segment connects to index 0
    for (let i = 0; i < tubularSegments; i++) {
        const segmentMidT = (i + 0.5) / tubularSegments
        if (isTrackTExcluded(segmentMidT >= 1 ? segmentMidT - 1 : segmentMidT, excludedIntervals)) {
          const segmentStart = curve.getPointAt(i / tubularSegments)
          const segmentEnd = curve.getPointAt((i + 1) / tubularSegments)
          centerlineDistance += segmentStart.distanceTo(segmentEnd)
          continue
        }
        // Yellow lines (continuous)
        // Each segment has 4 vertices: left inner, left outer, right inner, right outer
        // Left strip (vertices 0, 1, 4, 5...) -> offset i*4
        const base = i * 4
        // For closure, last segment connects to first vertices (index 0)
        const next = (i === tubularSegments - 1) ? 0 : (i + 1) * 4
        
        // Left line quad
        yellowIndices.push(base, base+1, next)
        yellowIndices.push(base+1, next+1, next)
        
        // Right line quad
        yellowIndices.push(base+2, base+3, next+2)
        yellowIndices.push(base+3, next+3, next+2)
        
        const segmentStart = curve.getPointAt(i / tubularSegments)
        const segmentEnd = curve.getPointAt((i + 1) / tubularSegments)
        centerlineDistance += segmentStart.distanceTo(segmentEnd)
    }

    const trackLength = curve.getLength()
    const dashSubdivisionLength = 2

    const addCenterDashPoint = (distance: number) => {
      const wrappedDistance = ((distance % trackLength) + trackLength) % trackLength
      const t = wrappedDistance / trackLength
      const point = curve.getPointAt(t)
      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }

      const tangent = curve.getTangentAt(t).normalize()
      const right = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
      const up = new THREE.Vector3(0, 0.01, 0)
      const left = point.clone().add(right.clone().multiplyScalar(-lineWidth / 2)).add(up)
      const rightPoint = point.clone().add(right.clone().multiplyScalar(lineWidth / 2)).add(up)
      whiteVerts.push(left.x, left.y, left.z, rightPoint.x, rightPoint.y, rightPoint.z)
    }

    for (let dashStart = 0; dashStart < trackLength; dashStart += centerDashCycleLength) {
      const dashEnd = Math.min(dashStart + CENTER_DASH_LENGTH, trackLength)
      const dashLength = dashEnd - dashStart
      const dashSteps = Math.max(1, Math.ceil(dashLength / dashSubdivisionLength))
      const firstVertexPair = whiteVerts.length / 3 / 2

      for (let step = 0; step <= dashSteps; step++) {
        addCenterDashPoint(dashStart + dashLength * (step / dashSteps))
      }

      for (let step = 0; step < dashSteps; step++) {
        const base = (firstVertexPair + step) * 2
        const next = base + 2
        const segmentMidDistance = dashStart + dashLength * ((step + 0.5) / dashSteps)
        const segmentMidT = ((segmentMidDistance % trackLength) + trackLength) % trackLength / trackLength
        if (!isTrackTExcluded(segmentMidT, excludedIntervals)) {
          whiteIndices.push(base, base + 1, next)
          whiteIndices.push(base + 1, next + 1, next)
        }
      }
    }
    
    yellowGeom.setAttribute('position', new THREE.Float32BufferAttribute(yellowVerts, 3))
    yellowGeom.setIndex(yellowIndices)
    
    whiteGeom.setAttribute('position', new THREE.Float32BufferAttribute(whiteVerts, 3))
    whiteGeom.setIndex(whiteIndices)
    
    return { yellowGeom, whiteGeom }
  }, [curve, frames, segments, getHeight, excludedIntervals])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <RacingSurfaceMaterial
          surface="asphalt"
          qualityPresetId={qualityPresetId}
          repeat={asphaltRepeat}
          color="#333"
        />
      </mesh>
      
      {/* Yellow Edge Lines */}
      <mesh geometry={lineGeometry.yellowGeom} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#FFD700" side={THREE.DoubleSide} />
      </mesh>
      
      {/* White Dashed Line */}
      <mesh geometry={lineGeometry.whiteGeom} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
