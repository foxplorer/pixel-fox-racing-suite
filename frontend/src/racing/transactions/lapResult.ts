import { isSubmittableTrackDisplayName, SUBMITTABLE_TRACK_DISPLAY_NAMES } from '../tracks/trackDisplayNames'
import { getOrdinalContentUrl, getOrdinalInscriptionUrl } from './ordinalLinks'
import { normalizeOrdinalOutpoint } from './ordinalOutpoint'

export interface PixelRacingGameResult {
  recordVersion?: number
  owneraddress: string
  outpoint: string
  originoutpoint: string
  foxname: string
  laptime: string
  time: string
  txid: string
  foxinfolink: string
  foximagelink: string
  carcolor?: string
  trackname?: string
  itemType?: string
  itemImage?: string
  signer?: string
  dummy?: boolean
}

export interface LapPlayerIdentity {
  ownerAddress: string
  outpoint: string
  originOutpoint: string
  foxName: string
}

export type LapPlayerIdentityField = keyof LapPlayerIdentity

export type PartialLapPlayerIdentity = {
  [Field in LapPlayerIdentityField]?: string | null
}

export interface LapSubmissionCandidateInput {
  gameStatus: string
  trackName: string
  lapTimeSeconds: number
  identity: PartialLapPlayerIdentity
}

export type LapSubmissionCandidateValidation =
  | { valid: true, identity: LapPlayerIdentity }
  | { valid: false, message: string }

export interface LapResultInput {
  identity: LapPlayerIdentity
  lapTimeSeconds: number
  timestampMs: number
  txid?: string
  carColor?: string
  trackName?: string
  dummy?: boolean
}

export interface PixelRacingLapInscriptionPayload {
  recordVersion: 2
  playeroutpoint: string
  playeroriginoutpoint: string
  playerfoxname: string
  laptime: string
  time: string
  carcolor?: string
  trackname: string
}

export interface PixelRacingSharedLapTransactionPayload {
  txid: string
  score: number
  time: string
  foxOutpoint: string
  foxName: string
  originOutpoint: string
  ownerAddress: string
  trackName: string
  dummy: boolean
}

export interface PixelRacingIncomingTransactionData {
  recordVersion?: number
  txid?: string
  ownerAddress?: string
  foxOutpoint?: string
  originOutpoint?: string
  foxName?: string
  score?: number | string
  time?: string
  trackName?: string
  itemType?: string
  itemImage?: string
  dummy?: boolean
}

export const MIN_SUBMITTABLE_LAP_TIME_SECONDS = 40
export const MAX_SUBMITTABLE_LAP_TIME_SECONDS = 600

export const getMissingLapPlayerIdentityFields = (identity: PartialLapPlayerIdentity): LapPlayerIdentityField[] => {
  const requiredFields: LapPlayerIdentityField[] = ['ownerAddress', 'outpoint', 'originOutpoint', 'foxName']

  return requiredFields.filter(field => !identity[field])
}

export const buildLapPlayerIdentity = (identity: PartialLapPlayerIdentity): LapPlayerIdentity | null => {
  if (getMissingLapPlayerIdentityFields(identity).length > 0) {
    return null
  }

  return {
    ownerAddress: identity.ownerAddress as string,
    outpoint: normalizeOrdinalOutpoint(identity.outpoint),
    originOutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
    foxName: identity.foxName as string
  }
}

export const validateSubmittableLapTime = (
  lapTimeSeconds: number,
  minSeconds = MIN_SUBMITTABLE_LAP_TIME_SECONDS,
  maxSeconds = MAX_SUBMITTABLE_LAP_TIME_SECONDS
): { valid: true } | { valid: false, reason: 'too-fast' | 'too-slow' | 'non-finite' } => {
  if (!Number.isFinite(lapTimeSeconds)) {
    return { valid: false, reason: 'non-finite' }
  }

  if (lapTimeSeconds < minSeconds) {
    return { valid: false, reason: 'too-fast' }
  }

  if (lapTimeSeconds > maxSeconds) {
    return { valid: false, reason: 'too-slow' }
  }

  return { valid: true }
}

export const validateLapSubmissionCandidate = ({
  gameStatus,
  trackName,
  lapTimeSeconds,
  identity
}: LapSubmissionCandidateInput): LapSubmissionCandidateValidation => {
  if (gameStatus !== 'racing') {
    return { valid: false, message: `game status is "${gameStatus}", must be "racing"` }
  }

  if (!trackName || trackName.trim() === '') {
    return { valid: false, message: 'track name is missing or empty' }
  }

  if (!isSubmittableTrackDisplayName(trackName)) {
    return {
      valid: false,
      message: `track name "${trackName}" is not a valid track. Valid tracks: ${SUBMITTABLE_TRACK_DISPLAY_NAMES.join(', ')}`
    }
  }

  const lapTimeValidation = validateSubmittableLapTime(lapTimeSeconds)
  if (!lapTimeValidation.valid && lapTimeValidation.reason === 'too-fast') {
    return {
      valid: false,
      message: `lap time ${lapTimeSeconds.toFixed(3)}s is too fast (minimum: ${MIN_SUBMITTABLE_LAP_TIME_SECONDS}s)`
    }
  }

  if (!lapTimeValidation.valid && lapTimeValidation.reason === 'too-slow') {
    return {
      valid: false,
      message: `lap time ${lapTimeSeconds.toFixed(3)}s is too slow (maximum: ${MAX_SUBMITTABLE_LAP_TIME_SECONDS}s)`
    }
  }

  if (!lapTimeValidation.valid) {
    return { valid: false, message: `lap time ${lapTimeSeconds} is not finite` }
  }

  const lapIdentity = buildLapPlayerIdentity(identity)
  if (!lapIdentity) {
    return { valid: false, message: `missing ${getMissingLapPlayerIdentityFields(identity).join(', ')}` }
  }

  return { valid: true, identity: lapIdentity }
}

export const buildPixelRacingGameResult = ({
  identity,
  lapTimeSeconds,
  timestampMs,
  txid = '',
  carColor,
  trackName,
  dummy
}: LapResultInput): PixelRacingGameResult => ({
  owneraddress: identity.ownerAddress,
  outpoint: normalizeOrdinalOutpoint(identity.outpoint),
  originoutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
  foxname: identity.foxName,
  laptime: lapTimeSeconds.toString(),
  time: timestampMs.toString(),
  txid,
  foxinfolink: getOrdinalContentUrl(identity.originOutpoint),
  foximagelink: getOrdinalInscriptionUrl(identity.outpoint),
  carcolor: carColor,
  trackname: trackName,
  dummy
})

export const buildPixelRacingLapInscriptionPayload = ({
  identity,
  lapTimeSeconds,
  timestampMs,
  carColor,
  trackName
}: Omit<LapResultInput, 'txid' | 'dummy'> & { trackName: string }): PixelRacingLapInscriptionPayload => ({
  recordVersion: 2,
  playeroutpoint: normalizeOrdinalOutpoint(identity.outpoint),
  playeroriginoutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
  playerfoxname: identity.foxName,
  laptime: lapTimeSeconds.toString(),
  time: timestampMs.toString(),
  carcolor: carColor,
  trackname: trackName
})

export const buildPixelRacingSharedLapTransactionPayload = ({
  identity,
  lapTimeSeconds,
  timestampMs,
  txid,
  trackName,
  dummy
}: Required<Pick<LapResultInput, 'identity' | 'lapTimeSeconds' | 'timestampMs' | 'txid' | 'trackName' | 'dummy'>>): PixelRacingSharedLapTransactionPayload => ({
  txid,
  score: lapTimeSeconds,
  time: timestampMs.toString(),
  foxOutpoint: normalizeOrdinalOutpoint(identity.outpoint),
  foxName: identity.foxName,
  originOutpoint: normalizeOrdinalOutpoint(identity.originOutpoint),
  ownerAddress: identity.ownerAddress,
  trackName,
  dummy
})

export const buildPixelRacingActivityFromTransaction = (
  data: PixelRacingIncomingTransactionData,
  defaultTrackName: string,
  fallbackTimestampMs: number
): PixelRacingGameResult => ({
  ...(data.recordVersion !== undefined ? { recordVersion: data.recordVersion } : {}),
  owneraddress: data.ownerAddress || '',
  outpoint: normalizeOrdinalOutpoint(data.foxOutpoint),
  originoutpoint: normalizeOrdinalOutpoint(data.originOutpoint),
  foxname: data.foxName || 'Unknown Fox',
  laptime: (data.score || 0).toString(),
  time: data.time || fallbackTimestampMs.toString(),
  txid: data.txid || '',
  foxinfolink: getOrdinalContentUrl(data.originOutpoint),
  foximagelink: getOrdinalInscriptionUrl(data.foxOutpoint),
  trackname: data.trackName || defaultTrackName,
  itemType: data.itemType,
  itemImage: data.itemImage,
  dummy: data.dummy === true
})
