import { resolveBinding } from "@t3tools/guild-core/binding";
import { transitionConversation } from "@t3tools/guild-core/lifecycle/attempt";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";

import * as CommandReceipts from "../orchestration-v2/CommandReceiptStore.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ThreadLaunch from "../orchestration-v2/ThreadLaunchService.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as VcsStatus from "../vcs/VcsStatusBroadcaster.ts";
import * as GuildRunBridge from "./GuildRunBridge.ts";
import * as GuildService from "./GuildService.ts";
import * as GuildStore from "./GuildStore.ts";
import { attemptActivity } from "./GuildWorkCommands.ts";
import * as GuildWorkStore from "./GuildWorkStore.ts";

class GuildWorkspaceError extends Schema.TaggedError<GuildWorkspaceError>()("GuildWorkspaceError", {
  reason: Schema.Literals(["missing_project", "branch_unavailable"]),
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  override get message() {
    return this.reason === "missing_project"
      ? "The project is unavailable."
      : "Could not read a current project branch for the new worktree.";
  }
}

type WorkerError =
  | GuildStore.GuildStoreError
  | CommandReceipts.CommandReceiptStoreV2Error
  | import("../orchestration-v2/ProjectionStore.ts").ProjectionStoreV2Error;
type OutboxRow = NonNullable<
  Effect.Success<ReturnType<GuildWorkStore.GuildWorkStore["Service"]["nextPending"]>>
>;

export class GuildOutboxWorker extends Context.Service<
  GuildOutboxWorker,
  {
    readonly recover: () => Effect.Effect<void, WorkerError>;
    readonly drain: () => Effect.Effect<void, WorkerError>;
    readonly start: () => Effect.Effect<void, never, Scope.Scope>;
  }
>()("t3/guild/GuildOutboxWorker") {}

const make = Effect.gen(function* () {
  const launch = yield* ThreadLaunch.ThreadLaunchService;
  const receipts = yield* CommandReceipts.CommandReceiptStoreV2;
  const registry = yield* ProviderRegistry.ProviderRegistry;
  const projects = yield* ProjectStore.ProjectStoreV2;
  const vcs = yield* VcsStatus.VcsStatusBroadcaster;
  const bridge = yield* GuildRunBridge.GuildRunBridge;
  const guild = yield* GuildService.GuildService;
  const store = yield* GuildStore.GuildStore;
  const work = yield* GuildWorkStore.GuildWorkStore;
  const lock = yield* Semaphore.make(1);

  const accepted = Effect.fn("GuildOutboxWorker.accepted")(function* (row: OutboxRow) {
    const receipt = yield* receipts.getByCommandId(GuildWorkStore.launchCommandId(row.id));
    return Option.isSome(receipt) && receipt.value.status === "accepted";
  });

  const settle = Effect.fn("GuildOutboxWorker.settle")(function* (
    row: OutboxRow,
    error: string | null,
  ) {
    const threadId = yield* store
      .transaction(
        Effect.gen(function* () {
          const before = yield* work.getAttempt(row.id);
          yield* work.updateOutbox({
            id: row.id,
            status: error === null ? "done" : "failed",
            error,
          });
          if (before === null) return null;
          const at = DateTime.formatIso(yield* DateTime.now);
          const after = transitionConversation(
            before,
            error === null ? { type: "launched" } : { type: "launch_failed", at, reason: error },
          );
          if (before !== after) {
            yield* work.saveAttempt(after);
            yield* store.appendActivity({
              ...attemptActivity(before, after),
              at,
              change: error === null ? "launch_accepted" : "launch_failed",
              actor: "system",
              commandId: GuildWorkStore.launchCommandId(row.id),
            });
          }
          return after.threadId;
        }),
      )
      .pipe(
        Effect.tap(() => guild.notifyCommitted),
        Effect.uninterruptible,
      );
    if (error === null && threadId !== null) yield* bridge.reconcile(threadId);
  });

  const workspaceStrategy = Effect.fn("GuildOutboxWorker.workspaceStrategy")(function* (
    attempt: import("@t3tools/contracts/guild").Attempt,
  ): Effect.fn.Return<ThreadLaunch.ThreadLaunchWorkspaceStrategy, GuildWorkspaceError> {
    if (attempt.workspace.strategy === "root") return { type: "root" };
    const project = yield* projects
      .get(attempt.projectId)
      .pipe(
        Effect.mapError((cause) => new GuildWorkspaceError({ reason: "missing_project", cause })),
      );
    if (Option.isNone(project))
      return yield* new GuildWorkspaceError({ reason: "missing_project" });
    const local = yield* vcs
      .refreshLocalStatus(project.value.workspaceRoot)
      .pipe(
        Effect.mapError(
          (cause) => new GuildWorkspaceError({ reason: "branch_unavailable", cause }),
        ),
      );
    if (local.refName === null)
      return yield* new GuildWorkspaceError({ reason: "branch_unavailable" });
    return { type: "worktree", baseRef: local.refName };
  });

  const run = Effect.fn("GuildOutboxWorker.run")(function* (row: OutboxRow) {
    const attempt = yield* work.getAttempt(row.id);
    if (attempt === null) return yield* settle(row, "The Guild attempt is missing.");
    if (yield* accepted(row)) return yield* settle(row, null);
    if (attempt.status !== "starting")
      return yield* settle(row, "The Guild attempt is no longer starting.");

    const payload = row.payload;
    const providers = yield* registry.getProviders;
    const provider = providers.find(({ instanceId }) => instanceId === attempt.providerInstanceId);
    const resolution = resolveBinding(
      { ...payload.binding, pinnedModel: attempt.requestedModel },
      provider === undefined || (provider.models.length === 0 && provider.auth.status === "unknown")
        ? yield* registry.refreshInstance(attempt.providerInstanceId)
        : providers,
    );
    if ("error" in resolution) return yield* settle(row, resolution.error.reason);

    yield* bridge.track(attempt.threadId);
    const result = yield* workspaceStrategy(attempt).pipe(
      Effect.flatMap((workspaceStrategy) =>
        launch.launch({
          commandId: GuildWorkStore.launchCommandId(row.id),
          threadId: attempt.threadId,
          projectId: attempt.projectId,
          title: payload.title,
          titleRenamed: true,
          modelSelection: resolution.ok,
          runtimeMode: payload.runtimeMode,
          interactionMode: payload.interactionMode,
          workspaceStrategy,
          createdBy: "user",
          creationSource: "server",
          initialMessage: { text: payload.text, attachments: [] },
        }),
      ),
      Effect.result,
    );
    const error =
      Result.isSuccess(result) || (yield* accepted(row)) ? null : result.failure.message;
    yield* settle(row, error);
  });

  const recover = Effect.fn("GuildOutboxWorker.recover")(function* () {
    for (const row of yield* work.listRunning()) {
      if (yield* accepted(row)) yield* settle(row, null);
      else yield* work.updateOutbox({ id: row.id, status: "pending", error: null });
    }
  }, lock.withPermit);

  const drain = Effect.fn("GuildOutboxWorker.drain")(function* () {
    for (;;) {
      const row = yield* store.transaction(
        Effect.gen(function* () {
          const next = yield* work.nextPending();
          if (next !== null)
            yield* work.updateOutbox({ id: next.id, status: "running", error: null });
          return next;
        }),
      );
      if (row === null) return;
      yield* run(row);
    }
  }, lock.withPermit);

  const start = Effect.fn("GuildOutboxWorker.start")(function* () {
    const committed = yield* guild.subscribeCommits;
    yield* recover().pipe(
      Effect.andThen(drain()),
      Effect.andThen(Effect.forever(PubSub.take(committed).pipe(Effect.andThen(drain())))),
      Effect.tapError((error) => Effect.logWarning("Guild launch outbox failed", { error })),
      Effect.retry(Schedule.spaced("1 second")),
      Effect.forkScoped,
    );
  });

  return GuildOutboxWorker.of({ recover, drain, start });
});

export const layer = Layer.effect(GuildOutboxWorker, make);
