import React from 'react'
import * as THREE from 'three'
import { StartLight } from './StartLight'
import { getStartLightRotationY, getStartLineRotationZ } from './startGatePresentation'

type CarTrackStartGateStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

export interface CarTrackStartGateLayoutOptions {
  yPosition?: number
  stripYOffset?: number
  stripColumns?: number
  stripRows?: number
  archTopWidth?: number
  archTopPosition?: [number, number, number]
  alignArchTopToTrack?: boolean
}

interface CarTrackStartGateProps extends CarTrackStartGateLayoutOptions {
  gameStatus: CarTrackStartGateStatus
  countdown: number
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGatePoles: [THREE.Vector3, THREE.Vector3] | THREE.Vector3[]
}

export const CarTrackStartGate: React.FC<CarTrackStartGateProps> = ({
  gameStatus,
  countdown,
  startFinishPosition,
  startFinishDirection,
  startingGatePoles,
  yPosition = 0.01,
  stripYOffset = 0.17,
  stripColumns = 18,
  stripRows = 4,
  archTopWidth = 22,
  archTopPosition,
  alignArchTopToTrack = true
}) => {
  if (gameStatus !== 'loading' && gameStatus !== 'countdown' && gameStatus !== 'racing') {
    return null
  }

  const [leftPole, rightPole] = startingGatePoles
  const lineRotationZ = getStartLineRotationZ(startFinishDirection)
  const defaultArchTopPosition: [number, number, number] = [
    ((leftPole.x + rightPole.x) / 2) - startFinishPosition.x,
    8,
    ((leftPole.z + rightPole.z) / 2) - startFinishPosition.z
  ]
  const columnOffsetY = 4

  return (
    <group position={[startFinishPosition.x, startFinishPosition.y + yPosition, startFinishPosition.z]}>
      <group rotation={[-Math.PI / 2, 0, lineRotationZ]} position={[0, stripYOffset, 0]}>
        {Array.from({ length: stripColumns }).map((_, i) =>
          Array.from({ length: stripRows }).map((_, j) => {
            const x = (i - stripColumns / 2) * 1.0 + 0.5
            const y = (j - (stripRows - 1) / 2) * 1.0
            const isBlack = (i + j) % 2 === 0
            return (
              <mesh key={`${i}-${j}`} position={[x, y, 0]} receiveShadow>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color={isBlack ? '#000000' : '#FFFFFF'} />
              </mesh>
            )
          })
        )}
      </group>

      <mesh position={[leftPole.x - startFinishPosition.x, columnOffsetY, leftPole.z - startFinishPosition.z]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[rightPole.x - startFinishPosition.x, columnOffsetY, rightPole.z - startFinishPosition.z]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 8]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      <mesh
        position={archTopPosition ?? defaultArchTopPosition}
        rotation={alignArchTopToTrack ? [0, lineRotationZ, 0] : undefined}
        castShadow
      >
        <boxGeometry args={[archTopWidth, 1, 1]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <group rotation={[0, getStartLightRotationY(startFinishDirection), 0]}>
        <StartLight countdown={countdown} visible={gameStatus === 'countdown' || gameStatus === 'racing'} gameStatus={gameStatus} />
      </group>
    </group>
  )
}
