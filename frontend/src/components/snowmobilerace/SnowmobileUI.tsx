import React, { memo } from 'react'
import { GameStatus } from './types'
import snowmobilePhoto from '../../assets/snowmobile_photo.png'
import { RacingCountdownDisplay } from '../../racing/components/RacingCountdownDisplay'
import { RacingHudMetrics } from '../../racing/components/RacingHudMetrics'
import { RacingCameraModeSelector } from '../../racing/components/RacingCameraModeSelector'
import { RacingControlsHelper } from '../../racing/components/RacingControlsHelper'
import { RacingLoadingOverlay } from '../../racing/components/RacingLoadingOverlay'
import { RacingConnectOverlay } from '../../racing/components/RacingConnectOverlay'
import { RacingFpsCounter } from '../../racing/components/RacingFpsCounter'
import { RacingOnlineBadge } from '../../racing/components/RacingOnlineBadge'
import { SnowmobileShowroomControls } from '../../racing/components/SnowmobileShowroomControls'
import {
  RacingChatInputBar,
  SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH
} from '../../racing/components/RacingChatInputBar'

// Camera mode type - matches Belgium track
type CameraMode = 'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'

// ============ MAIN COMPONENT ============

interface SnowmobileUIProps {
  gameStatus: GameStatus
  speed: number
  distanceTraveled?: number
  countdown?: number
  hasJoined: boolean
  onJoin: () => void
  onRestart: () => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
  playerColor: string
  onColorChange: (color: string) => void
  ordinalAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendChat: () => void
  playersOnline: number
  sledReady?: boolean
  onEnterRide?: () => void
  cameraMode?: CameraMode
  onCameraModeChange?: (mode: CameraMode) => void
}

export const SnowmobileUI: React.FC<SnowmobileUIProps> = memo(({
  gameStatus,
  speed = 0,
  distanceTraveled = 0,
  countdown = 3,
  hasJoined,
  onJoin,
  onRestart,
  foxName,
  foxOriginOutpoint,
  playerColor,
  onColorChange,
  ordinalAddress,
  onConnectWallet,
  chatInput,
  onChatInputChange,
  onSendChat,
  playersOnline,
  sledReady = false,
  onEnterRide,
  cameraMode = 'smooth',
  onCameraModeChange
}) => {
  // If idle, show Connect Wallet button with background image
  if (gameStatus === 'idle') {
    return (
      <RacingConnectOverlay
        className="snowmobile-join-overlay"
        backdropClassName="snowmobile-join-overlay-backdrop"
        backgroundImage={snowmobilePhoto}
        onConnectWallet={onConnectWallet}
      />
    )
  }

  // Showroom - color selection with rotating snowmobile preview
  if (gameStatus === 'showroom') {
    return (
      <SnowmobileShowroomControls
        playerColor={playerColor}
        onColorChange={onColorChange}
        onEnterRide={onEnterRide}
      />
    )
  }

  // Loading screen - black with PulseLoader
  // Show loading when loading status OR when racing but sled not ready
  if (gameStatus === 'loading' || (gameStatus === 'racing' && !sledReady)) {
    return <RacingLoadingOverlay color="#87CEEB" zIndex={200} label="LOADING WORLD..." spinnerMargin={5} />
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      <RacingHudMetrics speed={speed} distanceTraveled={distanceTraveled} />

      {(gameStatus === 'racing' || gameStatus === 'countdown') && onCameraModeChange && (
        <RacingCameraModeSelector
          cameraMode={cameraMode}
          onCameraModeChange={onCameraModeChange}
          top={170}
          left={10}
        />
      )}

      <RacingControlsHelper variant="snowmobile" />

      {hasJoined && (
        <RacingChatInputBar
          value={chatInput}
          onChange={onChatInputChange}
          onSend={onSendChat}
          placeholder="Type to chat..."
          maxLength={SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH}
          buttonLabel="Send"
          buttonBackground={playerColor}
          bottom={185}
          left={20}
          width="auto"
          maxWidth="none"
          gap="8px"
          zIndex={100}
          className=""
          compact
          stopOnlyGameKeys
          preventDefaultOnEnter
        />
      )}

      {hasJoined && playersOnline > 0 && (
        <RacingOnlineBadge count={playersOnline} />
      )}

      {gameStatus === 'countdown' && countdown > 0 && (
        <RacingCountdownDisplay countdown={countdown} variant="snowmobile" />
      )}

      <RacingFpsCounter />
    </div>
  )
})
