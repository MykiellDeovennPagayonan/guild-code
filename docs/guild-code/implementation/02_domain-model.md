# 02 — Domain model and persistence

> Status: Draft v1 (2026-11-27). Increments: 1 (identity, attempts), 2 (hierarchy, quests, evidence, rewards), 3 (parties, findings, approvals), 4 (leases), 5 (journal, achievements).

## Purpose

The Guild entities, how they link to T3's projects and threads, the tables that store them, how changes are made safely (validation, idempotency, history), and how clients receive them.

## Read first

1. [01_architecture.md](01_architecture.md), especially §Why Guild has its own tables and §How Guild drives real work.
2. [../glossary.md](../glossary.md).
3. [00_foundation-audit.md](00_foundation-audit.md) §1–§3.

## Requirements covered

T3-03, T3-04, PIL-01, NAV-02, NAV-03, PRO-01…PRO-09, HIER-01…HIER-05, QST-05, QST-06, QST-12, PTY-12, MOD-04, ARCH-03, ARCH-05.

## Non-negotiables (from the brief)

- "A provider session is not an adventurer. Maintain explicit links among adventurer, quest, execution attempt, actual provider/model and T3 thread/session identifiers." (T3-04)
- "A party is associated with the mission/expedition; it is not another level of task hierarchy. A quest may have many attempts and evidence records." (HIER-02)
- "State must be persisted, transitions validated, duplicate events idempotent, and failure paths observable." (QST-12)
- "The implementation should preserve invariants around ownership, attribution, idempotency and identity." (ARCH-05)

## Design

### Naming: Guild terms vs T3 terms

T3 already uses "run" for one user-to-agent turn cycle. To avoid confusion in code:

| Brief term   | Guild code name           | T3 counterpart                                                                                     |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------- |
| Epic         | `Epic`                    | one `Project` (`ProjectId`)                                                                        |
| Mission      | `Mission`                 | one primary thread (`ThreadId`)                                                                    |
| Quest        | `Quest`                   | none (Guild-only)                                                                                  |
| Run/attempt  | `Attempt` (UI: "Attempt") | one thread (`ThreadId`) launched for that attempt                                                  |
| —            | `AttemptTurn`             | one T3 **provider turn** (`ProviderTurnId`) inside the attempt's thread, with its T3 run (`RunId`) |
| Adventurer   | `Adventurer`              | none; bound to threads through attempts                                                            |
| Guild Master | `GuildMaster`             | none; the user                                                                                     |

Never call a Guild attempt a "run" in code. In UI copy, "Run" may appear only where it means a T3 turn. T3 also has `RunAttempt` (`RunAttemptId`): one try at executing a T3 run, which can retry or restart (`packages/contracts/src/orchestrationV2.ts:883`). It is unrelated to a Guild `Attempt`; always qualify it as "T3 run attempt" in code comments and names (`t3RunAttemptId`).

### Entity overview

```
GuildSettings (1)            GuildMaster (1)
Kingdom (0..n) ──< Epic ── 1:1 ── T3 Project
                    │
                    └──< Mission ── 1:1 ── primary T3 thread
                           │  └── Expedition (0..n) ── Party
                           └──< Quest ──< QuestDependency (quest → prerequisite quest)
                                  ├──< QuestAssignment ── Adventurer (role)
                                  ├──< Attempt ── 1:1 ── T3 thread (launched by Guild)
                                  │      └──< AttemptTurn ── 1:1 ── T3 run
                                  ├──< Evidence (revision-pinned)
                                  └──< Finding
Adventurer ──< AdventurerChange (history)
           ──< Attempt (also quest-less "conversation" attempts)
           ──< RewardEvent, Achievement, JournalEntry (epic-scoped)
Party ──< PartyMember ── Adventurer        Formation (template)
GuildApproval (plan, scope change, merge gate, override, destructive action)
WorkspaceLease (writable worktree ownership)
GuildActivity (append-only log of every Guild change)
```

### IDs

Every Guild entity has a branded string ID schema in `packages/contracts/src/guild.ts` (`GuildAdventurerId`, `GuildQuestId`, `GuildAttemptId`, …), following the `TrimmedNonEmptyString`-brand pattern in `packages/contracts/src/baseSchemas.ts:287-354`. IDs are generated on the server with `crypto.randomUUID()` and never reused. The internal ID is the identity; names are display data (REC-03).

### Entities

Field lists are the minimum each increment needs. Types are conceptual; the Effect Schemas in contracts are authoritative once written.

#### Identity and attempts

The Increment 1 schemas live in [guild.ts](../../../packages/contracts/src/guild.ts) and the tables in [migration 120](../../../apps/server/src/persistence/Migrations/120_GuildIdentity.ts).

- Guild settings and the Guild Master are singletons. The Guild Master represents the user and has no provider binding. Save the master's location on scene change and when leaving the Guild view (NAV-02).
- Adventurer identity outlives project, binding and lifecycle changes. Appearance is versioned. Record meaningful edits in the append-only adventurer change history. Class never changes the defaults a user approved. XP and level are cached projections once rewards exist. Loadouts arrive in Increment 5.
- An attempt preserves the class, family and model requested at its start and links to a unique T3 thread. Store model drift from each provider turn so per-model history survives session changes. Quest links and quest attempts arrive in Increment 2.
- One attempt turn records one provider turn. A T3 run may span several T3 run attempts and provider turns. Keep both T3 run IDs and deduplicate by provider turn ID. Missing token counts stay absent, including when other counts from the same turn were reported.

**Kingdom** — Increment 2 (optional grouping, HIER-04)

- `id`, `name`, `bannerPalette: string` (a palette id), `createdAt`, `archivedAt | null`.

**Epic** — Increment 2

- `id`, `projectId: ProjectId` (unique; one epic per project), `kingdomId | null`, `instructions: string`, `biome: string | null` (later, LATER-01), `createdAt`, `archivedAt | null`.
- Repository, default branch and workspace come from the T3 project and Git at read time; Guild does not copy them (single source of truth). Multiple repositories (HIER-04) are T3's: a project's `trackedFolders` (`packages/contracts/src/orchestrationProject.ts`) and multi-repository worktrees (`workspaceStrategy.worktree.repositories`) are shown on the epic and used as T3 uses them; Guild adds no repository list of its own.

**Mission** — Increment 2 (HIER-05)

- `id`, `epicId`, `primaryThreadId: ThreadId | null` (unique when set; null only for a quick mission until its first attempt's thread becomes primary, 08 §Quick quests), `leaderAttemptId: GuildAttemptId | null` (the leader's conversation attempt, 09 §Leader workflow), `title`, `objective`, `context`, `constraints`, `plan: string` (markdown), `acceptanceCriteria: Criterion[]`, `targetBranch | null`, `integrationBranch | null`, `requiresMerge: boolean`, `status: MissionStatus` (08), `statusBeforePause | null`, `createdAt`, `updatedAt`.
- **Primary thread rule.** Created with a lead adventurer: the lead's conversation attempt thread is both `primaryThreadId` and `leaderAttemptId`'s thread. Created without one: the server launches a user thread with the epic project's `defaultModelSelection` passed **explicitly** (never through T3's fallback resolver); `leaderAttemptId` stays null. Appointing a leader later (Increment 3) creates a new leader attempt and sets `leaderAttemptId`; `primaryThreadId` does not change.

**Quest** — Increment 2 (QST-05)

- `id`, `missionId`, `title`, `category: QuestCategory` (08 §Categories), `objective`, `scope`, `expectedOutputs`, `deliverable: "code" | "report" | "tests" | "docs" | "decision"`.
- `acceptanceCriteria: Criterion[]` where `Criterion = { id, text, evidence: EvidenceKind[] }` — each criterion names the evidence kinds that can satisfy it (08 §Evidence gates).
- `priority: 1..4`, `difficulty: "trivial" | "small" | "medium" | "large"`.
- `status: QuestStatus` (08), `statusReason | null`.
- `workspace: { strategy: "root" | "mission_branch" | "own_worktree" | "read_only_snapshot", baseRevision | null }`.
- `limits: { maxAttempts: int, maxTurnsPerAttempt: int | null }`.
- `verificationRequired: boolean`, `createdBy: "user" | GuildAdventurerId`, `createdAt`, `updatedAt`.

**QuestDependency** — Increment 2 storage, Increment 3 scheduling

- `questId`, `prerequisiteQuestId`, unique pair, acyclic (validated with `guild-core` graph check).

**QuestAssignment** — Increment 2

- `questId`, `adventurerId`, `role: "implementer" | "investigator" | "reviewer" | "verifier" | "observer" | "leader"`, `assignedAt`, `unassignedAt | null`.

**Evidence** — Increment 2

- `id`, `questId`, `attemptId | null`, `criterionId | null`, `kind: EvidenceKind` (`diff | commit | pull_request | test_run | report | review_verdict | user_decision`), `revision: string | null` (commit SHA or checkpoint ref the evidence is about), `payload: Json` (kind-specific), `status: "valid" | "stale" | "superseded"`, `createdBy`, `createdAt`.
- Evidence rules are in 08 and 10.

**Finding** — Increment 3 (PTY-12)

- `id`, `questId`, `attemptId`, `authorAdventurerId`, `severity: "critical" | "high" | "medium" | "low" | "info"`, `location: { path, line | null } | null`, `evidence: string`, `affectedRevision: string | null`, `recommendation: string`, `resolution: "open" | "accepted" | "rejected" | "fixed" | "wont_fix"`, `resolvedBy | null`, `resolutionNote | null`, `createdAt`, `updatedAt`.

**Party, PartyMember, Formation, Expedition** — Increment 3 (09)

- `Party { id, name | null, persistent: boolean, formationId | null, leaderAdventurerId | null, createdAt, disbandedAt | null }`
- `PartyMember { partyId, adventurerId, role, joinedAt, leftAt | null }`
- `Formation { id, name, slots: { role, preferredClass | null, count }[], policy: { mode, verificationRequired, maxParallel } }`
- `Expedition { id, missionId, partyId, mode, status, startedAt, endedAt | null, budget }`, with `status: "planned" | "running" | "paused" | "completed" | "cancelled"`: `planned → running` (start), `running ↔ paused`, `running → completed` (mission delivered), any non-terminal `→ cancelled`, `cancelled → planned` (reopen). Transition table in `packages/guild-core/src/lifecycle/expedition.ts` (T3.5).

**QuestNote** — Increment 2 (user comments) and Increment 3 (agent handoff notes)

- `id`, `questId`, `author: "user" | GuildAdventurerId`, `text`, `createdAt`, `editedAt | null`, `deletedAt | null`. The user's quest comments (brief §8.4) and `guild_post_note` both write here.

**UserEdit** — Increment 2 (10 §Attribution)

- `id`, `worktreePath`, `attemptId | null` (the attempt holding the worktree at the time), `path`, `kind: "save" | "commit" | "takeover"`, `revision | null`, `at`.

**GuildApproval** — Increment 3 (10 §Council)

- `id`, `kind: "plan" | "scope_change" | "dependency_override" | "merge_gate" | "destructive_action" | "binding_change" | "defaults_change" | "budget_alert" | "conflict"`, `subject: { missionId?, questId?, attemptId? }`, `requestedBy: "system" | GuildAdventurerId`, `summary`, `details: Json`, `status: "pending" | "approved" | "rejected" | "expired"`, `decidedAt | null`, `note | null`.
- `expired`: the server sets it when the subject reaches a terminal state (quest/mission/attempt done or cancelled) or is superseded by a newer approval of the same kind for the same subject, before the user decided.
- Provider permission prompts stay T3 runtime requests; Guild lists them alongside but never copies or answers them on the user's behalf.

**WorkspaceLease** — Increment 3/4 (10 §Workspace leases)

- `id`, `worktreePath`, `branch`, `holder: { kind: "attempt"; attemptId } | { kind: "user" }`, `mode: "write" | "read"`, `baseRevision`, `acquiredAt`, `releasedAt | null`. At most one active write lease per worktree path. A `user` holder comes from take-over (10 §Workspace leases).

**RewardEvent, Achievement** — Increment 2 / 5 (11)

- `RewardEvent { id, adventurerId, sourceKey (unique), xp, category, questId | null, findingId | null, createdAt }`
- `Achievement { adventurerId, achievementId, sourceKey (unique), awardedAt }`

**JournalEntry** — Increment 5 (12)

- `id`, `adventurerId`, `epicId` (scope; required), `kind: "discovery" | "decision" | "convention" | "lesson"`, `text`, `provenance: { attemptId, threadId, revision | null }`, `approvedAt`, `staleAt | null`, `updatedAt`, `deletedAt | null`.

**GuildActivity** — Increment 1

- `sequence: int` (autoincrement), `at`, `entity: string`, `entityId`, `change: string`, `before: Json | null`, `after: Json | null`, `actor`, `commandId | null`.
- Every Guild mutation writes one or more rows in the same transaction. This is permanent history (chronicles, LATER-05) and the stream cursor (§Stream).

### Persistence

- SQLite tables in the server's existing database, created by migrations `120_Guild*.ts` onward, registered in `apps/server/src/persistence/Migrations.ts`. One migration per increment's tables (e.g. `120_GuildIdentity.ts`, `121_GuildQuests.ts`, …). Never edit a shipped migration; add a new one.
- Table names prefixed `guild_` (`guild_adventurers`, `guild_attempts`, …). JSON columns for nested values (`appearance_json`, `binding_json`), following the `payload_json` precedent.
- Repository service `GuildStore` (`apps/server/src/guild/GuildStore.ts`) using `SqlSchema` with Schema-decoded rows and `PersistenceSqlError | PersistenceDecodeError` errors, like `persistence/IssueTrackerBindings.ts`.

### Making changes

All mutations go through `GuildService` (`apps/server/src/guild/GuildService.ts`). Each command:

1. Carries a client-generated `commandId`.
2. Checks `guild_command_receipts(command_id PRIMARY KEY, result_json, created_at)`. A hit returns the stored result without re-applying (QST-12).
3. Loads current state, validates the transition with the pure state machine from `packages/guild-core` (08), and checks invariants (below).
4. Writes the state change, the `GuildActivity` rows and the receipt in **one SQL transaction**.
5. Publishes the change to the guild stream after commit.
6. Side effects on T3 (launching a thread, sending a message, interrupting) happen **after** commit through a small Guild outbox (`guild_outbox` table: `id, kind, payload_json, status: "pending" | "running" | "done" | "failed", attempts, last_error, created_at`) drained by a worker. T3 calls use deterministic `commandId`s derived from the outbox row id. **Retry rule (stated once, here):** an outbox row may be re-run only if its T3 call is idempotent by that command id. `ThreadLaunchService.launch` replays an already-accepted command (`apps/server/src/orchestration-v2/ThreadLaunchService.ts:1481`), and thread messages and interrupts go through orchestrator commands with receipts (00 §1), so every v1 kind qualifies. A future kind without that guarantee must check T3 state before re-running, and otherwise goes to `failed` for the user to decide.

Rejected commands return a typed error and are recorded as rejected receipts, so a retry gets the same rejection.

### Bridging T3 events into Guild

`GuildRunBridge` (`apps/server/src/guild/GuildRunBridge.ts`) subscribes to T3's domain event stream (the way `DelegatedTaskQuestionReactor` does) and, for threads that belong to an attempt:

- creates or updates the `AttemptTurn` row keyed by `providerTurnId` from `provider-turn.*` events, resolving `t3RunId` through the T3 run attempt (idempotent);
- appends executed models to `Attempt.executedModels`;
- copies turn token usage;
- updates `Attempt.status` through the attempt state machine (08 §Attempt states);
- on thread deletion, moves the attempt to `cancelled` with `statusReason: "thread_deleted"`.

T3's domain event stream starts at the latest sequence when subscribed, so the bridge also reconciles from the thread projections (T3's thread records for each attempt thread) on startup and right after each launch, to catch anything it missed (14 §Restart recovery). It runs after T3's `ProviderRuntimeRecoveryService.recover` in server startup (`apps/server/src/serverRuntimeStartup.ts`).

### Stream to clients

New RPCs in a `guild` group (contracts), handled thinly in `apps/server/src/ws.ts`:

- `guild.subscribe` → stream of `GuildStreamItem`:
  - `snapshot { sequence, guild: GuildSnapshot }`
  - `changed { sequence, upserts: GuildEntity[], removals: { entity, id }[] }`
  - `synchronized { sequence }`
  - Resume with the last `sequence`. The server replays a bounded window of deltas from the permanent activity log or sends a fresh snapshot. Read the snapshot at the same sequence as its state and wake subscribers only after commit. See [GuildService](../../../apps/server/src/guild/GuildService.ts).
- The Increment 1 snapshot contains settings, the Guild Master, adventurer summaries, and non-terminal attempts. Each summary links to its latest conversation, including an ended conversation. Later increments add open missions and quests (plus the 50 most recent closed quests), active parties, pending approvals, epics and kingdoms.
- History is fetched on demand with query RPCs: `guild.getAdventurerProfile(id)`, `guild.getQuest(id)`, `guild.getMission(id)`, `guild.listAttempts({ adventurerId?, questId?, cursor })`, `guild.getStats(scope)`.
- Mutations are RPCs named `guild.<verb>` (e.g. `guild.hireAdventurer`, `guild.postQuest`), each taking a `commandId`. Clients call them through `createEnvironmentRpcCommand` and gate UI with `permissionAtom`; add the guarded scopes to `CLIENT_GUARDED_RPC_SCOPES` (root AGENTS.md _Taste_).
- **Export** (brief §13 "backup/export"; Increment 4, T4.7): `guild.export()` returns a versioned JSON document of every Guild table (no T3 data, no secrets) for the user to save. The SQLite database itself is backed up with T3's existing storage tools. Import is out of scope for v1.
- Wire budget: add the guild snapshot to the transfer budget test (`docs/internals/16_performance-regressions.md`). The snapshot must stay small: no transcripts, no diffs, no history arrays.

## Invariants

1. One adventurer is one identity forever: IDs never change or get reused; opening another thread for the same adventurer never creates a new adventurer (PRO-09).
2. Every attempt links exactly one adventurer and one T3 thread, recorded before the thread's first turn starts (01 invariant 3).
3. Every attempt records the requested model and every executed model.
4. Every mutation is idempotent by `commandId`; every bridge update is idempotent by T3 identifiers.
5. Every mutation writes `GuildActivity` in the same transaction; history is never deleted.
6. Quest dependencies are acyclic.
7. At most one active write lease per worktree path.
8. Unknown numeric values are stored as absent, never 0.
9. Derived values (level, availability, stats) are recomputable from stored records.

## Failure and reverse states

- Every status that can be entered can be left (see 08 for transitions). Archive ↔ restore for adventurers; cancel is terminal for an attempt but a new attempt can be started.
- T3 project deleted: epic shows "Project missing" and its missions become read-only; restoring requires re-linking to a project explicitly.
- T3 thread deleted: the attempt keeps its records with `thread_deleted`; the transcript link shows "deleted in T3".
- Outbox side effect fails permanently (e.g. provider instance removed): the attempt goes to `failed` with the reason, visible in the profile and inbox.

## Out of scope

- Multi-user ownership, sharing, cloud sync.
- Storing transcripts in Guild tables (they stay in T3; Guild links to them).

## Acceptance checks

1. Schema tests: every entity round-trips through its Effect Schema; invalid values are rejected.
2. Idempotency test: applying the same `commandId` twice yields one state change and one activity row.
3. Bridge test: replaying the same T3 events twice yields the same `AttemptTurn` rows.
4. Restart test: after server restart, adventurers, attempts and activity are intact (Increment 1).
5. Wire budget test includes the guild snapshot and stays within its budget.

## Open questions

None.
