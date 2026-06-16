import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'
import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import { OneSatServices } from '@1sat/client'
import { createOrdinals } from 'js-1sat-ord'
import type { CreateOrdinalsConfig, LocalSigner, PreMAP, Utxo } from 'js-1sat-ord'
import { registerCollectibleRoutes } from './collectibles.js'
import { getAndReservePaymentUtxo, markPaymentUtxoAsUsed, releasePaymentUtxo } from './db.js'
import { createIdentityCollectibleDelivery } from './identityCollectibleDelivery.js'
import { getInvalidRequestOutpointFields } from './outpoints.js'

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
const CHAIN = process.env.BSV_NETWORK?.trim().toLowerCase() === 'test' ? 'test' : 'main'

app.use(cors({
  origin: corsOrigins,
  methods: ['POST', 'OPTIONS', 'GET'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: true,
}))
app.options('*', cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use((req, res, next) => {
  const invalidFields = getInvalidRequestOutpointFields(req.body)
  if (invalidFields.length > 0) {
    res.status(400).json({
      error: 'invalid_outpoint_format',
      message: `Outpoints must use txid_vout format: ${invalidFields.join(', ')}`,
    })
    return
  }
  next()
})
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'pixel-fox-racing-transaction-server',
    mode: TRANSACTION_MODE,
    collectibleIdentityDeliveryEnabled: !!identityDelivery,
    collectibleSenderIdentityKey: senderIdentityKey,
  })
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
      const whatsOnChainApiKey = process.env.WHATSONCHAIN_API_KEY?.trim()
      const response = await fetch(`https://api.whatsonchain.com/v1/bsv/${CHAIN}/tx/raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(whatsOnChainApiKey ? { Authorization: whatsOnChainApiKey } : {}),
        },
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

const groupSigningWif = process.env.GROUP_SIGNING_WIF?.trim()
const identityRootKey = groupSigningWif
  ? PrivateKey.fromWif(groupSigningWif)
  : undefined
const identityWallet = identityRootKey
  ? new ProtoWallet(identityRootKey)
  : undefined
const senderIdentityKey = identityRootKey?.toPublicKey().toString()
const identityDelivery = USE_REAL_TRANSACTIONS && identityWallet && senderIdentityKey
  ? createIdentityCollectibleDelivery({
      chain: CHAIN,
      services: new OneSatServices(CHAIN),
      getPublicKey: args => identityWallet.getPublicKey(args),
      senderIdentityKey,
      inscriptionApp: INSCRIPTION_APP,
    })
  : undefined

registerCollectibleRoutes(app, {
  mode: USE_REAL_TRANSACTIONS ? 'real' : 'dummy',
  inscriptionApp: INSCRIPTION_APP,
  makeDummyTxid,
  identityDelivery,
})

app.post('/createpixelracing', async (req, res) => {
  const required = ['playeroutpoint', 'playeroriginoutpoint', 'playerfoxname', 'laptime', 'time']
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

    const reservedUtxo = await getAndReservePaymentUtxo(
      process.env.PAYMENT_UTXO_POOL?.trim() || 'default',
      'pixelracing-server'
    )
    if (!reservedUtxo) {
      res.json({ error: 'no_utxos_available', message: 'No payment UTXOs available in database' })
      return
    }
    reservedOutpoint = `${reservedUtxo.txid}_${reservedUtxo.vout}`

    const contentObj: Record<string, unknown> = {
      recordVersion: 2,
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
      recordVersion: '2',
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
  if (senderIdentityKey) {
    console.log('Collectible sender identity key:', senderIdentityKey)
  }
})
