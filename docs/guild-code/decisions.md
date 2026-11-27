# Decisions

Every product and design choice for Guild, in one place. Agents read this before every task.

- **USER**: made by the developer. Locked. Only the developer changes them.
- **DEFAULT**: made by the orchestrator or an implementing agent, with reasons. Follow them; to change one, add a new entry that supersedes it and update the affected docs in the same change.
- **OPEN**: unresolved. Work that depends on one stops until the developer answers.

Entries are never deleted. A superseded entry gets `Superseded by D-NNN` and stays.

## USER decisions

| ID | Decision | Source |
|---|---|---|
| U-001 | Build Guild on a fork of T3 Code, reusing its providers, sessions, Git and engineering infrastructure. | Brief §17 "User-selected requirements" |
| U-002 | The fork is **for the developer's own use**. No public distribution, so no rebranding work is required (TRADEMARK.md applies only to distribution). | Developer, 2026-11-27 |
| U-003 | **No upstream merges.** Guild may change T3 internals directly where that is the simplest correct path. | Developer, 2026-11-27 |
| U-004 | Guild targets **web and desktop only**. Mobile keeps the normal T3 UI and must keep working. | Developer, 2026-11-27 |
| U-005 | New pixel art is made by **agent iteration with the same logic as the HTML file, but with more fantasy designs**. | Developer, 2026-11-27 |
| U-006 | Guild copy is **English only**; it does not go through translation. (How this satisfies the lint rule: D-024.) | Developer, 2026-11-27 |
| U-007 | Remote access to Guild (other devices, app.t3.codes, Tailscale) is **not needed now, maybe in the future**. Don't block it; don't test for it. | Developer, 2026-11-27 |
| U-008 | All five increments are designed now, in detail. | Developer, 2026-11-27 |
| U-009 | Planning docs live in `docs/guild-code/` and are committed on purpose (overrides the root AGENTS.md rule against committing plans). | Developer, 2026-11-27 |
| U-010 | Brief §17 user-selected requirements: T3 Code foundation; Guild RPG concept; epics = projects and missions = threads; smaller quests for engineering tasks; persistent adventurers and parties with engineering classes/leadership; model-family bindings; random adventurer names and appearances; Level 0 starts; actual individual/project/guild statistics; real code/Git integration; use the supplied HTML's character creation and graphical style; playable 2D side-scrolling headquarters; door interaction using E; a useful editor, not just tabs or an agent-watching room. | Brief §17 |

## DEFAULT decisions

| ID | Decision | Why | Where |
|---|---|---|---|
| D-001 | Code layout: `packages/guild-art` (sprites), `packages/guild-core` (pure rules), `packages/contracts/src/guild*.ts`, `packages/client-runtime/src/state/guild.ts`, `apps/server/src/guild/`, `apps/server/src/mcp/toolkits/guild/`, `apps/web/src/guild/`, route `apps/web/src/routes/_chat.guild.tsx`. | Pure logic testable in Node and reusable by server, web and worker; wire changes in contracts per repo rules. | [01](implementation/01_architecture.md) |
| D-002 | Keep Guild modular even though upstream merges are off (U-003): edit T3 files only at hook points, each listed in its task card. | Brief ARCH-04 asks for modularity and no god files; small hooks keep T3 behaviour intact (T3-01). | [01](implementation/01_architecture.md) |
| D-003 | Guild entities live in their own SQL tables with their own stream, not as orchestrator aggregates. Guild copies whatever it needs permanently from T3 events. | T3 commands are keyed to threads and its event log keeps 1 day (00 §1). Precedent: workflows, scheduled tasks. | [01](implementation/01_architecture.md), [02](implementation/02_domain-model.md) |
| D-004 | Appearance persists as an id-based JSON object with a schema version; PX1/PX2/JSON import kept; new `GLD1-` code for new parts; part ids permanent, registry append-only. | Brief ART-06. | [03](implementation/03_sprite-system.md) |
| D-005 | Logical viewport 384×216 with 12 px tiles, whole-number scaling only. | Brief allows reframing for larger displays while keeping pixel density (§3.2). | [05](implementation/05_world-and-rooms.md) |
| D-006 | The world's game loop is the only sanctioned exception to the no-continuous-repaint rule: runs only while visible, focused and in Adventure/Hybrid, capped at 60 fps (20 fps when the side panel has focus). | A game must animate; the root performance rule still holds everywhere else. | [14](implementation/14_performance-and-reliability.md) |
| D-007 | Appearance stays random and independent of class; class shows as an emblem and through held items in work poses. | Brief requires random appearance (REC-06) and class chosen at hire (CLS-02). | [04](implementation/04_art-pipeline.md), [06](implementation/06_recruitment-and-identity.md) |
| D-008 | Four candidates per pool, deterministic from a stored seed; refresh is free and unlimited; the server regenerates the hired candidate (client never supplies name/appearance). | Brief suggests 3–5 (REC-01); determinism makes hires verifiable. | [06](implementation/06_recruitment-and-identity.md) |
| D-009 | Model families are derived from discovered models: Claude Code aliases (opus, sonnet, haiku, fable), else bare manifest aliases, else one family per model. Resolution never falls back; Guild never calls T3's fallback resolver. | T3 has no family concept and has an automatic fallback for new threads (00 §5). | [06](implementation/06_recruitment-and-identity.md) |
| D-010 | Quest attempts are top-level T3 threads launched by Guild (`ThreadLaunchService`), not `delegate_task` children. | `delegate_task` needs an active parent run, inherits the parent's provider and modes, hides children from lists (00 §4); brief T3-06 prefers independent sessions. | [09](implementation/09_orchestration-and-parties.md) |
| D-011 | Adventurer instructions and quest details reach the agent as a visible, labelled "Guild briefing" at the top of each attempt's first message. No hidden prompts. | `ThreadLaunchInput` has only an initial message (00 §3); visibility keeps it honest. | [06](implementation/06_recruitment-and-identity.md) |
| D-012 | NPC activity is coarse from the shell stream; fine-grained activity (command/edit/read/think) uses per-thread detail subscriptions only for visible working NPCs, max 4, from Increment 4. | The shell has status but no current tool; detail streams are heavy (00 §2). | [07](implementation/07_npc-status-mapping.md) |
| D-013 | Acceptance gate: every criterion has valid evidence of an allowed kind, plus deliverable minimums, plus independent verification when required, plus a user `accept` (autonomous auto-accept only with machine evidence). An agent report alone never satisfies it. | Brief QST-13. | [08](implementation/08_quest-lifecycle.md) |
| D-014 | Quick quests create a quick mission whose primary thread is the first attempt's thread. | Brief HIER-03 asks for low ceremony; mission = primary thread still holds. | [08](implementation/08_quest-lifecycle.md) |
| D-015 | Concurrency: 1 write lease per adventurer by default (overridable), guild cap 3 live attempts by default, optional per-provider and per-expedition caps; token budgets alert, never pre-block. | Brief PTY-03, PTY-05; T3 has no caps (00 §5); usage is known only after turns. | [09](implementation/09_orchestration-and-parties.md) |
| D-016 | `GuildScheduler` is an Effect service on T3's `Scheduler.register`, idempotent per tick, never retries automatically. | Brief PTY-08, PERF-03. | [09](implementation/09_orchestration-and-parties.md) |
| D-017 | Engineering surfaces reuse T3's components (diff, files, terminal, Git, PR, approvals) opened for the attempt's thread, plus a Guild context header. | Brief NON-07; T3 already has them (00 §6). | [10](implementation/10_engineering-surfaces.md) |
| D-018 | User edits in a Guild-held worktree mark the attempt's diff "mixed"; mixed and unattributed lines are excluded from agent stats. | User and agent edits in one tree can't be separated reliably (GIT-07). | [10](implementation/10_engineering-surfaces.md) |
| D-019 | Guild adds a test runner for user-approved per-epic test commands; agents can only run commands from that list. | T3 has no test results (00 §6); arbitrary agent commands through Guild would bypass approvals (T3-07). | [10](implementation/10_engineering-surfaces.md) |
| D-020 | XP rules v1 (table in 11) and level curve `round(25 * n^1.6)`; versioned. | Brief XP-04 says tunable. | [11](implementation/11_progression-and-stats.md) |
| D-021 | Achievements are evidence-based with unique source keys; titles are cosmetic. | Brief XP-03, XP-05. | [11](implementation/11_progression-and-stats.md) |
| D-022 | Loadouts contain only what Guild or T3 can enforce: permission policy, instructions and instruction-file references, allowed Guild tools, allowed test commands, context packs. | T3 has no per-tool allowlist (00 §6); brief EQP-01/02. | [12](implementation/12_knowledge-and-loadouts.md) |
| D-023 | Route `/guild` under `_chat`, sidebar hidden in Adventure mode; Guild pages under `/guild/*`; `guild.toggle` keybinding `mod+shift+g`. | Existing route and keybinding patterns (00 §7). | [13](implementation/13_presentation-modes.md) |
| D-024 | English-only copy (U-006) complies with lint by turning off `t3code/no-untranslated-copy` for `apps/web/src/guild/**` in `vite.config.ts`, with a comment citing U-006. Guild strings added to T3 files outside that folder (command palette entries, keybinding labels) follow those files' existing `gt()` pattern so `i18n:check` stays green. | The rule is an error across `apps/web/src/**` (00 §7). | [agent-rules](agent-rules.md) §3 |

| D-025 | Brief §9.2 surfaces are covered by T3's existing components as mapped in 10 §Brief §9.2 surfaces; Guild adds no staging area, diagnostics panel or local revert command. | Reuse over rebuild (NON-07); the gaps are listed below. | [10](implementation/10_engineering-surfaces.md) |
| D-026 | Guild offers JSON export of its own tables (`guild.export`, Increment 4); the SQLite database is backed up with T3's storage tools; no import in v1. | Brief §13 lists "backup/export" under persistence. | [02](implementation/02_domain-model.md) §Stream |
| D-027 | Quest and attempt state values use T3's spelling `cancelled`. Verbatim brief quotes keep the brief's "canceled". | One spelling in code; quotes stay verbatim. | [08](implementation/08_quest-lifecycle.md) |

| D-028 | **MVP scope** (developer approved 2026-11-27, details delegated to the orchestrator): build Increment 1 trimmed as listed in [tasks/increment-1.md §MVP scope](implementation/tasks/increment-1.md#mvp-scope). Deferred items stay in the spec and are built afterwards. Give orders offers project root (default) or a new worktree. | First usable end-to-end loop with the least code. | [increment-1](implementation/tasks/increment-1.md) |

## Unsupported or partly supported (brief §15: "explicitly report any unsupported feature instead of faking it")

| Brief asks for | Status | Why | What Guild does instead |
|---|---|---|---|
| Separate staged vs unstaged views (§9.2) | Not supported | T3 has one working-tree list (00 §6) | T3's unstaged diff selection; commits stage chosen files |
| Per-adventurer "approved tools" as a tool allowlist (§5.1, §5.2) | Partly | T3 has no per-tool allowlist (00 §6) | Permission policy (runtime mode), Guild tools by role, approved test commands (12) |
| Per-adventurer MCP servers and "reusable skills" (§5.2, §5.4) | Not supported | Configured per provider instance in T3, not per thread | Instructions, instruction-file references, context packs (12) |
| A true read-only sandbox for read-only classes (§5.3 "Read-only by default") | Partly | T3 has no general read-only sandbox | `approval-required` mode: every write or command needs the user's approval; read leases (10) |
| Local `git revert` control (§9.2) | Partly | T3 has PR revert and checkpoint rollback only | Those two |
| Approval and question markers for every provider (§10) | Partly | Cursor reports neither (00 §2) | The dialogue says so for Cursor-bound adventurers (07) |
| Token and cost data for every provider (§11.1) | Partly | Not all providers report usage; per-turn cost is rare (00 §5) | Shown as unknown, never 0 (11) |

## OPEN questions

None right now. Add entries as `O-NNN | question | who's blocked | date`.
