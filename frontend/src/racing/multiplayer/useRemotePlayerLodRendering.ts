import { useEffect, useMemo, useRef } from 'react'
import type { LocalRemotePlayerCullingPosition, RacingQualityPreset } from '../performance/qualitySettings'
import {
  classifyRemotePlayersForLod,
  type RemotePlayerLodEntry,
  type RemotePlayerLodTier
} from './remotePlayerLod'
import type { RacingWorldPlayer } from './worldPlayers'

export interface UseRemotePlayerLodRenderingOptions<TPlayer extends RacingWorldPlayer> {
  players: readonly TPlayer[]
  localPosition: LocalRemotePlayerCullingPosition | null | undefined
  qualityPreset: RacingQualityPreset
  getContentUrl: (outpoint?: string | null) => string | undefined
  getFallbackOutpoint?: (player: TPlayer, tier: RemotePlayerLodTier) => string | null | undefined
}

export interface BuildRenderableRemotePlayerOptions<TPlayer extends RacingWorldPlayer> {
  entry: RemotePlayerLodEntry<TPlayer>
  getContentUrl: (outpoint?: string | null) => string | undefined
  getFallbackOutpoint?: (player: TPlayer, tier: RemotePlayerLodTier) => string | null | undefined
}

export const buildRenderableRemotePlayer = <TPlayer extends RacingWorldPlayer>({
  entry,
  getContentUrl,
  getFallbackOutpoint
}: BuildRenderableRemotePlayerOptions<TPlayer>): RacingWorldPlayer => {
  const { player, tier } = entry
  const fallbackOutpoint = getFallbackOutpoint?.(player, tier)

  return {
    ...player,
    remoteLodTier: tier,
    foxTextureUrl: tier === 'near' ? getContentUrl(player.originOutpoint || fallbackOutpoint) : undefined,
    chatMessage: tier === 'near' ? player.chatMessage : undefined,
    chatTimestamp: tier === 'near' ? player.chatTimestamp : undefined
  }
}

export const useRemotePlayerLodRendering = <TPlayer extends RacingWorldPlayer>({
  players,
  localPosition,
  qualityPreset,
  getContentUrl,
  getFallbackOutpoint
}: UseRemotePlayerLodRenderingOptions<TPlayer>): RacingWorldPlayer[] => {
  const previousVisibleRemotePlayerIdsRef = useRef<string[]>([])
  const previousRemoteLodTiersByIdRef = useRef<Map<string, RemotePlayerLodTier>>(new Map())

  const visibleRemotePlayerLodEntries = useMemo(() => classifyRemotePlayersForLod(
    players,
    localPosition,
    qualityPreset,
    {
      previousVisiblePlayerIds: previousVisibleRemotePlayerIdsRef.current,
      previousLodTiersById: previousRemoteLodTiersByIdRef.current
    }
  ), [players, localPosition, qualityPreset])

  useEffect(() => {
    previousVisibleRemotePlayerIdsRef.current = visibleRemotePlayerLodEntries.map(entry => entry.player.id)
    previousRemoteLodTiersByIdRef.current = new Map(visibleRemotePlayerLodEntries.map(entry => [
      entry.player.id,
      entry.tier
    ]))
  }, [visibleRemotePlayerLodEntries])

  return useMemo(() => visibleRemotePlayerLodEntries.map(entry => buildRenderableRemotePlayer({
    entry,
    getContentUrl,
    getFallbackOutpoint
  })), [visibleRemotePlayerLodEntries, getContentUrl, getFallbackOutpoint])
}
