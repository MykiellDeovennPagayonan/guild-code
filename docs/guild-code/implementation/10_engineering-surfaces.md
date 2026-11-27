# 10 — Engineering surfaces: Forge, workspaces, Training Grounds, Council

> Status: Draft v1 (2026-11-27). Increment 1 (focus-mode access only), Increment 3 (leases, review access, Council basics), Increment 4 (Forge, integration, test evidence, merge gates). Decisions D-017, D-018, D-019 are made here.

## Purpose

How Guild exposes real engineering work: where code, diffs, terminals and PRs open; how writable workspaces are owned and protected; how parallel work is integrated; how real test runs become evidence; and how approvals and merge gates work.

## Read first

1. [00_foundation-audit.md](00_foundation-audit.md) §6 (worktrees, Git, diffs, terminal, files, approvals; no test runs).
2. [08_quest-lifecycle.md](08_quest-lifecycle.md) §Evidence gates.
3. [09_orchestration-and-parties.md](09_orchestration-and-parties.md) §Scheduler.

## Requirements covered

GIT-01…GIT-08, TST-01, TST-02, ROOM-05, ROOM-07, ROOM-09, QST-11, ACC-WS, ACC-REVIEW, ACC-ENG, ACC-CTRL.

## Non-negotiables (from the brief)

- "The Forge is not a simulation of coding. It exposes actual source files, editing, Git, terminals, provider activity and changes." (GIT-01)
- "Do not have multiple independent agents blindly edit the same working tree. Detect dirty state, overlapping paths, stale bases and conflicts. … Never automatically overwrite existing user changes or delete a dirty worktree." (GIT-04)
- "User edits can occur independently of the AI; do not attribute them to an agent." (GIT-07)
- "Opening or inspecting a diff must never implicitly run a destructive command." (GIT-08)
- "Distinguish not run, running, passed, failed, canceled and stale results. If code changes after verification, invalidate affected evidence or clearly show its revision." (TST-02)

## Design

### Reuse, don't rebuild (decision D-017)

T3 already has a file tree, an editable file viewer, content search, diffs (split/unified, per turn, per branch), terminals bound to a thread's worktree, Git actions (commit, push, PR), PR views and actions, and approval prompts (00 §6). Guild's engineering surfaces are **those components**, opened with the right thread and scope, with Guild context added in a header. Guild builds new UI only for what T3 lacks: leases, integration status, test evidence and Guild approvals.

Opening real work from Guild:

- **Focus mode** (always available, Increment 1+): navigate to the attempt's thread route (`buildThreadRouteParams`, `apps/web/src/threadRoutes.ts:63`) and open a right panel with `useRightPanelStore.getState().open(ref, kind)` (`diff`, `files`, `terminal`, `pull-request`).
- **Hybrid mode** (Increment 1 basic, 13): embed `<ChatView embedded>` for the attempt's thread beside the world, following `apps/web/src/components/workflows/WorkflowThreadPane.tsx`, with its right panels.
- **Guild context header** on these views when the thread is a Guild attempt: adventurer (portrait, name, class), quest and mission, workspace path, branch, base revision, lease holder (GIT-07).

### Brief §9.2 surfaces: what covers each (decision D-025)

| Brief asks for                                                                   | Covered by                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File tree, open/edit files, search, shortcuts, syntax highlighting, large panels | T3's file browser and editable viewer (`@pierre/trees`, `@pierre/diffs/edit`), content search                                                                                                                          |
| Added/modified/deleted files, unified or side-by-side diffs                      | T3's `DiffPanel` (split/unified, file tree)                                                                                                                                                                            |
| **Staged and unstaged changes**                                                  | T3 has one working-tree list and an `unstaged` diff selection, no separate staging area (00 §6). Guild adds none; commits go through T3's Git actions, which stage the chosen files. Listed in decisions §Unsupported. |
| Current branch, base revision, commits, worktrees                                | T3 branch toolbar and VCS status, plus Guild's context header and workspace board                                                                                                                                      |
| Conflicts                                                                        | Predicted conflicts (§Integration) and conflict resolution inside the integration quest's thread and terminal                                                                                                          |
| Terminal for the selected workspace                                              | T3 terminal bound to the attempt thread's worktree                                                                                                                                                                     |
| Diagnostics, build output, command history                                       | Command output in the attempt's turn items (`command_execution`) and the terminal history; test output in the Training Grounds. No separate diagnostics panel                                                          |
| Real pull requests                                                               | T3 PR tools and views                                                                                                                                                                                                  |
| Review, staging, committing, branch/worktree management, merging, reverting      | T3 Git actions, PR actions (merge, revert), `checkpoint.rollback`; Guild adds leases, take-over and merge gates. There is no local `git revert` command in T3; reverting uses the PR action or checkpoint rollback     |

### The Forge (ROOM-05, GIT-06; Increment 4)

- One **workbench per active write attempt** (up to the scene's slot count; overflow on a rack board). The adventurer working there is the NPC at that bench (07).
- E on a workbench (or click) opens the **workbench menu**: Conversation, Diff, Files, Terminal, Commits & PR, Workspace info. Each opens the T3 component in hybrid mode for that attempt's thread.
- A **workspace board** prop lists all Guild worktrees with: branch, base, ahead/behind, dirty state (from `subscribeVcsStatus`), lease holder, quest. Actions: open, take over (§Leases), release, clean up (only when clean and unleased, using T3's `vcs.removeWorktree` with its existing confirmation).
- Fantasy labels appear next to real terms: "Expedition camp · worktree `quest/registration-api`", "Milestone · commit `a1b2c3d`", "Petition to the crown · PR #42" (GIT-02).

### Workspace leases (GIT-03, GIT-04; Increment 3)

A `WorkspaceLease` (02) records who may write a worktree.

- **Quest workspace defaults** (from class and quest, 06 §Classes):
  - `own_worktree`: a new worktree per quest via `ThreadLaunchService` `workspaceStrategy: worktree { baseRef, branch }` (00 §3). Branch `quest/<mission-slug>/<quest-slug>`; base is the mission integration branch if it exists, else the epic's default branch. Rework attempts reuse the same worktree and branch (`existing_worktree`) so history continues.
  - `mission_branch`: work directly in the mission integration worktree (small missions with one implementer).
  - `read_only_snapshot`: reviewers and investigators get a **read lease** on the implementer's worktree (`existing_worktree`) or, if there is none, on the epic root. They run under `approval-required` mode unless the user chose otherwise, so every write or command needs approval (06 §Classes).
    - **Verify first (T3.6, step 1):** whether T3 lets a second thread launch into a worktree another thread is running in, given `sharedCheckoutGuard` and `getWorktreeThreadIds`. If it refuses, the fallback is a separate worktree created at the implementer's current HEAD commit (`worktree { baseRef: <sha> }`) with a throwaway branch `review/<quest-slug>-<n>`; the reviewer then sees the committed changes only, and the UI says so. Record the outcome as a decision.
  - `root`: the project root, only when the user chooses it explicitly.
- **Rules:**
  - One active **write** lease per worktree path (02 invariant 7). The scheduler acquires it before launch and releases it when the attempt ends.
  - Never launch a write attempt into the project root if another thread (Guild or not) is running there; T3's `sharedCheckoutGuard` already refuses checkout changes in that case (`apps/server/src/git/sharedCheckoutGuard.ts`), and Guild checks `orchestration.getWorktreeThreadIds` before granting a lease.
  - **Dirty state** is read from `subscribeVcsStatus` (`hasWorkingTreeChanges`). Guild never deletes, resets, stashes or overwrites a dirty worktree. Cleanup is offered only when clean, and goes through T3's existing confirmation.
  - **Take over** (ACC-CTRL): the user pauses the quest (interrupting the attempt) and the lease moves to `user`. The user edits in focus mode. "Hand back" resumes the quest with a message summarising that the user changed files.

### Attribution (GIT-07, decision D-018)

- An attempt's changes are the diff of its worktree branch against its base revision, plus T3's per-turn checkpoints (`OrchestrationV2Checkpoint` has `threadId` and `runId`, 00 §6).
- User edits are not separable from agent edits inside one worktree, so Guild records **user edits** when the user saves a file (`projects.writeFile`) or commits in a worktree that a Guild attempt holds, or during a take-over. The attempt's diff is then labelled **"mixed: includes your edits"**, and stats count those lines as `mixed`, not as the agent's (11).
- Never guess attribution. When unsure, label it `unattributed`.

### Integration (Increment 4)

For missions with several implementing quests:

- On mission approval with ≥2 code quests, Guild creates the **integration branch** `mission/<mission-slug>` from the epic's default branch (a worktree through `ThreadLaunchService` for the leader's or integrator's thread).
- **Pre-checks**, read-only git commands run by a small `GuildGit` service on top of T3's VCS driver process runner: changed paths per quest branch (overlap detection); merge-base vs current base tip (**stale base**); `git merge-tree --write-tree` between each quest branch and the integration branch (**predicted conflicts**). Results show on the War Room table and the workspace board.
- **Merging** quest branches into the integration branch is done by an **integration quest** (category `infrastructure`, role implementer, normally the leader or a Commander/Artificer) working in the integration worktree under normal T3 approvals. Guild doesn't add its own merge engine; conflicts surface in that thread and are resolved under explicit ownership (PTY-07 step 7).
- After integration, a verifier tests the **integrated** revision (Training Grounds).

### Training Grounds: real test evidence (TST-01, TST-02, ROOM-07, decision D-019)

T3 has no test runs or results (00 §6), so Guild adds a small runner.

- **Test commands** are defined per epic by the user: a list of `{ id, label, command, cwdRelative, parser: "vitest" | "jest" | "pytest" | "go" | "junit-xml" | "exit-code-only", junitPath? }`. Defaults are suggested from the project's `ProjectScript`s with `icon: "test"`, but only the user can approve a command into the list.
- **Running**: `GuildTestRunner` (`apps/server/src/guild/GuildTestRunner.ts`) runs an approved command in a chosen workspace (worktree path + revision) using T3's process runner (`apps/server/src/processRunner.ts`), with a timeout, and records a `test_run` Evidence: command, exit code, duration, last 64 KB of output, parsed counts and failed test names if the parser recognises the output, workspace, branch, **revision (HEAD SHA at start)**, and whether the worktree was dirty at start (then marked "includes uncommitted changes").
- **Who triggers**: the user (Training Grounds station, quest detail, command palette), the scheduler as a verification step in an approved policy, or a Cleric via a Guild tool `guild_run_tests({ testCommandId })`. Agents can only run commands from the approved list, never arbitrary ones, so no tool bypasses T3's approvals (T3-07).
- **States** (TST-02): `not_run`, `running`, `passed`, `failed`, `cancelled`, `stale`.
- **Scope honesty**: a result is about one command at one revision. The UI never says "project passes"; it says "`vp test run apps/web` passed at `a1b2c3d`" (TST-02).
- **Training Grounds room**: one test station per approved command showing its latest result per active workspace; E opens the run history and output; the dummy and targets are for play (05 §Play).

### Evidence staleness (TST-02)

`GuildEvidence` (`apps/server/src/guild/GuildEvidence.ts`) watches the VCS status of worktrees with Guild evidence. When a worktree's HEAD moves past an evidence record's revision, or it gains uncommitted changes after the record:

- `diff`, `test_run` and `review_verdict` records for that quest and worktree become `stale`;
- the acceptance gate re-evaluates (08);
- the UI shows "stale: recorded at `a1b2c3d`, now at `e4f5g6h`".

Reports and user decisions don't go stale automatically; the user can mark them stale.

### Council: approvals and gates (ROOM-09; Increment 3–4)

The Council overlay (also `/guild/council` in focus mode, and reachable in one click from the HUD's approval badge from anywhere, NAV-10) lists:

1. **T3 permission prompts** on Guild threads (`pendingRuntimeRequest` from the shell, 00 §2), showing the adventurer and quest. Answering uses T3's own approval command (`respondToApproval`, `packages/client-runtime/src/operations/commands.ts:1012-1030`) as a user action. Guild never answers these itself.
2. **Guild approvals** (`GuildApproval`, 02): plan, scope change, dependency override, merge gate, destructive action, binding change, budget alert. Approve/reject with an optional note.
3. **Findings** awaiting the user's decision (accept/reject).

### Merge gates (QST-11, GIT-08; Increment 4)

For a mission with `requiresMerge`, `delivered` requires the **integration gate**:

1. A PR from the integration branch (or the single quest branch) to the target branch exists (created with T3's PR tools).
2. Its required checks pass (`PullRequestCheck.required`, `packages/contracts/src/pullRequest.ts:114-126`), if the forge reports any.
3. Verification evidence exists **at the PR head revision** and is not stale.
4. The user approves a `merge_gate` GuildApproval.
5. The merge itself is performed by the user through T3's PR action (`pullRequests.runAction`), or by an agent's `pull_request_merge` with `expectedHeadSha` if the user's policy allows it. Guild records the merged state as evidence.

Animations never stand in for these facts: the Trophy Hall banner appears only after the merged PR is recorded (GIT-08).

## Invariants

1. Every engineering view shows real data from T3; nothing is simulated.
2. One write lease per worktree; no write attempt in a tree another agent is writing.
3. Guild never deletes, resets or overwrites a dirty worktree, and never runs a destructive Git command implicitly.
4. Test evidence always carries its command and revision; stale evidence never satisfies a gate.
5. Agents can only run user-approved test commands through Guild.
6. User edits are never attributed to an agent.

## Failure and reverse states

- Lease holder attempt crashes: lease released when the attempt reaches a terminal state; a worktree left dirty stays as is and shows "dirty, unleased".
- Test command times out: `cancelled` with "timed out after Ns"; rerun is explicit.
- Predicted conflict: integration waits for an explicit decision (resolve in the integration quest, or reorder).
- Take over ↔ hand back.

## Out of scope

- A new code editor, diff engine, terminal or Git client.
- Running arbitrary agent-supplied commands outside provider approvals.

## Acceptance checks

1. Two write quests launch into two separate worktrees; a third write attempt for the same worktree is refused (ACC-WS).
2. With the user's uncommitted changes in the root, no Guild action removes or overwrites them; cleanup is not offered for a dirty worktree (ACC-WS).
3. Overlap and predicted-conflict checks flag two quest branches editing the same lines (ACC-WS).
4. A test run records command, exit code, duration, counts (vitest fixture) and revision; a new commit marks it stale and the gate refuses acceptance until rerun (ACC-REVIEW).
5. A permission prompt on a Guild thread appears in the Council and is answered through T3; the HUD badge opens it from any room in one click (ACC-CTRL).
6. From the dialogue, open the adventurer's diff, files and terminal without walking (ACC-ENG).

## Open questions

None.
