import type { PixelRacingGameResult } from '../transactions/lapResult'

export const getPixelRacingRecordVersion = (
  mapData: Record<string, unknown>
): number => {
  const version = Number(mapData.recordVersion || 1)
  return Number.isFinite(version) && version >= 1 ? version : 1
}

export const getPixelRacingStandingKey = (
  game: PixelRacingGameResult
): string => game.recordVersion && game.recordVersion >= 2
  ? game.originoutpoint
  : game.owneraddress
