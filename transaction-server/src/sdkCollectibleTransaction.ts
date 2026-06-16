import { Inscription, MAP, Sigma } from '@1sat/templates'
import {
  P2PKH,
  PrivateKey,
  Script,
  SatoshisPerKilobyte,
  Transaction,
  type Beef,
  type LockingScript,
} from '@bsv/sdk'
import {
  getAndReservePaymentUtxo,
  markPaymentUtxoAsUsed,
  releasePaymentUtxo,
  type PaymentUtxo,
} from './db.js'

export interface SdkCollectibleTransactionRequest {
  serverInstance: string
  destinationAddress: string
  content: string
  contentType: string
  map: Record<string, string>
}

export interface SdkCollectibleTransactionResult {
  txid: string
  outputIndex: number
  atomicBEEF: number[]
}

export interface SdkCollectibleTransactionOptions {
  chain: 'main' | 'test'
  services: {
    getBeefForTxid(txid: string): Promise<Beef>
  }
  getEnv?: (name: string) => string | undefined
  reservePaymentUtxo?: (
    fundingPool: string,
    serverInstance: string
  ) => Promise<PaymentUtxo | null>
  markPaymentUtxoUsed?: (outpoint: string) => Promise<boolean>
  releasePaymentUtxo?: (outpoint: string) => Promise<boolean>
  broadcast?: (tx: Transaction) => Promise<string>
}

function requireValue(value: string | undefined, name: string): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`Missing required environment variable: ${name}`)
  return normalized
}

function appendScript(target: Script, source: Script | LockingScript): void {
  for (const chunk of source.chunks) target.chunks.push(chunk)
}

export function buildCollectibleLockingScript(
  destinationAddress: string,
  content: string,
  contentType: string,
  map: Record<string, string>
): LockingScript {
  const suffix = new Script()
  appendScript(suffix, new P2PKH().lock(destinationAddress))
  appendScript(suffix, MAP.set(map))

  return Inscription.create(
    new Uint8Array(Buffer.from(content)),
    contentType,
    { scriptSuffix: suffix }
  ).lock()
}

export function signCollectibleIssuer(
  transaction: Transaction,
  groupSigningWif: string
): Transaction {
  const signer = PrivateKey.fromWif(groupSigningWif)
  return Sigma.signTransaction(transaction, signer, { targetVout: 0 }).signedTx
}

export function normalizeLockingScriptHex(script: string): string {
  const normalized = script.trim()
  if (/^(?:[0-9a-fA-F]{2})+$/.test(normalized)) {
    return normalized.toLowerCase()
  }

  const decoded = Buffer.from(normalized, 'base64')
  if (decoded.length === 0 || decoded.toString('base64').replace(/=+$/, '') !== normalized.replace(/=+$/, '')) {
    throw new Error('Funding UTXO locking script is neither valid hex nor base64')
  }
  return decoded.toString('hex')
}

function getSourceTransaction(beef: Beef, utxo: PaymentUtxo): Transaction {
  const sourceTransaction = beef.findAtomicTransaction(utxo.txid)
  if (!sourceTransaction) {
    throw new Error(`Funding BEEF did not contain transaction ${utxo.txid}`)
  }

  const sourceOutput = sourceTransaction.outputs[utxo.vout]
  if (!sourceOutput) {
    throw new Error(`Funding transaction does not contain output ${utxo.vout}`)
  }
  if (sourceOutput.satoshis !== utxo.satoshis) {
    throw new Error('Funding UTXO satoshi value does not match its source transaction')
  }
  if (sourceOutput.lockingScript.toHex() !== normalizeLockingScriptHex(utxo.script)) {
    throw new Error('Funding UTXO locking script does not match its source transaction')
  }
  return sourceTransaction
}

async function broadcastWithWhatsOnChain(
  transaction: Transaction,
  chain: 'main' | 'test',
  getEnv: (name: string) => string | undefined
): Promise<string> {
  const network = chain === 'main' ? 'main' : 'test'
  const maxRetries = 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://api.whatsonchain.com/v1/bsv/${network}/tx/raw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getEnv('WHATSONCHAIN_API_KEY')?.trim()
              ? { Authorization: getEnv('WHATSONCHAIN_API_KEY')!.trim() }
              : {}),
          },
          body: JSON.stringify({ txhex: transaction.toHex() }),
        }
      )

      if (response.ok) {
        const text = await response.text()
        let txid = text
        try { txid = JSON.parse(text) } catch {}
        return String(txid).trim().replace(/^"|"$/g, '')
      }

      const errorText = await response.text()
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 1500 * Math.pow(2, attempt)))
        continue
      }
      throw new Error(`Status ${response.status}: ${errorText}`)
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  throw new Error('Broadcast failed after retries')
}

export function createSdkCollectibleTransactionBuilder(
  options: SdkCollectibleTransactionOptions
): (request: SdkCollectibleTransactionRequest) => Promise<SdkCollectibleTransactionResult> {
  const getEnv = options.getEnv ?? (name => process.env[name])
  const reserve = options.reservePaymentUtxo ?? getAndReservePaymentUtxo
  const markUsed = options.markPaymentUtxoUsed ?? markPaymentUtxoAsUsed
  const release = options.releasePaymentUtxo ?? releasePaymentUtxo

  return async request => {
    let reservedOutpoint: string | undefined
    let broadcasted = false

    try {
      const fundingPool = getEnv('PAYMENT_UTXO_POOL')?.trim() || 'default'
      const utxo = await reserve(fundingPool, request.serverInstance)
      if (!utxo) throw new Error('No payment UTXOs available in database')
      reservedOutpoint = `${utxo.txid}_${utxo.vout}`

      const paymentKey = PrivateKey.fromWif(
        requireValue(getEnv('PAYMENT_WIF'), 'PAYMENT_WIF')
      )
      const sourceBeef = await options.services.getBeefForTxid(utxo.txid)
      const sourceTransaction = getSourceTransaction(sourceBeef, utxo)
      let transaction = new Transaction()

      transaction.addInput({
        sourceTXID: utxo.txid,
        sourceTransaction,
        sourceOutputIndex: utxo.vout,
        unlockingScriptTemplate: new P2PKH().unlock(paymentKey),
      })
      transaction.addOutput({
        satoshis: 1,
        lockingScript: buildCollectibleLockingScript(
          request.destinationAddress,
          request.content,
          request.contentType,
          request.map
        ),
      })
      transaction.addP2PKHOutput(
        requireValue(getEnv('CHANGE_ADDRESS'), 'CHANGE_ADDRESS')
      )
      transaction = signCollectibleIssuer(
        transaction,
        requireValue(getEnv('GROUP_SIGNING_WIF'), 'GROUP_SIGNING_WIF')
      )

      const feeRate = Number(getEnv('SDK_FEE_RATE_SAT_PER_KB') || 100)
      if (!Number.isFinite(feeRate) || feeRate <= 0) {
        throw new Error('SDK_FEE_RATE_SAT_PER_KB must be a positive number')
      }
      await transaction.fee(new SatoshisPerKilobyte(feeRate))
      await transaction.sign()

      const atomicBEEF = transaction.toAtomicBEEF()
      const txid = options.broadcast
        ? await options.broadcast(transaction)
        : await broadcastWithWhatsOnChain(transaction, options.chain, getEnv)

      broadcasted = true
      if (!await markUsed(reservedOutpoint)) {
        throw new Error(
          `Transaction ${txid} was broadcast but ${reservedOutpoint} was not marked used`
        )
      }
      return { txid, outputIndex: 0, atomicBEEF }
    } catch (error) {
      if (reservedOutpoint && !broadcasted) {
        await release(reservedOutpoint).catch(releaseError => {
          console.error(`Error releasing ${reservedOutpoint}:`, releaseError)
        })
      }
      throw error
    }
  }
}
