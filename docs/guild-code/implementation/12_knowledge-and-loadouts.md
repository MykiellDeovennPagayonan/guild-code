# 12 — Knowledge, journals and loadouts

> Status: Draft v1 (2026-11-27). Increment 1 (instructions), Increment 5 (journals, Library, loadouts, cosmetic equipment). Decision D-022 is made here.

## Purpose

What an adventurer "knows" and "carries": instructions, project-scoped journal notes with provenance, the Library, and loadouts. It also sets the hard line between cosmetic equipment and real engineering configuration.

## Read first

1. [06_recruitment-and-identity.md](06_recruitment-and-identity.md) §Classes, §Starting real work (Guild briefing).
2. [00_foundation-audit.md](00_foundation-audit.md) §4, §6 (what T3 can actually enforce).

## Requirements covered

PRO-04, CLS-01, EQP-01…EQP-05, T3-07, ROOM-06, LATER-03, LATER-08, ACC-PROG (cosmetics part).

## Non-negotiables (from the brief)

- "Separate visual equipment from actual engineering equipment. … Cosmetics never grant real access." (EQP-01, EQP-02)
- "Project knowledge must be scoped by project and authorization; do not indiscriminately carry private context from one client repository to another." (EQP-03)
- "Notes should include provenance and staleness where possible and be editable or removable." (EQP-04)
- "This is retrieval and configuration, not model training or automatic increases in model intelligence." (EQP-05)

## Design

### Two kinds of equipment

|                  | Cosmetic equipment                                          | Engineering loadout                                                     |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| What             | Appearance parts: hats, weapons, capes, held items, emblems | Real configuration applied when Guild launches the adventurer's threads |
| Where stored     | `Adventurer.appearance` (03)                                | `Adventurer.defaults`, `Adventurer.instructions`, `Adventurer.loadout`  |
| Who changes it   | User (creator), unlocks from levels (11)                    | User only, with a logged change                                         |
| Effect on access | **None, ever**                                              | Only what T3 enforces (below)                                           |

The suggested metaphors (spellbook for documentation tools, hammer for build tooling, shield for security checks, staff for test tools, backpack for context) appear only as **icons on loadout entries**, never as appearance items that imply access.

### What a loadout can honestly contain (decision D-022)

T3 has no per-tool allowlist and no general read-only sandbox (00 §6). A loadout therefore contains only things Guild can really apply:

- **Permission policy**: T3 runtime mode and interaction mode (already `Adventurer.defaults`, 06).
- **Instructions**: the adventurer's persistent instruction profile (06) plus selected **project instruction files** from the epic (e.g. `AGENTS.md`, `docs/…`), included in the Guild briefing by reference ("Read `AGENTS.md` first"), not copied.
- **Guild tools**: which Guild MCP tools the adventurer's threads may call, as a subset of what its role allows (09). Enforced by the Guild tool handlers.
- **Approved test commands**: which of the epic's approved test commands the adventurer may run through `guild_run_tests` (10).
- **Context packs** ("backpack"): selected journal entries and files to reference in the briefing.

Things a loadout **cannot** do, so the UI never offers them: grant shell or network access beyond the runtime mode, add provider-native MCP servers (configured in T3 provider settings), or bypass approvals. If T3 later gains per-tool controls, loadouts can use them; record that as a new decision.

### Instructions (Increment 1)

- `Adventurer.instructions` is plain text, prefilled from the class template, edited by the user, logged on change.
- Included in each attempt's Guild briefing (06, D-011), visible in the transcript.

### Journal (EQP-03, EQP-04; Increment 5)

- A `JournalEntry` (02) is a durable note: discovery, decision, convention or lesson. Each belongs to **one epic** (required) and one adventurer.
- **Creation**: an agent proposes entries with a Guild tool `guild_propose_journal_entry({ kind, text, revision? })` at the end of an attempt; proposals appear in the attempt's review and the Library, and become entries only when the user approves (EQP-03 "approved durable discoveries"). The user can also write entries directly.
- **Provenance**: attempt, thread and revision; shown on every entry with a link.
- **Staleness**: an entry with a revision and file paths becomes "possibly stale" when those paths change after that revision (checked lazily when the entry is retrieved). The user can confirm, edit or delete it.
- **Retrieval**: when Guild launches an attempt in an epic, the briefing lists up to 10 relevant entries for that adventurer **in that epic**, picked by simple, explainable relevance: entries linked to the same mission, then entries whose file paths overlap the quest scope, then most recent. No embeddings or hidden ranking in v1. The briefing says these are notes, not instructions from the user.
- **Scope**: entries never appear in another epic's briefing. Copying an entry to another epic is an explicit user action that creates a new entry with provenance "copied from …".
- **Session context vs Guild knowledge** (EQP-04): the briefing labels journal notes "Guild journal (saved notes)". The provider's own session memory is untouched and never presented as Guild knowledge.
- **Removal**: entries are soft-deleted (`deletedAt`), hidden everywhere, and kept only in history.

### Library (ROOM-06, LATER-03; Increment 5)

- Shelves per epic: **Instructions** (project instruction files opened in T3's file viewer), **Journal** (entries by adventurer, kind, staleness), **Reports** (accepted report deliverables), **Maps** (repository exploration).
- **Repository exploration** (LATER-03): accepted Reconnaissance quests can include a structured map in their report (modules, entry points, relationships, knowledge gaps) as JSON evidence. The Library renders the latest map per epic and marks nodes stale when their paths change after the map's revision.
- Scouts and Scribes appear here when their real work kind is `exploring`, `reviewing` or `writing` (07).

### Loadout UI (LATER-08; Increment 5)

A **loadout panel** in the profile: permission policy, instructions, project instruction references, Guild tools, test commands, context packs. Each entry shows its real effect in one sentence ("Every command and file edit needs your approval"). Earned cosmetics are in a separate **Wardrobe** tab, with the note "Cosmetic. Doesn't change what this adventurer can do."

## Invariants

1. Cosmetics and levels never change runtime mode, tools, bindings or access (unit test on the launch path).
2. Journal entries never cross epics implicitly.
3. Every journal entry has provenance and can be edited or removed.
4. Nothing Guild shows claims the model learns or improves.

## Failure and reverse states

- Rejected journal proposals are discarded and leave a history record.
- A deleted instruction file referenced by a loadout shows "missing file" and is dropped from the briefing with a note.

## Out of scope

- Fine-tuning, embeddings, cross-project memory.

## Acceptance checks

1. Changing an adventurer's cosmetic weapon or level changes nothing in the next launch input (unit test comparing launch inputs).
2. A journal entry from epic A never appears in an epic B briefing.
3. A journal entry with a file path becomes "possibly stale" after that file changes.

## Open questions

None.
