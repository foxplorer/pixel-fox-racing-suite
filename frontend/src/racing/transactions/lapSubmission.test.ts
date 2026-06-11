import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPixelRacingLapCompletionSubmission,
  runPixelRacingLapCompletionWorkflow,
  submitPixelRacingLapCompletion,
  submitPixelRacingLapResult
} from './lapSubmission'
import type { PixelRacingLapInscriptionPayload } from './lapResult'

const payload: PixelRacingLapInscriptionPayload = {
  playerowner: 'owner',
  playeroutpoint: 'outpoint',
  playeroriginoutpoint: 'origin',
  playerfoxname: 'Fox',
  laptime: '70',
  time: '123',
  carcolor: '#fff',
  trackname: 'Australia'
}

test('submitPixelRacingLapResult posts lap payload and normalizes success response', async () => {
  let requestedUrl = ''
  let requestedBody = ''

  const result = await submitPixelRacingLapResult('https://tx.example', payload, async (url, init) => {
    requestedUrl = url
    requestedBody = init.body
    assert.equal(init.method, 'POST')
    assert.deepEqual(init.headers, { 'Content-Type': 'application/json' })
    return {
      json: async () => ({ txid: 'abc123', dummy: true })
    }
  })

  assert.equal(requestedUrl, 'https://tx.example/createpixelracing')
  assert.deepEqual(JSON.parse(requestedBody), payload)
  assert.deepEqual(result, { txid: 'abc123', dummy: true })
})

test('submitPixelRacingLapResult throws server error messages', async () => {
  await assert.rejects(
    () => submitPixelRacingLapResult('https://tx.example', payload, async () => ({
      json: async () => ({ error: 'bad_request', message: 'Bad lap' })
    })),
    /Bad lap/
  )
})

test('submitPixelRacingLapResult requires a txid', async () => {
  await assert.rejects(
    () => submitPixelRacingLapResult('https://tx.example', payload, async () => ({
      json: async () => ({ dummy: false })
    })),
    /No transaction ID received/
  )
})

test('submitPixelRacingLapCompletion returns tx activity and socket payloads', async () => {
  const result = await submitPixelRacingLapCompletion({
    transactionServerUrl: 'https://tx.example',
    identity: {
      ownerAddress: 'owner',
      outpoint: 'outpoint',
      originOutpoint: 'origin',
      foxName: 'Fox'
    },
    lapTimeSeconds: 72.345,
    timestampMs: 123,
    carColor: '#123456',
    trackName: 'Belgium',
    fetcher: async () => ({
      json: async () => ({ txid: 'tx456', dummy: false })
    })
  })

  assert.equal(result.txid, 'tx456')
  assert.equal(result.dummy, false)
  assert.deepEqual(result.inscriptionPayload, {
    playerowner: 'owner',
    playeroutpoint: 'outpoint',
    playeroriginoutpoint: 'origin',
    playerfoxname: 'Fox',
    laptime: '72.345',
    time: '123',
    carcolor: '#123456',
    trackname: 'Belgium'
  })
  assert.equal(result.activity.txid, 'tx456')
  assert.equal(result.activity.trackname, 'Belgium')
  assert.deepEqual(result.sharedTransactionPayload, {
    txid: 'tx456',
    score: 72.345,
    time: '123',
    foxOutpoint: 'outpoint',
    foxName: 'Fox',
    originOutpoint: 'origin',
    ownerAddress: 'owner',
    trackName: 'Belgium',
    dummy: false
  })
})

test('applyPixelRacingLapCompletionSubmission applies txid activity and socket effects', () => {
  let updatedTxid = ''
  const lapTxids: Record<number, string> = {}
  let latestActivityTxid = ''
  let emittedTxid = ''

  applyPixelRacingLapCompletionSubmission({
    txid: 'tx789',
    dummy: true,
    inscriptionPayload: payload,
    activity: {
      owneraddress: 'owner',
      outpoint: 'outpoint',
      originoutpoint: 'origin',
      foxname: 'Fox',
      laptime: '70',
      time: '123',
      txid: 'tx789',
      foxinfolink: '',
      foximagelink: ''
    },
    sharedTransactionPayload: {
      txid: 'tx789',
      score: 70,
      time: '123',
      foxOutpoint: 'outpoint',
      foxName: 'Fox',
      originOutpoint: 'origin',
      ownerAddress: 'owner',
      trackName: 'Australia',
      dummy: true
    }
  }, {
    lapIndex: 2,
    updateLapResultTxid: txid => {
      updatedTxid = txid
    },
    setLapTxid: (lapIndex, txid) => {
      lapTxids[lapIndex] = txid
    },
    onLatestActivityChange: activity => {
      latestActivityTxid = activity.txid
    },
    emitSharedLapTransaction: sharedTransaction => {
      emittedTxid = sharedTransaction.txid
    }
  })

  assert.equal(updatedTxid, 'tx789')
  assert.deepEqual(lapTxids, { 2: 'tx789' })
  assert.equal(latestActivityTxid, 'tx789')
  assert.equal(emittedTxid, 'tx789')
})

test('runPixelRacingLapCompletionWorkflow validates, records, submits, and emits a lap', async () => {
  const lapTimes: number[] = []
  const lapTxids: Record<number, string> = {}
  const emittedTxids: string[] = []
  let isSubmitting = false
  let lapSubmissionError: string | null = 'old-error'
  let latestActivityTxid = ''
  let lapTime = 12

  const result = await runPixelRacingLapCompletionWorkflow({
    lapTimeSeconds: 72.5,
    gameStatus: 'racing',
    trackName: 'San Luis',
    identity: {
      ownerAddress: 'owner',
      outpoint: 'outpoint',
      originOutpoint: 'origin',
      foxName: 'Fox'
    },
    carColor: '#123456',
    distanceTraveled: 1234,
    transactionServerUrl: 'https://tx.example',
    isSubmittingLap: () => isSubmitting,
    setSubmittingLap: value => {
      isSubmitting = value
    },
    setLapSubmissionError: value => {
      lapSubmissionError = value
    },
    appendLapTime: value => {
      const index = lapTimes.length
      lapTimes.push(value)
      return index
    },
    setLapTxid: (lapIndex, txid) => {
      lapTxids[lapIndex] = txid
    },
    setLapTime: value => {
      lapTime = value
    },
    onLatestActivityChange: activity => {
      latestActivityTxid = activity.txid
    },
    emitSharedLapTransaction: payload => {
      emittedTxids.push(payload.txid)
    },
    fetcher: async () => ({
      json: async () => ({ txid: 'tx-workflow', dummy: true })
    })
  })

  assert.equal(result.status, 'submitted')
  assert.deepEqual(lapTimes, [72.5])
  assert.deepEqual(lapTxids, { 0: 'tx-workflow' })
  assert.equal(latestActivityTxid, 'tx-workflow')
  assert.deepEqual(emittedTxids, ['tx-workflow'])
  assert.equal(lapSubmissionError, null)
  assert.equal(isSubmitting, false)
  assert.equal(lapTime, 0)
})

test('runPixelRacingLapCompletionWorkflow records invalid laps without submitting', async () => {
  const lapTimes: number[] = []
  let didSubmit = false
  let lapTime = 12

  const result = await runPixelRacingLapCompletionWorkflow({
    lapTimeSeconds: 12,
    gameStatus: 'racing',
    trackName: 'Australia',
    identity: {
      ownerAddress: 'owner',
      outpoint: 'outpoint',
      originOutpoint: 'origin',
      foxName: 'Fox'
    },
    transactionServerUrl: 'https://tx.example',
    isSubmittingLap: () => false,
    setSubmittingLap: () => {},
    setLapSubmissionError: () => {},
    appendLapTime: value => {
      const index = lapTimes.length
      lapTimes.push(value)
      return index
    },
    setLapTxid: () => {},
    setLapTime: value => {
      lapTime = value
    },
    fetcher: async () => {
      didSubmit = true
      return { json: async () => ({ txid: 'should-not-submit' }) }
    }
  })

  assert.equal(result.status, 'invalid')
  assert.deepEqual(lapTimes, [12])
  assert.equal(didSubmit, false)
  assert.equal(lapTime, 12)
})

test('runPixelRacingLapCompletionWorkflow reports failed submissions and clears submitting state', async () => {
  let isSubmitting = false
  let lapSubmissionError: string | null = null
  let lapTime = 99

  const result = await runPixelRacingLapCompletionWorkflow({
    lapTimeSeconds: 72.5,
    gameStatus: 'racing',
    trackName: 'Belgium',
    identity: {
      ownerAddress: 'owner',
      outpoint: 'outpoint',
      originOutpoint: 'origin',
      foxName: 'Fox'
    },
    transactionServerUrl: 'https://tx.example',
    isSubmittingLap: () => isSubmitting,
    setSubmittingLap: value => {
      isSubmitting = value
    },
    setLapSubmissionError: value => {
      lapSubmissionError = value
    },
    appendLapTime: () => 3,
    setLapTxid: () => {},
    setLapTime: value => {
      lapTime = value
    },
    fetcher: async () => ({
      json: async () => ({ error: 'bad_request', message: 'Nope' })
    })
  })

  assert.equal(result.status, 'failed')
  assert.equal(lapSubmissionError, 'Nope')
  assert.equal(isSubmitting, false)
  assert.equal(lapTime, 0)
})
