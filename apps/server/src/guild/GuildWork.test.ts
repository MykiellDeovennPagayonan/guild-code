import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert, it } from "@effect/vitest";
import {
  CommandId,
  EventId,
  MessageId,
  NodeId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderThreadId,
  ProviderTurnId,
  RunAttemptId,
  RunId,
  type OrchestrationV2DomainEvent,
  type OrchestrationV2Run,
  type ServerProvider,
} from "@t3tools/contracts";
import { GuildHireAdventurerInput, type Adventurer, type Attempt } from "@t3tools/contracts/guild";
import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import { generateCandidate } from "@t3tools/guild-core/recruitment";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import * as CommandReceipts from "../orchestration-v2/CommandReceiptStore.ts";
import * as EventSink from "../orchestration-v2/EventSink.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ThreadLaunch from "../orchestration-v2/ThreadLaunchService.ts";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as VcsStatus from "../vcs/VcsStatusBroadcaster.ts";
import * as GuildOutboxWorker from "./GuildOutboxWorker.ts";
import * as GuildRunBridge from "./GuildRunBridge.ts";
import * as GuildService from "./GuildService.ts";
import * as GuildStore from "./GuildStore.ts";
import * as GuildWorkStore from "./GuildWorkStore.ts";

const decodeHireInput = Schema.decodeUnknownSync(GuildHireAdventurerInput);
const projectId = ProjectId.make("guild-project");
const providerInstanceId = ProviderInstanceId.make("codex");
const asOf = "2026-11-27T00:00:00.000Z";
const models = [
  {
    slug: "gpt-6-astra",
    name: "GPT 6 Astra",
    isCustom: false,
    isDefault: true,
    capabilities: {
      optionDescriptors: [
        {
          id: "effort",
          label: "Reasoning effort",
          type: "select",
          role: "reasoning",
          options: [{ id: "high", label: "High" }],
        },
      ],
    },
  },
  { slug: "gpt-6-luna", name: "GPT 6 Luna", isCustom: false, capabilities: null },
] satisfies ServerProvider["models"];
const codex: ServerProvider = {
  instanceId: providerInstanceId,
  driver: ProviderDriverKind.make("codex"),
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: asOf,
  slashCommands: [],
  skills: [],
  models,
};

const dependencies = Layer.mergeAll(
  GuildService.layer,
  GuildStore.layer,
  GuildWorkStore.layer,
  CommandReceipts.layer,
  ProjectStore.layer,
  ProjectionStore.layer,
  Layer.mock(EventSink.EventSinkV2)({
    latestSequence: () => Effect.succeed(0),
    stream: () => Stream.empty,
  }),
  Layer.mock(VcsStatus.VcsStatusBroadcaster)({
    refreshLocalStatus: (cwd) =>
      Effect.sync(() => {
        assert.equal(cwd, "/tmp/guild-project");
        return {
          isRepo: true,
          hasPrimaryRemote: false,
          isDefaultRef: false,
          refName: "feature/current",
          hasWorkingTreeChanges: false,
          workingTree: { files: [], insertions: 0, deletions: 0 },
        };
      }),
  }),
).pipe(Layer.provide(NodeCrypto.layer));

const acceptLaunch = Effect.fn("GuildWorkTest.acceptLaunch")(function* (
  input: ThreadLaunch.ThreadLaunchInput,
) {
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const receipts = yield* CommandReceipts.CommandReceiptStoreV2;
  const threadId = input.threadId;
  assert.isDefined(threadId);
  if (threadId === undefined) return yield* Effect.die("Expected the Guild thread id");
  const now = yield* DateTime.now;
  yield* projections.apply({
    id: EventId.make(`create:${threadId}`),
    threadId,
    type: "thread.created",
    occurredAt: now,
    payload: {
      id: threadId,
      projectId: input.projectId,
      title: input.title,
      providerInstanceId: input.modelSelection.instanceId,
      modelSelection: input.modelSelection,
      runtimeMode: input.runtimeMode,
      interactionMode: input.interactionMode,
      createdBy: input.createdBy,
      creationSource: input.creationSource,
      branch: null,
      worktreePath: null,
      activeProviderThreadId: null,
      lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
      forkedFrom: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      settledOverride: null,
      settledAt: null,
      lastVisitedAt: null,
      deletedAt: null,
    },
  });
  yield* receipts.insertIfAbsent({
    commandId: input.commandId,
    threadId,
    commandType: "thread.create",
    acceptedAt: now,
    resultSequence: 1,
    status: "accepted",
    error: null,
  });
  return { threadId, projection: yield* projections.getThreadProjection(threadId), resumed: false };
});

const harness = Effect.fn("GuildWorkTest.harness")(function* (
  mode: "success" | "error_after_accept" | "error_before_accept" = "success",
) {
  const providers = yield* Ref.make<readonly ServerProvider[]>([codex]);
  const launches: ThreadLaunch.ThreadLaunchInput[] = [];
  const launcher = Layer.unwrap(
    Effect.gen(function* () {
      const context = yield* Effect.context<
        ProjectionStore.ProjectionStoreV2 | CommandReceipts.CommandReceiptStoreV2
      >();
      return Layer.mock(ThreadLaunch.ThreadLaunchService)({
        launch: Effect.fn("GuildWorkTest.launch")(function* (input) {
          launches.push(input);
          const failure = () =>
            new ThreadLaunch.ThreadLaunchError({
              commandId: input.commandId,
              projectId: input.projectId,
              operation: "create-thread",
              cause: "mock launch error",
            });
          if (mode === "error_before_accept") return yield* failure();
          const value = yield* acceptLaunch(input).pipe(
            Effect.provideContext(context),
            Effect.orDie,
          );
          if (mode === "error_after_accept") return yield* failure();
          return value;
        }),
      });
    }),
  );
  const registry = Layer.mock(ProviderRegistry.ProviderRegistry)({
    getProviders: Ref.get(providers),
  });
  const layer = GuildOutboxWorker.layer.pipe(
    Layer.provideMerge(GuildRunBridge.layer),
    Layer.provideMerge(Layer.merge(launcher, registry)),
    Layer.provideMerge(dependencies),
  );
  return { layer, launches, providers };
});

const seedProject = Effect.fn("GuildWorkTest.seedProject")(function* () {
  const projects = yield* ProjectStore.ProjectStoreV2;
  yield* projects.apply({
    sequence: 1,
    eventId: EventId.make("project-created"),
    aggregateKind: "project",
    aggregateId: projectId,
    occurredAt: asOf,
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
    type: "project.created",
    payload: {
      projectId,
      title: "Guild project",
      workspaceRoot: "/tmp/guild-project",
      defaultModelSelection: null,
      scripts: [],
      createdAt: asOf,
      updatedAt: asOf,
    },
  });
});

const hireInput = (seed: string, index = 0, commandId = "hire") =>
  ({
    commandId: CommandId.make(commandId),
    pool: { seed, index },
    classId: "mage",
    binding: {
      providerInstanceId,
      family: { key: "codex:gpt-6-astra", label: "Astra" },
      pinnedModel: null,
      options: { effort: "high" },
    },
    defaults: { runtimeMode: "approval-required", interactionMode: "plan", maxWriteAttempts: 1 },
    specialties: ["sqlite"],
    instructions: "Review the SQLite change and list your findings.",
  }) satisfies GuildHireAdventurerInput;

const hire = Effect.fn("GuildWorkTest.hire")(function* () {
  const guild = yield* GuildService.GuildService;
  const store = yield* GuildStore.GuildStore;
  const { candidatePool } = yield* store.getSettings();
  return yield* guild.hireAdventurer(hireInput(candidatePool.seed));
});

const message = "Review the migration and report on incorrect assumptions in this project.";
const start = (adventurer: Adventurer, workspace: "root" | "worktree" = "root") => ({
  commandId: CommandId.make("give-orders"),
  adventurerId: adventurer.id,
  projectId,
  message,
  workspace,
});

function expectedLaunch(
  adventurer: Adventurer,
  attempt: Attempt,
  workspaceStrategy: ThreadLaunch.ThreadLaunchWorkspaceStrategy,
) {
  return {
    commandId: CommandId.make(`server:guild:launch:${attempt.id}`),
    threadId: attempt.threadId,
    projectId,
    title: `${adventurer.name} · ${message.slice(0, 60)}`,
    titleRenamed: true,
    modelSelection: {
      instanceId: providerInstanceId,
      model: "gpt-6-astra",
      options: [{ id: "effort", value: "high" }],
    },
    runtimeMode: "approval-required",
    interactionMode: "plan",
    workspaceStrategy,
    createdBy: "user",
    creationSource: "server",
    initialMessage: {
      text: `[Guild briefing]\nYou are ${adventurer.name}, a Mage in the user's guild. Review the SQLite change and list your findings.\n[End of briefing]\n\n${message}`,
      attachments: [],
    },
  } satisfies ThreadLaunch.ThreadLaunchInput;
}

it.effect(
  "hires the server-generated candidate once, rejects stale pools, and starts the roster at zero",
  () =>
    Effect.gen(function* () {
      const { layer } = yield* harness();
      yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        const store = yield* GuildStore.GuildStore;
        const { candidatePool } = yield* store.getSettings();
        const input = hireInput(candidatePool.seed);
        const decoded = decodeHireInput({
          ...input,
          name: "Forged name",
          appearance: { ...DEFAULT_APPEARANCE, head: "imaginary" },
        });
        assert.deepEqual(decoded, input);
        const adventurer = yield* guild.hireAdventurer(decoded);
        assert.deepEqual(
          { name: adventurer.name, appearance: adventurer.appearance },
          generateCandidate(candidatePool.seed, 0, []),
        );
        assert.deepEqual([adventurer.level, adventurer.xp], [0, 0]);
        assert.deepEqual(yield* guild.hireAdventurer(input), adventurer);
        assert.deepEqual((yield* store.getSettings()).candidatePool.hiredIndices, [0]);
        assert.deepEqual(
          (yield* store.listAdventurerSummaries()).map(({ id }) => id),
          [adventurer.id],
        );
        const profile = yield* guild.getAdventurerProfile({ adventurerId: adventurer.id });
        assert.deepEqual(
          profile.changes.map(({ kind }) => kind),
          ["hired"],
        );
        assert.deepEqual(yield* guild.listAttempts({ adventurerId: adventurer.id }), {
          attempts: [],
          nextCursor: null,
        });
        yield* guild.refreshCandidates({ commandId: CommandId.make("refresh") });
        const stale = yield* Effect.flip(
          guild.hireAdventurer(hireInput(candidatePool.seed, 1, "stale")),
        );
        assert.match(stale._tag, /^GuildCandidateGoneError$/);
        if (stale._tag === "GuildCandidateGoneError") assert.equal(stale.code, "candidate_gone");
        assert.deepEqual(yield* guild.hireAdventurer(input), adventurer);
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("validates master parts on create and update while preserving the saved master", () =>
  Effect.gen(function* () {
    const guild = yield* GuildService.GuildService;
    const invalid = { name: "Mira", appearance: { ...DEFAULT_APPEARANCE, palette: "invented" } };
    const createBad = yield* Effect.flip(
      guild.createMaster({ ...invalid, commandId: CommandId.make("bad-create") }),
    );
    assert.equal(createBad._tag, "GuildAppearanceError");
    const master = yield* guild.createMaster({
      name: "Mira",
      appearance: DEFAULT_APPEARANCE,
      commandId: CommandId.make("create"),
    });
    const updateBad = yield* Effect.flip(
      guild.updateMaster({ ...invalid, commandId: CommandId.make("bad-update") }),
    );
    assert.equal(updateBad._tag, "GuildAppearanceError");
    assert.deepEqual(yield* (yield* GuildStore.GuildStore).getMaster(), master);
  }).pipe(Effect.provide(dependencies.pipe(Layer.provide(Sqlite.layerMemory)))),
);

it.effect(
  "rejects unavailable bindings before committing and sends the complete worktree launch input",
  () =>
    Effect.gen(function* () {
      const { layer, launches, providers } = yield* harness();
      yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
        yield* seedProject();
        const adventurer = yield* hire();
        const request = start(adventurer, "worktree");
        yield* Ref.set(providers, [{ ...codex, models: [models[1]!] }]);
        const unavailable = yield* Effect.flip(
          guild.startConversation({
            ...request,
            commandId: CommandId.make("unavailable-family"),
          }),
        );
        assert.equal(unavailable._tag, "GuildBindingError");
        if (unavailable._tag === "GuildBindingError")
          assert.equal(unavailable.code, "family_unavailable");
        yield* worker.drain();
        assert.deepEqual((yield* guild.listAttempts({})).attempts, []);
        assert.deepEqual(launches, []);

        yield* Ref.set(providers, [codex]);
        const attempt = yield* guild.startConversation(request);
        assert.equal(attempt.status, "starting");
        assert.equal(attempt.classIdAtStart, "mage");
        assert.equal(attempt.familyKeyAtStart, "codex:gpt-6-astra");
        assert.equal(attempt.requestedModel, "gpt-6-astra");
        assert.deepEqual(attempt.requestedOptions, [{ id: "effort", value: "high" }]);
        assert.equal(
          (yield* guild.getAdventurerProfile({ adventurerId: adventurer.id })).adventurer
            .lastProjectId,
          projectId,
        );
        assert.deepEqual(yield* guild.startConversation(request), attempt);
        yield* worker.drain();
        assert.deepEqual(launches, [
          expectedLaunch(adventurer, attempt, { type: "worktree", baseRef: "feature/current" }),
        ]);

        const end = { commandId: CommandId.make("end-conversation"), attemptId: attempt.id };
        const completed = yield* guild.endConversation(end);
        assert.equal(completed.status, "completed");
        assert.deepEqual(yield* guild.endConversation(end), completed);
        const snapshot = yield* Stream.runHead(guild.subscribe({}));
        const item = Option.getOrNull(snapshot);
        assert.equal(item?._tag, "snapshot");
        if (item?._tag === "snapshot") {
          assert.deepEqual(item.guild.adventurers[0]?.latestConversation, {
            attemptId: attempt.id,
            threadId: attempt.threadId,
          });
          assert.deepEqual(item.guild.attempts, []);
        }
        const next = yield* guild.startConversation({
          ...request,
          commandId: CommandId.make("give-new-orders"),
        });
        const latest = (yield* (yield* GuildStore.GuildStore).listAdventurerSummaries())[0]
          ?.latestConversation;
        assert.deepEqual(latest, { attemptId: next.id, threadId: next.threadId });
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect.each(["before_launch", "running_before_accept", "running_after_accept"] as const)(
  "recovers one thread after interruption %s",
  (phase) =>
    Effect.gen(function* () {
      const first = yield* harness();
      const { attempt, adventurer } = yield* Effect.gen(function* () {
        yield* seedProject();
        const adventurer = yield* hire();
        const guild = yield* GuildService.GuildService;
        const attempt = yield* guild.startConversation(start(adventurer));
        if (phase !== "before_launch") {
          yield* (yield* GuildWorkStore.GuildWorkStore).updateOutbox({
            id: attempt.id,
            status: "running",
            error: null,
          });
        }
        if (phase === "running_after_accept") {
          yield* (yield* ThreadLaunch.ThreadLaunchService).launch(
            expectedLaunch(adventurer, attempt, { type: "root" }),
          );
        }
        return { attempt, adventurer };
      }).pipe(Effect.provide(first.layer));
      const restarted = yield* harness();
      yield* Effect.gen(function* () {
        const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
        yield* worker.recover();
        yield* (yield* GuildRunBridge.GuildRunBridge).start();
        yield* worker.drain();
        yield* worker.drain();
        assert.deepEqual(
          [...first.launches, ...restarted.launches],
          [expectedLaunch(adventurer, attempt, { type: "root" })],
        );
        const sql = yield* SqlClient.SqlClient;
        assert.deepEqual(yield* sql`SELECT status FROM guild_outbox`, [{ status: "done" }]);
        assert.deepEqual(yield* sql`SELECT thread_id FROM orchestration_v2_projection_threads`, [
          { thread_id: attempt.threadId },
        ]);
        assert.equal(
          (yield* (yield* GuildWorkStore.GuildWorkStore).getAttempt(attempt.id))?.status,
          "active",
        );
      }).pipe(Effect.provide(restarted.layer));
    }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect.each([false, true])(
  "checks the T3 receipt when launch fails (accepted: %s)",
  (accepted) =>
    Effect.gen(function* () {
      const { layer, launches } = yield* harness(
        accepted ? "error_after_accept" : "error_before_accept",
      );
      yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
        yield* seedProject();
        const attempt = yield* guild.startConversation(start(yield* hire()));
        yield* worker.drain();
        yield* worker.recover();
        yield* worker.drain();
        assert.lengthOf(launches, 1);
        const result = yield* (yield* GuildWorkStore.GuildWorkStore).getAttempt(attempt.id);
        assert.equal(result?.status, accepted ? "active" : "failed");
        assert.equal(
          result?.statusReason,
          accepted
            ? null
            : `Thread launch server:guild:launch:${attempt.id} failed during create-thread.`,
        );
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect(
  "reconciles provider turns, records drift once on replay, and cancels a deleted thread",
  () =>
    Effect.gen(function* () {
      const { layer } = yield* harness();
      yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        const work = yield* GuildWorkStore.GuildWorkStore;
        const bridge = yield* GuildRunBridge.GuildRunBridge;
        const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
        const projection = yield* ProjectionStore.ProjectionStoreV2;
        const sql = yield* SqlClient.SqlClient;
        yield* seedProject();
        const attempt = yield* guild.startConversation(start(yield* hire()));
        yield* worker.drain();

        const now = yield* DateTime.now;
        const threadId = attempt.threadId;
        const runId = RunId.make("run:first-message");
        const nodeId = NodeId.make("node:first-message");
        const providerThreadId = ProviderThreadId.make("provider-thread:first-message");
        const t3RunAttemptId = RunAttemptId.make("attempt:first-message");
        const run: OrchestrationV2Run = {
          id: runId,
          threadId,
          ordinal: 1,
          providerInstanceId,
          modelSelection: { instanceId: providerInstanceId, model: "gpt-6-astra" },
          providerThreadId,
          userMessageId: MessageId.make("message:first-message"),
          rootNodeId: nodeId,
          activeAttemptId: t3RunAttemptId,
          status: "running",
          requestedAt: now,
          startedAt: now,
          completedAt: null,
          checkpointId: null,
          contextHandoffId: null,
        };
        const eventBase = { threadId, runId, nodeId, occurredAt: now };
        yield* projection.apply({
          ...eventBase,
          id: EventId.make("event:run"),
          type: "run.created",
          payload: run,
        });
        yield* projection.apply({
          ...eventBase,
          id: EventId.make("event:run-attempt"),
          type: "run-attempt.created",
          payload: {
            id: t3RunAttemptId,
            runId,
            attemptOrdinal: 1,
            rootNodeId: nodeId,
            providerInstanceId,
            providerThreadId,
            providerTurnId: null,
            reason: "initial",
            status: "running",
            startedAt: now,
            completedAt: null,
          },
        });
        const firstTurn = {
          ...eventBase,
          id: EventId.make("event:provider-turn-1"),
          type: "provider-turn.updated",
          payload: {
            id: ProviderTurnId.make("provider-turn:one"),
            providerThreadId,
            nodeId,
            runAttemptId: t3RunAttemptId,
            nativeTurnRef: null,
            ordinal: 1,
            status: "completed",
            startedAt: now,
            completedAt: now,
            model: "gpt-6-astra",
            turnTokenUsage: {
              usageScope: "main_agent",
              usageStatus: "complete",
              hasSubagents: false,
              inputTokens: 11,
              outputTokens: 5,
            },
          },
        } satisfies OrchestrationV2DomainEvent;
        yield* projection.apply(firstTurn);
        // Simulate a turn the domain-event subscription missed before startup.
        yield* bridge.start();
        assert.deepEqual(yield* sql`SELECT provider_turn_id FROM guild_attempt_turns`, [
          { provider_turn_id: firstTurn.payload.id },
        ]);
        yield* guild.endConversation({ commandId: CommandId.make("end"), attemptId: attempt.id });

        const secondTurn = {
          ...firstTurn,
          id: EventId.make("event:provider-turn-2"),
          payload: {
            id: ProviderTurnId.make("provider-turn:two"),
            providerThreadId,
            nodeId,
            runAttemptId: t3RunAttemptId,
            nativeTurnRef: null,
            ordinal: 2,
            status: "completed",
            startedAt: now,
            completedAt: now,
            model: "gpt-6-luna",
          },
        } satisfies OrchestrationV2DomainEvent;
        yield* projection.apply(secondTurn);
        yield* bridge.handle(secondTurn);
        const readTurns = sql`
        SELECT provider_turn_id, t3_run_attempt_id, t3_run_id, status, executed_model,
          json_extract(turn_token_usage_json, '$.inputTokens') AS input_tokens
        FROM guild_attempt_turns ORDER BY provider_turn_id
      `;
        const beforeReplay = yield* readTurns;
        for (const event of [firstTurn, secondTurn, firstTurn, secondTurn]) {
          yield* bridge.handle(event);
        }
        assert.deepEqual(yield* readTurns, beforeReplay);
        assert.deepEqual(beforeReplay, [
          {
            provider_turn_id: firstTurn.payload.id,
            t3_run_attempt_id: t3RunAttemptId,
            t3_run_id: runId,
            status: "completed",
            executed_model: "gpt-6-astra",
            input_tokens: 11,
          },
          {
            provider_turn_id: secondTurn.payload.id,
            t3_run_attempt_id: t3RunAttemptId,
            t3_run_id: runId,
            status: "completed",
            executed_model: "gpt-6-luna",
            input_tokens: null,
          },
        ]);
        const completed = yield* work.getAttempt(attempt.id);
        assert.equal(completed?.status, "completed");
        assert.deepEqual(completed?.executedModels, ["gpt-6-astra", "gpt-6-luna"]);
        assert.deepEqual(
          yield* sql`
        SELECT json_extract(after_json, '$.model') AS model FROM guild_activity
        WHERE change = 'executed_model_outside_family'
      `,
          [{ model: "gpt-6-luna" }],
        );

        const thread = yield* projection.getThread(threadId);
        const deletion = {
          id: EventId.make("event:deleted"),
          threadId,
          occurredAt: now,
          type: "thread.deleted",
          payload: { ...thread, deletedAt: now },
        } satisfies OrchestrationV2DomainEvent;
        yield* projection.apply(deletion);
        yield* bridge.handle(deletion);
        yield* bridge.handle(deletion);
        const cancelled = yield* work.getAttempt(attempt.id);
        assert.equal(cancelled?.status, "cancelled");
        assert.equal(cancelled?.statusReason, "thread_deleted");
        assert.deepEqual(yield* readTurns, beforeReplay);
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.provide(Sqlite.layerMemory)),
);
