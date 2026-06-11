export interface PlayerCarColorSocketPayload {
  playerId: string
  carColor: string
}

export interface PlayerTrackNameSocketPayload {
  playerId: string
  trackName: string
}

export interface CarColorSyncedPlayer {
  id: string
  carColor?: string
}

export interface TrackNameSyncedPlayer {
  id: string
  trackName?: string
}

export const applyPlayerCarColorUpdate = <TPlayer extends CarColorSyncedPlayer>(
  players: TPlayer[],
  payload: PlayerCarColorSocketPayload
): TPlayer[] => {
  let didChange = false

  const nextPlayers = players.map(player => {
    if (player.id !== payload.playerId) {
      return player
    }

    didChange = true
    return {
      ...player,
      carColor: payload.carColor
    }
  })

  return didChange ? nextPlayers : players
}

export const applyPlayerTrackNameUpdate = <TPlayer extends TrackNameSyncedPlayer>(
  players: TPlayer[],
  payload: PlayerTrackNameSocketPayload
): TPlayer[] => {
  let didChange = false

  const nextPlayers = players.map(player => {
    if (player.id !== payload.playerId) {
      return player
    }

    didChange = true
    return {
      ...player,
      trackName: payload.trackName
    }
  })

  return didChange ? nextPlayers : players
}
