import React, { useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { getRacingDeviceProfileSnapshot } from '../platform/useRacingDeviceProfile'
import { reportRacingRenderStats } from '../debug/racingRenderStats'
import type { RacingGameCollectibleItem as GameItem } from '../collectibles/collectibleTypes'
import type { RacingCanvasQualitySettings } from '../performance/qualitySettings'
import { CarTrackStartGate, type CarTrackStartGateLayoutOptions } from './CarTrackStartGate'
import type { StartGateMarqueeModel } from './startGateMarquee'
import type { RacingQualityPresetId } from '../performance/qualitySettings'
import { RacingCollectibles } from './RacingCollectibles'
import { RaceCameraLookAtInitializer, getInitialRaceCameraPosition } from './raceCameraSetup'
import type { TerrainHeightSampler } from '../core/roadCorridor'

type CarTrackWorldStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

const RenderStatsReporter: React.FC = () => {
  useFrame(({ gl }) => {
    reportRacingRenderStats(gl.info.render.calls, gl.info.render.triangles)
  })
  return null
}

interface CarTrackWorldShellManualCamera {
  isManualCamera: boolean
  orbitControlsRef: React.MutableRefObject<any>
  focusControlsOnCar: () => void
}

interface CarTrackWorldShellProps {
  gameStatus: CarTrackWorldStatus
  countdown: number
  canvasQuality: RacingCanvasQualitySettings
  startFinishPosition: THREE.Vector3
  startFinishDirection: THREE.Vector3
  startingGatePoles: [THREE.Vector3, THREE.Vector3] | THREE.Vector3[]
  items: GameItem[]
  manualCamera: CarTrackWorldShellManualCamera
  staticScenery: React.ReactNode
  localVehicle: React.ReactNode
  remotePlayers?: React.ReactNode
  startGateLayout?: CarTrackStartGateLayoutOptions
  startGateMarqueeModel?: StartGateMarqueeModel | null
  qualityPresetId?: RacingQualityPresetId
  getHeightAtPosition?: TerrainHeightSampler
  frameloop?: 'always' | 'demand' | 'never'
}

export const CarTrackWorldShell: React.FC<CarTrackWorldShellProps> = ({
  gameStatus,
  countdown,
  canvasQuality,
  startFinishPosition,
  startFinishDirection,
  startingGatePoles,
  items,
  manualCamera,
  staticScenery,
  localVehicle,
  remotePlayers,
  startGateLayout,
  startGateMarqueeModel,
  qualityPresetId,
  getHeightAtPosition,
  frameloop = 'always'
}) => {
  const initialCameraPosition = getInitialRaceCameraPosition(startFinishPosition, startFinishDirection)
  const [isContextLost, setIsContextLost] = useState(false)
  // Sampled once per mount: only used for renderer creation options.
  const prefersMobileRenderer = useMemo(() => getRacingDeviceProfileSnapshot().prefersMobileRacingUi, [])

  return (
    <>
    <Canvas
      key="racing"
      shadows={canvasQuality.shadows}
      dpr={canvasQuality.dpr}
      gl={prefersMobileRenderer ? { powerPreference: 'high-performance' } : undefined}
      camera={{
        position: [initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z],
        fov: 60,
        far: 10000,
        near: 0.1
      }}
      frameloop={frameloop}
      onCreated={({ gl }) => {
        const canvasElement = gl.domElement
        canvasElement.addEventListener('webglcontextlost', event => {
          // preventDefault tells the browser we handle restoration, so it
          // will fire webglcontextrestored instead of leaving a dead canvas.
          event.preventDefault()
          setIsContextLost(true)
        })
        canvasElement.addEventListener('webglcontextrestored', () => {
          setIsContextLost(false)
        })
      }}
    >
      <RenderStatsReporter />
      <RaceCameraLookAtInitializer target={startFinishPosition} />
      {staticScenery}
      <CarTrackStartGate
        gameStatus={gameStatus}
        countdown={countdown}
        startFinishPosition={startFinishPosition}
        startFinishDirection={startFinishDirection}
        startingGatePoles={startingGatePoles}
        marqueeModel={startGateMarqueeModel}
        qualityPresetId={qualityPresetId}
        {...startGateLayout}
      />
      <RacingCollectibles items={items} getHeightAtPosition={getHeightAtPosition} />
      {localVehicle}
      {remotePlayers}
      <OrbitControls
        ref={manualCamera.orbitControlsRef}
        enabled={manualCamera.isManualCamera}
        enablePan={true}
        enableZoom={true}
        maxDistance={2000}
        minDistance={5}
        enableDamping={true}
        dampingFactor={0.1}
        target={[startFinishPosition.x, startFinishPosition.y + 0.1, startFinishPosition.z]}
        onStart={manualCamera.focusControlsOnCar}
        onEnd={() => {
          // Stay in manual mode until car controls return the camera to follow mode.
        }}
      />
    </Canvas>
    {isContextLost && (
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '14px',
        textAlign: 'center',
        userSelect: 'none'
      }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: '6px' }}>Restoring graphics…</div>
          <div style={{ fontSize: '11px', color: '#c9c9c9' }}>
            The graphics context was interrupted. Hang tight.
          </div>
        </div>
      </div>
    )}
    </>
  )
}
