export interface StartGateMarqueeModel {
  statusLine: string
  infoLines: string[]
}

export interface StartGateMarqueeEntrant {
  entrantId: string
  name: string
  gridSlot: number
  lapTimesMs: number[]
  finishOrder?: number
  disconnected?: boolean
}

export interface MultiplayerStartGateMarqueeInput {
  mode: 'multiplayer'
  gameStatus: string
  countdown: number
  lapsRequired: number
  entrants: StartGateMarqueeEntrant[]
}

export interface SoloStartGateMarqueeInput {
  mode: 'solo'
  gameStatus: string
  countdown: number
  lapTimesSeconds: number[]
  currentLapTimeSeconds?: number
  playersOnTrack?: number
  trackName?: string
}

export type StartGateMarqueeInput = MultiplayerStartGateMarqueeInput | SoloStartGateMarqueeInput

export const formatMarqueeClock = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export const formatMarqueeLapTime = (milliseconds: number): string => {
  const safeMs = Math.max(0, milliseconds)
  const minutes = Math.floor(safeMs / 60000)
  const seconds = (safeMs % 60000) / 1000
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`
}

const truncateName = (name: string, maxLength = 10): string => {
  const trimmed = (name || 'FOX').trim().toUpperCase()
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

interface MultiplayerStandingRow {
  entrant: StartGateMarqueeEntrant
  completedLaps: number
  totalTimeMs: number
  lastSplitMs?: number
  isFinished: boolean
  place: number
}

export const sortMarqueeStandings = (
  entrants: StartGateMarqueeEntrant[],
  lapsRequired: number
): MultiplayerStandingRow[] => {
  return entrants
    .map(entrant => {
      const requiredLapTimes = entrant.lapTimesMs.slice(0, lapsRequired)
      const completedLaps = requiredLapTimes.length
      return {
        entrant,
        completedLaps,
        totalTimeMs: requiredLapTimes.reduce((total, lapTime) => total + lapTime, 0),
        lastSplitMs: requiredLapTimes[completedLaps - 1],
        isFinished: completedLaps >= lapsRequired,
        place: 0
      }
    })
    .sort((a, b) => {
      if (a.isFinished !== b.isFinished) return a.isFinished ? -1 : 1
      if (a.isFinished && b.isFinished) {
        const aOrder = a.entrant.finishOrder ?? Number.POSITIVE_INFINITY
        const bOrder = b.entrant.finishOrder ?? Number.POSITIVE_INFINITY
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.totalTimeMs - b.totalTimeMs
      }
      if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps
      const aSplit = a.lastSplitMs ?? Number.POSITIVE_INFINITY
      const bSplit = b.lastSplitMs ?? Number.POSITIVE_INFINITY
      if (aSplit !== bSplit) return aSplit - bSplit
      return a.entrant.gridSlot - b.entrant.gridSlot
    })
    .map((row, index) => ({ ...row, place: index + 1 }))
}

// Marquee headline during the countdown. Note: a negative countdown means "staged, not started
// yet" (the ~5s window before the 3-2-1 begins) — it must NOT read as GO!. GO! is only countdown 0.
const countdownStatusLine = (countdown: number): string => {
  if (countdown > 3) return `RACE STARTS IN ${formatMarqueeClock(countdown)}`
  if (countdown > 0) return formatMarqueeClock(countdown)
  if (countdown === 0) return 'GO!'
  return 'GET READY'
}

const buildMultiplayerModel = (input: MultiplayerStartGateMarqueeInput): StartGateMarqueeModel => {
  const { gameStatus, countdown, lapsRequired, entrants } = input

  if (gameStatus === 'countdown') {
    const statusLine = countdownStatusLine(countdown)
    const stagedCount = entrants.length
    const stagedLabel = `${stagedCount} ${stagedCount === 1 ? 'FOX' : 'FOXES'} STAGED`
    const raceLabel = `${lapsRequired} LAPS`
    const infoLines = [
      stagedLabel,
      raceLabel,
      entrants.length > 1 ? 'GROUP START' : 'WAITING'
    ]
    return { statusLine, infoLines }
  }

  const standings = sortMarqueeStandings(entrants, lapsRequired)

  if (gameStatus === 'racing' || gameStatus === 'finished' || gameStatus === 'crashed') {
    const finishers = standings.filter(row => row.isFinished)
    const allFinished = finishers.length > 0 && finishers.length === standings.length
    const statusLine = allFinished
      ? 'COMPLETE'
      : (finishers.length > 0
        ? `${finishers.length} FINISHED`
        : `RACE ON`)
    const infoLines = standings.map(row => {
      const name = truncateName(row.entrant.name)
      if (row.isFinished) {
        return `P${row.place} ${name}  ${formatMarqueeLapTime(row.totalTimeMs)}`
      }
      if (row.entrant.disconnected) {
        return `P${row.place} ${name}  OUT`
      }
      return `P${row.place} ${name}  LAP ${Math.min(row.completedLaps + 1, lapsRequired)}/${lapsRequired}`
    })
    return { statusLine, infoLines }
  }

  return { statusLine: 'MULTIPLAYER RACE', infoLines: [] }
}

const secondsToMilliseconds = (seconds: number): number => Math.round(seconds * 1000)

const buildSoloModel = (input: SoloStartGateMarqueeInput): StartGateMarqueeModel => {
  const { gameStatus, countdown, lapTimesSeconds, currentLapTimeSeconds, playersOnTrack, trackName } = input

  const infoLines: string[] = []
  lapTimesSeconds.forEach((lapTime, index) => {
    infoLines.push(`LAP ${index + 1}  ${formatMarqueeLapTime(secondsToMilliseconds(lapTime))}`)
  })
  if (lapTimesSeconds.length > 1) {
    const bestLap = Math.min(...lapTimesSeconds)
    infoLines.push(`BEST  ${formatMarqueeLapTime(secondsToMilliseconds(bestLap))}`)
  }
  if (typeof playersOnTrack === 'number' && playersOnTrack > 1) {
    infoLines.push(`${playersOnTrack} FOXES ON TRACK`)
  }

  if (gameStatus === 'countdown') {
    const statusLine = countdownStatusLine(countdown)
    const preRaceLines = infoLines.length > 0
      ? infoLines
      : (trackName ? [`WELCOME TO ${trackName.toUpperCase()}`] : [])
    return { statusLine, infoLines: preRaceLines }
  }

  if (gameStatus === 'racing') {
    const lapNumber = lapTimesSeconds.length + 1
    const liveClock = typeof currentLapTimeSeconds === 'number'
      ? `  ${formatMarqueeClock(Math.floor(currentLapTimeSeconds))}`
      : ''
    return { statusLine: `LAP ${lapNumber}${liveClock}`, infoLines }
  }

  if (gameStatus === 'crashed') {
    return { statusLine: 'CRASHED', infoLines }
  }

  if (gameStatus === 'finished') {
    return { statusLine: 'FINISHED', infoLines }
  }

  return { statusLine: trackName ? trackName.toUpperCase() : 'PIXEL FOX RACING', infoLines }
}

export const buildStartGateMarqueeModel = (input: StartGateMarqueeInput): StartGateMarqueeModel => {
  return input.mode === 'multiplayer' ? buildMultiplayerModel(input) : buildSoloModel(input)
}
