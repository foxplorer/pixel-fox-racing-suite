// Snowmobile game types

export type GameStatus = 'idle' | 'showroom' | 'loading' | 'countdown' | 'racing' | 'crashed' | 'finished'

export type GateColor = 'red' | 'blue'

export interface Gate {
  id: string
  position: { x: number; y: number; z: number }
  color: GateColor
  passed: boolean
  side: 'left' | 'right' // Which side to pass on
}

export interface SlalomCourse {
  gates: Gate[]
  startPosition: { x: number; y: number; z: number }
  finishPosition: { x: number; y: number; z: number }
}

export interface PlayerState {
  id: string
  identityKey?: string
  name: string
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number } // x = pitch/tilt, y = yaw, z = roll/lean
  speed: number
  color: string
  originOutpoint?: string // For fox texture
  gameStatus?: 'idle' | 'loading' | 'racing'
  chatMessage?: string
  chatTimestamp?: number
}

export interface GameState {
  players: PlayerState[]
  items: GameItem[]
}

export interface GameItem {
  id: string
  type: 'powerup' | 'obstacle'
  position: { x: number; y: number; z: number }
}

export interface SnowmobileGameResult {
  playerName: string
  foxName?: string
  foxOriginOutpoint?: string
  ordinalAddress?: string
  courseTime: number // Time in seconds
  gatesPassed: number
  totalGates: number
  penalties: number // Missed gates penalty
  txid?: string
  timestamp: number
}
