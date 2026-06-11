import type {
  LocalRemotePlayerCullingPosition,
  RacingQualityPreset,
  RemotePlayerWithTuplePosition
} from '../performance/qualitySettings'
import { getRacingQualityPreset } from '../performance/qualitySettings'

export type RemotePlayerLodTier = 'near' | 'mid'

export interface RemotePlayerLodEntry<TPlayer extends RemotePlayerWithTuplePosition> {
  player: TPlayer
  tier: RemotePlayerLodTier
  distanceSq: number
  sourceIndex: number
}

export interface RemotePlayerLodClassifyOptions {
  previousVisiblePlayerIds?: readonly string[]
  previousLodTiersById?: ReadonlyMap<string, RemotePlayerLodTier>
  retentionDistanceScale?: number
}

interface RemotePlayerLodBudget {
  nearMaxVisible: number
  nearDistance: number
}

const REMOTE_PLAYER_LOD_BUDGETS: Record<RacingQualityPreset['id'], RemotePlayerLodBudget> = {
  low: {
    nearMaxVisible: 4,
    nearDistance: 75
  },
  medium: {
    nearMaxVisible: 8,
    nearDistance: 120
  },
  high: {
    nearMaxVisible: 12,
    nearDistance: 160
  }
}

export const classifyRemotePlayersForLod = <TPlayer extends RemotePlayerWithTuplePosition & { id: string }>(
  players: readonly TPlayer[],
  localPosition: LocalRemotePlayerCullingPosition | null | undefined,
  preset: RacingQualityPreset = getRacingQualityPreset(),
  options: RemotePlayerLodClassifyOptions = {}
): RemotePlayerLodEntry<TPlayer>[] => {
  const maxVisible = preset.remotePlayers.maxVisible
  if (!Number.isFinite(maxVisible) || maxVisible <= 0) {
    return []
  }

  const lodBudget = REMOTE_PLAYER_LOD_BUDGETS[preset.id]
  const nearDistanceSq = lodBudget.nearDistance * lodBudget.nearDistance
  const nearEnterDistanceSq = nearDistanceSq * 0.9 * 0.9
  const nearExitDistanceSq = nearDistanceSq * 1.2 * 1.2

  const visiblePlayers = localPosition
    ? (() => {
      const maxDistanceSq = preset.remotePlayers.renderDistance * preset.remotePlayers.renderDistance
      const retentionDistanceScale = options.retentionDistanceScale ?? 1.15
      const retentionDistanceSq = maxDistanceSq * retentionDistanceScale * retentionDistanceScale
      const entries = players
        .map((player, index) => {
        const dx = player.position[0] - localPosition.x
        const dz = player.position[2] - localPosition.z
        return {
          player,
          sourceIndex: index,
          distanceSq: dx * dx + dz * dz
        }
      })

      const rankedCandidates = entries
        .filter(({ distanceSq }) => distanceSq <= maxDistanceSq)
      .sort((a, b) => a.distanceSq - b.distanceSq || a.sourceIndex - b.sourceIndex)

      if (!options.previousVisiblePlayerIds?.length) {
        return rankedCandidates.slice(0, maxVisible)
      }

      const entryById = new Map(entries.map(entry => [entry.player.id, entry]))
      const retainedEntries = options.previousVisiblePlayerIds
        .map(id => entryById.get(id))
        .filter((entry): entry is typeof entries[number] => Boolean(entry) && entry.distanceSq <= retentionDistanceSq)
        .slice(0, maxVisible)
      const retainedIds = new Set(retainedEntries.map(entry => entry.player.id))
      const filledEntries = [
        ...retainedEntries,
        ...rankedCandidates.filter(entry => !retainedIds.has(entry.player.id))
      ]
        .slice(0, maxVisible)
        .sort((a, b) => a.distanceSq - b.distanceSq || a.sourceIndex - b.sourceIndex)

      return filledEntries
    })()
    : players.slice(0, maxVisible).map((player, index) => ({
      player,
      sourceIndex: index,
      distanceSq: 0
    }))

  return visiblePlayers.map((entry, visibleIndex) => {
    const previousTier = options.previousLodTiersById?.get(entry.player.id)
    const computedTier = visibleIndex < lodBudget.nearMaxVisible && entry.distanceSq <= nearDistanceSq ? 'near' : 'mid'
    const isInsideNearBudget = visibleIndex < lodBudget.nearMaxVisible
    const tier = (() => {
      if (!previousTier || !isInsideNearBudget) {
        return computedTier
      }

      if (previousTier === 'near') {
        return entry.distanceSq <= nearExitDistanceSq ? 'near' : computedTier
      }

      if (computedTier === 'near' && entry.distanceSq > nearEnterDistanceSq) {
        return 'mid'
      }

      return computedTier
    })()

    return {
      ...entry,
      tier
    }
  })
}
