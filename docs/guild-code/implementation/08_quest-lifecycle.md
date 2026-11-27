# 08 — Quests, missions, attempts: lifecycle and evidence

> Status: Draft v1 (2026-11-27). Increment 2 (quests, attempts, evidence, board), 3 (dependencies scheduled, verification), 4 (merge gates). Decisions D-013, D-014 are made here.

## Purpose

The explicit state machines for missions, quests and attempts; what each transition requires; how evidence gates completion so an agent's claim alone never completes a quest; quest categories; quick quests; and the quest board UI.

## Read first

1. [02_domain-model.md](02_domain-model.md) (entities, how mutations are made).
2. [07_npc-status-mapping.md](07_npc-status-mapping.md) (live state is separate from lifecycle state).
3. [../traceability.md](../traceability.md) §Quest board and lifecycle.

## Requirements covered

QST-01…QST-14, HIER-01…HIER-05, T3-03, PIL-04, ACC-HIER, ACC-QUEST.

## Non-negotiables (from the brief)

- "Do not manage the workflow only through disconnected booleans or visual animations. Model quest, mission, run and party availability separately and derive visual state from them." (QST-06)
- "In progress can become blocked, paused, canceled or failed; resume or retry must be explicit and retain prior attempt history." (QST-08)
- "An agent's claim of completion is not sufficient by itself. Gate completion on the quest's applicable acceptance criteria and recorded evidence, such as reviewed changes, a confirmed report, test results or a user decision." (QST-13)
- "A prerequisite failure prevents dependent quests from starting unless explicitly resolved or overridden under the applicable policy." (QST-10)
- "Merge or release is a separate engineering outcome; a completed research or documentation quest need not have a PR." (QST-11)

## Design

### Two kinds of state

- **Lifecycle state** (this doc): stored, changed only by validated commands. Quest `in_progress`, mission `approved`, attempt `active`.
- **Live state** (07): derived on the fly from T3 thread status. "Working", "awaiting approval", "rate-limited".

A quest can be `in_progress` while its attempt's thread is live-`rate_limited`. The board shows both: lifecycle as the column/badge, live state as the subtitle.

All machines are tables in `packages/guild-core/src/lifecycle/` with one exported `transition(state, event, context) → { ok: nextState, effects } | { error }` per entity. `GuildService` calls them; nothing else changes lifecycle state.

### Quest states (QST-07…QST-09)

```
draft ──post──▶ posted ──assign──▶ assigned ──start──▶ queued ──launch──▶ in_progress ──submit──▶ submitted
  ▲               ▲  ◀──unassign──    │  ◀──unqueue──     │                 │   │   │                 │  │  │
  │               │                   │                   │ (deps/budget)   │   │   └─block──▶ blocked ─┘  │  │
  │               │                   │                   │                 │   └─pause──▶ paused ──resume─┘  │
  │               │                                                         └─fail──▶ failed                 │
  │               │                                                                                          │
  │               │          ┌────────── verificationRequired ──────────┐                                    │
  │               │  submitted ──verify──▶ verifying ──pass──▶ verified ──accept──▶ accepted                 │
  │               │      │ └──────────── accept (gate met, no verification) ─────────▶ accepted              │
  │               │      └──request_changes──▶ changes_requested ◀──fail── verifying / ◀── verified          │
  │               │                                   └──rework──▶ queued                                    │
  │               └──────────────── reopen (from accepted, failed, cancelled) ──────────────────────────────
  any non-terminal ──cancel──▶ cancelled
```

| From | Event | To | Guard (all must hold) | Effects |
|---|---|---|---|---|
| `draft` | `post` | `posted` | title, objective, ≥1 acceptance criterion, category, deliverable | — |
| `posted` | `assign` | `assigned` | ≥1 assignment with a working role (implementer/investigator/verifier for Trial) to an **active** adventurer | — |
| `assigned` | `unassign` | `posted` | no working assignments left | — |
| `assigned` | `start` | `queued` | issued by the user (Increment 2) or the scheduler under an approved plan (09) | — |
| `queued` | `unqueue` | `assigned` | no attempt launched yet | — |
| `queued` | `launch` | `in_progress` | all prerequisites `accepted` (or overridden); budget available (09); workspace lease available (10); binding resolves (06) | create Attempt; outbox launch |
| `queued`/`assigned` | `prerequisite_failed` | `blocked` | a prerequisite is `failed`/`cancelled` | blocker text names it |
| `in_progress` | `block` | `blocked` | a blocker report (user, or agent tool in Increment 3) with text | — |
| `blocked` | `resume` | `in_progress` (active attempt) or `queued` (none) | explicit user action, or the blocker resolved by the user | message to the attempt thread if it exists |
| `in_progress` | `pause` | `paused` | user | interrupt the attempt's current turn via T3 |
| `paused` | `resume` | `in_progress` | user | message "Continue." to the same thread |
| `in_progress` | `submit` | `submitted` | an attempt submits (user "Mark as submitted" in Inc 2; agent `guild_submit_work` in Inc 3) **with** evidence (§Evidence) | capture evidence |
| `in_progress` | `fail` | `failed` | the attempt ended `failed` and the user marks the quest failed, or `attempts == limits.maxAttempts` | — |
| `submitted` | `verify` | `verifying` | `verificationRequired`; a verifier assigned who is **not** the implementer (PTY-13) | launch verifier attempt |
| `verifying` | `verdict_pass` | `verified` | verifier submitted a `review_verdict: pass` with evidence | — |
| `verifying` | `verdict_fail` | `changes_requested` | verdict `fail` | findings recorded (09) |
| `submitted`/`verified` | `request_changes` | `changes_requested` | user or reviewer, with a note | — |
| `changes_requested` | `rework` | `queued` | explicit (user or scheduler under policy) | next launch creates attempt N+1 |
| `submitted` | `accept` | `accepted` | **acceptance gate** met (§Evidence gates) and `!verificationRequired` | rewards (11) |
| `verified` | `accept` | `accepted` | acceptance gate met | rewards (11) |
| `failed` | `retry` | `queued` | explicit user action; attempts < max (or max raised explicitly) | — |
| any non-terminal | `cancel` | `cancelled` | user (or leader under policy, Increment 3) | stop active attempts via T3 |
| `accepted`/`failed`/`cancelled` | `reopen` | `posted` | user, with a reason | history kept; prior rewards stay but are never re-awarded (11) |

Terminal states are `accepted`, `failed`, `cancelled`; each has an explicit way out (`reopen`, `retry`), so no state is a one-way door. Every transition appends `GuildActivity` rows; attempts are never deleted (QST-08).

### Attempt states

| State | Meaning | Entered by |
|---|---|---|
| `starting` | committed, thread not yet launched | quest `launch` or `startConversation` |
| `active` | thread exists; work may be live in any live state (07) | outbox launch succeeded |
| `paused` | user paused | quest `pause` |
| `submitted` | work handed in, awaiting review/acceptance | quest `submit` |
| `completed` | closed successfully (quest accepted, or conversation ended by the user) | quest `accept` / user |
| `superseded` | a later attempt replaced it (rework) | quest `rework` |
| `failed` | launch failed, or the user/limit ended it as failed | outbox failure / quest `fail` |
| `cancelled` | stopped by the user | quest `cancel` / user |

Conversation attempts (Increment 1) use `starting → active → completed | failed | cancelled`: `completed` when the user chooses **End conversation** (the thread stays in T3 untouched; Guild still records any later turns on it); `failed` when the launch fails; `cancelled` when the user cancels or the thread is deleted. An ended conversation is not continued from Guild; "Give orders" starts a new one. T1.9 builds this machine in `packages/guild-core/src/lifecycle/attempt.ts`; T2.4 adds the quest states. The attempt state never mirrors every T3 run status; T3 run status is live state (07). The bridge only moves an attempt on durable facts: launch success/failure, thread deletion (`statusReason: "thread_deleted"`, attempt `cancelled`), or terminal provider failure the user acknowledges.

### Mission states (QST-11)

| State | Meaning |
|---|---|
| `draft` | created, objective being written |
| `planning` | user and/or leader shaping the plan and quests |
| `approved` | plan approved (Increment 3 via GuildApproval `plan`; Increment 2 by the user directly) |
| `in_progress` | at least one quest started |
| `integrating` | `requiresMerge` and all quests accepted; integration branch being merged/PR'd (10) |
| `delivered` | `requiresMerge`: integration gate passed; not `requiresMerge`: all quests accepted (terminal) |
| `paused` | user paused the mission; no new quests start |
| `cancelled` | user cancelled (terminal) |

| From | Event | To | Guard | Effects |
|---|---|---|---|---|
| `draft` | `begin_planning` | `planning` | objective set | — |
| `planning` | `approve_plan` | `approved` | ≥1 quest not in `draft`; Increment 3+: a `plan` GuildApproval approved | drafts become `posted` |
| `approved` | `plan_changed` | `planning` | a `scope_change` is raised | quests already started keep running |
| `approved` | `quest_started` | `in_progress` | a quest of this mission enters `in_progress` | — (system event) |
| `in_progress` | `all_accepted` | `integrating` | `requiresMerge` and every non-cancelled quest `accepted` | — (system event) |
| `in_progress` | `all_accepted` | `delivered` | `!requiresMerge` and every non-cancelled quest `accepted` | rewards (11) |
| `integrating` | `gate_passed` | `delivered` | integration gate (10 §Merge gates) | rewards, milestone (11) |
| `integrating` | `quest_reopened` | `in_progress` | a quest is reopened or added | — |
| `approved`/`in_progress`/`integrating` | `pause` | `paused` | user | scheduler starts nothing for this mission |
| `paused` | `resume` | previous state | user | — |
| any non-terminal | `cancel` | `cancelled` | user | cancels every non-terminal quest |
| `delivered`/`cancelled` | `reopen` | `planning` | user, with a reason | history kept |

The previous state for `resume` is stored in `Mission.statusBeforePause`. `delivered` for a merge mission requires the integration gate; quest acceptance alone is not enough (QST-11).

### Evidence gates (QST-13, decision D-013)

`EvidenceKind`:

| Kind | Payload | Created by | Notes |
|---|---|---|---|
| `diff` | files changed, additions, deletions, revision (worktree HEAD or checkpoint ref), link to T3 diff | GuildEvidence, captured from T3 (`getFullThreadDiff`, checkpoints) at submit | real Git data only |
| `commit` | SHA(s), branch | captured from Git | |
| `pull_request` | PR URL, number, state, checks | from T3 PR integration | |
| `test_run` | command, exit code, duration, counts if parsable, failed cases, revision | Training Grounds runner (10) | Increment 4 |
| `report` | text (the attempt's final report) | captured from the attempt's last assistant message or the agent's `guild_submit_work` | an agent report alone is a *claim* |
| `review_verdict` | pass/fail, reviewer adventurer, findings | verifier/reviewer attempt | must come from a different adventurer and attempt than the implementer (PTY-13) |
| `user_decision` | accepted/confirmed, note | the user | |

Each acceptance criterion lists the evidence kinds that can satisfy it.

**Linking evidence to criteria.** When evidence is captured, the server links it to every criterion of the quest whose allowed kinds include that evidence kind (`criterionId`; one evidence row per linked criterion). In the quest detail the user can unlink or relink evidence per criterion; each change is logged. From Increment 3, an agent's per-criterion claims in `guild_submit_work` are shown next to each criterion but never create links by themselves.

The **acceptance gate** is met when all hold:

1. Every criterion has at least one `valid` (not stale) evidence record of an allowed kind, linked to that criterion.
2. Deliverable-specific minimum:
   - `code`: a `diff` or `commit` at the current revision.
   - `report` / `decision`: a `report` **and** a `user_decision` confirming it ("a confirmed report").
   - `tests`: a passing `test_run` (Increment 4; before that, a `diff` of test files plus `user_decision`).
   - `docs`: a `diff` of documentation files.
3. If `verificationRequired`: a `review_verdict: pass` from an independent verifier.
4. The `accept` event is issued by the user. Exception (Increment 3): an autonomous expedition whose approved policy says `autoAccept: true` may accept when 1–3 hold **and** the evidence includes machine-checked items (`test_run` pass or `review_verdict` pass). An agent's own `report` never satisfies the gate without a user decision.

If code changes after evidence was recorded (new commit on the attempt's branch), affected `diff`, `test_run` and `review_verdict` records become `stale` (10 §Evidence staleness) and the gate re-evaluates.

### Dependencies (QST-10)

- Stored as `QuestDependency` (02); cycles rejected by `guild-core` graph check.
- A quest cannot `launch` until every prerequisite is `accepted`.
- If a prerequisite becomes `failed` or `cancelled`, dependents in `queued`/`assigned` move to `blocked` with the reason. Unblocking requires either reopening/retrying the prerequisite until it's accepted, removing the dependency (edit, logged), or a `dependency_override` GuildApproval decided by the user.
- The board shows each quest's prerequisites and dependents with their states.

### Quest categories (QST-03, QST-04)

The fantasy label is always shown with the engineering meaning: "Bounty · Bug fix".

| Category id | Display | Engineering meaning | Preferred class | Default deliverable | Default verification |
|---|---|---|---|---|---|
| `construction` | Construction | Build a feature or component | Warrior | code | on for medium/large |
| `bounty` | Bounty | Reproduce and fix a bug | Ranger | code | on |
| `reconnaissance` | Reconnaissance | Explore a codebase | Scout | report | off |
| `investigation` | Investigation | Diagnose a failure or trace a workflow | Scout/Ranger | report | off |
| `inspection` | Inspection | Review code or architecture | Mage | report | off |
| `trial` | Trial | Write/run tests or verify behaviour | Cleric | tests | off |
| `purification` | Purification | Refactor technical debt | Warrior/Mage | code | on |
| `defense` | Defense | Audit security or data access | Paladin | report | off |
| `infrastructure` | Infrastructure | CI/CD, migrations, deployment preparation | Artificer | code | on |
| `chronicle` | Chronicle | Write or update documentation | Scribe | docs | off |
| `research` | Research | Evaluate a technology or approach | Scout/Mage | report | off |

"Preferred class" is a hint shown when assigning (and used by the leader's proposals); any class can take any quest.

Field defaults at creation: `deliverable` and `verificationRequired` come from the category row above; inside an expedition, the formation policy's `verificationRequired` overrides the category default; the user can change either. `limits.maxAttempts` defaults to 3 and `limits.maxTurnsPerAttempt` to null (no limit). When a turn limit is set and reached, the bridge moves the quest to `blocked` with "Turn limit reached"; resuming is explicit.

### Quick quests (HIER-03, decision D-014)

"Quick quest" (board, dialogue, command palette) asks for: epic (project), title, objective, assignee, and **kind of result**: "Change the code" or "Answer / report". Category and criteria are optional and editable; defaults fill every field the `post` guard needs:

| Kind of result | Category default | Deliverable | Default criterion | Evidence allowed |
|---|---|---|---|---|
| Change the code | `construction` | `code` | "The requested change is made" | `diff`, `commit` |
| Answer / report | `research` | `report` | "The question is answered" | `report` (+ the `user_decision` the gate requires) |

It creates in one command a **quick mission** (title = quest title, state `approved`, `requiresMerge: false`, `primaryThreadId: null` until the first attempt, whose thread then becomes the primary thread), the quest (`posted` → `assigned`, verification off), and optionally starts it. No party, plan or kingdom required.

### Quest board UI (QST-01, QST-02)

The quest board is an overlay opened by E on the board prop in the Guild Hall (and in project portals later), and also a focus-mode page (`/guild/board`) and a command palette entry (13 §Direct access).

- **Layout:** left list, right detail. Parchment-styled frame, but body text is normal readable HTML using T3's UI primitives (`apps/web/src/components/ui`), real terminology always visible.
- **List:** grouped by lifecycle state (Draft, Posted, Assigned/Queued, In progress, Blocked, Review, Done), filter by mission, epic, category, assignee, priority; sort by priority then updated. Each row: category label, title, assignee portrait (cropped sheet cell), lifecycle badge, live subtitle (07), attempt count.
- **Detail:** objective, scope, expected outputs, deliverable, criteria with their evidence and status, dependencies (prerequisites and dependents), assignments by role, attempts (each linking to its thread, with executed models and usage), findings, activity history.
- **Actions** (only valid transitions are enabled; others are hidden or disabled with the reason): Post, Edit, Assign/Unassign, Start, Pause, Resume, Mark as submitted, Request changes, Accept, Retry, Cancel, Reopen, Open conversation, Open diff.
- **Keyboard:** ↑/↓ move, Enter open, Esc back/close, N new quest, / focus filter, A assign, S start. All suppressed while typing in a field. World input is disabled while the board is open (05 §Input focus).

## Invariants

1. Lifecycle state changes only through `transition()`; invalid transitions are rejected with a typed error and nothing is written.
2. No quest reaches `accepted` without the acceptance gate.
3. No quest launches with an unaccepted, non-overridden prerequisite.
4. Every attempt of a quest is kept; a new attempt never overwrites an old one.
5. A verifier is never the implementer of the same quest.

## Failure and reverse states

All covered in the tables: every terminal state has `reopen` or `retry`; `blocked` and `paused` have `resume`; `queued` has `unqueue`; `assigned` has `unassign`.

## Out of scope

- Time tracking, estimates in hours, sprints.
- Automatic retries of failed attempts (retry is always explicit, QST-08).

## Acceptance checks

1. Exhaustive transition tests: every (state, event) pair either matches the table or returns an error; property test that random valid event sequences never reach `accepted` without gate evidence.
2. Gate tests per deliverable kind, including "agent report only → not accepted" (ACC-QUEST).
3. Dependency tests: launch refused with unaccepted prerequisite; prerequisite failure blocks dependents; override unblocks.
4. Integrated pass (Increment 2): link a repo as an epic, create a mission and two quests, assign, start, block/resume, submit, request changes, rework (attempt 2), accept; trace each attempt to its thread (ACC-HIER, ACC-QUEST).
5. Browser test of the board's keyboard navigation and disabled-action reasons.

## Open questions

None.
