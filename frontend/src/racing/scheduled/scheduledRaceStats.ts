import type { PixelRacingGameResult } from '../transactions/lapResult'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from '../transactions/ordinalLinks'
import type { ScheduledRace } from './scheduledRaceTypes'

const millisecondsToSeconds = (milliseconds: number): string => (milliseconds / 1000).toString()

export const buildScheduledRaceLapStatsRows = (race: ScheduledRace): PixelRacingGameResult[] => {
  const rosterByEntrantId = new Map(race.roster.map(signup => [signup.entrantId, signup]))

  return race.results.flatMap(result => {
    const signup = rosterByEntrantId.get(result.entrantId)
    if (!signup || result.lapTimesMs.length === 0) return []

    return result.lapTimesMs.map((lapTimeMs, lapIndex) => ({
      recordVersion: 2,
      owneraddress: '',
      outpoint: signup.foxOutpoint,
      originoutpoint: signup.foxOriginOutpoint,
      foxname: signup.foxName,
      laptime: millisecondsToSeconds(lapTimeMs),
      time: result.finishedAt,
      txid: `scheduled:${race.id}:${result.entrantId}:lap:${lapIndex + 1}`,
      foxinfolink: getOrdinalContentUrl(signup.foxOriginOutpoint),
      foximagelink: getOrdinalInscriptionUrl(signup.foxOutpoint),
      carcolor: signup.carColor ?? undefined,
      trackname: race.trackName,
      dummy: true,
      groupRaceId: race.id,
      groupRaceLapNumber: lapIndex + 1,
      groupRaceFinishPosition: result.finishPosition ?? null,
      groupRaceTotalTimeMs: result.totalTimeMs ?? null,
      groupRaceStatus: result.status,
    }))
  })
}

export const buildScheduledRaceFinalStatsRow = (race: ScheduledRace): PixelRacingGameResult | null => {
  const txid = race.finalInscription?.txid
  if (!txid) return null

  const resultsByEntrantId = new Map(race.results.map(result => [result.entrantId, result]))
  const firstFinishedResult = race.results.find(result => result.status === 'finished')
  const firstEntrant = firstFinishedResult
    ? race.roster.find(signup => signup.entrantId === firstFinishedResult.entrantId)
    : race.roster[0]
  const timestamp = Date.parse(race.finalInscription?.updatedAt || race.finalInscription?.createdAt || race.serverTime || '')
  const groupRaceEntrants = race.roster.map(signup => {
    const result = resultsByEntrantId.get(signup.entrantId)

    return {
      entrantId: signup.entrantId,
      foxName: signup.foxName,
      foxOutpoint: signup.foxOutpoint,
      foxOriginOutpoint: signup.foxOriginOutpoint,
      foxInfoLink: getOrdinalContentUrl(signup.foxOriginOutpoint),
      foxImageLink: getOrdinalInscriptionUrl(signup.foxOutpoint),
      ownerAddress: signup.ownerAddress,
      carColor: signup.carColor ?? null,
      gridSlot: signup.stagedGridSlot ?? signup.gridSlot ?? null,
      finishPosition: result?.finishPosition ?? null,
      totalTimeMs: result?.totalTimeMs ?? null,
      lapTimesMs: result?.lapTimesMs ?? [],
      status: result?.status ?? signup.status,
    }
  })

  return {
    recordVersion: 2,
    owneraddress: '',
    outpoint: firstEntrant?.foxOutpoint || '',
    originoutpoint: firstEntrant?.foxOriginOutpoint || '',
    foxname: firstEntrant?.foxName || 'Multiplayer Race',
    laptime: firstFinishedResult?.totalTimeMs ? millisecondsToSeconds(firstFinishedResult.totalTimeMs) : '0',
    time: Number.isFinite(timestamp) ? String(timestamp) : String(Date.parse(race.startsAt)),
    txid,
    foxinfolink: firstEntrant ? getOrdinalContentUrl(firstEntrant.foxOriginOutpoint) : '',
    foximagelink: firstEntrant ? getOrdinalInscriptionUrl(firstEntrant.foxOutpoint) : '',
    carcolor: firstEntrant?.carColor ?? undefined,
    trackname: race.trackName,
    dummy: race.finalInscription?.dummy === true,
    groupRaceId: race.id,
    groupRaceFinal: true,
    groupRaceEntrantCount: race.roster.length,
    groupRaceFinisherCount: race.results.filter(result => result.status === 'finished').length,
    groupRaceEntrants,
    groupRaceFinishPosition: firstFinishedResult?.finishPosition ?? null,
    groupRaceTotalTimeMs: firstFinishedResult?.totalTimeMs ?? null,
    groupRaceStatus: firstFinishedResult?.status,
    inscriptionName: race.finalInscription?.inscriptionName,
    outputIndex: race.finalInscription?.outputIndex ?? null,
  }
}
