export interface MultiplayerPlayerIdentityLike {
  id?: string | null
  playerId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
}

export interface CurrentMultiplayerPlayerInput {
  player: MultiplayerPlayerIdentityLike
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
  allowOrdinalFallback?: boolean
}

export interface MultiplayerPlayerTrackLike {
  trackName?: string | null
}

export interface MultiplayerPlayerIdLike {
  id: string
}

export interface MultiplayerGameStateLike<Player extends MultiplayerPlayerIdentityLike> {
  gameId: string
  players: Player[]
}

export interface SameMultiplayerTrackInput {
  player: MultiplayerPlayerTrackLike
  currentTrackName?: string | null
  defaultTrackName: string
}

export const isCurrentMultiplayerPlayer = ({
  player,
  socketId,
  identityKey,
  ordinalAddress,
  allowOrdinalFallback = false
}: CurrentMultiplayerPlayerInput): boolean => {
  const playerSocketId = player.id || player.playerId

  if (socketId && playerSocketId === socketId) {
    return true
  }

  if (identityKey && player.identityKey === identityKey) {
    return true
  }

  return allowOrdinalFallback && !!ordinalAddress && player.ordinalAddress === ordinalAddress
}

export const isSameMultiplayerTrack = ({
  player,
  currentTrackName,
  defaultTrackName
}: SameMultiplayerTrackInput): boolean => {
  return (player.trackName || defaultTrackName) === (currentTrackName || defaultTrackName)
}

export const patchMultiplayerPlayerById = <Player extends MultiplayerPlayerIdLike>(
  players: Player[],
  playerId: string,
  patch: Partial<Player>
): Player[] => {
  return players.map(player => player.id === playerId ? { ...player, ...patch } : player)
}

export const removeMultiplayerPlayerById = <Player extends MultiplayerPlayerIdLike>(
  players: Player[],
  playerId: string
): Player[] => players.filter(player => player.id !== playerId)

export interface UpsertCurrentMultiplayerPlayerInput<Player extends MultiplayerPlayerIdentityLike> {
  previousState: MultiplayerGameStateLike<Player> | null
  gameId: string
  player: Player
  identityKey?: string | null
  mergeExisting?: boolean
}

export const upsertCurrentMultiplayerPlayer = <Player extends MultiplayerPlayerIdentityLike>(
  {
    previousState,
    gameId,
    player,
    identityKey,
    mergeExisting = true
  }: UpsertCurrentMultiplayerPlayerInput<Player>
): MultiplayerGameStateLike<Player> => {
  if (!previousState) {
    return { gameId, players: [player] }
  }

  let didUpdate = false
  const players = previousState.players.map(existingPlayer => {
    if (!isCurrentMultiplayerPlayer({ player: existingPlayer, socketId: player.id || player.playerId, identityKey })) {
      return existingPlayer
    }

    didUpdate = true
    return mergeExisting
      ? { ...existingPlayer, ...player }
      : player
  })

  return {
    ...previousState,
    gameId,
    players: didUpdate ? players : [...previousState.players, player]
  }
}

export const findMultiplayerPlayerBySocketId = <Player extends MultiplayerPlayerIdLike>(
  players: Player[] | undefined,
  socketId?: string | null
): Player | undefined => {
  if (!players || !socketId) {
    return undefined
  }

  return players.find(player => player.id === socketId)
}

export const patchCurrentMultiplayerPlayer = <Player extends MultiplayerPlayerIdentityLike>(
  players: Player[],
  input: Omit<CurrentMultiplayerPlayerInput, 'player'>,
  patch: Partial<Player>
): Player[] => {
  return players.map(player => (
    isCurrentMultiplayerPlayer({ ...input, player })
      ? { ...player, ...patch }
      : player
  ))
}

export const preserveCurrentMultiplayerPlayerTrackName = <Player extends MultiplayerPlayerIdentityLike & MultiplayerPlayerTrackLike>(
  players: Player[],
  previousPlayers: Player[] | undefined,
  input: Omit<CurrentMultiplayerPlayerInput, 'player'>,
  fallbackTrackName: string
): Player[] => {
  const currentPlayerTrackName = previousPlayers?.find(player => (
    isCurrentMultiplayerPlayer({ ...input, player })
  ))?.trackName || fallbackTrackName

  return players.map(player => (
    isCurrentMultiplayerPlayer({ ...input, player })
      ? { ...player, trackName: player.trackName || currentPlayerTrackName }
      : player
  ))
}
