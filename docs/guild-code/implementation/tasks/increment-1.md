# Increment 1 — Guild Hall and persistent recruits

> Brief §14 Increment 1: "Inspect and run the T3 foundation; establish a baseline for its existing workflows. Integrate the reference-derived character creator and sprite system, player movement, side-view scenes and contextual E interaction. Build Guild Hall, a connected Recruitment Hall and at least one additional useful room. Implement room persistence/return positions and quick navigation. Create the manually customizable Guild Master and randomly named/random-appearance recruits, all Level 0. Persist real model-family bindings, class and character identity. Connect a hired adventurer to a real supported provider session through T3, display actual status and open their working conversation. Preserve focus mode and ensure visual transitions do not interrupt it."

**Done when** every card's checks pass and the integrated pass in T1.12 demonstrates ACC-VIS, ACC-NAV, ACC-REC, ACC-PROV, ACC-LIVE (Increment 1 parts), ACC-ENG (via focus mode) and ACC-RECOV (identity).

## MVP scope

Decision D-028. The MVP is the first build. It is Increment 1 with these cuts; everything cut stays in the cards and is built after the MVP.

**The MVP loop (all real):** create the Guild Master → walk the Guild Hall → E at the door → Recruitment Hall → hire one of 4 random candidates (class, provider, model family; Level 0) → back in the Hall, E on the adventurer → Give orders (project, message, project root or new worktree) → a real T3 thread starts on the bound model with the visible Guild briefing → the NPC sits at a work table while working, shows approval/question markers, shows offline when disconnected → HUD "Needs you" or "Open conversation" opens the thread in focus mode → server restart keeps everything → an unavailable family refuses with the reason.

| Card | In the MVP | Deferred |
|---|---|---|
| T1.1 | Light: confirm the app runs and record pre-existing check failures | Full workflow walk-through |
| T1.2 | All except worker use | — |
| T1.3 | Parts, prev/next, option grid, shuffle, locks, idle preview, name, save, edit later | Share codes UI, JSON, PNG download, presets, clip buttons and transport |
| T1.4 | All except the physics parity browser test (movement ported exactly and checked by hand) and the `report:client` baseline | Parity browser test, client metrics baseline, debug overlay |
| T1.5 | Guild Hall and Recruitment Hall with one door pair; props for both; saved location | Barracks and Corridor scenes |
| T1.6 | All | — |
| T1.7 | All | — |
| T1.8 | Roster overlay opened from the HUD (list + profile read-only: name, class, family, attempts) | Barracks room, edits, archive/restore UI (the server still records `hired` changes) |
| T1.9 | All except the drift warning UI (drift is still recorded) | Drift UI |
| T1.10 | Coarse live states; `sit` and `write` poses; attention/approval/question/offline markers; NPCs placed directly (run clip for any movement) | Walk clip, held items, cross-scene walking |
| T1.11 | HUD (Active, Needs you, Connection), palette "Open Guild" and adventurer search, `guild.toggle` | Hybrid mode, fast travel, focus-mode chip |
| T1.12 | Mode-switch safety check and the integrated pass on the MVP loop | — |

Sheets are built on the main thread during idle time in the MVP (03 §Failure and reverse states' fallback); the worker comes later.

## Card format

Each card lists: **Goal**, **Requirements** (IDs in [traceability.md](../../traceability.md)), **Read first**, **Depends on**, **Owns** (files/dirs only this card edits while it's in flight), **Steps**, **Checks** (each needs evidence in the report, [agent-rules.md](../../agent-rules.md) §7).

## Dependency graph

| Card | Depends on |
|---|---|
| T1.1 | — |
| T1.2 | T1.1 |
| T1.6 | T1.1 |
| T1.4 | T1.2 |
| T1.3 | T1.4, T1.6 |
| T1.5 | T1.4, T1.6 |
| T1.7 | T1.5, T1.6 |
| T1.8 | T1.7 |
| T1.9 | T1.7, T1.8 |
| T1.10 | T1.5, T1.9 |
| T1.11 | T1.9, T1.10 |
| T1.12 | all |

T1.2 and T1.6 can run in parallel; T1.3 and T1.5 can run in parallel after T1.4.

**File ownership rule for shared directories.** T1.6 creates `apps/server/src/guild/` with `GuildStore.ts`, `GuildService.ts` (core and registration), the stream and the outbox table. Later cards add **new files** there (e.g. `handlers/hire.ts`, `GuildRunBridge.ts`) and may add only their own registration lines to `GuildService.ts`, `ws.ts`, `server.ts` and `serverRuntimeStartup.ts`. The same applies to `packages/guild-core/` and `packages/contracts/src/guild.ts`: append your own definitions; don't rewrite another card's.

---

## T1.1 — Baseline the T3 foundation

- **Goal:** Run T3 as is, record a baseline of the workflows Guild must preserve, and re-verify the audit claims Increment 1 relies on.
- **Requirements:** T3-01, T3-09.
- **Read first:** [00](../00_foundation-audit.md), root [AGENTS.md](../../../../AGENTS.md) *Dev servers and test data*.
- **Depends on:** —
- **Owns:** `docs/guild-code/implementation/00_foundation-audit.md` (corrections only).
- **Steps:**
  1. Set up the worktree (`vp i` per root AGENTS.md), start the dev app against isolated test data (never `~/.t3/userdata`).
  2. Walk and record (screenshots in the scratchpad, paths in the report): create a project, start a thread with `Replay (dev)`, stream a reply, open diff/files/terminal panels, answer an approval prompt (use a Supervised thread), run the command palette, open Settings → Providers.
  3. Re-open every citation marked *reported* in 00 §2, §3, §5 and §7 and confirm it; fix any drift in 00 and mark it *checked*.
  4. Record the current `vp run check:changed` and `vp run typecheck` state so later cards know which failures pre-exist.
- **Checks:**
  1. Report lists each walked workflow with a screenshot path.
  2. 00 §2, §3, §5, §7 entries are all *checked* or corrected.

## T1.2 — Port the sprite system (`@t3tools/guild-art`)

- **Goal:** A pure TypeScript package that renders every reference part and pose pixel-identically, persists appearances by stable ids, and renders PNG contact sheets for review.
- **Requirements:** ART-01, ART-02, ART-04, ART-06, ART-09, PRO-08, ANI-04 (weapon `none`).
- **Read first:** [03](../03_sprite-system.md), [04](../04_art-pipeline.md) §Review loop, [../../index-24.html](../../index-24.html) lines 168–954.
- **Depends on:** T1.1.
- **Owns:** `packages/guild-art/**`, workspace registration for the new package.
- **Steps:**
  1. Create the package per 03 §Module layout (private, `type: module`, subpath exports, no barrel; follow `packages/shared/package.json`).
  2. Port frame/layer, palettes, all parts, poses, clips, species, `buildParts`, `composeFrame` faithfully with types.
  3. Write `test/referenceParity.test.ts` per 03 §Reference parity test. Make it pass. Prove it can fail (change one pixel, watch it fail, revert).
  4. Implement `appearance.ts` (schema v1, PX1/PX2/JSON import, GLD1 code, validation), `random.ts` (seeded PRNG, `randomAppearance` with locks), `parts/registry.ts` (append-only order), `sheet.ts` (`buildSheetFrames`, `toRGBA`).
  5. Append weapon id `none` (draws nothing) and the pose fields `w: -1` and `stow` (03 §Pose extensions) with reference poses unchanged (parity still passes).
  6. Write `scripts/render-sheets.ts` (minimal PNG writer over `node:zlib`) producing `parts-*.png`, `poses-*.png` and `reference.png` (04 §Review loop).
  7. Property test: 2,000 seeded appearances × all poses compose without throwing or clipping.
- **Checks:**
  1. `vp test run packages/guild-art` passes; parity test shown failing on a deliberate change.
  2. Appearance round-trip tests (03 §Acceptance checks 3).
  3. PNGs rendered, looked at, paths in the report; `reference.png` byte-matches the reference PNG export for the three presets.
  4. `git diff --stat docs/guild-code/index-24.html` is empty (ART-02).

## T1.3 — Guild Master creator

- **Goal:** First-launch creator that ports the reference creator's capabilities, saves the Guild Master, and reopens for editing.
- **Requirements:** NAV-01, NAV-02 (appearance part), NAV-03, ART-05, PRO-08.
- **Read first:** [06](../06_recruitment-and-identity.md) §The Guild Master, [03](../03_sprite-system.md) §Sheets and caching, §Display rules, [../../index-24.html](../../index-24.html) lines 1385–1648.
- **Depends on:** T1.4 (sheet cache, pixel display, lint override), T1.6 (`guild.createMaster`, `guild.updateMaster`).
- **Owns:** `apps/web/src/guild/ui/creator/**`.
- **Steps:**
  1. Use T1.4's `render/sheetCache.ts` and `pixelDisplay.ts`.
  2. Port the creator UI to React using T3 UI primitives for buttons and inputs, canvases for preview and thumbnails, keyboard shortcuts suppressed while typing. Add the name field.
  3. Show the creator when the guild snapshot has no master; "Enter the Guild" calls `guild.createMaster`. "Edit Guild Master" (Barracks, palette) reopens it with `guild.updateMaster`.
- **Checks:**
  1. Browser test: shuffle respects locks; PX2 code from the reference loads; save → reload → same appearance and name.
  2. Visual check at two window sizes and DPR 1 and 2: crisp pixels, no smoothing (ACC-VIS); screenshots in the report.

## T1.4 — World engine shell, route and movement

- **Goal:** `/guild` route hosting the canvas engine with the reference's movement feel, pixel-perfect scaling, the game-loop rules and input focus rules.
- **Requirements:** MODE-01, ART-07, ART-08, NAV-04, NAV-07, PERF-01, PERF-02.
- **Read first:** [05](../05_world-and-rooms.md) §Engine, §Viewport, §Movement, §Input focus; [14](../14_performance-and-reliability.md) §The game loop exception, §Frame budget; [13](../13_presentation-modes.md) §The three modes.
- **Depends on:** T1.2.
- **Owns:** `apps/web/src/guild/engine/**`, `apps/web/src/guild/render/**` (`sheetCache.ts`, `sheetWorker.ts`, `pixelDisplay.ts`), `apps/web/src/guild/GuildView.tsx`, `apps/web/src/routes/_chat.guild.tsx`, the `mainAppLocation.ts` registration, the `vite.config.ts` lint override from D-024.
- **Steps:**
  1. Add the route (D-023) with the sidebar hidden; register it as a utility page. Build `render/sheetCache.ts` + worker (03 §Sheets and caching) and `pixelDisplay.ts` (ported `deviceBox`, `cssForDevicePx`, `snapToDevicePixels`); the player is drawn from the sheet cache.
  2. Add the D-024 lint override for `apps/web/src/guild/**` with a comment citing U-006.
  3. Implement `GuildEngine`, `loop.ts` (120 Hz fixed step, 60 fps render cap, 20 fps when the side panel has focus), visibility/focus gating via `lib/documentActivity.ts`, `input.ts` (05 §Input focus), `camera.ts`, `player.ts` (exact reference physics), `text.ts` (pixel font + extra glyphs).
  4. A temporary test scene (the reference level grid) to exercise movement.
  5. Physics parity browser test (05 §Movement).
  6. Debug overlay (dev only) showing ms/frame.
  7. Reduced motion and "pause animations" setting (14).
- **Checks:**
  1. Physics parity browser test passes.
  2. Browser test: no rAF callbacks while blurred or hidden (14 check 1).
  3. Browser test: typing in an input doesn't move the player (ACC-NAV part).
  4. Debug overlay ≤ 2 ms/frame on the test scene; record the `report:client` baseline (14).

## T1.5 — Scenes, doors, interaction and the first rooms

- **Goal:** Guild Hall, Recruitment Hall, Barracks and Corridor as real side-view scenes with paired doors, E/click interaction, prompts, room state and Guild Master location persistence.
- **Requirements:** VIS-04, NAV-02, NAV-05, NAV-06, NAV-08, NAV-09, ROOM-01 (shell), ROOM-02 (scene), ROOM-03 (scene), ROOM-12, ANI-05, ANI-06.
- **Read first:** [05](../05_world-and-rooms.md) §Scenes and doors, §Interaction, §Level design rules, §Room catalogue; [04](../04_art-pipeline.md) §Room art, §Review loop.
- **Depends on:** T1.4, T1.6 (`guild.setMasterLocation`).
- **Owns:** `apps/web/src/guild/world/**`, `apps/web/src/guild/engine/scene.ts`, `interaction.ts`, `packages/guild-art/src/props/**`.
- **Steps:**
  1. Scene runtime (tiles, one-way platforms, parallax, cached static layer, props, doors, interactables, NPC slots).
  2. Interaction zones, target selection, edge-triggered E, mouse hover/click, prompt + `aria-live` mirror.
  3. Door transitions (fade, placement, camera snap) and the door-pair test.
  4. Author props and room palettes for the four scenes (hearth, tables, benches, quest board placeholder prop, bell, banners, reception desk, beds, footlockers, doors, torches) in the role format; render `props-*.png` and `room-*.png`; run the contrast check; get developer approval.
  5. Locked corridor doors for unbuilt rooms ("Coming soon").
  6. Persist location via `guild.setMasterLocation` on scene change and unmount; spawn from it.
- **Checks:**
  1. Door graph test; target-selection unit tests (05 checks 2, 5).
  2. Browser test: Hall → Recruitment Hall → back at the right door (ACC-NAV).
  3. Restart: Guild Master reappears at the last door (NAV-02).
  4. Room PNGs approved by the developer; contrast check passes.

## T1.6 — Guild server foundation and candidates

- **Goal:** Contracts, tables, store, service, stream and pure-rule package that everything else uses; recruitment candidates.
- **Requirements:** T3-02, PIL-01, PRO-01, PRO-02, REC-01, REC-02, REC-03, NAV-02, NAV-03, QST-12 (idempotency), ARCH-03, ARCH-05.
- **Read first:** [01](../01_architecture.md), [02](../02_domain-model.md), [06](../06_recruitment-and-identity.md) §Candidates, [00](../00_foundation-audit.md) §1.
- **Depends on:** T1.1.
- **Owns:** `packages/guild-core/**`, `packages/contracts/src/guild.ts`, `apps/server/src/guild/**`, `apps/server/src/persistence/Migrations/120_GuildIdentity.ts`, its registration in `Migrations.ts`, guild RPC registration in `ws.ts` and wiring in `server.ts`, `packages/client-runtime/src/state/guild.ts`, the guild scopes in `CLIENT_GUARDED_RPC_SCOPES`.
- **Steps:**
  1. `packages/guild-core` bootstrap (pure; subpath exports). Add `names.ts`, `recruitment.ts` (`generateCandidate`).
  2. Contracts: IDs, `Appearance` schema (mirroring `guild-art` v1), `GuildSettings`, `GuildMaster`, `Adventurer`, `ModelBinding`, `AdventurerChange`, `Attempt`, `AttemptTurn`, stream items, RPCs for Increment 1 (`subscribe`, `createMaster`, `updateMaster`, `setMasterLocation`, `refreshCandidates`, `hireAdventurer`, `updateAdventurer`, `archiveAdventurer`, `restoreAdventurer`, `startConversation`, `endConversation`, `getAdventurerProfile`).
  3. Migration 120: `guild_settings`, `guild_master`, `guild_adventurers`, `guild_adventurer_changes`, `guild_attempts`, `guild_attempt_turns`, `guild_command_receipts`, `guild_activity`, `guild_outbox`.
  4. `GuildStore`, `GuildService` with the mutation recipe (02 §Making changes), `guild.subscribe` stream with snapshot/changed/synchronized and resume by sequence.
  5. Client runtime atoms and commands.
  6. Add the guild snapshot to the transfer budget test.
- **Checks:**
  1. Schema round-trip tests; idempotency test (02 check 2).
  2. Candidate determinism tests; duplicate-name avoidance test.
  3. Restart test: rows survive (02 check 4).
  4. Transfer budget test includes the guild snapshot.

## T1.7 — Classes, model families and hiring

- **Goal:** Hire a candidate with a class, provider, family, optional pin and effort, permission defaults and instructions; Level 0; no fallback ever.
- **Requirements:** REC-04, REC-06, REC-07, REC-08, CLS-01, CLS-02, CLS-03, MOD-01, MOD-02, MOD-03, PIL-05, PRO-03, ROOM-02.
- **Read first:** [06](../06_recruitment-and-identity.md) §Hiring, §Classes, §Model bindings; [00](../00_foundation-audit.md) §5.
- **Depends on:** T1.6, T1.5 (Recruitment Hall scene).
- **Owns:** `packages/guild-core/src/classes.ts`, `families.ts`, `binding.ts`; `apps/web/src/guild/ui/recruitment/**`; the hire handler in `GuildService`.
- **Steps:**
  1. Class table and role templates (06 §Classes).
  2. Family derivation and `resolveBinding` with fixtures copied from real `ServerProvider` snapshots (Claude, Codex, one ACP agent), including fixtures with T3's `fallbackModelSelection` set and the default model's usage window exhausted, for T1.9's no-fallback check.
  3. Hire command: server regenerates the candidate from the pool, validates the binding, inserts Level 0 / 0 XP with `hired` change.
  4. Recruitment Hall: four candidate NPCs at their slots with idle clips and name plates; E opens the hiring overlay; refresh via the bell and a button.
  5. Unit test that Guild code never imports `resolveNewThreadModelSelection`.
- **Checks:**
  1. Family and resolution unit tests (06 check 2).
  2. Hire test: Level 0, 0 XP, server-chosen name/appearance (06 check 6).
  3. Browser test of the hiring overlay with a disabled provider showing its reason.

## T1.8 — Barracks roster and profile

- **Goal:** Roster and profile views with edits, archive/restore and history, in the world and as focus-mode pages.
- **Requirements:** ROOM-03, PRO-01…PRO-03, PRO-09, REC-05, CLS-02, MOD-05.
- **Read first:** [06](../06_recruitment-and-identity.md) §Profile and lifecycle, §Binding changes.
- **Depends on:** T1.7.
- **Owns:** `apps/web/src/guild/ui/roster/**`, `apps/web/src/guild/ui/profile/**`, `apps/web/src/routes/_chat.guild.roster.tsx`, `_chat.guild.adventurer.$id.tsx`.
- **Steps:**
  1. Roster (Barracks interactable + page): active and "On leave" lists with portraits, class, level, availability.
  2. Profile: fields from 06 §Profile; edits (rename, class, binding, defaults, instructions) with confirmations for binding family changes; archive (blocked while attempts are active, listing them) and restore; change history.
- **Checks:**
  1. Edits log the right `AdventurerChange` kinds; archive ↔ restore round-trips.
  2. Family change requires the confirmation naming old and new family.

## T1.9 — Talk to adventurers and start real work

- **Goal:** Dialogue overlay, "Give orders" launching a real T3 thread on the bound model with a visible briefing, attempts tracked by the bridge with executed models and usage, and drift warnings.
- **Requirements:** VIS-02, T3-03 (conversation threads; mission threads are T2.2), T3-04, T3-05, MOD-03, MOD-04 (recording; reporting is T2.8/T4.6), PRO-05, PTY-10 (Increment 1 parts), PTY-11, ARCH-01, ARCH-02, PERF-03.
- **Read first:** [06](../06_recruitment-and-identity.md) §Starting real work, §Executed-model drift; [02](../02_domain-model.md) §AttemptTurn, §Making changes, §Bridging T3 events; [08](../08_quest-lifecycle.md) §Attempt states; [13](../13_presentation-modes.md) §Dialogue overlay; [14](../14_performance-and-reliability.md) §Failure catalogue, §Restart recovery.
- **Depends on:** T1.7, T1.8.
- **Owns:** `apps/server/src/guild/GuildRunBridge.ts`, `apps/server/src/guild/GuildOutboxWorker.ts`, `packages/guild-core/src/lifecycle/attempt.ts` (conversation machine), their wiring lines in `server.ts` and `serverRuntimeStartup.ts` (after `ProviderRuntimeRecoveryService.recover`), `apps/web/src/guild/ui/dialogue/**` (including a `DriftWarning` component; T1.9 adds one line rendering it in the profile).
- **Steps:**
  1. Conversation attempt state machine (08 §Attempt states).
  2. `guild.startConversation` and `guild.endConversation` exactly as 06 §Starting real work (pre-generated thread id, server-side `ThreadLaunchInput`, `createdBy: "user"`, `titleRenamed: true`, worktree base ref, briefing + message, receipt check on failure).
  3. `GuildRunBridge`: domain-event subscription for attempt threads plus projection reconciliation on startup and after each launch; `AttemptTurn` per provider turn; executed models; usage; deletion → `cancelled` (02 §Bridging T3 events).
  4. Outbox worker and startup recovery (14 §Restart recovery steps 1–3).
  5. Dialogue overlay showing the raw live state (T1.10 replaces it with the presentation model) and actions; "Continue" through `startThreadTurn` without a model selection after re-running `resolveBinding`.
  6. Drift warning in dialogue and profile.
- **Checks:**
  1. Launch refuses when the family is unavailable even with a T3 fallback configured (06 check 3).
  2. Bridge idempotency (02 check 3) and drift test (06 check 5).
  3. Outbox recovery test (14 check 3).
  4. Real run with a real provider's cheapest model: thread starts on the bound model, streams, approval prompt appears as in T3, attempt records the executed model (ACC-PROV).

## T1.10 — NPCs and coarse live status

- **Goal:** Hired adventurers appear in the Guild Hall, placed and animated from real state, with markers and status lines; first new poses and held items.
- **Requirements:** NPC-01, NPC-03, NPC-04, NPC-05, ANI-01, ANI-02 (walk, sit, write, wait), ANI-04, QST-14 (live states other than quest `blocked`, which arrives in Increment 2), ACC-LIVE.
- **Read first:** [07](../07_npc-status-mapping.md), [03](../03_sprite-system.md) §Pose extensions, §Held items, [04](../04_art-pipeline.md) §Action poses.
- **Depends on:** T1.5, T1.9.
- **Owns:** `packages/guild-core/src/presentation.ts`, `apps/web/src/guild/engine/npc.ts`, `apps/web/src/guild/state/**`, new poses/held items/markers in `packages/guild-art`.
- **Steps:**
  1. `deriveAttemptLiveState` and `presentAdventurer` (Steps 1–3 for Increment 1's work kinds and fallback scenes).
  2. The agreement test with `resolveSidebarThreadStatus`.
  3. Author poses `walk`, `sit`, `write`, `wait`, held items `book`, `quill`, `hammer`, `scroll`, markers `attention`, `approval`, `zzz`, `question`, `offline`; contact sheets for all species/builds; developer approval.
  4. NPC entities: slot assignment, walking between scenes when visible, name plates, markers, ×N badges.
- **Checks:**
  1. Presentation unit tests (07 check 1, 2).
  2. Browser test of working / approval / offline (07 check 3; ACC-LIVE).
  3. Pose contact sheets approved.

## T1.11 — HUD, direct access and basic hybrid

- **Goal:** HUD in the world, Guild chip in focus mode, command palette entries and fast travel, `guild.toggle` keybinding, and Hybrid mode with one embedded conversation.
- **Requirements:** MODE-02 (basic), MODE-05, PIL-06, NAV-10, VIS-05.
- **Read first:** [13](../13_presentation-modes.md).
- **Depends on:** T1.9, T1.10.
- **Owns:** `apps/web/src/guild/ui/hud/**`, `apps/web/src/guild/ui/hybrid/**`, Guild entries in `CommandPalette.tsx`, the keybinding contract/defaults/labels.
- **Steps:**
  1. HUD and focus-mode chip (13 §HUD). In Increment 1 "Needs you" counts T3 approvals and questions on Guild threads and opens the attempt's thread at the prompt (the Council overlay arrives in Increment 3).
  2. Palette entries: Open Guild, Roster, Recruit, Go to <room>, adventurer search.
  3. `guild.toggle` keybinding.
  4. Hybrid: embedded `ChatView` for the selected adventurer's attempt (13 §Hybrid mode details), resizable split, world rescaled to whole pixels.
- **Checks:**
  1. From focus mode, open an adventurer's conversation via the palette in ≤ 2 actions (ACC-ENG).
  2. Approval reachable from the HUD in one click from the Barracks (NAV-10).

## T1.12 — Mode switching, focus integrity and the Increment 1 integrated pass

- **Goal:** Prove modes share state, T3 is intact, and Increment 1 meets its acceptance criteria end to end.
- **Requirements:** T3-01, T3-08, MODE-03, MODE-04, MODE-06, ACC-VIS, ACC-NAV, ACC-REC, ACC-PROV, ACC-LIVE, ACC-ENG, ACC-RECOV.
- **Read first:** [13](../13_presentation-modes.md) §Switching safely, this file's header, the T1.1 baseline report.
- **Depends on:** all other T1 cards.
- **Owns:** browser tests for mode switching; the integrated-pass report.
- **Steps:**
  1. Browser test: mode switches with a running attempt create no thread and keep the composer draft (13 check 2).
  2. Re-run the T1.1 baseline walk; every workflow still behaves the same.
  3. Replace the dialogue's raw live state with the presentation model's status line (T1.10) if not already done.
  4. Integrated pass with `test-t3-app`: create the Guild Master; walk Hall → Recruitment Hall; refresh and hire two adventurers with different families; restart the server (identity persists); give orders to one; watch it work at a Hall table; answer an approval from the HUD; open its diff in focus mode; switch modes; check the other adventurer stays available.
  5. Update [traceability.md](../../traceability.md) proof cells for Increment 1 rows with evidence links.
- **Checks:**
  1. Every ACC criterion listed in this file's header has screenshots or test output in the report.
  2. `vp run check:changed` passes.
