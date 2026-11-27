# 07 — NPC behaviour from real status

> Status: Draft v1 (2026-11-27). Increment 1 (coarse mapping, Guild Hall only), 2 (quest-role mapping), 3 (multiple assignments), 4–5 (rooms, fine-grained activity). Decision D-012 is made here.

## Purpose

The rules that turn real execution state into what an adventurer visibly does in the world: which room, which animation, which marker, which status line. The rules are a pure function so they are testable and cannot drift into decoration that misleads.

## Read first

1. [01_architecture.md](01_architecture.md) §Truth flows one way.
2. [00_foundation-audit.md](00_foundation-audit.md) §2 (status values and where they come from).
3. [03_sprite-system.md](03_sprite-system.md) §Pose extensions (clips and markers).

## Requirements covered

NPC-01…NPC-05, QST-14, ACC-LIVE, PIL-02, VIS-02.

## Non-negotiables (from the brief)

- "The app should infer activity only from actual task role/status and available provider events. If only coarse session status is available, use coarse animations rather than pretending to know what the model is thinking." (NPC-04)
- "Decorative animation can be independent of work, but must not mislead." (brief §10)
- "Distinguish blocked, provider rate-limited, awaiting permission, canceled, failed and disconnected/unknown states." (QST-14)
- "Use a deterministic presentation policy when a character has multiple activities; show a count and provide a way to inspect all assignments rather than cloning the character without explanation." (NPC-02)

## Design

### Inputs and output

`presentAdventurer(input) → NpcPresentation` in `packages/guild-core/src/presentation.ts`, pure:

```ts
type PresentationInput = {
  adventurer: Adventurer;
  attempts: Array<{ attempt: Attempt; shell: ThreadShellSummary | null; quest: QuestSummary | null; detail?: LiveActivity }>;
  connection: "live" | "stale" | "offline";   // from client-runtime connection + shell sync status
  builtScenes: ReadonlySet<SceneId>;
  recentAcceptance: { questId: string; at: number } | null;
  now: number;
};
type NpcPresentation = {
  sceneId: SceneId;
  slotActivity: ActivityKind;            // which slot kind to use (05 §NPCs in scenes)
  clip: ClipId;                          // 03 clips
  marker: MarkerId | null;               // attention | approval | zzz | question | offline | null
  badgeCount: number;                    // active assignments beyond the primary (0 = none)
  statusLine: string;                    // one line of real status text
  primaryAttemptId: GuildAttemptId | null;
  fidelity: "live" | "coarse" | "cosmetic" | "unknown";
};
```

`ThreadShellSummary` is the subset of T3's shell the function needs: `status`, `activityRunStatus`, `blockedOnThreadWait`, `pendingRuntimeRequest`, `lastErrorClass`, `usageLimitResetAt`, `limitRecovery`, `latestRunStopRequested`, `activityRunStartedAt` (00 §2). The web app maps T3's shell into it; the function itself does not import web code.

### Step 1: each attempt's live state

`deriveAttemptLiveState(shell, connection)` returns one of these, checked **in this order** (same priority family as T3's `resolveSidebarThreadStatus`, `apps/web/src/components/Sidebar.logic.ts:964`, extended for Guild):

| # | Condition | Live state |
|---|---|---|
| 1 | `connection !== "live"` or `shell === null` | `unknown` |
| 2 | `pendingRuntimeRequest` with kind not `user_input`/`auth_refresh` | `awaiting_approval` |
| 3 | `pendingRuntimeRequest.kind === "user_input"` | `awaiting_input` |
| 4 | `pendingRuntimeRequest.kind === "auth_refresh"` | `awaiting_auth` |
| 5 | `lastErrorClass === "usage_limit"` or `limitRecovery` present, and not running | `rate_limited` (with `usageLimitResetAt`) |
| 6a | `status === "failed"` and `lastErrorClass === "transport_error"` | `disconnected` (the provider connection dropped; shown like `unknown`, not like a failure) |
| 6b | `status === "failed"` | `failed` |
| 7 | `latestRunStopRequested` and still active | `stopping` |
| 8 | `activityRunStatus ∈ {preparing, starting}` or `status === "queued"` | `preparing` |
| 9 | `activityRunStatus ∈ {running, waiting}` and `blockedOnThreadWait` | `waiting_on_other` |
| 10 | `activityRunStatus ∈ {running, waiting}` | `working` |
| 11 | `status ∈ {interrupted, cancelled}` | `stopped` |
| 12 | otherwise (`idle`, `completed`) | `idle` |

A web unit test asserts this function and `resolveSidebarThreadStatus` agree on the shared cases for a fixture set of shells, so Guild and the sidebar never disagree about a thread.

### Step 2: the adventurer's primary activity (NPC-02)

When an adventurer has several non-terminal attempts, pick the primary with this deterministic order, then most recently updated, then lowest attempt id:

1. Needs the user: `awaiting_approval` > `awaiting_input` > `awaiting_auth` > Guild quest `blocked` > `failed` > `disconnected`.
2. `working` > `waiting_on_other` > `preparing` > `stopping`.
3. `rate_limited`.
4. `idle` / `stopped`.

`badgeCount` = number of other non-terminal attempts. The NPC shows "×N" next to its marker; the dialogue lists every attempt with its own state (NPC-02). The character is never duplicated.

### Step 3: mapping to the world (NPC-03)

What the work *is* comes from the attempt's quest category and assignment role (real data); what state it is in comes from Step 1.

**Work kind** for an attempt in `working` / `waiting_on_other` / `preparing`:

| Source | Work kind |
|---|---|
| Mission planning (leader or Commander on the mission thread), quest drafting | `planning` |
| Quest category Construction, Bounty, Purification, Infrastructure (role implementer) | `implementing` |
| Reconnaissance, Investigation, Research (role investigator) | `exploring` |
| Inspection, Defense, or role reviewer/observer | `reviewing` |
| Trial, or role verifier | `testing` |
| Chronicle | `writing` |
| Conversation attempt (Increment 1, no quest) | `working_generic` |

**Presentation table** (the brief's §10 table, made concrete):

| Live state / work | Scene (fallback if not built) | Slot | Clip | Marker | Status line example |
|---|---|---|---|---|---|
| Available (no active attempt) | Guild Hall | hearth seat or wander | `sit`, `idle`, `walk`, `talk` (cosmetic) | — | "Available" |
| `planning` | War Room (Guild Hall table) | map table | `think` / `talk` | — | "Planning *Seller registration*" |
| `exploring` | Library (Guild Hall table) | desk / shelf | `read` | — | "Exploring *Auth flow* · 6m" |
| `implementing` | Forge (Guild Hall workbench) | workbench | `forge` | — | "Working on *Registration API* · 12m" |
| `reviewing` | Library (Guild Hall table) | desk | `read` (scroll) | — | "Reviewing *Registration API*" |
| `testing` | Training Grounds (Guild Hall yard) | test station | `practice` | — | "Testing *Duplicate registration*" |
| `writing` | Library (Guild Hall table) | desk | `write` | — | "Writing *Changelog*" |
| `working_generic` | Guild Hall | work table | `write` | — | "Working · *Fix the login bug* · 3m" |
| `preparing` | same as work kind | same | `idle` (standing at slot) | — | "Starting…" |
| `waiting_on_other` | same as work kind | same | `wait` | — | "Waiting on *Bram*'s task" |
| `awaiting_approval` | Council (Guild Hall, near the bell) | stand | `wait` | `approval` | "Needs your approval: run `npm install`" |
| `awaiting_input` | stays at work slot | same | `wait` | `question` | "Has a question for you" |
| `awaiting_auth` | stays | same | `wait` | `attention` | "Provider sign-in needed" |
| Quest `blocked` | stays | same | `wait` | `attention` | the recorded blocker text |
| `failed` | stays | same | `idle` | `attention` | "Failed: <error summary>" |
| `rate_limited` | Barracks (Guild Hall bench) | bed / bench | `sleep` | `zzz` | "Resting · usage limit resets 14:20" or "· reset time unknown" |
| `stopping` | stays | same | `idle` | — | "Stopping…" |
| `unknown` | last known scene | last slot | `idle` (no work clip) | `offline` | "Unknown · not connected" |
| `disconnected` | last known scene | last slot | `idle` (no work clip) | `offline` | "Provider disconnected · <error summary>" |
| Quest just accepted | current scene | current slot | `cheer` once (≈1.5 s) | — | "Quest accepted!" |

Rules:

- **Work clips only for real work.** `forge`, `read`, `write`, `practice` and `think` at workstations are used only when Step 1 says `working`/`waiting_on_other` and Step 3 gives the work kind. Ambient behaviour for available adventurers uses only `idle`, `sit`, `walk`, `talk`, `sleep` (at night-style resting spots) and never stands at a workstation (brief §10: decoration must not mislead).
- **Unknown is visible.** With no live data the NPC stops all work animation and shows the offline marker (ACC-LIVE).
- **Fallback scenes** apply while rooms aren't built (Increment 1 has only Guild Hall, Recruitment Hall, Barracks, Corridor). The status line and marker are the same either way.
- **Celebration** plays once per acceptance: the client remembers the last celebrated `GuildActivity.sequence` per adventurer in memory, so reconnects don't replay it.

### Fine-grained activity (decision D-012, Increment 4+)

The shell stream says *that* an agent is working, not *what tool* it is using (00 §2). Item-level detail needs the per-thread `subscribeThread` stream, which is heavy. Guild uses it sparingly:

- Only for attempts whose NPC is **in the currently visible scene** and in `working`, at most **4 threads at once**, unsubscribed when the NPC leaves view or the world is hidden.
- From the latest running turn item: `command_execution` → strike at the anvil (`forge` with sparks), status line shows the command (truncated); `file_change` → `write`, line shows the file name; `reasoning` → `think`; `dynamic_tool` classified `read`/`search` by `classifyToolActivity` (`packages/shared/src/toolActivity.ts:273`) → `read`; others → keep the work-kind clip.
- `fidelity: "live"` when detail drives the clip, `"coarse"` otherwise. The dialogue says "Live activity" or "Coarse status" so the user knows which.

Adding a small "current activity kind" field to T3's shell projection would make this cheaper; that is a possible later optimisation with its own wire-budget test, not a requirement.

### Provider differences

- Cursor never reports approvals or structured questions (00 §2), so Cursor-bound adventurers never show `approval`/`question` markers; their dialogue notes "This provider doesn't report approval requests."
- Providers without token usage leave usage unknown (11).
- Providers whose tool events are generic still map correctly at coarse fidelity.

## Invariants

1. `presentAdventurer` is pure and deterministic for the same input.
2. No work clip is shown without a real working attempt behind it.
3. Every needs-the-user state has a marker visible from anywhere in the scene.
4. Disconnected or unknown state never shows work animation.
5. One adventurer is drawn once, no matter how many assignments.

## Failure and reverse states

- Every marker clears when its cause clears (approval answered, question answered, limit reset, reconnection).
- A stale shell (client reconnecting) shows `unknown` until synchronised, then the real state.

## Out of scope

- Spending model tokens on chatter or narration (PTY-11).
- Animations derived from guessing (e.g. "thinking hard" from elapsed time).

## Acceptance checks

1. Unit tests: each row of the Step 1 table, the Step 2 ordering, and each Step 3 row, using fixture shells.
2. Agreement test with `resolveSidebarThreadStatus` on shared cases.
3. Browser test: an adventurer with a running fixture thread sits at a work table with the work clip; set the shell to a pending approval → approval marker and status line; disconnect → offline marker and no work clip (ACC-LIVE).
4. Multiple attempts → one NPC with "×N" badge; dialogue lists all.

## Open questions

None.
