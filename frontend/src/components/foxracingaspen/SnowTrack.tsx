import React, { useMemo } from 'react'
import * as THREE from 'three'

interface SnowTrackProps {
  curve: THREE.CatmullRomCurve3
  frames: {
    tangents: THREE.Vector3[]
    normals: THREE.Vector3[]
    binormals: THREE.Vector3[]
  }
  segments: number
  getHeight?: (x: number, z: number) => number
}

export const SnowTrack: React.FC<SnowTrackProps> = ({ curve, frames, segments, getHeight }) => {
  const geometry = useMemo(() => {
    const width = 18
    const radialSegments = 1
    const tubularSegments = segments

    const geometry = new THREE.BufferGeometry()
    const vertices = []
    const normals = []
    const uvs = []
    const indices = []

    for (let i = 0; i < tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)

      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }

      const idx = Math.min(i, segments)

      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]

      const right = binormal.clone()
      const up = normal.clone()

      const leftPos = point.clone().add(right.clone().multiplyScalar(-width / 2))
      vertices.push(leftPos.x, leftPos.y, leftPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(0, i / tubularSegments)

      const rightPos = point.clone().add(right.clone().multiplyScalar(width / 2))
      vertices.push(rightPos.x, rightPos.y, rightPos.z)
      normals.push(up.x, up.y, up.z)
      uvs.push(1, i / tubularSegments)
    }

    for (let i = 0; i < tubularSegments; i++) {
      const a = i * 2
      const b = i * 2 + 1
      const c = (i === tubularSegments - 1) ? 0 : (i + 1) * 2
      const d = (i === tubularSegments - 1) ? 1 : (i + 1) * 2 + 1

      indices.push(a, b, d)
      indices.push(a, d, c)
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)

    return geometry
  }, [curve, frames, segments, getHeight])

  const lineGeometry = useMemo(() => {
    const yellowGeom = new THREE.BufferGeometry()
    const whiteGeom = new THREE.BufferGeometry()

    const yellowVerts = []
    const whiteVerts = []
    const yellowIndices = []
    const whiteIndices = []

    const lineWidth = 0.3
    const tubularSegments = segments

    for (let i = 0; i < tubularSegments; i++) {
      const t = i / tubularSegments
      const point = curve.getPointAt(t)

      if (getHeight) {
        point.y = getHeight(point.x, point.z)
      }

      const idx = Math.min(i, segments)

      const normal = frames.normals[idx]
      const binormal = frames.binormals[idx]

      const right = binormal.clone()
      const up = normal.clone().multiplyScalar(0.01)

      const l1 = point.clone().add(right.clone().multiplyScalar(-9 - lineWidth)).add(up)
      const l2 = point.clone().add(right.clone().multiplyScalar(-9 + lineWidth)).add(up)

      const r1 = point.clone().add(right.clone().multiplyScalar(9 - lineWidth)).add(up)
      const r2 = point.clone().add(right.clone().multiplyScalar(9 + lineWidth)).add(up)

      const c1 = point.clone().add(right.clone().multiplyScalar(-lineWidth/2)).add(up)
      const c2 = point.clone().add(right.clone().multiplyScalar(lineWidth/2)).add(up)

      yellowVerts.push(l1.x, l1.y, l1.z, l2.x, l2.y, l2.z)
      yellowVerts.push(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z)
      whiteVerts.push(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z)
    }

    for (let i = 0; i < tubularSegments; i++) {
        const base = i * 4
        const next = (i === tubularSegments - 1) ? 0 : (i + 1) * 4

        yellowIndices.push(base, base+1, next)
        yellowIndices.push(base+1, next+1, next)

        yellowIndices.push(base+2, base+3, next+2)
        yellowIndices.push(base+3, next+3, next+2)

        if (i % 2 === 0) {
            const wBase = i * 2
            const wNext = (i === tubularSegments - 1) ? 0 : (i + 1) * 2
            whiteIndices.push(wBase, wBase+1, wNext)
            whiteIndices.push(wBase+1, wNext+1, wNext)
        }
    }

    yellowGeom.setAttribute('position', new THREE.Float32BufferAttribute(yellowVerts, 3))
    yellowGeom.setIndex(yellowIndices)

    whiteGeom.setAttribute('position', new THREE.Float32BufferAttribute(whiteVerts, 3))
    whiteGeom.setIndex(whiteIndices)

    return { yellowGeom, whiteGeom }
  }, [curve, frames, segments, getHeight])

  return (
    <group>
      {/* Snow-covered track surface - compacted snow color */}
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          color="#d8e4f0"
          roughness={0.7}
          metalness={0.0}
          side={THREE.DoubleSide}
          flatShading={true}
        />
      </mesh>

      {/* Orange Edge Lines (more visible on snow) */}
      <mesh geometry={lineGeometry.yellowGeom} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#FF6600" side={THREE.DoubleSide} />
      </mesh>

      {/* Red Dashed Center Line (more visible on snow) */}
      <mesh geometry={lineGeometry.whiteGeom} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#CC0000" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
