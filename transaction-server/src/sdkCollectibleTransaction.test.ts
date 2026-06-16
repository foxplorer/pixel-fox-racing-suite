import assert from 'node:assert/strict'
import test from 'node:test'
import { Inscription, MAP, Sigma } from '@1sat/templates'
import { P2PKH, PrivateKey, Script, Transaction } from '@bsv/sdk'
import {
  buildCollectibleLockingScript,
  createSdkCollectibleTransactionBuilder,
  normalizeLockingScriptHex,
  signCollectibleIssuer,
} from './sdkCollectibleTransaction'

test('buildCollectibleLockingScript creates a spendable inscription with MAP metadata', () => {
  const destination = PrivateKey.fromRandom().toAddress()
  const lockingScript = buildCollectibleLockingScript(
    destination,
    '<svg></svg>',
    'image/svg+xml',
    {
      app: 'pixelfoxracing',
      type: 'ord',
      name: 'blueberries',
      subType: 'collectionItem',
      subTypeData: JSON.stringify({ collectionId: 'collection_0' }),
    }
  )

  const inscription = Inscription.decode(lockingScript)
  assert.ok(inscription)
  assert.equal(Buffer.from(inscription.getContent()).toString(), '<svg></svg>')
  assert.equal(inscription.file.type, 'image/svg+xml')

  const map = MAP.decode(new Script(lockingScript.chunks))
  assert.ok(map)
  assert.equal(map.data.app, 'pixelfoxracing')
  assert.equal(map.data.subType, 'collectionItem')
})

test('signCollectibleIssuer adds a verifiable Sigma issuer signature', () => {
  const signer = PrivateKey.fromRandom()
  const transaction = new Transaction()
  transaction.addInput({
    sourceTXID: '11'.repeat(32),
    sourceOutputIndex: 0,
  })
  transaction.addOutput({
    satoshis: 1,
    lockingScript: buildCollectibleLockingScript(
      PrivateKey.fromRandom().toAddress(),
      '<svg></svg>',
      'image/svg+xml',
      {
        app: 'pixelfoxracing',
        type: 'ord',
        name: 'salad',
      }
    ),
  })

  const signed = signCollectibleIssuer(transaction, signer.toWif())
  const signatures = Sigma.parseFromScript(signed.outputs[0].lockingScript, 0)

  assert.equal(signatures.length, 1)
  assert.equal(signatures[0].address, signer.toAddress())
  assert.equal(Sigma.verifyTransaction(signed, 0), true)
})

test('normalizeLockingScriptHex accepts hex and production base64 scripts', () => {
  const scriptHex = new P2PKH().lock(PrivateKey.fromRandom().toAddress()).toHex()

  assert.equal(normalizeLockingScriptHex(scriptHex), scriptHex)
  assert.equal(
    normalizeLockingScriptHex(Buffer.from(scriptHex, 'hex').toString('base64')),
    scriptHex
  )
})

test('collectible builder preserves the issuer signature after funding signatures', async () => {
  const paymentKey = PrivateKey.fromRandom()
  const issuerKey = PrivateKey.fromRandom()
  const sourceTransaction = new Transaction()
  sourceTransaction.addOutput({
    satoshis: 1000,
    lockingScript: new P2PKH().lock(paymentKey.toAddress()),
  })
  const sourceTxid = sourceTransaction.id('hex')
  let broadcastTransaction: Transaction | undefined

  const build = createSdkCollectibleTransactionBuilder({
    chain: 'main',
    services: {
      async getBeefForTxid() {
        return {
          findAtomicTransaction(txid: string) {
            return txid === sourceTxid ? sourceTransaction : undefined
          },
        } as never
      },
    },
    getEnv(name) {
      return {
        PAYMENT_WIF: paymentKey.toWif(),
        GROUP_SIGNING_WIF: issuerKey.toWif(),
        CHANGE_ADDRESS: paymentKey.toAddress(),
      }[name]
    },
    async reservePaymentUtxo() {
      return {
        txid: sourceTxid,
        vout: 0,
        satoshis: 1000,
        script: sourceTransaction.outputs[0].lockingScript.toHex(),
      }
    },
    async markPaymentUtxoUsed() {
      return true
    },
    async broadcast(transaction) {
      broadcastTransaction = transaction
      return transaction.id('hex')
    },
  })

  await build({
    serverInstance: 'salad-server',
    destinationAddress: PrivateKey.fromRandom().toAddress(),
    content: '<svg></svg>',
    contentType: 'image/svg+xml',
    map: {
      app: 'pixelfoxracing',
      type: 'ord',
      name: 'salad',
    },
  })

  assert.ok(broadcastTransaction)
  assert.equal(broadcastTransaction.inputs[0].sourceTXID, sourceTxid)
  const signatures = Sigma.parseFromScript(
    broadcastTransaction.outputs[0].lockingScript,
    0
  )
  assert.equal(signatures[0]?.address, issuerKey.toAddress())
  assert.equal(Sigma.verifyTransaction(broadcastTransaction, 0), true)
})
