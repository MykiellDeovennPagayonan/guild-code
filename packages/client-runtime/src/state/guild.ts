import { type EnvironmentId, WS_METHODS } from "@t3tools/contracts";
import type { GuildDelta, GuildSnapshot } from "@t3tools/contracts/guild";
import * as Effect from "effect/Effect";
import type * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import { subscribeDynamic } from "../rpc/client.ts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentSubscriptionAtomFamily,
} from "./runtime.ts";

function upsert<T extends { readonly id: string }>(rows: readonly T[], row: T): readonly T[] {
  const index = rows.findIndex(({ id }) => id === row.id);
  return index === -1 ? [...rows, row] : rows.with(index, row);
}

function applyDelta(guild: GuildSnapshot, delta: GuildDelta): GuildSnapshot {
  let { settings, master, adventurers, attempts } = guild;
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
        break;
    }
  }
  return { settings, master, adventurers, attempts };
}

function subscribeGuild() {
  return Stream.suspend(() => {
    let latest: { readonly sequence: number; readonly guild: GuildSnapshot } | undefined;
    return subscribeDynamic(WS_METHODS.guildSubscribe, () =>
      Effect.sync(() => (latest === undefined ? {} : { afterSequence: latest.sequence })),
    ).pipe(
      Stream.map((item) => {
        if (item._tag === "snapshot") {
          latest = { sequence: item.sequence, guild: item.guild };
        } else if (latest !== undefined && item.sequence > latest.sequence) {
          latest = {
            sequence: item.sequence,
            guild: item._tag === "changed" ? applyDelta(latest.guild, item) : latest.guild,
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
  return {
    state: (environmentId: EnvironmentId) => state({ environmentId, input: null }),
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
    endConversation: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:guild:end-conversation",
      tag: WS_METHODS.guildEndConversation,
    }),
  };
}
