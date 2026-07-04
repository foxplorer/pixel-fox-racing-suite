import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import * as THREE from 'three'
import { FoxRacingWorld } from './FoxRacingWorld'
import { RacingUI, type RacingUiScheduledRaceStandings } from '../racing/RacingUI'
import { runPixelRacingLapCompletionWorkflow } from '../../racing/transactions/lapSubmission'
import { registerRacingTransactionSocketListeners } from '../../racing/transactions/socketActivity'
import { getOrdinalContentUrl } from '../../racing/transactions/ordinalLinks'
import { buildJoinGamePayload, shouldEmitJoinGame } from '../../racing/multiplayer/joinGamePayload'
import { useCarTrackPlayerAppearanceSync } from '../../racing/multiplayer/useCarTrackPlayerAppearanceSync'
import { applyCarTrackGameJoined, type GameJoinedSocketPayload } from '../../racing/multiplayer/gameJoined'
import { registerCarTrackGameStateSocketListener } from '../../racing/multiplayer/carTrackGameStateSocketListeners'
import { applyJoinedCarTrackPlayer, applyLeftCarTrackPlayer, type PlayerJoinedSocketPayload } from '../../racing/multiplayer/playerJoined'
import {
  registerCarTrackJoinSocketListeners,
  registerRacingSocketConnectionListeners
} from '../../racing/multiplayer/socketConnection'
import {
  isCurrentMultiplayerPlayer,
} from '../../racing/multiplayer/playerIdentity'
import { applyScheduledRaceStartState, shouldAutoEnterRaceShowroom, startRaceForSelectedTrack } from '../../racing/simulation/raceLifecycle'
import './FoxRacingComponent.css'
import { PixelRacingGameResult } from './types'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import jungle from '../../assets/engine-idle.mp3'
import raceStartBeeps from '../../assets/race-start-beeps.mp3'
import dingSound from '../../assets/ding.mp3'
import explosionSound from '../../assets/explosion.mp3'
import blueberryUrl from '../../assets/blueberries.svg'
import rabbitUrl from '../../assets/rabbit-face.svg'
import saladUrl from '../../assets/salad.svg'
import { RacingLoadingOverlay } from '../../racing/components/RacingLoadingOverlay'
import { RacingChatInputBar } from '../../racing/components/RacingChatInputBar'
import { RacingSoundToggle } from '../../racing/components/RacingSoundToggle'
import { getCarRacingGameViewportStyle } from '../../racing/components/racingGameViewport'
import { createPreloadedAudio, playAudioElement, useLoopingIdleAudio } from '../../racing/components/audioElements'
import { useRaceCountdownFlow } from '../../racing/components/useRaceCountdownFlow'
import { useCurrentPlayersPanelRender } from '../../racing/components/useCurrentPlayersPanelRender'
import { useRacingChatSender } from '../../racing/components/useRacingChatSender'
import { useCollectibleItemActions } from '../../racing/components/useCollectibleItemActions'
import { useRaceRestartHandler } from '../../racing/components/useRaceRestartHandler'
import { Minimap } from './Minimap'
import { trackLocation } from './TrackData'
import { australiaCarTrackDefinition, type CarTrackDefinition } from '../../racing/tracks/carTrackDefinitions'
import type { ImportedCarTrackId } from '../../racing/tracks/importedCarTrackCatalog'
import {
  findImportedCarTrackDefinitionById,
  IMPORTED_CAR_TRACK_DEFINITIONS
} from '../../racing/tracks/importedCarTrackRegistry'
import { DEFAULT_PLAYER_COLOR, getPlayerColorByIndex } from '../../racing/core/playerColors'
import type { RacingCollectibleType as CollectibleType, RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import {
  registerCollectibleSocketListeners,
  removeCollectedItem,
  scheduleCollectibleTransactionAfterPickup
} from '../../racing/collectibles/collectibleSocketEvents'
import { useBatchedPlayerPositionUpdates } from '../../racing/multiplayer/useBatchedPlayerPositionUpdates'
import { registerCarTrackLivePlayerSocketListeners } from '../../racing/multiplayer/carTrackPlayerSocketListeners'
import {
  buildReportPlayerCollisionPayload,
  type LocalPlayerCollisionReport
} from '../../racing/multiplayer/playerCollision'
import {
  generateFakeRemotePlayers,
  parseFakeRemotePlayerCount,
  parseFakeRemotePlayerSpeedScale
} from '../../racing/multiplayer/fakeRemotePlayers'
import { useRemotePlayerLodRendering } from '../../racing/multiplayer/useRemotePlayerLodRendering'
import { getRacingMinimapQualitySettings, getRacingQualityPreset } from '../../racing/performance/qualitySettings'
import { useRacingQualitySetting } from '../../racing/performance/useRacingQualitySetting'
import { useFullscreenToggle } from '../../racing/components/useFullscreenToggle'
import { buildScheduledRaceGridSlots, getScheduledRaceGridLayout } from '../../racing/scheduled/gridSlots'
import type { ScheduledRace, ScheduledRaceSignup } from '../../racing/scheduled/scheduledRaceTypes'
import { withdrawScheduledRaceSignup } from '../../racing/scheduled/scheduledRaceApi'
import { buildScheduledRaceRoomPlayers } from '../../racing/scheduled/scheduledRaceRoomPlayers'
import { registerScheduledRaceSocketListeners, type ScheduledRaceRoomSnapshot } from '../../racing/scheduled/scheduledRaceSocket'
import { buildStartGateMarqueeModel } from '../../racing/components/startGateMarquee'
import { buildScheduledRaceLapProgress, secondsToMilliseconds, type ActiveScheduledRaceEntry } from '../../racing/scheduled/scheduledRaceFinish'
import { deliverScheduledRaceFinish } from '../../racing/scheduled/scheduledRaceFinishDelivery'
import { registerScheduledRaceReconnectListener, type ScheduledRaceReconnectState } from '../../racing/scheduled/scheduledRaceReconnect'

const collectibleImageUrls = {
  blueberry: blueberryUrl,
  salad: saladUrl,
  rabbit: rabbitUrl
}

// Socket server URL
const SOCKET_URL = import.meta.env.VITE_PIXELRACING_SOCKET_URL || 'http://localhost:5000'

// Transaction server URL
const TRANSACTION_SERVER_URL = import.meta.env.VITE_PIXELRACING_TRANSACTION_URL || 'http://localhost:9000'

const FAKE_REMOTE_PLAYER_COUNT = parseFakeRemotePlayerCount(import.meta.env.VITE_RACING_FAKE_PLAYERS)
const FAKE_REMOTE_PLAYER_SPEED_SCALE = parseFakeRemotePlayerSpeedScale(import.meta.env.VITE_RACING_FAKE_PLAYER_SPEED)
const VOLCANO_EXPLOSION_FIRST_DELAY_MS = 1000
const VOLCANO_EXPLOSION_INTERVAL_MS = 25000

interface FoxRacingGameProps {
  identityKey?: string | null
  onPlayerInfoChange?: (name: string, color: string) => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
  foxOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  ordinalAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  onCurrentPlayersRender?: (jsx: React.ReactNode) => void
  walletSaladCount?: number
  walletBlueberryCount?: number
  walletRabbitCount?: number
  onCollectibleCollected?: (itemType: CollectibleType) => void
  onTrackChange?: (trackName: string, selectedColor?: string, scheduledEntry?: { race: ScheduledRace; signup: ScheduledRaceSignup }) => void
  trackDefinition?: CarTrackDefinition
  localTrackName?: string
  trackLocationLabel?: string
  sceneryMode?: 'australia' | 'imported-basic'
  importedCarTracks?: CarTrackDefinition[]
  trackDefinitionId?: ImportedCarTrackId
  startRaceImmediately?: boolean
  selectedColor?: string
  pendingScheduledRaceEntry?: { race: ScheduledRace; signup: ScheduledRaceSignup } | null
  onPendingScheduledRaceEntryConsumed?: () => void
}

export type GameStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

export const FoxRacingGame: React.FC<FoxRacingGameProps> = ({
  identityKey,
  onPlayerInfoChange,
  foxName,
  foxOriginOutpoint,
  foxOutpoint,
  backgroundRemovalStrategy = 'default',
  ordinalAddress,
  onConnectWallet,
  onLatestActivityChange,
  onCurrentPlayersRender,
  walletSaladCount = 0,
  walletBlueberryCount = 0,
  walletRabbitCount = 0,
  onCollectibleCollected,
  onTrackChange,
  trackDefinition = australiaCarTrackDefinition,
  localTrackName = 'Australia',
  trackLocationLabel,
  sceneryMode = 'australia',
  importedCarTracks = IMPORTED_CAR_TRACK_DEFINITIONS,
  trackDefinitionId,
  startRaceImmediately = false,
  selectedColor,
  pendingScheduledRaceEntry = null,
  onPendingScheduledRaceEntryConsumed
}) => {
  const { containerRef, isFullscreen, toggleFullscreen } = useFullscreenToggle<HTMLDivElement>()
  const importedTrackDefinition = findImportedCarTrackDefinitionById(trackDefinitionId)
  const resolvedTrackDefinition = importedTrackDefinition ?? trackDefinition
  const resolvedLocalTrackName = importedTrackDefinition?.metadata.displayName ?? localTrackName
  const resolvedTrackLocationLabel = importedTrackDefinition?.metadata.displayName ?? trackLocationLabel
  const resolvedSceneryMode = importedTrackDefinition ? 'imported-basic' : sceneryMode
  // ===== TESTING FLAG - Set to true to skip transaction submission =====
  const TESTING_MODE = false // Set to false to enable transaction submission
  // =======================================================================
  
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [score, setScore] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  const [trackLength, setTrackLength] = useState(0)
  const [lapTime, setLapTime] = useState(0) // Current lap time in seconds
  const [lapTimes, setLapTimes] = useState<number[]>([]) // Array of completed lap times
  const [lapTxids, setLapTxids] = useState<{ [index: number]: string }>({}) // Map of lap index to txid
  const [speed, setSpeed] = useState(0) // Current speed in m/s
  const [trackName, setTrackName] = useState<string>(resolvedLocalTrackName)
  const [cameraMode, setCameraMode] = useState<'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'>('smooth') // Camera mode - default to 'smooth'
  const [qualityPresetId, setQualityPresetId] = useRacingQualitySetting()
  const [fakeRemoteElapsedSeconds, setFakeRemoteElapsedSeconds] = useState(0)
  
  // Car position for minimap
  const [carPosition, setCarPosition] = useState<{ x: number; y: number; z: number } | null>(null)
  
  // Chat state
  const [localChatMessage, setLocalChatMessage] = useState<{text: string, timestamp: number} | null>(null)
  const [chatInput, setChatInput] = useState('')
  
  // Lap submission state
  const [isSubmittingLap, setIsSubmittingLap] = useState(false)
  const [lapSubmissionError, setLapSubmissionError] = useState<string | null>(null)
  const isSubmittingLapRef = useRef(false) // Ref to track submission state for closure safety
  
  // Log track length when it's calculated
  useEffect(() => {
    if (trackLength > 0) {
      console.log(`🏁 Track Length: ${trackLength.toFixed(2)} meters`)
    }
  }, [trackLength])

  // Handle lap time updates from FreeRoamCar (synchronized with lap recording timer)
  // This ensures the visual timer matches exactly what gets recorded when lap completes
  const handleLapTimeUpdate = useCallback((currentLapTime: number) => {
    setLapTime(currentLapTime)
  }, [])
  
  // Handle speed updates from FreeRoamCar (speed in m/s)
  const handleSpeedUpdate = useCallback((currentSpeed: number) => {
    setSpeed(currentSpeed)
  }, [])
  
  // Reset lap time when not racing (except during countdown)
  useEffect(() => {
    if (gameStatus !== 'racing' && gameStatus !== 'countdown') {
      setLapTime(0)
    }
  }, [gameStatus])
  
  // Reset speed when not racing
  useEffect(() => {
    if (gameStatus !== 'racing' && gameStatus !== 'countdown') {
      setSpeed(0)
    }
  }, [gameStatus])
  
  const [hasJoined, setHasJoined] = useState(false)
  const [playerColor, setPlayerColor] = useState(DEFAULT_PLAYER_COLOR)
  const [countdown, setCountdown] = useState(3)
  const [showroomLoading, setShowroomLoading] = useState(true)

  useEffect(() => {
    setTrackName(resolvedLocalTrackName)
  }, [resolvedLocalTrackName])

  useEffect(() => {
    if (selectedColor) {
      setPlayerColor(selectedColor)
    }
  }, [selectedColor])

  const [spawnPosition, setSpawnPosition] = useState<{ x: number; y: number; z: number } | null>(null)
  const [initialRotationY, setInitialRotationY] = useState<number | null>(null)
  const [activeScheduledRaceId, setActiveScheduledRaceId] = useState<string | null>(null)
  const [activeScheduledRaceSnapshot, setActiveScheduledRaceSnapshot] = useState<ScheduledRaceRoomSnapshot | null>(null)
  const [activeScheduledRaceEntry, setActiveScheduledRaceEntry] = useState<ActiveScheduledRaceEntry | null>(null)
  const [scheduledRaceLapProgressByEntrant, setScheduledRaceLapProgressByEntrant] = useState<Record<string, number[]>>({})
  const [scheduledRaceFinishOrderByEntrant, setScheduledRaceFinishOrderByEntrant] = useState<Record<string, number>>({})
  const [scheduledRaceStartBlocked, setScheduledRaceStartBlocked] = useState(false)
  const activeScheduledRaceIdRef = useRef<string | null>(null)
  const activeScheduledRaceEntryRef = useRef<ActiveScheduledRaceEntry | null>(null)
  const scheduledRaceReconnectStateRef = useRef<ScheduledRaceReconnectState | null>(null)
  const gameStatusRef = useRef(gameStatus)

  useEffect(() => {
    if (gameStatus === 'idle' || gameStatus === 'showroom') {
      setTrackName(resolvedLocalTrackName)
    }
  }, [gameStatus, resolvedLocalTrackName])
  
  // Initialize car position from spawn position
  useEffect(() => {
    if (spawnPosition) {
      setCarPosition(spawnPosition)
    }
  }, [spawnPosition])
  
  // Ensure car position is set when countdown starts (for minimap)
  // This ensures the blue dot appears as soon as the minimap shows
  useEffect(() => {
    if (gameStatus === 'countdown' && spawnPosition) {
      // Always set carPosition from spawnPosition when countdown starts
      // This ensures minimap shows blue dot immediately
      setCarPosition(spawnPosition)
    }
  }, [gameStatus, spawnPosition])
  
  // Also set car position when transitioning from showroom to loading
  // This ensures position is available before countdown starts
  useEffect(() => {
    if (gameStatus === 'loading' && spawnPosition && !carPosition) {
      setCarPosition(spawnPosition)
    }
  }, [gameStatus, spawnPosition, carPosition])
  
  // Socket connection state
  const socketRef = useRef<Socket | null>(null)
  const collisionSequenceRef = useRef(0)
  const [isConnected, setIsConnected] = useState(false)
  const [socketId, setSocketId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<{
    gameId: string
    players: Array<{
      id: string
      identityKey: string
      name: string
      score: number
      ordinalAddress?: string | null
      originOutpoint?: string | null
      carColor?: string
      trackName?: string // Track name for this player
    }>
    items?: GameItem[]
  } | null>(null)
  const hasJoinedRef = useRef<boolean>(false)
  const gameStateRef = useRef(gameState)

  useCarTrackPlayerAppearanceSync({
    socketRef,
    hasJoined,
    identityKey,
    playerColor,
    trackName,
    setGameState
  })
  const trackNameRef = useRef(trackName)
  
  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])
  
  useEffect(() => {
    trackNameRef.current = trackName
  }, [trackName])

  useEffect(() => {
    activeScheduledRaceIdRef.current = activeScheduledRaceId
  }, [activeScheduledRaceId])

  useEffect(() => {
    activeScheduledRaceEntryRef.current = activeScheduledRaceEntry
  }, [activeScheduledRaceEntry])

  const recordScheduledRaceFinishOrder = useCallback((entrantId: string) => {
    setScheduledRaceFinishOrderByEntrant(prev => (
      prev[entrantId]
        ? prev
        : { ...prev, [entrantId]: Object.keys(prev).length + 1 }
    ))
  }, [])
  
  // Emit game status updates to server
  useEffect(() => {
    gameStatusRef.current = gameStatus
    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updateGameStatus', {
        gameStatus: gameStatus
      })
    }
  }, [gameStatus, hasJoined])
  
  // Callback to emit position updates to socket for multiplayer and update minimap
  const handlePositionUpdateForSocket = useCallback((position: THREE.Vector3, rotation: number, speed: number, headlightsEnabled?: boolean) => {
    // Update car position for minimap
    setCarPosition({ x: position.x, y: position.y, z: position.z })
    
    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updatePosition', {
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: 0, y: rotation, z: 0 }, // Only Y rotation for car
        speed: speed,
        headlightsEnabled: Boolean(headlightsEnabled)
      })
    }
  }, [])

  const handlePlayerCollision = useCallback((report: LocalPlayerCollisionReport) => {
    const socket = socketRef.current
    if (!socket || !hasJoinedRef.current || !socket.id) return

    collisionSequenceRef.current += 1
    socket.emit('reportPlayerCollision', buildReportPlayerCollisionPayload({
      localPlayerId: socket.id,
      report,
      trackName: trackNameRef.current || resolvedLocalTrackName,
      sequence: collisionSequenceRef.current
    }))
  }, [resolvedLocalTrackName])
  
  // Collectibles state
  const [items, setItems] = useState<GameItem[]>([])
  
  // Other players for multiplayer rendering
  const [otherPlayers, setOtherPlayers] = useState<Array<{
    id: string
    name: string
    position: [number, number, number]
    rotation: [number, number, number]
    color: string
    carColor: string
    isWalking: boolean
    originOutpoint?: string
    chatMessage?: string
    chatTimestamp?: number
    headlightsEnabled?: boolean
  }>>([])
  const otherPlayersRef = useRef(otherPlayers)
  const queueRemotePlayerPositionUpdate = useBatchedPlayerPositionUpdates(setOtherPlayers)
  
  // Update hasJoinedRef when hasJoined changes
  useEffect(() => {
    hasJoinedRef.current = hasJoined
  }, [hasJoined])

  useEffect(() => {
    otherPlayersRef.current = otherPlayers
  }, [otherPlayers])

  const audio = useMemo(() => {
    return createPreloadedAudio(jungle, { volume: 0.4 })
  }, [])
  
  // Race start beeps sound - plays once when countdown starts
  const raceStartBeepsAudio = useMemo(() => {
    return createPreloadedAudio(raceStartBeeps, { loop: false })
  }, [])
  
  // Ding sound for collectibles
  const dingAudio = useMemo(() => {
    return createPreloadedAudio(dingSound, { volume: 0.5 })
  }, [])

  const volcanoExplosionAudio = useMemo(() => {
    return createPreloadedAudio(explosionSound, { volume: 0.65, loop: false })
  }, [])
  
  const {
    showmuted,
    hidemuted,
    isSoundEnabled,
    soundRef,
    hasUserMutedRef,
    playJungle,
    muteJungle,
    pauseIdleAudioForGas,
    resumeIdleAudioAfterGas
  } = useLoopingIdleAudio(audio)
  const isSoundEnabledRef = useRef(isSoundEnabled)

  useEffect(() => {
    isSoundEnabledRef.current = isSoundEnabled
  }, [isSoundEnabled])

  useEffect(() => {
    if (isSoundEnabled) return

    volcanoExplosionAudio.pause()
    volcanoExplosionAudio.currentTime = 0
  }, [isSoundEnabled, volcanoExplosionAudio])
  
  const playDingSound = useCallback(() => {
    if (isSoundEnabled && dingAudio) {
      playAudioElement(dingAudio, { reset: true, errorMessage: 'Ding sound failed:' })
    }
  }, [isSoundEnabled, dingAudio])

  const playVolcanoExplosionSound = useCallback(() => {
    if (isSoundEnabledRef.current && !hasUserMutedRef.current) {
      playAudioElement(volcanoExplosionAudio, { reset: true, errorMessage: 'Volcano explosion sound failed:' })
    }
  }, [hasUserMutedRef, volcanoExplosionAudio])

  const {
    collectedItemsRef,
    submitCollectedItemTransaction,
    handleCollectItem
  } = useCollectibleItemActions({
    transactionServerUrl: TRANSACTION_SERVER_URL,
    collectibleImageUrls,
    socketRef,
    hasJoined,
    playDingSound,
    identityKey,
    ordinalAddress,
    foxOutpoint,
    foxOriginOutpoint,
    foxName,
    trackName,
    onLatestActivityChange,
    onCollectibleCollected
  })

  const handleLocalCollectItem = useCallback((itemId: string) => {
    const item = items.find(existingItem => existingItem.id === itemId)
    if (!item) {
      return
    }

    setItems(prev => removeCollectedItem(prev, itemId))
    handleCollectItem(itemId)
    scheduleCollectibleTransactionAfterPickup(() => {
      submitCollectedItemTransaction(itemId, item.type)
    })
  }, [handleCollectItem, items, submitCollectedItemTransaction])

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: '/pixelfoxracing',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    registerRacingSocketConnectionListeners({
      socket,
      serverUrl: SOCKET_URL,
      setIsConnected,
      setSocketId
    })

    registerScheduledRaceReconnectListener({
      socket,
      getActiveRaceId: () => activeScheduledRaceEntryRef.current?.raceId ?? null,
      getReconnectState: () => scheduledRaceReconnectStateRef.current,
      buildJoinGamePayload: state => buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        trackName: state.roomJoin.trackName,
        startFinishPosition: state.spawnPosition
      }),
      getGameStatus: () => gameStatusRef.current
    })

    registerCarTrackJoinSocketListeners<
      GameJoinedSocketPayload,
      PlayerJoinedSocketPayload & { totalPlayers: number },
      { playerId: string; totalPlayers: number }
    >({
      socket,
      trackLabel: '',
      onGameJoined: data => {
        const joinedGame = applyCarTrackGameJoined({
          payload: data,
          previousSpawnPosition: spawnPosition,
          previousGameState: gameStateRef.current,
          socketId: socket.id,
          identityKey,
          name: foxName,
          ordinalAddress,
          originOutpoint: foxOriginOutpoint,
          carColor: playerColor,
          trackName
        })

        setSpawnPosition(joinedGame.spawnPosition)
        setGameState(joinedGame.gameState)
        setHasJoined(true)
        hasJoinedRef.current = true

        // Emit current game status now that we've joined
        // This is needed for startRaceImmediately where gameStatus is 'loading' before join completes
        if (gameStatus !== 'idle' && gameStatus !== 'showroom') {
          socket.emit('updateGameStatus', { gameStatus })
        }
      },
      onPlayerJoined: data => {
        const joinedPlayer = applyJoinedCarTrackPlayer({
          gameStatePlayers: gameStateRef.current?.players || [],
          renderedPlayers: otherPlayersRef.current,
          player: data,
          socketId: socket.id,
          identityKey,
          defaultTrackName: resolvedLocalTrackName,
          includeInitialMovement: true,
          getFallbackColor: getPlayerColorByIndex
        })

        setGameState(prev => ({
          ...(prev || { gameId: 'pixelfoxracing', players: [] }),
          players: joinedPlayer.gameStatePlayers
        }))

        if (!joinedPlayer.isCurrentPlayer) {
          console.log(`🎨 playerJoined - Player ${data.name} (${data.playerId}) carColor:`, data.carColor)
          setOtherPlayers(joinedPlayer.renderedPlayers)
        }
      },
      onPlayerLeft: data => {
        const leftPlayer = applyLeftCarTrackPlayer({
          gameStatePlayers: gameStateRef.current?.players || [],
          renderedPlayers: otherPlayersRef.current,
          playerId: data.playerId
        })

        setGameState(prev => prev ? { ...prev, players: leftPlayer.gameStatePlayers } : prev)
        setOtherPlayers(leftPlayer.renderedPlayers)
      }
    })

    registerCarTrackGameStateSocketListener({
      socket,
      defaultTrackName: resolvedLocalTrackName,
      getSocketId: () => socket.id,
      getIdentityKey: () => identityKey,
      getCurrentTrackName: () => trackName,
      getPreviousCurrentPlayers: () => gameStateRef.current?.players,
      getPreviousRenderedPlayers: () => otherPlayersRef.current,
      getFallbackColor: getPlayerColorByIndex,
      setGameState,
      setItems,
      setOtherPlayers,
      setHasJoined,
      setHasJoinedRef: hasJoined => {
        hasJoinedRef.current = hasJoined
      },
      getHasJoined: () => hasJoinedRef.current
    })
    
    registerCarTrackLivePlayerSocketListeners({
      socket,
      defaultTrackName: resolvedLocalTrackName,
      getSocketId: () => socket.id,
      getCurrentTrackName: () => trackNameRef.current,
      getGameStatePlayers: () => gameStateRef.current?.players,
      queueRemotePlayerPositionUpdate,
      setGameState,
      setOtherPlayers,
      setLocalChatMessage
    })

    registerScheduledRaceSocketListeners({
      socket,
      getActiveRaceId: () => activeScheduledRaceIdRef.current,
      onCountdownState: (state, snapshot) => {
        if (state.gameStatus === 'racing' && (snapshot.entrants ?? []).length < 2) {
          setScheduledRaceStartBlocked(true)
          setCountdown(0)
          setGameStatus('countdown')
          return
        }
        setScheduledRaceStartBlocked(false)
        setCountdown(state.countdown)
        setGameStatus(state.gameStatus)
      },
      onFinalCountdownStart: playRaceStartBeeps,
      onRoomSnapshot: setActiveScheduledRaceSnapshot,
      onLapProgress: payload => {
        setScheduledRaceLapProgressByEntrant(prev => ({
          ...prev,
          [payload.entrantId]: payload.lapTimesMs,
        }))
        const lapsRequired = activeScheduledRaceEntryRef.current?.lapsRequired ?? 3
        if (payload.lapTimesMs.length >= lapsRequired) {
          recordScheduledRaceFinishOrder(payload.entrantId)
        }
      }
    })

    registerCollectibleSocketListeners({
      socket,
      socketId: socket.id,
      getCurrentSocketId: () => socketRef.current?.id,
      setItems,
      setGameState,
      submitItemTransaction: (itemType, itemId) => {
        submitCollectedItemTransaction(itemId, itemType)
      }
    })

    registerRacingTransactionSocketListeners({
      socket,
      fallbackTrackName: resolvedLocalTrackName,
      onLatestActivityChange
    })

    socket.on('error', (data: { message: string }) => {
      // Silent error handling
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  // Join the socket room only for an actual race entry. Showroom track browsing
  // should not advertise the fox as present on a track.
  useEffect(() => {
    const socket = socketRef.current
    if (shouldEmitJoinGame({
      gameStatus,
      hasFoxOriginOutpoint: !!foxOriginOutpoint,
      hasSocket: !!socket,
      hasJoined: hasJoinedRef.current
    })) {
      socket?.emit('joinGame', buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        startFinishPosition: {
          x: resolvedTrackDefinition.startFinishPosition.x,
          y: resolvedTrackDefinition.startFinishPosition.y,
          z: resolvedTrackDefinition.startFinishPosition.z
        },
        trackName
      }))
    }
  }, [gameStatus, foxOriginOutpoint, foxName, ordinalAddress, identityKey, playerColor, trackName])

  // Auto-enter showroom if we have a fox
  useEffect(() => {
    if (shouldAutoEnterRaceShowroom({
      hasFoxOriginOutpoint: !!foxOriginOutpoint,
      gameStatus
    })) {
      setGameStatus('showroom')
    }
  }, [foxOriginOutpoint, gameStatus])

  // Auto-play idle sound when countdown starts (if not already playing AND user hasn't muted it)
  // Since sound starts enabled by default, this will play automatically when countdown begins
  useEffect(() => {
    if (gameStatus === 'countdown' && !soundRef.current && audio && !hasUserMutedRef.current) {
      // Auto-play idle sound when countdown starts (only if user hasn't explicitly muted)
      console.log('🔊 Auto-playing idle sound when countdown starts')
      playJungle()
    }
  }, [gameStatus, audio, playJungle])

  const isVolcanoesTrack = trackName === 'Volcanoes' || resolvedTrackDefinition.trackId === 'volcanoes'

  useEffect(() => {
    if (isVolcanoesTrack && (gameStatus === 'countdown' || gameStatus === 'racing')) return

    volcanoExplosionAudio.pause()
    volcanoExplosionAudio.currentTime = 0
  }, [gameStatus, isVolcanoesTrack, volcanoExplosionAudio])

  useEffect(() => {
    if (gameStatus !== 'countdown' || !isVolcanoesTrack) return

    const timeoutId = window.setTimeout(() => {
      playVolcanoExplosionSound()
    }, VOLCANO_EXPLOSION_FIRST_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [gameStatus, isVolcanoesTrack, playVolcanoExplosionSound])

  useEffect(() => {
    if (gameStatus !== 'racing' || !isVolcanoesTrack) return

    const intervalId = window.setInterval(() => {
      playVolcanoExplosionSound()
    }, VOLCANO_EXPLOSION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [gameStatus, isVolcanoesTrack, playVolcanoExplosionSound])

  const handleGasPressed = pauseIdleAudioForGas
  const handleGasReleased = useCallback(() => {
    resumeIdleAudioAfterGas(gameStatus)
  }, [resumeIdleAudioAfterGas, gameStatus])

  const handleEnterShowroom = useCallback(async () => {
    const raceToWithdraw = activeScheduledRaceEntry
    if (raceToWithdraw && (gameStatus === 'loading' || gameStatus === 'countdown')) {
      await withdrawScheduledRaceSignup({
        transactionServerUrl: TRANSACTION_SERVER_URL,
        raceId: raceToWithdraw.raceId,
        entrantId: raceToWithdraw.entrantId
      }).catch(() => null)
    }
    socketRef.current?.emit('leaveScheduledRaceRoom')
    socketRef.current?.emit('leaveGame')
    setHasJoined(false)
    hasJoinedRef.current = false
    setActiveScheduledRaceId(null)
    activeScheduledRaceIdRef.current = null
    setActiveScheduledRaceSnapshot(null)
    setActiveScheduledRaceEntry(null)
    setScheduledRaceLapProgressByEntrant({})
    setScheduledRaceFinishOrderByEntrant({})
    setScheduledRaceStartBlocked(false)
    setGameStatus('showroom')
  }, [activeScheduledRaceEntry, gameStatus])

  const handleLapComplete = useCallback(async (lapTimeSeconds: number) => {
    if (activeScheduledRaceEntry && lapTimes.length >= Math.max(1, Math.floor(activeScheduledRaceEntry.lapsRequired))) {
      return
    }

    const scheduledProgress = buildScheduledRaceLapProgress({
      activeRace: activeScheduledRaceEntry,
      previousLapTimes: lapTimes,
      completedLapTimeSeconds: lapTimeSeconds,
    })
    if (scheduledProgress) {
      setLapSubmissionError(null)
      setLapTimes(scheduledProgress.lapTimes)
      setLapTime(0)
      const lapTimesMs = scheduledProgress.lapTimes.map(secondsToMilliseconds)
      setScheduledRaceLapProgressByEntrant(prev => ({
        ...prev,
        [activeScheduledRaceEntry.entrantId]: lapTimesMs,
      }))
      socketRef.current?.emit('reportScheduledRaceLapProgress', {
        raceId: activeScheduledRaceEntry.raceId,
        entrantId: activeScheduledRaceEntry.entrantId,
        lapTimesMs,
      })
      if (scheduledProgress.finished && scheduledProgress.finishReport) {
        recordScheduledRaceFinishOrder(activeScheduledRaceEntry.entrantId)
        void deliverScheduledRaceFinish({
          socket: socketRef.current,
          report: scheduledProgress.finishReport,
          transactionServerUrl: TRANSACTION_SERVER_URL,
        }).then(delivery => {
          if (delivery.delivered === 'http') {
            console.warn('Scheduled race finish recovered via transaction server:', delivery.socketError)
          }
        }).catch(error => {
          setLapSubmissionError(error instanceof Error ? error.message : 'Scheduled race finish submission failed')
        })
      }
      return
    }

    await runPixelRacingLapCompletionWorkflow({
      lapTimeSeconds,
      gameStatus,
      trackName,
      identity: {
        ownerAddress: ordinalAddress,
        outpoint: foxOutpoint,
        originOutpoint: foxOriginOutpoint,
        foxName
      },
      carColor: playerColor,
      distanceTraveled,
      transactionServerUrl: TRANSACTION_SERVER_URL,
      testingMode: TESTING_MODE,
      isSubmittingLap: () => isSubmittingLapRef.current,
      setSubmittingLap: isSubmitting => {
        isSubmittingLapRef.current = isSubmitting
        setIsSubmittingLap(isSubmitting)
      },
      setLapSubmissionError,
      appendLapTime: completedLapTime => {
        const lapIndex = lapTimes.length
        setLapTimes(prev => [...prev, completedLapTime])
        return lapIndex
      },
      setLapTxid: (lapIndex, txid) => {
        setLapTxids(prev => ({ ...prev, [lapIndex]: txid }))
      },
      setLapTime,
      onLatestActivityChange,
      emitSharedLapTransaction: payload => {
        socketRef.current?.emit('shareGameTransaction', payload)
      }
    })
  }, [activeScheduledRaceEntry, ordinalAddress, foxOutpoint, foxOriginOutpoint, foxName, onLatestActivityChange, gameStatus, trackName, playerColor, distanceTraveled, lapTimes, recordScheduledRaceFinishOrder])

  const handleStartRace = useCallback(() => {
    socketRef.current?.emit('leaveScheduledRaceRoom')
    setActiveScheduledRaceId(null)
    activeScheduledRaceIdRef.current = null
    setActiveScheduledRaceSnapshot(null)
    setActiveScheduledRaceEntry(null)
    setScheduledRaceLapProgressByEntrant({})
    setScheduledRaceFinishOrderByEntrant({})
    setScheduledRaceStartBlocked(false)
    setInitialRotationY(null)
    if (trackName === resolvedLocalTrackName && !hasJoinedRef.current) {
      socketRef.current?.emit('joinGame', buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        startFinishPosition: {
          x: resolvedTrackDefinition.startFinishPosition.x,
          y: resolvedTrackDefinition.startFinishPosition.y,
          z: resolvedTrackDefinition.startFinishPosition.z
        },
        trackName
      }))
    }
    startRaceForSelectedTrack({
      selectedTrackName: trackName,
      localTrackName: resolvedLocalTrackName,
      selectedColor: playerColor,
      onTrackChange,
      spawnPosition,
      carPosition,
      setCarPosition,
      setHasJoined,
      setGameStatus,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids,
      setCountdown
    })
  }, [foxName, foxOriginOutpoint, identityKey, ordinalAddress, playerColor, resolvedLocalTrackName, resolvedTrackDefinition.startFinishPosition, spawnPosition, carPosition, trackName, onTrackChange])

  const handleEnterScheduledRace = useCallback((race: ScheduledRace, signup: ScheduledRaceSignup) => {
    if (race.trackName !== resolvedLocalTrackName && onTrackChange) {
      onTrackChange(race.trackName, undefined, { race, signup })
      return
    }

    const gridLayout = getScheduledRaceGridLayout(race.trackName)
    const gridSlot = buildScheduledRaceGridSlots({
      startPosition: resolvedTrackDefinition.startFinishPosition,
      startDirection: resolvedTrackDefinition.startFinishDirection,
      slotCount: race.maxEntrants,
      yOffset: 0.1,
      getHeightAtPosition: resolvedTrackDefinition.terrainHeightSampler,
      ...gridLayout,
    }).find(slot => slot.slot === (signup.stagedGridSlot ?? signup.gridSlot))

    if (!gridSlot) return

    const nextSpawnPosition = {
      x: gridSlot.position.x,
      y: gridSlot.position.y,
      z: gridSlot.position.z,
    }

    setTrackName(race.trackName)
    setSpawnPosition(nextSpawnPosition)
    setCarPosition(nextSpawnPosition)
    setInitialRotationY(gridSlot.rotationY)
    setActiveScheduledRaceId(race.id)
    setActiveScheduledRaceEntry({
      raceId: race.id,
      entrantId: signup.entrantId,
      lapsRequired: race.lapsRequired,
    })
    setScheduledRaceLapProgressByEntrant({ [signup.entrantId]: [] })
    setScheduledRaceFinishOrderByEntrant({})
    setScheduledRaceStartBlocked(false)
    activeScheduledRaceIdRef.current = race.id
    if (!hasJoinedRef.current) {
      socketRef.current?.emit('joinGame', buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        trackName: race.trackName,
        startFinishPosition: nextSpawnPosition
      }))
    }
    socketRef.current?.emit('updatePosition', {
      position: nextSpawnPosition,
      rotation: { x: 0, y: gridSlot.rotationY, z: 0 },
      speed: 0,
      headlightsEnabled: true
    })
    const scheduledRoomJoinPayload = {
      raceId: race.id,
      trackName: race.trackName,
      entrantId: signup.entrantId,
      gridSlot: signup.stagedGridSlot ?? signup.gridSlot,
      startsAt: race.startsAt
    }
    scheduledRaceReconnectStateRef.current = {
      roomJoin: scheduledRoomJoinPayload,
      spawnPosition: nextSpawnPosition,
      rotationY: gridSlot.rotationY
    }
    socketRef.current?.emit('joinScheduledRaceRoom', scheduledRoomJoinPayload)

    applyScheduledRaceStartState({
      setGameStatus,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids,
      setCountdown
    })
  }, [foxName, foxOriginOutpoint, identityKey, onTrackChange, ordinalAddress, playerColor, resolvedLocalTrackName, resolvedTrackDefinition.startFinishDirection, resolvedTrackDefinition.startFinishPosition])

  useEffect(() => {
    if (!pendingScheduledRaceEntry || pendingScheduledRaceEntry.race.trackName !== resolvedLocalTrackName) return
    onPendingScheduledRaceEntryConsumed?.()
    handleEnterScheduledRace(pendingScheduledRaceEntry.race, pendingScheduledRaceEntry.signup)
  }, [handleEnterScheduledRace, onPendingScheduledRaceEntryConsumed, pendingScheduledRaceEntry, resolvedLocalTrackName])

  useEffect(() => {
    if (startRaceImmediately && gameStatus === 'showroom') {
      handleStartRace()
    }
  }, [startRaceImmediately, gameStatus, handleStartRace])

  const playRaceStartBeeps = useCallback(() => {
    if (!hasUserMutedRef.current) {
      playAudioElement(raceStartBeepsAudio, { errorMessage: 'Failed to play race start beeps:' })
    }
  }, [hasUserMutedRef, raceStartBeepsAudio])

  const {
    isWorldLoaded,
    isVehicleLoaded: isCarLoaded,
    handleWorldLoaded,
    handleVehicleLoaded: handleCarLoaded,
    handleSceneReady
  } = useRaceCountdownFlow({
    gameStatus,
    setGameStatus,
    setCountdown,
    playStartBeeps: playRaceStartBeeps,
    localCountdownEnabled: !activeScheduledRaceId
  })

  const handleCrash = useCallback(() => {
    setGameStatus('crashed')
  }, [])

  const handleRunScheduledRaceAsTimeTrial = useCallback(() => {
    socketRef.current?.emit('leaveScheduledRaceRoom')
    socketRef.current?.emit('leaveGame')
    setHasJoined(false)
    hasJoinedRef.current = false
    setActiveScheduledRaceId(null)
    activeScheduledRaceIdRef.current = null
    setActiveScheduledRaceSnapshot(null)
    setActiveScheduledRaceEntry(null)
    setScheduledRaceLapProgressByEntrant({})
    setScheduledRaceFinishOrderByEntrant({})
    setScheduledRaceStartBlocked(false)
    setInitialRotationY(null)
    const startPosition = {
      x: resolvedTrackDefinition.startFinishPosition.x,
      y: resolvedTrackDefinition.startFinishPosition.y,
      z: resolvedTrackDefinition.startFinishPosition.z
    }
    socketRef.current?.emit('joinGame', buildJoinGamePayload({
      identityKey,
      foxName,
      ordinalAddress,
      foxOriginOutpoint,
      playerColor,
      startFinishPosition: startPosition,
      trackName
    }))
    setSpawnPosition(startPosition)
    setCarPosition(startPosition)
    startRaceForSelectedTrack({
      selectedTrackName: trackName,
      localTrackName: resolvedLocalTrackName,
      selectedColor: playerColor,
      onTrackChange,
      spawnPosition: startPosition,
      carPosition: startPosition,
      setCarPosition,
      setHasJoined,
      setGameStatus,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids,
      setCountdown
    })
  }, [foxName, foxOriginOutpoint, identityKey, onTrackChange, ordinalAddress, playerColor, resolvedLocalTrackName, resolvedTrackDefinition.startFinishPosition, trackName])

  const resetRaceToShowroom = useRaceRestartHandler({
    setGameStatus,
    setHasJoined,
    setScore,
    setDistanceTraveled,
    setLapTime,
    setLapTimes,
    setLapTxids,
    collectedItemsRef,
    resetPosition: () => setCarPosition(null),
    setOtherPlayers,
    setLocalChatMessage
  })
  const handleRestart = useCallback(() => {
    socketRef.current?.emit('leaveScheduledRaceRoom')
    setActiveScheduledRaceId(null)
    activeScheduledRaceIdRef.current = null
    setActiveScheduledRaceSnapshot(null)
    setActiveScheduledRaceEntry(null)
    setScheduledRaceLapProgressByEntrant({})
    setScheduledRaceFinishOrderByEntrant({})
    setScheduledRaceStartBlocked(false)
    resetRaceToShowroom()
  }, [resetRaceToShowroom])
  
  const handleSendChat = useRacingChatSender({
    chatInput,
    setChatInput,
    setLocalChatMessage,
    socketRef,
    hasJoined
  })
  
  useCurrentPlayersPanelRender({
    gameStatus,
    onCurrentPlayersRender,
    players: gameState?.players,
    socketId,
    identityKey,
    selectedPlayerColor: playerColor,
    selectedTrackName: trackName,
    defaultTrackName: resolvedLocalTrackName,
    ordinalAddress,
    walletSaladCount,
    walletBlueberryCount,
    walletRabbitCount,
    blueberryIconUrl: blueberryUrl,
    saladIconUrl: saladUrl,
    rabbitIconUrl: rabbitUrl
  })

  useEffect(() => {
    if (FAKE_REMOTE_PLAYER_COUNT <= 0) return

    const startedAt = performance.now()
    const intervalId = window.setInterval(() => {
      setFakeRemoteElapsedSeconds((performance.now() - startedAt) / 1000)
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [])

  const fakeRemotePlayers = useMemo(() => generateFakeRemotePlayers({
    count: FAKE_REMOTE_PLAYER_COUNT,
    trackName,
    center: { x: resolvedTrackDefinition.startFinishPosition.x, z: resolvedTrackDefinition.startFinishPosition.z },
    elapsedSeconds: fakeRemoteElapsedSeconds,
    speedScale: FAKE_REMOTE_PLAYER_SPEED_SCALE,
    getFallbackColor: getPlayerColorByIndex
  }), [trackName, fakeRemoteElapsedSeconds, resolvedTrackDefinition.startFinishPosition])
  const scheduledRaceGridSlots = useMemo(() => buildScheduledRaceGridSlots({
    startPosition: resolvedTrackDefinition.startFinishPosition,
    startDirection: resolvedTrackDefinition.startFinishDirection,
    slotCount: 6,
    yOffset: 0.1,
    getHeightAtPosition: resolvedTrackDefinition.terrainHeightSampler,
    ...getScheduledRaceGridLayout(trackName),
  }), [resolvedTrackDefinition.startFinishDirection, resolvedTrackDefinition.startFinishPosition, resolvedTrackDefinition.terrainHeightSampler, trackName])
  const scheduledRoomPlayers = useMemo(() => buildScheduledRaceRoomPlayers({
    snapshot: activeScheduledRaceSnapshot,
    activeRaceId: activeScheduledRaceId,
    socketId,
    existingPlayers: otherPlayers,
    gridSlots: scheduledRaceGridSlots,
    getFallbackColor: getPlayerColorByIndex,
  }), [activeScheduledRaceId, activeScheduledRaceSnapshot, otherPlayers, scheduledRaceGridSlots, socketId])
  const scheduledRaceStandings = useMemo<RacingUiScheduledRaceStandings | null>(() => (
    activeScheduledRaceId
      ? {
          snapshot: activeScheduledRaceSnapshot,
          activeRaceId: activeScheduledRaceId,
          localEntrantId: activeScheduledRaceEntry?.entrantId,
          lapProgressByEntrant: scheduledRaceLapProgressByEntrant,
          finishOrderByEntrant: scheduledRaceFinishOrderByEntrant,
          lapsRequired: activeScheduledRaceEntry?.lapsRequired,
        }
      : null
  ), [
    activeScheduledRaceEntry?.entrantId,
    activeScheduledRaceEntry?.lapsRequired,
    activeScheduledRaceId,
    activeScheduledRaceSnapshot,
    scheduledRaceFinishOrderByEntrant,
    scheduledRaceLapProgressByEntrant,
  ])
  // Whole-second lap clock keeps the marquee model identity stable between ticks
  const marqueeLapClockSeconds = Math.floor(lapTime)
  const startGateMarqueeModel = useMemo(() => {
    if (activeScheduledRaceId) {
      return buildStartGateMarqueeModel({
        mode: 'multiplayer',
        gameStatus,
        countdown,
        lapsRequired: Math.max(1, Math.floor(activeScheduledRaceEntry?.lapsRequired ?? 3)),
        entrants: (activeScheduledRaceSnapshot?.entrants ?? []).map(entrant => ({
          entrantId: entrant.entrantId,
          name: entrant.name,
          gridSlot: entrant.gridSlot,
          lapTimesMs: scheduledRaceLapProgressByEntrant[entrant.entrantId] ?? [],
          finishOrder: scheduledRaceFinishOrderByEntrant[entrant.entrantId],
          disconnected: entrant.gameStatus === 'disconnected'
        }))
      })
    }
    return buildStartGateMarqueeModel({
      mode: 'solo',
      gameStatus,
      countdown,
      lapTimesSeconds: lapTimes,
      currentLapTimeSeconds: marqueeLapClockSeconds,
      playersOnTrack: otherPlayers.length + 1,
      trackName
    })
  }, [
    activeScheduledRaceEntry?.lapsRequired,
    activeScheduledRaceId,
    activeScheduledRaceSnapshot,
    countdown,
    gameStatus,
    lapTimes,
    marqueeLapClockSeconds,
    otherPlayers.length,
    scheduledRaceFinishOrderByEntrant,
    scheduledRaceLapProgressByEntrant,
    trackName
  ])
  const remotePlayersForLod = useMemo(() => (
    activeScheduledRaceId
      ? scheduledRoomPlayers
      : [...otherPlayers, ...fakeRemotePlayers]
  ), [activeScheduledRaceId, scheduledRoomPlayers, otherPlayers, fakeRemotePlayers])
  const getRemotePlayerContentUrl = useCallback((outpoint?: string | null) => getOrdinalContentUrl(outpoint) || undefined, [])
  const getRemotePlayerFallbackOutpoint = useCallback((player: typeof remotePlayersForLod[number]) => (
    qualityPresetId === 'high' && player.id.startsWith('fake-')
      ? foxOriginOutpoint
      : undefined
  ), [foxOriginOutpoint, qualityPresetId])
  const visibleRemotePlayers = useRemotePlayerLodRendering({
    players: remotePlayersForLod,
    localPosition: carPosition,
    qualityPreset: getRacingQualityPreset(qualityPresetId),
    getContentUrl: getRemotePlayerContentUrl,
    getFallbackOutpoint: getRemotePlayerFallbackOutpoint
  })

  return (
    <>
      <div ref={containerRef} style={getCarRacingGameViewportStyle(gameStatus)}>
        {/* Loading Screen */}
        {gameStatus === 'loading' && (
          <RacingLoadingOverlay />
        )}

        {/* 3D World */}
        <FoxRacingWorld
          otherPlayers={visibleRemotePlayers}
          gameStatus={gameStatus}
          onCrash={handleCrash}
          onScoreUpdate={setScore}
          onDistanceUpdate={setDistanceTraveled}
          onTrackLengthUpdate={setTrackLength}
          onLapComplete={handleLapComplete}
          onLapTimeUpdate={handleLapTimeUpdate}
          onSpeedUpdate={handleSpeedUpdate}
          foxOriginOutpoint={foxOriginOutpoint}
          backgroundRemovalStrategy={backgroundRemovalStrategy}
          playerColor={playerColor}
          countdown={countdown}
          onSceneReady={handleSceneReady}
          onGasPressed={handleGasPressed}
          spawnPosition={spawnPosition}
          initialRotationY={initialRotationY}
          onGasReleased={handleGasReleased}
          isSoundEnabled={isSoundEnabled}
          onWorldLoaded={handleWorldLoaded}
          onCarLoaded={handleCarLoaded}
          items={items}
          onCollectItem={handleLocalCollectItem}
          onPositionUpdateForSocket={handlePositionUpdateForSocket}
          onPlayerCollision={handlePlayerCollision}
          localChatMessage={localChatMessage}
          cameraMode={cameraMode}
          onShowroomLoaded={() => setShowroomLoading(false)}
          showroomLoading={showroomLoading}
          qualityPresetId={qualityPresetId}
          trackDefinition={resolvedTrackDefinition}
          sceneryMode={resolvedSceneryMode}
          startGateMarqueeModel={startGateMarqueeModel}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* Minimap - Show during racing and countdown (bottom right) */}
        {(gameStatus === 'racing' || gameStatus === 'countdown') && (
          <Minimap
            carPosition={carPosition}
            trackCurve={resolvedTrackDefinition.trackCurve}
            startFinishPosition={resolvedTrackDefinition.startFinishPosition}
            trackLocation={resolvedTrackLocationLabel ?? (resolvedLocalTrackName === 'Australia' ? trackLocation : resolvedLocalTrackName)}
            position="bottom-right"
            updateEveryFrames={getRacingMinimapQualitySettings(getRacingQualityPreset(qualityPresetId)).updateEveryFrames}
          />
        )}
        
        {/* Showroom minimap removed - now using TrackPreviewMinimap in RacingUI */}

        {/* Sound Toggle - Rendered directly here like NewGame.tsx */}
        {(gameStatus === 'racing' || gameStatus === 'countdown' || gameStatus === 'crashed') && (
          <RacingSoundToggle
            showMuted={showmuted}
            showUnmuted={hidemuted}
            onUnmute={playJungle}
            onMute={muteJungle}
          />
        )}

        {/* Chat Input Bar */}
        {hasJoined && (gameStatus === 'racing' || gameStatus === 'countdown') && (
          <RacingChatInputBar
            value={chatInput}
            onChange={setChatInput}
            onSend={handleSendChat}
          />
        )}

        {/* UI Overlay */}
        <RacingUI 
          gameStatus={gameStatus}
          score={score}
          distanceTraveled={distanceTraveled}
          lapTime={lapTime}
          lapTimes={lapTimes}
          lapTxids={lapTxids}
          speed={speed}
          countdown={countdown}
          hasJoined={hasJoined}
          onJoin={handleStartRace}
          onEnterShowroom={handleEnterShowroom}
          onRestart={handleRestart}
          foxName={foxName}
          foxOutpoint={foxOutpoint}
          foxOriginOutpoint={foxOriginOutpoint}
          identityKey={identityKey}
          playerColor={playerColor}
          onColorChange={setPlayerColor}
          ordinalAddress={ordinalAddress}
          onConnectWallet={onConnectWallet}
          trackName={trackName}
          onTrackChange={(newTrackName) => {
            setTrackName(newTrackName)
            if (newTrackName !== resolvedLocalTrackName) {
              onTrackChange?.(newTrackName)
            }
          }}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          showroomLoading={showroomLoading}
          qualityPresetId={qualityPresetId}
          transactionServerUrl={TRANSACTION_SERVER_URL}
          onEnterScheduledRace={handleEnterScheduledRace}
          scheduledRaceStandings={scheduledRaceStandings}
          scheduledRaceStartBlocked={scheduledRaceStartBlocked}
          onQualityPresetChange={setQualityPresetId}
          devRemotePlayerLoad={FAKE_REMOTE_PLAYER_COUNT > 0 ? {
            configuredCount: FAKE_REMOTE_PLAYER_COUNT,
            visibleCount: visibleRemotePlayers.filter(player => player.id.startsWith('fake-')).length,
            speedScale: FAKE_REMOTE_PLAYER_SPEED_SCALE
          } : undefined}
          showroomVehicleModes={['car', 'snowmobile']}
          importedCarTracks={importedCarTracks}
        />
      </div>
    </>
  )
}
