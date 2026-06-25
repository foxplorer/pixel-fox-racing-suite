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
import {
  shouldAutoEnterRaceShowroom,
  startImmediateRaceIfNeeded,
  startRaceForSelectedTrack
} from '../../racing/simulation/raceLifecycle'
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
import { Minimap } from '../foxracing/Minimap'
import { trackCurve, startFinishPosition, trackLocation } from './TrackData'
import { DEFAULT_PLAYER_COLOR, getPlayerColorByIndex } from '../../racing/core/playerColors'
import type { RacingCollectibleType as CollectibleType, RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import {
  registerCollectibleSocketListeners,
  removeCollectedItem,
  scheduleCollectibleTransactionAfterPickup
} from '../../racing/collectibles/collectibleSocketEvents'
import { useBatchedPlayerPositionUpdates } from '../../racing/multiplayer/useBatchedPlayerPositionUpdates'
import { registerCarTrackLivePlayerSocketListeners } from '../../racing/multiplayer/carTrackPlayerSocketListeners'
import { useRemotePlayerLodRendering } from '../../racing/multiplayer/useRemotePlayerLodRendering'
import { getRacingMinimapQualitySettings, getRacingQualityPreset } from '../../racing/performance/qualitySettings'
import { useRacingQualitySetting } from '../../racing/performance/useRacingQualitySetting'
import { useFullscreenToggle } from '../../racing/components/useFullscreenToggle'

const collectibleImageUrls = {
  blueberry: blueberryUrl,
  salad: saladUrl,
  rabbit: rabbitUrl
}

// Socket server URL
const SOCKET_URL = import.meta.env.VITE_PIXELRACING_SOCKET_URL || 'http://localhost:5000'

// Transaction server URL
const TRANSACTION_SERVER_URL = import.meta.env.VITE_PIXELRACING_TRANSACTION_URL || 'http://localhost:9000'

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
  startRaceImmediately = false,
  selectedColor
}) => {
  const { containerRef, isFullscreen, toggleFullscreen } = useFullscreenToggle<HTMLDivElement>()
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [score, setScore] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  const [trackLength, setTrackLength] = useState(0)
  const [lapTime, setLapTime] = useState(0) // Current lap time in seconds
  const [lapTimes, setLapTimes] = useState<number[]>([]) // Array of completed lap times
  const [lapTxids, setLapTxids] = useState<{ [index: number]: string }>({}) // Map of lap index to txid
  const [speed, setSpeed] = useState(0) // Current speed in m/s
  const [trackName, setTrackName] = useState<string>('San Luis') // Track selection - default to San Luis
  const [cameraMode, setCameraMode] = useState<'simple' | 'smooth' | 'damped' | 'targetsmooth' | 'velocity'>('smooth') // Camera mode - default to 'smooth'
  const [qualityPresetId, setQualityPresetId] = useRacingQualitySetting()
  
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

  // Reset lap time when not racing (except during countdown)
  useEffect(() => {
    if (gameStatus !== 'racing' && gameStatus !== 'countdown') {
      setLapTime(0)
    }
  }, [gameStatus])

  // Handle speed updates from FreeRoamCar (speed in m/s)
  const handleSpeedUpdate = useCallback((currentSpeed: number) => {
    setSpeed(currentSpeed)
  }, [])
  
  // Reset speed when not racing
  useEffect(() => {
    if (gameStatus !== 'racing' && gameStatus !== 'countdown') {
      setSpeed(0)
    }
  }, [gameStatus])
  
  const [hasJoined, setHasJoined] = useState(false)
  const [playerColor, setPlayerColor] = useState(selectedColor || DEFAULT_PLAYER_COLOR)
  const [countdown, setCountdown] = useState(3)
  
  const [spawnPosition, setSpawnPosition] = useState<{ x: number; y: number; z: number } | null>(null)
  
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
  const trackNameRef = useRef<string>('San Luis')

  useCarTrackPlayerAppearanceSync({
    socketRef,
    hasJoined,
    identityKey,
    playerColor,
    trackName,
    setGameState
  })
  
  // Update refs when values change
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])
  
  // Refs for closure stability in socket handlers
  const identityKeyRef = useRef<string | null>(null)
  const playerColorRef = useRef<string>('#FF6B6B')
  const foxNameRef = useRef<string | null>(null)
  const foxOriginOutpointRef = useRef<string | null>(null)
  const ordinalAddressRef = useRef<string | null>(null)
  const gameStatusRef = useRef<GameStatus>('idle')
  
  // Update refs when values change
  useEffect(() => {
    identityKeyRef.current = identityKey
  }, [identityKey])
  
  useEffect(() => {
    playerColorRef.current = playerColor
  }, [playerColor])
  
  useEffect(() => {
    trackNameRef.current = trackName
  }, [trackName])
  
  useEffect(() => {
    foxNameRef.current = foxName
  }, [foxName])
  
  useEffect(() => {
    foxOriginOutpointRef.current = foxOriginOutpoint
  }, [foxOriginOutpoint])
  
  useEffect(() => {
    ordinalAddressRef.current = ordinalAddress
  }, [ordinalAddress])
  
  useEffect(() => {
    gameStatusRef.current = gameStatus
  }, [gameStatus])
  
  // Emit game status updates to server
  useEffect(() => {
    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updateGameStatus', {
        gameStatus: gameStatus
      })
    }
  }, [gameStatus, hasJoined])
  
  // Callback to emit position updates to socket for multiplayer
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

  // Update carPosition from spawnPosition when it changes (for minimap)
  useEffect(() => {
    if (spawnPosition && !carPosition) {
      setCarPosition(spawnPosition)
    }
  }, [spawnPosition, carPosition])

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
  // Game starts immediately, socket connects in background with retries
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: '/pixelfoxracing',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity, // Keep trying to reconnect indefinitely
      timeout: 20000,
      forceNew: false
    })

    const emitSanLuisActiveRaceJoin = (reason: 'connection' | 'reconnection') => {
      if (foxOriginOutpointRef.current && (gameStatusRef.current === 'loading' || gameStatusRef.current === 'countdown' || gameStatusRef.current === 'racing') && !hasJoinedRef.current) {
        const playerName = foxNameRef.current || 'Fox'
        console.log(`🎮 Auto-joining San Luis game after ${reason}:`, { playerName, identityKey: identityKeyRef.current, ordinalAddress: ordinalAddressRef.current, trackName: trackNameRef.current })
        socket.emit('joinGame', buildJoinGamePayload({
          identityKey: identityKeyRef.current,
          foxName: foxNameRef.current,
          ordinalAddress: ordinalAddressRef.current,
          foxOriginOutpoint: foxOriginOutpointRef.current,
          playerColor: playerColorRef.current,
          trackName: trackNameRef.current
        }))
      }
    }

    registerRacingSocketConnectionListeners({
      socket,
      serverUrl: SOCKET_URL,
      setIsConnected,
      setSocketId,
      onConnect: () => emitSanLuisActiveRaceJoin('connection'),
      onDisconnect: () => {
        // Socket.io will automatically attempt to reconnect
        console.log('🔄 Socket will automatically attempt to reconnect...')
      },
      onConnectError: () => {
        // Socket.io will automatically retry connection
        console.log('🔄 Socket will automatically retry connection...')
      }
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`)
      setIsConnected(true)
      emitSanLuisActiveRaceJoin('reconnection')
    })

    registerCarTrackJoinSocketListeners<
      GameJoinedSocketPayload,
      PlayerJoinedSocketPayload & { totalPlayers: number },
      { playerId: string; totalPlayers: number }
    >({
      socket,
      trackLabel: 'San Luis',
      logPlayerJoined: data => console.log('👋 Player joined Pixel Racing:', data, 'Current socket.id:', socket.id),
      onGameJoined: data => {
        const currentIdentityKey = identityKey
        const currentOrdinalAddress = ordinalAddress
        const currentOriginOutpoint = foxOriginOutpoint
        const currentCarColor = playerColor
        const currentSocketId = socket.id

        const joinedGame = applyCarTrackGameJoined({
          payload: data,
          previousSpawnPosition: spawnPosition,
          previousGameState: gameStateRef.current,
          socketId: currentSocketId,
          identityKey: currentIdentityKey,
          name: foxName,
          ordinalAddress: currentOrdinalAddress,
          originOutpoint: currentOriginOutpoint,
          carColor: currentCarColor,
          trackName,
          mergeExistingPlayer: false
        })

        setSpawnPosition(joinedGame.spawnPosition)
        setCarPosition(joinedGame.spawnPosition) // Set carPosition for minimap
        setGameState(joinedGame.gameState)
        setHasJoined(true)
        hasJoinedRef.current = true

        // Emit current game status now that we've joined.
        // This keeps San Luis aligned with Australia/Belgium for startRaceImmediately.
        if (gameStatus !== 'idle' && gameStatus !== 'showroom') {
          socket.emit('updateGameStatus', { gameStatus })
        }
      },
      onPlayerJoined: data => {
        const currentSocketId = socket.id
        const currentIdentityKey = identityKeyRef.current
        const currentOrdinalAddress = ordinalAddressRef.current

        const joinedPlayer = applyJoinedCarTrackPlayer({
          gameStatePlayers: gameStateRef.current?.players || [],
          renderedPlayers: otherPlayersRef.current,
          player: data,
          socketId: currentSocketId,
          identityKey: currentIdentityKey,
          ordinalAddress: currentOrdinalAddress,
          defaultTrackName: 'San Luis',
          includeCarColor: true,
          getFallbackColor: getPlayerColorByIndex,
          socketIdOnlyWhenAvailable: true,
          appendRenderedPlayer: 'manual'
        })

        console.log(`🔍 playerJoined check: data.playerId=${data.playerId}, currentSocketId=${currentSocketId}, identityKey=${currentIdentityKey}, ordinalAddress=${currentOrdinalAddress}, isCurrentPlayer=${joinedPlayer.isCurrentPlayer}`)

        setGameState(prev => ({
          ...(prev || { gameId: 'pixelfoxracing', players: [] }),
          players: joinedPlayer.gameStatePlayers
        }))

        if (!joinedPlayer.isCurrentPlayer) {
          console.log(`✅ playerJoined - Adding OTHER player: ${data.name} (${data.playerId}) carColor:`, data.carColor)
          setOtherPlayers(joinedPlayer.renderedPlayers)
        } else {
          console.log(`ℹ️ playerJoined - Ignoring current player: ${data.name} (${data.playerId})`)
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
      defaultTrackName: 'San Luis',
      getSocketId: () => socket.id,
      getIdentityKey: () => identityKeyRef.current,
      getOrdinalAddress: () => ordinalAddressRef.current,
      getCurrentTrackName: () => trackNameRef.current,
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
      getHasJoined: () => hasJoinedRef.current,
      defaultPosition: [0, 0.1, 0],
      isCurrentPlayer: (player, { socketId, identityKey, ordinalAddress }) => {
        if (socketId) {
          return player.id === socketId
        }

        if (identityKey) {
          return player.identityKey === identityKey
        }

        return !!ordinalAddress && player.ordinalAddress === ordinalAddress
      },
      logBeforeSnapshot: ({ state, socketId, identityKey, ordinalAddress }) => {
        console.log(`🔍 gameState - Filtering otherPlayers: socketId=${socketId}, identityKey=${identityKey}, ordinalAddress=${ordinalAddress}, totalPlayers=${state.players.length}`)
        console.log(`🔍 gameState - Player IDs in state:`, state.players.map(p => ({ id: p.id, name: p.name })))
      },
      logAfterSnapshot: ({ previousRenderedPlayers, renderedPlayers }) => {
        console.log(`🔍 gameState - Existing otherPlayers:`, previousRenderedPlayers.map(p => ({ id: p.id, name: p.name })))
        console.log(`👥 Updated otherPlayers from gameState: ${renderedPlayers.length} players`, renderedPlayers.map(p => p.name))
      }
    })
    
    registerCarTrackLivePlayerSocketListeners({
      socket,
      defaultTrackName: 'San Luis',
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
      fallbackTrackName: 'San Luis',
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

  // Join game when entering showroom with a fox, or when starting race immediately
  // Socket connection happens in background - join when connected
  useEffect(() => {
    const socket = socketRef.current
    if (shouldEmitJoinGame({
      gameStatus,
      hasFoxOriginOutpoint: !!foxOriginOutpoint,
      hasSocket: !!socket,
      hasJoined: hasJoinedRef.current,
      isConnected,
      requireConnection: true,
      startRaceImmediately,
      allowActiveRaceJoin: true
    })) {
      const playerName = foxName || 'Fox'
      console.log('🎮 Joining San Luis game with:', { playerName, identityKey, ordinalAddress, trackName })
      socket?.emit('joinGame', buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        trackName
      }))
    }
  }, [gameStatus, foxOriginOutpoint, foxName, ordinalAddress, identityKey, startRaceImmediately, playerColor, isConnected, trackName])

  // Auto-enter showroom if we have a fox (unless starting race immediately)
  useEffect(() => {
    if (shouldAutoEnterRaceShowroom({
      hasFoxOriginOutpoint: !!foxOriginOutpoint,
      gameStatus,
      startRaceImmediately
    })) {
      setGameStatus('showroom')
    }
  }, [foxOriginOutpoint, gameStatus, startRaceImmediately])

  // Start race immediately if prop is set (only once when component mounts with this flag)
  // Game starts immediately - socket connection happens in background
  const hasStartedRaceRef = useRef(false)
  useEffect(() => {
    startImmediateRaceIfNeeded({
      startRaceImmediately,
      hasFoxOriginOutpoint: !!foxOriginOutpoint,
      gameStatus,
      hasStartedRace: hasStartedRaceRef.current,
      spawnPosition,
      carPosition,
      fallbackPosition: { x: 0, y: 0.1, z: 0 },
      setCarPosition,
      setHasStartedRace: value => {
        hasStartedRaceRef.current = value
      },
      setGameStatus,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids,
      setCountdown
    })
  }, [startRaceImmediately, foxOriginOutpoint, gameStatus, spawnPosition, carPosition])

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
      localTrackName: 'San Luis',
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
  }, [spawnPosition, carPosition, trackName, onTrackChange, playerColor])

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
    defaultTrackName: 'San Luis',
    ordinalAddress,
    walletSaladCount,
    walletBlueberryCount,
    walletRabbitCount,
    blueberryIconUrl: blueberryUrl,
    saladIconUrl: saladUrl,
    rabbitIconUrl: rabbitUrl
  })

  const getRemotePlayerContentUrl = useCallback((outpoint?: string | null) => getOrdinalContentUrl(outpoint) || undefined, [])
  const visibleRemotePlayers = useRemotePlayerLodRendering({
    players: otherPlayers,
    localPosition: carPosition,
    qualityPreset: getRacingQualityPreset(qualityPresetId),
    getContentUrl: getRemotePlayerContentUrl
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
          onGasReleased={handleGasReleased}
          isSoundEnabled={isSoundEnabled}
          onWorldLoaded={handleWorldLoaded}
          onCarLoaded={handleCarLoaded}
          items={items}
          onCollectItem={handleLocalCollectItem}
          onPositionUpdateForSocket={handlePositionUpdateForSocket}
          localChatMessage={localChatMessage}
          cameraMode={cameraMode}
          qualityPresetId={qualityPresetId}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* Minimap - Show during racing and countdown (bottom right) */}
        {(gameStatus === 'racing' || gameStatus === 'countdown') && (
          <Minimap 
            carPosition={carPosition} 
            trackCurve={trackCurve}
            startFinishPosition={startFinishPosition}
            trackLocation={trackLocation} 
            position="bottom-right" 
            updateEveryFrames={getRacingMinimapQualitySettings(getRacingQualityPreset(qualityPresetId)).updateEveryFrames}
          />
        )}

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
            if (newTrackName !== 'San Luis') {
              onTrackChange?.(newTrackName)
            }
          }}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          showroomLoading={false}
          qualityPresetId={qualityPresetId}
          onQualityPresetChange={setQualityPresetId}
          showroomVehicleModes={['car', 'snowmobile']}
        />
      </div>
    </>
  )
}
