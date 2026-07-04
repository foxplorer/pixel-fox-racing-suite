import type {
  ScheduledRaceResult,
  ScheduledRaceSignup,
  ScheduledRaceWithRoster,
} from './scheduledRaceTypes.js'

export const MULTIPLAYER_RACE_INSCRIPTION_NAME = 'multiplayer race'

export interface MultiplayerRaceInscriptionEntrant {
  entrantId: string
  foxOutpoint: string
  foxOriginOutpoint: string
  foxName: string
  carColor?: string | null
  gridSlot: number
  stagedGridSlot?: number | null
  status: ScheduledRaceSignup['status']
}

export interface MultiplayerRaceInscriptionResult {
  entrantId: string
  finishPosition?: number | null
  totalTimeMs?: number | null
  lapTimesMs: number[]
  lapsCompleted: number
  status: ScheduledRaceResult['status']
  finishedAt: string
}

export interface MultiplayerRaceInscriptionPayload {
  recordVersion: 1
  inscriptionName: typeof MULTIPLAYER_RACE_INSCRIPTION_NAME
  raceId: string
  trackName: string
  startsAt: string
  finalizedAt: string
  lapsRequired: number
  entrants: MultiplayerRaceInscriptionEntrant[]
  results: MultiplayerRaceInscriptionResult[]
}

export interface MultiplayerRaceInscriptionMetadata extends Record<string, unknown> {
  app: string
  type: 'ord'
  name: typeof MULTIPLAYER_RACE_INSCRIPTION_NAME
  recordVersion: '1'
  raceId: string
  trackName: string
  startsAt: string
  finalizedAt: string
  lapsRequired: string
}

export interface DummyMultiplayerRaceInscription {
  txid: string | null
  status: 'success' | 'no_contest'
  message: string
  dummy: true
  outputIndex: 0 | null
  inscriptionName: typeof MULTIPLAYER_RACE_INSCRIPTION_NAME
  inscriptionPayload: MultiplayerRaceInscriptionPayload
}

export const buildMultiplayerRaceInscriptionPayload = (
  race: ScheduledRaceWithRoster,
  finalizedAt: string
): MultiplayerRaceInscriptionPayload => ({
  recordVersion: 1,
  inscriptionName: MULTIPLAYER_RACE_INSCRIPTION_NAME,
  raceId: race.id,
  trackName: race.trackName,
  startsAt: race.startsAt,
  finalizedAt,
  lapsRequired: race.lapsRequired,
  entrants: race.roster.map(signup => ({
    entrantId: signup.entrantId,
    foxOutpoint: signup.foxOutpoint,
    foxOriginOutpoint: signup.foxOriginOutpoint,
    foxName: signup.foxName,
    carColor: signup.carColor ?? null,
    gridSlot: signup.gridSlot,
    stagedGridSlot: signup.stagedGridSlot ?? null,
    status: signup.status,
  })),
  results: race.results.map(result => ({
    entrantId: result.entrantId,
    finishPosition: result.finishPosition ?? null,
    totalTimeMs: result.totalTimeMs ?? null,
    lapTimesMs: [...result.lapTimesMs],
    lapsCompleted: result.lapTimesMs.length,
    status: result.status,
    finishedAt: result.finishedAt,
  })),
})

export const buildMultiplayerRaceInscriptionMetadata = ({
  inscriptionApp,
  payload,
}: {
  inscriptionApp: string
  payload: MultiplayerRaceInscriptionPayload
}): MultiplayerRaceInscriptionMetadata => ({
  app: inscriptionApp,
  type: 'ord',
  name: MULTIPLAYER_RACE_INSCRIPTION_NAME,
  recordVersion: String(payload.recordVersion) as '1',
  raceId: payload.raceId,
  trackName: payload.trackName,
  startsAt: payload.startsAt,
  finalizedAt: payload.finalizedAt,
  lapsRequired: String(payload.lapsRequired),
})

export const buildDummyMultiplayerRaceInscription = ({
  txid,
  payload,
}: {
  txid: string | null
  payload: MultiplayerRaceInscriptionPayload
}): DummyMultiplayerRaceInscription => ({
  txid,
  status: txid ? 'success' : 'no_contest',
  message: txid
    ? 'Dummy multiplayer race inscription created successfully'
    : 'No contest recorded without a multiplayer race inscription tx',
  dummy: true,
  outputIndex: txid ? 0 : null,
  inscriptionName: MULTIPLAYER_RACE_INSCRIPTION_NAME,
  inscriptionPayload: payload,
})
