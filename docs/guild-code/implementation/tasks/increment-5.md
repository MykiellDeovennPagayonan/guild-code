# Increment 5 — The living guild

> Brief §14 Increment 5: "Expand action animations, NPC navigation, class props, journals, progression, achievements and earned cosmetic identity. Add remaining rooms, project scenes/portals, party statistics, chronicles and release trophies as appropriate. Polish UI, keyboard access, focus/hybrid modes, performance, responsiveness and recovery. Add optional audio or minigames only after the engineering loop is dependable."

**Done when** every card's checks pass, the developer has approved all new art, and a final full regression pass (every ACC criterion) passes.

**First step:** re-read decisions and the Increment 4 report. Confirm with the developer which cards to do and in what order; Increment 5 cards are independent unless noted, and T5.11 comes last.

Card format and rules: see [increment-1.md](increment-1.md).

---

## T5.1 — Full action pose set and body variants

- **Requirements:** ANI-02, ANI-03, ART-03.
- **Read first:** [03](../03_sprite-system.md) §Pose extensions; [04](../04_art-pipeline.md) §Action poses, §Review loop.
- **Goal:** Remaining poses (think, converse, rest/sleep with `lie`, carry, celebrate, plus fine-grained work variants), face overrides, `sit` legs, all checked against every species, build and risky accessory.
- **Checks:** contact sheets for every clip × 5 species × both facings approved; property test still passes.

## T5.2 — Remaining room art and "more fantasy" parts

- **Requirements:** ANI-05, ANI-06, ART-03 (per decision U-005).
- **Read first:** [04](../04_art-pipeline.md) §"More fantasy", §Room art.
- **Goal:** New species, heads, tops, faces, outfits, boots, backs, weapons, palettes (approved ones join the shuffle pool); polished art for every built room.
- **Checks:** every new part approved; contrast check for every room.

## T5.3 — Ambient life, reduced motion and optional audio

- **Requirements:** ANI-07, PERF-02.
- **Read first:** [04](../04_art-pipeline.md) §Ambient animation; [14](../14_performance-and-reliability.md).
- **Goal:** Lamp flicker, hearth, dust, banner sway, parallax polish; reduced-motion coverage; optional muted-by-default ambient and UI sounds with independent toggles.
- **Checks:** frame budget still ≤ 2 ms; `report:client` within budget; reduced motion disables every ambient effect.

## T5.4 — Progression cosmetics, titles, achievements, loadouts, personal quarters

- **Requirements:** XP-04, XP-05, EQP-01, EQP-02, LATER-07, LATER-08, ROOM-03, REC-05.
- **Read first:** [11](../11_progression-and-stats.md) §Levels, §Titles and achievements; [12](../12_knowledge-and-loadouts.md) §Loadout UI.
- **Goal:** Milestone unlocks (cosmetic only), titles, achievements with evidence, Wardrobe and loadout panels, cosmetic customization of adventurers, Barracks personal corners. Owns migration `124_GuildProgression.ts` (achievements, loadout column).
- **Checks:** 12 check 1 (cosmetics/levels don't change launch input); achievements idempotent.

## T5.5 — Journals, knowledge and the Library

- **Requirements:** PRO-04, EQP-03, EQP-04, EQP-05, ROOM-06, LATER-03.
- **Read first:** [12](../12_knowledge-and-loadouts.md).
- **Goal:** Journal proposals and approval, provenance, staleness, epic-scoped retrieval in briefings, Library room with shelves and repository maps. Owns migration `125_GuildJournal.ts`.
- **Checks:** 12 checks 2–3.

## T5.6 — Trophy Hall, milestones and chronicles

- **Requirements:** ROOM-11, LATER-05, LATER-06.
- **Read first:** [11](../11_progression-and-stats.md) §Milestones, Trophy Hall, chronicles.
- **Goal:** Milestones from delivered merge missions and verified tags; Trophy Hall banners linked to evidence; mission chronicles from recorded activity only.
- **Checks:** no banner without a recorded merge or tag; chronicles contain only recorded items with links.

## T5.7 — Hybrid mode and keyboard polish

- **Requirements:** MODE-02, MODE-06, NAV-07, QST-02.
- **Read first:** [13](../13_presentation-modes.md) §Hybrid mode details.
- **Goal:** Any right-panel kind, quest detail or board in hybrid; NPC click switches the panel; full keyboard access audit of every overlay.
- **Checks:** browser tests for panel switching and keyboard-only operation of board, dialogue, Council.

## T5.8 — Project portals and biomes

- **Requirements:** LATER-01, ROOM-10.
- **Read first:** [05](../05_world-and-rooms.md) §Portals.
- **Goal:** Per-epic biome scenes from fixed templates with the epic's quest board, history, party area and stats. Owns migration `126_GuildBiomes.ts` (epic biome column).
- **Checks:** the same epic always opens the same scene; no procedural regeneration on launch.

## T5.9 — Campaign map

- **Requirements:** LATER-02.
- **Read first:** [09](../09_orchestration-and-parties.md) §War Room.
- **Goal:** Full dependency and workstream map on the War Room table, from real quest dependencies.
- **Checks:** completing a prerequisite visibly unlocks dependents; the map never shows gates that aren't real dependencies.

## T5.10 — Royal correspondence

- **Requirements:** LATER-04.
- **Read first:** [13](../13_presentation-modes.md) §Inbox and notices.
- **Goal:** Letters for incoming issues, PR review requests and CI failures from integrations the user enabled in T3, convertible into quests.
- **Checks:** with no integration enabled, no letters; enabling one shows its items.

## T5.11 — Optional play, final polish and full regression

- **Requirements:** LATER-09, PERF-01, all ACC-*.
- **Read first:** [05](../05_world-and-rooms.md) §Play; [14](../14_performance-and-reliability.md).
- **Goal:** Training dummy play where allowed (no effect on anything real); final performance and recovery polish; full regression of every acceptance criterion.
- **Checks:** a regression report with evidence for every ACC row in [traceability.md](../../traceability.md).
