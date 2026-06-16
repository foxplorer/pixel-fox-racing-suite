import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { io, Socket } from 'socket.io-client'
import { SnowmobileWorld, CameraMode } from './SnowmobileWorld'
import { SnowmobileUI } from './SnowmobileUI'
import { SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH } from '../../racing/components/RacingChatInputBar'
import { useRacingChatSender } from '../../racing/components/useRacingChatSender'
import './SnowmobileComponent.css'
import { GameStatus, PlayerState } from './types'
import { DEFAULT_PLAYER_COLOR } from '../../racing/core/playerColors'
import { useFullscreenToggle } from '../../racing/components/useFullscreenToggle'
import { createPreloadedAudio, playAudioElement } from '../../racing/components/audioElements'
import { RacingPlayerInfoPanel } from '../../racing/components/RacingPlayerInfoPanel'
import { normalizeOrdinalOutpoint } from '../../racing/transactions/ordinalOutpoint'
import raceStartBeeps from '../../assets/race-start-beeps.mp3'

const SOCKET_URL = import.meta.env.VITE_PIXELRACING_SOCKET_URL || 'http://localhost:5000'

interface SnowmobileGameProps {
  identityKey?: string | null
  onPlayerInfoChange?: (name: string, color: string) => void
  foxName?: string | null
  foxOriginOutpoint?: string | null
  foxOutpoint?: string | null
  ordinalAddress?: string | null
  onConnectWallet?: () => void | Promise<void>
  onCurrentPlayersRender?: (jsx: React.ReactNode) => void
}

interface GameState {
  gameId: string
  players: Array<{
    id: string
    name: string
    originOutpoint?: string
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    speed: number
    color: string
    gameStatus: string
  }>
}

export const SnowmobileGame: React.FC<SnowmobileGameProps> = ({
  identityKey,
  onPlayerInfoChange,
  foxName,
  foxOriginOutpoint,
  foxOutpoint,
  ordinalAddress,
  onConnectWallet,
  onCurrentPlayersRender
}) => {
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [speed, setSpeed] = useState(0)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  const [hasJoined, setHasJoined] = useState(false)
  const [sledReady, setSledReady] = useState(false) // Track if sled is loaded and positioned
  const [playerColor, setPlayerColor] = useState(DEFAULT_PLAYER_COLOR)
  const [countdown, setCountdown] = useState(3) // Countdown timer
  const [cameraMode, setCameraMode] = useState<CameraMode>('smooth') // Camera mode - default to smooth
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const playerColorRef = useRef(playerColor) // Ref to avoid socket reconnect on color change
  const hasPlayedRaceStartBeepsRef = useRef(false)

  // Keep playerColorRef in sync
  useEffect(() => {
    playerColorRef.current = playerColor
  }, [playerColor])

  // Multiplayer state
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [otherPlayers, setOtherPlayers] = useState<PlayerState[]>([])
  // Ref for position updates - avoids 100 re-renders/sec with multiple players
  const otherPlayersPositionsRef = useRef<Map<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; speed: number }>>(new Map())

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [localChatMessage, setLocalChatMessage] = useState<{ text: string; timestamp: number } | null>(null)

  const { containerRef, isFullscreen, toggleFullscreen } = useFullscreenToggle<HTMLDivElement>()

  // Refs
  const socketRef = useRef<Socket | null>(null)
  const lastPositionUpdateRef = useRef(0)

  // Race start beeps audio - plays during countdown
  const raceStartBeepsAudio = useMemo(() => {
    return createPreloadedAudio(raceStartBeeps, { loop: false })
  }, [])

  // Socket connection
  useEffect(() => {
    if (!hasJoined) return

    const socket = io(SOCKET_URL, {
      path: '/pixelfoxracing',
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to snowmobile server:', socket.id)

      // Join the snowmobile game
      socket.emit('joinGame', {
        identityKey: identityKey || `guest_${Date.now()}`,
        name: foxName || 'Anonymous',
        ordinalAddress: ordinalAddress,
        originOutpoint: normalizeOrdinalOutpoint(foxOriginOutpoint),
        color: playerColorRef.current // Use ref to avoid reconnect on color change
      })
    })

    socket.on('gameJoined', (data: { gameId: string }) => {
      console.log('Joined snowmobile game:', data.gameId)
      socket.emit('updateGameStatus', { gameStatus: 'racing' })
    })

    socket.on('gameState', (state: GameState) => {
      setGameState(state)
      // Filter out current player and map to PlayerState
      const others = state.players
        .filter(p => p.id !== socket.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          position: p.position,
          rotation: p.rotation,
          speed: p.speed,
          color: p.color,
          originOutpoint: p.originOutpoint
        }))
      setOtherPlayers(others)
    })

    socket.on('playerJoined', (data: { playerId: string; name: string; originOutpoint?: string; color: string }) => {
      console.log('Player joined:', data.name)
    })

    socket.on('playerLeft', (data: { playerId: string }) => {
      console.log('Player left:', data.playerId)
      otherPlayersPositionsRef.current.delete(data.playerId) // Clean up ref
      setOtherPlayers(prev => prev.filter(p => p.id !== data.playerId))
      // Also update gameState to reflect the player leaving (for player count)
      setGameState(prev => prev ? {
        ...prev,
        players: prev.players.filter(p => p.id !== data.playerId)
      } : null)
    })

    socket.on('playerPositionUpdate', (data: {
      playerId: string
      position: { x: number; y: number; z: number }
      rotation: { x: number; y: number; z: number }
      speed: number
    }) => {
      // Store in ref - no re-render! Synced to state every 200ms
      otherPlayersPositionsRef.current.set(data.playerId, {
        position: data.position,
        rotation: data.rotation,
        speed: data.speed
      })
    })

    socket.on('playerColorUpdate', (data: { playerId: string; color: string }) => {
      setOtherPlayers(prev =>
        prev.map(p => p.id === data.playerId ? { ...p, color: data.color } : p)
      )
    })

    socket.on('playerChat', (data: { playerId: string; playerName: string; message: string }) => {
      const timestamp = Date.now()
      if (data.playerId === socket.id) {
        // Our own message - already handled
        setLocalChatMessage({ text: data.message, timestamp })
      } else {
        // Other player's message
        setOtherPlayers(prev =>
          prev.map(p => p.id === data.playerId
            ? { ...p, chatMessage: data.message, chatTimestamp: timestamp }
            : p
          )
        )
      }
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from snowmobile server')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [hasJoined, identityKey, foxName, foxOriginOutpoint, ordinalAddress])

  // Sync position updates from ref to state every 200ms (5fps)
  // This reduces re-renders from ~100/sec to 5/sec with multiple players
  useEffect(() => {
    if (!hasJoined) return

    const syncInterval = setInterval(() => {
      const positionsRef = otherPlayersPositionsRef.current
      if (positionsRef.size === 0) return

      setOtherPlayers(prev => {
        let hasChanges = false
        const updated = prev.map(player => {
          const newPos = positionsRef.get(player.id)
          if (newPos) {
            hasChanges = true
            return {
              ...player,
              position: newPos.position,
              rotation: newPos.rotation,
              speed: newPos.speed
            }
          }
          return player
        })
        return hasChanges ? updated : prev
      })
    }, 100) // 10fps sync rate - balances performance with smooth interpolation

    return () => clearInterval(syncInterval)
  }, [hasJoined])

  // Send position updates to server (throttled to ~20Hz)
  const handlePositionUpdate = useCallback((
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    currentSpeed: number
  ) => {
    if (!socketRef.current || !hasJoined) return

    const now = Date.now()
    if (now - lastPositionUpdateRef.current < 50) return // Throttle to 20Hz
    lastPositionUpdateRef.current = now

    socketRef.current.emit('updatePosition', {
      position,
      rotation,
      speed: currentSpeed
    })
  }, [hasJoined])

  // Handle speed updates - throttled to 5fps since it's just for display
  const lastSpeedRef = useRef(0)
  const lastSpeedUpdateRef = useRef(0)
  const handleSpeedUpdate = useCallback((newSpeed: number) => {
    const now = Date.now()
    if (now - lastSpeedUpdateRef.current > 200) {
      const roundedSpeed = Math.round(newSpeed)
      if (roundedSpeed !== Math.round(lastSpeedRef.current)) {
        setSpeed(roundedSpeed)
        lastSpeedRef.current = newSpeed
      }
      lastSpeedUpdateRef.current = now
    }
  }, [])

  // Handle join - start riding immediately
  const handleJoin = useCallback(() => {
    setHasJoined(true)
    setGameStatus('racing')
  }, [])

  // Handle restart
  const handleRestart = useCallback(() => {
    setGameStatus('showroom')
    setHasJoined(false)
    setSpeed(0)
  }, [])

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    setPlayerColor(color)
    if (socketRef.current) {
      socketRef.current.emit('updateColor', { color })
    }
  }, [])

  // Handle enter ride - transition from showroom to countdown
  const handleEnterRide = useCallback(() => {
    setGameStatus('loading')
    setSledReady(false)
    setHasJoined(true)
    setDistanceTraveled(0) // Reset distance
    setCountdown(3) // Reset countdown
    hasPlayedRaceStartBeepsRef.current = false
  }, [])

  // Start countdown when sled is ready
  useEffect(() => {
    if (gameStatus === 'loading' && sledReady) {
      // Small delay before showing countdown
      const delayTimer = setTimeout(() => {
        setGameStatus('countdown')
        setCountdown(3)

        if (!hasPlayedRaceStartBeepsRef.current) {
          hasPlayedRaceStartBeepsRef.current = true
          playAudioElement(raceStartBeepsAudio, { reset: true, errorMessage: 'Failed to play race start beeps:' })
        }

        // Start countdown timer
        let count = 3
        countdownTimerRef.current = setInterval(() => {
          count--
          setCountdown(count)
          if (count <= 0) {
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current)
              countdownTimerRef.current = null
            }
            setGameStatus('racing')
          }
        }, 1000)
      }, 500) // 500ms delay before countdown starts

      return () => clearTimeout(delayTimer)
    }
  }, [gameStatus, sledReady, raceStartBeepsAudio])

  // Cleanup countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  // Handle sled ready - called when fox texture and position are ready
  const handleSledReady = useCallback(() => {
    setSledReady(true)
  }, [])

  // Handle sending chat message
  const handleSendChat = useRacingChatSender({
    chatInput,
    setChatInput,
    setLocalChatMessage,
    socketRef,
    hasJoined,
    maxLength: SNOWMOBILE_CHAT_MESSAGE_MAX_LENGTH
  })

  // Handle wallet connection - go to showroom for color selection
  useEffect(() => {
    if (foxName && foxOriginOutpoint && gameStatus === 'idle') {
      setGameStatus('showroom')
    }
  }, [foxName, foxOriginOutpoint, gameStatus])

  // Memoize player list key to avoid re-rendering when only positions change
  // Only includes id, name, color - not position/speed which change constantly
  const playerListKey = useMemo(() => {
    if (!gameState) return ''
    return gameState.players
      .slice(0, 5)
      .map(p => `${p.id}:${p.name}:${p.color}`)
      .join('|') + `|count:${gameState.players.length}`
  }, [gameState])

  // Render current players section - only when player list actually changes
  useEffect(() => {
    if (onCurrentPlayersRender && gameState && playerListKey) {
      const playersJsx = (
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          marginTop: '10px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginBottom: '8px', letterSpacing: '0.1em' }}>
            RIDERS ONLINE ({gameState.players.length})
          </div>
          {gameState.players.slice(0, 5).map(player => (
            <div key={player.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: player.color
              }} />
              <span style={{ color: '#ccc', fontSize: '12px' }}>
                {player.name || 'Anonymous'}
              </span>
            </div>
          ))}
        </div>
      )
      onCurrentPlayersRender(playersJsx)
    }
  }, [playerListKey, onCurrentPlayersRender, gameState])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : '80vh',
        background: isFullscreen ? '#0d1f33' : undefined
      }}
    >
      {/* Fox Info Display - shown in fullscreen mode */}
      {isFullscreen && hasJoined && foxOriginOutpoint && (
        <RacingPlayerInfoPanel
          name={foxName}
          originOutpoint={foxOriginOutpoint}
          addresses={[{ label: 'ID:', value: identityKey, canCopy: true }]}
          backgroundColor="rgba(13, 31, 51, 0.9)"
          borderColor="rgba(135, 206, 235, 0.2)"
          accentColor="#87CEEB"
          mutedColor="#666"
          imageSize={70}
          minWidth={280}
          maxWidth={350}
          showDetailsDivider={false}
        />
      )}

      {/* 3D World */}
      {gameStatus !== 'idle' && (
        <SnowmobileWorld
          gameStatus={gameStatus}
          playerColor={playerColor}
          foxOriginOutpoint={foxOriginOutpoint || undefined}
          otherPlayers={otherPlayers}
          onPositionUpdate={handlePositionUpdate}
          onSpeedUpdate={handleSpeedUpdate}
          onDistanceUpdate={setDistanceTraveled}
          localChatMessage={localChatMessage}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSledReady={handleSledReady}
          countdown={countdown}
          cameraMode={cameraMode}
        />
      )}

      {/* UI Overlay */}
      <SnowmobileUI
        gameStatus={gameStatus}
        speed={speed}
        distanceTraveled={distanceTraveled}
        countdown={countdown}
        hasJoined={hasJoined}
        onJoin={handleJoin}
        onRestart={handleRestart}
        foxName={foxName}
        foxOriginOutpoint={foxOriginOutpoint}
        playerColor={playerColor}
        onColorChange={handleColorChange}
        ordinalAddress={ordinalAddress}
        onConnectWallet={onConnectWallet}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onSendChat={handleSendChat}
        playersOnline={gameState?.players.length || 0}
        sledReady={sledReady}
        onEnterRide={handleEnterRide}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
      />
    </div>
  )
}
