# 09 — Parties and orchestration

> Status: Draft v1 (2026-11-27). Increment 3 (all), Increment 5 (campaign map). Decisions D-010, D-015, D-016 are made here.

## Purpose

How adventurers work together: parties, formations and leaders; the three orchestration modes; the server-side scheduler that owns dependencies, budgets, leases and cancellation; and the Guild MCP tools agents use to propose, report and submit work as structured, validated actions.

## Read first

1. [08_quest-lifecycle.md](08_quest-lifecycle.md) (quest and attempt machines, evidence gates).
2. [02_domain-model.md](02_domain-model.md) §Party, §Finding, §GuildApproval, §WorkspaceLease, §Making changes.
3. [00_foundation-audit.md](00_foundation-audit.md) §4 (MCP and `delegate_task`).
4. [10_engineering-surfaces.md](10_engineering-surfaces.md) §Workspace leases.

## Requirements covered

PIL-04, T3-06, T3-07, CLS-04, CLS-05, PTY-01…PTY-09, PTY-12, PTY-13, NPC-02, LATER-02, ACC-PARTY, ACC-CTRL.

## Non-negotiables (from the brief)

- "Party leader is an appointment, not an exclusive class or a level requirement." (CLS-04)
- "Default to one active writable assignment per adventurer, with explicit concurrency overrides where supported." (PTY-03)
- "Never force a large party for a trivial task or spawn more sessions than the configured budget permits." (PTY-05)
- "The leader's model supplies planning and judgment; do not let a natural-language response alone control authorization or declare success." (PTY-08)
- "Provide structured application-level actions … Validate actions server-side against the mission policy. Keep raw provider transcripts available for inspection." (PTY-09)
- "Independent verification should avoid simply asking the same implementation session to grade its own work." (PTY-13)

## Design

### Execution substrate (decision D-010)

Every quest attempt is a **top-level T3 thread launched by Guild** through `ThreadLaunchService.launch` (00 §3), not a `delegate_task` child. Reasons, all from the audit:

- `delegate_task` requires the parent's run to be active (`parent_not_active`, `OrchestratorMcpService.ts:2953-2965`); a Guild scheduler must keep working when the leader's thread is idle, rate-limited or closed.
- `delegate_task` resolves the child's provider from the parent's instance first (`resolveTarget`, `:1705-1849`); each adventurer must run on **its own** binding (06).
- Children's modes are capped by the parent (`delegatedTaskModes.ts:39-91`); each adventurer must run with **its own** user-approved defaults.
- Subagent threads are hidden from thread lists (`isListedThreadLineage`); the user should see every adventurer's thread in focus mode.
- T3 has no concurrency cap (00 §5); Guild needs its own budget anyway.

This is the brief's "independently managed provider sessions for application-level orchestration" (T3-06). It still runs inside T3's providers, auth, approvals and runtime modes, so provider policies and limits are respected. Leaders never call `delegate_task` for Guild work; the Guild briefing tells them to use Guild tools instead.

### Parties and formations (PTY-01, PTY-02, PTY-04)

- **Direct assignment** needs no party: assigning one adventurer to a quest is a valid solo expedition.
- **Temporary party**: created when the user assembles members for a mission; `persistent: false`; dissolves (`disbandedAt`) when the expedition ends.
- **Persistent party**: named, kept across missions, accumulates collaboration stats (11).
- **Members** have a party role: `leader`, `implementer`, `investigator`, `reviewer`, `verifier`, `observer`. Any adventurer of any class and any level can hold any role, including leader (CLS-04, CLS-05). Class only drives defaults and suggestions.
- **Formations** are templates of role slots plus a policy. Seeded formations (editable, deletable, more can be saved):

| Formation        | Slots                                                                                      | Policy defaults             |
| ---------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| Solo             | 1 implementer                                                                              | manual, no verification     |
| Bug hunt         | investigator (Ranger), investigator (Scout), verifier (Cleric)                             | delegated, verification on  |
| Feature party    | leader, 2 implementers (Warrior), reviewer (Mage), verifier (Cleric)                       | delegated, verification on  |
| Audit expedition | leader, 2 investigators (Scout), 2 reviewers (Mage), reviewer (Paladin), verifier (Cleric) | delegated, verification on  |
| Major expedition | leader, 4 implementers, 4 observers (paired), 2 verifiers, optional Paladin                | autonomous, verification on |

Filling a formation suggests available adventurers with the preferred class; the user can pick anyone available (PTY-05). Slots can be left empty; a formation never forces its size.

### Availability and concurrency (PTY-03, PTY-05, decision D-015)

- **Adventurer write limit:** at most `Adventurer.defaults.maxWriteAttempts` (default **1**) non-terminal attempts holding a write lease per adventurer. The user can raise it per adventurer (logged `defaults_changed`). Read-only attempts (investigator, reviewer, observer on a read lease) don't count toward it.
- **Guild budget:** `GuildSettings.maxConcurrentAttempts` (default 3) live attempts across the guild, plus optional per-provider-instance caps. "Live" = attempt `active` and its thread not `idle`/`stopped` (07 live state).
- **Expedition budget:** `{ maxParallel, maxAttemptsTotal, maxTurnsPerAttempt | null }`. Token or cost budgets are **not** enforced up front because usage is known only after turns and is unavailable for some providers (11); if an expedition sets a token alert, crossing it pauses scheduling and raises a GuildApproval, never silently stops a running turn.
- An adventurer's availability (derived): `available`, `busy` (write limit reached), `needs_attention` (07 needs-the-user states), `resting` (rate-limited), `on_leave` (archived), `unknown`.

### Orchestration modes (PTY-06)

Set per expedition in its policy; changing mode is an explicit user action.

| Mode                      | Who creates quests                                                                        | Who starts quests                                              | Who accepts                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Manual command**        | User                                                                                      | User (`start`)                                                 | User                                                                                                                      |
| **Delegated command**     | Leader proposes (`guild_propose_plan`); user approves the plan                            | Leader (`guild_start_quest`) within the approved plan, or user | User                                                                                                                      |
| **Autonomous expedition** | Leader proposes; user approves plan, permissions, budget and verification policy up front | Scheduler, automatically, as dependencies clear                | User, or automatically if the approved policy has `autoAccept` and the gate's machine evidence holds (08 §Evidence gates) |

In every mode, these always escalate to the user as a GuildApproval and pause the affected quest: new quests outside the approved plan (scope change), dependency overrides, merges/integration (10), destructive actions the leader wants to authorise (it can't; only the user can), binding or permission changes, budget alerts, unresolved conflicts. The user can pause, cancel or take over at any time (ACC-CTRL).

### Scheduler (PTY-08, decision D-016)

`GuildScheduler` (`apps/server/src/guild/GuildScheduler.ts`) is an Effect service registered with T3's `Scheduler.register("guild", runDue)` (`apps/server/src/scheduling/Scheduler.ts`) and woken by Guild state changes (a due hint, like `scheduling/DueHint.ts`). It owns, durably:

- **dependency scheduling**: candidates are quests in `queued` with all prerequisites accepted, ordered by priority, then queue time;
- **budgets** (above);
- **workspace leases** (10): acquire before launch, release when the attempt ends;
- **launch** via the quest `launch` transition and the Guild outbox (02 §Making changes);
- **cancellation**: cancelling a quest or expedition stops each active attempt's thread through T3's interrupt/stop, releases leases, and records the result;
- **retries**: never automatic. A failed attempt leaves the quest `failed` (or `changes_requested` after review); only an explicit `retry`/`rework` queues it again (QST-08, PERF-03).

Each tick is idempotent: decisions are re-derived from stored state, and each launch carries a deterministic command id, so a crash mid-tick never double-launches.

### Leader workflow (PTY-07)

1. **Discuss.** The leader talks with the user in the leader's conversation attempt (role `leader`, `Mission.leaderAttemptId`). If the mission was created with that adventurer as lead, this is also the mission's primary thread; if a leader is appointed later, a new leader attempt is launched and the primary thread stays as it was (02 §Mission, primary thread rule). The user talks to the leader there; the briefing includes the mission objective, constraints, the party roster with classes and bindings, and the available Guild tools.
2. **Propose.** The leader calls `guild_propose_plan` with quests (category, objective, scope, criteria, deliverable, suggested role/assignee, dependencies, verification). Guild stores them as `draft` quests and creates a `plan` GuildApproval. The user reviews and edits them on the War Room table or the board, then approves or rejects (ACC-PARTY "approve a quest plan").
3. **Assign and set up workspaces.** On approval, drafts become `posted`; suggested assignments become real only if those adventurers are available and in the party; workspaces follow quest defaults (10).
4. **Start.** Delegated: the leader starts quests with `guild_start_quest`; autonomous: the scheduler starts them as dependencies clear. Both go through the scheduler's checks.
5. **Collect.** Members submit with `guild_submit_work`, `guild_report_blocker`, `guild_submit_finding`; the leader reads them with `guild_read_quest`. Pairing: an observer can be assigned to an implementer's quest with a read lease on the implementer's worktree.
6. **Replan.** New or changed quests go through `guild_propose_plan` again → a `scope_change` approval. The leader cannot silently expand scope.
7. **Integrate.** When implementation quests are accepted, an integration step merges quest branches into the mission integration branch (10 §Integration); conflicts escalate.
8. **Verify and deliver.** Independent verification and approvals per policy; the leader writes a mission report (`guild_submit_work` on the mission's report quest or the mission itself); outcomes and rewards are recorded (11).

### Guild MCP tools (PTY-09, T3-07)

A new toolkit at `apps/server/src/mcp/toolkits/guild/` following T3's pattern (00 §4): schemas in `packages/contracts/src/guildMcp.ts`, `Tool.make` definitions, handlers wrapped in `McpToolAccess` declarations, registration in `McpHttpServer.ts`, evals in `evals/mcp-tool-use/cases/guild.ndjson`, and the context budget file updated.

Tools are available **only to threads that are Guild attempts** (a new `EnabledWhen` predicate, e.g. `hiddenUnlessGuildAttempt`, backed by a lookup from `threadId` to attempt). Every handler first resolves the caller: thread → attempt → adventurer, quest, role, expedition policy. Anything not allowed for that role and policy is refused with a typed error the agent can read.

| Tool                                    | Who may call                                             | Effect                                                                                                    |
| --------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `guild_context`                         | any Guild attempt                                        | Read: who I am, my quest/mission, criteria, teammates, policy, allowed tools                              |
| `guild_list_quests`, `guild_read_quest` | any                                                      | Read quests in my mission, with attempts, findings and notes                                              |
| `guild_propose_plan`                    | leader                                                   | Create draft quests and a `plan` or `scope_change` approval                                               |
| `guild_assign`                          | leader, delegated/autonomous                             | Assign party members to posted quests in the approved plan                                                |
| `guild_start_quest`                     | leader, delegated                                        | Request `start`; the scheduler still checks everything                                                    |
| `guild_report_blocker`                  | any working role                                         | Quest → `blocked` with the blocker text                                                                   |
| `guild_submit_work`                     | implementer, investigator; leader for the mission report | Submit with a report and per-criterion claims; the server captures diff/commit evidence itself (08)       |
| `guild_run_tests`                       | verifier, implementer (Increment 4)                      | Run one of the epic's **user-approved** test commands; records `test_run` evidence (10 §Training Grounds) |
| `guild_propose_journal_entry`           | any (Increment 5)                                        | Propose a journal note; it becomes an entry only when the user approves (12 §Journal)                     |
| `guild_submit_finding`                  | reviewer, observer, verifier                             | Create a Finding (PTY-12)                                                                                 |
| `guild_submit_verdict`                  | verifier                                                 | `review_verdict` pass/fail with findings                                                                  |
| `guild_request_approval`                | any                                                      | Create a GuildApproval (scope change, override, destructive action, binding change)                       |
| `guild_post_note`                       | any                                                      | Persisted handoff note on a quest, visible to its assignees and the leader                                |

Rules:

- Agents can never: accept quests, decide approvals, answer T3 permission prompts, change bindings, runtime modes or loadouts, or act on another mission's or project's data (NON-06).
- Claims in `guild_submit_work` are stored as claims; evidence comes from Git, T3 and the user (08 §Evidence gates).
- All tool actions write `GuildActivity`, so every coordination step is a persisted record next to the raw transcript (PTY-09).
- Tool descriptions must pass evals before shipping (root AGENTS.md _Evals_). Prefer deferred exposure. Make `guild_context` and `guild_submit_work` direct for Guild attempt threads only if `McpToolExposure` can scope direct tools by predicate; otherwise keep all deferred and list the tool names in the briefing. The implementer checks which applies and records it in decisions.md.

### Independent review and verification (PTY-13)

- A verifier or reviewer must be a **different adventurer** from every implementer of the quest, and runs in its **own attempt/thread**. A unit test enforces this in the assignment guard.
- Reviewers get a read lease on the implementer's worktree (10), so they see the actual changes, under approval-required mode unless the user chose otherwise.
- Prefer a different model family for the verifier when one is available (a suggestion in the UI, not a rule).
- Findings and verdicts are inspectable and challengeable: the user can reject a finding (`resolution: rejected` with a note) or overrule a verdict with a `user_decision`, both logged.

### War Room (ROOM-04)

The War Room's map table opens the **expedition overlay**: party roster with roles and live states, the quest graph (dependencies as arrows, states as colours, Increment 5 adds the full campaign map, LATER-02), pending plan/scope approvals, budget usage, mode, and controls: approve/reject plan, start, pause all, cancel expedition, change mode. Everything is also in focus mode (`/guild/missions/:id`).

## Invariants

1. Guild never launches more live attempts than the guild, provider or expedition budgets allow.
2. An adventurer never holds more write leases than its limit.
3. No attempt launches without the scheduler's checks: dependencies, budget, lease, binding.
4. No agent tool can authorise anything; authorisation comes from the user or an approved policy.
5. Verifiers are independent of implementers.
6. Nothing is retried automatically.

## Failure and reverse states

- Leader thread rate-limited or failed: the expedition keeps running already-started attempts; new leader actions wait; the War Room shows the leader's state.
- Expedition paused: running attempts continue unless the user chooses "pause all" (which pauses each quest); resume restarts scheduling.
- Plan rejected: drafts stay as drafts for editing or deletion.
- Cancel expedition: all non-terminal quests `cancelled`, threads stopped, leases released; each quest can be reopened.

## Out of scope

- Cross-mission resource sharing, priority preemption, automatic party building without the user.

## Acceptance checks

1. Scheduler unit tests: budget caps, write-limit, dependency order, idempotent ticks, cancellation releases leases, no automatic retry.
2. Tool access tests: each tool refuses callers with the wrong role, wrong mission, non-Guild threads; agents cannot accept or approve.
3. Evals for the Guild tools pass with controls.
4. Integrated pass (Increment 3): assemble a named party, appoint a Level 0 leader, the leader proposes a plan, the user approves, two independent quests run in parallel under a budget of 2 while a third waits on a dependency, cancel one mid-run; an independent verifier reviews (ACC-PARTY, ACC-REVIEW, ACC-CTRL).

## Open questions

None. Direct vs deferred exposure is resolved by the implementer per the rule above.
