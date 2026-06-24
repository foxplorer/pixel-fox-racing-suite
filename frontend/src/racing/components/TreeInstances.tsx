import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export interface TreeInstancePlacement {
  x: number
  y?: number
  z: number
  scale: number
}

export interface TreePalette {
  trunk: string
  foliage1: string
  foliage2: string
  foliage3: string
}

interface TreeInstancesProps {
  trees: TreeInstancePlacement[]
  palette?: TreePalette
  castShadow?: boolean
  receiveShadow?: boolean
  frustumCulled?: boolean
}

const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8)
const foliage1Geometry = new THREE.ConeGeometry(1.2, 2, 8)
const foliage2Geometry = new THREE.ConeGeometry(1.0, 1.8, 8)
const foliage3Geometry = new THREE.ConeGeometry(0.8, 1.5, 8)

export const DEFAULT_TREE_PALETTE: TreePalette = {
  trunk: '#4a2f1b',
  foliage1: '#2d5a27',
  foliage2: '#3a7a32',
  foliage3: '#4a9a3c'
}

export const SNOW_TREE_PALETTE: TreePalette = {
  trunk: '#3a2515',
  foliage1: '#1a3a1a',
  foliage2: '#e8f0f8',
  foliage3: '#f5faff'
}

export const TreeInstances: React.FC<TreeInstancesProps> = ({
  trees,
  palette = DEFAULT_TREE_PALETTE,
  castShadow = true,
  receiveShadow = true,
  frustumCulled = true
}) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const foliage1Ref = useRef<THREE.InstancedMesh>(null)
  const foliage2Ref = useRef<THREE.InstancedMesh>(null)
  const foliage3Ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!trunkRef.current || !foliage1Ref.current || !foliage2Ref.current || !foliage3Ref.current) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    trees.forEach((tree, index) => {
      const size = tree.scale
      const baseY = tree.y ?? 0

      position.set(tree.x, baseY + 1.5 * size, tree.z)
      quaternion.identity()
      scale.set(size, size, size)
      matrix.compose(position, quaternion, scale)
      trunkRef.current!.setMatrixAt(index, matrix)

      position.set(tree.x, baseY + 3.5 * size, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage1Ref.current!.setMatrixAt(index, matrix)

      position.set(tree.x, baseY + 4.5 * size, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage2Ref.current!.setMatrixAt(index, matrix)

      position.set(tree.x, baseY + 5.3 * size, tree.z)
      matrix.compose(position, quaternion, scale)
      foliage3Ref.current!.setMatrixAt(index, matrix)
    })

    trunkRef.current.instanceMatrix.needsUpdate = true
    foliage1Ref.current.instanceMatrix.needsUpdate = true
    foliage2Ref.current.instanceMatrix.needsUpdate = true
    foliage3Ref.current.instanceMatrix.needsUpdate = true
    // Instance matrices don't refresh the mesh bounds; without this each bounding
    // sphere stays a unit shape at the origin and the whole field gets frustum culled
    // (popping in/out) once the origin leaves view. Matters when frustumCulled is on.
    trunkRef.current.computeBoundingSphere()
    foliage1Ref.current.computeBoundingSphere()
    foliage2Ref.current.computeBoundingSphere()
    foliage3Ref.current.computeBoundingSphere()
  }, [trees])

  if (trees.length === 0) return null

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeometry, undefined, trees.length]} frustumCulled={frustumCulled} castShadow={castShadow} receiveShadow={receiveShadow}>
        <meshStandardMaterial color={palette.trunk} />
      </instancedMesh>
      <instancedMesh ref={foliage1Ref} args={[foliage1Geometry, undefined, trees.length]} frustumCulled={frustumCulled} castShadow={castShadow}>
        <meshStandardMaterial color={palette.foliage1} />
      </instancedMesh>
      <instancedMesh ref={foliage2Ref} args={[foliage2Geometry, undefined, trees.length]} frustumCulled={frustumCulled} castShadow={castShadow}>
        <meshStandardMaterial color={palette.foliage2} />
      </instancedMesh>
      <instancedMesh ref={foliage3Ref} args={[foliage3Geometry, undefined, trees.length]} frustumCulled={frustumCulled} castShadow={castShadow}>
        <meshStandardMaterial color={palette.foliage3} />
      </instancedMesh>
    </>
  )
}
