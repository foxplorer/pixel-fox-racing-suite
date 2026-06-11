export interface PlayerPositionVector3 {
  x: number
  y: number
  z: number
}

export interface PlayerPositionSocketPayload {
  playerId: string
  position: PlayerPositionVector3
  rotation: PlayerPositionVector3
  speed: number
}

export interface PositionSyncedPlayer {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  isWalking: boolean
}

export interface SpeedSyncedPlayer extends PositionSyncedPlayer {
  speed: number
}

export interface QueuedPlayerPositionUpdate {
  position: [number, number, number]
  rotation: [number, number, number]
  speed: number
}

export const toQueuedPlayerPositionUpdate = (
  payload: PlayerPositionSocketPayload
): QueuedPlayerPositionUpdate => ({
  position: [payload.position.x, payload.position.y, payload.position.z] as [number, number, number],
  rotation: [payload.rotation.x, payload.rotation.y, payload.rotation.z] as [number, number, number],
  speed: payload.speed
})

export const applyPlayerPositionUpdate = <TPlayer extends PositionSyncedPlayer>(
  players: TPlayer[],
  payload: PlayerPositionSocketPayload
): TPlayer[] => {
  let didChange = false

  const nextPlayers = players.map(player => {
    if (player.id !== payload.playerId) {
      return player
    }

    didChange = true
    return {
      ...player,
      position: [payload.position.x, payload.position.y, payload.position.z] as [number, number, number],
      rotation: [payload.rotation.x, payload.rotation.y, payload.rotation.z] as [number, number, number],
      isWalking: payload.speed > 0
    }
  })

  return didChange ? nextPlayers : players
}

export const applyQueuedPlayerPositionUpdates = <TPlayer extends PositionSyncedPlayer>(
  players: TPlayer[],
  updates: Map<string, QueuedPlayerPositionUpdate>
): TPlayer[] => {
  let didChange = false

  const nextPlayers = players.map(player => {
    const update = updates.get(player.id)
    if (!update) {
      return player
    }

    didChange = true
    const updatedPlayer = {
      ...player,
      position: update.position,
      rotation: update.rotation,
      isWalking: update.speed > 0
    }

    return ('speed' in player
      ? { ...updatedPlayer, speed: update.speed }
      : updatedPlayer) as TPlayer
  })

  return didChange ? nextPlayers : players
}
