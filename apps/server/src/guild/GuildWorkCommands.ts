import { ThreadId, type CommandId } from "@t3tools/contracts";
import {
  Adventurer,
  Attempt,
  GuildAdventurerId,
  GuildAttemptId,
  GuildBindingError,
  GuildCandidateGoneError,
  type GuildCommandConflictError,
  type GuildCommandRejection,
  GuildConversationError,
  type GuildContinueConversationInput,
  type GuildDelta,
  type GuildEndConversationInput,
  type GuildHireAdventurerInput,
  type GuildStartConversationInput,
} from "@t3tools/contracts/guild";
import { resolveBinding } from "@t3tools/guild-core/binding";
import { deriveFamilies } from "@t3tools/guild-core/families";
import { isOpenAttempt } from "@t3tools/guild-core/presentation";
import { guildBriefing } from "@t3tools/guild-core/briefing";
import { transitionConversation } from "@t3tools/guild-core/lifecycle/attempt";
import { generateCandidate, visibleCandidateNames } from "@t3tools/guild-core/recruitment";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
import { toPersistenceSqlError } from "../persistence/Errors.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as GuildStore from "./GuildStore.ts";
import * as GuildWorkStore from "./GuildWorkStore.ts";

type CommandError = GuildCommandRejection | GuildCommandConflictError | GuildStore.GuildStoreError;
export type Change<A> = {
  readonly value: A;
  readonly activity: ReadonlyArray<{
    readonly entity: string;
    readonly entityId: string;
    readonly before: Schema.Json;
    readonly after: Schema.Json;
    readonly delta: GuildDelta;
  }>;
};

type Mutate = <A extends Schema.Json, R>(
  commandId: CommandId,
  operation: string,
  resultSchema: Schema.Decoder<A>,
  apply: (
    at: string,
  ) => Effect.Effect<Change<A>, GuildCommandRejection | GuildStore.GuildStoreError, R>,
) => Effect.Effect<A, CommandError, R>;

function summarize(adventurer: Adventurer, latest: Attempt | null) {
  const { id, name, appearance, classId, status, level } = adventurer;
  const { providerInstanceId, family, pinnedModel } = adventurer.binding;
  return {
    id,
    name,
    appearance,
    classId,
    status,
    level,
    binding: { providerInstanceId, family, pinnedModel },
    latestConversation:
      latest === null
        ? null
        : {
            attemptId: latest.id,
            threadId: latest.threadId,
            ...(!isOpenAttempt(latest) && {
              terminal: { status: latest.status, statusReason: latest.statusReason },
            }),
          },
  };
}

export const attemptActivity = Effect.fn("GuildWorkCommands.attemptActivity")(function* (
  before: Attempt | null,
  after: Attempt,
  store: GuildStore.GuildStore["Service"],
  work: GuildWorkStore.GuildWorkStore["Service"],
) {
  const live = isOpenAttempt(after);
  const upserts: GuildDelta["upserts"][number][] = live ? [{ _tag: "attempt", value: after }] : [];
  if (!live && after.kind === "conversation" && before?.status !== after.status) {
    const latest = yield* work.getLatestConversation(after.adventurerId);
    if (latest?.id === after.id) {
      const adventurer = yield* store.getAdventurer(after.adventurerId);
      if (adventurer) upserts.push({ _tag: "adventurer", value: summarize(adventurer, latest) });
    }
  }
  return {
    entity: "attempt",
    entityId: after.id,
    before,
    after,
    delta: {
      upserts,
      removals: live ? [] : [{ entity: "attempt", id: after.id }],
    } satisfies GuildDelta,
  };
});

export const makeWorkCommands = Effect.fn("GuildWorkCommands.make")(function* (mutate: Mutate) {
  const store = yield* GuildStore.GuildStore;
  const work = yield* GuildWorkStore.GuildWorkStore;
  const random = yield* SecureRandom.SecureRandom;

  const hireAdventurer = Effect.fn("GuildService.hireAdventurer")(
    (input: GuildHireAdventurerInput) =>
      mutate(input.commandId, "hireAdventurer", Adventurer, (at) =>
        Effect.gen(function* () {
          const settings = yield* store.getSettings();
          const pool = settings.candidatePool;
          if (input.pool.seed !== pool.seed)
            return yield* new GuildCandidateGoneError({ code: "candidate_gone" });
          const roster = yield* store.listAdventurerSummaries();
          const taken = roster.filter(({ status }) => status === "active").map(({ name }) => name);
          const candidates = visibleCandidateNames(pool, taken);
          const index = candidates.findIndex((candidate) => candidate.index === input.pool.index);
          if (index < 0) return yield* new GuildCandidateGoneError({ code: "candidate_gone" });
          const candidate = generateCandidate(pool.seed, input.pool.index, [
            ...taken,
            ...candidates.slice(0, index).map(({ name }) => name),
          ]);

          const registry = yield* ProviderRegistry.ProviderRegistry;
          const resolution = resolveBinding(input.binding, yield* registry.getProviders);
          if ("error" in resolution) return yield* new GuildBindingError(resolution.error);

          const value: Adventurer = {
            ...candidate,
            id: GuildAdventurerId.make(yield* random.uuidV4()),
            appearanceVersion: candidate.appearance.v,
            classId: input.classId,
            binding: input.binding,
            defaults: input.defaults,
            specialties: input.specialties,
            instructions: input.instructions,
            rank: null,
            lastProjectId: null,
            status: "active",
            xp: 0,
            level: 0,
            createdAt: at,
            hiredAt: at,
            updatedAt: at,
          };
          const nextSettings = {
            ...settings,
            candidatePool: { ...pool, hiredIndices: [...pool.hiredIndices, input.pool.index] },
          };
          yield* work.insertAdventurer(value);
          yield* work.appendHire({
            adventurerId: value.id,
            at,
            kind: "hired",
            before: null,
            after: value,
            actor: "user",
          });
          yield* store.saveCandidatePool(nextSettings.candidatePool);
          return {
            value,
            activity: [
              {
                entity: "adventurer",
                entityId: value.id,
                before: null,
                after: value,
                delta: {
                  upserts: [{ _tag: "adventurer", value: summarize(value, null) }],
                  removals: [],
                },
              },
              {
                entity: "settings",
                entityId: "settings",
                before: settings,
                after: nextSettings,
                delta: { upserts: [{ _tag: "settings", value: nextSettings }], removals: [] },
              },
            ],
          };
        }),
      ),
  );

  const startConversation = Effect.fn("GuildService.startConversation")(
    (input: GuildStartConversationInput) =>
      mutate(input.commandId, "startConversation", Attempt, (at) =>
        Effect.gen(function* () {
          const adventurer = yield* store.getAdventurer(input.adventurerId);
          if (adventurer?.status !== "active") {
            return yield* new GuildConversationError({ code: "adventurer_unavailable" });
          }
          const latest = yield* work.getLatestConversation(adventurer.id);
          if (latest?.status === "starting" || latest?.status === "active") {
            return yield* new GuildConversationError({ code: "conversation_already_open" });
          }
          const registry = yield* ProviderRegistry.ProviderRegistry;
          const providers = yield* registry.getProviders;
          const resolution = resolveBinding(adventurer.binding, providers);
          if ("error" in resolution) return yield* new GuildBindingError(resolution.error);
          const provider = providers.find(
            ({ instanceId }) => instanceId === resolution.ok.instanceId,
          );
          const family =
            provider === undefined
              ? undefined
              : deriveFamilies(provider).find(({ key }) => key === adventurer.binding.family.key);

          const projects = yield* ProjectStore.ProjectStoreV2;
          const project = yield* projects
            .get(input.projectId)
            .pipe(Effect.mapError(toPersistenceSqlError("GuildService.startConversation.project")));
          if (Option.isNone(project))
            return yield* new GuildConversationError({ code: "project_unavailable" });

          const { instanceId, model, options } = resolution.ok;
          // The snapshot orders conversations by creation time, including consecutive writes in one clock tick.
          const createdAt =
            latest !== null && latest.createdAt >= at
              ? DateTime.formatIso(
                  DateTime.add(DateTime.makeUnsafe(latest.createdAt), { milliseconds: 1 }),
                )
              : at;
          const value: Attempt = {
            id: GuildAttemptId.make(yield* random.uuidV4()),
            threadId: ThreadId.make(yield* random.uuidV4()),
            adventurerId: adventurer.id,
            kind: "conversation",
            questId: null,
            attemptNumber: null,
            role: null,
            classIdAtStart: adventurer.classId,
            familyKeyAtStart: adventurer.binding.family.key,
            providerInstanceId: instanceId,
            requestedModel: model,
            requestedOptions: options ?? null,
            executedModels: [],
            projectId: input.projectId,
            status: "starting",
            statusReason: null,
            errorClass: null,
            workspace: {
              strategy: input.workspace === "root" ? "root" : "own_worktree",
              worktreePath: null,
              branch: null,
              baseRevision: null,
            },
            usage: { status: "unavailable" },
            startedAt: at,
            endedAt: null,
            createdAt,
          };
          const after = { ...adventurer, lastProjectId: input.projectId, updatedAt: at };
          yield* work.saveAttempt(value);
          yield* work.saveLastProject({ id: adventurer.id, projectId: input.projectId, at });
          yield* work.enqueue({
            id: value.id,
            kind: "launch",
            status: "pending",
            createdAt,
            payload: {
              binding: adventurer.binding,
              familyModels: [
                ...new Set(
                  family?.models.flatMap(({ slug, aliases }) => [slug, ...(aliases ?? [])]),
                ),
              ],
              title: `${adventurer.name} · ${Array.from(input.message).slice(0, 60).join("")}`,
              text: `${guildBriefing(adventurer)}\n\n${input.message}`,
              runtimeMode: adventurer.defaults.runtimeMode,
              interactionMode: adventurer.defaults.interactionMode,
            },
          });
          return {
            value,
            activity: [
              yield* attemptActivity(null, value, store, work),
              {
                entity: "adventurer",
                entityId: adventurer.id,
                before: { lastProjectId: adventurer.lastProjectId },
                after: { lastProjectId: after.lastProjectId },
                delta: {
                  upserts: [{ _tag: "adventurer", value: summarize(after, value) }],
                  removals: [],
                },
              },
            ],
          };
        }),
      ),
  );

  const continueConversation = Effect.fn("GuildService.continueConversation")(
    (input: GuildContinueConversationInput) =>
      mutate(input.commandId, "continueConversation", Attempt, (at) =>
        Effect.gen(function* () {
          const attempt = yield* work.getAttempt(input.attemptId);
          if (attempt?.kind !== "conversation" || attempt.status !== "active") {
            return yield* new GuildConversationError({ code: "conversation_not_active" });
          }
          const adventurer = yield* store.getAdventurer(attempt.adventurerId);
          if (adventurer?.status !== "active") {
            return yield* new GuildConversationError({ code: "adventurer_unavailable" });
          }
          const registry = yield* ProviderRegistry.ProviderRegistry;
          const resolution = resolveBinding(adventurer.binding, yield* registry.getProviders);
          if ("error" in resolution) return yield* new GuildBindingError(resolution.error);
          yield* work.enqueue({
            id: GuildWorkStore.continueOutboxId(input.commandId),
            kind: "continue",
            status: "pending",
            createdAt: at,
            payload: { attemptId: attempt.id, text: input.message },
          });
          return { value: attempt, activity: [] };
        }),
      ),
  );

  const endConversation = Effect.fn("GuildService.endConversation")(
    (input: GuildEndConversationInput) =>
      mutate(input.commandId, "endConversation", Attempt, (at) =>
        Effect.gen(function* () {
          const before = yield* work.getAttempt(input.attemptId);
          if (before === null || before.kind !== "conversation") {
            return yield* new GuildConversationError({ code: "conversation_not_active" });
          }
          if (before.status === "completed") return { value: before, activity: [] };
          const value = transitionConversation(before, { type: "ended", at });
          if (value === before) {
            return yield* new GuildConversationError({ code: "conversation_not_active" });
          }
          const threads = yield* ThreadManagement.ThreadManagementService;
          const shell = yield* threads
            .getThreadShell(before.threadId)
            .pipe(Effect.mapError(toPersistenceSqlError("GuildService.endConversation.thread")));
          if (shell?.pendingRuntimeRequest) {
            return yield* new GuildConversationError({ code: "conversation_needs_attention" });
          }
          if (
            (shell &&
              (shell.activeRunId !== null ||
                shell.activityRunStatus != null ||
                shell.status === "queued" ||
                shell.status === "preparing" ||
                shell.status === "running" ||
                shell.status === "waiting")) ||
            (yield* work.hasPendingContinuation(before.id))
          ) {
            return yield* new GuildConversationError({ code: "conversation_busy" });
          }
          yield* work.saveAttempt(value);
          return { value, activity: [yield* attemptActivity(before, value, store, work)] };
        }),
      ),
  );

  return { hireAdventurer, startConversation, continueConversation, endConversation };
});
