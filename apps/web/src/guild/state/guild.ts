import { useAtomValue } from "@effect/atom-react";
import { createGuildEnvironmentAtoms } from "@t3tools/client-runtime/state/guild";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { CommandId, type EnvironmentId } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

import { environmentThreadShells } from "../../state/threads";
import { connectionAtomRuntime } from "../../connection/runtime";
import { randomUUID } from "../../lib/utils";
import { usePrimaryEnvironmentId } from "../../state/environments";

export const guildEnvironment = createGuildEnvironmentAtoms(connectionAtomRuntime);

export const guildSnapshotAtom = Atom.family((environmentId: EnvironmentId | null) =>
  Atom.make((get) =>
    environmentId === null
      ? undefined
      : AsyncResult.getOrElse(get(guildEnvironment.state(environmentId)), () => undefined)?.guild,
  ),
);

export const guildThreadShellsAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get) => {
    const guild = get(guildSnapshotAtom(environmentId));
    const threadIds = new Set(guild?.attemptThreadIds);
    for (const { threadId } of guild?.attempts ?? []) threadIds.add(threadId);
    for (const { latestConversation } of guild?.adventurers ?? []) {
      if (latestConversation) threadIds.add(latestConversation.threadId);
    }
    return Array.from(threadIds).flatMap((threadId) => {
      const shell = get(environmentThreadShells.quietThreadShellAtom({ environmentId, threadId }));
      return shell ? [shell] : [];
    });
  }),
);

export const guildMasterAtom = Atom.family((environmentId: EnvironmentId | null) =>
  Atom.make((get) => get(guildSnapshotAtom(environmentId))?.master),
);

export function useGuildAdventurers(enabled: boolean) {
  const environmentId = usePrimaryEnvironmentId();
  return useAtomValue(guildSnapshotAtom(enabled ? environmentId : null))?.adventurers;
}

export function guildCommandId() {
  return CommandId.make(randomUUID());
}

export function guildCommandError(result: Parameters<typeof squashAtomCommandFailure>[0]) {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error ? error : new Error("The Guild action could not be completed.");
}
