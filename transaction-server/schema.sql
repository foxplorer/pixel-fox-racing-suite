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

CREATE TABLE IF NOT EXISTS scheduled_races (
  id TEXT PRIMARY KEY,
  track_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  max_entrants INTEGER NOT NULL DEFAULT 6,
  laps_required INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_races_status_check CHECK (
    status IN ('scheduled', 'staging', 'countdown', 'racing', 'finalizing', 'settled', 'cancelled', 'no_contest')
  ),
  CONSTRAINT scheduled_races_max_entrants_check CHECK (max_entrants BETWEEN 2 AND 6),
  CONSTRAINT scheduled_races_laps_required_check CHECK (laps_required > 0),
  CONSTRAINT scheduled_races_unique_track_hour UNIQUE (track_name, starts_at)
);

CREATE INDEX IF NOT EXISTS scheduled_races_upcoming_idx
  ON scheduled_races (starts_at, track_name, status);

CREATE TABLE IF NOT EXISTS scheduled_race_signups (
  race_id TEXT NOT NULL REFERENCES scheduled_races(id) ON DELETE CASCADE,
  entrant_id TEXT NOT NULL,
  identity_key TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  fox_outpoint TEXT NOT NULL,
  fox_origin_outpoint TEXT NOT NULL,
  fox_name TEXT NOT NULL,
  car_color TEXT,
  grid_slot INTEGER NOT NULL,
  staged_grid_slot INTEGER,
  status TEXT NOT NULL DEFAULT 'signed_up',
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staged_at TIMESTAMPTZ,
  PRIMARY KEY (race_id, entrant_id),
  CONSTRAINT scheduled_race_signups_status_check CHECK (
    status IN ('signed_up', 'staged', 'withdrawn', 'not_staged', 'dnf', 'finished')
  ),
  CONSTRAINT scheduled_race_signups_grid_slot_check CHECK (grid_slot BETWEEN 1 AND 6),
  CONSTRAINT scheduled_race_signups_staged_grid_slot_check CHECK (staged_grid_slot IS NULL OR staged_grid_slot BETWEEN 1 AND 6)
);

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_grid_slot_idx
  ON scheduled_race_signups (race_id, grid_slot)
  WHERE status <> 'withdrawn';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_identity_idx
  ON scheduled_race_signups (race_id, identity_key)
  WHERE status <> 'withdrawn';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_owner_idx
  ON scheduled_race_signups (race_id, owner_address)
  WHERE status <> 'withdrawn';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_fox_origin_idx
  ON scheduled_race_signups (race_id, fox_origin_outpoint)
  WHERE status <> 'withdrawn';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_fox_outpoint_idx
  ON scheduled_race_signups (race_id, fox_outpoint)
  WHERE status <> 'withdrawn';

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_race_signups_active_staged_grid_slot_idx
  ON scheduled_race_signups (race_id, staged_grid_slot)
  WHERE staged_grid_slot IS NOT NULL AND status <> 'withdrawn';

CREATE TABLE IF NOT EXISTS scheduled_race_lap_progress (
  race_id TEXT NOT NULL REFERENCES scheduled_races(id) ON DELETE CASCADE,
  entrant_id TEXT NOT NULL,
  lap_times_ms JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (race_id, entrant_id),
  CONSTRAINT scheduled_race_lap_progress_signup_fk
    FOREIGN KEY (race_id, entrant_id)
    REFERENCES scheduled_race_signups(race_id, entrant_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduled_race_results (
  race_id TEXT NOT NULL REFERENCES scheduled_races(id) ON DELETE CASCADE,
  entrant_id TEXT NOT NULL,
  finish_position INTEGER,
  total_time_ms INTEGER,
  lap_times_ms JSONB NOT NULL,
  status TEXT NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (race_id, entrant_id),
  CONSTRAINT scheduled_race_results_status_check CHECK (
    status IN ('finished', 'dnf', 'rejected')
  ),
  CONSTRAINT scheduled_race_results_total_time_check CHECK (status = 'dnf' OR total_time_ms > 0),
  CONSTRAINT scheduled_race_results_finish_position_check CHECK (finish_position IS NULL OR finish_position > 0)
);

CREATE INDEX IF NOT EXISTS scheduled_race_results_position_idx
  ON scheduled_race_results (race_id, finish_position);

CREATE TABLE IF NOT EXISTS scheduled_race_final_inscriptions (
  race_id TEXT PRIMARY KEY REFERENCES scheduled_races(id) ON DELETE CASCADE,
  txid TEXT,
  dummy BOOLEAN NOT NULL DEFAULT FALSE,
  inscription_name TEXT,
  output_index INTEGER,
  status TEXT NOT NULL,
  final_inscription_payload JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_race_final_inscriptions_status_check CHECK (
    status IN ('pending', 'broadcasting', 'broadcasted', 'failed', 'no_contest')
  )
);
