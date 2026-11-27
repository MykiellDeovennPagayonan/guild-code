# Increment 2 — Royal requests and quest board

> Brief §14 Increment 2: "Register actual epics/projects and create missions/threads with the established hierarchy. Post small quests manually, assign adventurers, record attempts and show real progress, blockers and acceptance criteria. Connect quests to real repository context, code changes or investigation evidence. Persist state and support interruption/recovery. Show initial actual character/epic/guild statistics and award XP only for accepted work. Support no-code research quests."

**Done when** every card's checks pass and T2.9's integrated pass demonstrates ACC-HIER, ACC-QUEST, ACC-PROG, ACC-METRIC (initial), ACC-LIVE (quest roles).

**First step of this increment:** re-read [decisions.md](../../decisions.md) and Increment 1's report; if Increment 1 changed anything these cards assume (contract names, bridge behaviour, evidence of T3 limits), update the cards before starting.

Card format and rules: see [increment-1.md](increment-1.md).

```
T2.1 ─▶ T2.2 ─▶ T2.3 ─┬─▶ T2.4 ─▶ T2.5 ─┬─▶ T2.6 ─▶ T2.7
                      │                 └─▶ T2.8
                      └──────────────────────▶ T2.9
```

---

## T2.1 — Epics, kingdoms and the Portal Room

- **Goal:** Link T3 projects as epics, optional kingdoms, pick the current epic; Portal Room scene.
- **Requirements:** HIER-01, HIER-04, ROOM-10, ACC-HIER (part).
- **Read first:** [02](../02_domain-model.md) §Kingdom, §Epic; [05](../05_world-and-rooms.md) §Room catalogue; [04](../04_art-pipeline.md) §Room art.
- **Depends on:** Increment 1.
- **Owns:** migration `121_GuildQuests.ts` (all Increment 2 tables: kingdoms, epics, missions, quests, dependencies, assignments, evidence, quest notes, user edits, rewards), epic/kingdom handlers, `apps/web/src/guild/world/scenes/portal_room.ts`, epic UI.
- **Steps:**
  1. Contracts and handlers: `linkEpic(projectId)`, `updateEpic`, `archiveEpic`, `restoreEpic`, kingdom CRUD; one epic per project.
  2. Read repository identity, default branch and worktree state from T3 at read time (no copies).
  3. Portal Room: one portal per epic with its banner; E opens the epic overlay (details, missions, "Set as current epic"); a free portal opens "Link a project" listing T3 projects. Unlock the corridor door.
  4. "Project missing" state when the T3 project is deleted (02 §Failure).
- **Checks:**
  1. Linking the same project twice is rejected; archive ↔ restore.
  2. Browser test: link a project in the Portal Room; it shows as the current epic in the HUD.

## T2.2 — Missions

- **Goal:** Missions with objective, constraints, plan and criteria, each with a primary thread, and the mission state machine.
- **Requirements:** HIER-05, T3-03, QST-11 (states), QST-06, ACC-HIER.
- **Read first:** [02](../02_domain-model.md) §Mission; [08](../08_quest-lifecycle.md) §Mission states.
- **Depends on:** T2.1.
- **Owns:** `packages/guild-core/src/lifecycle/mission.ts`, mission handlers, mission page `_chat.guild.missions.$id.tsx`.
- **Steps:**
  1. Mission transition table and tests.
  2. `createMission` launches the primary thread via the outbox, following 02 §Mission "Primary thread rule": with a lead adventurer, the lead's conversation attempt; without one, a user thread with the epic project's `defaultModelSelection` passed explicitly (never T3's fallback resolver).
  3. Mission page (focus mode) and an overlay used later by the War Room.
- **Checks:**
  1. Exhaustive mission transition tests.
  2. Mission → primary thread link visible both ways (mission page and the thread's Guild header).

## T2.3 — Quests and the quest state machine

- **Goal:** Quests with every field from 02, categories, dependencies stored and validated, assignments, and the full quest transition table.
- **Requirements:** QST-03…QST-09, QST-12, HIER-02, PTY-01 (direct assignment).
- **Read first:** [08](../08_quest-lifecycle.md) §Quest states, §Quest categories, §Dependencies; [02](../02_domain-model.md) §Quest.
- **Depends on:** T2.2.
- **Owns:** `packages/guild-core/src/lifecycle/quest.ts`, `categories.ts`, `graph.ts`; quest handlers.
- **Steps:**
  1. Transition table exactly as 08, with typed errors.
  2. Category table with display + engineering meaning.
  3. Dependency add/remove with cycle check; prerequisite-failed propagation.
  4. Assignment roles and guards (active adventurers only; verifier ≠ implementer).
- **Checks:**
  1. Exhaustive (state, event) tests and the random-sequence property test (08 check 1).
  2. Dependency tests (08 check 3, launch part deferred to T2.4).

## T2.4 — Quest attempts

- **Goal:** Start a quest → an attempt thread for the assigned adventurer with a quest briefing; pause/resume/cancel/retry/rework through T3; attempts kept forever.
- **Requirements:** T3-03, T3-04, QST-08, QST-14, PRO-07, PRO-09, ACC-QUEST (execution).
- **Read first:** [08](../08_quest-lifecycle.md) §Attempt states; [06](../06_recruitment-and-identity.md) §Starting real work; [10](../10_engineering-surfaces.md) §Workspace leases (workspace defaults only; leases come in Increment 3).
- **Depends on:** T2.3.
- **Owns:** `packages/guild-core/src/lifecycle/attempt.ts`, quest launch path in `GuildService`.
- **Steps:**
  1. In Increment 2, `start` immediately launches when prerequisites are accepted and the binding resolves (the full scheduler arrives in T3.4); otherwise the quest waits in `queued` with the reason.
  2. Quest briefing: objective, scope, expected outputs, criteria, deliverable, workspace, "how to report" (Increment 2: "Reply with a final report when done"; Increment 3 adds Guild tools).
  3. Workspace per class/quest defaults using `ThreadLaunchService` strategies; rework reuses the worktree.
  4. Pause (interrupt), resume ("Continue."), cancel (stop), retry/rework (attempt N+1), all via T3 commands.
- **Checks:**
  1. Each control acts on the real thread (integration test with the Replay provider).
  2. Attempt history intact after retry and rework.

## T2.5 — Evidence and acceptance gates; quick quests

- **Goal:** Capture real evidence (diff, commit, report, user decision), enforce the acceptance gate, support report-only quests, and quick quests.
- **Requirements:** QST-13, QST-05 (records), HIER-03, VIS-01 (no fake), ACC-QUEST.
- **Read first:** [08](../08_quest-lifecycle.md) §Evidence gates, §Quick quests; [10](../10_engineering-surfaces.md) §Attribution.
- **Depends on:** T2.4.
- **Owns:** `apps/server/src/guild/GuildEvidence.ts` (capture part), `packages/guild-core/src/gate.ts`, quick-quest handler.
- **Steps:**
  1. "Mark as submitted" (user) captures: the attempt's diff vs base (T3 diff RPCs/checkpoints), commits on the branch, the last assistant message as `report`.
  2. Gate evaluation per 08; "Accept" enabled only when the gate holds, otherwise shows which criterion is missing what.
  3. Report quests: `report` + `user_decision` ("Confirm report").
  4. Quick quest command (08 §Quick quests).
  5. Mixed-edit labelling (10 §Attribution) for user saves in the attempt's worktree.
- **Checks:**
  1. Gate tests per deliverable (08 check 2), including "agent report only → not accepted".
  2. A research quest completes with a confirmed report and no PR (QST-11, brief "Support no-code research quests").

## T2.6 — Quest board

- **Goal:** The quest board overlay and focus page with list, detail, filters, valid actions and keyboard navigation.
- **Requirements:** QST-01, QST-02, QST-04, ROOM-01.
- **Read first:** [08](../08_quest-lifecycle.md) §Quest board UI.
- **Depends on:** T2.5.
- **Owns:** `apps/web/src/guild/ui/board/**`, `_chat.guild.board.tsx`, the quest board prop interaction in the Guild Hall.
- **Steps:** build as specified; actions call guild commands; disabled actions show the guard's reason; user comments on quests (`QuestNote` with `author: "user"`, brief §8.4 "quest comments") with edit and delete; evidence relinking per criterion (08 §Evidence gates).
- **Checks:** browser test of keyboard navigation and disabled reasons (08 check 5).

## T2.7 — Inbox and HUD counts

- **Goal:** Guild Hall bell/inbox; HUD "Needs you" includes blocked and failed quests and submissions awaiting review.
- **Requirements:** ROOM-01, MODE-05.
- **Read first:** [13](../13_presentation-modes.md) §Inbox and notices, §HUD.
- **Depends on:** T2.6.
- **Owns:** `apps/web/src/guild/ui/inbox/**`.
- **Checks:** browser test: a blocked quest appears in the inbox and HUD count; resolving it clears both.

## T2.8 — XP and initial statistics

- **Goal:** RewardEvents on acceptance and validated items, levels, and initial adventurer, epic and guild stats with honest unknowns.
- **Requirements:** XP-01, XP-02, XP-03, XP-05, PIL-07, PRO-06, STAT-01 (initial), STAT-05, ACC-PROG, ACC-METRIC (initial).
- **Read first:** [11](../11_progression-and-stats.md).
- **Depends on:** T2.5.
- **Owns:** `packages/guild-core/src/xp.ts`, `metrics.ts`; `apps/server/src/guild/GuildStats.ts`; stats sections in profile, epic and guild pages.
- **Steps:** reward rules v1 in the accept transaction; level curve; stats for accepted/attempted quests, attempts, lines (once per accepted quest), tokens with completeness, executed models; metric definitions in tooltips.
- **Checks:** 11 checks 1–4.

## T2.9 — Quest-role NPC behaviour and the Increment 2 integrated pass

- **Goal:** NPCs reflect quest work kinds (fallback scenes until rooms exist); `read` and `forge` poses; integrated pass.
- **Requirements:** NPC-03, ANI-02 (read, forge), ACC-HIER, ACC-QUEST, ACC-LIVE.
- **Read first:** [07](../07_npc-status-mapping.md) §Step 3.
- **Depends on:** all other T2 cards.
- **Owns:** presentation work-kind mapping; new poses and their contact sheets.
- **Steps:**
  1. Work kinds from category/role; `read` and `forge` poses approved by the developer.
  2. Integrated pass: 08 check 4 end to end, plus a research quest, plus a server restart in the middle of an in-progress quest (state and attempt links survive).
  3. Update traceability proofs.
- **Checks:** integrated-pass report with evidence for every ACC in this file's header.
