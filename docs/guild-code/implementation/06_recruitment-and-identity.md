# 06 — Recruitment, identity and model bindings

> Status: Draft v1 (2026-11-27). Increment 1 (all of it), Increment 5 (cosmetic customization). Decisions D-007, D-008, D-009, D-011 are made here.

## Purpose

How the Guild Master is created, how adventurers are generated and hired, what makes an adventurer's identity persistent, how each adventurer is bound to a provider and model family without ever silently switching families, and how a hired adventurer starts real work.

## Read first

1. [02_domain-model.md](02_domain-model.md) §Adventurer, §Attempt, §AdventurerChange.
2. [03_sprite-system.md](03_sprite-system.md) §Appearance, §Randomisation.
3. [00_foundation-audit.md](00_foundation-audit.md) §3 and §5 (launching threads, models, the fallback trap).

## Requirements covered

VIS-03, PIL-01, PIL-05, NAV-01, NAV-03, ART-05, REC-01…REC-08, PRO-01…PRO-05, PRO-09, CLS-01…CLS-03, MOD-01…MOD-05, PTY-11 (message routing), ROOM-02, ROOM-03.

## Non-negotiables (from the brief)

- "Every new hire begins at **Level 0, XP 0** with no quest history, no code contributions, no tokens consumed, no accomplishments and no performance score." (REC-07)
- "Do not generate fake intelligence, strength, coding aptitude or pre-earned experience." (REC-08)
- "The user's explicit requirement is random recruitment, so manual character construction must not be necessary for hiring. The Guild Master remains manually customizable." (REC-06)
- "Do not silently substitute a different family when the requested family is unavailable. Show the reason and allow an explicit user-approved configuration change." (MOD-03)
- "Record the exact model used for every run." (MOD-04)
- "The user chooses a class during hiring rather than having it randomly assigned." (CLS-02)

## Design

### The Guild Master (NAV-01, ART-05)

- On first open of the Guild view, if no `GuildMaster` row exists, the **creator** opens full-screen before the world.
- The creator is a port of the reference creator UI (`index-24.html` lines 1385–1648) into a React overlay (`apps/web/src/guild/ui/creator/`): category rows with lock, prev/next and option grid with live thumbnails, Shuffle (S), animation preview with clip buttons, transport, frame ticks and speed, flip and anchor toggles, share code (copy/load), JSON (apply/copy), PNG sheet download, and the three test presets. Keyboard shortcuts as in the reference (Space play/pause, `,` `.` step, S shuffle, Enter confirm), suppressed while typing.
- Plus a **name** field (required, 1–24 characters).
- "Enter the Guild" saves via `guild.createMaster({ name, appearance })`.
- The creator reopens later from the Barracks ("Edit Guild Master") and the command palette; editing never affects adventurers.
- The Guild Master never has a model binding and never starts provider work (NAV-03).

### Candidates (REC-01…REC-03, decision D-008)

- The Recruitment Hall shows **4 candidates** standing in the hall (within the brief's suggested 3–5).
- Candidates are deterministic: `generateCandidate(seed, index)` in `packages/guild-core/src/recruitment.ts` returns `{ name, appearance }` using a seeded PRNG for both. No provider request is made (REC-03).
- The pool is `GuildSettings.candidatePool = { seed, hiredIndices: int[] }`. Visible candidates are the first 4 indices not in `hiredIndices`.
- **Refresh** ("Ring the recruitment bell", or a button in the overlay) calls `guild.refreshCandidates()`, which stores a new random seed and clears `hiredIndices`. Unlimited, free, instant (REC-02).
- **Names** come from `packages/guild-core/src/names.ts`: fantasy given names from syllable tables (about 40 openings × 40 endings, filtered for unpleasant combinations), e.g. "Mira", "Thorn", "Elowen", "Brask". Duplicate avoidance (REC-03): when generating, skip a name that matches (case-insensitive) an active adventurer or another visible candidate; after 20 redraws, append a numeral ("Mira II"). IDs, not names, are identity.
- Appearance uses `randomAppearance` from `@t3tools/guild-art` over **approved** parts only (04 §Review loop).
- Candidates have **no** stats, levels, traits, histories or "aptitudes" (REC-08). The candidate card shows only name, appearance (animated idle), and "Level 0 · New recruit".

### Hiring (REC-04, REC-07)

Talking to a candidate (E or click) opens the **hiring overlay**:

| Field             | Required                              | Source / rule                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Class             | yes                                   | Picker of the nine classes (§Classes). Preselects nothing (CLS-02).                                                                                                                                                               |
| Provider          | yes                                   | T3 provider instances that are enabled and authenticated (`ServerProvider.status`, `auth`). Unavailable ones are listed disabled with their reason.                                                                               |
| Model family      | yes                                   | Families derived from that instance's discovered models (§Families).                                                                                                                                                              |
| Pin a model       | no                                    | One model slug within the family; default unpinned.                                                                                                                                                                               |
| Reasoning effort  | if supported                          | Values from the model's `role: "reasoning"` option descriptor (`packages/contracts/src/model.ts:24-35`); hidden if the model has none.                                                                                            |
| Permission policy | yes                                   | T3 runtime mode, preselected from the class default (§Classes); the user may lower or raise it. Shown with T3's own labels (Supervised, Auto-accept edits, Auto, Full access).                                                    |
| Interaction mode  | yes                                   | `default` or `plan`, class default preselected.                                                                                                                                                                                   |
| Specialties       | no                                    | Free tags, e.g. "postgres", "react".                                                                                                                                                                                              |
| Instructions      | no                                    | Textarea prefilled with the class's role template (§Classes), editable.                                                                                                                                                           |
| Approved tools    | — (shown, not edited, in Increment 1) | A read-only "Tools" line that states what really applies: "Provider tools as configured in T3 for _<instance>_, under the permission policy above." Increment 3 adds Guild tools by role (09); Increment 5 adds the loadout (12). |

"Hire" calls `guild.hireAdventurer({ commandId, pool: { seed, index }, classId, binding, defaults, specialties, instructions })`. The server:

1. Regenerates the candidate from `(seed, index)` and checks the pool still contains it (the client never supplies name or appearance for a hire).
2. Validates the binding against the current provider snapshot (§Binding validation).
3. Inserts the adventurer with `xp: 0`, `level: 0`, no attempts, an `AdventurerChange { kind: "hired" }`, and adds `index` to `hiredIndices`, in one transaction.

The new adventurer walks out of the Recruitment Hall into the Guild Hall (cosmetic).

### Classes (CLS-01…CLS-03)

Class is a specialty label with default instructions and a default posture. It never grants permissions (T3-07). "Default posture" from the brief maps onto what T3 can actually enforce: the runtime mode (approval policy), the interaction mode, and the workspace strategy used for quests (08, 10). T3 has no per-tool allowlist and no general read-only sandbox (00 §6), so "read-only by default" means _every write or command needs the user's approval_, plus a read-only snapshot workspace for review quests.

| Class     | Primary work (brief)                                                            | Default runtime mode | Default interaction | Quest workspace default | Emblem         |
| --------- | ------------------------------------------------------------------------------- | -------------------- | ------------------- | ----------------------- | -------------- |
| Warrior   | Feature implementation, refactoring, frontend/backend changes                   | `auto-accept-edits`  | `default`           | `own_worktree`          | crossed swords |
| Ranger    | Bug reproduction, root-cause analysis, targeted fixes                           | `approval-required`  | `default`           | `own_worktree`          | bow            |
| Scout     | Repository exploration, dependency tracing, technical research                  | `approval-required`  | `default`           | `read_only_snapshot`    | spyglass       |
| Mage      | Code review, architecture, performance and logical analysis                     | `approval-required`  | `default`           | `read_only_snapshot`    | staff          |
| Cleric    | Test creation/execution, E2E, integration, regression, independent verification | `approval-required`  | `default`           | `own_worktree`          | chalice        |
| Paladin   | Security, auth, authorization, data integrity, threat modeling                  | `approval-required`  | `default`           | `read_only_snapshot`    | shield         |
| Artificer | Infrastructure, Docker, CI/CD, migrations, deployment preparation               | `approval-required`  | `default`           | `own_worktree`          | cog            |
| Scribe    | Documentation, ADRs, changelogs, project knowledge                              | `auto-accept-edits`  | `default`           | `own_worktree`          | quill          |
| Commander | Mission planning, decomposition, scheduling and integration                     | `approval-required`  | `plan`              | `mission_branch`        | banner         |

The workspace values are the `Quest.workspace.strategy` values from 02.

Role templates (prefilled instructions) live in `packages/guild-core/src/classes.ts`. Each is 3–6 sentences in plain language describing the role's job and output, e.g. Mage: "You review code and designs. Report findings with file, line, evidence and a recommendation. Do not change files unless the quest asks you to." Templates never claim the model is smart, senior or skilled.

Changing class later is allowed from the profile; it logs `class_changed` and never touches history (CLS-02).

### Model bindings (MOD-01, MOD-02, decision D-009)

```ts
type ModelBinding = {
  providerInstanceId: ProviderInstanceId;
  family: { key: string; label: string }; // e.g. { key: "claudeAgent:sonnet", label: "Sonnet" }
  pinnedModel: string | null; // a model slug in the family, or null
  options: Record<string, string> | null; // e.g. { effort: "high" }; validated against capabilities
};
```

#### Families

T3 has no model-family concept (00 §5). Guild derives families from what discovery actually reports, in `packages/guild-core/src/families.ts`:

1. **Claude driver (`claudeAgent`)**: families are the Claude Code family aliases T3 already uses (`opus`, `sonnet`, `haiku`, `fable`; `apps/server/src/provider/ClaudeModelCatalog.ts:434-439`). A model belongs to a family if its slug, an alias, or its display name contains that family alias as a whole word or segment.
2. **Any driver whose models carry aliases**: a bare alias without digits (from the model manifest's `aliases`) defines a family; models sharing it belong to it.
3. **Otherwise**: each model is its own family (key `<driver>:<slug>`). The binding is then effectively exact-model.

The family list shown at hire time is exactly what step 1–3 produce from the selected instance's current model list. Guild never offers a family that discovery doesn't show, and never hard-codes model names (PIL-05). If a desired family (the brief's examples: Astra, Sonnet, Fable) is not offered by any configured provider, it simply isn't listed; the user configures a provider in T3 first.

The family rules are pure functions with unit tests built from fixtures copied from real `ServerProvider` snapshots.

#### Resolution at launch

`resolveBinding(binding, providers) → { ok: ModelSelection } | { error: BindingError }` (pure, `guild-core`), called by the server before every launch:

1. Instance missing, disabled or unauthenticated → `error: "provider_unavailable"` with T3's reason.
2. `pinnedModel` set: if offered by the instance → use it; otherwise `error: "pinned_model_unavailable"`.
3. Unpinned: candidate models = instance models in the family, excluding `isLegacy`. Prefer the instance's `isDefault` model if it is in the family, else the first in the provider's list order. None → `error: "family_unavailable"`.
4. Validate `options` against the chosen model's option descriptors; an unsupported value → `error: "option_unavailable"` (never silently dropped).
5. Return `ModelSelection { instanceId, model, options }`.

Guild **always** passes this explicit selection to `ThreadLaunchService.launch` and **never** calls `resolveNewThreadModelSelection` (which applies T3's fallback setting, `packages/shared/src/usageLimits.ts:67-104`). A unit test asserts the Guild launch path never imports it. Careful: the workflow launch code that Guild otherwise copies (`apps/server/src/workflows/WorkflowAgentThreads.ts`) **does** call it when no model is given (around line 191). Copy its launch pattern, not its model resolution.

#### Unavailable family (MOD-03)

A binding error stops the launch. The attempt is not created (or is marked `failed` with the error if the error appears after commit). The UI shows the reason in the dialogue and profile, e.g. "Sonnet isn't offered by provider _Claude (work)_ right now: not signed in." with actions:

- **Fix the provider** (opens T3 provider settings).
- **Change binding…** (opens the binding editor; saving logs `binding_changed` with before/after and requires a confirmation that names the old and new family).

There is no "use another model this time" button.

#### Executed-model drift (MOD-04, MOD-05)

Providers can run a different model than requested (Claude on Bedrock/Vertex, Codex reroutes; 00 §5). `GuildRunBridge` copies `ProviderTurn.model` into `AttemptTurn.executedModel` and `Attempt.executedModels`. If an executed model is not in the binding's family:

- the attempt gets a visible **"Ran outside family"** warning with the model name (dialogue, profile, attempt row);
- stats attribute that turn to the executed model, not the bound family (11);
- in Increment 3+, the scheduler will not start new attempts for that adventurer until the user acknowledges the warning.

If the user changes an adventurer thread's model in focus mode (allowed by T3), the bridge records it the same way. Guild never blocks T3's own controls.

#### Binding changes (MOD-05)

- **Version upgrade within the family** (unpinned): automatic by resolution rule 3; identity and history unchanged; each attempt records the exact model.
- **Re-pin to another model in the family**: an explicit edit; logged `binding_changed`.
- **Family change**: an explicit edit with confirmation; logged; stats split by family (11).

### Starting real work (Increment 1, PTY-10, PTY-11)

Talking to a hired adventurer opens the **dialogue overlay** (13 §Dialogue) with: name, class + emblem, level, model family (and pinned model), current activity from real status (07), latest meaningful status line, and actions:

- **Give orders** (when no conversation is open): pick a T3 project (default: last used for this adventurer), type the message, choose workspace (project root, or new worktree), send. Calls `guild.startConversation({ commandId, adventurerId, projectId, message, workspace })`.
- **Open conversation**: navigates to the attempt's thread in focus mode, or opens it in the hybrid side panel (13).
- **Profile**.

`guild.startConversation` on the server:

1. Validates adventurer active, resolves the binding (§Resolution at launch).
2. Generates the `ThreadId` up front (as `WorkflowAgentThreads.ts` does) and commits an `Attempt { kind: "conversation", status: "starting", threadId }`, `lastProjectId`, and an outbox row in one transaction. The thread link therefore exists before the first turn (02 invariant 2).
3. The outbox worker calls `ThreadLaunchService.launch` with the **server-side** `ThreadLaunchInput` (`apps/server/src/orchestration-v2/ThreadLaunchService.ts:104`, not the contracts schema): deterministic `commandId` from the outbox row, the pre-generated `threadId`, `projectId`, `title: "<Name> · <first 60 chars of message>"` with `titleRenamed: true`, the resolved `modelSelection`, the adventurer's `runtimeMode` and `interactionMode`, the workspace strategy (project root `{ type: "root" }`, or a new worktree whose `baseRef` is the project checkout's current branch from VCS status), `createdBy: "user"` (the user wrote the message; scheduler-launched quest attempts use `"system"`), `creationSource: "server"`, and `initialMessage { text: Guild briefing + the user's message, attachments: [] }`.
4. On success the attempt becomes `active`. On failure it checks T3's command receipt for the command id: accepted means the launch happened; otherwise the attempt becomes `failed` with T3's error.

**Guild briefing (decision D-011)**: a short, clearly labelled block at the top of each attempt's first message:

```
[Guild briefing]
You are <Name>, a <Class> in the user's guild. <role template or the adventurer's own instructions>
<Increment 2+: quest objective, scope, acceptance criteria, deliverable>
[End of briefing]
```

It is visible in the transcript; nothing is hidden from the user. **Continue** sends later messages to the same thread through `guild.continueConversation`. The server resolves the adventurer’s binding against current provider discovery and returns a typed error when it cannot resolve it. The Guild outbox dispatches with the explicit model selection and a deterministic T3 command ID (PTY-11). **End conversation** requires the thread to have no active work or pending runtime request before it marks the attempt `completed` (08 §Attempt states). Starting a new conversation creates a new attempt and thread; the adventurer stays the same (PRO-09).

In Increment 1 the dialogue's "current quest" (PTY-10) reads "No quest · conversation"; quests arrive in Increment 2.

### Profile and lifecycle (PRO-01…PRO-09, ROOM-03)

The **profile** (overlay in the world, also a focus-mode page) shows: name, appearance, class, specialties, level/XP (0 until Increment 2 rewards exist), binding with executed-model history, defaults, instructions, attempts (newest first, each linking to its thread), stats (11), change history (AdventurerChange), from Increment 2 quests and evidence, from Increment 3 findings, and from Increment 4 test runs and integration outcomes linked to this adventurer's attempts (brief §9.3: evidence "accessible from the quest/mission and from a character's profile").

Actions:

- **Rename** (`renamed`), **Edit class** (`class_changed`), **Edit binding** (`binding_changed`), **Edit defaults** (`defaults_changed`), **Edit instructions** (`instructions_changed`).
- **Archive** ("Send on leave" in fantasy copy, with "Archive" visible): the adventurer leaves the world and cannot receive new work; active attempts must be finished or cancelled first (the action lists them). **Restore** brings them back. History is always kept (PRO-09).
- **Cosmetic customization** (Increment 5): open the creator on the adventurer's appearance; saves log `appearance_changed`. Identity unchanged (REC-05).

There is no delete. Archived adventurers appear in the Barracks roster under "On leave".

## Invariants

1. New adventurers have zero XP, level 0 and no history except `hired`.
2. The server, not the client, decides a hired adventurer's name and appearance (from the pool).
3. Every launch uses an explicit selection from `resolveBinding`; Guild never applies T3's fallback.
4. A binding error never results in a launch with a different family.
5. Every executed model is recorded; out-of-family execution is always visible.
6. Class and level never change runtime mode, interaction mode or binding.

## Failure and reverse states

- Hire with a stale pool (another tab refreshed): the server rejects with `candidate_gone`; the UI refreshes the hall.
- Provider signs out after hire: dialogue shows the binding error; work can't start until fixed.
- Launch fails after commit (outbox): attempt `failed` with T3's error; "Try again" starts a new attempt.
- Archive ↔ Restore; every edit is reversible by another edit, and the history shows both.

## Out of scope

- Paid or limited recruitment, rerolls with cost, traits or stats on candidates (NON-04, REC-08).
- Per-tool permission allowlists (T3 has none; see 12 for what loadouts can honestly do).
- Per-adventurer "reusable skills" and MCP servers (brief §5.2, §5.4): provider-native skills and MCP servers are configured per provider instance in T3, not per thread, so Guild can't assign them per adventurer. Reported as unsupported in [decisions.md](../decisions.md) §Unsupported; the loadout covers what can be done (12).

## Acceptance checks

1. Recruitment: the hall shows 4 candidates with names and appearances; refresh changes them; hiring one with a class and family creates a Level 0 / 0 XP adventurer; after server restart the same name, appearance and ID appear (ACC-REC).
2. Family unit tests over real provider snapshot fixtures: families listed, resolution picks the right model, pinned-unavailable and family-unavailable return errors.
3. Launch test: with the bound family unavailable and a T3 fallback model configured, Guild refuses to launch and does not create a thread (ACC-PROV).
4. Real run (Increment 1 integrated pass): give orders to an adventurer; a T3 thread starts on the bound model; output streams in the thread; the attempt records the executed model; approval prompts appear as T3 shows them (ACC-PROV).
5. Drift test: a fixture turn reporting an out-of-family model produces the warning and attributes stats to the executed model.
6. Hiring code cannot accept a client-supplied name or appearance (unit test on the command schema and handler).

## Open questions

None.
