import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { RacingCanvasQualitySettings } from '../performance/qualitySettings'

interface CarTrackShowroomShellProps {
  canvasQuality: RacingCanvasQualitySettings
  children: React.ReactNode
  overlay?: React.ReactNode
}

export const CarTrackShowroomShell: React.FC<CarTrackShowroomShellProps> = ({
  canvasQuality,
  children,
  overlay
}) => (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {overlay}
    <Canvas
      key="showroom"
      shadows={canvasQuality.shadows}
      dpr={canvasQuality.dpr}
      camera={{ position: [0, 3, 14], fov: 45 }}
    >
      <color attach="background" args={['#050510']} />
      <ambientLight intensity={0.5} />
      {children}
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enableZoom={true}
        enablePan={true}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.5}
        minDistance={5}
        maxDistance={20}
        target={[0, 0.5, 0]}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  </div>
)
