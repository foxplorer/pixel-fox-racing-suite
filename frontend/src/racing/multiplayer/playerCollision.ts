export interface MultiplayerVector3 {
  x: number
  y: number
  z: number
}

export interface PlayerCollisionSocketPayload {
  playerId1: string
  playerId2: string
  position1: MultiplayerVector3
  position2: MultiplayerVector3
  rotation1: MultiplayerVector3
  rotation2: MultiplayerVector3
  speed1: number
  speed2: number
  collisionId?: string
  sequence?: number
  trackName?: string
  collisionKind?: string
  contactNormal?: { x: number; z: number }
  overlapDepth?: number
  occurredAt?: number
  acceptedAt?: number
}

export interface LocalPlayerCollisionReport {
  remotePlayerId: string
  localPosition: MultiplayerVector3
  remotePosition: MultiplayerVector3
  localRotationY: number
  remoteRotationY: number
  localSpeed: number
  remoteSpeed: number
  resultLocalSpeed: number
  collisionKind?: string
  contactNormal?: { x: number; z: number }
  overlapDepth?: number
  occurredAt: number
}

export interface ReportPlayerCollisionSocketPayload extends PlayerCollisionSocketPayload {
  collisionId: string
  sequence: number
  trackName?: string
  resultSpeed1: number
  resultSpeed2: number
  collisionKind?: string
  contactNormal?: { x: number; z: number }
  overlapDepth?: number
  occurredAt: number
}

export const buildReportPlayerCollisionPayload = ({
  localPlayerId,
  report,
  trackName,
  sequence
}: {
  localPlayerId: string
  report: LocalPlayerCollisionReport
  trackName?: string
  sequence: number
}): ReportPlayerCollisionSocketPayload => {
  const pairKey = [localPlayerId, report.remotePlayerId].sort().join(':')

  return {
    collisionId: `${pairKey}:${sequence}`,
    sequence,
    trackName,
    playerId1: localPlayerId,
    playerId2: report.remotePlayerId,
    position1: report.localPosition,
    position2: report.remotePosition,
    rotation1: { x: 0, y: report.localRotationY, z: 0 },
    rotation2: { x: 0, y: report.remoteRotationY, z: 0 },
    speed1: report.localSpeed,
    speed2: report.remoteSpeed,
    resultSpeed1: report.resultLocalSpeed,
    resultSpeed2: report.remoteSpeed,
    collisionKind: report.collisionKind,
    contactNormal: report.contactNormal,
    overlapDepth: report.overlapDepth,
    occurredAt: report.occurredAt
  }
}

export interface CollisionSyncedPlayer {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  isWalking: boolean
}

export type PlayerCollisionSequenceState = Map<string, number>

export const getPlayerCollisionPairKey = (playerId1: string, playerId2: string): string => {
  return [playerId1, playerId2].sort().join(':')
}

export const shouldApplyPlayerCollisionSequence = (
  payload: PlayerCollisionSocketPayload,
  sequenceState: PlayerCollisionSequenceState
): boolean => {
  if (payload.sequence === undefined || !Number.isFinite(payload.sequence)) {
    return true
  }

  const pairKey = getPlayerCollisionPairKey(payload.playerId1, payload.playerId2)
  const previousSequence = sequenceState.get(pairKey)
  if (previousSequence !== undefined && payload.sequence <= previousSequence) {
    return false
  }

  sequenceState.set(pairKey, payload.sequence)
  return true
}

export const applyPlayerCollisionUpdate = <TPlayer extends CollisionSyncedPlayer>(
  players: TPlayer[],
  payload: PlayerCollisionSocketPayload,
  currentSocketId?: string
): TPlayer[] => players.map(player => {
  if (player.id === currentSocketId) {
    return player
  }

  if (player.id === payload.playerId1) {
    return {
      ...player,
      position: [payload.position1.x, payload.position1.y, payload.position1.z],
      rotation: [payload.rotation1.x, payload.rotation1.y, payload.rotation1.z],
      isWalking: payload.speed1 > 0
    }
  }

  if (player.id === payload.playerId2) {
    return {
      ...player,
      position: [payload.position2.x, payload.position2.y, payload.position2.z],
      rotation: [payload.rotation2.x, payload.rotation2.y, payload.rotation2.z],
      isWalking: payload.speed2 > 0
    }
  }

  return player
})
