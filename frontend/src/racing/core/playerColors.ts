export const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F'
] as const

export type PlayerColor = typeof PLAYER_COLORS[number]

export const DEFAULT_PLAYER_COLOR: PlayerColor = PLAYER_COLORS[0]

export const getPlayerColorByIndex = (index: number): PlayerColor => {
  const safeIndex = ((index % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length
  return PLAYER_COLORS[safeIndex]
}
