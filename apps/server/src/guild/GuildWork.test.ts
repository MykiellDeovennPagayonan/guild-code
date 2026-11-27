import * as NodeServices from "@effect/platform-node/NodeServices";
import * as IdAllocator from "@t3tools/provider-core/server/IdAllocator";
import { AcpRegistrySettings } from "@t3tools/provider-acp-registry/settings";
import { makeAcpRegistryAdapterV2 } from "@t3tools/provider-acp-registry/testing";
import * as AcpRegistrySupport from "@t3tools/provider-acp-registry/server/AcpRegistrySupport";
import * as TestProviderHost from "@t3tools/provider-testing/TestProviderHost";
import { resolveSelfInvocation } from "@t3tools/shared/nodeRuntime";
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
  RuntimeRequestId,
  RunAttemptId,
  RunId,
  type OrchestrationV2DomainEvent,
  type OrchestrationV2Run,
  type ServerProvider,
} from "@t3tools/contracts";
import {
  GuildHireAdventurerInput,
  type Adventurer,
  type Attempt,
  type GuildStreamItem,
} from "@t3tools/contracts/guild";
import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import { generateCandidate } from "@t3tools/guild-core/recruitment";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Queue from "effect/Queue";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import * as CheckpointStore from "../checkpointing/CheckpointStore.ts";
import * as GitWorkflow from "../git/GitWorkflowService.ts";
import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import * as ProviderAdapterRegistry from "../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ProviderReplayHarness from "../orchestration-v2/testkit/ProviderReplayHarness.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as ManagedProjectFolders from "../project/ManagedProjectFolders.ts";
import * as ProjectCloneTracker from "../project/ProjectCloneTracker.ts";
import * as ProjectSetupScriptRunner from "../project/ProjectSetupScriptRunner.ts";
import * as WorktreeSetupTracker from "../project/WorktreeSetupTracker.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as TerminalManager from "../terminal/Manager.ts";
import * as TextGeneration from "../textGeneration/TextGeneration.ts";
import * as TaskFolders from "../workspace/TaskFolders.ts";
import * as CommandReceipts from "../orchestration-v2/CommandReceiptStore.ts";
import * as EventSink from "../orchestration-v2/EventSink.ts";
import * as ProjectStore from "../orchestration-v2/ProjectStore.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
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
  const threads = Layer.unwrap(
    Effect.gen(function* () {
      const projections = yield* ProjectionStore.ProjectionStoreV2;
      return Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: (threadId) => projections.getThreadShell(threadId).pipe(Effect.orDie),
      });
    }),
  );
  const layer = GuildOutboxWorker.layer.pipe(
    Layer.provideMerge(GuildRunBridge.layer),
    Layer.provideMerge(Layer.mergeAll(launcher, registry, threads)),
    Layer.provideMerge(dependencies),
  );
  return { layer, launches, providers };
});

const seedProject = Effect.fn("GuildWorkTest.seedProject")(function* (cwd = "/tmp/guild-project") {
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
      workspaceRoot: cwd,
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
            terminal: { status: "completed", statusReason: null },
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
        const end = { commandId: CommandId.make("end"), attemptId: attempt.id };
        const busy = yield* Effect.flip(guild.endConversation(end));
        assert.include(busy, { _tag: "GuildConversationError", code: "conversation_busy" });
        const pendingRequest = {
          id: RuntimeRequestId.make("runtime-request:guild-test"),
          nodeId,
          providerTurnId: null,
          nativeRequestRef: null,
          kind: "command",
          status: "pending",
          responseCapability: { type: "message" },
          createdAt: now,
          resolvedAt: null,
        } as const;
        yield* projection.apply({
          ...eventBase,
          id: EventId.make("event:pending-request"),
          type: "runtime-request.updated",
          payload: pendingRequest,
        });
        const needsAttention = yield* Effect.flip(
          guild.endConversation({
            ...end,
            commandId: CommandId.make("end-while-pending"),
          }),
        );
        assert.include(needsAttention, {
          _tag: "GuildConversationError",
          code: "conversation_needs_attention",
        });
        assert.equal((yield* work.getAttempt(attempt.id))?.status, "active");
        yield* projection.apply({
          ...eventBase,
          id: EventId.make("event:resolved-request"),
          type: "runtime-request.updated",
          payload: { ...pendingRequest, status: "resolved", resolvedAt: now },
        });
        yield* projection.apply({
          ...eventBase,
          id: EventId.make("event:completed-run"),
          type: "run.updated",
          payload: { ...run, status: "completed", completedAt: now },
        });
        yield* guild.endConversation({ ...end, commandId: CommandId.make("end-when-idle") });

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

const decodeReplaySettings = Schema.decodeEffect(AcpRegistrySettings);
const replayId = ProviderInstanceId.make("devReplay");
const replay: ServerProvider = {
  ...codex,
  instanceId: replayId,
  driver: ProviderDriverKind.make("acpRegistry"),
  models: [
    { slug: "multi-turn", name: "Multi turn", isCustom: false, capabilities: null },
    { slug: "showcase", name: "Showcase", isCustom: false, capabilities: null },
  ],
};

function replayGuildLayer(
  cwd: string,
  database: Layer.Layer<SqlClient.SqlClient>,
  label: string,
  providers: Ref.Ref<readonly ServerProvider[]>,
) {
  const adapterRegistry = ProviderAdapterRegistry.layerFromAdaptersEffect(
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const script = yield* path
        .fromFileUrl(new URL("../../scripts/dev-replay-agent.ts", import.meta.url))
        .pipe(Effect.orDie);
      const adapter = yield* makeAcpRegistryAdapterV2({
        instanceId: replayId,
        settings: yield* decodeReplaySettings({
          source: "local",
          commandPath: process.execPath,
          commandArgs: [script],
        }).pipe(Effect.orDie),
        environment: {},
        selfInvocation: yield* resolveSelfInvocation(),
      });
      return [adapter];
    }),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        TestProviderHost.layer({ cwd }),
        IdAllocator.layer,
        Layer.mock(AcpRegistrySupport.AcpRegistryCatalog)({
          resolve: ({ commandPath, commandArgs }, cwd, env) =>
            Effect.succeed({
              distribution: "local",
              spawn: { command: commandPath, args: commandArgs, cwd, env: env ?? {}, shell: false },
            }),
        }),
      ),
    ),
    Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  );
  const orchestration = ProviderReplayHarness.layerWithRegistry(
    { name: label, runtimePolicyOverride: { cwd } },
    adapterRegistry,
    { databaseLayer: database },
  );
  const settings = ServerSettings.layerTest({
    providerInstances: { [replayId]: { driver: replay.driver, config: {} } },
  });
  const receipts = CommandReceipts.layer.pipe(Layer.provide(database));
  const threads = ThreadManagement.layer.pipe(
    Layer.provide(Layer.mergeAll(orchestration, receipts, settings)),
  );
  const services = Layer.mergeAll(
    GuildService.layer,
    GuildWorkStore.layer,
    GuildStore.layer,
    ProjectStore.layer,
    ProjectionStore.layer,
  ).pipe(Layer.provide(Layer.merge(database, NodeCrypto.layer)));
  const registry = Layer.mock(ProviderRegistry.ProviderRegistry)({
    getProviders: Ref.get(providers),
  });
  const launch = ThreadLaunch.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        WorktreeSetupTracker.layer,
        Layer.mock(ProjectCloneTracker.ProjectCloneTracker)({ get: () => Effect.succeed(null) }),
        Layer.mock(TerminalManager.TerminalManager)({}),
        Layer.mock(GitWorkflow.GitWorkflowService)({ currentBranch: () => Effect.succeed(null) }),
        Layer.mock(CheckpointStore.CheckpointStore)({
          isGitRepository: () => Effect.succeed(false),
        }),
        Layer.mock(ProjectSetupScriptRunner.ProjectSetupScriptRunner)({}),
        Layer.mock(TextGeneration.TextGeneration)({}),
        Layer.mock(TaskFolders.TaskFolders)({}),
        Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
          namedProjectsRoot: cwd,
          isScratchProject: () => Effect.succeed(false),
          folderForThread: () => Effect.succeedNone,
        }),
        Layer.mock(ProjectService.ProjectService)({
          getById: (id) =>
            Effect.succeed(
              id === projectId
                ? Option.some({
                    id,
                    title: "Guild project",
                    workspaceRoot: cwd,
                    defaultModelSelection: null,
                    scripts: [],
                    createdAt: asOf,
                    updatedAt: asOf,
                    deletedAt: null,
                  })
                : Option.none(),
            ),
        }),
        orchestration,
        threads,
        registry,
        receipts,
        services,
        settings,
        IdAllocator.layer,
        NodeServices.layer,
      ),
    ),
  );
  const vcs = Layer.mock(VcsStatus.VcsStatusBroadcaster)({
    refreshLocalStatus: () =>
      Effect.succeed({
        refName: null,
        isRepo: false,
        hasPrimaryRemote: false,
        isDefaultRef: false,
        hasWorkingTreeChanges: false,
        workingTree: { files: [], insertions: 0, deletions: 0 },
      }),
  });
  return GuildOutboxWorker.layer.pipe(
    Layer.provideMerge(GuildRunBridge.layer),
    Layer.provideMerge(
      Layer.mergeAll(orchestration, threads, registry, receipts, services, launch, vcs),
    ),
  );
}

it.live("runs a real Guild briefing once across recovery and streams a rejected launch", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "guild-real-launch-" });
    const sql = yield* SqlClient.SqlClient;
    const database = Layer.succeed(SqlClient.SqlClient, sql);
    const providers = yield* Ref.make<readonly ServerProvider[]>([replay]);
    const { attempt, runId } = yield* Effect.gen(function* () {
      yield* seedProject(cwd);
      const guild = yield* GuildService.GuildService;
      const work = yield* GuildWorkStore.GuildWorkStore;
      const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
      const orchestrator = yield* Orchestrator.OrchestratorV2;
      const { candidatePool } = yield* (yield* GuildStore.GuildStore).getSettings();
      const adventurer = yield* guild.hireAdventurer({
        ...hireInput(candidatePool.seed),
        binding: {
          providerInstanceId: replayId,
          family: { key: "acpRegistry:multi-turn", label: "Multi turn" },
          pinnedModel: null,
          options: null,
        },
        defaults: {
          runtimeMode: "approval-required",
          interactionMode: "default",
          maxWriteAttempts: 1,
        },
      });
      const updates = yield* Queue.unbounded<GuildStreamItem>();
      yield* guild.subscribe({}).pipe(
        Stream.runForEach((item) => Queue.offer(updates, item)),
        Effect.forkScoped,
      );
      assert.equal((yield* Queue.take(updates))._tag, "snapshot");
      assert.equal((yield* Queue.take(updates))._tag, "synchronized");
      const rejected = yield* guild.startConversation({
        ...start(adventurer, "worktree"),
        commandId: CommandId.make("rejected-worktree"),
      });
      yield* worker.drain();
      const [, , terminal] = yield* Queue.takeN(updates, 3);
      const summary =
        terminal?._tag === "changed"
          ? terminal.upserts.find((entity) => entity._tag === "adventurer")
          : undefined;
      assert.deepEqual(summary?.value.latestConversation, {
        attemptId: rejected.id,
        threadId: rejected.threadId,
        terminal: {
          status: "failed",
          statusReason: "Could not read a current project branch for the new worktree.",
        },
      });
      const attempt = yield* guild.startConversation(start(adventurer));
      yield* worker.drain();
      const launched = yield* work.getAttempt(attempt.id);
      assert.equal(launched?.status, "active", launched?.statusReason ?? undefined);
      const initial = yield* orchestrator.getThreadProjection(attempt.threadId);
      assert.lengthOf(initial.runs, 1);
      const runId = initial.runs[0]!.id;
      assert.equal(
        initial.messages[0]?.text,
        expectedLaunch(adventurer, attempt, { type: "root" }).initialMessage.text,
      );
      const terminalRun = yield* (yield* EventSink.EventSinkV2)
        .stream({
          threadId: attempt.threadId,
          afterSequence: 0,
          eventType: "run.updated",
        })
        .pipe(
          Stream.filter(
            (event) =>
              event.event.type === "run.updated" &&
              ["completed", "failed", "cancelled", "interrupted"].includes(
                event.event.payload.status,
              ),
          ),
          Stream.runHead,
        );
      const event = Option.getOrUndefined(terminalRun)?.event;
      assert.equal(event?.type === "run.updated" && event.payload.status, "completed");
      // Recover an outbox row whose launch reached T3 before Guild durably acknowledged it.
      yield* work.updateOutbox({ id: attempt.id, status: "running", error: null });
      return { attempt, runId };
    }).pipe(
      Effect.scoped,
      Effect.provide(replayGuildLayer(cwd, database, "guild-before-restart", providers)),
    );

    yield* Effect.gen(function* () {
      const worker = yield* GuildOutboxWorker.GuildOutboxWorker;
      const orchestrator = yield* Orchestrator.OrchestratorV2;
      yield* worker.recover();
      yield* worker.drain();
      const projection = yield* orchestrator.getThreadProjection(attempt.threadId);
      assert.deepEqual(
        projection.runs.map(({ id, status }) => ({ id, status })),
        [{ id: runId, status: "completed" }],
      );
      assert.deepEqual(yield* sql`SELECT status FROM guild_outbox WHERE id = ${attempt.id}`, [
        { status: "done" },
      ]);

      const guild = yield* GuildService.GuildService;
      const threads = yield* ThreadManagement.ThreadManagementService;
      const focusSelection = { instanceId: replayId, model: "showcase" };
      yield* threads.dispatch({
        type: "thread.model-selection.set",
        commandId: CommandId.make("focus-mode-model"),
        threadId: attempt.threadId,
        modelSelection: focusSelection,
      });
      const continuation = {
        commandId: CommandId.make("guild-follow-up"),
        attemptId: attempt.id,
        message: "Check the remaining tests.",
      };
      const onlyOtherFamily = { ...replay, models: [replay.models[1]!] };
      yield* Ref.set(providers, [onlyOtherFamily]);
      const unavailable = yield* Effect.flip(
        guild.continueConversation({
          ...continuation,
          commandId: CommandId.make("unavailable-follow-up"),
        }),
      );
      assert.include(unavailable, { _tag: "GuildBindingError", code: "family_unavailable" });
      yield* worker.drain();
      assert.lengthOf((yield* orchestrator.getThreadProjection(attempt.threadId)).runs, 1);
      assert.deepEqual(
        (yield* threads.getThreadShell(attempt.threadId))?.modelSelection,
        focusSelection,
      );

      yield* Ref.set(providers, [replay]);
      yield* guild.continueConversation({
        ...continuation,
        commandId: CommandId.make("binding-changed-after-enqueue"),
      });
      yield* Ref.set(providers, [onlyOtherFamily]);
      yield* worker.drain();
      assert.lengthOf((yield* orchestrator.getThreadProjection(attempt.threadId)).runs, 1);
      assert.equal(
        (yield* (yield* GuildWorkStore.GuildWorkStore).getAttempt(attempt.id))?.statusReason,
        "The provider offers no model in this family.",
      );

      yield* Ref.set(providers, [replay]);
      yield* guild.continueConversation(continuation);
      yield* guild.continueConversation(continuation);
      yield* worker.drain();
      const continued = yield* orchestrator.getThreadProjection(attempt.threadId);
      assert.deepEqual(
        continued.runs.map(({ modelSelection }) => modelSelection.model),
        ["multi-turn", "multi-turn"],
      );
      assert.deepEqual(
        continued.messages
          .filter(({ text }) => text === continuation.message)
          .map(({ text }) => text),
        [continuation.message],
      );
    }).pipe(
      Effect.scoped,
      Effect.provide(replayGuildLayer(cwd, database, "guild-restarted", providers)),
    );
  }).pipe(Effect.provide(Layer.merge(Sqlite.layerMemory, NodeServices.layer))),
);
