import type { RacingWorldPlayer } from './worldPlayers'

export interface GenerateFakeRemotePlayersOptions {
  count: number
  trackName: string
  center?: { x: number; z: number }
  radius?: number
  y?: number
  elapsedSeconds?: number
  speedScale?: number
  getFallbackColor: (index: number) => string
}

export const parseFakeRemotePlayerCount = (value: string | null | undefined): number => {
  if (!value) return 0
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(parsed, 100)
}

export const parseFakeRemotePlayerSpeedScale = (value: string | null | undefined): number => {
  if (!value) return 1
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.min(parsed, 8)
}

export const generateFakeRemotePlayers = ({
  count,
  trackName,
  center = { x: 0, z: 0 },
  radius = 35,
  y = 0.1,
  elapsedSeconds = 0,
  speedScale = 1,
  getFallbackColor
}: GenerateFakeRemotePlayersOptions): RacingWorldPlayer[] => {
  const clampedCount = Math.max(0, Math.min(Math.floor(count), 100))
  if (clampedCount === 0) return []

  const players: RacingWorldPlayer[] = []

  for (let index = 0; index < clampedCount; index++) {
    const ring = Math.floor(index / 12)
    const ringIndex = index % 12
    const movementDirection = index % 2 === 0 ? 1 : -1
    const angularSpeed = (0.08 + ring * 0.018 + (index % 5) * 0.004) * speedScale * movementDirection
    const angle = (ringIndex / 12) * Math.PI * 2 + ring * 0.37 + elapsedSeconds * angularSpeed
    const distance = radius + ring * 24
    const x = center.x + Math.cos(angle) * distance
    const z = center.z + Math.sin(angle) * distance
    const color = getFallbackColor(index)

    players.push({
      id: `fake-${trackName.toLowerCase().replace(/\s+/g, '-')}-${index + 1}`,
      name: `Fake ${index + 1}`,
      position: [x, y, z],
      rotation: [0, -angle + Math.PI / 2, 0],
      color,
      carColor: color,
      isWalking: true,
      speed: (8 + (index % 5)) * speedScale,
      chatMessage: index < 3 ? `Load ${clampedCount}` : undefined,
      chatTimestamp: index < 3 ? 1 : undefined
    })
  }

  return players
}
