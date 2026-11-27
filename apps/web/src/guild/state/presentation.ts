import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { Attempt, GuildAdventurerId, GuildSnapshot } from "@t3tools/contracts/guild";
import {
  isOpenAttempt,
  presentAdventurer,
  type GuildConnection,
} from "@t3tools/guild-core/presentation";
import { generateCandidate, visibleCandidateIndices } from "@t3tools/guild-core/recruitment";

import type { NpcEntity } from "../engine/npc";
import { TILE } from "../engine/player";
import { SCENES } from "../world/scenes";

export type Candidate = ReturnType<typeof generateCandidate> & { seed: string; index: number };

export function candidateId(candidate: Candidate) {
  return `candidate:${candidate.seed}:${candidate.index}`;
}

function entity(
  scene: keyof typeof SCENES,
  x: number,
  id: string,
  character: Pick<NpcEntity, "name" | "appearance">,
  clip: NpcEntity["clip"],
): NpcEntity {
  return {
    kind: "npc",
    sceneId: scene,
    x,
    y: SCENES[scene].spawn.y,
    id,
    name: character.name,
    appearance: character.appearance,
    clip,
    facing: 1,
    width: 22,
    height: clip === "sit" || clip === "write" ? 20 : 28,
  };
}

export function presentGuild(
  guild: GuildSnapshot | undefined,
  shells: readonly EnvironmentThreadShell[],
  environmentId: EnvironmentId | null,
  connection: GuildConnection,
) {
  const adventurers = guild?.adventurers.filter(({ status }) => status === "active") ?? [];
  const pool = guild?.settings.candidatePool;
  const taken = adventurers.map(({ name }) => name);
  const slots = SCENES.recruitment_hall.npcSlots.filter(({ kind }) => kind === "stand");
  const candidates = pool
    ? visibleCandidateIndices(pool).map((index) => {
        const candidate = generateCandidate(pool.seed, index, taken);
        taken.push(candidate.name);
        return { ...candidate, seed: pool.seed, index };
      })
    : [];
  const npcs = candidates.flatMap((candidate, index) => {
    const slot = slots[index];
    return slot
      ? [entity("recruitment_hall", slot.x, candidateId(candidate), candidate, "idle")]
      : [];
  });
  const threads = new Map<ThreadId, EnvironmentThreadShell>();
  for (const shell of shells) {
    if (shell.environmentId === environmentId && !shell.deletedAt) threads.set(shell.id, shell);
  }
  const attempts = new Map<GuildAdventurerId, Attempt[]>();
  const guildThreads = new Set<ThreadId>();
  const needsYou: ThreadId[] = [];
  let needsYouCount = 0;
  for (const attempt of guild?.attempts ?? []) {
    const list = attempts.get(attempt.adventurerId) ?? [];
    if (!attempts.has(attempt.adventurerId)) attempts.set(attempt.adventurerId, list);
    list.push(attempt);
    if (isOpenAttempt(attempt)) guildThreads.add(attempt.threadId);
  }
  for (const { latestConversation } of adventurers) {
    if (latestConversation) guildThreads.add(latestConversation.threadId);
  }
  for (const threadId of guildThreads) {
    const thread = threads.get(threadId);
    if (!thread || connection !== "live") continue;
    const approvals = Number(
      thread.hasPendingApprovals || thread.pendingSubagentRequest === "approval",
    );
    const questions = Number(
      thread.hasPendingUserInput || thread.pendingSubagentRequest === "user_input",
    );
    if (approvals || questions) needsYou.push(threadId);
    needsYouCount += approvals + questions;
  }
  const roster = adventurers.map((adventurer) => {
    const history = (attempts.get(adventurer.id) ?? []).toSorted(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
    const presentation = presentAdventurer(
      history.map((attempt) => {
        const thread = threads.get(attempt.threadId);
        const source = thread?.source;
        return {
          attempt,
          shell: source
            ? {
                ...source,
                title: thread.title,
                hasPendingApproval:
                  thread.hasPendingApprovals || thread.pendingSubagentRequest === "approval",
                hasPendingInput:
                  thread.hasPendingUserInput || thread.pendingSubagentRequest === "user_input",
              }
            : null,
          updatedAt: thread?.updatedAt,
        };
      }),
      connection,
    );
    return { adventurer, history, presentation };
  });
  const hall = SCENES.guild_hall;
  const bell = hall.interactables.find(({ id }) => id === "bell");
  const bench = hall.props.find(({ propId }) => propId === "bench");
  const slotsFor = {
    available: hall.npcSlots
      .filter(({ activity }) => activity.includes("available"))
      .map(({ x }) => x),
    working: [
      ...hall.npcSlots.filter(({ activity }) => activity.includes("working")).map(({ x }) => x),
      ...hall.props.filter(({ propId }) => propId === "long_table").map(({ x }) => x),
    ],
    approval: bell ? [bell.x - 16, bell.x + 16] : [],
    resting: bench ? [bench.x] : [],
  };
  const reserved = [...Object.values(slotsFor).flat(), ...hall.doors.map(({ x }) => x)];
  const overflow = Array.from(
    { length: Math.floor((hall.cols * TILE) / 22) - 1 },
    (_, i) => 18 + i * 22,
  ).filter((position) => reserved.every((anchor) => Math.abs(anchor - position) >= 20));
  const used: number[] = [];
  const hasRoom = (x: number) => used.every((position) => Math.abs(position - x) >= 20);
  // A rest state takes the bench before the general hearth seating is assigned.
  const seatingOrder = roster.toSorted(
    (a, b) =>
      Number(b.presentation.slotActivity === "resting") -
      Number(a.presentation.slotActivity === "resting"),
  );
  for (const { adventurer, presentation } of seatingOrder) {
    const preferred = slotsFor[presentation.slotActivity];
    const anchor = preferred[0] ?? hall.spawn.x;
    const x =
      preferred.find(hasRoom) ??
      overflow.filter(hasRoom).sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor))[0] ??
      anchor;
    used.push(x);
    npcs.push({
      ...entity("guild_hall", x, adventurer.id, adventurer, presentation.clip),
      marker: presentation.marker,
      badgeCount: presentation.badgeCount,
    });
  }
  const active = roster.filter(({ presentation }) =>
    presentation.activities.some(
      ({ state }) => state === "working" || state === "waiting_on_other",
    ),
  );
  return { npcs, roster, candidates, active, needsYou, needsYouCount, threads };
}

export type GuildRosterEntry = ReturnType<typeof presentGuild>["roster"][number];
