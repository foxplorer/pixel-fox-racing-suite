import assert from 'node:assert/strict'
import test from 'node:test'
import { deliverScheduledRaceFinish, type FinishDeliverySocket } from './scheduledRaceFinishDelivery'
import type { ScheduledRaceFinishReport } from './scheduledRaceFinish'

const report: ScheduledRaceFinishReport = {
  raceId: 'race-1',
  entrantId: 'fox-1',
  totalTimeMs: 213000,
  lapTimesMs: [70000, 71000, 72000],
}

class FakeSocket implements FinishDeliverySocket {
  readonly listeners = new Map<string, Set<(payload: unknown) => void>>()
  emitted: ScheduledRaceFinishReport[] = []
  onEmit?: () => void

  emit(_event: 'reportScheduledRaceFinish', emittedReport: ScheduledRaceFinishReport): void {
    this.emitted.push(emittedReport)
    this.onEmit?.()
  }

  on(event: string, listener: (payload: unknown) => void): void {
    const existing = this.listeners.get(event) || new Set()
    existing.add(listener)
    this.listeners.set(event, existing)
  }

  off(event: string, listener: (payload: unknown) => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  fire(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) || []) listener(payload)
  }
}

const makeFetchStub = (calls: Array<{ url: string; body: unknown }>): typeof fetch => (
  (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return {
      ok: true,
      json: async () => ({ race: { id: report.raceId } }),
    } as Response
  }) as typeof fetch
)

test('deliverScheduledRaceFinish resolves via socket when the finish is accepted', async () => {
  const socket = new FakeSocket()
  socket.onEmit = () => socket.fire('scheduledRaceFinishAccepted', { raceId: 'race-1', entrantId: 'fox-1' })
  const httpCalls: Array<{ url: string; body: unknown }> = []

  const result = await deliverScheduledRaceFinish({
    socket,
    report,
    transactionServerUrl: 'http://localhost:9000',
    fetcher: makeFetchStub(httpCalls),
  })

  assert.equal(result.delivered, 'socket')
  assert.equal(socket.emitted.length, 1)
  assert.equal(httpCalls.length, 0)
})

test('deliverScheduledRaceFinish ignores acks for other entrants', async () => {
  const socket = new FakeSocket()
  socket.onEmit = () => {
    socket.fire('scheduledRaceFinishAccepted', { raceId: 'race-1', entrantId: 'someone-else' })
    socket.fire('scheduledRaceFinishAccepted', { raceId: 'race-1', entrantId: 'fox-1' })
  }
  const httpCalls: Array<{ url: string; body: unknown }> = []

  const result = await deliverScheduledRaceFinish({
    socket,
    report,
    transactionServerUrl: 'http://localhost:9000',
    fetcher: makeFetchStub(httpCalls),
  })

  assert.equal(result.delivered, 'socket')
  assert.equal(httpCalls.length, 0)
})

test('deliverScheduledRaceFinish falls back to HTTP when the socket rejects', async () => {
  const socket = new FakeSocket()
  socket.onEmit = () => socket.fire('scheduledRaceFinishRejected', { message: 'Scheduled race mismatch' })
  const httpCalls: Array<{ url: string; body: unknown }> = []

  const result = await deliverScheduledRaceFinish({
    socket,
    report,
    transactionServerUrl: 'http://localhost:9000',
    fetcher: makeFetchStub(httpCalls),
  })

  assert.equal(result.delivered, 'http')
  assert.equal(result.socketError, 'Scheduled race mismatch')
  assert.equal(httpCalls.length, 1)
  assert.match(httpCalls[0].url, /\/scheduled-races\/race-1\/results$/)
  assert.deepEqual(httpCalls[0].body, {
    entrantId: 'fox-1',
    totalTimeMs: 213000,
    lapTimesMs: [70000, 71000, 72000],
  })
})

test('deliverScheduledRaceFinish falls back to HTTP when the ack times out', async () => {
  const socket = new FakeSocket()
  const httpCalls: Array<{ url: string; body: unknown }> = []

  const result = await deliverScheduledRaceFinish({
    socket,
    report,
    transactionServerUrl: 'http://localhost:9000',
    ackTimeoutMs: 20,
    fetcher: makeFetchStub(httpCalls),
  })

  assert.equal(result.delivered, 'http')
  assert.ok(result.socketError)
  assert.equal(httpCalls.length, 1)
})

test('deliverScheduledRaceFinish goes straight to HTTP without a socket', async () => {
  const httpCalls: Array<{ url: string; body: unknown }> = []

  const result = await deliverScheduledRaceFinish({
    socket: null,
    report,
    transactionServerUrl: 'http://localhost:9000',
    fetcher: makeFetchStub(httpCalls),
  })

  assert.equal(result.delivered, 'http')
  assert.equal(result.socketError, 'Socket connection unavailable')
  assert.equal(httpCalls.length, 1)
})

test('deliverScheduledRaceFinish surfaces HTTP failure after socket failure', async () => {
  const socket = new FakeSocket()
  socket.onEmit = () => socket.fire('scheduledRaceFinishRejected', { message: 'nope' })
  const failingFetch = (async () => ({
    ok: false,
    status: 409,
    json: async () => ({ error: 'result_conflict', message: 'Result already exists' }),
  })) as unknown as typeof fetch

  await assert.rejects(
    () => deliverScheduledRaceFinish({
      socket,
      report,
      transactionServerUrl: 'http://localhost:9000',
      fetcher: failingFetch,
    }),
    /Result already exists/
  )
})
