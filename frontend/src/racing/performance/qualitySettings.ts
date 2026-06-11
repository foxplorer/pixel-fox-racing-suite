export type RacingQualityPresetId = 'low' | 'medium' | 'high'

export interface RacingQualityPreset {
  id: RacingQualityPresetId
  label: string
  renderer: {
    pixelRatioCap: number
    shadows: boolean
  }
  remotePlayers: {
    renderDistance: number
    maxVisible: number
  }
  minimap: {
    updateEveryFrames: number
  }
  scenery: {
    densityScale: number
    detailDistanceScale: number
  }
}

export interface RemotePlayerWithTuplePosition {
  position: [number, number, number]
}

export interface LocalRemotePlayerCullingPosition {
  x: number
  z: number
}

export interface RacingCanvasQualitySettings {
  dpr: [number, number]
  shadows: boolean
  antialias: boolean
}

export interface RacingMinimapQualitySettings {
  updateEveryFrames: number
}

export const DEFAULT_RACING_QUALITY_PRESET_ID: RacingQualityPresetId = 'medium'

export const RACING_QUALITY_STORAGE_KEY = 'pixelFoxRacing.qualityPreset'

export const RACING_QUALITY_PRESETS: Record<RacingQualityPresetId, RacingQualityPreset> = {
  low: {
    id: 'low',
    label: 'Low',
    renderer: {
      pixelRatioCap: 1,
      shadows: false
    },
    remotePlayers: {
      renderDistance: 180,
      maxVisible: 8
    },
    minimap: {
      updateEveryFrames: 4
    },
    scenery: {
      densityScale: 0.55,
      detailDistanceScale: 0.65
    }
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    renderer: {
      pixelRatioCap: 1.5,
      shadows: true
    },
    remotePlayers: {
      renderDistance: 300,
      maxVisible: 16
    },
    minimap: {
      updateEveryFrames: 2
    },
    scenery: {
      densityScale: 0.8,
      detailDistanceScale: 0.85
    }
  },
  high: {
    id: 'high',
    label: 'High',
    renderer: {
      pixelRatioCap: 2,
      shadows: true
    },
    remotePlayers: {
      renderDistance: 600,
      maxVisible: 32
    },
    minimap: {
      updateEveryFrames: 1
    },
    scenery: {
      densityScale: 1,
      detailDistanceScale: 1
    }
  }
}

export const getRacingQualityPreset = (
  presetId: RacingQualityPresetId | null | undefined = DEFAULT_RACING_QUALITY_PRESET_ID
): RacingQualityPreset => {
  return RACING_QUALITY_PRESETS[presetId ?? DEFAULT_RACING_QUALITY_PRESET_ID] ?? RACING_QUALITY_PRESETS[DEFAULT_RACING_QUALITY_PRESET_ID]
}

export const resolveRacingQualityPresetId = (
  presetId: string | null | undefined
): RacingQualityPresetId => {
  return presetId === 'low' || presetId === 'medium' || presetId === 'high'
    ? presetId
    : DEFAULT_RACING_QUALITY_PRESET_ID
}

export const filterRemotePlayersForQuality = <TPlayer extends RemotePlayerWithTuplePosition>(
  players: readonly TPlayer[],
  localPosition: LocalRemotePlayerCullingPosition | null | undefined,
  preset: RacingQualityPreset = getRacingQualityPreset()
): TPlayer[] => {
  if (!Number.isFinite(preset.remotePlayers.maxVisible) || preset.remotePlayers.maxVisible <= 0) {
    return []
  }

  if (!localPosition) {
    return players.slice(0, preset.remotePlayers.maxVisible)
  }

  const maxDistanceSq = preset.remotePlayers.renderDistance * preset.remotePlayers.renderDistance

  return players
    .map((player, index) => {
      const dx = player.position[0] - localPosition.x
      const dz = player.position[2] - localPosition.z
      return {
        player,
        index,
        distanceSq: dx * dx + dz * dz
      }
    })
    .filter(({ distanceSq }) => distanceSq <= maxDistanceSq)
    .sort((a, b) => a.distanceSq - b.distanceSq || a.index - b.index)
    .slice(0, preset.remotePlayers.maxVisible)
    .map(({ player }) => player)
}

export const getRacingCanvasQualitySettings = (
  preset: RacingQualityPreset = getRacingQualityPreset()
): RacingCanvasQualitySettings => {
  return {
    dpr: [1, preset.renderer.pixelRatioCap],
    shadows: preset.renderer.shadows,
    antialias: preset.id !== 'low'
  }
}

export const getRacingMinimapQualitySettings = (
  preset: RacingQualityPreset = getRacingQualityPreset()
): RacingMinimapQualitySettings => ({
  updateEveryFrames: Math.max(1, Math.floor(preset.minimap.updateEveryFrames))
})
