import React from 'react'
import { GameStatus } from '../foxracingsanluis/FoxRacingGame'
import { CameraMode } from '../foxracingsanluis/FreeRoamCar'
import racePhoto from '../../assets/race-photo.png'
import { RacingCountdownDisplay } from '../../racing/components/RacingCountdownDisplay'
import { RacingHudMetrics } from '../../racing/components/RacingHudMetrics'
import { RacingCameraModeSelector } from '../../racing/components/RacingCameraModeSelector'
import { RacingControlsHelper } from '../../racing/components/RacingControlsHelper'
import { RacingColorPicker } from '../../racing/components/RacingColorPicker'
import { RacingCrashOverlay } from '../../racing/components/RacingCrashOverlay'
import { RacingConnectOverlay } from '../../racing/components/RacingConnectOverlay'

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
  cameraMode?: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
}

export const RacingUI: React.FC<RacingUIProps> = ({
  gameStatus,
  score,
  distanceTraveled = 0,
  lapTime = 0,
  lapTimes = [],
  lapTxids = {},
  speed = 0, // Speed in m/s
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
  cameraMode = 'smooth',
  onCameraModeChange
}) => {
  // If idle, show Join Modal
  if (gameStatus === 'idle') {
    return (
      <RacingConnectOverlay backgroundImage={racePhoto} onConnectWallet={onConnectWallet} />
    )
  }

  // Showroom UI - Minimal "Start Race" overlay
  if (gameStatus === 'showroom') {
    return (
      <div style={{ position: 'absolute', top: 220, left: 10, zIndex: 100, textAlign: 'left' }}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          padding: '20px 40px', 
          borderRadius: '12px', 
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '24px' }}>Ready to Race?</h3>
          <RacingColorPicker selectedColor={playerColor} onColorChange={onColorChange} />
          <button onClick={onJoin} className="join-button neon" style={{ fontSize: '20px', padding: '15px 40px' }}>
            START RACE
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      <RacingHudMetrics
        distanceTraveled={distanceTraveled}
        speed={speed}
        showLapTime={gameStatus === 'racing'}
        lapTime={lapTime}
        lapTimes={lapTimes}
        lapTxids={lapTxids}
      />

      {/* Camera Mode Selector - Positioned below fox info panel */}
      {(gameStatus === 'racing' || gameStatus === 'countdown') && onCameraModeChange && (
        <RacingCameraModeSelector
          cameraMode={cameraMode}
          onCameraModeChange={onCameraModeChange}
        />
      )}

      <RacingControlsHelper />

      {/* Countdown */}
      {gameStatus === 'countdown' && countdown > 0 && (
        <RacingCountdownDisplay countdown={countdown} />
      )}

      {/* Game Over */}
      {gameStatus === 'crashed' && (
        <RacingCrashOverlay score={score} onRestart={onRestart} />
      )}
    </div>
  )
}
