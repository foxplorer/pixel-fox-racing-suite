export interface RacingRenderStats {
  drawCalls: number
  triangles: number
  updatedAtMs: number
}

// Module-level snapshot so a probe inside the R3F Canvas can hand renderer
// stats to DOM overlays outside it without threading React state through the
// whole tree. One writer per frame, readers poll on their own cadence.
const stats: RacingRenderStats = {
  drawCalls: 0,
  triangles: 0,
  updatedAtMs: 0
}

export const RENDER_STATS_FRESH_MS = 2000

const defaultNowMs = (): number => (
  typeof performance !== 'undefined' ? performance.now() : Date.now()
)

export const reportRacingRenderStats = (
  drawCalls: number,
  triangles: number,
  nowMs: number = defaultNowMs()
): void => {
  stats.drawCalls = drawCalls
  stats.triangles = triangles
  stats.updatedAtMs = nowMs
}

export const getRacingRenderStats = (): Readonly<RacingRenderStats> => stats

export const areRacingRenderStatsFresh = (nowMs: number = defaultNowMs()): boolean => {
  return stats.updatedAtMs > 0 && nowMs - stats.updatedAtMs <= RENDER_STATS_FRESH_MS
}

export const formatTriangleCount = (triangles: number): string => {
  if (!Number.isFinite(triangles) || triangles <= 0) return '0'
  if (triangles >= 1_000_000) return `${(triangles / 1_000_000).toFixed(1)}M`
  if (triangles >= 1000) return `${Math.round(triangles / 1000)}k`
  return `${Math.round(triangles)}`
}
