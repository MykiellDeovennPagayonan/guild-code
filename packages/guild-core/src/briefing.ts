import type { Adventurer } from "@t3tools/contracts/guild";

import { guildClasses } from "./classes.ts";

export function guildBriefing(adventurer: Pick<Adventurer, "name" | "classId" | "instructions">) {
  const role = guildClasses[adventurer.classId];
  return [
    "[Guild briefing]",
    `You are ${adventurer.name}, a ${role.label} in the user's guild. ${adventurer.instructions.trim() || role.instructions}`,
    "[End of briefing]",
  ].join("\n");
}
