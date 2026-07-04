export interface ActiveScheduledRaceEntry {
  raceId: string
  entrantId: string
  lapsRequired: number
}

export interface ScheduledRaceFinishReport {
  raceId: string
  entrantId: string
  totalTimeMs: number
  lapTimesMs: number[]
}

export interface ScheduledRaceLapProgress {
  lapTimes: number[]
  finished: boolean
  finishReport?: ScheduledRaceFinishReport
}

export const secondsToMilliseconds = (seconds: number): number => Math.round(seconds * 1000)

export const buildScheduledRaceLapProgress = ({
  activeRace,
  previousLapTimes,
  completedLapTimeSeconds,
}: {
  activeRace: ActiveScheduledRaceEntry | null | undefined
  previousLapTimes: number[]
  completedLapTimeSeconds: number
}): ScheduledRaceLapProgress | null => {
  if (!activeRace) return null

  const lapsRequired = Math.max(1, Math.floor(activeRace.lapsRequired))
  const lapTimes = [...previousLapTimes, completedLapTimeSeconds]
  if (lapTimes.length < lapsRequired) {
    return { lapTimes, finished: false }
  }

  const requiredLapTimes = lapTimes.slice(0, lapsRequired)
  const lapTimesMs = requiredLapTimes.map(secondsToMilliseconds)
  return {
    lapTimes,
    finished: true,
    finishReport: {
      raceId: activeRace.raceId,
      entrantId: activeRace.entrantId,
      lapTimesMs,
      totalTimeMs: lapTimesMs.reduce((total, lapTimeMs) => total + lapTimeMs, 0),
    },
  }
}
