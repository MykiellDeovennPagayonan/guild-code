# Guild

> A living, side-scrolling fantasy guild where persistent AI adventurers carry out real software engineering work.

This repo is a personal fork of T3 Code (decisions U-001…U-003). We are building **Guild** on top of it: the user is a Guild Master who walks a pixel-art headquarters, recruits AI adventurers, posts quests and supervises real coding work done through T3's providers, threads, worktrees and diffs.

Start here. Every agent working on Guild reads this file first, then follows the reading order below.

## Vision in one page

- **Every adventurer has a real history.** Adventurers are persistent named characters with a random appearance (from the reference art), a class chosen by the user, and a binding to a provider and model family. They start at Level 0 with nothing invented. Their history comes only from real work.
- **Every quest represents real work.** Kingdoms send requests (epics = projects). Missions (= threads) break into quests. Each quest attempt is a real T3 thread on the adventurer's bound model. A quest completes only on evidence: diffs, test runs, independent review, the user's decision. An agent saying "done" is not enough.
- **Every room is useful.** The headquarters is a set of side-view rooms joined by doors: press **E** to enter. The Guild Hall shows active work, the Recruitment Hall hires, the War Room plans, the Forge opens real code, diffs and terminals, the Training Grounds shows real test runs, the Council holds approvals. Every function is also reachable without walking.
- **Every animation is either true or clearly cosmetic.** An adventurer at the forge is really implementing; a resting one is really rate-limited; an unknown state looks unknown. Ambient wandering is fine for idle adventurers, but never looks like work.
- **A serious tool first.** Focus mode is the normal T3 interface, untouched. The game must never slow the user down, hide an approval, or grant a permission.

Non-goals (brief §16): no decorative office, no fake activity or numbers, no other art style, no paid/grindy mechanics, no silent model substitution, no permissions from cosmetics or text, no rewriting T3, no claims that XP makes models smarter, no multiplayer or cloud.

## The source documents

| File                               | What it is                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| [brief.md](brief.md)               | The developer's product brief, verbatim. **The spec.**                                 |
| [index-24.html](index-24.html)     | The reference character creator and test room. **The visual source.** Read-only.       |
| [decisions.md](decisions.md)       | Every decision: USER (locked), DEFAULT (with reasons), OPEN.                           |
| [traceability.md](traceability.md) | Every brief requirement with an ID and verbatim quote → design section → task → proof. |
| [glossary.md](glossary.md)         | Guild term ↔ T3 term ↔ code identifier.                                                |
| [agent-rules.md](agent-rules.md)   | How implementing agents work, verify, escalate and report.                             |

## Reading order

1. This README.
2. [decisions.md](decisions.md).
3. [agent-rules.md](agent-rules.md).
4. [glossary.md](glossary.md).
5. Your task card in [implementation/tasks/](implementation/tasks/), and every doc it lists under _Read first_.
6. The verbatim quotes in [traceability.md](traceability.md) for every requirement ID on the card.

## Design documents

| Doc                                                                                | Covers                                                                   | Increments |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| [00 Foundation audit](implementation/00_foundation-audit.md)                       | What T3 already provides, with file paths; gaps                          | all        |
| [01 Architecture](implementation/01_architecture.md)                               | Layers, truth flows one way, module layout, how Guild drives T3          | all        |
| [02 Domain model](implementation/02_domain-model.md)                               | Entities, tables, idempotency, history, stream                           | 1–5        |
| [03 Sprite system](implementation/03_sprite-system.md)                             | Port of the reference renderer, appearance format, sheets, poses         | 1, 5       |
| [04 Art pipeline](implementation/04_art-pipeline.md)                               | Style guide, "more fantasy", props, rooms, review loop                   | 1–5        |
| [05 World and rooms](implementation/05_world-and-rooms.md)                         | Engine, movement, doors, interaction, input focus, room catalogue        | 1–5        |
| [06 Recruitment and identity](implementation/06_recruitment-and-identity.md)       | Guild Master, candidates, hiring, classes, model bindings, starting work | 1, 5       |
| [07 NPC status mapping](implementation/07_npc-status-mapping.md)                   | Real status → room, clip, marker                                         | 1–4        |
| [08 Quest lifecycle](implementation/08_quest-lifecycle.md)                         | State machines, evidence gates, categories, quest board                  | 2–4        |
| [09 Orchestration and parties](implementation/09_orchestration-and-parties.md)     | Parties, modes, scheduler, Guild MCP tools, review independence          | 3, 5       |
| [10 Engineering surfaces](implementation/10_engineering-surfaces.md)               | Forge, leases, integration, test evidence, Council, merge gates          | 1, 3, 4    |
| [11 Progression and stats](implementation/11_progression-and-stats.md)             | Metrics, unknown ≠ 0, XP, levels, Treasury, trophies                     | 2, 4, 5    |
| [12 Knowledge and loadouts](implementation/12_knowledge-and-loadouts.md)           | Instructions, journals, Library, cosmetics vs real config                | 1, 5       |
| [13 Presentation modes](implementation/13_presentation-modes.md)                   | Adventure/Hybrid/Focus, HUD, dialogue, direct access                     | 1, 2, 5    |
| [14 Performance and reliability](implementation/14_performance-and-reliability.md) | Game loop rules, frame budget, failure catalogue, restart recovery       | all        |

## Increments

Each increment is a usable vertical slice with real functionality (brief §14). Task cards are in [implementation/tasks/](implementation/tasks/).

| Increment                                                                     | Outcome                                                                                                                                              | Tasks      |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [1 — Guild Hall and persistent recruits](implementation/tasks/increment-1.md) | Create a Guild Master, walk three rooms, recruit Level 0 adventurers bound to real models, talk to them and start real T3 threads; focus mode intact | T1.1–T1.12 |
| [2 — Royal requests and quest board](implementation/tasks/increment-2.md)     | Epics, missions, quests with state machines and evidence; quest board; first stats and XP                                                            | T2.1–T2.9  |
| [3 — War Room and parties](implementation/tasks/increment-3.md)               | Parties, leaders, plan approval, scheduler, Guild MCP tools, independent review                                                                      | T3.1–T3.7  |
| [4 — Forge and engineering completeness](implementation/tasks/increment-4.md) | Forge, workspace safety, integration, test evidence, Council gates, full metrics, recovery                                                           | T4.1–T4.7  |
| [5 — The living guild](implementation/tasks/increment-5.md)                   | Full poses and rooms, ambient, progression cosmetics, journals and Library, trophies, hybrid polish, portals, campaign map, correspondence           | T5.1–T5.11 |

## Scope at a glance

- Surfaces: **web and desktop**. Mobile keeps T3's UI (U-004).
- Copy: **English only** (U-006, D-024).
- Remote access: not required now; don't block it (U-007).
- The developer approves new art (agent-rules §4).
