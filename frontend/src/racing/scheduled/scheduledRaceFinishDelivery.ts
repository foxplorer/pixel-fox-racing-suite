import type { ScheduledRaceFinishReport } from './scheduledRaceFinish'
import { submitScheduledRaceResult } from './scheduledRaceApi'

export interface FinishDeliverySocket {
  emit(event: 'reportScheduledRaceFinish', report: ScheduledRaceFinishReport): void
  on(event: string, listener: (payload: unknown) => void): void
  off(event: string, listener: (payload: unknown) => void): void
}

export interface DeliverScheduledRaceFinishOptions {
  socket: FinishDeliverySocket | null | undefined
  report: ScheduledRaceFinishReport
  transactionServerUrl: string
  /** How long to wait for the socket ack before falling back to HTTP. */
  ackTimeoutMs?: number
  fetcher?: typeof fetch
}

export interface FinishDeliveryResult {
  delivered: 'socket' | 'http'
  /** Present when the socket path was rejected and HTTP recovered the finish. */
  socketError?: string
}

const DEFAULT_ACK_TIMEOUT_MS = 5000

const matchesReport = (payload: unknown, report: ScheduledRaceFinishReport): boolean => {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as { raceId?: unknown; entrantId?: unknown }
  return candidate.raceId === report.raceId && candidate.entrantId === report.entrantId
}

const waitForSocketAck = (
  socket: FinishDeliverySocket,
  report: ScheduledRaceFinishReport,
  ackTimeoutMs: number
): Promise<{ accepted: boolean; error?: string }> => new Promise(resolve => {
  let settled = false
  const finish = (result: { accepted: boolean; error?: string }) => {
    if (settled) return
    settled = true
    socket.off('scheduledRaceFinishAccepted', onAccepted)
    socket.off('scheduledRaceFinishRejected', onRejected)
    clearTimeout(timeoutId)
    resolve(result)
  }

  const onAccepted = (payload: unknown) => {
    if (matchesReport(payload, report)) finish({ accepted: true })
  }
  const onRejected = (payload: unknown) => {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : 'Scheduled race finish rejected'
    finish({ accepted: false, error: message })
  }

  const timeoutId = setTimeout(() => {
    finish({ accepted: false, error: 'Scheduled race finish was not acknowledged in time' })
  }, ackTimeoutMs)

  socket.on('scheduledRaceFinishAccepted', onAccepted)
  socket.on('scheduledRaceFinishRejected', onRejected)
  socket.emit('reportScheduledRaceFinish', report)
})

/**
 * Delivers a scheduled race finish with the same reliability as a casual ITT
 * lap submission: try the socket path first (so the room sees the finish
 * immediately), and if the socket is missing, rejects, or never acks, fall
 * back to the direct transaction-server results endpoint. The server treats
 * identical duplicate results as idempotent, so socket + HTTP overlap is safe.
 */
export const deliverScheduledRaceFinish = async ({
  socket,
  report,
  transactionServerUrl,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS,
  fetcher,
}: DeliverScheduledRaceFinishOptions): Promise<FinishDeliveryResult> => {
  let socketError: string | undefined

  if (socket) {
    const ack = await waitForSocketAck(socket, report, ackTimeoutMs)
    if (ack.accepted) {
      return { delivered: 'socket' }
    }
    socketError = ack.error
  } else {
    socketError = 'Socket connection unavailable'
  }

  await submitScheduledRaceResult({
    transactionServerUrl,
    raceId: report.raceId,
    entrantId: report.entrantId,
    totalTimeMs: report.totalTimeMs,
    lapTimesMs: report.lapTimesMs,
    ...(fetcher ? { fetcher } : {}),
  })
  return { delivered: 'http', socketError }
}
