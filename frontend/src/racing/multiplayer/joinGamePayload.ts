import { normalizeOrdinalOutpoint } from '../transactions/ordinalOutpoint'

export interface JoinGameStartFinishPosition {
  x: number
  y: number
  z: number
}

export interface BuildJoinGamePayloadInput {
  identityKey?: string | null
  foxName?: string | null
  ordinalAddress?: string | null
  foxOriginOutpoint?: string | null
  playerColor: string
  trackName: string
  startFinishPosition?: JoinGameStartFinishPosition
  createGuestIdentityKey?: () => string
}

export interface JoinGamePayload {
  identityKey: string
  name: string
  ordinalAddress: string | null
  originOutpoint: string | null
  carColor: string
  trackName: string
  startFinishPosition?: JoinGameStartFinishPosition
}

export interface ShouldEmitJoinGameInput {
  gameStatus: string
  hasFoxOriginOutpoint: boolean
  hasSocket: boolean
  hasJoined: boolean
  isConnected?: boolean
  requireConnection?: boolean
  startRaceImmediately?: boolean
  allowActiveRaceJoin?: boolean
}

export const createGuestIdentityKey = (): string => {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const buildJoinGamePayload = ({
  identityKey,
  foxName,
  ordinalAddress,
  foxOriginOutpoint,
  playerColor,
  trackName,
  startFinishPosition,
  createGuestIdentityKey: createGuestIdentityKeyOverride = createGuestIdentityKey
}: BuildJoinGamePayloadInput): JoinGamePayload => ({
  identityKey: identityKey || createGuestIdentityKeyOverride(),
  name: foxName || 'Fox',
  ordinalAddress: ordinalAddress || null,
  originOutpoint: foxOriginOutpoint
    ? normalizeOrdinalOutpoint(foxOriginOutpoint)
    : null,
  carColor: playerColor,
  ...(startFinishPosition ? { startFinishPosition } : {}),
  trackName
})

export const shouldEmitJoinGame = ({
  gameStatus,
  hasFoxOriginOutpoint,
  hasSocket,
  hasJoined,
  isConnected = true,
  requireConnection = false,
  startRaceImmediately = false,
  allowActiveRaceJoin = false
}: ShouldEmitJoinGameInput): boolean => {
  if (!hasFoxOriginOutpoint || !hasSocket || hasJoined) {
    return false
  }

  if (requireConnection && !isConnected) {
    return false
  }

  if (gameStatus === 'showroom') {
    return true
  }

  if (!allowActiveRaceJoin) {
    return false
  }

  return gameStatus === 'countdown' ||
    gameStatus === 'racing' ||
    (gameStatus === 'loading' && startRaceImmediately)
}
