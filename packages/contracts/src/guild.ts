import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import {
  CommandId,
  GitRefName,
  NonNegativeInt,
  PositiveInt,
  ProjectId,
  ProviderTurnId,
  RunAttemptId,
  RunId,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";
import {
  OrchestrationV2ProviderFailureClass,
  OrchestrationV2ProviderTurn,
} from "./orchestrationV2.ts";
import { ProviderInstanceId } from "./providerInstance.ts";
import { ProviderInteractionMode, RuntimeMode } from "./providerPolicy.ts";
import { TurnTokenUsage } from "./providerRuntime.ts";

export const GuildAdventurerId = TrimmedNonEmptyString.pipe(Schema.brand("GuildAdventurerId"));
export type GuildAdventurerId = typeof GuildAdventurerId.Type;
export const GuildAttemptId = TrimmedNonEmptyString.pipe(Schema.brand("GuildAttemptId"));
export type GuildAttemptId = typeof GuildAttemptId.Type;
export const GuildQuestId = TrimmedNonEmptyString.pipe(Schema.brand("GuildQuestId"));
export type GuildQuestId = typeof GuildQuestId.Type;

const timestamp = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      const instant = DateTime.make(value);
      return Option.isSome(instant) && DateTime.formatIso(instant.value) === value;
    },
    { expected: "a canonical ISO UTC timestamp" },
  ),
);

export const Appearance = Schema.Struct({
  v: Schema.Literal(1),
  species: TrimmedNonEmptyString,
  head: TrimmedNonEmptyString,
  top: TrimmedNonEmptyString,
  face: TrimmedNonEmptyString,
  outfit: TrimmedNonEmptyString,
  boots: TrimmedNonEmptyString,
  back: TrimmedNonEmptyString,
  weapon: TrimmedNonEmptyString,
  palette: TrimmedNonEmptyString,
});
export type Appearance = typeof Appearance.Type;

export const CandidatePool = Schema.Struct({
  seed: TrimmedNonEmptyString,
  hiredIndices: Schema.Array(NonNegativeInt).check(
    Schema.makeFilter((indices) => new Set(indices).size === indices.length, {
      expected: "unique hired indices",
    }),
  ),
});
export type CandidatePool = typeof CandidatePool.Type;

export const GuildSettings = Schema.Struct({
  candidatePool: CandidatePool,
  maxConcurrentAttempts: PositiveInt,
  maxConcurrentAttemptsPerProvider: Schema.optionalKey(
    Schema.Record(ProviderInstanceId, PositiveInt),
  ),
  xpRulesVersion: PositiveInt,
});
export type GuildSettings = typeof GuildSettings.Type;

export const GuildMasterLocation = Schema.Struct({
  sceneId: TrimmedNonEmptyString,
  doorId: Schema.NullOr(TrimmedNonEmptyString),
  x: Schema.Finite,
  facing: Schema.Literals([-1, 1]),
});
export type GuildMasterLocation = typeof GuildMasterLocation.Type;

const masterIdentityFields = {
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(24)),
  appearance: Appearance,
};
export const GuildMaster = Schema.Struct({
  ...masterIdentityFields,
  createdAt: timestamp,
  location: GuildMasterLocation,
});
export type GuildMaster = typeof GuildMaster.Type;

export const ClassId = Schema.Literals([
  "warrior",
  "ranger",
  "scout",
  "mage",
  "cleric",
  "paladin",
  "artificer",
  "scribe",
  "commander",
]);
export type ClassId = typeof ClassId.Type;

export const ModelBinding = Schema.Struct({
  providerInstanceId: ProviderInstanceId,
  family: Schema.Struct({ key: TrimmedNonEmptyString, label: TrimmedNonEmptyString }),
  pinnedModel: Schema.NullOr(TrimmedNonEmptyString),
  options: Schema.NullOr(Schema.Record(TrimmedNonEmptyString, TrimmedNonEmptyString)),
});
export type ModelBinding = typeof ModelBinding.Type;

export const AdventurerDefaults = Schema.Struct({
  runtimeMode: RuntimeMode,
  interactionMode: ProviderInteractionMode,
  maxWriteAttempts: PositiveInt,
});
export type AdventurerDefaults = typeof AdventurerDefaults.Type;

export const Adventurer = Schema.Struct({
  id: GuildAdventurerId,
  name: TrimmedNonEmptyString,
  appearance: Appearance,
  appearanceVersion: PositiveInt,
  classId: ClassId,
  specialties: Schema.Array(TrimmedNonEmptyString),
  rank: Schema.NullOr(TrimmedNonEmptyString),
  binding: ModelBinding,
  defaults: AdventurerDefaults,
  lastProjectId: Schema.NullOr(ProjectId),
  instructions: Schema.String,
  status: Schema.Literals(["active", "archived"]),
  xp: NonNegativeInt,
  level: NonNegativeInt,
  createdAt: timestamp,
  hiredAt: timestamp,
  updatedAt: timestamp,
});
export type Adventurer = typeof Adventurer.Type;

export const AdventurerChange = Schema.Struct({
  adventurerId: GuildAdventurerId,
  at: timestamp,
  kind: Schema.Literals([
    "hired",
    "renamed",
    "class_changed",
    "binding_changed",
    "defaults_changed",
    "instructions_changed",
    "appearance_changed",
    "archived",
    "restored",
  ]),
  before: Schema.NullOr(Schema.Json),
  after: Schema.Json,
  actor: Schema.Literals(["user", "system"]),
});
export type AdventurerChange = typeof AdventurerChange.Type;

export const AttemptStatus = Schema.Literals([
  "starting",
  "active",
  "paused",
  "submitted",
  "completed",
  "superseded",
  "failed",
  "cancelled",
]);
export type AttemptStatus = typeof AttemptStatus.Type;

const usageFields = {
  inputTokens: Schema.optionalKey(NonNegativeInt),
  outputTokens: Schema.optionalKey(NonNegativeInt),
  cachedInputTokens: Schema.optionalKey(NonNegativeInt),
  cacheCreationTokens: Schema.optionalKey(NonNegativeInt),
  reasoningTokens: Schema.optionalKey(NonNegativeInt),
};
export const AttemptUsage = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("unavailable"),
    inputTokens: Schema.optionalKey(Schema.Never),
    outputTokens: Schema.optionalKey(Schema.Never),
    cachedInputTokens: Schema.optionalKey(Schema.Never),
    cacheCreationTokens: Schema.optionalKey(Schema.Never),
    reasoningTokens: Schema.optionalKey(Schema.Never),
  }),
  Schema.Struct({ status: Schema.Literals(["complete", "partial"]), ...usageFields }),
]);
export type AttemptUsage = typeof AttemptUsage.Type;

export const Attempt = Schema.Struct({
  id: GuildAttemptId,
  adventurerId: GuildAdventurerId,
  kind: Schema.Literals(["conversation", "quest"]),
  questId: Schema.NullOr(GuildQuestId),
  attemptNumber: Schema.NullOr(PositiveInt),
  role: Schema.NullOr(
    Schema.Literals(["implementer", "investigator", "reviewer", "verifier", "observer", "leader"]),
  ),
  classIdAtStart: ClassId,
  familyKeyAtStart: TrimmedNonEmptyString,
  threadId: ThreadId,
  projectId: ProjectId,
  providerInstanceId: ProviderInstanceId,
  requestedModel: TrimmedNonEmptyString,
  requestedOptions: Schema.NullOr(Schema.Json),
  executedModels: Schema.Array(TrimmedNonEmptyString),
  status: AttemptStatus,
  statusReason: Schema.NullOr(TrimmedNonEmptyString),
  errorClass: Schema.NullOr(OrchestrationV2ProviderFailureClass),
  workspace: Schema.Struct({
    strategy: Schema.Literals(["root", "own_worktree", "mission_branch", "read_only_snapshot"]),
    worktreePath: Schema.NullOr(TrimmedNonEmptyString),
    branch: Schema.NullOr(GitRefName),
    baseRevision: Schema.NullOr(TrimmedNonEmptyString),
  }),
  usage: AttemptUsage,
  startedAt: timestamp,
  endedAt: Schema.NullOr(timestamp),
  createdAt: timestamp,
});
export type Attempt = typeof Attempt.Type;

export const AttemptTurn = Schema.Struct({
  attemptId: GuildAttemptId,
  providerTurnId: ProviderTurnId,
  t3RunAttemptId: Schema.NullOr(RunAttemptId),
  t3RunId: Schema.NullOr(RunId),
  status: OrchestrationV2ProviderTurn.fields.status,
  requestedModel: TrimmedNonEmptyString,
  executedModel: Schema.NullOr(TrimmedNonEmptyString),
  turnTokenUsage: Schema.NullOr(TurnTokenUsage),
  errorClass: Schema.NullOr(OrchestrationV2ProviderFailureClass),
  startedAt: Schema.NullOr(timestamp),
  endedAt: Schema.NullOr(timestamp),
});
export type AttemptTurn = typeof AttemptTurn.Type;

export const AdventurerSummary = Schema.Struct({
  ...Struct.pick(Adventurer.fields, ["id", "name", "appearance", "classId", "status", "level"]),
  binding: ModelBinding.mapFields(Struct.pick(["providerInstanceId", "family", "pinnedModel"])),
  latestConversation: Schema.NullOr(
    Schema.Struct({
      attemptId: GuildAttemptId,
      threadId: ThreadId,
      terminal: Schema.optionalKey(Attempt.mapFields(Struct.pick(["status", "statusReason"]))),
    }),
  ),
});
export type AdventurerSummary = typeof AdventurerSummary.Type;

export const GuildSnapshot = Schema.Struct({
  settings: GuildSettings,
  master: Schema.NullOr(GuildMaster),
  adventurers: Schema.Array(AdventurerSummary),
  attempts: Schema.Array(Attempt),
  attemptThreadIds: Schema.optionalKey(Schema.Array(ThreadId)),
});
export type GuildSnapshot = typeof GuildSnapshot.Type;

export const GuildEntity = Schema.Union([
  Schema.TaggedStruct("settings", { value: GuildSettings }),
  Schema.TaggedStruct("master", { value: GuildMaster }),
  Schema.TaggedStruct("adventurer", { value: AdventurerSummary }),
  Schema.TaggedStruct("attempt", { value: Attempt }),
]);
export type GuildEntity = typeof GuildEntity.Type;

export const GuildDelta = Schema.Struct({
  upserts: Schema.Array(GuildEntity),
  removals: Schema.Array(
    Schema.Union([
      Schema.Struct({ entity: Schema.Literal("master"), id: Schema.Literal("master") }),
      Schema.Struct({ entity: Schema.Literal("adventurer"), id: GuildAdventurerId }),
      Schema.Struct({ entity: Schema.Literal("attempt"), id: GuildAttemptId }),
    ]),
  ),
});
export type GuildDelta = typeof GuildDelta.Type;

export const GuildStreamItem = Schema.Union([
  Schema.TaggedStruct("snapshot", { sequence: NonNegativeInt, guild: GuildSnapshot }),
  Schema.TaggedStruct("changed", { sequence: PositiveInt, ...GuildDelta.fields }),
  Schema.TaggedStruct("synchronized", { sequence: NonNegativeInt }),
]);
export type GuildStreamItem = typeof GuildStreamItem.Type;

export class GuildMasterAlreadyExistsError extends Schema.TaggedError<GuildMasterAlreadyExistsError>()(
  "GuildMasterAlreadyExistsError",
  {},
) {
  override get message() {
    return "A Guild Master already exists.";
  }
}

export class GuildMasterMissingError extends Schema.TaggedError<GuildMasterMissingError>()(
  "GuildMasterMissingError",
  {},
) {
  override get message() {
    return "Create a Guild Master first.";
  }
}

export class GuildAdventurerNotFoundError extends Schema.TaggedError<GuildAdventurerNotFoundError>()(
  "GuildAdventurerNotFoundError",
  { adventurerId: GuildAdventurerId },
) {
  override get message() {
    return "The adventurer could not be found.";
  }
}

export class GuildCommandConflictError extends Schema.TaggedError<GuildCommandConflictError>()(
  "GuildCommandConflictError",
  {},
) {
  override get message() {
    return "This command ID has already been used for a different Guild action.";
  }
}

export class GuildNotImplementedError extends Schema.TaggedError<GuildNotImplementedError>()(
  "GuildNotImplementedError",
  { action: Schema.Literals(["hireAdventurer", "startConversation", "endConversation"]) },
) {
  override get message() {
    return "This Guild action is not implemented yet.";
  }
}

export class GuildPersistenceError extends Schema.TaggedError<GuildPersistenceError>()(
  "GuildPersistenceError",
  { cause: Schema.Defect() },
) {
  override get message() {
    return "Guild data could not be read or saved.";
  }
}

export class GuildAppearanceError extends Schema.TaggedError<GuildAppearanceError>()(
  "GuildAppearanceError",
  {},
) {
  override get message() {
    return "The appearance includes an invalid part.";
  }
}

export class GuildCandidateGoneError extends Schema.TaggedError<GuildCandidateGoneError>()(
  "GuildCandidateGoneError",
  { code: Schema.Literal("candidate_gone") },
) {
  override get message() {
    return "This candidate is no longer in the recruitment pool.";
  }
}

export class GuildBindingError extends Schema.TaggedError<GuildBindingError>()(
  "GuildBindingError",
  {
    code: Schema.Literals([
      "provider_unavailable",
      "pinned_model_unavailable",
      "family_unavailable",
      "option_unavailable",
    ]),
    reason: TrimmedNonEmptyString,
  },
) {
  override get message() {
    return this.reason;
  }
}

export class GuildConversationError extends Schema.TaggedError<GuildConversationError>()(
  "GuildConversationError",
  {
    code: Schema.Literals([
      "adventurer_unavailable",
      "project_unavailable",
      "conversation_already_open",
      "conversation_not_active",
      "conversation_busy",
      "conversation_needs_attention",
    ]),
  },
) {
  override get message() {
    switch (this.code) {
      case "adventurer_unavailable":
        return "Choose an active adventurer.";
      case "project_unavailable":
        return "The project is unavailable.";
      case "conversation_already_open":
        return "Open or end the adventurer's current conversation first.";
      case "conversation_not_active":
        return "This conversation is no longer active.";
      case "conversation_busy":
        return "Wait for the conversation to finish its current work before ending it.";
      case "conversation_needs_attention":
        return "Respond to the pending request before ending this conversation.";
    }
  }
}

export const GuildCommandRejection = Schema.Union([
  GuildMasterAlreadyExistsError,
  GuildMasterMissingError,
  GuildNotImplementedError,
  GuildAppearanceError,
  GuildCandidateGoneError,
  GuildBindingError,
  GuildConversationError,
]);
export type GuildCommandRejection = typeof GuildCommandRejection.Type;

export const GuildSubscribeInput = Schema.Struct({
  afterSequence: Schema.optionalKey(NonNegativeInt),
});
export type GuildSubscribeInput = typeof GuildSubscribeInput.Type;
export const GuildCreateMasterInput = Schema.Struct({
  commandId: CommandId,
  ...masterIdentityFields,
});
export type GuildCreateMasterInput = typeof GuildCreateMasterInput.Type;
export const GuildUpdateMasterInput = GuildCreateMasterInput;
export type GuildUpdateMasterInput = typeof GuildUpdateMasterInput.Type;
export const GuildSetMasterLocationInput = Schema.Struct({
  commandId: CommandId,
  ...GuildMasterLocation.fields,
});
export type GuildSetMasterLocationInput = typeof GuildSetMasterLocationInput.Type;
export const GuildRefreshCandidatesInput = Schema.Struct({ commandId: CommandId });
export type GuildRefreshCandidatesInput = typeof GuildRefreshCandidatesInput.Type;

export const GuildGetAdventurerProfileInput = Schema.Struct({ adventurerId: GuildAdventurerId });
export type GuildGetAdventurerProfileInput = typeof GuildGetAdventurerProfileInput.Type;
export const GuildAdventurerProfile = Schema.Struct({
  adventurer: Adventurer,
  changes: Schema.Array(AdventurerChange),
});
export type GuildAdventurerProfile = typeof GuildAdventurerProfile.Type;

const AttemptCursor = Attempt.mapFields(Struct.pick(["createdAt", "id"]));
export const GuildListAttemptsInput = Schema.Struct({
  adventurerId: Schema.optionalKey(GuildAdventurerId),
  questId: Schema.optionalKey(GuildQuestId),
  cursor: Schema.optionalKey(AttemptCursor),
  limit: Schema.optionalKey(PositiveInt.check(Schema.isLessThanOrEqualTo(100))),
});
export type GuildListAttemptsInput = typeof GuildListAttemptsInput.Type;
export const GuildAttemptPage = Schema.Struct({
  attempts: Schema.Array(Attempt),
  nextCursor: Schema.NullOr(AttemptCursor),
});
export type GuildAttemptPage = typeof GuildAttemptPage.Type;

export const GuildHireAdventurerInput = Schema.Struct({
  commandId: CommandId,
  pool: Schema.Struct({ seed: TrimmedNonEmptyString, index: NonNegativeInt }),
  ...Struct.pick(Adventurer.fields, [
    "classId",
    "binding",
    "defaults",
    "specialties",
    "instructions",
  ]),
});
export type GuildHireAdventurerInput = typeof GuildHireAdventurerInput.Type;
export const GuildStartConversationInput = Schema.Struct({
  commandId: CommandId,
  adventurerId: GuildAdventurerId,
  projectId: ProjectId,
  message: TrimmedNonEmptyString,
  workspace: Schema.Literals(["root", "worktree"]),
});
export type GuildStartConversationInput = typeof GuildStartConversationInput.Type;
export const GuildContinueConversationInput = Schema.Struct({
  commandId: CommandId,
  attemptId: GuildAttemptId,
  message: TrimmedNonEmptyString,
});
export type GuildContinueConversationInput = typeof GuildContinueConversationInput.Type;

export const GuildEndConversationInput = Schema.Struct({
  commandId: CommandId,
  attemptId: GuildAttemptId,
});
export type GuildEndConversationInput = typeof GuildEndConversationInput.Type;
