import {
  applyCarTrackGameStateSnapshot,
  type CarTrackGameStateSnapshot
} from './gameStateSnapshot'
import type {
  RacingWorldGameStatePlayer,
  RacingWorldPlayer
} from './worldPlayers'

type StateUpdater<TState> = (value: TState | ((previous: TState) => TState)) => void

interface CarTrackGameStateSocketLike<Player extends RacingWorldGameStatePlayer, Item> {
  on(event: 'gameState', listener: (payload: CarTrackGameStateSnapshot<Player, Item>) => void): void
}

interface CurrentPlayerMatcherContext {
  socketId?: string | null
  identityKey?: string | null
  ordinalAddress?: string | null
}

interface GameStateLogContext<Player extends RacingWorldGameStatePlayer, Item> extends CurrentPlayerMatcherContext {
  state: CarTrackGameStateSnapshot<Player, Item>
}

interface RenderedPlayersLogContext<Player extends RacingWorldGameStatePlayer> {
  previousRenderedPlayers: RacingWorldPlayer[]
  renderedPlayers: RacingWorldPlayer[]
  currentPlayerInSnapshot: Player | undefined
}

export interface RegisterCarTrackGameStateSocketListenerOptions<Player extends RacingWorldGameStatePlayer, Item> {
  socket: CarTrackGameStateSocketLike<Player, Item>
  defaultTrackName: string
  getSocketId: () => string | undefined
  getIdentityKey: () => string | null | undefined
  getOrdinalAddress?: () => string | null | undefined
  getCurrentTrackName: () => string | null | undefined
  getPreviousCurrentPlayers: () => Player[] | undefined
  getPreviousRenderedPlayers: () => RacingWorldPlayer[]
  getFallbackColor: (index: number) => string
  setGameState: StateUpdater<CarTrackGameStateSnapshot<Player, Item> | null>
  setItems: (items: Item[]) => void
  setOtherPlayers: StateUpdater<RacingWorldPlayer[]>
  setHasJoined: (hasJoined: boolean) => void
  setHasJoinedRef: (hasJoined: boolean) => void
  getHasJoined: () => boolean
  defaultPosition?: [number, number, number]
  includeSpeed?: boolean
  isCurrentPlayer?: (player: Player, context: CurrentPlayerMatcherContext) => boolean
  logBeforeSnapshot?: (context: GameStateLogContext<Player, Item>) => void
  logAfterSnapshot?: (context: RenderedPlayersLogContext<Player>) => void
  scheduleFrame?: (callback: () => void) => void
}

const scheduleAnimationFrame = (callback: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback)
    return
  }

  callback()
}

export const registerCarTrackGameStateSocketListener = <
  Player extends RacingWorldGameStatePlayer,
  Item = unknown
>({
  socket,
  defaultTrackName,
  getSocketId,
  getIdentityKey,
  getOrdinalAddress,
  getCurrentTrackName,
  getPreviousCurrentPlayers,
  getPreviousRenderedPlayers,
  getFallbackColor,
  setGameState,
  setItems,
  setOtherPlayers,
  setHasJoined,
  setHasJoinedRef,
  getHasJoined,
  defaultPosition,
  includeSpeed,
  isCurrentPlayer,
  logBeforeSnapshot,
  logAfterSnapshot,
  scheduleFrame = scheduleAnimationFrame
}: RegisterCarTrackGameStateSocketListenerOptions<Player, Item>): void => {
  socket.on('gameState', state => {
    scheduleFrame(() => {
      const socketId = getSocketId()
      const identityKey = getIdentityKey()
      const ordinalAddress = getOrdinalAddress?.()
      const previousRenderedPlayers = getPreviousRenderedPlayers()

      logBeforeSnapshot?.({ state, socketId, identityKey, ordinalAddress })

      const snapshot = applyCarTrackGameStateSnapshot({
        state,
        previousCurrentPlayers: getPreviousCurrentPlayers(),
        previousRenderedPlayers,
        socketId,
        identityKey,
        ordinalAddress,
        currentTrackName: getCurrentTrackName(),
        defaultTrackName,
        defaultPosition,
        includeSpeed,
        getFallbackColor,
        isCurrentPlayer: isCurrentPlayer
          ? player => isCurrentPlayer(player, { socketId, identityKey, ordinalAddress })
          : undefined
      })

      setGameState(snapshot.gameState)

      if (state.items) {
        setItems(state.items)
      }

      logAfterSnapshot?.({
        previousRenderedPlayers,
        renderedPlayers: snapshot.renderedPlayers,
        currentPlayerInSnapshot: snapshot.currentPlayerInSnapshot
      })

      setOtherPlayers(snapshot.renderedPlayers)

      if (snapshot.currentPlayerInSnapshot && !getHasJoined()) {
        console.log(`🔄 Player ${socketId} (${snapshot.currentPlayerInSnapshot.name}) found in gameState but hasJoined is false. Setting hasJoined to true.`)
        setHasJoined(true)
        setHasJoinedRef(true)
      }
    })
  })
}
