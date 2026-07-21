export type RacingQualityPresetId = 'mobile' | 'low' | 'medium' | 'high'

export interface RacingQualityPreset {
  id: RacingQualityPresetId
  label: string
  renderer: {
    pixelRatioCap: number
    shadows: boolean
    antialias: boolean
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
  mobile: {
    id: 'mobile',
    label: 'Mobile',
    renderer: {
      // 0.6 device-pixel cap: on weak phones pixel fill is a real limiter
      // (a race at Low, which renders at dpr 1, was pinned to 6fps regardless
      // of draw-call count). This stays well below Low while leaving the track
      // less visibly upscaled than the earlier 0.45/0.5 mobile budget.
      pixelRatioCap: 0.6,
      shadows: false,
      antialias: false
    },
    remotePlayers: {
      // Multiplayer floor: show the local pack (up to 3 rivals) so a 6-player race
      // reads as a race and stays collidable — the culled list also drives collision.
      // Cost is bounded by nearMaxVisible=1 in remotePlayerLod (only the closest rival
      // gets the detailed VoxelFox car; the rest use the cheap fox-less mid model).
      // Users can still select a higher preset on capable phones.
      renderDistance: 90,
      maxVisible: 3
    },
    minimap: {
      updateEveryFrames: 15
    },
    scenery: {
      densityScale: 0.04,
      detailDistanceScale: 0.12
    }
  },
  low: {
    id: 'low',
    label: 'Low',
    renderer: {
      pixelRatioCap: 1,
      shadows: false,
      antialias: false
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
      shadows: true,
      antialias: true
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
      shadows: true,
      antialias: true
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
  return presetId === 'mobile' || presetId === 'low' || presetId === 'medium' || presetId === 'high'
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
  // Floor at 0.4: only the mobile budget goes this low, and weak phones are
  // often pixel-fill limited, so allow a genuinely lighter render there.
  const pixelRatioCap = Math.max(0.4, preset.renderer.pixelRatioCap)
  return {
    dpr: [Math.min(1, pixelRatioCap), pixelRatioCap],
    shadows: preset.renderer.shadows,
    antialias: preset.renderer.antialias
  }
}

export const getRacingMinimapQualitySettings = (
  preset: RacingQualityPreset = getRacingQualityPreset()
): RacingMinimapQualitySettings => ({
  updateEveryFrames: Math.max(1, Math.floor(preset.minimap.updateEveryFrames))
})
