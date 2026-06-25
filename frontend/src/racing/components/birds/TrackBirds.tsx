import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TerrainHeightSampler } from '../../core/roadCorridor'
import type { RacingQualityPreset } from '../../performance/qualitySettings'
import { createBirdFlockPlacements, type BirdFlockOptions } from './birdFlockPlacement'

interface TrackBirdsProps {
  trackCurve: THREE.CatmullRomCurve3
  qualityPreset: RacingQualityPreset
  getHeightAtPosition?: TerrainHeightSampler
  options?: BirdFlockOptions
  color?: string
}

export const TrackBirds: React.FC<TrackBirdsProps> = ({
  trackCurve,
  qualityPreset,
  getHeightAtPosition,
  options,
  color = '#2c2c33'
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const birds = useMemo(
    () => createBirdFlockPlacements(trackCurve, qualityPreset, getHeightAtPosition, options),
    [getHeightAtPosition, options, qualityPreset, trackCurve]
  )

  // A flat gull silhouette: two triangles meeting at a central spine, wings sweeping out
  // to the tips and a short tail. The wing tips (|x| → 1) flap in the shader; the spine
  // (x → 0) stays put, so the whole card reads as a flapping bird from any angle.
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry()
    value.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1.0, 0.0, -0.05, // 0 left tip
      0.0, 0.0, 0.12, // 1 spine front
      1.0, 0.0, -0.05, // 2 right tip
      0.0, 0.0, -0.5 // 3 tail
    ]), 3))
    value.setIndex([0, 1, 3, 1, 2, 3])
    return value
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) }
    },
    vertexShader: `
      attribute vec3 aCenter;
      attribute float aRadius;
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aFlap;
      attribute float aScale;
      uniform float uTime;
      varying float vFogDepth;
      varying float vShade;
      void main() {
        float ang = aPhase + uTime * aSpeed;
        vec3 orbit = aCenter + aRadius * vec3(cos(ang), 0.0, sin(ang));
        vec3 fwd = vec3(-sin(ang), 0.0, cos(ang));
        vec3 rgt = vec3(cos(ang), 0.0, sin(ang));
        float wing = pow(abs(position.x), 1.3);
        float wingY = wing * 0.55 * sin(uTime * aFlap + aPhase);
        vec3 offset = (rgt * position.x + vec3(0.0, position.y + wingY, 0.0) + fwd * position.z) * aScale;
        vec3 worldPos = orbit + offset;
        vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
        vFogDepth = -mvPosition.z;
        vShade = 0.7 + 0.3 * wingY;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying float vFogDepth;
      varying float vShade;
      void main() {
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        gl_FragColor = vec4(mix(uColor * vShade, fogColor, fogFactor), 1.0);
      }
    `,
    fog: true,
    side: THREE.DoubleSide
  }), [color])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || birds.length === 0) return
    const identity = new THREE.Matrix4()
    const centers = new Float32Array(birds.length * 3)
    const radii = new Float32Array(birds.length)
    const speeds = new Float32Array(birds.length)
    const phases = new Float32Array(birds.length)
    const flaps = new Float32Array(birds.length)
    const scales = new Float32Array(birds.length)

    birds.forEach((bird, index) => {
      mesh.setMatrixAt(index, identity)
      centers[index * 3] = bird.centerX
      centers[index * 3 + 1] = bird.centerY
      centers[index * 3 + 2] = bird.centerZ
      radii[index] = bird.radius
      speeds[index] = bird.angularSpeed
      phases[index] = bird.phase
      flaps[index] = bird.flapSpeed
      scales[index] = bird.scale
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.setAttribute('aCenter', new THREE.InstancedBufferAttribute(centers, 3))
    mesh.geometry.setAttribute('aRadius', new THREE.InstancedBufferAttribute(radii, 1))
    mesh.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1))
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
    mesh.geometry.setAttribute('aFlap', new THREE.InstancedBufferAttribute(flaps, 1))
    mesh.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1))
  }, [birds])

  useFrame(state => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  if (birds.length === 0) return null
  return (
    <instancedMesh
      key={birds.length}
      ref={meshRef}
      args={[geometry, material, birds.length]}
      frustumCulled={false}
    />
  )
}
