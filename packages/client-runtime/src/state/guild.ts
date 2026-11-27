import { type EnvironmentId, WS_METHODS } from "@t3tools/contracts";
import type { GuildDelta, GuildSnapshot } from "@t3tools/contracts/guild";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { subscribeDynamicWithSession } from "../rpc/client.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentSubscriptionAtomFamily,
  environmentConnectionAtom,
} from "./runtime.ts";

function upsert<T extends { readonly id: string }>(rows: readonly T[], row: T): readonly T[] {
  const index = rows.findIndex(({ id }) => id === row.id);
  return index === -1 ? [...rows, row] : rows.with(index, row);
}

function applyDelta(guild: GuildSnapshot, delta: GuildDelta): GuildSnapshot {
  let { settings, master, adventurers, attempts, attemptThreadIds } = guild;
  for (const removal of delta.removals) {
    switch (removal.entity) {
      case "master":
        master = null;
        break;
      case "adventurer":
        adventurers = adventurers.filter(({ id }) => id !== removal.id);
        break;
      case "attempt":
        attempts = attempts.filter(({ id }) => id !== removal.id);
        break;
    }
  }
  for (const entity of delta.upserts) {
    switch (entity._tag) {
      case "settings":
        settings = entity.value;
        break;
      case "master":
        master = entity.value;
        break;
      case "adventurer":
        adventurers = upsert(adventurers, entity.value);
        break;
      case "attempt":
        attempts = upsert(attempts, entity.value);
        if (!attemptThreadIds?.includes(entity.value.threadId)) {
          attemptThreadIds = [...(attemptThreadIds ?? []), entity.value.threadId];
        }
        break;
    }
  }
  return { settings, master, adventurers, attempts, ...(attemptThreadIds && { attemptThreadIds }) };
}

function subscribeGuild() {
  return Stream.suspend(() => {
    let latest:
      | {
          readonly sequence: number;
          readonly guild: GuildSnapshot;
          readonly session: import("../rpc/session.ts").RpcSession;
          readonly synchronized: boolean;
        }
      | undefined;
    return subscribeDynamicWithSession(WS_METHODS.guildSubscribe, () =>
      Effect.sync(() => {
        if (latest === undefined) return {};
        latest = { ...latest, synchronized: false };
        return { afterSequence: latest.sequence };
      }),
    ).pipe(
      Stream.map(([session, item]) => {
        if (item._tag === "snapshot") {
          latest = { sequence: item.sequence, guild: item.guild, session, synchronized: false };
        } else if (latest !== undefined && item.sequence >= latest.sequence) {
          latest = {
            sequence: item.sequence,
            guild:
              item._tag === "changed" && item.sequence > latest.sequence
                ? applyDelta(latest.guild, item)
                : latest.guild,
            session,
            synchronized:
              item._tag === "synchronized" || (latest.session === session && latest.synchronized),
          };
        }
        return latest;
      }),
      Stream.filter((value) => value !== undefined),
    );
  });
}

/** @public */
export function createGuildEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const state = createEnvironmentSubscriptionAtomFamily(runtime, {
    label: "environment-data:guild",
    subscribe: subscribeGuild,
  });
  const stateFor = (environmentId: EnvironmentId) => state({ environmentId, input: null });
  return {
    state: stateFor,
    synchronized: Atom.family((environmentId: EnvironmentId) =>
      Atom.make((get) => {
        const view = get(stateFor(environmentId));
        const connection = AsyncResult.getOrElse(
          get(environmentConnectionAtom(runtime, environmentId)),
          () => null,
        );
        return (
          AsyncResult.isSuccess(view) &&
          view.value.synchronized &&
          connection?.[0].phase === "connected" &&
          Option.getOrNull(connection[1]) === view.value.session
        );
      }),
    ),
    profile: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:guild:profile",
      tag: WS_METHODS.guildGetAdventurerProfile,
    }),
    attempts: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:guild:attempts",
      tag: WS_METHODS.guildListAttempts,
    }),
    createMaster: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:create-master",
      tag: WS_METHODS.guildCreateMaster,
    }),
    updateMaster: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:update-master",
      tag: WS_METHODS.guildUpdateMaster,
    }),
    setMasterLocation: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:set-master-location",
      tag: WS_METHODS.guildSetMasterLocation,
    }),
    refreshCandidates: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:refresh-candidates",
      tag: WS_METHODS.guildRefreshCandidates,
    }),
    hireAdventurer: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:hire-adventurer",
      tag: WS_METHODS.guildHireAdventurer,
    }),
    startConversation: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:start-conversation",
      tag: WS_METHODS.guildStartConversation,
    }),
    continueConversation: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:continue-conversation",
      tag: WS_METHODS.guildContinueConversation,
    }),
    endConversation: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:end-conversation",
      tag: WS_METHODS.guildEndConversation,
    }),
  };
}
