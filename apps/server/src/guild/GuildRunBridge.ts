import type {
  OrchestrationV2DomainEvent,
  OrchestrationV2ProviderTurn,
  OrchestrationV2Run,
  OrchestrationV2RunAttempt,
  ThreadId,
} from "@t3tools/contracts";
import type { Attempt, AttemptTurn } from "@t3tools/contracts/guild";
import { familyIncludesModel } from "@t3tools/guild-core/families";
import { transitionConversation } from "@t3tools/guild-core/lifecycle/attempt";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import * as EventSink from "../orchestration-v2/EventSink.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as GuildService from "./GuildService.ts";
import * as GuildStore from "./GuildStore.ts";
import { attemptActivity } from "./GuildWorkCommands.ts";
import * as GuildWorkStore from "./GuildWorkStore.ts";

type BridgeError = GuildStore.GuildStoreError | ProjectionStore.ProjectionStoreV2Error;

export class GuildRunBridge extends Context.Service<
  GuildRunBridge,
  {
    readonly handle: (event: OrchestrationV2DomainEvent) => Effect.Effect<void, BridgeError>;
    readonly track: (threadId: ThreadId) => Effect.Effect<void>;
    readonly reconcile: (threadId: ThreadId) => Effect.Effect<void, BridgeError>;
    readonly start: () => Effect.Effect<
      void,
      BridgeError | EventSink.EventSinkV2Error,
      Scope.Scope
    >;
  }
>()("t3/guild/GuildRunBridge") {}

const formatTimestamp = (time: DateTime.Utc | null) =>
  time === null ? null : DateTime.formatIso(time);

const make = Effect.gen(function* () {
  const events = yield* EventSink.EventSinkV2;
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const registry = yield* ProviderRegistry.ProviderRegistry;
  const guild = yield* GuildService.GuildService;
  const store = yield* GuildStore.GuildStore;
  const work = yield* GuildWorkStore.GuildWorkStore;
  const tracked = new Set<ThreadId>();

  const track = Effect.fn("GuildRunBridge.track")((threadId: ThreadId) =>
    Effect.sync(() => {
      tracked.add(threadId);
    }),
  );

  const recordTurn = Effect.fn("GuildRunBridge.recordTurn")(function* (
    attempt: Attempt,
    turn: OrchestrationV2ProviderTurn,
    runAttempt: OrchestrationV2RunAttempt | undefined,
    run: OrchestrationV2Run | undefined,
  ) {
    const value: AttemptTurn = {
      attemptId: attempt.id,
      providerTurnId: turn.id,
      t3RunAttemptId: turn.runAttemptId,
      t3RunId: runAttempt?.runId ?? null,
      status: turn.status,
      requestedModel: run?.modelSelection.model ?? attempt.requestedModel,
      executedModel: turn.model ?? null,
      turnTokenUsage: turn.turnTokenUsage ?? null,
      errorClass: null,
      startedAt: formatTimestamp(turn.startedAt),
      endedAt: formatTimestamp(turn.completedAt),
    };
    yield* work.saveTurn(value);
  });

  const persistAttempt = Effect.fn("GuildRunBridge.persistAttempt")(function* (
    before: Attempt,
    after: Attempt,
    observedModels: readonly string[],
    at: string,
  ) {
    const added = [...new Set(observedModels)].filter(
      (model) => !before.executedModels.includes(model),
    );
    if (before === after && added.length === 0) return false;

    const value = { ...after, executedModels: [...before.executedModels, ...added] };
    yield* work.saveAttempt(value);
    yield* store.appendActivity({
      ...(yield* attemptActivity(before, value, store, work)),
      at,
      change: "reconcile_attempt",
      actor: "system",
      commandId: null,
    });

    const changedModels = added.filter((model) => model !== before.requestedModel);
    if (changedModels.length > 0) {
      const familyModels = yield* work.getLaunchFamilyModels(before.id);
      const provider = (yield* registry.getProviders).find(
        ({ instanceId }) => instanceId === before.providerInstanceId,
      );
      for (const model of changedModels) {
        if (
          familyModels.includes(model) ||
          familyIncludesModel(before.familyKeyAtStart, model, provider)
        )
          continue;
        yield* store.appendActivity({
          at,
          entity: "attempt",
          entityId: before.id,
          change: "executed_model_outside_family",
          before: null,
          after: { model },
          actor: "system",
          commandId: null,
          delta: { upserts: [], removals: [] },
        });
      }
    }
    return true;
  });

  const commit = <E>(effect: Effect.Effect<boolean, E>) =>
    store.transaction(effect).pipe(
      Effect.tap((changed) => (changed ? guild.notifyCommitted : Effect.void)),
      Effect.uninterruptible,
      Effect.asVoid,
    );

  const reconcile = Effect.fn("GuildRunBridge.reconcile")(function* (threadId: ThreadId) {
    yield* track(threadId);
    yield* commit(
      Effect.gen(function* () {
        const before = yield* work.getAttemptByThread(threadId);
        if (before === null) return false;
        const now = DateTime.formatIso(yield* DateTime.now);
        const thread = yield* projections.findThread(threadId);
        if (thread === null) {
          const after =
            before.status === "active" || before.status === "completed"
              ? transitionConversation(before, { type: "thread_deleted", at: now })
              : before;
          return yield* persistAttempt(before, after, [], now);
        }

        const records = yield* projections.getThreadRecords(threadId, [
          "providerTurns",
          "attempts",
          "runs",
        ]);
        const runAttempts = new Map(records.attempts.map((attempt) => [attempt.id, attempt]));
        const runs = new Map(records.runs.map((run) => [run.id, run]));
        const models: string[] = [];
        for (const turn of records.providerTurns) {
          const runAttempt =
            turn.runAttemptId === null ? undefined : runAttempts.get(turn.runAttemptId);
          yield* recordTurn(
            before,
            turn,
            runAttempt,
            runAttempt === undefined ? undefined : runs.get(runAttempt.runId),
          );
          if (turn.model !== undefined) models.push(turn.model);
        }

        const at = formatTimestamp(thread.deletedAt) ?? now;
        let after =
          thread.deletedAt === null
            ? transitionConversation(before, { type: "launched" })
            : transitionConversation(before, { type: "thread_deleted", at });
        if (
          after.workspace.branch !== thread.branch ||
          after.workspace.worktreePath !== thread.worktreePath
        ) {
          after = {
            ...after,
            workspace: {
              ...after.workspace,
              branch: thread.branch,
              worktreePath: thread.worktreePath,
            },
          };
        }
        return yield* persistAttempt(before, after, models, at);
      }),
    );
  });

  const handle = Effect.fn("GuildRunBridge.handle")(function* (event: OrchestrationV2DomainEvent) {
    if (!tracked.has(event.threadId)) return;
    if (event.type === "thread.metadata-updated") return yield* reconcile(event.threadId);
    if (event.type !== "provider-turn.updated" && event.type !== "thread.deleted") return;
    yield* commit(
      Effect.gen(function* () {
        const before = yield* work.getAttemptByThread(event.threadId);
        if (before === null) return false;
        const at = DateTime.formatIso(event.occurredAt);
        if (event.type === "thread.deleted") {
          return yield* persistAttempt(
            before,
            transitionConversation(before, { type: "thread_deleted", at }),
            [],
            at,
          );
        }

        if (event.type !== "provider-turn.updated") return false;
        // A queued event can predate startup reconciliation or the immediate post-launch read.
        const records = yield* projections
          .getThreadRecords(event.threadId, ["providerTurns", "attempts"], {
            providerTurnIds: [event.payload.id],
            attemptIds: event.payload.runAttemptId === null ? [] : [event.payload.runAttemptId],
          })
          .pipe(
            Effect.catchTags({ ProjectionStoreThreadNotFoundError: () => Effect.succeed(null) }),
          );
        const turn = records?.providerTurns[0] ?? event.payload;
        const runAttempt = records?.attempts[0];
        const run =
          runAttempt === undefined
            ? undefined
            : (yield* projections.getThreadRecords(event.threadId, ["runs"], {
                runIds: [runAttempt.runId],
              })).runs[0];
        yield* recordTurn(before, turn, runAttempt, run);
        return yield* persistAttempt(
          before,
          before,
          [event.payload.model, turn.model].filter((model) => model !== undefined),
          at,
        );
      }),
    );
  });

  const start = Effect.fn("GuildRunBridge.start")(function* () {
    let cursor = yield* events.latestSequence();
    const threads = yield* work.listAttemptThreads();
    yield* Effect.forEach(threads, reconcile, { discard: true });
    yield* Stream.suspend(() => events.stream({ afterSequence: cursor })).pipe(
      Stream.runForEach(({ event, sequence }) =>
        handle(event).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              cursor = sequence;
            }),
          ),
        ),
      ),
      Effect.tapError((error) =>
        Effect.logWarning("Guild attempt reconciliation failed", { error }),
      ),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forkScoped,
    );
  });

  return GuildRunBridge.of({ handle, track, reconcile, start });
});

export const layer = Layer.effect(GuildRunBridge, make);
