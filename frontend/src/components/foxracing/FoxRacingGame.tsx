import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import * as THREE from 'three'
import { FoxRacingWorld } from './FoxRacingWorld'
import { RacingUI } from '../racing/RacingUI'
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
import { shouldAutoEnterRaceShowroom, startRaceForSelectedTrack } from '../../racing/simulation/raceLifecycle'
import './FoxRacingComponent.css'
import { PixelRacingGameResult } from './types'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import jungle from '../../assets/engine-idle.mp3'
import raceStartBeeps from '../../assets/race-start-beeps.mp3'
import dingSound from '../../assets/ding.mp3'
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
  generateFakeRemotePlayers,
  parseFakeRemotePlayerCount,
  parseFakeRemotePlayerSpeedScale
} from '../../racing/multiplayer/fakeRemotePlayers'
import { useRemotePlayerLodRendering } from '../../racing/multiplayer/useRemotePlayerLodRendering'
import { getRacingMinimapQualitySettings, getRacingQualityPreset } from '../../racing/performance/qualitySettings'
import { useRacingQualitySetting } from '../../racing/performance/useRacingQualitySetting'

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
  onTrackChange?: (trackName: string, selectedColor?: string) => void
  trackDefinition?: CarTrackDefinition
  localTrackName?: string
  trackLocationLabel?: string
  sceneryMode?: 'australia' | 'imported-basic'
  importedCarTracks?: CarTrackDefinition[]
  trackDefinitionId?: ImportedCarTrackId
  startRaceImmediately?: boolean
  selectedColor?: string
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
  selectedColor
}) => {
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
  
  // Emit game status updates to server
  useEffect(() => {
    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updateGameStatus', {
        gameStatus: gameStatus
      })
    }
  }, [gameStatus, hasJoined])
  
  // Callback to emit position updates to socket for multiplayer and update minimap
  const handlePositionUpdateForSocket = useCallback((position: THREE.Vector3, rotation: number, speed: number) => {
    // Update car position for minimap
    setCarPosition({ x: position.x, y: position.y, z: position.z })
    
    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updatePosition', {
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: 0, y: rotation, z: 0 }, // Only Y rotation for car
        speed: speed
      })
    }
  }, [])
  
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
  
  const playDingSound = useCallback(() => {
    if (isSoundEnabled && dingAudio) {
      playAudioElement(dingAudio, { reset: true, errorMessage: 'Ding sound failed:' })
    }
  }, [isSoundEnabled, dingAudio])

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

  // Join game when entering showroom with a fox
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

  const handleGasPressed = pauseIdleAudioForGas
  const handleGasReleased = useCallback(() => {
    resumeIdleAudioAfterGas(gameStatus)
  }, [resumeIdleAudioAfterGas, gameStatus])

  const handleEnterShowroom = useCallback(() => {
    setGameStatus('showroom')
  }, [])

  const handleLapComplete = useCallback(async (lapTimeSeconds: number) => {
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
  }, [ordinalAddress, foxOutpoint, foxOriginOutpoint, foxName, onLatestActivityChange, gameStatus, trackName, playerColor, distanceTraveled, lapTimes.length])

  const handleStartRace = useCallback(() => {
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
  }, [spawnPosition, carPosition, trackName, onTrackChange, playerColor, resolvedLocalTrackName])

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
    playStartBeeps: playRaceStartBeeps
  })

  const handleCrash = useCallback(() => {
    setGameStatus('crashed')
  }, [])

  const handleRestart = useRaceRestartHandler({
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
  const remotePlayersForLod = useMemo(() => [...otherPlayers, ...fakeRemotePlayers], [otherPlayers, fakeRemotePlayers])
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
      <div style={getCarRacingGameViewportStyle(gameStatus)}>
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
          onGasReleased={handleGasReleased}
          isSoundEnabled={isSoundEnabled}
          onWorldLoaded={handleWorldLoaded}
          onCarLoaded={handleCarLoaded}
          items={items}
          onCollectItem={handleLocalCollectItem}
          onPositionUpdateForSocket={handlePositionUpdateForSocket}
          localChatMessage={localChatMessage}
          cameraMode={cameraMode}
          onShowroomLoaded={() => setShowroomLoading(false)}
          showroomLoading={showroomLoading}
          qualityPresetId={qualityPresetId}
          trackDefinition={resolvedTrackDefinition}
          sceneryMode={resolvedSceneryMode}
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
          foxOriginOutpoint={foxOriginOutpoint}
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
