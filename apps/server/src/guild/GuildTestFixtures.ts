import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { GuildAdventurerId, GuildAttemptId, type Appearance } from "@t3tools/contracts/guild";

export const appearance = {
  v: 1,
  species: "human",
  head: "round",
  top: "none",
  face: "plain",
  outfit: "tunic",
  boots: "leather",
  back: "none",
  weapon: "none",
  palette: "oak",
} satisfies Appearance;

export const adventurerId = (index: number) => GuildAdventurerId.make(`adventurer-${index}`);
export const attemptId = (index: number, kind: "earlier" | "latest") =>
  GuildAttemptId.make(`attempt-${index}-${kind}`);

const created = "2026-11-26T00:00:00.000Z";
const last = "2026-11-27T00:00:00.000Z";
const binding = JSON.stringify({
  providerInstanceId: "codex",
  family: { key: "codex:model", label: "Model" },
  pinnedModel: null,
  options: { effort: "high" },
});
const defaults = JSON.stringify({
  runtimeMode: "approval-required",
  interactionMode: "default",
  maxWriteAttempts: 1,
});
const workspace = JSON.stringify({
  strategy: "root",
  worktreePath: null,
  branch: null,
  baseRevision: null,
});
const instructions = "Check build logs and report unexpected changes. ".repeat(150);
const usage = JSON.stringify({ status: "unavailable" });

const appearanceJson = JSON.stringify(appearance);
const hireChangeJson = JSON.stringify({ instructions });

export const seedAdventurers = Effect.fn("GuildTestFixtures.seedAdventurers")(function* (
  count: number,
) {
  const sql = yield* SqlClient.SqlClient;
  for (let index = 0; index < count; index++) {
    const id = adventurerId(index);
    yield* sql`
      INSERT INTO guild_adventurers
        (id, name, appearance_json, appearance_version, class_id, specialties_json, binding_json, defaults_json,
         instructions, status, xp, level, created_at, hired_at, updated_at)
      VALUES
        (${id}, ${`Elowen ${index}`}, ${appearanceJson}, 1, 'mage', '[]', ${binding}, ${defaults},
         ${instructions}, 'active', 0, 0, ${created}, ${created}, ${created})
    `;
    yield* sql`
      INSERT INTO guild_adventurer_changes (adventurer_id, at, kind, after_json, actor)
      VALUES (${id}, ${created}, 'hired', ${hireChangeJson}, 'user')
    `;
    const latestStatus = index % 2 === 0 ? "completed" : "active";
    for (const [version, status, at] of [
      ["earlier", "completed", created],
      ["latest", latestStatus, last],
    ] as const) {
      yield* sql`
        INSERT INTO guild_attempts
          (id, adventurer_id, kind, class_id_at_start, family_key_at_start, thread_id, project_id,
           provider_instance_id, requested_model, executed_models_json, status, workspace_json, usage_json,
           started_at, ended_at, created_at)
        VALUES
          (${attemptId(index, version)}, ${id}, 'conversation', 'mage', 'codex:model',
           ${`thread-${index}-${version}`}, 'project-1', 'codex', 'model', '[]', ${status}, ${workspace},
           ${usage}, ${at}, ${status === "completed" ? at : null}, ${at})
      `;
    }
    yield* sql`
      INSERT INTO guild_attempt_turns (provider_turn_id, attempt_id, status, requested_model, executed_model)
      VALUES (${`turn-${index}`}, ${attemptId(index, "latest")}, 'completed', 'model', 'model')
    `;
  }
});
