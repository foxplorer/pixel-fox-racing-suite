import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'
import { PrivateKey } from '@bsv/sdk'
import { createOrdinals } from 'js-1sat-ord'
import type { CollectionItemSubTypeData, CreateOrdinalsConfig, LocalSigner, PreMAP, Utxo } from 'js-1sat-ord'
import { getAndReservePaymentUtxo, markPaymentUtxoAsUsed, releasePaymentUtxo } from './db.js'

config()

const app = express()
const PORT = Number(process.env.PORT || 9000)
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

const TRANSACTION_MODE = (process.env.TRANSACTION_MODE || 'dummy').toLowerCase()
const USE_REAL_TRANSACTIONS = TRANSACTION_MODE === 'real'
const INSCRIPTION_APP = process.env.INSCRIPTION_APP?.trim() || 'pixelfoxracing'
const RACE_RESULT_INSCRIPTION_NAME = process.env.RACE_RESULT_INSCRIPTION_NAME?.trim() || 'pixelracingtimes'

app.use(cors({
  origin: corsOrigins,
  methods: ['POST', 'OPTIONS', 'GET'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true,
}))
app.options('*', cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'pixel-fox-racing-transaction-server', mode: TRANSACTION_MODE })
})

function makeDummyTxid(): string {
  const alphabet = '0123456789abcdef'
  let txid = ''
  for (let i = 0; i < 64; i++) {
    txid += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return txid
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function getSigner(): LocalSigner {
  return { idKey: PrivateKey.fromWif(requireEnv('GROUP_SIGNING_WIF')) }
}

function getItemPaymentPk(): PrivateKey {
  return PrivateKey.fromWif(requireEnv('PAYMENT_WIF'))
}

async function broadcastWithRetry(txHex: string): Promise<string> {
  const maxRetries = 5
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('https://api.whatsonchain.com/v1/bsv/main/tx/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txhex: txHex }),
      })

      if (response.ok) {
        const text = await response.text()
        let txid = text
        try { txid = JSON.parse(text) } catch {}
        return String(txid).trim().replace(/^"|"$/g, '')
      }

      const errorText = await response.text()
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 1500 * Math.pow(2, i)))
        continue
      }
      throw new Error(`Status ${response.status}: ${errorText}`)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  throw new Error('Broadcast failed after retries')
}

async function submitToGorillapool(txid: string): Promise<void> {
  try {
    const response = await fetch(`https://ordinals.gorillapool.io/api/tx/${txid}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) {
      console.error('Gorillapool submit failed:', await response.text())
    }
  } catch (error) {
    console.error('Gorillapool submit error:', error)
  }
}

type CollectibleKind = 'blueberries' | 'salad' | 'rabbit'

const COLLECTIBLES: Record<CollectibleKind, {
  route: string
  collectionIdEnv: string
  viewBox: string
  serverInstance: string
}> = {
  blueberries: {
    route: '/createblueberries',
    collectionIdEnv: 'BLUEBERRIES_COLLECTION_ID',
    viewBox: '0 0 53.308 53.308',
    serverInstance: 'blueberries-server',
  },
  salad: {
    route: '/createsalad',
    collectionIdEnv: 'SALAD_COLLECTION_ID',
    viewBox: '0 0 55.569 55.569',
    serverInstance: 'salad-server',
  },
  rabbit: {
    route: '/createrabbit',
    collectionIdEnv: 'RABBIT_COLLECTION_ID',
    viewBox: '0 0 416.188 416.188',
    serverInstance: 'rabbit-server',
  },
}

for (const [kind, configForKind] of Object.entries(COLLECTIBLES) as Array<[CollectibleKind, typeof COLLECTIBLES[CollectibleKind]]>) {
  app.post(configForKind.route, async (req, res) => {
    const address = req.body.address
    if (!address) {
      res.json({ error: 'Address is required' })
      return
    }

    let reservedOutpoint: string | undefined
    try {
      if (!USE_REAL_TRANSACTIONS) {
        const time = Date.now()
        res.json({
          txid: makeDummyTxid(),
          time,
          type: kind,
          dummy: true,
        })
        return
      }

      const reservedUtxo = await getAndReservePaymentUtxo('default', configForKind.serverInstance)
      if (!reservedUtxo) {
        res.json({ error: 'no_utxos_available', message: 'No payment UTXOs available in database' })
        return
      }
      reservedOutpoint = `${reservedUtxo.txid}_${reservedUtxo.vout}`
      const collectionId = requireEnv(configForKind.collectionIdEnv)

      const content = `<svg width="100%" height="100%" viewBox="${configForKind.viewBox}" xmlns="http://www.w3.org/2000/svg">
  <image href="/content/${collectionId}" width="100%" height="100%"/>
</svg>`
      const time = Date.now()
      const metaData = {
        app: INSCRIPTION_APP,
        name: kind,
        type: 'ord',
        time,
        subType: 'collectionItem',
        subTypeData: {
          collectionId,
        } as CollectionItemSubTypeData,
      } as PreMAP

      const ordConfig: CreateOrdinalsConfig = {
        utxos: [reservedUtxo as Utxo],
        destinations: [{
          address,
          inscription: {
            dataB64: Buffer.from(content).toString('base64'),
            contentType: 'image/svg+xml',
          },
        }],
        paymentPk: getItemPaymentPk(),
        changeAddress: requireEnv('CHANGE_ADDRESS'),
        metaData,
        signer: getSigner(),
      }

      const { tx } = await createOrdinals(ordConfig)
      const txid = await broadcastWithRetry(tx.toHex())
      await markPaymentUtxoAsUsed(reservedOutpoint)
      res.json({ txid, time, type: kind })
      await submitToGorillapool(txid)
    } catch (error) {
      console.error(`Error creating ${kind}:`, error)
      if (reservedOutpoint) {
        await releasePaymentUtxo(reservedOutpoint).catch(releaseError => {
          console.error(`Error releasing ${reservedOutpoint}:`, releaseError)
        })
      }
      res.json({ error: `Failed to create ${kind} inscription` })
    }
  })
}

app.post('/createpixelracing', async (req, res) => {
  const required = ['playerowner', 'playeroutpoint', 'playeroriginoutpoint', 'playerfoxname', 'laptime', 'time']
  const missing = required.filter(key => !req.body[key])
  if (missing.length > 0) {
    res.json({ error: 'missing_fields', message: `Missing required fields: ${missing.join(', ')}` })
    return
  }

  const lapTime = Number.parseFloat(req.body.laptime)
  if (Number.isNaN(lapTime) || lapTime < 40) {
    res.json({
      error: 'invalid_laptime',
      message: `Lap time too fast: ${lapTime} seconds. Minimum allowed: 40 seconds.`,
    })
    return
  }

  let reservedOutpoint: string | undefined
  try {
    if (!USE_REAL_TRANSACTIONS) {
      res.json({
        txid: makeDummyTxid(),
        status: 'success',
        message: 'Dummy pixel racing lap inscription created successfully',
        time: req.body.time,
        laptime: req.body.laptime,
        carcolor: req.body.carcolor || null,
        trackname: req.body.trackname || null,
        dummy: true,
      })
      return
    }

    const reservedUtxo = await getAndReservePaymentUtxo('default', 'pixelracing-server')
    if (!reservedUtxo) {
      res.json({ error: 'no_utxos_available', message: 'No payment UTXOs available in database' })
      return
    }
    reservedOutpoint = `${reservedUtxo.txid}_${reservedUtxo.vout}`

    const contentObj: Record<string, unknown> = {
      playerowner: req.body.playerowner,
      playeroutpoint: req.body.playeroutpoint,
      playeroriginoutpoint: req.body.playeroriginoutpoint,
      playerfoxname: req.body.playerfoxname,
      laptime: req.body.laptime,
      time: req.body.time,
      carcolor: req.body.carcolor || null,
    }
    if (req.body.trackname != null && req.body.trackname !== '') {
      contentObj.trackname = req.body.trackname
    }

    const metaData: Record<string, unknown> = {
      app: INSCRIPTION_APP,
      type: 'ord',
      name: RACE_RESULT_INSCRIPTION_NAME,
      owneraddress: req.body.playerowner,
      outpoint: req.body.playeroutpoint,
      originoutpoint: req.body.playeroriginoutpoint,
      foxname: req.body.playerfoxname,
      laptime: String(req.body.laptime),
      time: String(req.body.time),
      carcolor: req.body.carcolor || null,
    }
    if (req.body.trackname != null && req.body.trackname !== '') {
      metaData.trackname = req.body.trackname
    }

    const ordConfig: CreateOrdinalsConfig = {
      utxos: [reservedUtxo as Utxo],
      destinations: [{
        address: requireEnv('PIXELRACING_RESULTS_ADDRESS'),
        inscription: {
          dataB64: Buffer.from(JSON.stringify(contentObj)).toString('base64'),
          contentType: 'text/plain;charset=utf-8',
        },
      }],
      paymentPk: getItemPaymentPk(),
      changeAddress: requireEnv('CHANGE_ADDRESS'),
      metaData: metaData as PreMAP,
      signer: getSigner(),
    }

    const { tx } = await createOrdinals(ordConfig)
    const txid = await broadcastWithRetry(tx.toHex())
    await markPaymentUtxoAsUsed(reservedOutpoint)

    res.json({
      txid,
      status: 'success',
      message: 'Pixel racing lap inscription created successfully',
      time: req.body.time,
      laptime: req.body.laptime,
      carcolor: req.body.carcolor || null,
      trackname: req.body.trackname || null,
    })
    await submitToGorillapool(txid)
  } catch (error) {
    console.error('Error creating pixel racing lap inscription:', error)
    if (reservedOutpoint) {
      await releasePaymentUtxo(reservedOutpoint).catch(releaseError => {
        console.error(`Error releasing ${reservedOutpoint}:`, releaseError)
      })
    }
    res.json({
      error: 'failed_create_inscription',
      message: error instanceof Error ? error.message : 'Failed to create pixel racing lap inscription',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Pixel Fox Racing transaction server listening on ${PORT} (${TRANSACTION_MODE} mode)`)
})
