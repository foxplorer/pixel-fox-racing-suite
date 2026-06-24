import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

config()

const app = express()
const server = createServer(app)
const PORT = Number(process.env.PORT || 5000)
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'pixel-fox-racing-socket-server' })
})

const pixelRacingIo = new Server(server, {
  path: '/pixelfoxracing',
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

const ITEM_TYPES = ['blueberry', 'salad', 'rabbit'] as const
const ITEM_VALUES: Record<(typeof ITEM_TYPES)[number], number> = {
  blueberry: 10,
  salad: 20,
  rabbit: 50,
}
const MAX_ITEMS = 10
const ROOM_ID = 'global_pixelfoxracing_world'
const DEFAULT_VALID_TRACK_NAMES = ['Australia', 'San Luis', 'Belgium', 'Aspen', 'United Kingdom', 'Germany', 'Volcanoes']
const VALID_TRACK_NAMES = (process.env.VALID_TRACK_NAMES || DEFAULT_VALID_TRACK_NAMES.join(','))
  .split(',')
  .map(trackName => trackName.trim())
  .filter(Boolean)

interface GameItem {
  id: string
  type: (typeof ITEM_TYPES)[number]
  position: { x: number; y: number; z: number }
  value: number
}

interface PixelRacingPlayer {
  id: string
  socketId: string
  identityKey: string
  name: string
  ordinalAddress?: string | null
  originOutpoint?: string | null
  score: number
  bestLapTime: number
  joinedAt: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  speed: number
  carColor: string
  gameStatus: 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
  trackName?: string
}

const pixelRacingState = {
  gameId: ROOM_ID,
  players: new Map<string, PixelRacingPlayer>(),
  items: [] as GameItem[],
  trackName: 'Australia',
}

function validateTrackName(trackName: string | undefined): string | null {
  if (!trackName?.trim()) return null
  const trimmed = trackName.trim()
  return VALID_TRACK_NAMES.includes(trimmed) ? trimmed : null
}

function serializablePlayers() {
  return Array.from(pixelRacingState.players.values())
    .filter(player => ['showroom', 'loading', 'countdown', 'racing', 'crashed', 'finished'].includes(player.gameStatus))
    .map(player => ({
      id: player.id,
      identityKey: player.identityKey,
      name: player.name,
      ordinalAddress: player.ordinalAddress,
      originOutpoint: player.originOutpoint,
      score: player.score,
      position: player.position,
      rotation: player.rotation,
      speed: player.speed,
      carColor: player.carColor,
      gameStatus: player.gameStatus,
      trackName: player.trackName,
    }))
}

function emitGameState() {
  pixelRacingIo.to(ROOM_ID).emit('gameState', {
    gameId: pixelRacingState.gameId,
    players: serializablePlayers(),
    items: pixelRacingState.items,
    trackName: pixelRacingState.trackName,
  })
}

function spawnRandomRacingItem(): GameItem | null {
  const type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]
  const value = ITEM_VALUES[type]
  const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  for (let attempts = 0; attempts < 300; attempts++) {
    const t = Math.random()
    const angle = t * Math.PI * 2
    let x = Math.cos(angle) * 200 + Math.sin(angle * 3) * 60
    let z = Math.sin(angle) * 200 + Math.cos(angle * 2) * 40

    const perpAngle = angle + Math.PI / 2
    const offsetDistance = Math.random() > 0.5
      ? (Math.random() - 0.5) * 10
      : (Math.random() - 0.5) * 40 + (Math.random() > 0.5 ? 15 : -15)
    x += Math.cos(perpAngle) * offsetDistance
    z += Math.sin(perpAngle) * offsetDistance

    const y = 0.5 + Math.random()
    const tooCloseToItem = pixelRacingState.items.some(item => {
      const dx = item.position.x - x
      const dy = item.position.y - y
      const dz = item.position.z - z
      return dx * dx + dy * dy + dz * dz < 60 * 60
    })
    const tooCloseToStart = Math.sqrt(x * x + z * z) < 20

    if (!tooCloseToItem && !tooCloseToStart) {
      return { id, type, position: { x, y, z }, value }
    }
  }

  return null
}

function maintainRacingItemCount() {
  while (pixelRacingState.items.length < MAX_ITEMS) {
    const item = spawnRandomRacingItem()
    if (!item) break
    pixelRacingState.items.push(item)
  }
}

maintainRacingItemCount()

pixelRacingIo.on('connection', socket => {
  socket.join(ROOM_ID)
  socket.emit('gameState', {
    gameId: pixelRacingState.gameId,
    players: serializablePlayers(),
    items: pixelRacingState.items,
    trackName: pixelRacingState.trackName,
  })

  socket.on('joinGame', (data: {
    identityKey: string
    name?: string
    ordinalAddress?: string | null
    originOutpoint?: string | null
    carColor?: string
    startFinishPosition?: { x: number; y: number; z: number }
    trackName?: string
  }) => {
    if (!data.identityKey) {
      socket.emit('error', { message: 'Identity key is required' })
      return
    }

    pixelRacingState.players.delete(socket.id)
    const startPos = data.startFinishPosition || { x: 0, y: 0.1, z: 0 }
    const rawName = data.name?.trim() || ''
    const isGuestId = rawName.startsWith('guest_') && rawName.split('_').length >= 3
    const name = rawName && !isGuestId ? rawName : 'Fox'

    const player: PixelRacingPlayer = {
      id: socket.id,
      socketId: socket.id,
      identityKey: data.identityKey,
      name,
      ordinalAddress: data.ordinalAddress || null,
      originOutpoint: data.originOutpoint || null,
      score: 0,
      bestLapTime: 0,
      joinedAt: Date.now(),
      position: { x: startPos.x, y: startPos.y || 0.1, z: startPos.z },
      rotation: { x: 0, y: 0, z: 0 },
      speed: 0,
      carColor: data.carColor || '#FF6B6B',
      gameStatus: 'showroom',
      trackName: validateTrackName(data.trackName) || 'Australia',
    }

    pixelRacingState.players.set(socket.id, player)
    socket.emit('gameJoined', { gameId: ROOM_ID, position: player.position })
    pixelRacingIo.to(ROOM_ID).emit('playerJoined', {
      playerId: socket.id,
      identityKey: player.identityKey,
      name: player.name,
      ordinalAddress: player.ordinalAddress,
      originOutpoint: player.originOutpoint,
      score: player.score,
      carColor: player.carColor,
      trackName: player.trackName,
      totalPlayers: pixelRacingState.players.size,
    })
    emitGameState()
  })

  socket.on('updateGameStatus', (data: { gameStatus: PixelRacingPlayer['gameStatus'] }) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return
    player.gameStatus = data.gameStatus
    emitGameState()
  })

  socket.on('updatePosition', (data: {
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    speed: number
  }) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return
    player.position = { ...data.position }
    player.rotation = { ...data.rotation }
    player.speed = data.speed

    if (['loading', 'countdown', 'racing', 'crashed', 'finished'].includes(player.gameStatus)) {
      socket.broadcast.to(ROOM_ID).emit('playerPositionUpdate', {
        playerId: socket.id,
        position: player.position,
        rotation: player.rotation,
        speed: player.speed,
      })
    }
  })

  socket.on('updateCarColor', (data: { carColor: string }) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player || !data.carColor) return
    player.carColor = data.carColor
    pixelRacingIo.to(ROOM_ID).emit('playerCarColorUpdate', { playerId: socket.id, carColor: data.carColor })
  })

  socket.on('updateTrackName', (data: { trackName: string }) => {
    const player = pixelRacingState.players.get(socket.id)
    const trackName = validateTrackName(data.trackName)
    if (!player || !trackName) return
    player.trackName = trackName
    pixelRacingIo.to(ROOM_ID).emit('playerTrackNameUpdate', { playerId: socket.id, trackName })
  })

  socket.on('playerChat', (data: { message: string }) => {
    if (!pixelRacingState.players.has(socket.id)) return
    pixelRacingIo.to(ROOM_ID).emit('playerChat', {
      playerId: socket.id,
      message: String(data.message || '').slice(0, 50),
    })
  })

  socket.on('collectItem', (data: { itemId: string }) => {
    const itemIndex = pixelRacingState.items.findIndex(item => item.id === data.itemId)
    if (itemIndex === -1) return
    const [item] = pixelRacingState.items.splice(itemIndex, 1)
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return

    player.score += item.value
    pixelRacingIo.to(ROOM_ID).emit('itemCollected', {
      itemId: data.itemId,
      playerId: socket.id,
      score: player.score,
      itemType: item.type,
    })

    const newItem = spawnRandomRacingItem()
    if (newItem) {
      pixelRacingState.items.push(newItem)
      pixelRacingIo.to(ROOM_ID).emit('itemSpawned', { item: newItem })
    }
  })

  socket.on('shareTransaction', data => {
    const player = pixelRacingState.players.get(socket.id)
    pixelRacingIo.to(ROOM_ID).emit('newItemTransaction', {
      ...data,
      playerId: socket.id,
      foxName: data.foxName || player?.name || 'Unknown Fox',
      originOutpoint: data.originOutpoint || player?.originOutpoint || data.foxOutpoint,
      ownerAddress: data.ownerAddress || player?.ordinalAddress || null,
      trackName: data.trackName || player?.trackName || 'Australia',
    })
  })

  socket.on('shareGameTransaction', data => {
    const player = pixelRacingState.players.get(socket.id)
    pixelRacingIo.to(ROOM_ID).emit('newGameTransaction', {
      ...data,
      itemType: undefined,
      itemImage: undefined,
      trackName: data.trackName || player?.trackName || 'Australia',
    })
  })

  socket.on('playerLapComplete', (data: { lapTime: number; score?: number }) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return
    if (player.bestLapTime === 0 || data.lapTime < player.bestLapTime) {
      player.bestLapTime = data.lapTime
    }
    if (data.score !== undefined) {
      player.score = data.score
    }
    pixelRacingIo.to(ROOM_ID).emit('playerLapComplete', {
      playerId: socket.id,
      lapTime: data.lapTime,
      score: player.score,
      bestLapTime: player.bestLapTime,
    })
  })

  socket.on('disconnect', () => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return
    pixelRacingState.players.delete(socket.id)
    pixelRacingIo.to(ROOM_ID).emit('playerLeft', {
      playerId: socket.id,
      totalPlayers: pixelRacingState.players.size,
    })
  })
})

server.listen(PORT, () => {
  console.log(`Pixel Fox Racing socket server listening on ${PORT}`)
})
