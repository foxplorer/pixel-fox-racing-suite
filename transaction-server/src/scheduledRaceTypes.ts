export const SCHEDULED_RACE_CAR_TRACKS = [
  'Australia',
  'San Luis',
  'Belgium',
  'United Kingdom',
  'Germany',
  'Volcanoes',
] as const

export type ScheduledRaceTrackName = (typeof SCHEDULED_RACE_CAR_TRACKS)[number]

export type ScheduledRaceStatus =
  | 'scheduled'
  | 'staging'
  | 'countdown'
  | 'racing'
  | 'finalizing'
  | 'settled'
  | 'cancelled'
  | 'no_contest'

export type ScheduledRaceSignupStatus =
  | 'signed_up'
  | 'staged'
  | 'withdrawn'
  | 'not_staged'
  | 'dnf'
  | 'finished'

export interface ScheduledRaceSignupInput {
  identityKey: string
  ownerAddress: string
  foxOutpoint: string
  foxOriginOutpoint: string
  foxName: string
  carColor?: string | null
}

export interface ScheduledRaceSignup {
  raceId: string
  entrantId: string
  identityKey: string
  ownerAddress: string
  foxOutpoint: string
  foxOriginOutpoint: string
  foxName: string
  carColor?: string | null
  gridSlot: number
  stagedGridSlot?: number | null
  status: ScheduledRaceSignupStatus
  signedUpAt: string
  stagedAt?: string | null
}

export interface ScheduledRaceResultInput {
  entrantId: string
  totalTimeMs: number
  lapTimesMs: number[]
}

export interface ScheduledRaceLapProgressInput {
  entrantId: string
  lapTimesMs: number[]
}

export interface ScheduledRaceResult {
  raceId: string
  entrantId: string
  finishPosition?: number | null
  totalTimeMs?: number | null
  lapTimesMs: number[]
  status: 'finished' | 'dnf'
  finishedAt: string
}

export interface ScheduledRaceFinalInscriptionPayload {
  raceId: string
  trackName: ScheduledRaceTrackName
  startsAt: string
  lapsRequired: number
  results: ScheduledRaceResult[]
  recipients: []
  finalizedAt: string
  inscriptionName?: string
  outputIndex?: number | null
  inscriptionPayload?: unknown
}

export interface ScheduledRaceFinalInscription {
  raceId: string
  txid?: string | null
  status: 'pending' | 'broadcasting' | 'broadcasted' | 'failed' | 'no_contest'
  dummy?: boolean
  inscriptionName?: string
  outputIndex?: number | null
  finalInscriptionPayload: ScheduledRaceFinalInscriptionPayload
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledRace {
  id: string
  trackName: ScheduledRaceTrackName
  startsAt: string
  status: ScheduledRaceStatus
  maxEntrants: number
  lapsRequired: number
  createdAt: string
  updatedAt: string
}

export interface ScheduledRaceWithRoster extends ScheduledRace {
  roster: ScheduledRaceSignup[]
  results: ScheduledRaceResult[]
  podium: ScheduledRaceResult[]
  finalInscription?: ScheduledRaceFinalInscription | null
  signupCount: number
  stagedCount: number
  openSlots: number
  serverTime: string
}

export interface ScheduledRaceListOptions {
  trackName?: string | null
  limit?: number
  nowMs?: number
}

export interface ScheduledRaceStore {
  listUpcoming(options?: ScheduledRaceListOptions): Promise<ScheduledRaceWithRoster[]>
  listCompleted(options?: ScheduledRaceListOptions): Promise<ScheduledRaceWithRoster[]>
  signUp(raceId: string, input: ScheduledRaceSignupInput, nowMs?: number): Promise<ScheduledRaceWithRoster>
  withdraw(raceId: string, entrantId: string, nowMs?: number): Promise<ScheduledRaceWithRoster>
  stage(raceId: string, entrantId: string, nowMs?: number): Promise<ScheduledRaceWithRoster>
  recordLapProgress(raceId: string, input: ScheduledRaceLapProgressInput, nowMs?: number): Promise<ScheduledRaceWithRoster>
  submitResult(raceId: string, input: ScheduledRaceResultInput, nowMs?: number): Promise<ScheduledRaceWithRoster>
  finalizeRace(raceId: string, nowMs?: number): Promise<ScheduledRaceWithRoster>
  createFinalInscription(raceId: string, nowMs?: number): Promise<ScheduledRaceWithRoster>
  settleRace(raceId: string, nowMs?: number): Promise<ScheduledRaceWithRoster>
  settleDueRaces?(nowMs?: number): Promise<ScheduledRaceWithRoster[]>
}

export class ScheduledRaceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400
  ) {
    super(message)
  }
}
