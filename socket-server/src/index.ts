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
  headlightsEnabled?: boolean
  carColor: string
  gameStatus: 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'
  trackName?: string
}

interface PlayerCollisionReport {
  collisionId?: string
  sequence?: number
  trackName?: string
  playerId1: string
  playerId2: string
  position1: { x: number; y: number; z: number }
  position2: { x: number; y: number; z: number }
  rotation1: { x: number; y: number; z: number }
  rotation2: { x: number; y: number; z: number }
  speed1: number
  speed2: number
  resultSpeed1?: number
  resultSpeed2?: number
  collisionKind?: string
  contactNormal?: { x: number; z: number }
  overlapDepth?: number
  occurredAt?: number
}

const pixelRacingState = {
  gameId: ROOM_ID,
  players: new Map<string, PixelRacingPlayer>(),
  items: [] as GameItem[],
  trackName: 'Australia',
}

const COLLIDABLE_PLAYER_STATUSES = new Set(['racing', 'crashed', 'finished'])
const COLLISION_PAIR_COOLDOWN_MS = 250
const COLLISION_MAX_REPORT_AGE_MS = 2000
const COLLISION_MAX_DISTANCE = 12
const COLLISION_MAX_ABS_SPEED = 140
const collisionPairLastAcceptedAt = new Map<string, number>()

function validateTrackName(trackName: string | undefined): string | null {
  if (!trackName?.trim()) return null
  const trimmed = trackName.trim()
  return VALID_TRACK_NAMES.includes(trimmed) ? trimmed : null
}

function playerPairKey(playerId1: string, playerId2: string): string {
  return [playerId1, playerId2].sort().join(':')
}

function isFiniteVector3(vector: { x: number; y: number; z: number } | undefined): vector is { x: number; y: number; z: number } {
  return vector !== undefined && Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
}

function isAcceptableCollisionReport(
  socketId: string,
  report: PlayerCollisionReport,
  now: number
): { accepted: true; player1: PixelRacingPlayer; player2: PixelRacingPlayer } | { accepted: false } {
  const player1 = pixelRacingState.players.get(report.playerId1)
  const player2 = pixelRacingState.players.get(report.playerId2)
  if (!player1 || !player2) return { accepted: false }
  if (socketId !== player1.socketId && socketId !== player2.socketId) return { accepted: false }
  if (!COLLIDABLE_PLAYER_STATUSES.has(player1.gameStatus) || !COLLIDABLE_PLAYER_STATUSES.has(player2.gameStatus)) {
    return { accepted: false }
  }
  if (!player1.trackName || player1.trackName !== player2.trackName) return { accepted: false }
  if (report.trackName && report.trackName !== player1.trackName) return { accepted: false }
  if (!isFiniteVector3(report.position1) || !isFiniteVector3(report.position2)) return { accepted: false }
  if (!isFiniteVector3(report.rotation1) || !isFiniteVector3(report.rotation2)) return { accepted: false }
  if (!Number.isFinite(report.speed1) || !Number.isFinite(report.speed2)) return { accepted: false }
  if (Math.abs(report.speed1) > COLLISION_MAX_ABS_SPEED || Math.abs(report.speed2) > COLLISION_MAX_ABS_SPEED) {
    return { accepted: false }
  }
  if (report.resultSpeed1 !== undefined && (!Number.isFinite(report.resultSpeed1) || Math.abs(report.resultSpeed1) > COLLISION_MAX_ABS_SPEED)) {
    return { accepted: false }
  }
  if (report.resultSpeed2 !== undefined && (!Number.isFinite(report.resultSpeed2) || Math.abs(report.resultSpeed2) > COLLISION_MAX_ABS_SPEED)) {
    return { accepted: false }
  }
  if (report.occurredAt !== undefined && (!Number.isFinite(report.occurredAt) || Math.abs(now - report.occurredAt) > COLLISION_MAX_REPORT_AGE_MS)) {
    return { accepted: false }
  }

  const reportDx = report.position1.x - report.position2.x
  const reportDz = report.position1.z - report.position2.z
  if (Math.hypot(reportDx, reportDz) > COLLISION_MAX_DISTANCE) return { accepted: false }

  const serverDx = player1.position.x - player2.position.x
  const serverDz = player1.position.z - player2.position.z
  if (Math.hypot(serverDx, serverDz) > COLLISION_MAX_DISTANCE * 1.5) return { accepted: false }

  const pairKey = playerPairKey(report.playerId1, report.playerId2)
  const lastAcceptedAt = collisionPairLastAcceptedAt.get(pairKey) || 0
  if (now - lastAcceptedAt < COLLISION_PAIR_COOLDOWN_MS) return { accepted: false }
  collisionPairLastAcceptedAt.set(pairKey, now)

  return { accepted: true, player1, player2 }
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
      headlightsEnabled: player.headlightsEnabled,
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
      headlightsEnabled: false,
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
    headlightsEnabled?: boolean
  }) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) return
    player.position = { ...data.position }
    player.rotation = { ...data.rotation }
    player.speed = data.speed
    player.headlightsEnabled = Boolean(data.headlightsEnabled)

    if (['loading', 'countdown', 'racing', 'crashed', 'finished'].includes(player.gameStatus)) {
      socket.broadcast.to(ROOM_ID).emit('playerPositionUpdate', {
        playerId: socket.id,
        position: player.position,
        rotation: player.rotation,
        speed: player.speed,
        headlightsEnabled: player.headlightsEnabled,
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

  socket.on('reportPlayerCollision', (data: PlayerCollisionReport) => {
    const now = Date.now()
    const validation = isAcceptableCollisionReport(socket.id, data, now)
    if (!validation.accepted) return

    const payload = {
      collisionId: data.collisionId || `${playerPairKey(data.playerId1, data.playerId2)}:${now}`,
      sequence: Number.isFinite(data.sequence) ? data.sequence : now,
      trackName: validation.player1.trackName,
      playerId1: data.playerId1,
      playerId2: data.playerId2,
      position1: data.position1,
      position2: data.position2,
      rotation1: data.rotation1,
      rotation2: data.rotation2,
      speed1: data.resultSpeed1 ?? data.speed1,
      speed2: data.resultSpeed2 ?? data.speed2,
      collisionKind: data.collisionKind,
      contactNormal: data.contactNormal,
      overlapDepth: data.overlapDepth,
      occurredAt: data.occurredAt || now,
      acceptedAt: now,
    }

    pixelRacingIo.to(ROOM_ID).emit('playerCollisionResolved', payload)
    pixelRacingIo.to(ROOM_ID).emit('playerCollision', payload)
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
