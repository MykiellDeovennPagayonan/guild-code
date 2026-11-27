import { CommandId, NonNegativeInt } from "@t3tools/contracts";
import {
  Adventurer,
  AdventurerChange,
  AdventurerSummary,
  Attempt,
  GuildAdventurerId,
  GuildCommandRejection,
  GuildDelta,
  GuildListAttemptsInput,
  GuildMaster,
  GuildSettings,
} from "@t3tools/contracts/guild";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";
import * as SqlError from "effect/sql/SqlError";

import {
  PersistenceDecodeError,
  type PersistenceSqlError,
  toPersistenceSqlError,
} from "../persistence/Errors.ts";

const SettingsRow = GuildSettings.mapFields(({ maxConcurrentAttemptsPerProvider, ...fields }) => ({
  ...fields,
  candidatePool: Schema.fromJsonString(fields.candidatePool),
  maxConcurrentAttemptsPerProvider: Schema.NullOr(
    Schema.fromJsonString(maxConcurrentAttemptsPerProvider.schema),
  ),
})).pipe(
  Schema.encodeKeys({
    candidatePool: "candidate_pool_json",
    maxConcurrentAttempts: "max_concurrent_attempts",
    maxConcurrentAttemptsPerProvider: "max_concurrent_attempts_per_provider_json",
    xpRulesVersion: "xp_rules_version",
  }),
);

const MasterRow = GuildMaster.mapFields((fields) => ({
  ...fields,
  appearance: Schema.fromJsonString(fields.appearance),
  location: Schema.fromJsonString(fields.location),
})).pipe(
  Schema.encodeKeys({
    appearance: "appearance_json",
    location: "location_json",
    createdAt: "created_at",
  }),
);

const AdventurerRow = Adventurer.mapFields((fields) => ({
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

const AdventurerSummaryRow = AdventurerSummary.mapFields((fields) => ({
  ...fields,
  appearance: Schema.fromJsonString(fields.appearance),
  binding: Schema.fromJsonString(fields.binding),
  latestConversation: Schema.fromJsonString(fields.latestConversation),
})).pipe(
  Schema.encodeKeys({
    appearance: "appearance_json",
    classId: "class_id",
    binding: "binding_json",
    latestConversation: "latest_conversation_json",
  }),
);

const AdventurerChangeRow = AdventurerChange.mapFields((fields) => ({
  ...fields,
  before: Schema.NullOr(Schema.fromJsonString(Schema.Json)),
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

const ReceiptRow = Schema.Struct({
  commandId: CommandId,
  operation: Schema.String,
  result: Schema.fromJsonString(
    Schema.Union([
      Schema.TaggedStruct("accepted", { value: Schema.Json }),
      Schema.TaggedStruct("rejected", { error: GuildCommandRejection }),
    ]),
  ),
  createdAt: GuildMaster.fields.createdAt,
}).pipe(
  Schema.encodeKeys({ commandId: "command_id", result: "result_json", createdAt: "created_at" }),
);

const ActivityRow = Schema.Struct({
  at: GuildMaster.fields.createdAt,
  entity: Schema.String,
  entityId: Schema.String,
  change: Schema.String,
  before: Schema.NullOr(Schema.fromJsonString(Schema.Json)),
  after: Schema.NullOr(Schema.fromJsonString(Schema.Json)),
  actor: Schema.Literals(["user", "system"]),
  commandId: Schema.NullOr(CommandId),
  delta: Schema.fromJsonString(GuildDelta),
}).pipe(
  Schema.encodeKeys({
    entityId: "entity_id",
    commandId: "command_id",
    before: "before_json",
    after: "after_json",
    delta: "delta_json",
  }),
);

const ActivityDeltaRow = Schema.Struct({
  sequence: NonNegativeInt,
  delta: Schema.fromJsonString(GuildDelta),
}).pipe(Schema.encodeKeys({ delta: "delta_json" }));

export type GuildStoreError = PersistenceSqlError | PersistenceDecodeError;

export class GuildStore extends Context.Service<
  GuildStore,
  {
    readonly transaction: <A, E, R>(
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | PersistenceSqlError, R>;
    readonly getMaster: () => Effect.Effect<GuildMaster | null, GuildStoreError>;
    readonly saveMaster: (master: GuildMaster) => Effect.Effect<void, GuildStoreError>;
    readonly getSettings: () => Effect.Effect<GuildSettings, GuildStoreError>;
    readonly saveCandidatePool: (
      pool: GuildSettings["candidatePool"],
    ) => Effect.Effect<void, GuildStoreError>;
    readonly getAdventurer: (
      id: GuildAdventurerId,
    ) => Effect.Effect<Adventurer | null, GuildStoreError>;
    readonly listAdventurerSummaries: () => Effect.Effect<
      readonly AdventurerSummary[],
      GuildStoreError
    >;
    readonly listAdventurerChanges: (
      id: GuildAdventurerId,
    ) => Effect.Effect<readonly AdventurerChange[], GuildStoreError>;
    readonly listLiveAttempts: () => Effect.Effect<readonly Attempt[], GuildStoreError>;
    readonly listAttempts: (
      input: GuildListAttemptsInput & { readonly limit: number },
    ) => Effect.Effect<readonly Attempt[], GuildStoreError>;
    readonly getReceipt: (
      commandId: CommandId,
    ) => Effect.Effect<Option.Option<typeof ReceiptRow.Type>, GuildStoreError>;
    readonly saveReceipt: (receipt: typeof ReceiptRow.Type) => Effect.Effect<void, GuildStoreError>;
    readonly appendActivity: (
      activity: typeof ActivityRow.Type,
    ) => Effect.Effect<void, GuildStoreError>;
    readonly latestSequence: () => Effect.Effect<number, GuildStoreError>;
    readonly listChangesAfter: (
      sequence: number,
      limit: number,
    ) => Effect.Effect<readonly (typeof ActivityDeltaRow.Type)[], GuildStoreError>;
  }
>()("t3/guild/GuildStore") {}

const mapStoreError =
  (operation: string) =>
  (cause: unknown): GuildStoreError =>
    Schema.isSchemaError(cause)
      ? PersistenceDecodeError.fromSchemaError(operation, cause)
      : toPersistenceSqlError(operation)(cause);

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const readMaster = SqlSchema.findOneOption({
    Request: Schema.Void,
    Result: MasterRow,
    execute: () => sql`SELECT * FROM guild_master WHERE id = 1`,
  });
  const writeMaster = SqlSchema.void({
    Request: MasterRow,
    execute: (row) => sql`
      INSERT INTO guild_master ${sql.insert({ id: 1, ...row })}
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, appearance_json = excluded.appearance_json,
        location_json = excluded.location_json
    `,
  });
  const readSettings = SqlSchema.findOne({
    Request: Schema.Void,
    Result: SettingsRow,
    execute: () => sql`SELECT * FROM guild_settings WHERE id = 1`,
  });
  const writeCandidatePool = SqlSchema.void({
    Request: Schema.fromJsonString(GuildSettings.fields.candidatePool),
    execute: (pool) => sql`UPDATE guild_settings SET candidate_pool_json = ${pool} WHERE id = 1`,
  });
  const readAdventurer = SqlSchema.findOneOption({
    Request: GuildAdventurerId,
    Result: AdventurerRow,
    execute: (id) => sql`SELECT * FROM guild_adventurers WHERE id = ${id}`,
  });
  const readSummaries = SqlSchema.findAll({
    Request: Schema.Void,
    Result: AdventurerSummaryRow,
    execute: () => sql`
      SELECT a.id, a.name, a.appearance_json, a.class_id, a.binding_json, a.status, a.level,
        COALESCE((
          SELECT json_object('attemptId', c.id, 'threadId', c.thread_id)
          FROM guild_attempts c
          WHERE c.adventurer_id = a.id AND c.kind = 'conversation'
          ORDER BY c.created_at DESC, c.id DESC LIMIT 1
        ), 'null') AS latest_conversation_json
      FROM guild_adventurers a
      ORDER BY a.id
    `,
  });
  const readAdventurerChanges = SqlSchema.findAll({
    Request: GuildAdventurerId,
    Result: AdventurerChangeRow,
    execute: (id) => sql`
      SELECT * FROM guild_adventurer_changes WHERE adventurer_id = ${id} ORDER BY sequence DESC
    `,
  });
  const readLiveAttempts = SqlSchema.findAll({
    Request: Schema.Void,
    Result: AttemptRow,
    execute: () => sql`
      SELECT * FROM guild_attempts
      WHERE status IN ('starting', 'active', 'paused', 'submitted') ORDER BY created_at DESC, id DESC
    `,
  });
  const readAttemptPage = SqlSchema.findAll({
    Request: Schema.Struct({ ...GuildListAttemptsInput.fields, limit: NonNegativeInt }),
    Result: AttemptRow,
    execute: ({ adventurerId, questId, cursor, limit }) => sql`
      SELECT * FROM guild_attempts WHERE 1 = 1
      ${adventurerId === undefined ? sql`` : sql`AND adventurer_id = ${adventurerId}`}
      ${questId === undefined ? sql`` : sql`AND quest_id = ${questId}`}
      ${cursor === undefined ? sql`` : sql`AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})`}
      ORDER BY created_at DESC, id DESC LIMIT ${limit}
    `,
  });
  const readReceipt = SqlSchema.findOneOption({
    Request: CommandId,
    Result: ReceiptRow,
    execute: (id) => sql`SELECT * FROM guild_command_receipts WHERE command_id = ${id}`,
  });
  const writeReceipt = SqlSchema.void({
    Request: ReceiptRow,
    execute: (row) => sql`INSERT INTO guild_command_receipts ${sql.insert(row)}`,
  });
  const writeActivity = SqlSchema.void({
    Request: ActivityRow,
    execute: (row) => sql`INSERT INTO guild_activity ${sql.insert(row)}`,
  });
  const readLatestSequence = SqlSchema.findOne({
    Request: Schema.Void,
    Result: Schema.Struct({ sequence: NonNegativeInt }),
    execute: () => sql`SELECT COALESCE(MAX(sequence), 0) AS sequence FROM guild_activity`,
  });
  const readChangesAfter = SqlSchema.findAll({
    Request: Schema.Struct({ sequence: NonNegativeInt, limit: NonNegativeInt }),
    Result: ActivityDeltaRow,
    execute: ({ sequence, limit }) => sql`
      SELECT sequence, delta_json FROM guild_activity
      WHERE sequence > ${sequence} ORDER BY sequence LIMIT ${limit}
    `,
  });

  return GuildStore.of({
    transaction: Effect.fn("GuildStore.transaction")(<A, E, R>(effect: Effect.Effect<A, E, R>) =>
      sql
        .withTransaction(effect)
        .pipe(
          Effect.mapError((cause) =>
            SqlError.isSqlError(cause)
              ? toPersistenceSqlError("GuildStore.transaction")(cause)
              : cause,
          ),
        ),
    ),
    getMaster: Effect.fn("GuildStore.getMaster")(() =>
      readMaster(undefined).pipe(
        Effect.map(Option.getOrNull),
        Effect.mapError(mapStoreError("getMaster")),
      ),
    ),
    saveMaster: Effect.fn("GuildStore.saveMaster")(
      writeMaster,
      Effect.mapError(mapStoreError("saveMaster")),
    ),
    getSettings: Effect.fn("GuildStore.getSettings")(() =>
      readSettings(undefined).pipe(
        Effect.map(({ maxConcurrentAttemptsPerProvider, ...settings }) =>
          maxConcurrentAttemptsPerProvider === null
            ? settings
            : { ...settings, maxConcurrentAttemptsPerProvider },
        ),
        Effect.mapError(mapStoreError("getSettings")),
      ),
    ),
    saveCandidatePool: Effect.fn("GuildStore.saveCandidatePool")(
      writeCandidatePool,
      Effect.mapError(mapStoreError("saveCandidatePool")),
    ),
    getAdventurer: Effect.fn("GuildStore.getAdventurer")(
      readAdventurer,
      Effect.map(Option.getOrNull),
      Effect.mapError(mapStoreError("getAdventurer")),
    ),
    listAdventurerSummaries: Effect.fn("GuildStore.listAdventurerSummaries")(() =>
      readSummaries(undefined).pipe(Effect.mapError(mapStoreError("listAdventurerSummaries"))),
    ),
    listAdventurerChanges: Effect.fn("GuildStore.listAdventurerChanges")(
      readAdventurerChanges,
      Effect.mapError(mapStoreError("listAdventurerChanges")),
    ),
    listLiveAttempts: Effect.fn("GuildStore.listLiveAttempts")(() =>
      readLiveAttempts(undefined).pipe(Effect.mapError(mapStoreError("listLiveAttempts"))),
    ),
    listAttempts: Effect.fn("GuildStore.listAttempts")(
      readAttemptPage,
      Effect.mapError(mapStoreError("listAttempts")),
    ),
    getReceipt: Effect.fn("GuildStore.getReceipt")(
      readReceipt,
      Effect.mapError(mapStoreError("getReceipt")),
    ),
    saveReceipt: Effect.fn("GuildStore.saveReceipt")(
      writeReceipt,
      Effect.mapError(mapStoreError("saveReceipt")),
    ),
    appendActivity: Effect.fn("GuildStore.appendActivity")(
      writeActivity,
      Effect.mapError(mapStoreError("appendActivity")),
    ),
    latestSequence: Effect.fn("GuildStore.latestSequence")(() =>
      readLatestSequence(undefined).pipe(
        Effect.map(({ sequence }) => sequence),
        Effect.mapError(mapStoreError("latestSequence")),
      ),
    ),
    listChangesAfter: Effect.fn("GuildStore.listChangesAfter")((sequence, limit) =>
      readChangesAfter({ sequence, limit }).pipe(
        Effect.mapError(mapStoreError("listChangesAfter")),
      ),
    ),
  });
});

export const layer = Layer.effect(GuildStore, make);
