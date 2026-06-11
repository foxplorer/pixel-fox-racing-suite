import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import * as THREE from 'three'
import { SnowmobileWorld, CameraMode } from '../snowmobilerace/SnowmobileWorld'
import { RacingUI } from '../racing/RacingUI'
import {
  buildPixelRacingGameResult,
  validateLapSubmissionCandidate
} from '../../racing/transactions/lapResult'
import {
  applyPixelRacingLapCompletionSubmission,
  submitPixelRacingLapCompletion
} from '../../racing/transactions/lapSubmission'
import { registerRacingTransactionSocketListeners } from '../../racing/transactions/socketActivity'
import { buildJoinGamePayload, shouldEmitJoinGame } from '../../racing/multiplayer/joinGamePayload'
import { buildGameJoinedCurrentPlayer, preserveExistingSpawnPosition, type GameJoinedSocketPayload } from '../../racing/multiplayer/gameJoined'
import { buildJoinedGameStatePlayer, type PlayerJoinedSocketPayload } from '../../racing/multiplayer/playerJoined'
import { registerRacingSocketConnectionListeners } from '../../racing/multiplayer/socketConnection'
import {
  findMultiplayerPlayerBySocketId,
  isCurrentMultiplayerPlayer,
  isSameMultiplayerTrack,
  patchCurrentMultiplayerPlayer,
  patchMultiplayerPlayerById,
  preserveCurrentMultiplayerPlayerTrackName,
  removeMultiplayerPlayerById,
  upsertCurrentMultiplayerPlayer
} from '../../racing/multiplayer/playerIdentity'
import {
  applyRaceLoadingStartState,
  applyRaceStartState
} from '../../racing/simulation/raceLifecycle'
import './FoxRacingComponent.css'
import { PixelRacingGameResult } from './types'
import type { VoxelBackgroundRemovalStrategy } from '../voxelization/voxelBackgroundStrategy'
import snowmobileIdleSound from '../../assets/snowmobile_idle.mp3'
import raceStartBeeps from '../../assets/race-start-beeps.mp3'
import dingSound from '../../assets/ding.mp3'
import blueberryUrl from '../../assets/blueberries.svg'
import rabbitUrl from '../../assets/rabbit-face.svg'
import saladUrl from '../../assets/salad.svg'
import { RacingLoadingOverlay } from '../../racing/components/RacingLoadingOverlay'
import { RacingChatInputBar } from '../../racing/components/RacingChatInputBar'
import { RacingSoundToggle } from '../../racing/components/RacingSoundToggle'
import { RacingPlayerInfoPanel } from '../../racing/components/RacingPlayerInfoPanel'
import { useFullscreenToggle } from '../../racing/components/useFullscreenToggle'
import { createPreloadedAudio, playAudioElement, useLoopingIdleAudio } from '../../racing/components/audioElements'
import { useRaceCountdownFlow } from '../../racing/components/useRaceCountdownFlow'
import { useCurrentPlayersPanelRender } from '../../racing/components/useCurrentPlayersPanelRender'
import { useRacingChatSender } from '../../racing/components/useRacingChatSender'
import { useCollectibleItemActions } from '../../racing/components/useCollectibleItemActions'
import { useRaceRestartHandler } from '../../racing/components/useRaceRestartHandler'
import { Minimap } from '../snowmobilerace/Minimap'
import { trackLocation, startFinishPosition } from '../snowmobilerace/TrackData'
import { PlayerState } from '../snowmobilerace/types'
import { preloadStadiumFoxes } from '../../racing/components/BillboardStadiumFoxes'
import { DEFAULT_PLAYER_COLOR, getPlayerColorByIndex } from '../../racing/core/playerColors'
import type { RacingCollectibleType as CollectibleType, RacingGameCollectibleItem as GameItem } from '../../racing/collectibles/collectibleTypes'
import { applyPlayerCollisionUpdate, type PlayerCollisionSocketPayload } from '../../racing/multiplayer/playerCollision'
import type { PlayerPositionSocketPayload } from '../../racing/multiplayer/playerPosition'
import { useBatchedPlayerPositionUpdates } from '../../racing/multiplayer/useBatchedPlayerPositionUpdates'
import {
  applyPlayerCarColorUpdate,
  applyPlayerTrackNameUpdate,
  type PlayerCarColorSocketPayload,
  type PlayerTrackNameSocketPayload
} from '../../racing/multiplayer/playerAppearance'
import {
  applyRemotePlayerChatMessage,
  getIncomingPlayerChatTarget,
  type PlayerChatSocketPayload
} from '../../racing/multiplayer/playerChat'
import { buildJoinedRacingWorldPlayer, buildRacingWorldPlayer } from '../../racing/multiplayer/worldPlayers'
import { filterRemotePlayersForQuality, getRacingMinimapQualitySettings, getRacingQualityPreset } from '../../racing/performance/qualitySettings'
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

interface FoxRacingGameProps {
  identityKey?: string | null
  onPlayerInfoChange?: (name: string, color: string) => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
  foxOutpoint?: string | null
  backgroundRemovalStrategy?: VoxelBackgroundRemovalStrategy
  ordinalAddress?: string | null
  bsvAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  onCurrentPlayersRender?: (jsx: React.ReactNode) => void
  walletSaladCount?: number
  walletBlueberryCount?: number
  walletRabbitCount?: number
  onCollectibleCollected?: (itemType: CollectibleType) => void
  onTrackChange?: (trackName: string, selectedColor?: string) => void
  onGameStatusChange?: (isRacing: boolean) => void
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
  bsvAddress,
  onConnectWallet,
  onLatestActivityChange,
  onCurrentPlayersRender,
  walletSaladCount = 0,
  walletBlueberryCount = 0,
  walletRabbitCount = 0,
  onCollectibleCollected,
  onTrackChange,
  onGameStatusChange,
  startRaceImmediately = false,
  selectedColor
}) => {
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
  const [trackName, setTrackName] = useState<string>('Aspen') // Aspen track
  const [cameraMode, setCameraMode] = useState<CameraMode>('smooth') // Camera mode - default to 'smooth'
  const [qualityPresetId, setQualityPresetId] = useRacingQualitySetting()

  const { containerRef, isFullscreen, toggleFullscreen } = useFullscreenToggle<HTMLDivElement>()

  // Snowmobile position for minimap and player filtering
  const [vehiclePosition, setVehiclePosition] = useState<{ x: number; y: number; z: number } | null>(null)
  // Throttled position for player filtering (only updates every 50 units moved)
  const [filterPosition, setFilterPosition] = useState<{ x: number; z: number } | null>(null)
  const lastFilterPositionRef = useRef<{ x: number; z: number } | null>(null)
  
  // Chat state
  const [localChatMessage, setLocalChatMessage] = useState<{text: string, timestamp: number} | null>(null)
  const [chatInput, setChatInput] = useState('')
  
  // Lap submission state
  const [isSubmittingLap, setIsSubmittingLap] = useState(false)
  const [lapSubmissionError, setLapSubmissionError] = useState<string | null>(null)
  const isSubmittingLapRef = useRef(false) // Ref to track submission state for closure safety
  const hasPlayedRaceStartBeepsRef = useRef(false)
  
  // Notify parent when game status changes (for hiding outer fox info panel)
  useEffect(() => {
    const isRacing = gameStatus === 'racing' || gameStatus === 'countdown'
    onGameStatusChange?.(isRacing)
  }, [gameStatus, onGameStatusChange])

  // Update filterPosition only when the snowmobile moves 50+ units (for throttled player filtering)
  useEffect(() => {
    if (!vehiclePosition) return

    const last = lastFilterPositionRef.current
    if (!last) {
      // First position
      lastFilterPositionRef.current = { x: vehiclePosition.x, z: vehiclePosition.z }
      setFilterPosition({ x: vehiclePosition.x, z: vehiclePosition.z })
      return
    }

    const dx = vehiclePosition.x - last.x
    const dz = vehiclePosition.z - last.z
    const distSq = dx * dx + dz * dz

    // Only update if moved 50+ units
    if (distSq > 50 * 50) {
      lastFilterPositionRef.current = { x: vehiclePosition.x, z: vehiclePosition.z }
      setFilterPosition({ x: vehiclePosition.x, z: vehiclePosition.z })
    }
  }, [vehiclePosition])

  // Log track length when it's calculated
  useEffect(() => {
    if (trackLength > 0) {
      console.log(`🏁 Track Length: ${trackLength.toFixed(2)} meters`)
    }
  }, [trackLength])

  // Handle lap time updates from SnowmobileWorld (synchronized with lap recording timer)
  // This ensures the visual timer matches exactly what gets recorded when lap completes
  const handleLapTimeUpdate = useCallback((currentLapTime: number) => {
    setLapTime(currentLapTime)
  }, [])
  
  // Handle speed updates from SnowmobileWorld (speed in m/s)
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
  const [playerColor, setPlayerColor] = useState(selectedColor || DEFAULT_PLAYER_COLOR)
  const [countdown, setCountdown] = useState(3)
  
  // Update carColor on server when playerColor changes (if already joined)
  useEffect(() => {
    if (socketRef.current && hasJoined && playerColor) {
      console.log(`🎨 Sending carColor update to server:`, playerColor)
      socketRef.current.emit('updateCarColor', { carColor: playerColor })
      
      // Also update current player's carColor in local gameState immediately
      setGameState(prev => {
        if (!prev) return prev
        
        return {
          ...prev,
          players: patchCurrentMultiplayerPlayer(prev.players, {
            socketId: socketRef.current?.id,
            identityKey
          }, { carColor: playerColor })
        }
      })
    }
  }, [playerColor, hasJoined, identityKey])

  // Update trackName on server when trackName changes (if already joined)
  useEffect(() => {
    if (socketRef.current && hasJoined && trackName) {
      console.log(`🏁 Sending trackName update to server:`, trackName)
      socketRef.current.emit('updateTrackName', { trackName: trackName })
      
      // Also update current player's trackName in local gameState immediately
      setGameState(prev => {
        if (!prev) return prev
        
        return {
          ...prev,
          players: patchCurrentMultiplayerPlayer(prev.players, {
            socketId: socketRef.current?.id,
            identityKey
          }, { trackName })
        }
      })
    }
  }, [trackName, hasJoined, identityKey])
  const [spawnPosition, setSpawnPosition] = useState<{ x: number; y: number; z: number } | null>(null)
  
  // Initialize vehicle position from spawn position
  useEffect(() => {
    if (spawnPosition) {
      setVehiclePosition(spawnPosition)
    }
  }, [spawnPosition])
  
  // Ensure vehicle position is set when countdown starts (for minimap)
  // This ensures the blue dot appears as soon as the minimap shows
  useEffect(() => {
    if (gameStatus === 'countdown' && spawnPosition) {
      // Always set vehiclePosition from spawnPosition when countdown starts
      // This ensures minimap shows blue dot immediately
      setVehiclePosition(spawnPosition)
    }
  }, [gameStatus, spawnPosition])
  
  // Also set vehicle position when transitioning from showroom to loading
  // This ensures position is available before countdown starts
  useEffect(() => {
    if (gameStatus === 'loading' && spawnPosition && !vehiclePosition) {
      setVehiclePosition(spawnPosition)
    }
  }, [gameStatus, spawnPosition, vehiclePosition])
  
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
  // SnowmobileWorld sends (pos: {x,y,z}, rot: {x,y,z}, speed)
  const handlePositionUpdate = useCallback((pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number }, speed: number) => {
    // Update vehicle position for minimap
    setVehiclePosition({ x: pos.x, y: pos.y, z: pos.z })

    if (socketRef.current && hasJoinedRef.current) {
      socketRef.current.emit('updatePosition', {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z }, // Full rotation for snowmobile
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
    speed: number
    originOutpoint?: string
    chatMessage?: string
    chatTimestamp?: number
  }>>([])
  const queueRemotePlayerPositionUpdate = useBatchedPlayerPositionUpdates(setOtherPlayers)
  
  // Update hasJoinedRef when hasJoined changes
  useEffect(() => {
    hasJoinedRef.current = hasJoined
  }, [hasJoined])

  const audio = useMemo(() => {
    return createPreloadedAudio(snowmobileIdleSound, { volume: 0.4 })
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
    submitItemTransactionRef,
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

    socket.on('gameJoined', (data: GameJoinedSocketPayload) => {
      console.log('✅ Joined Pixel Racing game:', data.gameId)
      // Only set spawnPosition once when first joining - don't update if already set
      setSpawnPosition(prev => {
        if (data.position) {
          console.log('📍 Spawn position from server:', data.position)
        }
        return preserveExistingSpawnPosition(prev, data)
      })
      // Add current player to gameState so they show up in the current players list
      setGameState(prev => {
        const currentPlayer = buildGameJoinedCurrentPlayer({
          socketId: socket.id,
          identityKey,
          name: foxName,
          ordinalAddress,
          originOutpoint: foxOriginOutpoint,
          carColor: playerColor,
          trackName
        })
        return upsertCurrentMultiplayerPlayer({
          previousState: prev,
          gameId: data.gameId,
          player: currentPlayer,
          identityKey
        })
      })
      setHasJoined(true)
      hasJoinedRef.current = true

      // Emit current game status now that we've joined
      // This is needed for startRaceImmediately where gameStatus is 'loading' before join completes
      if (gameStatus !== 'idle' && gameStatus !== 'showroom') {
        socket.emit('updateGameStatus', { gameStatus })
      }
    })

    socket.on('playerJoined', (data: PlayerJoinedSocketPayload & { totalPlayers: number }) => {
      console.log('Player joined Pixel Racing:', data)
      console.log(`🏁 ASPEN playerJoined - Received trackName: "${data.trackName}" for player ${data.name}`)
      setGameState(prev => {
        if (!prev) return { gameId: 'pixelfoxracing', players: [] }
        if (prev.players.find(p => p.id === data.playerId)) return prev
        
        return {
          ...prev,
          players: [...prev.players, buildJoinedGameStatePlayer(data, {
            defaultTrackName: 'Aspen',
            includeInitialMovement: true
          })]
        }
      })
      
      // Add to otherPlayers if not current player AND on same track
      if (!isCurrentMultiplayerPlayer({ player: data, socketId: socket.id, identityKey })) {
        // Check if player is on the same track
        const playerTrackName = data.trackName || 'Aspen'
        const currentPlayerTrackName = trackName || 'Aspen'

        console.log(`🎨 playerJoined - Player ${data.name} (${data.playerId}) carColor:`, data.carColor, 'track:', playerTrackName, 'current track:', currentPlayerTrackName)

        if (isSameMultiplayerTrack({
          player: data,
          currentTrackName: trackName,
          defaultTrackName: 'Aspen'
        })) {
          setOtherPlayers(prev => {
            if (prev.find(p => p.id === data.playerId)) return prev
            const index = prev.length
            const carColor = data.carColor || getPlayerColorByIndex(index)
            console.log(`🎨 playerJoined - Adding player to otherPlayers:`, data.name, 'carColor:', carColor)
            return [...prev, buildJoinedRacingWorldPlayer({
              player: data,
              index,
              getFallbackColor: getPlayerColorByIndex,
              includeSpeed: true
            })]
          })
        } else {
          console.log(`🎨 playerJoined - Skipping player ${data.name} (different track: ${playerTrackName})`)
        }
      }
    })

    socket.on('playerLeft', (data: { playerId: string; totalPlayers: number }) => {
      console.log('Player left Pixel Racing:', data)
      setGameState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          players: removeMultiplayerPlayerById(prev.players, data.playerId)
        }
      })
      // Remove from otherPlayers
      setOtherPlayers(prev => removeMultiplayerPlayerById(prev, data.playerId))
    })

    socket.on('gameState', (state: {
      gameId: string
      players: Array<{
        id: string
        identityKey: string
        name: string
        score: number
        ordinalAddress?: string | null
        originOutpoint?: string | null
        position?: { x: number; y: number; z: number }
        rotation?: { x: number; y: number; z: number }
        speed?: number
        carColor?: string
        gameStatus?: 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
        trackName?: string // Track name for this player
      }>
      items?: GameItem[]
      trackName?: string // Track name from server
    }) => {
      // Debug: Log trackName for all players in received gameState
      console.log(`🏁 ASPEN gameState - Players trackNames:`, state.players?.map(p => ({ name: p.name, trackName: p.trackName })))
      // Use requestAnimationFrame to prevent blocking the main thread
      requestAnimationFrame(() => {
        // Preserve current player's trackName when updating gameState
        setGameState(prev => {
          // Merge server state with current player's trackName
          return {
            ...state,
            players: preserveCurrentMultiplayerPlayerTrackName(state.players, prev?.players, {
              socketId: socket.id,
              identityKey
            }, trackName)
          }
        })
        
        // Don't update track name from server's global trackName - each component has its own track
        // The server's state.trackName is a global default, not per-player
        
        // Update items if present in gameState
        if (state.items) {
          setItems(state.items)
        }
      })
      
      // Update other players from game state
      if (state.players) {
        const currentSocketId = socket.id
        // Get existing otherPlayers to preserve carColor
        setOtherPlayers(prev => {
          const existingPlayersMap = new Map(prev.map(p => [p.id, p]))
          
          const otherPlayersList: Array<{
            id: string
            name: string
            position: [number, number, number]
            rotation: [number, number, number]
            color: string
            carColor: string
            isWalking: boolean
            speed: number
            originOutpoint?: string
            chatMessage?: string
            chatTimestamp?: number
            }> = state.players
              .filter(p => {
                // Exclude current player - check both socket.id and identityKey to be safe
                const isCurrentPlayer = isCurrentMultiplayerPlayer({ player: p, socketId: currentSocketId, identityKey })
                if (isCurrentPlayer) return false
                
                return isSameMultiplayerTrack({
                  player: p,
                  currentTrackName: trackName,
                  defaultTrackName: 'Aspen'
                })
              })
            .map((p, index) => {
              const existingPlayer = existingPlayersMap.get(p.id)
              return buildRacingWorldPlayer({
                player: p,
                existingPlayer,
                index,
                getFallbackColor: getPlayerColorByIndex,
                includeSpeed: true
              })
            })
          return otherPlayersList
        })
      }
      
      // Check if current player exists in gameState but hasJoined is false
      // This handles reconnection scenarios where gameState arrives before gameJoined
      if (state.players) {
        const currentPlayer = findMultiplayerPlayerBySocketId(state.players, socket.id)
        if (currentPlayer && !hasJoinedRef.current) {
          console.log(`🔄 Player ${socket.id} (${currentPlayer.name}) found in gameState but hasJoined is false. Setting hasJoined to true.`)
          setHasJoined(true)
          hasJoinedRef.current = true
        }
      }
    })
    
    socket.on('playerPositionUpdate', (data: PlayerPositionSocketPayload) => {
      // Batch remote packets; the snowmobile world handles visual interpolation between batches.
      queueRemotePlayerPositionUpdate(data)
    })

    socket.on('playerCarColorUpdate', (data: PlayerCarColorSocketPayload) => {
      // Update other players' carColor
      setOtherPlayers(prev => applyPlayerCarColorUpdate(prev, data))
      
      // Also update gameState for Current Players display
      setGameState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          players: patchMultiplayerPlayerById(prev.players, data.playerId, { carColor: data.carColor })
        }
      })
    })

    socket.on('playerTrackNameUpdate', (data: PlayerTrackNameSocketPayload) => {
      // Update other players' trackName in gameState
      setGameState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          players: applyPlayerTrackNameUpdate(prev.players, data)
        }
      })
    })

    socket.on('playerChat', (data: PlayerChatSocketPayload) => {
      const timestamp = Date.now()
      const chatTarget = getIncomingPlayerChatTarget({
        payload: data,
        socketId: socket.id,
        currentTrackName: trackNameRef.current || 'Aspen',
        defaultTrackName: 'Aspen',
        players: gameStateRef.current?.players
      })

      if (chatTarget === 'ignore') return

      if (chatTarget === 'local') {
        // This is our own message - already handled in handleSendChat
        setLocalChatMessage({ text: data.message, timestamp })
      } else {
        setOtherPlayers(prev => applyRemotePlayerChatMessage(prev, data, timestamp))
      }
    })

    socket.on('playerCollision', (data: PlayerCollisionSocketPayload) => {
      setOtherPlayers(prev => applyPlayerCollisionUpdate(prev, data, socket.id))
      
      // Note: If current player is involved, the server will send playerPositionUpdate
      // which will update their position through the normal flow
      console.log(`💥 Collision detected between ${data.playerId1} and ${data.playerId2}`)
    })

    // Collectible handlers disabled for Aspen - collectibles not rendered on this track

    registerRacingTransactionSocketListeners({
      socket,
      fallbackTrackName: 'Aspen',
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

  // Join game when entering showroom with a fox (or when starting race immediately)
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
      console.log('🎮 ASPEN: Emitting joinGame with trackName:', trackName)
      socket?.emit('joinGame', buildJoinGamePayload({
        identityKey,
        foxName,
        ordinalAddress,
        foxOriginOutpoint,
        playerColor,
        startFinishPosition: {
          x: startFinishPosition.x,
          y: startFinishPosition.y,
          z: startFinishPosition.z
        },
        trackName
      }))
    }
  }, [gameStatus, foxOriginOutpoint, foxName, ordinalAddress, identityKey, startRaceImmediately, playerColor, trackName, isConnected])

  // Auto-enter showroom if we have a fox (unless starting race immediately)
  useEffect(() => {
    if (foxOriginOutpoint && gameStatus === 'idle' && !startRaceImmediately) {
      setGameStatus('showroom')
    }
  }, [foxOriginOutpoint, gameStatus, startRaceImmediately])

  // Preload stadium foxes early (during showroom/loading) so they're ready by countdown
  useEffect(() => {
    if (gameStatus === 'showroom' || gameStatus === 'loading') {
      preloadStadiumFoxes()
    }
  }, [gameStatus])

  // Preload all audio during showroom/loading so it's ready for countdown
  useEffect(() => {
    if (gameStatus === 'showroom' || gameStatus === 'loading') {
      // Force the browser to fully load all audio files
      raceStartBeepsAudio.load()
      audio.load()
      dingAudio.load()
    }
  }, [gameStatus, raceStartBeepsAudio, audio, dingAudio])

  // Start race immediately if prop is set
  const hasStartedRaceRef = useRef(false)
  useEffect(() => {
    if (startRaceImmediately && foxOriginOutpoint && gameStatus === 'idle' && !hasStartedRaceRef.current) {
      hasStartedRaceRef.current = true
      hasPlayedRaceStartBeepsRef.current = false
      // Start game immediately - DO NOT set hasJoined here!
      // hasJoined is only set true after receiving gameJoined event from server
      // Setting it here blocks the joinGame emit via hasJoinedRef sync
      applyRaceLoadingStartState({
        setGameStatus,
        setScore,
        setDistanceTraveled,
        setLapTime,
        setLapTimes,
        setLapTxids,
        setCountdown
      })
      if (spawnPosition && !vehiclePosition) {
        setVehiclePosition(spawnPosition)
      }
    }
    if (!startRaceImmediately) {
      hasStartedRaceRef.current = false
    }
  }, [startRaceImmediately, foxOriginOutpoint, gameStatus, spawnPosition, vehiclePosition])

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
    // Prevent duplicate submissions - if already submitting, ignore this call
    if (isSubmittingLapRef.current) {
      console.log('⚠️ Lap submission already in progress, ignoring duplicate call')
      return
    }
    
    console.log(`🏁 Lap completion detected: ${lapTimeSeconds.toFixed(3)}s on track "${trackName}"`)
    
    const lapSubmissionValidation = validateLapSubmissionCandidate({
      gameStatus,
      trackName,
      lapTimeSeconds,
      identity: {
        ownerAddress: ordinalAddress,
        outpoint: foxOutpoint,
        originOutpoint: foxOriginOutpoint,
        foxName
      }
    })
    if (!lapSubmissionValidation.valid) {
      console.log(`❌ Invalid lap - ${lapSubmissionValidation.message}`)
      setLapTimes(prev => [...prev, lapTimeSeconds])
      return
    }
    const lapIdentity = lapSubmissionValidation.identity
    
    // All validations passed - proceed with submission
    console.log(`✅ Lap validation passed${TESTING_MODE ? ' (TESTING MODE - skipping server submission)' : ' - submitting to server'}`)
    
    // Calculate lap index BEFORE updating state (so we can use it when txid arrives)
    let currentLapIndex: number
    setLapTimes(prev => {
      currentLapIndex = prev.length // This will be the index of the new lap
      return [...prev, lapTimeSeconds]
    })
    
    // Log lap completion using PixelRacingGameResult type structure
    const lapCompletionTimestamp = Date.now()
    const lapResult: PixelRacingGameResult = buildPixelRacingGameResult({
      identity: lapIdentity,
      lapTimeSeconds,
      timestampMs: lapCompletionTimestamp,
      carColor: playerColor
    })
    
    // Log lap completion details
    console.log(`🏁 LAP COMPLETED:`)
    console.log(`   Time: ${lapTimeSeconds.toFixed(3)}s`)
    console.log(`   Track: ${trackName}`)
    console.log(`   Fox: ${foxName}`)
    console.log(`   Distance: ${distanceTraveled.toFixed(2)}m`)
    
    // Skip server submission in testing mode
    if (TESTING_MODE) {
      console.log(`🧪 TESTING MODE: Skipping transaction submission to server`)
      // Lap timer will reset automatically in SnowmobileWorld when next lap starts
      setLapTime(0)
      return
    }
    
    // Submit lap result to server
    isSubmittingLapRef.current = true
    setIsSubmittingLap(true)
    setLapSubmissionError(null)
    
    try {
      const submission = await submitPixelRacingLapCompletion({
        transactionServerUrl: TRANSACTION_SERVER_URL,
        identity: lapIdentity,
        lapTimeSeconds,
        timestampMs: lapCompletionTimestamp,
        carColor: playerColor,
        trackName: trackName
      })
      
      // Log what we're sending to server
      console.log('📤 Submitted lap completion to server:', submission.inscriptionPayload)
      
      console.log('✅ Lap completion txid received:', submission.txid)
      applyPixelRacingLapCompletionSubmission(submission, {
        lapIndex: currentLapIndex,
        updateLapResultTxid: txid => {
          lapResult.txid = txid
        },
        setLapTxid: (lapIndex, txid) => {
          setLapTxids(prev => ({ ...prev, [lapIndex]: txid }))
        },
        onLatestActivityChange,
        emitSharedLapTransaction: payload => {
          socketRef.current?.emit('shareGameTransaction', payload)
        }
      })
    } catch (err) {
      console.error('Failed to create lap inscription:', err)
      setLapSubmissionError(err instanceof Error ? err.message : 'Failed to create lap inscription')
    } finally {
      isSubmittingLapRef.current = false
      setIsSubmittingLap(false)
    }
    
    // Lap timer will reset automatically in SnowmobileWorld when next lap starts
    setLapTime(0)
  }, [ordinalAddress, foxOutpoint, foxOriginOutpoint, foxName, onLatestActivityChange, gameStatus, trackName, playerColor, distanceTraveled])

  const handleStartRace = useCallback(() => {
    if (trackName !== 'Aspen' && onTrackChange) {
      onTrackChange(trackName, playerColor)
      return
    }

    hasPlayedRaceStartBeepsRef.current = false

    // Aspen snowmobile event - start race directly
    applyRaceStartState({
      setHasJoined,
      setGameStatus,
      setScore,
      setDistanceTraveled,
      setLapTime,
      setLapTimes,
      setLapTxids,
      setCountdown
    })
    // Keep vehiclePosition from spawnPosition - don't reset it, so minimap shows blue dot during countdown
    if (spawnPosition && !vehiclePosition) {
      setVehiclePosition(spawnPosition)
    }
  }, [spawnPosition, vehiclePosition, trackName, onTrackChange, playerColor])

  const playRaceStartBeeps = useCallback(() => {
    if (hasPlayedRaceStartBeepsRef.current) {
      return
    }

    hasPlayedRaceStartBeepsRef.current = true

    if (!hasUserMutedRef.current) {
      playAudioElement(raceStartBeepsAudio, { reset: true, errorMessage: 'Failed to play race start beeps:' })
    }
  }, [hasUserMutedRef, raceStartBeepsAudio])

  const {
    isWorldLoaded,
    isVehicleLoaded,
    handleWorldLoaded,
    handleVehicleLoaded,
    handleSceneReady
  } = useRaceCountdownFlow({
    gameStatus,
    setGameStatus,
    setCountdown,
    playStartBeeps: playRaceStartBeeps,
    vehicleLabel: 'Snowmobile',
    preventDuplicateSceneReady: true
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
    resetPosition: () => setVehiclePosition(null),
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
    defaultTrackName: 'Aspen',
    ordinalAddress,
    walletSaladCount,
    walletBlueberryCount,
    walletRabbitCount,
    blueberryIconUrl: blueberryUrl,
    saladIconUrl: saladUrl,
    rabbitIconUrl: rabbitUrl
  })

  return (
    <>
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 60px)', position: 'relative', backgroundColor: '#000', margin: '0 auto' }}>
        {/* Loading Screen */}
        {gameStatus === 'loading' && (
          <RacingLoadingOverlay />
        )}
        
        {/* 3D World - SnowmobileWorld from snowmobilerace */}
        <SnowmobileWorld
          otherPlayers={useMemo(() => {
            const visiblePlayers = filterRemotePlayersForQuality(
              otherPlayers,
              filterPosition,
              getRacingQualityPreset(qualityPresetId)
            )

            return visiblePlayers.map(p => ({
              id: p.id,
              name: p.name,
              position: { x: p.position[0], y: p.position[1], z: p.position[2] },
              rotation: { x: p.rotation[0], y: p.rotation[1], z: p.rotation[2] },
              speed: p.speed || 0,
              color: p.carColor,
              originOutpoint: p.originOutpoint,
              chatMessage: p.chatMessage,
              chatTimestamp: p.chatTimestamp
            } as PlayerState))
          }, [otherPlayers, filterPosition, qualityPresetId])}
          gameStatus={gameStatus}
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
          onCarLoaded={handleVehicleLoaded}
          onPositionUpdate={handlePositionUpdate}
          localChatMessage={localChatMessage}
          cameraMode={cameraMode}
          showMinimap={false}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          qualityPresetId={qualityPresetId}
        />

        {/* Minimap - Show during racing and countdown (bottom right) */}
        {(gameStatus === 'racing' || gameStatus === 'countdown') && (
          <Minimap
            carPosition={vehiclePosition}
            trackLocation={trackLocation}
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

        {/* Fox Info Panel - shown during racing/countdown (same panel for normal and fullscreen modes) */}
        {(gameStatus === 'racing' || gameStatus === 'countdown') && hasJoined && foxOriginOutpoint && (
          <RacingPlayerInfoPanel
            name={foxName}
            originOutpoint={foxOriginOutpoint}
            addresses={[
              { label: 'Ord:', value: ordinalAddress, canCopy: true },
              { label: 'BSV:', value: bsvAddress, canCopy: true }
            ]}
            walletItems={[
              { label: 'Blueberries', iconUrl: blueberryUrl, count: walletBlueberryCount },
              { label: 'Salads', iconUrl: saladUrl, count: walletSaladCount },
              { label: 'Rabbits', iconUrl: rabbitUrl, count: walletRabbitCount }
            ]}
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
            if (newTrackName !== 'Aspen') {
              onTrackChange?.(newTrackName)
            }
          }}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          vehicleMode="snowmobile"
          showroomLoading={false}
          qualityPresetId={qualityPresetId}
          onQualityPresetChange={setQualityPresetId}
          showroomVehicleModes={['car', 'snowmobile']}
        />
      </div>
    </>
  )
}
