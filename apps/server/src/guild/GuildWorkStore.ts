import { CommandId, ThreadId, TurnTokenUsage } from "@t3tools/contracts";
import {
  Adventurer,
  AdventurerChange,
  Attempt,
  AttemptTurn,
  GuildAdventurerId,
  GuildAttemptId,
  ModelBinding,
} from "@t3tools/contracts/guild";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";

import { PersistenceDecodeError, toPersistenceSqlError } from "../persistence/Errors.ts";
import type { GuildStoreError } from "./GuildStore.ts";

const AdventurerInsert = Adventurer.mapFields((fields) => ({
  ...fields,
  appearance: Schema.fromJsonString(fields.appearance),
  specialties: Schema.fromJsonString(fields.specialties),
  binding: Schema.fromJsonString(fields.binding),
  defaults: Schema.fromJsonString(fields.defaults),
})).pipe(
  Schema.encodeKeys({
    appearance: "appearance_json",
    appearanceVersion: "appearance_version",
    classId: "class_id",
    specialties: "specialties_json",
    binding: "binding_json",
    defaults: "defaults_json",
    lastProjectId: "last_project_id",
    createdAt: "created_at",
    hiredAt: "hired_at",
    updatedAt: "updated_at",
  }),
);

const HiredChangeInsert = AdventurerChange.mapFields((fields) => ({
  ...fields,
  before: Schema.Null,
  after: Schema.fromJsonString(fields.after),
})).pipe(
  Schema.encodeKeys({ adventurerId: "adventurer_id", before: "before_json", after: "after_json" }),
);

const AttemptRow = Attempt.mapFields((fields) => ({
  ...fields,
  requestedOptions: Schema.NullOr(Schema.fromJsonString(Schema.Json)),
  executedModels: Schema.fromJsonString(fields.executedModels),
  workspace: Schema.fromJsonString(fields.workspace),
  usage: Schema.fromJsonString(fields.usage),
})).pipe(
  Schema.encodeKeys({
    adventurerId: "adventurer_id",
    questId: "quest_id",
    attemptNumber: "attempt_number",
    classIdAtStart: "class_id_at_start",
    familyKeyAtStart: "family_key_at_start",
    threadId: "thread_id",
    projectId: "project_id",
    providerInstanceId: "provider_instance_id",
    requestedModel: "requested_model",
    requestedOptions: "requested_options_json",
    executedModels: "executed_models_json",
    statusReason: "status_reason",
    errorClass: "error_class",
    startedAt: "started_at",
    endedAt: "ended_at",
    createdAt: "created_at",
    workspace: "workspace_json",
    usage: "usage_json",
  }),
);

const AttemptTurnRow = AttemptTurn.mapFields((fields) => ({
  ...fields,
  turnTokenUsage: Schema.NullOr(Schema.fromJsonString(TurnTokenUsage)),
})).pipe(
  Schema.encodeKeys({
    attemptId: "attempt_id",
    providerTurnId: "provider_turn_id",
    t3RunAttemptId: "t3_run_attempt_id",
    t3RunId: "t3_run_id",
    requestedModel: "requested_model",
    executedModel: "executed_model",
    turnTokenUsage: "turn_token_usage_json",
    errorClass: "error_class",
    startedAt: "started_at",
    endedAt: "ended_at",
  }),
);

const FamilyModels = Schema.Array(Schema.String);
const OutboxStatus = Schema.Literals(["pending", "running", "done", "failed"]);
const OutboxNewRow = Schema.Struct({
  id: GuildAttemptId,
  kind: Schema.Literal("launch"),
  payload: Schema.fromJsonString(
    Schema.Struct({
      binding: ModelBinding,
      familyModels: Schema.optionalKey(FamilyModels),
      title: Schema.String,
      text: Schema.String,
      runtimeMode: Adventurer.fields.defaults.fields.runtimeMode,
      interactionMode: Adventurer.fields.defaults.fields.interactionMode,
    }),
  ),
  status: OutboxStatus,
  createdAt: Attempt.fields.createdAt,
}).pipe(Schema.encodeKeys({ payload: "payload_json", createdAt: "created_at" }));

const OutboxTransition = Schema.Struct({
  id: GuildAttemptId,
  status: OutboxStatus,
  error: Schema.NullOr(Schema.String),
});

const LastProject = Schema.Struct({
  id: GuildAdventurerId,
  projectId: Attempt.fields.projectId,
  at: Attempt.fields.createdAt,
});

export const launchCommandId = (id: GuildAttemptId) => CommandId.make(`server:guild:launch:${id}`);

const mapError = (operation: string) => (cause: unknown) =>
  Schema.isSchemaError(cause)
    ? PersistenceDecodeError.fromSchemaError(operation, cause)
    : toPersistenceSqlError(operation)(cause);

export class GuildWorkStore extends Context.Service<
  GuildWorkStore,
  {
    readonly insertAdventurer: (value: Adventurer) => Effect.Effect<void, GuildStoreError>;
    readonly appendHire: (
      value: typeof HiredChangeInsert.Type,
    ) => Effect.Effect<void, GuildStoreError>;
    readonly saveLastProject: (
      value: typeof LastProject.Type,
    ) => Effect.Effect<void, GuildStoreError>;
    readonly getAttempt: (id: GuildAttemptId) => Effect.Effect<Attempt | null, GuildStoreError>;
    readonly getAttemptByThread: (id: ThreadId) => Effect.Effect<Attempt | null, GuildStoreError>;
    readonly getLatestConversation: (
      id: GuildAdventurerId,
    ) => Effect.Effect<Attempt | null, GuildStoreError>;
    readonly listAttemptThreads: () => Effect.Effect<readonly ThreadId[], GuildStoreError>;
    readonly saveAttempt: (value: Attempt) => Effect.Effect<void, GuildStoreError>;
    readonly saveTurn: (value: AttemptTurn) => Effect.Effect<void, GuildStoreError>;
    readonly enqueue: (value: typeof OutboxNewRow.Type) => Effect.Effect<void, GuildStoreError>;
    readonly getLaunchFamilyModels: (
      id: GuildAttemptId,
    ) => Effect.Effect<readonly string[], GuildStoreError>;
    readonly nextPending: () => Effect.Effect<typeof OutboxNewRow.Type | null, GuildStoreError>;
    readonly listRunning: () => Effect.Effect<
      readonly (typeof OutboxNewRow.Type)[],
      GuildStoreError
    >;
    readonly updateOutbox: (
      value: typeof OutboxTransition.Type,
    ) => Effect.Effect<void, GuildStoreError>;
  }
>()("t3/guild/GuildWorkStore") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertAdventurer = SqlSchema.void({
    Request: AdventurerInsert,
    execute: (row) => sql`INSERT INTO guild_adventurers ${sql.insert(row)}`,
  });
  const appendHire = SqlSchema.void({
    Request: HiredChangeInsert,
    execute: (row) => sql`INSERT INTO guild_adventurer_changes ${sql.insert(row)}`,
  });
  const saveLastProject = SqlSchema.void({
    Request: LastProject,
    execute: ({ id, projectId, at }) => sql`
      UPDATE guild_adventurers SET last_project_id = ${projectId}, updated_at = ${at} WHERE id = ${id}
    `,
  });
  const getAttempt = SqlSchema.findOneOption({
    Request: GuildAttemptId,
    Result: AttemptRow,
    execute: (id) => sql`SELECT * FROM guild_attempts WHERE id = ${id}`,
  });
  const getAttemptByThread = SqlSchema.findOneOption({
    Request: ThreadId,
    Result: AttemptRow,
    execute: (id) => sql`SELECT * FROM guild_attempts WHERE thread_id = ${id}`,
  });
  const getLatestConversation = SqlSchema.findOneOption({
    Request: GuildAdventurerId,
    Result: AttemptRow,
    execute: (id) => sql`
      SELECT * FROM guild_attempts
      WHERE adventurer_id = ${id} AND kind = 'conversation'
      ORDER BY created_at DESC, id DESC LIMIT 1
    `,
  });
  const listAttemptThreads = SqlSchema.findAll({
    Request: Schema.Void,
    Result: Schema.Struct({ thread_id: ThreadId }),
    execute: () => sql`SELECT thread_id FROM guild_attempts`,
  });
  const saveAttempt = SqlSchema.void({
    Request: AttemptRow,
    execute: (row) => sql`
      INSERT INTO guild_attempts ${sql.insert(row)}
      ON CONFLICT(id) DO UPDATE SET
        executed_models_json = excluded.executed_models_json,
        status = excluded.status, status_reason = excluded.status_reason,
        error_class = excluded.error_class, workspace_json = excluded.workspace_json,
        usage_json = excluded.usage_json, ended_at = excluded.ended_at
    `,
  });
  const saveTurn = SqlSchema.void({
    Request: AttemptTurnRow,
    execute: (row) => sql`
      INSERT INTO guild_attempt_turns ${sql.insert(row)}
      ON CONFLICT(provider_turn_id) DO UPDATE SET
        t3_run_attempt_id = COALESCE(excluded.t3_run_attempt_id, t3_run_attempt_id),
        t3_run_id = COALESCE(excluded.t3_run_id, t3_run_id),
        status = excluded.status,
        requested_model = CASE WHEN excluded.t3_run_id IS NULL
          THEN requested_model ELSE excluded.requested_model END,
        executed_model = COALESCE(excluded.executed_model, executed_model),
        turn_token_usage_json = COALESCE(excluded.turn_token_usage_json, turn_token_usage_json),
        error_class = COALESCE(excluded.error_class, error_class),
        started_at = COALESCE(excluded.started_at, started_at),
        ended_at = COALESCE(excluded.ended_at, ended_at)
    `,
  });
  const enqueue = SqlSchema.void({
    Request: OutboxNewRow,
    execute: (row) => sql`INSERT INTO guild_outbox ${sql.insert(row)}`,
  });
  const getLaunchFamilyModels = SqlSchema.findOneOption({
    Request: GuildAttemptId,
    Result: Schema.Struct({ family_models: Schema.NullOr(Schema.fromJsonString(FamilyModels)) }),
    execute: (id) => sql`
      SELECT json_extract(payload_json, '$.familyModels') AS family_models
      FROM guild_outbox WHERE id = ${id} AND kind = 'launch'
    `,
  });
  const nextPending = SqlSchema.findOneOption({
    Request: Schema.Void,
    Result: OutboxNewRow,
    execute: () => sql`
      SELECT * FROM guild_outbox WHERE kind = 'launch' AND status = 'pending'
      ORDER BY created_at, id LIMIT 1
    `,
  });
  const listRunning = SqlSchema.findAll({
    Request: Schema.Void,
    Result: OutboxNewRow,
    execute: () => sql`SELECT * FROM guild_outbox WHERE kind = 'launch' AND status = 'running'`,
  });
  const updateOutbox = SqlSchema.void({
    Request: OutboxTransition,
    execute: ({ id, status, error }) => sql`
      UPDATE guild_outbox
      SET status = ${status}, last_error = ${error}, attempts = attempts + (${status} = 'running')
      WHERE id = ${id}
    `,
  });

  return GuildWorkStore.of({
    insertAdventurer: Effect.fn("GuildWorkStore.insertAdventurer")(
      insertAdventurer,
      Effect.mapError(mapError("insertAdventurer")),
    ),
    appendHire: Effect.fn("GuildWorkStore.appendHire")(
      appendHire,
      Effect.mapError(mapError("appendHire")),
    ),
    saveLastProject: Effect.fn("GuildWorkStore.saveLastProject")(
      saveLastProject,
      Effect.mapError(mapError("saveLastProject")),
    ),
    getAttempt: Effect.fn("GuildWorkStore.getAttempt")(
      getAttempt,
      Effect.map(Option.getOrNull),
      Effect.mapError(mapError("getAttempt")),
    ),
    getAttemptByThread: Effect.fn("GuildWorkStore.getAttemptByThread")(
      getAttemptByThread,
      Effect.map(Option.getOrNull),
      Effect.mapError(mapError("getAttemptByThread")),
    ),
    getLatestConversation: Effect.fn("GuildWorkStore.getLatestConversation")(
      getLatestConversation,
      Effect.map(Option.getOrNull),
      Effect.mapError(mapError("getLatestConversation")),
    ),
    listAttemptThreads: Effect.fn("GuildWorkStore.listAttemptThreads")(
      () => listAttemptThreads(undefined),
      Effect.map((rows) => rows.map(({ thread_id }) => thread_id)),
      Effect.mapError(mapError("listAttemptThreads")),
    ),
    saveAttempt: Effect.fn("GuildWorkStore.saveAttempt")(
      saveAttempt,
      Effect.mapError(mapError("saveAttempt")),
    ),
    saveTurn: Effect.fn("GuildWorkStore.saveTurn")(saveTurn, Effect.mapError(mapError("saveTurn"))),
    enqueue: Effect.fn("GuildWorkStore.enqueue")(enqueue, Effect.mapError(mapError("enqueue"))),
    getLaunchFamilyModels: Effect.fn("GuildWorkStore.getLaunchFamilyModels")(
      getLaunchFamilyModels,
      Effect.map((row) => Option.getOrUndefined(row)?.family_models ?? []),
      Effect.mapError(mapError("getLaunchFamilyModels")),
    ),
    nextPending: Effect.fn("GuildWorkStore.nextPending")(
      () => nextPending(undefined),
      Effect.map(Option.getOrNull),
      Effect.mapError(mapError("nextPending")),
    ),
    listRunning: Effect.fn("GuildWorkStore.listRunning")(
      () => listRunning(undefined),
      Effect.mapError(mapError("listRunning")),
    ),
    updateOutbox: Effect.fn("GuildWorkStore.updateOutbox")(
      updateOutbox,
      Effect.mapError(mapError("updateOutbox")),
    ),
  });
});

export const layer = Layer.effect(GuildWorkStore, make);
