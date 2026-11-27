# Increment 3 — War Room and parties

> Brief §14 Increment 3: "Assemble named parties, select a leader and save reusable formations. Let leaders propose a mission plan and quests; allow human review, editing and approval. Implement dependency scheduling, constrained parallel execution, structured handoffs, blocker escalation, scoped permission and cancellation controls. Add independent review and verification gates; demonstrate a multi-agent mission with actual providers."

**Done when** every card's checks pass and T3.7's integrated pass demonstrates ACC-PARTY, ACC-REVIEW (review part), ACC-CTRL (pause/cancel/approvals).

**First step:** re-read decisions and the Increment 2 report; update these cards for anything Increment 2 learned (especially T3 interrupt/stop behaviour and tool exposure).

Card format and rules: see [increment-1.md](increment-1.md).

```
T3.1 ─▶ T3.2 ─▶ T3.3 ─▶ T3.4 ─▶ T3.5 ─▶ T3.6 ─▶ T3.7
```

---

## T3.1 — Parties, formations and leaders

- **Goal:** Temporary and persistent parties, members with roles, leader appointment (any class, any level), seeded editable formations.
- **Requirements:** PTY-01, PTY-02, PTY-04, CLS-04, CLS-05, HIER-02.
- **Read first:** [09](../09_orchestration-and-parties.md) §Parties and formations; [02](../02_domain-model.md) §Party.
- **Depends on:** Increment 2.
- **Owns:** migration `122_GuildParties.ts` (parties, members, formations, expeditions, findings, approvals, leases), party handlers, formation seeds.
- **Checks:** a Level 0 adventurer can be appointed leader; formation fill suggests but never forces; slots can stay empty.

## T3.2 — Plan proposals, dependencies and plan approval

- **Goal:** Leader-proposed or user-written plans become draft quests with dependencies; the user reviews, edits and approves via a `plan` GuildApproval.
- **Requirements:** PTY-07 (steps 1–3, 6), QST-10, ROOM-04 (plan part).
- **Read first:** [09](../09_orchestration-and-parties.md) §Leader workflow; [08](../08_quest-lifecycle.md) §Dependencies.
- **Depends on:** T3.1.
- **Owns:** GuildApproval handlers (`plan`, `scope_change`, `dependency_override`), plan review UI.
- **Checks:** approving turns drafts into posted quests with assignments; rejecting keeps drafts editable; a scope change after approval needs a new approval.

## T3.3 — Guild MCP toolkit

- **Goal:** The Guild tools from 09 for Guild attempt threads only, validated server-side by role and policy, with evals.
- **Requirements:** PTY-09, PTY-12, T3-07, NON-06.
- **Read first:** [09](../09_orchestration-and-parties.md) §Guild MCP tools; [00](../00_foundation-audit.md) §4; [evals/README.md](../../../../evals/README.md).
- **Depends on:** T3.2.
- **Owns:** `apps/server/src/mcp/toolkits/guild/**`, `packages/contracts/src/guildMcp.ts`, the new `EnabledWhen` predicate, `McpHttpServer.ts` registration, `agentContextBudget.json`, `evals/mcp-tool-use/cases/guild.ndjson`, briefing updates.
- **Steps:**
  1. Tools and `McpToolAccess` declarations; caller resolution thread → attempt → role → policy.
  2. Decide direct vs deferred exposure per 09 and record a decision.
  3. Evals that fail before and pass after, with controls.
- **Checks:** 09 check 2 (role/mission/non-Guild refusals; agents cannot accept or approve); evals pass; context budget test updated.

## T3.4 — Scheduler: dependencies, budgets, leases, cancellation

- **Goal:** `GuildScheduler` that launches queued quests in dependency and priority order under guild, provider, expedition and per-adventurer limits, with workspace leases and cancellation.
- **Requirements:** PTY-03, PTY-05, PTY-08, T3-06, GIT-03 (leases), QST-10 (launch guard), PERF-03.
- **Read first:** [09](../09_orchestration-and-parties.md) §Execution substrate, §Availability and concurrency, §Scheduler; [10](../10_engineering-surfaces.md) §Workspace leases.
- **Depends on:** T3.3.
- **Owns:** `apps/server/src/guild/GuildScheduler.ts`, lease handlers, budget settings UI.
- **Checks:** 09 check 1 (caps, write limit, order, idempotent ticks, cancellation releases leases, no automatic retry).

## T3.5 — Orchestration modes and escalation

- **Goal:** Manual, delegated and autonomous modes per expedition; escalations as GuildApprovals; pause all, cancel expedition, take over.
- **Requirements:** PTY-06, PTY-07 (steps 4–6), ACC-CTRL.
- **Read first:** [09](../09_orchestration-and-parties.md) §Orchestration modes.
- **Depends on:** T3.4.
- **Owns:** expedition handlers and policy editor.
- **Checks:** in each mode, the matrix in 09 holds (who creates, starts, accepts); every escalation type pauses the affected quest and appears in the Council; pause all / cancel expedition stop real threads.

## T3.6 — Independent review and verification

- **Goal:** Reviewer/observer/verifier attempts with read leases on the implementer's worktree, findings and verdicts, the user's ability to challenge them, and the verification gate.
- **Requirements:** PTY-13, PTY-12, QST-09, ACC-REVIEW (review part).
- **Read first:** [09](../09_orchestration-and-parties.md) §Independent review and verification; [08](../08_quest-lifecycle.md) §Evidence gates.
- **Depends on:** T3.5.
- **Owns:** finding/verdict handlers and UI.
- **Steps:**
  1. Verify whether T3 lets a reviewer thread launch into an implementer's running worktree; apply 10 §Workspace leases' fallback if not; record a decision.
  2. Reviewer/verifier attempts, findings, verdicts, challenge flow.
- **Checks:** a verifier can never be an implementer (unit test); a failing verdict moves the quest to `changes_requested` with findings; the user can reject a finding with a note.

## T3.7 — War Room, Council basics, multi-assignment display, integrated pass

- **Goal:** War Room scene and expedition overlay; Council overlay (T3 prompts + Guild approvals + findings); ×N assignment display; the Increment 3 multi-agent demonstration with real providers.
- **Requirements:** ROOM-04, ROOM-09 (basics), NPC-02, ACC-PARTY, ACC-REVIEW, ACC-CTRL.
- **Read first:** [09](../09_orchestration-and-parties.md) §War Room; [10](../10_engineering-surfaces.md) §Council; [07](../07_npc-status-mapping.md) §Step 2.
- **Depends on:** T3.6.
- **Owns:** `world/scenes/war_room.ts`, `world/scenes/council.ts`, `ui/expedition/**`, `ui/council/**`, `_chat.guild.council.tsx`; art for both rooms (developer approval).
- **Steps:** build; then 09 check 4 as the integrated pass using real providers on their cheapest models; update traceability proofs.
- **Checks:** integrated-pass report covering every ACC in this file's header.
