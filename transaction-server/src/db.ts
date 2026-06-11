import pg from 'pg'
import { config } from 'dotenv'

config()

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 5),
  min: Number(process.env.DB_POOL_MIN || 1),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
})

export interface PaymentUtxo {
  txid: string
  vout: number
  satoshis: number
  script: string
}

export async function getAndReservePaymentUtxo(fundingPool = 'default', serverInstance: string | null = null): Promise<PaymentUtxo | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(`
      UPDATE payment_utxos
      SET status = 'pending',
          server_instance = $1,
          claimed_at = NOW()
      WHERE id = (
        SELECT id
        FROM payment_utxos
        WHERE status = 'available'
          AND funding_pool = $2
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [serverInstance, fundingPool])

    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    await client.query('COMMIT')
    const utxo = result.rows[0]
    return {
      txid: utxo.txid,
      vout: Number(utxo.vout),
      satoshis: Number(utxo.satoshis),
      script: utxo.script,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function markPaymentUtxoAsUsed(outpoint: string): Promise<boolean> {
  const result = await pool.query(`
    UPDATE payment_utxos
    SET status = 'used'
    WHERE outpoint = $1
  `, [outpoint])
  return (result.rowCount || 0) > 0
}

export async function releasePaymentUtxo(outpoint: string): Promise<boolean> {
  const result = await pool.query(`
    UPDATE payment_utxos
    SET status = 'available',
        server_instance = NULL,
        claimed_at = NULL
    WHERE outpoint = $1
      AND status = 'pending'
  `, [outpoint])
  return (result.rowCount || 0) > 0
}
