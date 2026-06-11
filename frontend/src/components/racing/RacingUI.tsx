import React, { memo, useMemo, useState, useEffect } from 'react'
import { GameStatus } from '../foxracing/FoxRacingGame'
import { CameraMode } from '../foxracing/FreeRoamCar'
import racePhoto from '../../assets/race-photo.png'
import { TrackPreviewMinimap } from './TrackPreviewMinimap'
import type { VehicleMode } from '../../racing/tracks/trackMetadata'
import type { CarTrackDefinition } from '../../racing/tracks/carTrackDefinitions'
import { getTrackPreviewDefinitions } from '../../racing/tracks/trackPreviewDefinitions'
import { IMPORTED_CAR_TRACK_DEFINITIONS } from '../../racing/tracks/importedCarTrackRegistry'
import { RacingCountdownDisplay } from '../../racing/components/RacingCountdownDisplay'
import { RacingHudMetrics } from '../../racing/components/RacingHudMetrics'
import { RacingCameraModeSelector } from '../../racing/components/RacingCameraModeSelector'
import { RacingControlsHelper } from '../../racing/components/RacingControlsHelper'
import { RacingColorPicker } from '../../racing/components/RacingColorPicker'
import { RacingCrashOverlay } from '../../racing/components/RacingCrashOverlay'
import { RacingConnectOverlay } from '../../racing/components/RacingConnectOverlay'
import { RacingQualitySelector } from '../../racing/components/RacingQualitySelector'
import { RacingFpsCounter } from '../../racing/components/RacingFpsCounter'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'

// ========== MEMOIZED SUB-COMPONENTS ==========

// HUD Display - only re-renders when speed, distance, or lapTime change
const HUDDisplay = memo<{
  distanceTraveled: number
  speed: number
  lapTime: number
  gameStatus: GameStatus
  lapTimes: number[]
  lapTxids: { [index: number]: string }
}>(({ distanceTraveled, speed, lapTime, gameStatus, lapTimes, lapTxids }) => (
  <RacingHudMetrics
    distanceTraveled={distanceTraveled}
    speed={speed}
    showLapTime={gameStatus === 'racing'}
    lapTime={lapTime}
    lapTimes={lapTimes}
    lapTxids={lapTxids}
    lapListMarginTop="70px"
  />
))

// ========== MAIN COMPONENT ==========

interface RacingUIProps {
  gameStatus: GameStatus
  score: number
  distanceTraveled?: number
  lapTime?: number
  lapTimes?: number[]
  lapTxids?: { [index: number]: string }
  speed?: number // Speed in m/s
  countdown: number
  hasJoined: boolean
  onJoin: () => void
  onEnterShowroom?: () => void
  onRestart: () => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
  playerColor: string
  onColorChange: (color: string) => void
  ordinalAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  trackName?: string
  onTrackChange?: (trackName: string) => void
  cameraMode?: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
  showroomLoading?: boolean
  vehicleMode?: VehicleMode
  showroomVehicleModes?: VehicleMode[]
  importedCarTracks?: CarTrackDefinition[]
  qualityPresetId?: RacingQualityPresetId
  onQualityPresetChange?: (presetId: RacingQualityPresetId) => void
  devRemotePlayerLoad?: {
    configuredCount: number
    visibleCount: number
    speedScale?: number
  }
}

export const RacingUI: React.FC<RacingUIProps> = memo(({
  gameStatus,
  score,
  distanceTraveled = 0,
  lapTime = 0,
  lapTimes = [],
  lapTxids = {},
  speed = 0,
  countdown,
  hasJoined,
  onJoin,
  onEnterShowroom,
  onRestart,
  foxName,
  foxOriginOutpoint,
  playerColor,
  onColorChange,
  ordinalAddress,
  onConnectWallet,
  trackName = 'Australia',
  onTrackChange,
  cameraMode = 'smooth',
  onCameraModeChange,
  showroomLoading = true,
  vehicleMode = 'car',
  showroomVehicleModes,
  importedCarTracks = IMPORTED_CAR_TRACK_DEFINITIONS,
  qualityPresetId = 'medium',
  onQualityPresetChange,
  devRemotePlayerLoad
}) => {
  // Track window size for responsive minimaps (must be before any conditional returns)
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate minimap size based on window dimensions
  // Must fit: 4 minimaps + 4 labels + gaps + padding + margins
  const minimapSize = useMemo(() => {
    const topMargin = 20
    const containerPadding = 30 // 12px top + 18px bottom (extra for last label)
    const labelHeight = 22 * 4 // ~22px per label x 4
    const gaps = 8 * 3 // 3 gaps between 4 items
    const bottomMargin = 30 // safety margin for label overflow
    const totalOverhead = topMargin + containerPadding + labelHeight + gaps + bottomMargin

    const availableHeight = windowSize.height - totalOverhead
    const maxFromHeight = Math.floor(availableHeight / 4)

    // Also constrain by width (max 15% of screen width)
    const maxFromWidth = windowSize.width * 0.15

    // Clamp between 45 and 100 pixels (smaller overall)
    const size = Math.min(maxFromHeight, maxFromWidth)
    return Math.max(45, Math.min(100, size))
  }, [windowSize])

  // If idle, show Join Modal
  if (gameStatus === 'idle') {
    return (
      <RacingConnectOverlay backgroundImage={racePhoto} onConnectWallet={onConnectWallet} />
    )
  }

  // Showroom UI - Track selection with minimap previews
  if (gameStatus === 'showroom') {
    const eventVehicleModes = showroomVehicleModes ?? [vehicleMode]
    const trackData = getTrackPreviewDefinitions(eventVehicleModes, importedCarTracks)

    return (
      <>
        {/* Track Preview Minimaps - Upper right */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px 16px 12px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          {trackData.map(track => (
            <TrackPreviewMinimap
              key={`${track.vehicleMode}-${track.trackName}`}
              trackCurve={track.curve}
              trackName={track.trackName}
              isSelected={trackName === track.trackName}
              onClick={() => onTrackChange && onTrackChange(track.trackName)}
              width={minimapSize}
              height={minimapSize}
            />
          ))}
        </div>

        {/* Main controls panel - Left side */}
        <div style={{ position: 'absolute', top: 220, left: 10, zIndex: 100, textAlign: 'left' }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            padding: '20px 40px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '24px' }}>Ready to Race?</h3>

            {/* Track Selection Dropdown */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: '#fff', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                Track
              </label>
              <select
                value={trackName}
                onChange={(e) => onTrackChange && onTrackChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 15px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontSize: '16px',
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {trackData.map(track => (
                  <option key={`${track.vehicleMode}-${track.trackName}`} value={track.trackName} style={{ background: '#000', color: '#fff' }}>
                    {track.trackName}
                  </option>
                ))}
              </select>
            </div>

            <RacingColorPicker selectedColor={playerColor} onColorChange={onColorChange} />
            {onQualityPresetChange && (
              <RacingQualitySelector
                selectedPresetId={qualityPresetId}
                onPresetChange={onQualityPresetChange}
              />
            )}
            <button
              onClick={onJoin}
              className="join-button neon"
              style={{
                fontSize: '20px',
                padding: '15px 40px',
                opacity: showroomLoading ? 0.4 : 1,
                cursor: showroomLoading ? 'not-allowed' : 'pointer',
                filter: showroomLoading ? 'grayscale(100%)' : 'none'
              }}
              disabled={showroomLoading}
            >
              START RACE
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      <HUDDisplay
        distanceTraveled={distanceTraveled}
        speed={speed}
        lapTime={lapTime}
        gameStatus={gameStatus}
        lapTimes={lapTimes}
        lapTxids={lapTxids}
      />

      {(gameStatus === 'racing' || gameStatus === 'countdown') && onQualityPresetChange && (
        <div style={{
          position: 'absolute',
          top: 424,
          left: 20,
          width: '166px',
          pointerEvents: 'auto',
          zIndex: 60,
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
          userSelect: 'none'
        }}>
          <RacingQualitySelector
            selectedPresetId={qualityPresetId}
            onPresetChange={onQualityPresetChange}
            layout="vertical"
          />
          <div style={{ marginTop: '10px' }}>
            <RacingFpsCounter position="static" />
          </div>
          {devRemotePlayerLoad && devRemotePlayerLoad.configuredCount > 0 && (
            <div style={{
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: 1.35,
              marginTop: '10px',
              opacity: 0.85
            }}>
              DEV REMOTES: {devRemotePlayerLoad.visibleCount}/{devRemotePlayerLoad.configuredCount}
              {devRemotePlayerLoad.speedScale && devRemotePlayerLoad.speedScale !== 1 ? ` x${devRemotePlayerLoad.speedScale}` : ''}
            </div>
          )}
        </div>
      )}

      {(gameStatus === 'racing' || gameStatus === 'countdown') && onCameraModeChange && (
        <RacingCameraModeSelector
          cameraMode={cameraMode}
          onCameraModeChange={onCameraModeChange}
        />
      )}

      <RacingControlsHelper />

      {gameStatus === 'countdown' && countdown > 0 && (
        <RacingCountdownDisplay countdown={countdown} />
      )}

      {/* Game Over */}
      {gameStatus === 'crashed' && (
        <RacingCrashOverlay score={score} onRestart={onRestart} />
      )}
    </div>
  )
})
