import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE guild_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      candidate_pool_json TEXT NOT NULL,
      max_concurrent_attempts INTEGER NOT NULL CHECK (max_concurrent_attempts > 0),
      max_concurrent_attempts_per_provider_json TEXT,
      xp_rules_version INTEGER NOT NULL CHECK (xp_rules_version > 0)
    )
  `;
  yield* sql`
    INSERT INTO guild_settings (id, candidate_pool_json, max_concurrent_attempts, xp_rules_version)
    VALUES (1, json_object('seed', lower(hex(randomblob(16))), 'hiredIndices', json_array()), 3, 1)
  `;
  yield* sql`
    CREATE TABLE guild_master (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      appearance_json TEXT NOT NULL,
      location_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE TABLE guild_adventurers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      appearance_json TEXT NOT NULL,
      appearance_version INTEGER NOT NULL,
      class_id TEXT NOT NULL,
      specialties_json TEXT NOT NULL,
      rank TEXT,
      binding_json TEXT NOT NULL,
      defaults_json TEXT NOT NULL,
      last_project_id TEXT,
      instructions TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
      xp INTEGER NOT NULL,
      level INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      hired_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE TABLE guild_adventurer_changes (
      sequence INTEGER PRIMARY KEY,
      adventurer_id TEXT NOT NULL REFERENCES guild_adventurers(id),
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT NOT NULL,
      actor TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE INDEX guild_adventurer_changes_history
      ON guild_adventurer_changes (adventurer_id, sequence DESC)
  `;
  yield* sql`
    CREATE TABLE guild_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      adventurer_id TEXT NOT NULL REFERENCES guild_adventurers(id),
      kind TEXT NOT NULL CHECK (kind IN ('conversation', 'quest')),
      quest_id TEXT,
      attempt_number INTEGER,
      role TEXT,
      class_id_at_start TEXT NOT NULL,
      family_key_at_start TEXT NOT NULL,
      thread_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      provider_instance_id TEXT NOT NULL,
      requested_model TEXT NOT NULL,
      requested_options_json TEXT,
      executed_models_json TEXT NOT NULL,
      status TEXT NOT NULL,
      status_reason TEXT,
      error_class TEXT,
      workspace_json TEXT NOT NULL,
      usage_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE INDEX guild_attempts_history ON guild_attempts (created_at DESC, id DESC)
  `;
  yield* sql`
    CREATE INDEX guild_attempts_adventurer_history
      ON guild_attempts (adventurer_id, created_at DESC, id DESC)
  `;
  yield* sql`
    CREATE INDEX guild_attempts_quest_history
      ON guild_attempts (quest_id, created_at DESC, id DESC) WHERE quest_id IS NOT NULL
  `;
  yield* sql`
    CREATE INDEX guild_attempts_conversations
      ON guild_attempts (adventurer_id, created_at DESC, id DESC) WHERE kind = 'conversation'
  `;
  yield* sql`
    CREATE INDEX guild_attempts_live
      ON guild_attempts (created_at DESC, id DESC)
      WHERE status IN ('starting', 'active', 'paused', 'submitted')
  `;
  yield* sql`
    CREATE TABLE guild_attempt_turns (
      provider_turn_id TEXT PRIMARY KEY NOT NULL,
      attempt_id TEXT NOT NULL REFERENCES guild_attempts(id),
      t3_run_attempt_id TEXT,
      t3_run_id TEXT,
      status TEXT NOT NULL,
      requested_model TEXT NOT NULL,
      executed_model TEXT,
      turn_token_usage_json TEXT,
      error_class TEXT,
      started_at TEXT,
      ended_at TEXT
    )
  `;
  yield* sql`
    CREATE INDEX guild_attempt_turns_attempt ON guild_attempt_turns (attempt_id, started_at)
  `;
  yield* sql`
    CREATE TABLE guild_command_receipts (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE TABLE guild_activity (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      change TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      actor TEXT NOT NULL,
      command_id TEXT,
      delta_json TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE TABLE guild_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      last_error TEXT,
      created_at TEXT NOT NULL
    )
  `;
});
