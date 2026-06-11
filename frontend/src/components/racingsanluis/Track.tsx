import React, { useMemo } from 'react'
import * as THREE from 'three'

interface TrackProps {
  curve: THREE.CatmullRomCurve3
  frames: {
    tangents: THREE.Vector3[]
    normals: THREE.Vector3[]
    binormals: THREE.Vector3[]
  }
  segments: number
}

export const Track: React.FC<TrackProps> = ({ curve, frames, segments }) => {
  const geometry = useMemo(() => {
    // Create a custom ribbon geometry manually
    // This avoids the ExtrudeGeometry "twist" issues by explicitly using our computed frames
    
    const width = 12
    const radialSegments = 1 // 1 segment across width (just left and right edge)
    const tubularSegments = segments
    
    const geometry = new THREE.BufferGeometry()
    const vertices = []
    const normals = []
    const uvs = []
    const indices = []
    
    // Generate vertices
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      
      // Get frame vectors
      // Note: computeFrenetFrames returns arrays of length 'segments' (not segments + 1 sometimes?)
      // We handle wrapping or clamping index
      const idx = i % segments 
      
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
      
      const right = binormal.clone() // Use binormal as width direction
      const up = normal.clone()      // Use normal as surface normal
      
      // Left vertex
      const leftPos = point.clone().add(right.clone().multiplyScalar(-width / 2))
      vertices.push(leftPos.x, leftPos.y, leftPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(0, i / tubularSegments)
      
      // Right vertex
      const rightPos = point.clone().add(right.clone().multiplyScalar(width / 2))
      vertices.push(rightPos.x, rightPos.y, rightPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(1, i / tubularSegments)
    }
    
    // Generate indices
    for (let i = 0; i < tubularSegments; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i + 1) * 2
      const d = (i + 1) * 2 + 1
      
      // Face 1
      indices.push(a, b, d)
      // Face 2
      indices.push(a, d, c)
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    
    return geometry
  }, [curve, frames, segments])

  // Create line geometry for markings
  const lineGeometry = useMemo(() => {
    const width = 12
    const linePositions = []
    const dashedLinePositions = []
    
    const tubularSegments = segments
    
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      const idx = i % segments 
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
    const whiteIndices = [] // We will use disjoint triangles for dashes
    
    const lineWidth = 0.3
    
    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)
      const idx = i % segments 
      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]
      
      const right = binormal.clone()
      const up = normal.clone().multiplyScalar(0.02) // Just above road
      
      // Left Edge
      const l1 = point.clone().add(right.clone().multiplyScalar(-5.5 - lineWidth)).add(up)
      const l2 = point.clone().add(right.clone().multiplyScalar(-5.5 + lineWidth)).add(up)
      yellowVerts.push(l1.x, l1.y, l1.z, l2.x, l2.y, l2.z)
      
      // Right Edge
      const r1 = point.clone().add(right.clone().multiplyScalar(5.5 - lineWidth)).add(up)
      const r2 = point.clone().add(right.clone().multiplyScalar(5.5 + lineWidth)).add(up)
      yellowVerts.push(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z)
      
      // Center (Dashed)
      const c1 = point.clone().add(right.clone().multiplyScalar(-lineWidth/2)).add(up)
      const c2 = point.clone().add(right.clone().multiplyScalar(lineWidth/2)).add(up)
      whiteVerts.push(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z)
    }
    
    // Indices
    for (let i = 0; i < tubularSegments; i++) {
        // Yellow lines (continuous)
        // Left strip (vertices 0, 1, 4, 5...) -> offset i*4
        const base = i * 4
        const next = (i + 1) * 4
        
        // Left line quad
        yellowIndices.push(base, base+1, next)
        yellowIndices.push(base+1, next+1, next)
        
        // Right line quad
        yellowIndices.push(base+2, base+3, next+2)
        yellowIndices.push(base+3, next+3, next+2)
        
        // White line (dashed) - only add indices if in dash segment
        // Shorter dashes (1 segment) with smaller gaps (1 segment) for consistent pattern throughout track
        if (i % 2 === 0) { // Draw 1 segment, skip 1 segment - creates shorter, more frequent dashes
            const wBase = i * 2
            const wNext = (i + 1) * 2
            whiteIndices.push(wBase, wBase+1, wNext)
            whiteIndices.push(wBase+1, wNext+1, wNext)
        }
    }
    
    yellowGeom.setAttribute('position', new THREE.Float32BufferAttribute(yellowVerts, 3))
    yellowGeom.setIndex(yellowIndices)
    
    whiteGeom.setAttribute('position', new THREE.Float32BufferAttribute(whiteVerts, 3))
    whiteGeom.setIndex(whiteIndices)
    
    return { yellowGeom, whiteGeom }
  }, [curve, frames, segments])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial 
          color="#333" 
          roughness={0.8}
          metalness={0.1}
          side={THREE.DoubleSide}
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
