import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import {
  ScheduledRaceRoomRegistry,
  SCHEDULED_RACE_TIMEOUT_MS,
  getScheduledRaceRoomId,
  isValidScheduledRaceFinishReport,
  isValidScheduledRaceLapProgressReport,
  isValidScheduledRaceRoomJoinInput,
  type ScheduledRaceFinishReport,
  type ScheduledRaceLapProgressReport,
  type ScheduledRaceRoomJoinInput,
} from './scheduledRaceRooms.js'

config()

const app = express()
const server = createServer(app)
const PORT = Number(process.env.PORT || 5000)
const TRANSACTION_SERVER_URL = (process.env.TRANSACTION_SERVER_URL || 'http://localhost:9000').replace(/\/+$/, '')
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
  scheduledRaceId?: string | null
  scheduledRaceEntrantId?: string | null
  scheduledRaceGridSlot?: number | null
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
const scheduledRaceRooms = new ScheduledRaceRoomRegistry()
const announcedScheduledRaceSettlements = new Set<string>()

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
      scheduledRaceId: player.scheduledRaceId,
      scheduledRaceEntrantId: player.scheduledRaceEntrantId,
      scheduledRaceGridSlot: player.scheduledRaceGridSlot,
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

function removeSocketPlayer(socketId: string): void {
  const player = pixelRacingState.players.get(socketId)
  if (!player) return
  const scheduledRaceId = scheduledRaceRooms.leavePlayer(socketId)
  pixelRacingState.players.delete(socketId)
  pixelRacingIo.to(ROOM_ID).emit('playerLeft', {
    playerId: socketId,
    totalPlayers: pixelRacingState.players.size,
  })
  if (scheduledRaceId && scheduledRaceRooms.getActiveRaceIds().includes(scheduledRaceId)) {
    const snapshot = scheduledRaceRooms.getSnapshot(scheduledRaceId, Date.now())
    pixelRacingIo.to(snapshot.roomId).emit('scheduledRaceRoomSnapshot', snapshot)
  }
  emitGameState()
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

async function submitScheduledRaceResult(report: ScheduledRaceFinishReport): Promise<unknown> {
  const response = await fetch(`${TRANSACTION_SERVER_URL}/scheduled-races/${encodeURIComponent(report.raceId)}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      entrantId: report.entrantId,
      totalTimeMs: report.totalTimeMs,
      lapTimesMs: report.lapTimesMs,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Scheduled race result failed with ${response.status}`
    throw new Error(message)
  }
  return payload
}

async function submitScheduledRaceLapProgress(report: ScheduledRaceLapProgressReport): Promise<unknown> {
  const response = await fetch(`${TRANSACTION_SERVER_URL}/scheduled-races/${encodeURIComponent(report.raceId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      entrantId: report.entrantId,
      lapTimesMs: report.lapTimesMs,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Scheduled race progress failed with ${response.status}`
    throw new Error(message)
  }
  return payload
}

async function unstageScheduledRaceEntrant(raceId: string, entrantId: string): Promise<void> {
  const response = await fetch(`${TRANSACTION_SERVER_URL}/scheduled-races/${encodeURIComponent(raceId)}/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ entrantId }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Scheduled race unstage failed with ${response.status}`
    throw new Error(message)
  }
}

async function settleScheduledRace(raceId: string): Promise<any> {
  const response = await fetch(`${TRANSACTION_SERVER_URL}/scheduled-races/${encodeURIComponent(raceId)}/settle`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `Scheduled race settlement failed with ${response.status}`
    throw new Error(message)
  }
  return payload
}

function buildScheduledRaceSettlementActivity(race: any): Record<string, unknown> | null {
  const finalInscription = race?.finalInscription
  if (!finalInscription?.txid) return null
  const firstFinisher = Array.isArray(race.results)
    ? race.results.find((result: any) => result?.status === 'finished')
    : null
  const firstEntrant = Array.isArray(race.roster) && firstFinisher
    ? race.roster.find((entrant: any) => entrant?.entrantId === firstFinisher.entrantId)
    : Array.isArray(race.roster) ? race.roster[0] : null

  return {
    txid: finalInscription.txid,
    score: firstFinisher?.totalTimeMs ? Number(firstFinisher.totalTimeMs) / 1000 : 0,
    time: Date.parse(finalInscription.updatedAt || finalInscription.createdAt || race.serverTime || '') || Date.now(),
    foxOutpoint: firstEntrant?.foxOutpoint || '',
    foxName: firstEntrant?.foxName || 'Multiplayer Race',
    originOutpoint: firstEntrant?.foxOriginOutpoint || '',
    ownerAddress: null,
    trackName: race.trackName,
    dummy: finalInscription.dummy === true,
    groupRaceId: race.id,
    groupRaceFinal: true,
    groupRaceEntrantCount: Array.isArray(race.roster) ? race.roster.length : 0,
    groupRaceFinisherCount: Array.isArray(race.results)
      ? race.results.filter((result: any) => result?.status === 'finished').length
      : 0,
    inscriptionName: finalInscription.inscriptionName,
    outputIndex: finalInscription.outputIndex,
  }
}

async function settleAndAnnounceScheduledRace(raceId: string): Promise<void> {
  if (announcedScheduledRaceSettlements.has(raceId)) return
  const payload = await settleScheduledRace(raceId)
  const race = payload?.race
  if (!race || !['settled', 'no_contest', 'cancelled'].includes(race.status)) return
  announcedScheduledRaceSettlements.add(raceId)
  const roomId = getScheduledRaceRoomId(raceId)
  pixelRacingIo.to(roomId).emit('scheduledRaceSettlement', { race })
  const activity = buildScheduledRaceSettlementActivity(race)
  if (activity) {
    pixelRacingIo.to(roomId).emit('newGameTransaction', activity)
  }
}

maintainRacingItemCount()

setInterval(() => {
  const nowMs = Date.now()
  for (const raceId of scheduledRaceRooms.getActiveRaceIds()) {
    const snapshot = scheduledRaceRooms.getSnapshot(raceId, nowMs)
    pixelRacingIo.to(snapshot.roomId).emit('scheduledRaceCountdown', snapshot)
    const startsAtMs = Date.parse(snapshot.startsAt)
    if (Number.isFinite(startsAtMs) && nowMs >= startsAtMs + SCHEDULED_RACE_TIMEOUT_MS) {
      void settleAndAnnounceScheduledRace(raceId).catch(error => {
        console.warn('Scheduled race settlement announcement failed:', error instanceof Error ? error.message : error)
      })
    }
  }
}, 1000)

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
      headlightsEnabled: true,
      carColor: data.carColor || '#FF6B6B',
      gameStatus: 'showroom',
      trackName: validateTrackName(data.trackName) || 'Australia',
      scheduledRaceId: null,
      scheduledRaceEntrantId: null,
      scheduledRaceGridSlot: null,
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
    scheduledRaceRooms.updateEntrant(socket.id, { gameStatus: player.gameStatus })
    emitGameState()
  })

  socket.on('joinScheduledRaceRoom', (data: Partial<ScheduledRaceRoomJoinInput>) => {
    const player = pixelRacingState.players.get(socket.id)
    if (!player) {
      socket.emit('scheduledRaceRoomError', { message: 'Join the game before entering a scheduled race room' })
      return
    }
    if (!isValidScheduledRaceRoomJoinInput(data)) {
      socket.emit('scheduledRaceRoomError', { message: 'Invalid scheduled race room payload' })
      return
    }

    const trackName = validateTrackName(data.trackName)
    if (!trackName) {
      socket.emit('scheduledRaceRoomError', { message: 'Invalid scheduled race track' })
      return
    }

    const previousRaceId = scheduledRaceRooms.getRaceIdForPlayer(socket.id)
    if (previousRaceId && previousRaceId !== data.raceId) {
      socket.leave(getScheduledRaceRoomId(previousRaceId))
    }

    player.headlightsEnabled = player.headlightsEnabled ?? true
    player.trackName = trackName
    player.scheduledRaceId = data.raceId
    player.scheduledRaceEntrantId = data.entrantId
    player.scheduledRaceGridSlot = data.gridSlot

    const snapshot = scheduledRaceRooms.joinRace({
      ...data,
      trackName,
    }, {
      playerId: socket.id,
      identityKey: player.identityKey,
      name: player.name,
      carColor: player.carColor,
      originOutpoint: player.originOutpoint || data.entrantId,
      position: player.position,
      rotation: player.rotation,
      speed: player.speed,
      headlightsEnabled: player.headlightsEnabled,
      gameStatus: player.gameStatus,
    }, Date.now())

    socket.join(snapshot.roomId)
    socket.emit('scheduledRaceRoomJoined', snapshot)
    pixelRacingIo.to(snapshot.roomId).emit('scheduledRaceRoomSnapshot', snapshot)
    emitGameState()
  })

  socket.on('leaveScheduledRaceRoom', () => {
    const player = pixelRacingState.players.get(socket.id)
    const leavingEntrant = scheduledRaceRooms.getEntrantForPlayer(socket.id)
    const leavingRaceId = scheduledRaceRooms.getRaceIdForPlayer(socket.id)
    let roomStatusBeforeLeave: string | null = null
    if (leavingRaceId) {
      try {
        roomStatusBeforeLeave = scheduledRaceRooms.getSnapshot(leavingRaceId, Date.now()).status
      } catch {
        roomStatusBeforeLeave = null
      }
    }
    const raceId = scheduledRaceRooms.leavePlayer(socket.id)
    if (!raceId) return

    if (leavingEntrant && roomStatusBeforeLeave && roomStatusBeforeLeave !== 'racing') {
      void unstageScheduledRaceEntrant(raceId, leavingEntrant.entrantId).catch(error => {
        console.warn('Scheduled race unstage failed:', error instanceof Error ? error.message : error)
      })
    }

    socket.leave(getScheduledRaceRoomId(raceId))
    if (player) {
      player.scheduledRaceId = null
      player.scheduledRaceEntrantId = null
      player.scheduledRaceGridSlot = null
    }

    if (scheduledRaceRooms.getActiveRaceIds().includes(raceId)) {
      const snapshot = scheduledRaceRooms.getSnapshot(raceId, Date.now())
      pixelRacingIo.to(snapshot.roomId).emit('scheduledRaceRoomSnapshot', snapshot)
    }
    emitGameState()
  })

  socket.on('leaveGame', () => {
    removeSocketPlayer(socket.id)
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
    const previousHeadlightsEnabled = player.headlightsEnabled
    const previousEntrantHeadlightsEnabled = scheduledRaceRooms.getEntrantForPlayer(socket.id)?.headlightsEnabled
    player.headlightsEnabled = data.headlightsEnabled !== undefined ? Boolean(data.headlightsEnabled) : (player.headlightsEnabled ?? true)
    const scheduledSnapshot = scheduledRaceRooms.updateEntrant(socket.id, {
      position: player.position,
      rotation: player.rotation,
      speed: player.speed,
      headlightsEnabled: player.headlightsEnabled,
    })
    if (scheduledSnapshot && (
      previousHeadlightsEnabled !== player.headlightsEnabled
      || previousEntrantHeadlightsEnabled !== player.headlightsEnabled
    )) {
      pixelRacingIo.to(scheduledSnapshot.roomId).emit('scheduledRaceRoomSnapshot', scheduledSnapshot)
    }

    if (['loading', 'countdown', 'racing', 'crashed', 'finished'].includes(player.gameStatus)) {
      const targetRoomId = player.scheduledRaceId
        ? getScheduledRaceRoomId(player.scheduledRaceId)
        : ROOM_ID
      socket.broadcast.to(targetRoomId).emit('playerPositionUpdate', {
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

    const targetRoomId = validation.player1.scheduledRaceId && validation.player1.scheduledRaceId === validation.player2.scheduledRaceId
      ? getScheduledRaceRoomId(validation.player1.scheduledRaceId)
      : ROOM_ID
    pixelRacingIo.to(targetRoomId).emit('playerCollisionResolved', payload)
    pixelRacingIo.to(targetRoomId).emit('playerCollision', payload)
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

  socket.on('reportScheduledRaceLapProgress', (data: Partial<ScheduledRaceLapProgressReport>) => {
    const player = pixelRacingState.players.get(socket.id)
    const entrant = scheduledRaceRooms.getEntrantForPlayer(socket.id)
    if (!player || !entrant || !isValidScheduledRaceLapProgressReport(data)) return
    if (data.raceId !== player.scheduledRaceId || data.raceId !== scheduledRaceRooms.getRaceIdForPlayer(socket.id)) return
    if (data.entrantId !== entrant.entrantId) return

    void submitScheduledRaceLapProgress(data).catch(error => {
      console.warn('Scheduled race progress storage failed:', error instanceof Error ? error.message : error)
    })

    pixelRacingIo.to(getScheduledRaceRoomId(data.raceId)).emit('scheduledRaceLapProgress', {
      raceId: data.raceId,
      entrantId: data.entrantId,
      playerId: socket.id,
      identityKey: player.identityKey,
      name: player.name,
      trackName: player.trackName,
      lapTimesMs: data.lapTimesMs,
      totalTimeMs: data.lapTimesMs.reduce((total, lapTimeMs) => total + lapTimeMs, 0),
    })
  })

  socket.on('reportScheduledRaceFinish', async (data: Partial<ScheduledRaceFinishReport>) => {
    const player = pixelRacingState.players.get(socket.id)
    const entrant = scheduledRaceRooms.getEntrantForPlayer(socket.id)
    if (!player || !entrant || !isValidScheduledRaceFinishReport(data)) {
      socket.emit('scheduledRaceFinishRejected', { message: 'Invalid scheduled race finish report' })
      return
    }
    if (data.raceId !== player.scheduledRaceId || data.raceId !== scheduledRaceRooms.getRaceIdForPlayer(socket.id)) {
      socket.emit('scheduledRaceFinishRejected', { message: 'Scheduled race mismatch' })
      return
    }
    if (data.entrantId !== entrant.entrantId) {
      socket.emit('scheduledRaceFinishRejected', { message: 'Scheduled race entrant mismatch' })
      return
    }

    let transactionResult: unknown = null
    try {
      transactionResult = await submitScheduledRaceResult(data)
    } catch (error) {
      socket.emit('scheduledRaceFinishRejected', {
        message: error instanceof Error ? error.message : 'Scheduled race result storage failed',
      })
      return
    }

    const payload = {
      raceId: data.raceId,
      entrantId: data.entrantId,
      playerId: socket.id,
      identityKey: player.identityKey,
      name: player.name,
      trackName: player.trackName,
      totalTimeMs: data.totalTimeMs,
      lapTimesMs: data.lapTimesMs,
      finishedAt: new Date().toISOString(),
      transactionResult,
    }
    pixelRacingIo.to(getScheduledRaceRoomId(data.raceId)).emit('scheduledRaceFinishAccepted', payload)

    const resultRace = (transactionResult as { race?: { status?: string } } | null)?.race
    if (resultRace?.status === 'settled' || resultRace?.status === 'no_contest') {
      void settleAndAnnounceScheduledRace(data.raceId).catch(error => {
        console.warn('Scheduled race early settlement announcement failed:', error instanceof Error ? error.message : error)
      })
    }
  })

  socket.on('disconnect', () => {
    removeSocketPlayer(socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`Pixel Fox Racing socket server listening on ${PORT}`)
})
