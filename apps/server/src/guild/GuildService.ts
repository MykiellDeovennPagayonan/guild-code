import type { CommandId } from "@t3tools/contracts";
import {
  Adventurer,
  Attempt,
  type GuildAdventurerProfile,
  type GuildAttemptPage,
  type GuildCreateMasterInput,
  type GuildDelta,
  type GuildEndConversationInput,
  type GuildGetAdventurerProfileInput,
  type GuildHireAdventurerInput,
  type GuildListAttemptsInput,
  type GuildRefreshCandidatesInput,
  type GuildSetMasterLocationInput,
  type GuildStartConversationInput,
  type GuildStreamItem,
  type GuildSubscribeInput,
  type GuildUpdateMasterInput,
  GuildAdventurerNotFoundError,
  GuildCommandConflictError,
  type GuildCommandRejection,
  GuildMaster,
  GuildMasterAlreadyExistsError,
  GuildMasterMissingError,
  GuildNotImplementedError,
  GuildSettings,
} from "@t3tools/contracts/guild";
import * as DateTime from "effect/DateTime";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { toPersistenceDecodeError } from "../persistence/Errors.ts";
import * as GuildStore from "./GuildStore.ts";

type CommandError = GuildCommandRejection | GuildCommandConflictError | GuildStore.GuildStoreError;
type Command<A> = Effect.Effect<A, CommandError>;
type Change<A> = {
  readonly value: A;
  readonly activity: ReadonlyArray<{
    readonly entity: string;
    readonly entityId: string;
    readonly before: Schema.Json;
    readonly after: Schema.Json;
    readonly delta: GuildDelta;
  }>;
};

export class GuildService extends Context.Service<
  GuildService,
  {
    readonly subscribe: (
      input: GuildSubscribeInput,
    ) => Stream.Stream<GuildStreamItem, GuildStore.GuildStoreError>;
    readonly createMaster: (input: GuildCreateMasterInput) => Command<GuildMaster>;
    readonly updateMaster: (input: GuildUpdateMasterInput) => Command<GuildMaster>;
    readonly setMasterLocation: (input: GuildSetMasterLocationInput) => Command<GuildMaster>;
    readonly refreshCandidates: (input: GuildRefreshCandidatesInput) => Command<GuildSettings>;
    readonly getAdventurerProfile: (
      input: GuildGetAdventurerProfileInput,
    ) => Effect.Effect<
      GuildAdventurerProfile,
      GuildAdventurerNotFoundError | GuildStore.GuildStoreError
    >;
    readonly listAttempts: (
      input: GuildListAttemptsInput,
    ) => Effect.Effect<GuildAttemptPage, GuildStore.GuildStoreError>;
    readonly hireAdventurer: (input: GuildHireAdventurerInput) => Command<Adventurer>;
    readonly startConversation: (input: GuildStartConversationInput) => Command<Attempt>;
    readonly endConversation: (input: GuildEndConversationInput) => Command<Attempt>;
  }
>()("t3/guild/GuildService") {}

const replayLimit = 128;
const reject = (error: GuildCommandRejection) =>
  Effect.succeed({ _tag: "rejected", error } as const);
const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const make = Effect.gen(function* () {
  const store = yield* GuildStore.GuildStore;
  const random = yield* SecureRandom.SecureRandom;
  const committed = yield* PubSub.sliding<void>(1);

  const mutate = Effect.fn("GuildService.mutate")(function* <A extends Schema.Json>(
    commandId: CommandId,
    operation: string,
    resultSchema: Schema.Decoder<A>,
    apply: (
      at: string,
    ) => Effect.Effect<Change<A>, GuildCommandRejection | GuildStore.GuildStoreError>,
  ) {
    const { result } = yield* store
      .transaction(
        Effect.gen(function* () {
          const receipt = yield* store.getReceipt(commandId);
          if (Option.isSome(receipt)) {
            if (receipt.value.operation !== operation)
              return yield* new GuildCommandConflictError();
            return { result: receipt.value.result, changed: false };
          }

          const at = yield* now;
          const result = yield* apply(at).pipe(
            Effect.flatMap(({ value, activity }) =>
              Effect.forEach(
                activity,
                (row) =>
                  store.appendActivity({ ...row, at, change: operation, actor: "user", commandId }),
                { discard: true },
              ).pipe(Effect.as({ _tag: "accepted", value } as const)),
            ),
            Effect.catchTags({
              GuildMasterAlreadyExistsError: reject,
              GuildMasterMissingError: reject,
              GuildNotImplementedError: reject,
            }),
          );
          yield* store.saveReceipt({ commandId, operation, result, createdAt: at });
          return { result, changed: result._tag === "accepted" };
        }),
      )
      .pipe(
        // A disconnected caller can interrupt after SQLite commits. The wakeup must still run.
        Effect.tap(({ changed }) => (changed ? PubSub.publish(committed, undefined) : Effect.void)),
        Effect.uninterruptible,
      );

    if (result._tag === "rejected") return yield* result.error;
    return yield* Schema.decodeEffect(resultSchema)(result.value).pipe(
      Effect.mapError(toPersistenceDecodeError(`GuildService.${operation}.receipt`)),
    );
  });

  const saveMaster = Effect.fn("GuildService.saveMaster")(function* (
    value: GuildMaster,
    before: GuildMaster | null,
  ) {
    yield* store.saveMaster(value);
    return {
      value,
      activity: [
        {
          entity: "master",
          entityId: "master",
          before,
          after: value,
          delta: { upserts: [{ _tag: "master", value }], removals: [] },
        },
      ],
    } satisfies Change<GuildMaster>;
  });

  const requireMaster = Effect.fn("GuildService.requireMaster")(function* () {
    const master = yield* store.getMaster();
    if (master === null) return yield* new GuildMasterMissingError();
    return master;
  });

  const initialItems = Effect.fn("GuildService.initialItems")(function* (
    afterSequence: number | undefined,
  ) {
    const sequence = yield* store.latestSequence();
    const items: GuildStreamItem[] = [];
    if (
      afterSequence !== undefined &&
      afterSequence <= sequence &&
      sequence - afterSequence <= replayLimit
    ) {
      const changes = yield* store.listChangesAfter(afterSequence, replayLimit);
      for (const change of changes) {
        items.push({ _tag: "changed", sequence: change.sequence, ...change.delta });
      }
    } else {
      items.push({
        _tag: "snapshot",
        sequence,
        guild: {
          settings: yield* store.getSettings(),
          master: yield* store.getMaster(),
          adventurers: yield* store.listAdventurerSummaries(),
          attempts: yield* store.listLiveAttempts(),
        },
      });
    }
    items.push({ _tag: "synchronized", sequence });
    return { sequence, items };
  }, store.transaction);

  function unavailable<A extends Schema.Json>(
    commandId: CommandId,
    action: GuildNotImplementedError["action"],
    resultSchema: Schema.Decoder<A>,
  ) {
    return mutate(commandId, action, resultSchema, () =>
      Effect.fail(new GuildNotImplementedError({ action })),
    );
  }

  const createMaster = Effect.fn("GuildService.createMaster")(
    ({ commandId, name, appearance }: GuildCreateMasterInput) =>
      mutate(commandId, "createMaster", GuildMaster, (createdAt) =>
        Effect.gen(function* () {
          if ((yield* store.getMaster()) !== null)
            return yield* new GuildMasterAlreadyExistsError();
          return yield* saveMaster(
            {
              name,
              appearance,
              createdAt,
              location: { sceneId: "guild_hall", doorId: null, x: 30, facing: 1 },
            },
            null,
          );
        }),
      ),
  );

  const updateMaster = Effect.fn("GuildService.updateMaster")(
    ({ commandId, name, appearance }: GuildUpdateMasterInput) =>
      mutate(commandId, "updateMaster", GuildMaster, () =>
        Effect.gen(function* () {
          const master = yield* requireMaster();
          return yield* saveMaster({ ...master, name, appearance }, master);
        }),
      ),
  );

  const setMasterLocation = Effect.fn("GuildService.setMasterLocation")(
    ({ commandId, ...location }: GuildSetMasterLocationInput) =>
      mutate(commandId, "setMasterLocation", GuildMaster, () =>
        Effect.gen(function* () {
          const master = yield* requireMaster();
          return yield* saveMaster({ ...master, location }, master);
        }),
      ),
  );

  const refreshCandidates = Effect.fn("GuildService.refreshCandidates")(
    ({ commandId }: GuildRefreshCandidatesInput) =>
      mutate(commandId, "refreshCandidates", GuildSettings, () =>
        Effect.gen(function* () {
          const before = yield* store.getSettings();
          const candidatePool = { seed: yield* random.uuidV4(), hiredIndices: [] };
          yield* store.saveCandidatePool(candidatePool);
          const value = { ...before, candidatePool };
          return {
            value,
            activity: [
              {
                entity: "settings",
                entityId: "settings",
                before,
                after: value,
                delta: { upserts: [{ _tag: "settings", value }], removals: [] },
              },
            ],
          };
        }),
      ),
  );

  const getAdventurerProfile = Effect.fn("GuildService.getAdventurerProfile")(function* ({
    adventurerId,
  }: GuildGetAdventurerProfileInput) {
    const adventurer = yield* store.getAdventurer(adventurerId);
    if (adventurer === null) return yield* new GuildAdventurerNotFoundError({ adventurerId });
    return { adventurer, changes: yield* store.listAdventurerChanges(adventurerId) };
  }, store.transaction);

  const listAttempts = Effect.fn("GuildService.listAttempts")(function* (
    input: GuildListAttemptsInput,
  ) {
    const limit = input.limit ?? 50;
    const rows = yield* store.listAttempts({ ...input, limit: limit + 1 });
    const attempts = rows.slice(0, limit);
    const last = rows.length > limit ? attempts.at(-1) : undefined;
    return {
      attempts,
      nextCursor: last === undefined ? null : { createdAt: last.createdAt, id: last.id },
    };
  });

  const openSubscription = Effect.fn("GuildService.subscribe")(function* ({
    afterSequence,
  }: GuildSubscribeInput) {
    // Register first so commits made during the initial read also wake the live tail.
    const subscription = yield* PubSub.subscribe(committed);
    const { sequence, items } = yield* initialItems(afterSequence);
    return Stream.concat(
      Stream.fromIterable(items),
      Stream.paginate(sequence, (cursor) =>
        Effect.gen(function* () {
          const rows = yield* store.listChangesAfter(cursor, replayLimit);
          const last = rows.at(-1);
          if (last === undefined) yield* PubSub.take(subscription);
          return [
            rows.map(({ sequence, delta }) => ({ _tag: "changed", sequence, ...delta }) as const),
            Option.some(last?.sequence ?? cursor),
          ] as const;
        }),
      ),
    );
  });

  return GuildService.of({
    subscribe: (input) => Stream.unwrap(openSubscription(input)),
    createMaster,
    updateMaster,
    setMasterLocation,
    refreshCandidates,
    getAdventurerProfile,
    listAttempts,
    hireAdventurer: Effect.fn("GuildService.hireAdventurer")(
      ({ commandId }: GuildHireAdventurerInput) =>
        unavailable(commandId, "hireAdventurer", Adventurer),
    ),
    startConversation: Effect.fn("GuildService.startConversation")(
      ({ commandId }: GuildStartConversationInput) =>
        unavailable(commandId, "startConversation", Attempt),
    ),
    endConversation: Effect.fn("GuildService.endConversation")(
      ({ commandId }: GuildEndConversationInput) =>
        unavailable(commandId, "endConversation", Attempt),
    ),
  });
});

export const layer = Layer.effect(GuildService, make).pipe(Layer.provide(GuildStore.layer));
