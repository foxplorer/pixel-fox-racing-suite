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
}

export interface CollisionSyncedPlayer {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  isWalking: boolean
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
