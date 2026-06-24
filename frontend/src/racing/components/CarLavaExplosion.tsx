import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A short fiery burst played where the car burned up in the lava. Self-timed from
 * mount: a bright expanding fireball + a flash light + outward-flung embers, all
 * fading over ~1.1s. Render it (e.g. `{exploding && <CarLavaExplosion />}`) at the
 * car's frozen position.
 */
const EXPLOSION_SECONDS = 1.1
const EMBER_COUNT = 40

const fireballGeometry = new THREE.SphereGeometry(1, 20, 20)
const emberGeometry = new THREE.SphereGeometry(0.5, 6, 6)

export const CarLavaExplosion: React.FC = () => {
  const startRef = useRef<number | null>(null)
  const fireballRef = useRef<THREE.Mesh>(null)
  const fireballMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const embersRef = useRef<THREE.Group>(null)

  // Random outward velocity per ember (seeded once on mount).
  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, () => {
        const theta = Math.random() * Math.PI * 2
        const elevation = 0.2 + Math.random() * 1.1
        const speed = 14 + Math.random() * 26
        return {
          vx: Math.cos(theta) * speed,
          vy: elevation * speed,
          vz: Math.sin(theta) * speed,
          color: Math.random() < 0.5 ? '#ff7a18' : '#ffd24a'
        }
      }),
    []
  )

  useFrame((state) => {
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const elapsed = state.clock.elapsedTime - startRef.current
    const p = Math.min(elapsed / EXPLOSION_SECONDS, 1)

    if (fireballRef.current) fireballRef.current.scale.setScalar(2 + p * 22)
    if (fireballMatRef.current) fireballMatRef.current.opacity = (1 - p) * 0.9
    if (lightRef.current) lightRef.current.intensity = (1 - p) * 14

    if (embersRef.current) {
      // Ballistic embers: position = v*t + gravity, fading as they go.
      embersRef.current.children.forEach((child, index) => {
        const ember = embers[index]
        child.position.set(
          ember.vx * elapsed,
          Math.max(0, ember.vy * elapsed - 16 * elapsed * elapsed),
          ember.vz * elapsed
        )
        const mesh = child as THREE.Mesh
        const material = mesh.material as THREE.MeshBasicMaterial
        material.opacity = 1 - p
        child.scale.setScalar(1 - p * 0.6)
      })
    }
  })

  return (
    <group position={[0, 4, 0]}>
      <pointLight ref={lightRef} color="#ff8a2a" intensity={14} distance={140} decay={2} />
      <mesh ref={fireballRef} geometry={fireballGeometry}>
        <meshBasicMaterial
          ref={fireballMatRef}
          color="#ffcc44"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={embersRef}>
        {embers.map((ember, index) => (
          <mesh key={index} geometry={emberGeometry}>
            <meshBasicMaterial
              color={ember.color}
              transparent
              opacity={1}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
