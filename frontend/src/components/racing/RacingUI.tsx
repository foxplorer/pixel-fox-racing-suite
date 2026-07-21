import React, { memo, useMemo, useState, useEffect, useCallback } from 'react'
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
import { RacingShowroomStatsStrip } from '../../racing/components/RacingShowroomStatsStrip'
import { MobileDrivingControls } from '../../racing/components/MobileDrivingControls'
import { MobileOrientationOverlay } from '../../racing/components/MobileOrientationOverlay'
import { MobileRaceMenu } from '../../racing/components/MobileRaceMenu'
import { ScheduledRacePanel } from '../../racing/components/ScheduledRacePanel'
import type { WalletConnectSource } from '../../components/FaucetPandaConnectButton'
import { useRacingDeviceProfile } from '../../racing/platform/useRacingDeviceProfile'
import { ScheduledRaceFinishStatusBanner, ScheduledRaceMobilePositionBadge, ScheduledRaceStandingsPanel, type ScheduledRaceFinishOrderByEntrant, type ScheduledRaceLapProgressByEntrant, type ScheduledRaceSettlementState } from '../../racing/components/ScheduledRaceStandingsPanel'
import type { RacingQualityPresetId } from '../../racing/performance/qualitySettings'
import type { ScheduledRaceRoomSnapshot } from '../../racing/scheduled/scheduledRaceSocket'
import type { ScheduledRace, ScheduledRaceSignup } from '../../racing/scheduled/scheduledRaceTypes'

// ========== MEMOIZED SUB-COMPONENTS ==========

// HUD Display - only re-renders when speed, distance, or lapTime change
const HUDDisplay = memo<{
  distanceTraveled: number
  speed: number
  lapTime: number
  gameStatus: GameStatus
  lapTimes: number[]
  lapTxids: { [index: number]: string }
  scheduledRaceStandings?: RacingUiScheduledRaceStandings | null
  compact?: boolean
}>(({ distanceTraveled, speed, lapTime, gameStatus, lapTimes, lapTxids, scheduledRaceStandings, compact }) => (
  <RacingHudMetrics
    distanceTraveled={distanceTraveled}
    speed={speed}
    showLapTime={gameStatus === 'racing'}
    lapTime={lapTime}
    lapTimes={scheduledRaceStandings ? undefined : lapTimes}
    lapTxids={lapTxids}
    lapListMarginTop="70px"
    compact={compact}
    lapListReplacement={scheduledRaceStandings && !compact ? (
      <ScheduledRaceStandingsPanel
        snapshot={scheduledRaceStandings.snapshot}
        activeRaceId={scheduledRaceStandings.activeRaceId}
        localEntrantId={scheduledRaceStandings.localEntrantId}
        lapProgressByEntrant={scheduledRaceStandings.lapProgressByEntrant}
        finishOrderByEntrant={scheduledRaceStandings.finishOrderByEntrant}
        lapsRequired={scheduledRaceStandings.lapsRequired}
      />
    ) : undefined}
  />
))

export interface RacingUiScheduledRaceStandings {
  snapshot: ScheduledRaceRoomSnapshot | null
  activeRaceId?: string | null
  localEntrantId?: string | null
  lapProgressByEntrant: ScheduledRaceLapProgressByEntrant
  finishOrderByEntrant?: ScheduledRaceFinishOrderByEntrant
  lapsRequired?: number
  settlement?: ScheduledRaceSettlementState | null
}

const getOrdinalLabel = (place: number): string => {
  const mod100 = place % 100
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`
  switch (place % 10) {
    case 1:
      return `${place}st`
    case 2:
      return `${place}nd`
    case 3:
      return `${place}rd`
    default:
      return `${place}th`
  }
}

const getSettlementLine = (settlement: ScheduledRaceSettlementState): string => {
  if (settlement.status === 'settled') return settlement.txid ? 'Race inscribed' : 'Race complete'
  if (settlement.status === 'no_contest') return 'Race ended — no contest'
  return 'Race cancelled'
}

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
  onJoin: () => void | Promise<void>
  onEnterShowroom?: () => void
  onRestart: () => void
  foxName?: string | null
  foxOutpoint?: string | null
  foxOriginOutpoint?: string | null
  identityKey?: string | null
  playerColor: string
  onColorChange: (color: string) => void
  ordinalAddress?: string | null
  onConnectWallet?: (source?: WalletConnectSource) => void | Promise<void>
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
  transactionServerUrl?: string
  onEnterScheduledRace?: (race: ScheduledRace, signup: ScheduledRaceSignup) => void
  scheduledRaceStandings?: RacingUiScheduledRaceStandings | null
  scheduledRaceStartBlocked?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onMobileFirstInteraction?: () => void
  devRemotePlayerLoad?: {
    configuredCount: number
    visibleCount: number
    speedScale?: number
  }
}

// Persists the showroom mode across the game-component remounts that a track change
// triggers: the game is keyed by track in FoxRacing.tsx, so selecting a different track
// in Time Trial remounts RacingUI and would otherwise reset this state to 'multiplayer'.
// Module-scoped so it survives the remount but resets on a full page reload; only one
// RacingUI is mounted at a time, so a single holder is safe.
let persistedShowroomMode: 'multiplayer' | 'itt' | null = null

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
  foxOutpoint,
  foxOriginOutpoint,
  identityKey,
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
  transactionServerUrl,
  onEnterScheduledRace,
  scheduledRaceStandings,
  scheduledRaceStartBlocked = false,
  isFullscreen,
  onToggleFullscreen,
  onMobileFirstInteraction,
  devRemotePlayerLoad
}) => {
	// Track window size for responsive minimaps (must be before any conditional returns)
	const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })
	const deviceProfile = useRacingDeviceProfile()
	const isMobileRacingUi = deviceProfile.prefersMobileRacingUi
  const isMobileLandscapeShowroom = isMobileRacingUi && deviceProfile.isLandscape
	const isLiveDriving = gameStatus === 'racing' || gameStatus === 'countdown'
	const hasMultiplayerShowroom = Boolean(transactionServerUrl && onEnterScheduledRace)
  const [showroomMode, setShowroomModeState] = useState<'multiplayer' | 'itt'>(() => (
    persistedShowroomMode ?? (hasMultiplayerShowroom && !isMobileRacingUi ? 'multiplayer' : 'itt')
  ))
  const setShowroomMode = useCallback((mode: 'multiplayer' | 'itt') => {
    persistedShowroomMode = mode
    setShowroomModeState(mode)
  }, [])
  const isScheduledRaceActive = Boolean(scheduledRaceStandings?.activeRaceId)
  const hasScheduledRaceSettlement = Boolean(scheduledRaceStandings?.settlement)
  const canLeaveScheduledRace = isScheduledRaceActive && (
    gameStatus === 'loading' ||
    gameStatus === 'countdown' ||
    hasScheduledRaceSettlement
  )
  const showScheduledRaceStartBlockedModal = scheduledRaceStartBlocked && isScheduledRaceActive
  const localScheduledRacePlace = scheduledRaceStandings?.localEntrantId
    ? scheduledRaceStandings.finishOrderByEntrant?.[scheduledRaceStandings.localEntrantId]
    : undefined
  const showScheduledRaceOverModal = Boolean(
    onEnterShowroom &&
    scheduledRaceStandings?.settlement &&
    scheduledRaceStandings.settlement.status !== 'cancelled'
  )
  const mobileScheduledRacePositionBadge = isMobileRacingUi && scheduledRaceStandings ? (
    <ScheduledRaceMobilePositionBadge
      snapshot={scheduledRaceStandings.snapshot}
      activeRaceId={scheduledRaceStandings.activeRaceId}
      localEntrantId={scheduledRaceStandings.localEntrantId}
      lapProgressByEntrant={scheduledRaceStandings.lapProgressByEntrant}
      finishOrderByEntrant={scheduledRaceStandings.finishOrderByEntrant}
      lapsRequired={scheduledRaceStandings.lapsRequired}
    />
  ) : null

	useEffect(() => {
	  const handleResize = () => {
	    setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
	  }, [])

	useEffect(() => {
	  if (!hasMultiplayerShowroom && showroomMode !== 'itt') {
	    setShowroomMode('itt')
	  }
	}, [hasMultiplayerShowroom, showroomMode])

  const showroomTrackData = useMemo(() => {
    const eventVehicleModes = showroomVehicleModes ?? [vehicleMode]
    return getTrackPreviewDefinitions(eventVehicleModes, importedCarTracks)
  }, [importedCarTracks, showroomVehicleModes, vehicleMode])

  const minimapColumns = isMobileRacingUi ? 1 : showroomTrackData.length > 1 ? 2 : 1
  const minimapRows = Math.max(1, Math.ceil(showroomTrackData.length / minimapColumns))

  // Calculate minimap size based on window dimensions.
  // The showroom previews use a two-column grid so larger track catalogs stay on-screen.
  const minimapSize = useMemo(() => {
    const topMargin = isMobileRacingUi ? 8 : 20
    const containerPadding = isMobileRacingUi ? 16 : 26
    const labelHeight = isMobileRacingUi ? 14 * minimapRows : 16 * minimapRows
    const rowGaps = (isMobileRacingUi ? 6 : 8) * Math.max(0, minimapRows - 1)
    const bottomMargin = isMobileRacingUi ? 132 : 20
    const totalOverhead = topMargin + containerPadding + labelHeight + rowGaps + bottomMargin

    const availableHeight = windowSize.height - totalOverhead
    const maxFromHeight = Math.floor(availableHeight / minimapRows)

    const panelHorizontalMargin = isMobileRacingUi ? 16 : 40
    const panelPadding = isMobileRacingUi ? 16 : 24
    const columnGaps = (isMobileRacingUi ? 6 : 8) * Math.max(0, minimapColumns - 1)
    const availablePanelWidth = isMobileRacingUi
      ? Math.min(92, windowSize.width * 0.24)
      : Math.min(windowSize.width - panelHorizontalMargin, windowSize.width * 0.42)
    const maxFromWidth = Math.floor((availablePanelWidth - panelPadding - columnGaps) / minimapColumns)

    const size = Math.min(maxFromHeight, maxFromWidth)
    return isMobileRacingUi
      ? Math.max(42, Math.min(70, size))
      : Math.max(42, Math.min(96, size))
  }, [isMobileRacingUi, minimapColumns, minimapRows, windowSize])

  // If idle, show Join Modal
  if (gameStatus === 'idle') {
    return (
      <RacingConnectOverlay backgroundImage={racePhoto} onConnectWallet={onConnectWallet} />
    )
  }

  // Showroom UI - Track selection with minimap previews
  if (gameStatus === 'showroom') {
    return (
      <>
        {isMobileRacingUi && (
          <MobileRaceMenu
            canLeaveRace={false}
            foxName={foxName}
            foxOriginOutpoint={foxOriginOutpoint}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            onAnyInteraction={onMobileFirstInteraction}
          />
        )}

        {/* Track Preview Minimaps - Upper right */}
        <div style={{
          position: 'absolute',
          zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          ...(isMobileRacingUi
            ? {
                // Mobile: a single horizontal track-picker strip pinned just under
                // the top menu bar. Reads as a carousel, not a second scrolling
                // panel over the car — the controls sheet is the only vertical scroll.
                top: 'calc(env(safe-area-inset-top, 0px) + 54px)',
                left: 'calc(env(safe-area-inset-left, 0px) + 8px)',
                right: 'calc(env(safe-area-inset-right, 0px) + 8px)',
                display: 'flex',
                flexDirection: 'row',
                gap: '6px',
                padding: '6px',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch'
              }
            : {
                // Desktop: unchanged — a vertical grid of previews, top-right.
                top: 20,
                right: 20,
                display: 'grid',
                gridTemplateColumns: `repeat(${minimapColumns}, ${minimapSize}px)`,
                alignItems: 'start',
                gap: '8px',
                padding: '10px 12px 16px 12px',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto'
              })
        }}>
          {showroomTrackData.map(track => (
            <div
              key={`${track.vehicleMode}-${track.trackName}`}
              style={isMobileRacingUi ? { flex: '0 0 auto' } : undefined}
            >
              <TrackPreviewMinimap
                trackCurve={track.curve}
                trackName={track.trackName}
                isSelected={trackName === track.trackName}
                onSelectTrack={onTrackChange}
                width={isMobileRacingUi ? 64 : minimapSize}
                height={isMobileRacingUi ? 64 : minimapSize}
              />
            </div>
          ))}
        </div>

	        {/* Main controls panel - Left side */}
	        <div style={{
            position: 'absolute',
            top: isMobileLandscapeShowroom ? 'calc(env(safe-area-inset-top, 0px) + 136px)' : isMobileRacingUi ? 'auto' : 220,
            left: isMobileRacingUi ? 'calc(env(safe-area-inset-left, 0px) + 8px)' : 10,
            right: isMobileLandscapeShowroom ? 'auto' : isMobileRacingUi ? 'calc(env(safe-area-inset-right, 0px) + 8px)' : 'auto',
            bottom: isMobileRacingUi ? 'calc(env(safe-area-inset-bottom, 0px) + 8px)' : 'auto',
            zIndex: 100,
            textAlign: 'left'
          }}>
	          <div style={{
	            background: 'rgba(0,0,0,0.7)',
	            padding: isMobileLandscapeShowroom ? '8px 10px' : isMobileRacingUi ? '10px 12px' : '20px 40px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
	            backdropFilter: 'blur(10px)',
              width: isMobileLandscapeShowroom ? 'min(360px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 16px))' : isMobileRacingUi ? 'min(100%, 380px)' : undefined,
              maxHeight: isMobileRacingUi
                ? isMobileLandscapeShowroom
                  ? 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 144px)'
                  : '58dvh'
                : undefined,
              overflowY: isMobileRacingUi ? 'auto' : undefined
	          }}>
	            <h3 style={{
                margin: isMobileRacingUi ? '0 0 8px 0' : '0 0 15px 0',
                color: '#fff',
                fontSize: isMobileRacingUi ? '15px' : '24px',
                display: isMobileLandscapeShowroom ? 'none' : undefined
              }}>
                Ready to Race?
              </h3>
	            {hasMultiplayerShowroom && !isMobileRacingUi && (
	              <div style={{
	                color: '#d8d8d8',
	                fontFamily: 'monospace',
	                fontSize: '11px',
	                lineHeight: 1.45,
	                margin: '-6px 0 14px 0',
	                maxWidth: 250
	              }}>
	                Join a scheduled multiplayer race, or select Time Trial to race now.
	              </div>
	            )}

	            {hasMultiplayerShowroom && (
	              <div style={{
	                display: 'grid',
	                gridTemplateColumns: '1fr 1fr',
	                gap: '6px',
	                marginBottom: isMobileLandscapeShowroom ? '8px' : isMobileRacingUi ? '10px' : '14px',
	                border: '1px solid rgba(255,255,255,0.14)',
	                borderRadius: '8px',
	                padding: '4px',
	                background: 'rgba(255,255,255,0.06)'
	              }}>
	                {([
	                  ['multiplayer', 'Multiplayer'],
	                  ['itt', 'Time Trial']
	                ] as const).map(([mode, label]) => {
	                  const selected = showroomMode === mode
	                  return (
	                    <button
	                      key={mode}
	                      type="button"
	                      onClick={() => setShowroomMode(mode)}
	                      style={{
	                        height: isMobileLandscapeShowroom ? 28 : isMobileRacingUi ? 30 : 34,
	                        borderRadius: '6px',
	                        border: selected ? '1px solid rgba(155,231,224,0.55)' : '1px solid transparent',
	                        background: selected ? 'rgba(155,231,224,0.18)' : 'transparent',
	                        color: selected ? '#9BE7E0' : '#d9d9d9',
	                        fontFamily: 'monospace',
	                        fontWeight: 700,
	                        fontSize: '12px',
	                        cursor: 'pointer'
	                      }}
	                    >
	                      {label}
	                    </button>
	                  )
	                })}
	              </div>
	            )}

	            <RacingColorPicker
                selectedColor={playerColor}
                onColorChange={onColorChange}
                gap={isMobileLandscapeShowroom ? '6px' : isMobileRacingUi ? '7px' : undefined}
                marginBottom={isMobileLandscapeShowroom ? '8px' : isMobileRacingUi ? '10px' : undefined}
                swatchSize={isMobileLandscapeShowroom ? '22px' : isMobileRacingUi ? '25px' : undefined}
              />
	            {onQualityPresetChange && (
	              <RacingQualitySelector
	                selectedPresetId={qualityPresetId}
	                onPresetChange={onQualityPresetChange}
                  compact={isMobileRacingUi}
	              />
	            )}
              {isMobileRacingUi && !isMobileLandscapeShowroom && onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  style={{
                    width: '100%',
                    height: 32,
                    marginBottom: 8,
                    borderRadius: 6,
                    border: '1px solid rgba(78, 205, 196, 0.55)',
                    background: 'rgba(78, 205, 196, 0.18)',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
                </button>
              )}

	            {showroomMode === 'itt' && (
	              <>
	                {/* Track Selection Dropdown */}
	                <div style={{ marginBottom: isMobileLandscapeShowroom ? '8px' : isMobileRacingUi ? '10px' : '15px' }}>
	                  <label style={{ display: isMobileLandscapeShowroom ? 'none' : 'block', color: '#fff', marginBottom: isMobileRacingUi ? '5px' : '8px', fontSize: isMobileRacingUi ? '12px' : '14px', fontWeight: 'bold' }}>
	                    Track
	                  </label>
	                  <select
	                    value={trackName}
	                    onChange={(e) => onTrackChange && onTrackChange(e.target.value)}
	                    style={{
	                      width: '100%',
	                      padding: isMobileLandscapeShowroom ? '6px 9px' : isMobileRacingUi ? '7px 10px' : '10px 15px',
	                      borderRadius: '8px',
	                      border: '2px solid rgba(255,255,255,0.2)',
	                      background: 'rgba(0,0,0,0.5)',
	                      color: '#fff',
	                      fontSize: isMobileLandscapeShowroom ? '12px' : isMobileRacingUi ? '13px' : '16px',
	                      fontFamily: 'monospace',
	                      cursor: 'pointer',
	                      outline: 'none'
	                    }}
	                  >
	                    {showroomTrackData.map(track => (
	                      <option key={`${track.vehicleMode}-${track.trackName}`} value={track.trackName} style={{ background: '#000', color: '#fff' }}>
	                        {track.trackName}
	                      </option>
	                    ))}
	                  </select>
	                </div>

	                <button
	                  onClick={() => { void onJoin() }}
	                  className="join-button neon"
	                  style={{
	                    width: isMobileRacingUi ? '100%' : undefined,
	                    fontSize: isMobileLandscapeShowroom ? '14px' : isMobileRacingUi ? '15px' : '20px',
	                    padding: isMobileLandscapeShowroom ? '8px 14px' : isMobileRacingUi ? '10px 16px' : '15px 40px',
	                    opacity: showroomLoading ? 0.4 : 1,
	                    cursor: showroomLoading ? 'not-allowed' : 'pointer',
	                    filter: showroomLoading ? 'grayscale(100%)' : 'none'
	                  }}
	                  disabled={showroomLoading}
	                >
	                  START RACE
	                </button>
	              </>
	            )}

              {showroomMode === 'multiplayer' && isMobileRacingUi && transactionServerUrl && (
                <ScheduledRacePanel
                  transactionServerUrl={transactionServerUrl}
                  trackName={trackName}
                  identityKey={identityKey}
                  ownerAddress={ordinalAddress}
                  foxOutpoint={foxOutpoint}
                  foxOriginOutpoint={foxOriginOutpoint}
                  foxName={foxName}
                  carColor={playerColor}
                  onEnterRace={onEnterScheduledRace}
                  compact
                />
              )}
	          </div>
	        </div>

	        {showroomMode === 'multiplayer' && !isMobileRacingUi && (
	          <RacingShowroomStatsStrip
	            foxName={foxName}
	            foxOutpoint={foxOutpoint}
	            foxOriginOutpoint={foxOriginOutpoint}
	            identityKey={identityKey}
	            ordinalAddress={ordinalAddress}
	            playerColor={playerColor}
	            trackName={trackName}
	            transactionServerUrl={transactionServerUrl}
	            onEnterScheduledRace={onEnterScheduledRace}
              mobileLayout={isMobileRacingUi}
              showLapStats={!isMobileRacingUi}
	          />
	        )}

	        {showroomMode === 'itt' && !isMobileRacingUi && (
	          <RacingShowroomStatsStrip
	            foxName={foxName}
	            foxOutpoint={foxOutpoint}
	            foxOriginOutpoint={foxOriginOutpoint}
	            identityKey={identityKey}
	            ordinalAddress={ordinalAddress}
	            playerColor={playerColor}
	            trackName={trackName}
	          />
	        )}
	      </>
	    )
	  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
      {isMobileRacingUi && (
        <MobileRaceMenu
          canLeaveRace={!scheduledRaceStandings || canLeaveScheduledRace}
          onEnterShowroom={onEnterShowroom}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          onAnyInteraction={onMobileFirstInteraction}
          foxName={foxName}
          foxOriginOutpoint={foxOriginOutpoint}
        />
      )}

      {!isMobileRacingUi && onEnterShowroom && gameStatus !== 'idle' && gameStatus !== 'showroom' && (!scheduledRaceStandings || canLeaveScheduledRace) && (
        <button
          type="button"
          onClick={onEnterShowroom}
          aria-label="Switch track"
          title={hasScheduledRaceSettlement ? 'Return to the showroom after this race' : canLeaveScheduledRace ? 'Leave this scheduled race and switch track' : 'Switch track'}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            zIndex: 90,
            pointerEvents: 'auto',
            height: 34,
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(0,0,0,0.62)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            userSelect: 'none'
          }}
        >
          Switch Track
        </button>
      )}

      {showScheduledRaceStartBlockedModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 130,
          pointerEvents: 'auto',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(0,0,0,0.42)',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            width: 'min(90vw, 430px)',
            borderRadius: 8,
            border: '1px solid rgba(255, 209, 102, 0.42)',
            background: 'rgba(8, 8, 8, 0.9)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
            padding: '18px',
            color: '#fff',
            fontFamily: 'monospace',
            textAlign: 'left'
          }}>
            <div style={{ color: '#FFD166', fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              Race cancelled
            </div>
            <div style={{ color: '#d8d8d8', fontSize: 12, lineHeight: 1.45, marginBottom: 14 }}>
              Multiplayer races need at least 2 racers at the start. This race will not be inscribed. Return to the showroom to choose Time Trial.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                onClick={onEnterShowroom}
                style={{
                  height: 36,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.24)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Back to Showroom
              </button>
            </div>
          </div>
        </div>
      )}

      {showScheduledRaceOverModal && scheduledRaceStandings?.settlement && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 132,
          pointerEvents: 'auto',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(0,0,0,0.34)',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            width: 'min(90vw, 430px)',
            borderRadius: 8,
            border: '1px solid rgba(53, 208, 111, 0.42)',
            background: 'rgba(8, 8, 8, 0.9)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
            padding: '18px',
            color: '#fff',
            fontFamily: 'monospace',
            textAlign: 'left'
          }}>
            <div style={{ color: '#35D06F', fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              Race Over
            </div>
            <div style={{ color: '#ffffff', fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              {localScheduledRacePlace ? `Finished ${getOrdinalLabel(localScheduledRacePlace)}` : 'DNF'}
            </div>
            <div style={{ color: '#d8d8d8', fontSize: 12, lineHeight: 1.45, marginBottom: 14 }}>
              {getSettlementLine(scheduledRaceStandings.settlement)}
              {scheduledRaceStandings.settlement.txid ? ` · ${scheduledRaceStandings.settlement.txid.slice(0, 8)}...${scheduledRaceStandings.settlement.txid.slice(-6)}` : ''}
            </div>
            <button
              type="button"
              onClick={onEnterShowroom}
              style={{
                width: '100%',
                height: 38,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer'
              }}
            >
              Back to Showroom
            </button>
          </div>
        </div>
      )}

      {scheduledRaceStandings && (
        <ScheduledRaceFinishStatusBanner
          snapshot={scheduledRaceStandings.snapshot}
          activeRaceId={scheduledRaceStandings.activeRaceId}
          localEntrantId={scheduledRaceStandings.localEntrantId}
          lapProgressByEntrant={scheduledRaceStandings.lapProgressByEntrant}
          finishOrderByEntrant={scheduledRaceStandings.finishOrderByEntrant}
          lapsRequired={scheduledRaceStandings.lapsRequired}
          settlement={scheduledRaceStandings.settlement}
        />
      )}

      {isMobileRacingUi && deviceProfile.isLandscape && mobileScheduledRacePositionBadge && (
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 100px)',
          zIndex: 101,
          pointerEvents: 'none'
        }}>
          {mobileScheduledRacePositionBadge}
        </div>
      )}

      <HUDDisplay
        distanceTraveled={distanceTraveled}
        speed={speed}
        lapTime={lapTime}
        gameStatus={gameStatus}
          lapTimes={lapTimes}
          lapTxids={lapTxids}
          scheduledRaceStandings={scheduledRaceStandings}
          compact={isMobileRacingUi}
        />

      {isLiveDriving && !isMobileRacingUi && onQualityPresetChange && (
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

      {isLiveDriving && !isMobileRacingUi && onCameraModeChange && (
        <RacingCameraModeSelector
          cameraMode={cameraMode}
          onCameraModeChange={onCameraModeChange}
        />
      )}

      {!isMobileRacingUi && <RacingControlsHelper />}

      {isMobileRacingUi && isLiveDriving && (
        <MobileDrivingControls
          inputMode={vehicleMode === 'snowmobile' ? 'keyboard' : 'car'}
          onFirstInteraction={onMobileFirstInteraction}
        />
      )}

      {isMobileRacingUi && isLiveDriving && (
        <RacingFpsCounter
          position="absolute"
          top={12}
          left="50%"
          right="auto"
          transform="translateX(-50%)"
          zIndex={60}
        />
      )}

      {gameStatus === 'countdown' && countdown > 0 && countdown <= 3 && (
        <RacingCountdownDisplay countdown={countdown} />
      )}

      {/* Game Over */}
      {gameStatus === 'crashed' && (
        <RacingCrashOverlay
          score={score}
          onRestart={onRestart}
          title="GAME OVER"
          description="Your fox burned up in the lava!"
          restartLabel="Restart Track"
        />
      )}

      {isMobileRacingUi && isLiveDriving && !deviceProfile.isLandscape && (
        <MobileOrientationOverlay />
      )}
    </div>
  )
})
