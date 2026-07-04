import type { RacingWorldPlayer } from '../multiplayer/worldPlayers'
import type { ScheduledRaceGridSlot } from './gridSlots'
import type { ScheduledRaceRoomEntrant, ScheduledRaceRoomSnapshot } from './scheduledRaceSocket'

export interface BuildScheduledRaceRoomPlayersInput {
  snapshot: ScheduledRaceRoomSnapshot | null
  activeRaceId?: string | null
  socketId?: string | null
  existingPlayers: RacingWorldPlayer[]
  gridSlots: ScheduledRaceGridSlot[]
  getFallbackColor: (index: number) => string
}

const vectorToTuple = (vector: { x: number; y: number; z: number }): [number, number, number] => [
  vector.x,
  vector.y,
  vector.z,
]

const buildScheduledRaceRoomPlayer = ({
  entrant,
  existingPlayer,
  gridSlot,
  index,
  getFallbackColor,
  roomStatus,
}: {
  entrant: ScheduledRaceRoomEntrant
  existingPlayer?: RacingWorldPlayer
  gridSlot?: ScheduledRaceGridSlot
  index: number
  getFallbackColor: (index: number) => string
  roomStatus: ScheduledRaceRoomSnapshot['status']
}): RacingWorldPlayer => {
  const fallbackColor = getFallbackColor(index)
  const shouldUseLivePose = roomStatus === 'racing'
  const gridPosition = gridSlot ? vectorToTuple(gridSlot.position) : undefined
  const gridRotation = gridSlot ? [0, gridSlot.rotationY, 0] as [number, number, number] : undefined
  const livePosition = existingPlayer?.position || (entrant.position ? vectorToTuple(entrant.position) : undefined)
  const liveRotation = existingPlayer?.rotation || (entrant.rotation ? vectorToTuple(entrant.rotation) : undefined)
  const position = shouldUseLivePose
    ? livePosition || gridPosition || [0, 0.1, 0]
    : gridPosition || livePosition || [0, 0.1, 0]
  const rotation = shouldUseLivePose
    ? liveRotation || gridRotation || [0, 0, 0]
    : gridRotation || liveRotation || [0, 0, 0]
  const speed = existingPlayer?.speed ?? entrant.speed ?? 0

  return {
    id: entrant.playerId,
    name: entrant.name || 'Fox',
    position,
    rotation,
    color: existingPlayer?.color || fallbackColor,
    carColor: entrant.carColor || existingPlayer?.carColor || fallbackColor,
    isWalking: speed > 0,
    speed,
    originOutpoint: existingPlayer?.originOutpoint || entrant.originOutpoint || entrant.entrantId || undefined,
    headlightsEnabled: entrant.headlightsEnabled ?? true,
    chatMessage: existingPlayer?.chatMessage,
    chatTimestamp: existingPlayer?.chatTimestamp,
  }
}

export const buildScheduledRaceRoomPlayers = ({
  snapshot,
  activeRaceId,
  socketId,
  existingPlayers,
  gridSlots,
  getFallbackColor,
}: BuildScheduledRaceRoomPlayersInput): RacingWorldPlayer[] => {
  if (!snapshot || !activeRaceId || snapshot.raceId !== activeRaceId) {
    return existingPlayers
  }

  const existingById = new Map(existingPlayers.map(player => [player.id, player]))
  const gridSlotByOrdinal = new Map(gridSlots.map(slot => [slot.slot, slot]))

  return (snapshot.entrants || [])
    .filter(entrant => entrant.playerId !== socketId)
    .sort((a, b) => a.gridSlot - b.gridSlot || a.joinedAt - b.joinedAt)
    .map((entrant, index) => buildScheduledRaceRoomPlayer({
      entrant,
      existingPlayer: existingById.get(entrant.playerId),
      gridSlot: gridSlotByOrdinal.get(entrant.gridSlot),
      index,
      getFallbackColor,
      roomStatus: snapshot.status,
    }))
}
