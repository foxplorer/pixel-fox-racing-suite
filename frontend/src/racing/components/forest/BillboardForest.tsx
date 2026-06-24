import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { BillboardTreePlacement } from './billboardForestPlacement'
import type { TreeBillboardAtlas } from './treeBillboardTexture'

interface BillboardForestProps {
  trees: BillboardTreePlacement[]
  atlas: TreeBillboardAtlas
  getHeightAtPosition?: TerrainHeightSampler
  windStrength?: number
  windSpeed?: number
}

export const BillboardForest: React.FC<BillboardForestProps> = ({
  trees,
  atlas,
  getHeightAtPosition,
  windStrength = 0.9,
  windSpeed = 1.4
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0
    ]), 3))
    value.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    value.setIndex([0, 1, 2, 0, 2, 3])
    return value
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      map: { value: atlas.texture },
      uTime: { value: 0 },
      uWindStrength: { value: windStrength },
      uWindSpeed: { value: windSpeed }
    },
    vertexShader: `
      attribute vec2 aUvOffset;
      attribute vec2 aUvScale;
      attribute vec2 aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uWindStrength;
      uniform float uWindSpeed;
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vUv = aUvOffset + uv * aUvScale;
        vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
        float sway = sin(uTime * uWindSpeed + aPhase) * uWindStrength * uv.y;
        vec3 worldPos = center
          + camRight * (position.x * aSize.x + sway)
          + vec3(0.0, 1.0, 0.0) * (position.y * aSize.y);
        vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vec4 color = texture2D(map, vUv);
        if (color.a < 0.45) discard;
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(color.rgb, fogColor, fogFactor), 1.0);
      }
    `,
    transparent: false,
    fog: true,
    side: THREE.DoubleSide
  }), [atlas.texture, windStrength, windSpeed])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || trees.length === 0) return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)
    const uvOffsets = new Float32Array(trees.length * 2)
    const uvScales = new Float32Array(trees.length * 2)
    const sizes = new Float32Array(trees.length * 2)
    const phases = new Float32Array(trees.length)
    const cellWidth = 1 / atlas.cols

    trees.forEach((tree, index) => {
      position.set(tree.x, getHeightAtPosition?.(tree.x, tree.z) ?? 0, tree.z)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
      uvOffsets[index * 2] = (tree.variant % atlas.cols) * cellWidth
      uvOffsets[index * 2 + 1] = 0
      uvScales[index * 2] = cellWidth
      uvScales[index * 2 + 1] = 1
      sizes[index * 2] = tree.height * atlas.aspect
      sizes[index * 2 + 1] = tree.height
      phases[index] = tree.phase
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.setAttribute('aUvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2))
    mesh.geometry.setAttribute('aUvScale', new THREE.InstancedBufferAttribute(uvScales, 2))
    mesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2))
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
  }, [atlas, getHeightAtPosition, trees])

  useFrame(state => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  if (trees.length === 0) return null
  return (
    <instancedMesh
      key={trees.length}
      ref={meshRef}
      args={[geometry, material, trees.length]}
      frustumCulled={false}
    />
  )
}
