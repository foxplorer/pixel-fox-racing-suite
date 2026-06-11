import {
  buildPixelRacingGameResult,
  buildPixelRacingLapInscriptionPayload,
  buildPixelRacingSharedLapTransactionPayload,
  validateLapSubmissionCandidate,
  type LapPlayerIdentity,
  type PartialLapPlayerIdentity,
  type PixelRacingGameResult,
  type PixelRacingLapInscriptionPayload,
  type PixelRacingSharedLapTransactionPayload
} from './lapResult'

export interface PixelRacingLapSubmissionResult {
  txid: string
  dummy: boolean
}

export interface PixelRacingLapCompletionSubmissionInput {
  transactionServerUrl: string
  identity: LapPlayerIdentity
  lapTimeSeconds: number
  timestampMs: number
  carColor?: string
  trackName: string
  fetcher?: FetchLike
}

export interface PixelRacingLapCompletionSubmission {
  txid: string
  dummy: boolean
  inscriptionPayload: PixelRacingLapInscriptionPayload
  activity: PixelRacingGameResult
  sharedTransactionPayload: PixelRacingSharedLapTransactionPayload
}

export interface PixelRacingLapCompletionSubmissionHandlers {
  lapIndex?: number
  updateLapResultTxid?: (txid: string) => void
  setLapTxid?: (lapIndex: number, txid: string) => void
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  emitSharedLapTransaction?: (payload: PixelRacingSharedLapTransactionPayload) => void
}

export interface PixelRacingLapCompletionWorkflowInput {
  lapTimeSeconds: number
  gameStatus: string
  trackName: string
  identity: PartialLapPlayerIdentity
  carColor?: string
  distanceTraveled?: number
  transactionServerUrl: string
  testingMode?: boolean
  isSubmittingLap: () => boolean
  setSubmittingLap: (isSubmitting: boolean) => void
  setLapSubmissionError: (error: string | null) => void
  appendLapTime: (lapTimeSeconds: number) => number
  setLapTxid: (lapIndex: number, txid: string) => void
  setLapTime: (lapTimeSeconds: number) => void
  onLatestActivityChange?: (activity: PixelRacingGameResult) => void
  emitSharedLapTransaction?: (payload: PixelRacingSharedLapTransactionPayload) => void
  fetcher?: FetchLike
}

export type PixelRacingLapCompletionWorkflowResult =
  | { status: 'already-submitting' }
  | { status: 'invalid'; message: string }
  | { status: 'testing-skipped'; lapIndex: number; lapResult: PixelRacingGameResult }
  | { status: 'submitted'; lapIndex: number; lapResult: PixelRacingGameResult; submission: PixelRacingLapCompletionSubmission }
  | { status: 'failed'; lapIndex: number; lapResult: PixelRacingGameResult; error: string }

interface PixelRacingLapSubmissionResponse {
  txid?: string
  dummy?: boolean
  error?: string
  message?: string
}

type FetchLike = (
  input: string,
  init: {
    method: 'POST'
    headers: { 'Content-Type': 'application/json' }
    body: string
  }
) => Promise<{ json: () => Promise<PixelRacingLapSubmissionResponse> }>

export const submitPixelRacingLapResult = async (
  transactionServerUrl: string,
  payload: PixelRacingLapInscriptionPayload,
  fetcher: FetchLike = fetch
): Promise<PixelRacingLapSubmissionResult> => {
  const response = await fetcher(`${transactionServerUrl}/createpixelracing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const result = await response.json()

  if (result.error) {
    throw new Error(result.message || result.error || 'Failed to create lap inscription')
  }

  if (!result.txid) {
    throw new Error('No transaction ID received from server')
  }

  return {
    txid: result.txid,
    dummy: result.dummy === true
  }
}

export const submitPixelRacingLapCompletion = async ({
  transactionServerUrl,
  identity,
  lapTimeSeconds,
  timestampMs,
  carColor,
  trackName,
  fetcher
}: PixelRacingLapCompletionSubmissionInput): Promise<PixelRacingLapCompletionSubmission> => {
  const inscriptionPayload = buildPixelRacingLapInscriptionPayload({
    identity,
    lapTimeSeconds,
    timestampMs,
    carColor,
    trackName
  })
  const result = await submitPixelRacingLapResult(transactionServerUrl, inscriptionPayload, fetcher)

  return {
    txid: result.txid,
    dummy: result.dummy,
    inscriptionPayload,
    activity: buildPixelRacingGameResult({
      identity,
      lapTimeSeconds,
      timestampMs,
      txid: result.txid,
      carColor,
      trackName,
      dummy: result.dummy
    }),
    sharedTransactionPayload: buildPixelRacingSharedLapTransactionPayload({
      identity,
      lapTimeSeconds,
      timestampMs,
      txid: result.txid,
      trackName,
      dummy: result.dummy
    })
  }
}

export const applyPixelRacingLapCompletionSubmission = (
  submission: PixelRacingLapCompletionSubmission,
  handlers: PixelRacingLapCompletionSubmissionHandlers
): void => {
  handlers.updateLapResultTxid?.(submission.txid)

  if (handlers.lapIndex !== undefined && handlers.lapIndex >= 0) {
    handlers.setLapTxid?.(handlers.lapIndex, submission.txid)
  }

  handlers.onLatestActivityChange?.(submission.activity)
  handlers.emitSharedLapTransaction?.(submission.sharedTransactionPayload)
}

export const runPixelRacingLapCompletionWorkflow = async ({
  lapTimeSeconds,
  gameStatus,
  trackName,
  identity,
  carColor,
  distanceTraveled,
  transactionServerUrl,
  testingMode = false,
  isSubmittingLap,
  setSubmittingLap,
  setLapSubmissionError,
  appendLapTime,
  setLapTxid,
  setLapTime,
  onLatestActivityChange,
  emitSharedLapTransaction,
  fetcher
}: PixelRacingLapCompletionWorkflowInput): Promise<PixelRacingLapCompletionWorkflowResult> => {
  if (isSubmittingLap()) {
    console.log('⚠️ Lap submission already in progress, ignoring duplicate call')
    return { status: 'already-submitting' }
  }

  console.log(`🏁 Lap completion detected: ${lapTimeSeconds.toFixed(3)}s on track "${trackName}"`)

  const lapSubmissionValidation = validateLapSubmissionCandidate({
    gameStatus,
    trackName,
    lapTimeSeconds,
    identity
  })
  if (!lapSubmissionValidation.valid) {
    console.log(`❌ Invalid lap - ${lapSubmissionValidation.message}`)
    appendLapTime(lapTimeSeconds)
    return { status: 'invalid', message: lapSubmissionValidation.message }
  }

  const lapIdentity = lapSubmissionValidation.identity
  console.log(`✅ Lap validation passed${testingMode ? ' (TESTING MODE - skipping server submission)' : ' - submitting to server'}`)

  const currentLapIndex = appendLapTime(lapTimeSeconds)
  const lapCompletionTimestamp = Date.now()
  const lapResult: PixelRacingGameResult = buildPixelRacingGameResult({
    identity: lapIdentity,
    lapTimeSeconds,
    timestampMs: lapCompletionTimestamp,
    carColor
  })

  console.log(`🏁 LAP COMPLETED:`)
  console.log(`   Time: ${lapTimeSeconds.toFixed(3)}s`)
  console.log(`   Track: ${trackName}`)
  console.log(`   Fox: ${identity.foxName}`)
  if (distanceTraveled !== undefined) {
    console.log(`   Distance: ${distanceTraveled.toFixed(2)}m`)
  }

  if (testingMode) {
    console.log(`🧪 TESTING MODE: Skipping transaction submission to server`)
    setLapTime(0)
    return { status: 'testing-skipped', lapIndex: currentLapIndex, lapResult }
  }

  setSubmittingLap(true)
  setLapSubmissionError(null)

  try {
    const submission = await submitPixelRacingLapCompletion({
      transactionServerUrl,
      identity: lapIdentity,
      lapTimeSeconds,
      timestampMs: lapCompletionTimestamp,
      carColor,
      trackName,
      fetcher
    })

    console.log('📤 Submitted lap completion to server:', submission.inscriptionPayload)
    console.log('✅ Lap completion txid received:', submission.txid)
    applyPixelRacingLapCompletionSubmission(submission, {
      lapIndex: currentLapIndex,
      updateLapResultTxid: txid => {
        lapResult.txid = txid
      },
      setLapTxid,
      onLatestActivityChange,
      emitSharedLapTransaction
    })

    return { status: 'submitted', lapIndex: currentLapIndex, lapResult, submission }
  } catch (err) {
    console.error('Failed to create lap inscription:', err)
    const error = err instanceof Error ? err.message : 'Failed to create lap inscription'
    setLapSubmissionError(error)
    return { status: 'failed', lapIndex: currentLapIndex, lapResult, error }
  } finally {
    setSubmittingLap(false)
    setLapTime(0)
  }
}
