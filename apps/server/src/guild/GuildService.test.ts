import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert, it } from "@effect/vitest";
import { CommandId, ThreadId } from "@t3tools/contracts";
import type { GuildStreamItem } from "@t3tools/contracts/guild";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";

import * as Sqlite from "../persistence/Sqlite.ts";
import * as GuildService from "./GuildService.ts";
import { adventurerId, appearance, attemptId, seedAdventurers } from "./GuildTestFixtures.ts";

const testLayer = GuildService.layer.pipe(
  Layer.provideMerge(Sqlite.layerMemory),
  Layer.provide(NodeCrypto.layer),
);
const create = { commandId: CommandId.make("create"), name: "Mira", appearance };
const edit = { commandId: CommandId.make("edit"), name: "Elowen", appearance };
const location = {
  sceneId: "recruitment_hall",
  doorId: "to_guild_hall",
  x: 72,
  facing: -1,
} as const;

it.effect(
  "commits one state change and one activity for concurrent retries, and replays rejections",
  () =>
    Effect.gen(function* () {
      const guild = yield* GuildService.GuildService;
      const sql = yield* SqlClient.SqlClient;
      const early = yield* Effect.result(guild.updateMaster(edit));
      assert.isTrue(Result.isFailure(early));
      if (Result.isFailure(early)) assert.equal(early.failure._tag, "GuildMasterMissingError");

      const accepted = yield* Effect.all([guild.createMaster(create), guild.createMaster(create)], {
        concurrency: 2,
      });
      assert.deepEqual(accepted[0], accepted[1]);
      assert.deepEqual(yield* guild.createMaster({ ...create, name: "Other" }), accepted[0]);
      assert.deepEqual(yield* Effect.result(guild.updateMaster(edit)), early);
      assert.deepEqual(yield* sql`SELECT name FROM guild_master`, [{ name: "Mira" }]);
      assert.deepEqual(yield* sql`SELECT command_id, change FROM guild_activity`, [
        { command_id: "create", change: "createMaster" },
      ]);
      assert.deepEqual(
        yield* sql`SELECT command_id, json_extract(result_json, '$._tag') AS status FROM guild_command_receipts ORDER BY command_id`,
        [
          { command_id: "create", status: "accepted" },
          { command_id: "edit", status: "rejected" },
        ],
      );
    }).pipe(Effect.provide(testLayer)),
);

it.effect("streams committed deltas and resumes strictly after the cursor", () =>
  Effect.gen(function* () {
    const guild = yield* GuildService.GuildService;
    const queue = yield* Queue.unbounded<GuildStreamItem>();
    yield* guild.subscribe({}).pipe(
      Stream.runForEach((item) => Queue.offer(queue, item)),
      Effect.forkScoped,
    );
    const initial = yield* Queue.take(queue);
    assert.equal(initial._tag, "snapshot");
    assert.deepEqual(yield* Queue.take(queue), { _tag: "synchronized", sequence: 0 });

    const master = yield* guild.createMaster(create);
    const first = yield* Queue.take(queue);
    assert.deepEqual(first, {
      _tag: "changed",
      sequence: 1,
      removals: [],
      upserts: [{ _tag: "master", value: master }],
    });
    const moved = yield* guild.setMasterLocation({
      commandId: CommandId.make("move"),
      ...location,
    });
    const pool = yield* guild.refreshCandidates({ commandId: CommandId.make("ring") });
    const second = yield* Queue.take(queue);
    const third = yield* Queue.take(queue);
    assert.deepEqual(second, {
      _tag: "changed",
      sequence: 2,
      removals: [],
      upserts: [{ _tag: "master", value: moved }],
    });
    assert.deepEqual(third, {
      _tag: "changed",
      sequence: 3,
      removals: [],
      upserts: [{ _tag: "settings", value: pool }],
    });
    if (initial._tag === "snapshot") {
      assert.notEqual(pool.candidatePool.seed, initial.guild.settings.candidatePool.seed);
      assert.deepEqual(pool.candidatePool.hiredIndices, []);
    }

    const replay = yield* guild
      .subscribe({ afterSequence: first.sequence })
      .pipe(Stream.take(3), Stream.runCollect);
    assert.deepEqual(replay, [second, third, { _tag: "synchronized", sequence: 3 }]);
    const latest = yield* guild.subscribe({ afterSequence: third.sequence }).pipe(Stream.runHead);
    assert.deepEqual(Option.getOrUndefined(latest), { _tag: "synchronized", sequence: 3 });
    const ahead = yield* guild.subscribe({ afterSequence: 99 }).pipe(Stream.runHead);
    assert.equal(Option.getOrUndefined(ahead)?._tag, "snapshot");
  }).pipe(Effect.scoped, Effect.provide(testLayer)),
);

it.effect(
  "keeps master, candidates, adventurer history, and attempts across a database reopen",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "guild-identity-" });
      const database = Sqlite.layerFromPath(path.join(directory, "guild.sqlite"));
      const open = GuildService.layer.pipe(Layer.provideMerge(database));
      const original = yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        yield* seedAdventurers(2);
        yield* guild.createMaster(create);
        const master = yield* guild.updateMaster(edit);
        const moved = yield* guild.setMasterLocation({
          commandId: CommandId.make("move"),
          ...location,
        });
        assert.equal(moved.createdAt, master.createdAt);
        const settings = yield* guild.refreshCandidates({ commandId: CommandId.make("refresh") });
        return { master, moved, settings };
      }).pipe(Effect.provide(open));
      yield* Effect.gen(function* () {
        const guild = yield* GuildService.GuildService;
        const sql = yield* SqlClient.SqlClient;
        const head = yield* guild.subscribe({}).pipe(Stream.runHead);
        assert.isTrue(head._tag === "Some" && head.value._tag === "snapshot");
        if (head._tag !== "Some" || head.value._tag !== "snapshot") return;
        const { sequence, guild: snapshot } = head.value;
        assert.equal(sequence, 4);
        assert.deepEqual(snapshot.master, original.moved);
        assert.deepEqual(snapshot.settings, original.settings);
        assert.deepEqual(
          snapshot.adventurers.map((entry) => entry.latestConversation),
          [
            { attemptId: attemptId(0, "latest"), threadId: ThreadId.make("thread-0-latest") },
            { attemptId: attemptId(1, "latest"), threadId: ThreadId.make("thread-1-latest") },
          ],
        );
        assert.deepEqual(
          snapshot.attempts.map(({ id }) => id),
          [attemptId(1, "latest")],
        );
        const profile = yield* guild.getAdventurerProfile({ adventurerId: adventurerId(0) });
        assert.equal(profile.adventurer.name, "Elowen 0");
        assert.include(profile.adventurer.instructions, "Check build logs");
        assert.deepEqual(
          profile.changes.map(({ kind }) => kind),
          ["hired"],
        );
        const first = yield* guild.listAttempts({ adventurerId: adventurerId(0), limit: 1 });
        assert.deepEqual(
          first.attempts.map(({ id }) => id),
          [attemptId(0, "latest")],
        );
        assert.isNotNull(first.nextCursor);
        if (first.nextCursor === null) return;
        const second = yield* guild.listAttempts({
          adventurerId: adventurerId(0),
          cursor: first.nextCursor,
          limit: 1,
        });
        assert.deepEqual(
          second.attempts.map(({ id }) => id),
          [attemptId(0, "earlier")],
        );
        assert.isNull(second.nextCursor);
        assert.deepEqual(yield* guild.updateMaster(edit), original.master);
        assert.deepEqual(yield* sql`SELECT COUNT(*) AS count FROM guild_attempt_turns`, [
          { count: 2 },
        ]);
        const replay = yield* guild
          .subscribe({ afterSequence: 2 })
          .pipe(Stream.take(3), Stream.runCollect);
        assert.deepEqual(
          replay.map(({ _tag, sequence }) => ({ _tag, sequence })),
          [
            { _tag: "changed", sequence: 3 },
            { _tag: "changed", sequence: 4 },
            { _tag: "synchronized", sequence: 4 },
          ],
        );
      }).pipe(Effect.provide(open));
    }).pipe(Effect.provide(Layer.merge(NodeServices.layer, NodeCrypto.layer))),
);
