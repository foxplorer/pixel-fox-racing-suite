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

export interface ScheduledRaceResult {
  raceId: string
  entrantId: string
  finishPosition?: number | null
  totalTimeMs?: number | null
  lapTimesMs: number[]
  status: 'finished' | 'dnf'
  finishedAt: string
}

export interface ScheduledRaceFinalInscription {
  raceId: string
  txid?: string | null
  status: 'pending' | 'broadcasting' | 'broadcasted' | 'failed' | 'no_contest'
  dummy?: boolean
  inscriptionName?: string
  outputIndex?: number | null
  finalInscriptionPayload: {
    raceId: string
    trackName: string
    startsAt: string
    lapsRequired: number
    results: ScheduledRaceResult[]
    recipients: []
    finalizedAt: string
    inscriptionName?: string
    outputIndex?: number | null
    inscriptionPayload?: unknown
  }
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledRace {
  id: string
  trackName: string
  startsAt: string
  status: ScheduledRaceStatus
  maxEntrants: number
  lapsRequired: number
  roster: ScheduledRaceSignup[]
  results: ScheduledRaceResult[]
  podium: ScheduledRaceResult[]
  finalInscription?: ScheduledRaceFinalInscription | null
  signupCount: number
  stagedCount: number
  openSlots: number
  serverTime: string
}

export interface ScheduledRaceSignupInput {
  identityKey: string
  ownerAddress: string
  foxOutpoint: string
  foxOriginOutpoint: string
  foxName: string
  carColor?: string | null
}
