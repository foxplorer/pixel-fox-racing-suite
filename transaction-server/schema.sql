CREATE TABLE IF NOT EXISTS payment_utxos (
  id BIGSERIAL PRIMARY KEY,
  outpoint TEXT GENERATED ALWAYS AS (txid || '_' || vout::text) STORED UNIQUE,
  txid TEXT NOT NULL,
  vout INTEGER NOT NULL,
  satoshis BIGINT NOT NULL,
  script TEXT NOT NULL,
  funding_pool TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'available',
  server_instance TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_utxos_status_check CHECK (status IN ('available', 'pending', 'used')),
  CONSTRAINT payment_utxos_unique_txout UNIQUE (txid, vout)
);

CREATE INDEX IF NOT EXISTS payment_utxos_available_idx
  ON payment_utxos (funding_pool, status, created_at)
  WHERE status = 'available';

