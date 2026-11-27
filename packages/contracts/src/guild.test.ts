import * as Schema from "effect/Schema";
import { expect, it } from "vite-plus/test";

import * as Guild from "./guild.ts";

const at = "2026-11-27T00:00:00.000Z";
const appearance = {
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
};
const pool = { seed: "pool", hiredIndices: [1, 5] };
const settings = { candidatePool: pool, maxConcurrentAttempts: 3, xpRulesVersion: 1 };
const location = { sceneId: "guild_hall", doorId: null, x: 30, facing: 1 };
const master = { name: "Mira", appearance, location, createdAt: at };
const binding = {
  providerInstanceId: "provider-1",
  family: { key: "codex:gpt", label: "GPT" },
  pinnedModel: null,
  options: { effort: "high" },
};
const defaults = {
  runtimeMode: "approval-required",
  interactionMode: "default",
  maxWriteAttempts: 1,
};
const adventurer = {
  id: "adventurer-1",
  name: "Elowen",
  appearance,
  appearanceVersion: 1,
  classId: "mage",
  specialties: ["postgres"],
  rank: null,
  binding,
  defaults,
  instructions: "Review the change.",
  status: "active",
  xp: 0,
  level: 0,
  lastProjectId: "project-1",
  createdAt: at,
  hiredAt: at,
  updatedAt: at,
};
const change = {
  adventurerId: adventurer.id,
  at,
  kind: "hired",
  before: null,
  after: adventurer,
  actor: "user",
};
const attempt = {
  id: "attempt-1",
  adventurerId: adventurer.id,
  kind: "conversation",
  questId: null,
  attemptNumber: null,
  role: null,
  classIdAtStart: adventurer.classId,
  familyKeyAtStart: binding.family.key,
  threadId: "thread-1",
  projectId: "project-1",
  providerInstanceId: binding.providerInstanceId,
  requestedModel: "model-1",
  requestedOptions: null,
  executedModels: ["model-2"],
  status: "active",
  statusReason: null,
  errorClass: null,
  workspace: { strategy: "root", worktreePath: null, branch: null, baseRevision: null },
  usage: { status: "unavailable" },
  startedAt: at,
  endedAt: null,
  createdAt: at,
};
const turn = {
  attemptId: attempt.id,
  providerTurnId: "turn-1",
  t3RunAttemptId: "run-attempt-1",
  t3RunId: "run-1",
  status: "completed",
  requestedModel: "model-1",
  executedModel: "model-2",
  turnTokenUsage: null,
  errorClass: null,
  startedAt: at,
  endedAt: at,
};
const summary = {
  id: adventurer.id,
  name: adventurer.name,
  appearance,
  classId: adventurer.classId,
  status: adventurer.status,
  level: adventurer.level,
  binding: {
    providerInstanceId: binding.providerInstanceId,
    family: binding.family,
    pinnedModel: null,
  },
  latestConversation: { attemptId: attempt.id, threadId: attempt.threadId },
};
const snapshot = { settings, master, adventurers: [summary], attempts: [attempt] };
const delta = { upserts: [{ _tag: "master", value: master }], removals: [] };

it.each([
  ["appearance", Guild.Appearance, appearance, { ...appearance, species: " " }],
  ["pool", Guild.CandidatePool, pool, { ...pool, hiredIndices: [1, 1] }],
  ["settings", Guild.GuildSettings, settings, { ...settings, maxConcurrentAttempts: 0 }],
  ["location", Guild.GuildMasterLocation, location, { ...location, facing: 0 }],
  ["master", Guild.GuildMaster, master, { ...master, name: "x".repeat(25) }],
  ["class", Guild.ClassId, "mage", "wizard"],
  ["binding", Guild.ModelBinding, binding, { ...binding, providerInstanceId: "" }],
  ["defaults", Guild.AdventurerDefaults, defaults, { ...defaults, maxWriteAttempts: 1.5 }],
  ["adventurer", Guild.Adventurer, adventurer, { ...adventurer, hiredAt: "yesterday" }],
  ["adventurer change", Guild.AdventurerChange, change, { ...change, actor: "unknown" }],
  ["attempt", Guild.Attempt, attempt, { ...attempt, threadId: "" }],
  ["attempt turn", Guild.AttemptTurn, turn, { ...turn, status: "active" }],
  [
    "summary",
    Guild.AdventurerSummary,
    summary,
    { ...summary, latestConversation: { attemptId: "attempt-1" } },
  ],
  ["snapshot", Guild.GuildSnapshot, snapshot, { ...snapshot, settings: null }],
  [
    "snapshot item",
    Guild.GuildStreamItem,
    { _tag: "snapshot", sequence: 0, guild: snapshot },
    { _tag: "snapshot", sequence: -1, guild: snapshot },
  ],
  [
    "changed item",
    Guild.GuildStreamItem,
    { _tag: "changed", sequence: 1, ...delta },
    { _tag: "changed", sequence: 0, ...delta },
  ],
  [
    "synchronized item",
    Guild.GuildStreamItem,
    { _tag: "synchronized", sequence: 1 },
    { _tag: "synchronized", sequence: 1.5 },
  ],
] satisfies ReadonlyArray<readonly [string, Schema.Codec<unknown, unknown>, unknown, unknown]>)(
  "round-trips %s and rejects invalid data",
  (_name, schema, value, invalid) => {
    const decode = Schema.decodeUnknownSync(schema);
    expect(Schema.encodeUnknownSync(schema)(decode(value))).toEqual(value);
    expect(() => decode(invalid)).toThrow();
  },
);

it("preserves an observed zero and leaves unreported token counts absent", () => {
  const encode = Schema.encodeSync(Guild.AttemptUsage);
  const decode = Schema.decodeUnknownSync(Guild.AttemptUsage);
  expect(encode(decode({ status: "partial", outputTokens: 0 }))).toEqual({
    status: "partial",
    outputTokens: 0,
  });
  expect(decode({ status: "unavailable" })).not.toHaveProperty("outputTokens");
  expect(() => decode({ status: "unavailable", outputTokens: 0 })).toThrow();
  expect(() => decode({ status: "complete", outputTokens: -1 })).toThrow();
});
