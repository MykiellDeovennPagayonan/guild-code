# 05 — World, scenes and rooms

> Status: Draft v1 (2026-11-27). Increments: 1 (engine, movement, doors, three rooms), 2–5 (more rooms). Decision D-005 is made here.

## Purpose

How the playable headquarters works: the canvas engine, movement, scenes and doors, contextual interaction, input focus, and the catalogue of rooms with what each is for and when it is built.

## Read first

1. [01_architecture.md](01_architecture.md) §Truth flows one way, §Web engine structure.
2. [03_sprite-system.md](03_sprite-system.md) §Display rules.
3. [04_art-pipeline.md](04_art-pipeline.md) §Room art.
4. Reference test room: [../index-24.html](../index-24.html) lines 956–1383.

## Requirements covered

VIS-04, PIL-03, NAV-02, NAV-04…NAV-10, ROOM-01…ROOM-12, ART-07, ART-10, MODE-01, PTY-10 (entry point), LATER-01, LATER-09.

## Non-negotiables (from the brief)

- "The headquarters is a collection of actual 2D side-view scenes connected by doors. Approach a door and press E to enter. Preserve return-door locations, room state and camera transitions." (NAV-08)
- "every essential work function must be accessible without platforming skill." (NAV-09)
- "If multiple objects overlap, choose a deterministic nearest/facing target or allow target selection. Do not fire interaction repeatedly while a key is held." (NAV-06)
- "Suppress world movement and shortcuts while the user is typing, editing code or operating terminal input." (NAV-07)
- "Never make a user walk through several scenes to answer an urgent approval request." (NAV-10)
- "Prefer a few distinct, genuinely useful rooms over many empty ones." (ROOM-12)

## Design

### Engine

`apps/web/src/guild/engine/`:

| File             | Responsibility                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GuildEngine.ts` | Lifecycle (`mount`, `unmount`), loop, scene switching, entity list, event emitter to the React host                                                           |
| `loop.ts`        | Fixed-step simulation at 120 Hz (`STEP = 1/120`, as the reference), render capped per [14](14_performance-and-reliability.md) §Frame budget, hit-stop support |
| `input.ts`       | Keyboard and mouse state, focus rules (§Input focus), edge-triggered actions                                                                                  |
| `player.ts`      | The Guild Master's movement: a port of the reference's `update()` physics                                                                                     |
| `camera.ts`      | Follow camera with the reference's look-ahead (`face * 16`) and easing (`dt*7`, `dt*6`), clamped to scene bounds                                              |
| `scene.ts`       | Scene runtime: tile grid, collision, parallax, props, doors, interactables, NPC slots                                                                         |
| `npc.ts`         | NPC entities: position, walk-to-slot, clip selection from the presentation model                                                                              |
| `interaction.ts` | Target selection and prompts (§Interaction)                                                                                                                   |
| `particles.ts`   | Reference particle puffs, sparks, dust                                                                                                                        |
| `text.ts`        | The reference 3×5 pixel font, plus the glyphs Guild needs (`[ ] ' ? , ( ) #`)                                                                                 |

The engine draws everything into an offscreen buffer at logical resolution, then copies it to the visible canvas at a whole-number scale using the reference's `fit()` method (03 §Display rules).

### Viewport (decision D-005)

- Logical viewport **384 × 216** (16:9), tile size **12 px** (as the reference). The reference used 288 × 162; the brief allows adjusting framing for larger displays while keeping pixel density consistent (§3.2).
- Scale is the largest whole number that fits the available area (reference `fit()`), minimum 1. Leftover pixels are letterboxed with the page background.
- In hybrid mode the world area is narrower; the scale drops accordingly and the logical viewport width shrinks to whole tiles (minimum 240 × 216) rather than scaling fractionally.

### Movement

Port the reference's movement exactly (ART-07): run speed `RUN = 66`, the height-and-time jump model (`JUMP_H = 33`, `RISE_T = 0.40`, `FALL_T = 0.34`, hang, release gravity), double jump at 80 % height, coyote time 0.09 s, jump buffer 0.12 s, the `groundSoon()` check that saves the air jump, sub-stepped collision (≤ 3 px per sub-step), landing puffs, distance-driven run frames, safe-spot respawn. `jumpTime` is fixed at 1.00 (no tuning UI).

Guild-specific changes to movement:

- Keys: A/D and ←/→ move; Space jumps (also W/↑/Z like the reference); **E interacts**; J attacks only in scenes that allow play (§Play); Esc closes the active overlay.
- No pits on essential paths, so the respawn rarely triggers; keep it anyway.
- The player is slowed to zero and input ignored while an overlay is open.

**Physics parity test** (`apps/web/src/guild/engine/player.browser.test.ts`): load `docs/guild-code/index-24.html` in an iframe, reach the reference's `Game` object through the iframe realm (`iframe.contentWindow.eval("Game")`), and drive both the reference (`Game._step(n, input)`, `Game.debug()`) and the port with the same scripted inputs on a flat floor and on the reference level grid (ported as a test scene). Positions, velocities, ground state and clip names must match at every step for: run right 2 s, tap jump, held jump, double jump, jump-release mid-rise, run off a ledge then jump within coyote time.

### Scenes and doors

A scene is data (`apps/web/src/guild/world/scenes/<id>.ts`) plus shared runtime:

```ts
type SceneDef = {
  id: SceneId; // "guild_hall", "recruitment_hall", ...
  name: string; // "Guild Hall"
  cols: number;
  rows: number; // tile grid size
  tiles: string[]; // rows of tile chars: '.' empty, '#' solid, '=' platform (one-way), ...
  palette: RoomPaletteId; // 04 §Palette roles
  parallax: ParallaxLayerDef[];
  props: PropPlacement[]; // decorative, no interaction
  doors: DoorDef[];
  interactables: InteractableDef[]; // quest board, desks, workstations, bell, ...
  npcSlots: NpcSlotDef[]; // named spots where adventurers sit/stand/work
  spawn: { x: number; y: number }; // used only when no door is involved
  play?: { attack: boolean }; // §Play
};
type DoorDef = {
  id: DoorId;
  x: number;
  y: number;
  target: SceneId;
  targetDoor: DoorId;
  label: string;
  locked?: string;
};
```

Rules:

- **Doors come in pairs.** `A.door.target = B` implies a door in `B` whose `target = A` and `targetDoor = A.door.id`. A unit test checks every scene graph edge is reversible (reverse states).
- **Entering:** press E (or click) near a door → 160 ms fade out → load the target scene → place the player at the target door, standing one tile in front of it, facing into the room → 160 ms fade in. The camera snaps to its clamped target before fading in.
- **Returning** uses the same mechanism, so the player always reappears at the door they came through (NAV-08).
- **Room state** (per scene: camera position, transient prop state such as a lit candle) is kept in memory for the session. NPC positions are not room state; they come from the presentation model.
- **Locked doors** (rooms not built yet) show `[E] Coming soon` and do nothing. No locked door is ever on the way to a built room.
- **Guild Master location** persists via `guild.setMasterLocation({ sceneId, doorId, x, facing })` on every scene change and when the world unmounts, never per frame (NAV-02). On load, the player spawns at that door (or the scene spawn).

### Interaction

- Every door, interactable and NPC has an **interaction zone**: a horizontal range around its anchor (default ±14 px) and a vertical band (the player's feet must be within 24 px of the object's floor line).
- **Target selection** (NAV-06), evaluated each simulation step:
  1. Candidates = all objects whose zone contains the player.
  2. Pick the smallest horizontal distance from the player's centre.
  3. Ties (within 2 px): prefer the one the player faces; then NPCs over interactables over doors; then lowest id.
- **Prompt** (NAV-05): drawn in the pixel font above the target, e.g. `[E] ENTER FORGE`, `[E] TALK TO MIRA`, `[E] READ QUEST BOARD`. The same text is mirrored into a visually hidden `aria-live="polite"` element for screen readers.
- **Firing:** E triggers on key-down only, never on auto-repeat (`event.repeat`), and only once until the key is released (NAV-06).
- **Mouse:** hovering an NPC, door or interactable draws a 1-px highlight outline and the prompt; clicking performs the same action **without walking** (PIL-06). Clicking empty floor does nothing (no click-to-move).
- Actions emit a typed engine event (`{ type: "interact", target }`); the React host opens the right overlay (dialogue, quest board, recruitment, …).

### Input focus (NAV-07)

The engine reads input only when **all** are true:

- the Guild view is mounted and in Adventure or Hybrid mode;
- no Guild overlay that takes text input is open;
- T3's `isEditableFocused()` (`apps/web/src/lib/editableFocus.ts`) is false (covers inputs, textareas, contenteditable, terminals rendered with `role=textbox`, shadow roots);
- no `alertdialog` is open and the command palette is closed (`isCommandPaletteOpen()`).

Additionally:

- Losing window focus clears all held keys (reference `blur()`), so the player never keeps running.
- Game keys are plain letters without modifiers. Modified shortcuts (`mod+k`, etc.) keep working everywhere because the engine ignores any key event with Ctrl/Meta/Alt.
- While the world has input, the engine registers a keybinding scope through `shortcuts/dispatcher.ts` `registerCommands(..., { capture })` so T3's single-key bindings (if any) do not fire on game keys; the scope is released when input is disabled.
- In hybrid mode, clicking the canvas focuses the world; clicking the side panel focuses the panel. A small focus ring on the active side makes this obvious.

### NPCs in scenes

- Each room defines `npcSlots`: `{ id, x, kind: "seat" | "stand" | "workbench" | "desk" | "bed" | "board", activity: ActivityKind[] }`.
- The presentation model ([07](07_npc-status-mapping.md)) says, for each adventurer, which scene and activity they are in. The scene assigns a free slot whose `activity` matches; overflow goes to generic standing spots near the room's centre, spaced 18 px apart.
- When an adventurer's scene changes while the player is in either scene, the NPC walks to the door (walk clip), disappears, and appears at the other door walking in. Otherwise they are placed directly. Walking is cosmetic and never changes real state (NPC-05).
- NPCs never collide with the player and never block doors.
- Each NPC shows a name plate (pixel font, 1 line) on hover or when targeted, plus status markers (07 §Markers) at all times.

### Level design rules (NAV-09)

- Every door, interactable and NPC slot that matters is reachable by walking on flat floor from the scene entrance. Jumping is never required.
- Platforms and shelves are optional decoration or shortcuts.
- No damage, no enemies, no timers.
- Rooms are 1–2.5 screens wide (32–80 tiles) so any target is a few seconds' walk (NAV-10). Long trips are replaced by fast travel (13 §Direct access).

### Room catalogue

Layout: the **Guild Hall** is the hub. A **Corridor** connects the hall to the other rooms with one door each. Recruitment Hall opens directly off the hall. Each built room is a separate side-view scene.

| Room             | Scene id           | Built in                                  | Props (04)                                          | Functional purpose (brief §4.3)                                                | Detailed in                 |
| ---------------- | ------------------ | ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| Guild Hall       | `guild_hall`       | Inc 1 (shell), Inc 2 (quest board, inbox) | Hearth, tables, benches, quest board, bell, banners | Overview of active work, notifications, assignments, inbox, recent completions | 13 §HUD, 08 §Quest board UI |
| Recruitment Hall | `recruitment_hall` | Inc 1                                     | Reception desk, candidate stand-spots, notice board | Generate candidates, choose class and model, hire                              | 06                          |
| Barracks         | `barracks`         | Inc 1 (roster), Inc 5 (personal corners)  | Beds, footlockers, emblem plaques                   | Roster, profiles, availability, history, archive/restore                       | 06 §Profile, 11             |
| Corridor         | `corridor`         | Inc 1                                     | Doors with signs, torches                           | Connects rooms; door signs show live counts (e.g. "Council · 2 waiting")       | —                           |
| Portal Room      | `portal_room`      | Inc 2                                     | Portals with project banners                        | Register an epic (link a project), pick the current epic                       | 08, 02 §Epic                |
| War Room         | `war_room`         | Inc 3                                     | Map table, banners, leader seats                    | Mission planning, parties, dependencies, plan approval, execution controls     | 09                          |
| Council Chamber  | `council`          | Inc 3                                     | Meeting table, decision scrolls                     | All pending approvals (T3 permission prompts and Guild approvals), merge gates | 10 §Council                 |
| Forge            | `forge`            | Inc 4                                     | Anvils, workbenches, embers                         | Files, editor, terminal, branches/worktrees, diffs, commits, PRs               | 10 §Forge                   |
| Training Grounds | `training_grounds` | Inc 4                                     | Dummies, targets, test stations                     | Test runs, failures, verification evidence                                     | 10 §Training Grounds        |
| Treasury         | `treasury`         | Inc 4                                     | Chests, ledgers, crystals                           | Provider usage, tokens, known costs and limits, stats                          | 11 §Treasury                |
| Library          | `library`          | Inc 5                                     | Shelves, scrolls, desks                             | Repository exploration, project instructions, journals, docs                   | 12                          |
| Trophy Hall      | `trophy_hall`      | Inc 5                                     | Release banners, trophies                           | Verified releases, milestones, chronicles                                      | 11 §Milestones              |
| Project portals  | `portal:<epicId>`  | Inc 5                                     | Biome-themed scene                                  | Per-epic board, history, party area                                            | §Portals                    |

Until a room is built, its corridor door is locked ("Coming soon") and its functions are still reachable from focus mode and the command palette (PIL-06).

### Play (LATER-09)

Scenes with `play.attack` (Training Grounds; optionally the Guild Hall yard) allow J to attack a training dummy using the reference's attack clips, hit-stop and particles. Play never affects real work, billing, permissions or access (LATER-09). No score is stored.

### Portals (LATER-01, Increment 5)

Each epic may pick a reusable biome (marketplace, academy, fortress, forest ruins). A project portal scene is generated from the biome's fixed template plus the epic's banner palette, not procedurally on each launch. It contains that epic's quest board, party area and history wall.

## Invariants

1. Every door has a return door; entering then exiting returns the player to the door they used.
2. Every essential function in a room is reachable by walking on flat floor, and also without entering the room at all (13 §Direct access).
3. No game input is processed while text input has focus or an input overlay is open.
4. E fires at most once per key press.
5. NPC positions never feed back into domain state.

## Failure and reverse states

- Presentation model unavailable (disconnected): NPCs show the offline marker and stay where they were; doors and the player keep working.
- Scene asset error (a prop fails to compose): draw the scene without that prop and log once; never crash the world.
- Leaving the Guild view while mid-transition completes the scene change and saves the location.

## Out of scope

- Click-to-move pathfinding, multiple floors with ladders, procedural levels, combat systems beyond the training dummy.

## Acceptance checks

1. Physics parity browser test passes.
2. Door graph test: every door pair is reversible.
3. Browser test: walk to the Recruitment Hall door, press E, the scene changes, press E on the return door, the player is back at the Hall's Recruitment door facing into the Hall (ACC-NAV).
4. Browser test: with a text input focused, A/D/Space/E do nothing; after blurring, they work (ACC-NAV).
5. Unit test of target selection: overlapping door and NPC → NPC wins at equal distance; facing breaks ties; held E fires once.
6. Restart: the Guild Master reappears in the room and at the door they last used (NAV-02).

## Open questions

None.
