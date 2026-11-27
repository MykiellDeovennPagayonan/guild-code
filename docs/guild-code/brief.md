# GUILD

> A living, side-scrolling fantasy guild where persistent AI adventurers carry out real software engineering work.

**Document purpose:** Standalone product vision and implementation brief for a coding agent.

**Companion reference:** `index-24.html` (provided separately, unchanged). This is the authoritative reference for character proportions, modular sprite generation, pixel rendering, animation and baseline side-scrolling movement.

**Foundation:** Fork T3 Code (https://github.com/pingdotgg/t3code) and reuse its existing provider integrations, sessions and engineering infrastructure wherever feasible.

**Scope:** A working personal AI coding environment, not a mockup, a virtual office, a standalone RPG with fake agents, or a collection of themed dashboard tabs. This document describes the intended product; it does not prescribe a final code structure or supply implementation code. The coding agent should inspect the actual T3 checkout before committing to technical integration choices.

---

## 1. Product vision

The user is a Guild Master who manages a guild of AI-powered adventurers. Kingdoms send requests (epics), which represent actual software projects. The Guild Master creates missions (development threads), posts quests (smaller engineering tasks), recruits adventurers, assembles parties, appoints leaders, and supervises real work.

A Warrior implements a feature. A Scout explores a repository. A Ranger tracks down a bug. A Mage reviews an implementation. A Cleric independently verifies the result. A party leader coordinates a group of adventurers, managing dependencies, blockers, and integration. These are real AI coding sessions, not scripted dialogue or visual simulations of work.

Every adventurer is a persistent, named character with a randomly generated appearance, an assigned class and a binding to an AI model family. All adventurers begin at Level 0 with zero experience and no fabricated work history. They develop a history through actual engineering outcomes.

The guild itself is a playable 2D side-scrolling world. The user controls their own character, walks through corridors, enters rooms by approaching doors and pressing **E**, and interacts directly with adventurers, quest boards, workstations, books, and other objects. The visual world is the primary navigation experience. Actual code, diffs, terminals and conversations remain first-class functional interfaces.

### 1.1 Core pillars

- **Persistent identities:** Adventurers are long-lived entities rather than disposable provider threads. Their identity survives session termination, restarts, project changes and permitted model upgrades.
- **Real engineering:** Every important activity is grounded in actual provider events, Git, files, test results, approvals or recorded work. Never manufacture activity or performance data to make the world seem busy.
- **Playable headquarters:** Side-view rooms, pixel-perfect sprites, contextual interaction and a user-controlled Guild Master. Do not default to an isometric office or a tab-only dashboard.
- **Practical orchestration:** Quests, parties, dependency graphs, isolated workspaces, verification gates and user control make multi-agent development usable.
- **Existing AI providers:** Reuse the user's supported T3 provider authentication and subscriptions where possible. Do not require a separate paid API by default, invent supported models, or bypass provider limits.
- **Low friction:** The game is a meaningful interface, not an obstacle. All essential engineering operations must also be reachable directly without mandatory traversal, combat, waiting or progression.
- **Honest progression:** XP reflects verified contributions; level does not claim to represent model intelligence. Metrics distinguish actual measured data from unavailable or estimated data.

### 1.2 What success feels like

The user opens Guild in the morning, walks into the guild hall, sees a Warrior finishing a real feature, a Mage waiting to report a review finding, a Cleric testing an integration, and several available adventurers. They inspect the quest board, assemble a party for a new mission, talk through the plan with its leader, approve a set of quests, and send the party to work. They can then inspect a diff or write code themselves while the agents continue executing. A completed, verified quest adds to the character's permanent history; a shipped release becomes a guild milestone.

## 2. Existing foundation: T3 Code

Use T3 Code as the foundation rather than rebuilding a provider runtime, chat system, terminal manager, or Git integration unnecessarily. Guild should retain the practical capabilities that make T3 useful.

Before implementation, inspect the actual repository version, license, setup instructions, application boundaries, provider contracts, model discovery, authentication flow, session lifecycle, persistence, event transport, project/thread model, Git/worktree capabilities, approval system, file editing and terminal support. These are verification tasks, not assumptions that every named capability exists in the current checkout.

### 2.1 Integration requirements

- Preserve existing T3 workflows and supported providers, including their authentication, permission prompts, streaming responses and error behavior.
- Introduce a Guild domain layer and adapter around T3's actual contracts rather than deeply rewriting all provider implementations.
- A Guild mission corresponds to a primary T3 development thread. A quest or execution attempt may create a child/associated provider session; do not assume native nested T3 threads or provider subagents exist.
- A provider session is not an adventurer. Maintain explicit links among adventurer, quest, execution attempt, actual provider/model and T3 thread/session identifiers.
- Continue provider execution independently of scene transitions, open panels, window focus and rendering. Persist state and reconcile it after restart or reconnection wherever supported.
- Prefer independently managed provider sessions for application-level orchestration if native subagents are unsupported or incompatible with the user's provider-sharing setup. This must still respect the provider's policies, concurrency, subscription and authorization limits.
- Keep any newly introduced execution tools constrained by the existing approval and sandbox boundaries. A fantasy class, weapon or rank must never grant additional permissions automatically.
- Keep the original T3 interface available as a focus/compatibility mode, or preserve equivalent working capabilities if the upstream architecture requires another approach.

### 2.2 Model family bindings

Examples discussed by the user: Astra-only, Sonnet-only, Fable-only adventurers. These are desired family labels, not a confirmed list of models available through any particular T3 version or provider.

A binding should identify a provider/account configuration, an allowed model family, and optionally a specific pinned model/version and supported reasoning effort. Use model discovery or explicit configuration based on actual provider capabilities. Do not silently substitute a different family when the requested family is unavailable. Show the reason and allow an explicit user-approved configuration change. Record the exact model used for every run. A compatible version upgrade should retain character identity and history; an intentional family change should be auditable and reflected in model-specific performance reporting.

## 3. Visual reference: `index-24.html`

Read and use the supplied HTML itself, not just the description in this document. It is a working character creator and single-player platforming test room written in HTML, CSS, JavaScript and Canvas. It is a reference asset/prototype, not the complete Guild implementation. No Guild-specific changes should be made to the original reference file in place.

### 3.1 Existing sprite system

The reference uses standing characters approximately 24×24 pixels within a padded 48×42 frame, with a fixed foot/root anchor at (24, 38). The same renderer is used by the character creator and the game. The art consists of palette-indexed layered sprites, automatic outlines, integer-pixel poses, anchored body parts and mirrored left/right frames. Preserve the proportions, exaggerated heads, expressive faces, strong outlines and playful fantasy-creature style. Do not replace it with realistic people, generated portraits, generic RPG sprites, vector avatars, 3D characters or an unrelated high-resolution art style.

The existing categories and counts are:

| Category | Options | Existing examples |
|---|---:|---|
| Species | 5 | Nub, Lopp, Drakel, Gillo, Orrok |
| Head | 7 | Visor, Tall, Round, Block, Pear, Cat, Acorn |
| Top/headwear | 10 | Brim, Kasa, Wizard, Helm, Horns, Spikes, Long, Hood, Crown, Bare |
| Face | 9 | Dots, Happy, Angry, Sleepy, Cyclops, Shiny, Grin, Dizzy, Scanner |
| Outfit | 8 | Tunic, Plate, Robe, Overalls, Ninja, Suit, Poncho, Brawler |
| Boots | 6 | Socks, Leather, Sabaton, Sneaker, Sandal, Stomper |
| Back accessory | 7 | None, Cape, Pack, Wings, Shield, Tail, Jetpack |
| Weapon | 4 | Blade, Mallet, Axe, Star rod |
| Palette | 8 | Ember, Moss, Tide, Grape, Bone, Sunny, Slime, Ash |

These produce 33,868,800 nominal combinations before any compatibility constraints, duplicate visual results or later additions. Reuse the actual asset definitions and composition rules. Do not require millions of pre-rendered images.

The creator already offers per-part selection, shuffle, part locking, left/right preview, pose and animation previews, share-code and JSON import/export, and sprite-sheet export. It supports `PX2` appearance codes and older `PX1` imports. Preserve existing useful capabilities in the Guild Master's creator and optional cosmetic customization. For long-term persistence, prefer stable part identifiers and an appearance schema/version rather than relying exclusively on array positions; retain compatibility with the original codes where practical.

### 3.2 Existing animation and movement

The reference includes idle, six-frame running, jump, double jump, fall, land, two attacks and combo clips. It uses a distance-based run animation, camera follow, parallax backgrounds, tiled terrain, collision, variable jump height, a soft jump apex, coyote time, buffered inputs, landing effects, and integer-pixel display scaling. The current test room uses a 288×162 logical viewport and 12px tiles.

Retain the feel of movement and the crisp pixel art. The exact camera framing and viewport can be adjusted for larger desktop displays or wider rooms, but preserve consistent pixel density and sharp rendering. Avoid fractional sprite scaling, antialiased sprite edges and mismatched prop resolution. Reuse or carefully extract the current renderer and animations into reusable components so all character instances share the same visual system.

Existing attack effects and training dummy are available for optional playful interactions. They are not evidence that combat, doors, multiple NPCs, persistence across scenes or live agent behavior already exist. Do not mistake the prototype for a multi-agent game engine.

### 3.3 New animations and props to add

Prioritize idle, walk/run and practical room interactions first. Add shared action poses for sitting, reading, writing, thinking, conversing, working at a forge, testing, sleeping/resting, carrying items, celebrating and waiting for attention. Reuse the compositional pose/anchor system so every randomly generated character can perform the same activities. Include sensible variants for different body shapes and accessories. Weapons can be stowed or hidden during noncombat activity; add a cosmetic no-weapon state if needed.

The original demo uses dark purple stone, low-contrast parallax scenery, bright character accents and gold lamps. Expand that palette into a cozy fantasy guild: wooden beams, stone walls, candles, lanterns, tapestries, fireplaces, bookshelves, desks, maps, anvils, banners, beds and magical portals. Keep background contrast lower than characters and important interactive objects. Small dust particles, flickering lamps, subtle parallax and restrained ambient animation are desirable. Audio is optional and should be independently mutable.

## 4. World navigation and interaction

### 4.1 Player character

On first launch, create the Guild Master using the full manual character creator from the reference. Randomization is available, but the user can select and lock individual parts. The Guild Master's appearance and current location persist. The Guild Master is controlled by the user, not a provider session; it is distinct from the hired adventurer roster.

Controls:

| Input | Action |
|---|---|
| A / D or Left / Right | Move horizontally |
| Space | Jump; double jump while airborne |
| E | Contextual interaction with nearest eligible object, adventurer or door |
| Escape | Close the active overlay or return from the current interaction |
| J (optional) | Playful attack in appropriate scenes, not an engineering command |
| Mouse | Select NPCs, doors, objects and engineering UI controls |

Near an interactable, show a concise contextual prompt, such as `[E] Enter Forge`, `[E] Talk to Mira`, `[E] Read Quest Board`. If multiple objects overlap, choose a deterministic nearest/facing target or allow target selection. Do not fire interaction repeatedly while a key is held. Suppress world movement and shortcuts while the user is typing, editing code or operating terminal input. Provide predictable input focus and accessible direct actions.

### 4.2 Side-scrolling rooms

The headquarters is a collection of actual 2D side-view scenes connected by doors. Approach a door and press E to enter. Preserve return-door locations, room state and camera transitions. Rooms may include optional platforms, stairs, decorative walkable areas and jumping, but every essential work function must be accessible without platforming skill.

Suggested room layout (not an isometric floor plan): a central guild hall and adjoining corridor with doors into other individual side-scrolling scenes. Room transitions can be short fades or door animations. Keep distances small and provide fast travel or a command palette. Never make a user walk through several scenes to answer an urgent approval request.

### 4.3 Rooms and their functional meaning

| Room | Environment and occupants | Actual functionality |
|---|---|---|
| Guild Hall | Hearth, tables, quest board, bell, available adventurers | Overview of active work, notifications, assignments, inbox, recent completions |
| Recruitment Hall | Reception desk and prospective recruits | Generate candidates, choose classes/models, hire adventurers |
| Barracks | Beds, personal corners, character emblems | Roster, profiles, availability, loadouts, history, archive/retire characters |
| War Room | Large map table, banners, party leaders | Mission planning, quest decomposition, parties, dependencies, approvals, execution controls |
| Forge | Anvils, workbenches, embers, writing adventurers | Source tree, editor, terminal, branch/worktree state, diffs, commits, PRs |
| Library | Shelves, scrolls, desks, Scouts and Scribes | Repository exploration, project instructions, architecture maps, ADRs, journals, documentation |
| Training Grounds | Practice dummies, targets, test stations, Clerics | Test suites, runs, failures, verification evidence, regression tracking |
| Treasury | Chests, ledgers, crystals | Provider usage, token counts, known quotas/costs, guild and adventurer statistics |
| Council Chamber | Meeting table, decision scrolls | Approval requests, architectural decisions, security escalations, merge/release gates |
| Portal Room | Magical portals and project banners | Kingdom/epic selection and project registration; project-specific scenes later |
| Trophy Hall | Release banners and trophies | Verified releases, milestones, completed missions and guild chronicles |

These are proposed functional locations; they need not all be built in the first increment. Prefer a few distinct, genuinely useful rooms over many empty ones.

### 4.4 Three presentation modes

- **Adventure mode:** Full-screen game world, physical exploration and contextual interactions. Primary identity of Guild.
- **Hybrid mode:** World visible alongside a selected character's conversation, quest, diff or code editor.
- **Focus mode:** Conventional engineering interface (retain T3 or equivalent) optimized for prolonged coding, large diffs, terminal work and complex reviews.

All modes share the same underlying data and execution state. Switching modes or rooms must not duplicate a provider session, cancel work, reset characters or lose unsaved edits. Keep a compact global status HUD for active agents, blockers, current project and pending approvals. Allow direct opening of an agent, mission, quest or file via search/shortcuts. The world should remain enjoyable even if the user spends hours in focus mode.

## 5. Recruitment, identity and progression

### 5.1 Recruitment flow

When entering the Recruitment Hall, the user sees several randomized candidate characters (suggested: 3–5). Each has a randomly generated fantasy name and a randomized appearance based on the reference's modular categories. The user can refresh the candidate pool on demand; no paid rerolls, artificial wait periods or scarce hiring currency. Candidate generation can use local deterministic name/appearance data without a provider request. Avoid duplicate names where feasible, but always use unique internal IDs.

Inspect a candidate, assign their class and model family, select supported reasoning preferences and approved tools, optionally define specialties and instructions, and hire them. Appearance and name are random by default; optional rename or cosmetic customization may be available without changing identity. The user's explicit requirement is random recruitment, so manual character construction must not be necessary for hiring. The Guild Master remains manually customizable.

Every new hire begins at **Level 0, XP 0** with no quest history, no code contributions, no tokens consumed, no accomplishments and no performance score. A veteran-looking recruit is still a novice in Guild. Do not generate fake intelligence, strength, coding aptitude or pre-earned experience. Hiring is free in game terms; actual provider usage remains subject to the user's subscription/API arrangements.

### 5.2 Persistent character profile

Each adventurer has:

- Immutable internal identity, created/hired timestamps, display name, appearance configuration and appearance schema version.
- Current class, optional specialties and role/rank; history of meaningful configuration changes.
- Provider/account reference, model-family binding, optional pinned version, supported reasoning effort and approved tools.
- Persistent instruction profile, journal, project-specific knowledge and relevant reusable skills.
- Current availability, assigned parties/missions, active execution attempt(s), resource limits and blocked/approval state.
- Level, XP, titles, achievements and actual lifetime/per-project/per-class/per-model statistics.
- Historical quests, attempts, reviews, contributions, findings, collaborations, and evidence links.

Appearance must stay consistent across recruitment preview, dialogue, world, roster and history. Generate/cache sprite sheets when appearance or cosmetic equipment changes, rather than recomposing all sprites each frame. A retired or archived character retains history. Resuming a quest or opening a new session with the same character must not create a new adventurer.

### 5.3 Classes and default responsibilities

Class is the character's engineering specialty, not a claim about the model's intelligence. It determines default role instructions and recommended tools; actual permissions are enforced separately. The user chooses a class during hiring rather than having it randomly assigned. Classes may evolve or be changed explicitly without erasing history.

| Class | Primary work | Default posture |
|---|---|---|
| Warrior | Feature implementation, refactoring, frontend/backend changes | Scoped write access to assigned workspace |
| Ranger | Bug reproduction, root-cause analysis, targeted fixes | Read/investigate, write within approved fix scope |
| Scout | Repository exploration, dependency tracing, technical research | Read-only by default |
| Mage | Code review, architecture, performance and logical analysis | Read-only review; findings with evidence |
| Cleric | Test creation/execution, E2E, integration, regression, independent verification | Scoped test tools and test workspace access |
| Paladin | Security, auth, authorization, data integrity, threat modeling | Audit first; remediation separately authorized |
| Artificer | Infrastructure, Docker, CI/CD, migrations, deployment preparation | Environment-scoped permissions; production actions gated |
| Scribe | Documentation, ADRs, changelogs, project knowledge | Scoped documentation access |
| Commander | Mission planning, decomposition, scheduling and integration | Delegation within approved mission and resource limits |

**Party leader is an appointment, not an exclusive class or a level requirement.** Any suitable adventurer can be appointed leader. A Ranger can lead a bug hunt; a Paladin can lead a security review; a Commander is a natural default for complex cross-functional work. A Level 0 character must not be artificially prevented from leading if the user chooses it. An observer is an assignment role, often filled by a Mage or Scout, rather than another mandatory class.

### 5.4 Equipment and knowledge

Separate visual equipment from actual engineering equipment. A sword, shield, hat or staff is a cosmetic asset. An engineering loadout includes approved CLI tools, MCP servers, skills, project instructions and explicit permission scopes. Suggested mapping: a spellbook for documentation tools, hammer for build tooling, shield for security checks, staff for test tools, backpack for selected context. Cosmetics never grant real access.

An adventurer's journal records approved durable discoveries, decisions, conventions and lessons. Project knowledge must be scoped by project and authorization; do not indiscriminately carry private context from one client repository to another. Distinguish a provider's session context from stored Guild knowledge. Retrieve relevant notes on subsequent runs. Notes should include provenance and staleness where possible and be editable or removable. This is retrieval and configuration, not model training or automatic increases in model intelligence.

## 6. Work hierarchy and data semantics

Preserve the user's terminology consistently throughout the product:

| Concept | Meaning |
|---|---|
| Guild | The user's global collection of adventurers, projects, parties and statistics |
| Kingdom | Optional organization, company, client or logical grouping of projects |
| Epic | A kingdom's request; an actual software project/repository or linked workspace (T3 project) |
| Mission | A major development objective or thread within an epic (primary T3 thread) |
| Quest | A small actionable unit of work within a mission, possibly delegated to several roles |
| Party | An assembled group of adventurers collaborating on a mission |
| Expedition | One coordinated execution of a mission and its quests |
| Run/attempt | A concrete provider execution for an adventurer and task, linked to the actual session |

Example: Kingdom = Reelist8; Epic = Property Auctions PH; Mission = Build seller registration; Quest = Implement registration API, review authorization, or verify duplicate registration behavior. A party is associated with the mission/expedition; it is not another level of task hierarchy. A quest may have many attempts and evidence records. A solo task is a valid expedition; avoid requiring artificial hierarchy for a tiny request (allow quick mission/quest creation).

An epic stores repository/workspace configuration, default branch, instructions, optionally multiple associated repositories or workspaces if supported, linked missions, knowledge, and project statistics. Kingdom grouping is optional to reduce friction for personal projects. A mission stores the objective, context, constraints, plan, assigned party, target branch/workspace, dependencies, acceptance criteria, status and execution history.

## 7. Quest board and lifecycle

The quest board is a physical object in the Guild Hall and optionally in project scenes. Press E to open a usable backlog interface styled like a quest journal. It supports posting, editing, prioritizing, assigning, filtering, dependency inspection, status updates, canceling and opening real work. Use readable text and standard keyboard navigation even if the surrounding art is fantasy themed.

### 7.1 Quest categories

| Display name | Engineering equivalent | Preferred class |
|---|---|---|
| Construction | Build a feature or component | Warrior |
| Bounty | Reproduce and fix a bug | Ranger |
| Reconnaissance | Explore a codebase | Scout |
| Investigation | Diagnose a failure or trace a workflow | Scout/Ranger |
| Inspection | Review code or architecture | Mage |
| Trial | Write/run tests or verify behavior | Cleric |
| Purification | Refactor technical debt | Warrior/Mage |
| Defense | Audit security or data access | Paladin |
| Infrastructure | CI/CD, database migrations, deployment preparation | Artificer |
| Chronicle | Write or update documentation | Scribe |
| Research | Evaluate a technology or approach | Scout/Mage |

The fantasy type labels are proposed defaults, not mandatory jargon. Always show the actual engineering meaning. A quest includes its objective, scope, expected outputs, acceptance criteria, priority/difficulty, dependencies, assigned adventurer(s), observer/reviewer where relevant, workspace/base revision, approved tools and resource limits. It records all attempts, blockers, findings and evidence. Read-only quests may deliver a report instead of code or a PR.

### 7.2 Explicit state machines

Do not manage the workflow only through disconnected booleans or visual animations. Model quest, mission, run and party availability separately and derive visual state from them. Suggested quest lifecycle:

- Draft/proposed → posted/ready → assigned/queued → in progress → submitted for review → independently verified (when required) → accepted/completed.
- In progress can become blocked, paused, canceled or failed; resume or retry must be explicit and retain prior attempt history.
- Review/verification can request changes, sending the quest to rework and a new attempt as appropriate.
- A prerequisite failure prevents dependent quests from starting unless explicitly resolved or overridden under the applicable policy.
- Merge or release is a separate engineering outcome; a completed research or documentation quest need not have a PR. For a mission that requires a merge, verify the configured integration gate before marking that mission delivered.

The exact transition names can be refined after inspecting T3. State must be persisted, transitions validated, duplicate events idempotent, and failure paths observable. An agent's claim of completion is not sufficient by itself. Gate completion on the quest's applicable acceptance criteria and recorded evidence, such as reviewed changes, a confirmed report, test results or a user decision. Distinguish blocked, provider rate-limited, awaiting permission, canceled, failed and disconnected/unknown states.

## 8. Parties and orchestration

Parties are a core product feature, not decorative NPC grouping. The user should be able to assign one adventurer directly, assemble a temporary party or save a persistent named party/formation. A formation defines roles and policies; a persistent party can retain named members and collaboration statistics. Members must be available under configured concurrency constraints. Default to one active writable assignment per adventurer, with explicit concurrency overrides where supported.

### 8.1 Example formations

| Formation | Roles | Purpose |
|---|---|---|
| Solo | 1 Warrior or another appropriate class | Small scoped task |
| Bug hunt | 1 Ranger, 1 Scout, 1 Cleric | Reproduce, locate, fix, independently test |
| Feature party | 1 leader, 2 Warriors, 1 Mage, 1 Cleric | Plan, implement, review, verify |
| Audit expedition | 1 leader, 2 Scouts, 2 Mages, 1 Paladin, 1 Cleric | Parallel investigation and cross-checking |
| Major expedition | 1 leader, 4 implementors, 4 paired observers, 2 independent verifiers, optional Paladin | Large parallel implementation with integration and quality gates |

These are suggested templates, not fixed party sizes. The user should be able to choose any compatible available members. Never force a large party for a trivial task or spawn more sessions than the configured budget permits.

### 8.2 Orchestration modes

- Manual command: The Guild Master posts quests, selects adventurers and controls major transitions.
- Delegated command: The party leader proposes plans and quests, then delegates and coordinates within the approved scope.
- Autonomous expedition: The party operates within a previously approved plan, permission set, budget and verification policy. Escalate new risk, scope changes, unresolved conflicts and destructive actions. The user can pause, cancel or intervene.

### 8.3 Leader workflow

1. Discuss the mission with the Guild Master and inspect the available project context.
2. Propose a plan with small quests, scopes, dependencies, acceptance criteria, ownership and verification requirements.
3. Identify independent workstreams, assign classes/members and establish workspaces.
4. Start eligible quests when their dependencies and permissions are satisfied, subject to resource limits.
5. Collect structured reports, tool results, blockers, findings and actual code changes. Pair implementors with observers when requested.
6. Replan or propose corrective quests as needed without silently expanding scope.
7. Integrate compatible changes, resolve conflicts under explicit ownership, and run cross-quest checks.
8. Request independent verification and human approval according to policy. Deliver a concise mission report and evidence, then record outcomes and progression.

An orchestration engine should own task dependencies, scheduling, workspace leases, budgets, cancellation, retries and durable execution state. The leader's model supplies planning and judgment; do not let a natural-language response alone control authorization or declare success. Provide structured application-level actions for proposing quests, assigning members, reporting blockers, submitting findings, requesting approval and submitting work. Validate actions server-side against the mission policy. Keep raw provider transcripts available for inspection.

### 8.4 Communication and review

Approach an adventurer and press E to open a dialogue overlay with their name, class, level, model family, current quest and latest meaningful status. Options include opening their conversation, inspecting code changes, reading their report, viewing statistics, assigning work, or requesting clarification. Dialogue should be backed by actual recorded status; do not spend model tokens just to create ambient chatter. When the user sends a real message, it should reach the correct bound provider session or a new explicitly associated run.

Support individual chat, party planning, quest comments, findings and guild notifications. Agent-to-agent coordination uses persisted structured records in addition to conversation. A finding records its severity, exact location where applicable, evidence, affected revision, recommendation, and resolution status. Independent verification should avoid simply asking the same implementation session to grade its own work. The app should retain an evidence trail and let the user inspect or challenge findings.

## 9. Actual software engineering and Git

The Forge is not a simulation of coding. It exposes actual source files, editing, Git, terminals, provider activity and changes. Preserve existing T3 capabilities; add missing features only after auditing the foundation. Fantasy labels are visual metaphors, with the real technical terminology always visible.

| Guild metaphor | Engineering entity |
|---|---|
| Established kingdom | Default/base branch |
| Expedition camp | Mission or quest workspace / Git worktree |
| Camp's path | Git branch or integration relationship |
| Milestone | Commit |
| Unfinished work at a station | Uncommitted changes |
| Council inspection | Code review |
| Petition to the crown | Pull request |
| Obstruction between camps | Merge conflict |
| Unification | Merge |
| Restoration | Revert |
| Royal decree / trophy | Verified release/tag |

### 9.1 Workspace isolation

For complex missions, optionally create a mission integration branch and separate quest branches/worktrees for independent writing tasks. Each writable workspace must have clear ownership and a known base revision. Read-only explorers and reviewers can inspect a pinned snapshot or an explicitly selected worktree without requiring writable branches. Do not have multiple independent agents blindly edit the same working tree. Detect dirty state, overlapping paths, stale bases and conflicts. Provide user-controlled handoff and integration operations. Never automatically overwrite existing user changes or delete a dirty worktree.

Example: `main` → `mission/seller-registration` → parallel quest branches for API and UI. Integrate both into the mission branch, test the integrated result, then open or merge a PR according to user approval. This is a suggested branching strategy, not mandatory for all tasks. Existing repositories may use different conventions. Support ordinary local work and inspection-only quests without unnecessary branches.

### 9.2 Engineering surfaces

The user should be able to see the actual file tree and open/edit files; inspect added/modified/deleted files; open unified or side-by-side diffs; see staged and unstaged changes, current branch, base revision, commits, conflicts and worktrees; access a terminal tied to the selected workspace; inspect diagnostics, tests, build output and command history; and open real pull requests where supported. Provide safe controls for reviewing, staging, committing, branch/worktree management, conflict resolution, merging and reverting, aligned with the existing provider and Git permissions. Preserve standard editing ergonomics (search, keyboard shortcuts, syntax highlighting, large readable panels) rather than forcing code into a tiny in-world dialogue box.

Show the correct workspace, branch, adventurer and quest in all relevant panels. User edits can occur independently of the AI; do not attribute them to an agent. Opening or inspecting a diff must never implicitly run a destructive command. Require explicit approval for destructive Git actions, sensitive credentials, production changes, external side effects and merges where configured. Avoid representing a visual animation as proof of a commit or deployment.

### 9.3 Tests and verification

Training Grounds shows real test executions: command, exit code, duration, relevant output, counts when parsable, failed cases and linked commit/workspace. Distinguish not run, running, passed, failed, canceled and stale results. If code changes after verification, invalidate affected evidence or clearly show its revision. Do not infer that a whole project passed based on one test. Test evidence, review findings and integration outcomes should be accessible from the quest/mission and from a character's profile.

## 10. Living NPC behavior and state mapping

An adventurer's physical behavior reflects the current real execution state whenever meaningful. Ambient wandering, sitting or resting can be cosmetic for available agents. Use a deterministic presentation policy when a character has multiple activities; show a count and provide a way to inspect all assignments rather than cloning the character without explanation.

| Actual state/activity | In-world presentation |
|---|---|
| Available | Wandering, chatting decoratively, sitting at the hearth |
| Planning | At the War Room table, inspecting a map |
| Exploring/researching | Library, reading or searching shelves |
| Implementing/fixing | Forge, working at a bench |
| Reviewing | Reading scrolls or inspecting work at a review station |
| Testing | Training Grounds, practicing against targets |
| Blocked | Stationary with an amber attention marker and actual blocker |
| Awaiting user approval | Council/desk marker; global notification |
| Provider rate-limited | Resting, with explicit limit and known retry information |
| Disconnected/unknown | Clearly marked unknown/offline; no fake work animation |
| Completed and accepted | Brief celebration, then return to available or next assignment |

The app should infer activity only from actual task role/status and available provider events. If only coarse session status is available, use coarse animations rather than pretending to know what the model is thinking. Decorative animation can be independent of work, but must not mislead. NPC navigation is a presentation layer, not the scheduler: walking to the Forge does not start a real provider run by itself. Agents continue working when off-screen, when the game is paused visually, and when an editor overlay is open, subject to actual runtime availability.

## 11. Statistics, XP and guild progression

The user explicitly wants real per-adventurer, per-project and guild-wide statistics. Party and mission statistics are useful extensions. Compute from durable events, execution records, Git attribution and verified outcomes, not fabricated RPG attributes.

### 11.1 Adventurer statistics

Track where supported: total and accepted quests, failed/canceled/blocked attempts, first-pass acceptance, rework, confirmed bugs discovered/fixed, validated review findings, verified test contributions, lines added/removed, files modified, commits, merged PRs, projects/parties participated in, active execution duration, blocked duration, input/output/cached tokens, reported or estimated cost, tokens per accepted quest, current and historical model versions, specialties and achievements.

Record the source and definition of metrics. Git diff additions/deletions are not synonymous with useful output. Count accepted work separately from attempted work and avoid double counting repeatedly edited lines, merged changes, retries or shared contributions. Associate actual work with quest, workspace, revision and responsible agent when reliably available; label unattributed or mixed work instead of guessing. Token and cost data vary by provider. Show unknown/unavailable when not exposed; do not treat unknown as zero. Label cost estimates and do not infer subscription quotas from context size or token totals. Compare agents by task type, complexity, sample size and model version rather than raw volume alone.

### 11.2 XP and levels

All adventurers start at Level 0 and 0 XP. Award XP for accepted, evidenced work, with category-appropriate rewards: an accepted investigation, valid review finding, verified fix, accepted documentation or completed implementation can each contribute. Optional bonuses for independently verified or first-pass work should not discourage raising legitimate issues or punish hard quests unfairly. No XP solely for tokens consumed, lines written, number of tool calls or elapsed time. Use idempotent reward records so retries/reconnects cannot repeatedly award XP for the same achievement.

Suggested progression (tunable, not a user-fixed formula): Level 0 novice; at milestone levels 10, 25, 50, 75 and 100 unlock cosmetic emblems, capes, accessories, titles and decorations. Retain recognizable original identity. Titles could include Bug Slayer, Pathfinder, Architect, Veteran or other evidence-based achievements. Level should not automatically increase real permissions, change model family or claim higher intelligence. Do not lock necessary software engineering functionality behind progression.

### 11.3 Guild, epic and party statistics

Guild-wide: roster size, active/available/blocked adventurers, kingdoms, epics, missions, quests, accepted work, merged PRs, releases, resource usage, execution time, validated findings and progress trends. Epic-specific: linked missions, open/blocked quests, branch/worktree state, recent changes, test/verification results by revision, findings, contributors, usage and delivery milestones. Party: missions completed together, acceptance/rework, execution time, role contributions and collaboration history. Show clear date ranges and drilldowns. Distinguish a quest-count progress percentage from an estimate of engineering effort.

The Treasury exposes actual provider statistics and configuration, including known budgets and rate-limit signals. Optional fantasy names like mana or stamina may accompany the real labels, but do not conflate context window, token count, concurrency, money or provider subscription limits. No artificial energy system should prevent the user from working.

## 12. Additional product features (later, not prerequisites)

- Project portals and themed environments: choose a reusable biome for each epic (marketplace, academy, fortress, forest ruins), with project-specific quest board, history, party area and stats. Do not generate a new world on every launch.
- Campaign map: display real quest dependencies and independent workstreams. Completing a dependency unlocks downstream work, not an unrelated arbitrary level gate.
- Repository exploration: show discovered modules, entry points, relationships and knowledge gaps; mark findings stale when relevant code changes.
- Royal correspondence: incoming Git issues, PR requests and CI failures become letters or notices when an actual integration supplies them. User controls external access.
- Chronicles: replay a mission from recorded events, decisions, tool actions, revisions and outcomes, without recreating or inventing hidden reasoning.
- Trophy Hall: cosmetic trophies/banners for confirmed releases and milestones. Optional celebrations and guild decorations.
- Personal quarters: beds, memorabilia and decorations reflecting earned history. No need for simulated hunger, injury, wages or sleep schedules.
- Skill trees/loadouts: organize approved instructions, tools and project specialties. Never present a cosmetic unlock as an unauthorized capability.
- Optional combat or minigames: reuse the supplied jump/attack animations and training dummy for fun; these must not affect real task results, provider billing, permissions or access to engineering tools.

## 13. Suggested conceptual architecture

The exact implementation should be decided after inspecting T3. The following boundaries express the product's needs, not mandatory libraries or directories:

| Layer | Responsibility |
|---|---|
| Guild presentation | Side-scrolling scene renderer, player controls, NPCs, doors, interactions, overlays, focus/hybrid modes |
| Character art system | Shared reference-derived character definitions, appearance generation, sprite composition, animation, caching |
| Guild domain | Persistent characters, classes, parties, epics, missions, quests, journals, rewards and settings |
| Orchestration | Plan/dependency graph, queue, execution policies, scoped delegation, workspace ownership, verification and approval |
| Engineering adapter | Links Guild entities to T3 project/thread/session lifecycle, provider events, Git, filesystem and terminal capabilities |
| Telemetry and evidence | Execution logs, provenance, test/commit evidence, usage, attribution and derived statistics |
| Persistence | Durable records, event identifiers, state transitions, recovery, migrations, backup/export |

The visual world should consume a read model of the underlying engineering state. It should not be the authority for quest state, execution or permissions. Maintain one source of truth across the game and editor. Agent execution belongs to the appropriate application/runtime layer, not the render loop. Persist IDs and relationships, and reconcile provider events after restart. Introduce only the new persistence and scheduling components genuinely needed; reuse existing facilities when appropriate. Design for local/personal use first, avoiding an unnecessary cloud backend or multiplayer infrastructure.

The reference uses Canvas and already implements a pixel renderer; start by evaluating reuse rather than requiring a new engine. Canvas or a lightweight 2D renderer may be appropriate. React/TypeScript overlays and an existing editor or a suitable code editor component may be appropriate if compatible with T3. A state-machine library and graph UI are optional implementation choices. Do not force a stack change solely to fit this brief. Keep new features modular enough to maintain upstream compatibility and avoid god files.

### 13.1 Conceptual entities and important relationships

- Guild, Kingdom, Epic, Mission, Quest and quest dependency.
- Adventurer, Class, ModelBinding, Equipment/Loadout, JournalEntry, CharacterAppearance, Achievement and RewardEvent.
- Party, PartyMembership, Formation and Expedition.
- ExecutionAttempt, provider session/thread association, execution event, blocker and approval request.
- Workspace, branch/base revision, change attribution, finding and evidence (including test results, diff/commit/PR links and reports).
- Statistics projections at character, mission, epic, party and guild level.

Important relationships: an epic contains missions; a mission contains quests; a quest may have multiple attempts; a run has a known adventurer and actual model; an expedition associates its party and mission; multiple quests may depend on the same prerequisite; evidence refers to the work and revision it validates. This is a domain model, not a finished database schema. The implementation should preserve invariants around ownership, attribution, idempotency and identity.

### 13.2 Reliability and resource use

The game should remain responsive while multiple coding agents are active on a normal laptop. Cache sprite sheets and static scene art, avoid expensive per-frame generation, and limit unnecessary redraws and provider requests. Animation and rendering should not compete with orchestration for critical execution state. Offer reduced-motion and pause-animation options; pausing visuals does not imply pausing agents. Handle rate limits, provider disconnection, unavailable models, failed commands, rejected permissions, dirty worktrees, lost sessions and user cancellation explicitly. Never automatically retry operations with irreversible side effects without knowing whether they previously succeeded.

## 14. Proposed delivery sequence

These are development increments, not permission to stop at a mockup. Each increment should produce a usable vertical slice, with actual functionality connected wherever the increment claims to support it. Avoid building a huge collection of dead rooms and placeholder interfaces before implementing the core experience.

### Increment 1 — Guild Hall and persistent recruits

- Inspect and run the T3 foundation; establish a baseline for its existing workflows.
- Integrate the reference-derived character creator and sprite system, player movement, side-view scenes and contextual E interaction.
- Build Guild Hall, a connected Recruitment Hall and at least one additional useful room. Implement room persistence/return positions and quick navigation.
- Create the manually customizable Guild Master and randomly named/random-appearance recruits, all Level 0. Persist real model-family bindings, class and character identity.
- Connect a hired adventurer to a real supported provider session through T3, display actual status and open their working conversation. Preserve focus mode and ensure visual transitions do not interrupt it.

### Increment 2 — Royal requests and quest board

- Register actual epics/projects and create missions/threads with the established hierarchy.
- Post small quests manually, assign adventurers, record attempts and show real progress, blockers and acceptance criteria.
- Connect quests to real repository context, code changes or investigation evidence. Persist state and support interruption/recovery.
- Show initial actual character/epic/guild statistics and award XP only for accepted work. Support no-code research quests.

### Increment 3 — War Room and parties

- Assemble named parties, select a leader and save reusable formations.
- Let leaders propose a mission plan and quests; allow human review, editing and approval.
- Implement dependency scheduling, constrained parallel execution, structured handoffs, blocker escalation, scoped permission and cancellation controls.
- Add independent review and verification gates; demonstrate a multi-agent mission with actual providers.

### Increment 4 — Forge and engineering completeness

- Expose branch/worktree ownership, actual changes, editable source, terminal and diffs, using existing T3 functionality where possible.
- Support integration of parallel work and inspect failures/conflicts; protect dirty working trees.
- Add Training Grounds and Council functionality for real test evidence, reviews and approval gates.
- Expand telemetry, attribution and project statistics. Validate that stats survive restarts and that unknown provider metrics are handled honestly.

### Increment 5 — The living guild

- Expand action animations, NPC navigation, class props, journals, progression, achievements and earned cosmetic identity.
- Add remaining rooms, project scenes/portals, party statistics, chronicles and release trophies as appropriate.
- Polish UI, keyboard access, focus/hybrid modes, performance, responsiveness and recovery. Add optional audio or minigames only after the engineering loop is dependable.

## 15. Acceptance criteria for the intended product

A finished implementation must be demonstrable through real workflows, not just screenshot-level resemblance. The following are behavioral checks for the coding agent; adapt the details to the actual provider capabilities, and explicitly report any unsupported feature instead of faking it.

| Area | Observable acceptance criterion |
|---|---|
| Visual fidelity | Characters are composed from the supplied reference's modular style and appear consistently in preview, gameplay and profiles. Native pixels remain sharp at supported window sizes. |
| Player navigation | Move, jump, approach an actual door, press E, enter a distinct room, and return at the correct door. Interactions do not trigger while typing into chat or code. |
| Recruitment | Generate several candidates with random names and appearances; select a class and supported model family; hire at Level 0/0 XP. The same identity and appearance reappear after restart. |
| Provider execution | Start a real run using a configured T3 provider and the recruited adventurer's allowed family; stream actual output and show real error/permission states. An unavailable family never silently falls back to another. |
| Hierarchy | Link an actual repository as an epic; create a mission and smaller quests; trace each quest and execution back to its parent and provider session. |
| Quest lifecycle | Assign, execute, block/resume, submit, request changes and accept a quest. Invalid transitions are prevented; attempts and evidence remain inspectable. An agent claiming success without required evidence does not complete the quest. |
| Parties | Assemble named adventurers, appoint a leader, approve a quest plan, execute independent quests in parallel under configured limits, and honor dependencies and cancellation. |
| Workspace safety | Run independent writing quests in isolated workspaces where appropriate; inspect actual Git diffs; preserve existing user changes; detect conflicts before integration. |
| Review and tests | An independent agent reviews or verifies work. Display actual findings, test results and associated revisions; report stale verification after relevant changes. |
| Engineering access | Inspect/edit actual files, use a real terminal, view a diff and navigate to the appropriate conversation without mandatory walking or game progression. |
| Live world | NPC status follows recorded execution state; blocked or unknown states are distinguishable. Switching scenes or presentation modes does not duplicate or terminate active sessions. |
| Metrics | Accepted work, attributed lines added/removed, execution records and provider-exposed usage update the correct character, epic and guild statistics; unavailable values remain unavailable. |
| Progression | New characters begin at zero; accepted outcomes grant XP once per reward event; failed/retried attempts do not inflate rewards; cosmetics never grant actual permissions. |
| Recovery | Restart/reconnect without losing character identity, associations, history, or silently repeating dangerous actions. Reconcile active executions as supported by the runtime. |
| User control | Pause/cancel work where supported, inspect pending approvals, reject scope changes, and take over a workspace. Actual execution boundaries remain enforced regardless of UI/class. |

## 16. Explicit non-goals and product constraints

- No purely decorative virtual office; the primary world is side-scrolling and directly interactive.
- No game-only pretend coding, synthetic token counts, fake tests, fake Git changes, fabricated character histories or simulated provider responses presented as real.
- No replacing the reference art with unrelated characters or a 3D/isometric aesthetic.
- No paid in-game recruitment, compulsory waiting, artificial stamina restrictions, grind or mandatory combat to access software engineering tools.
- No automatic cross-family model substitution, credential duplication/leakage or bypassing provider subscription, safety, approval or concurrency limits.
- No treating an RPG class, rank, quest or leader's text as authorization to run dangerous commands or access another project's private data.
- No automatic rewriting of upstream T3 architecture without inspecting it; no unnecessary reimplementation of working provider integrations.
- No claim that character XP trains the model, increases intelligence, or measures quality simply by code volume.
- No need for multiplayer, cloud accounts, a game economy, elaborate combat or procedural world generation in the initial version.

## 17. Decisions, defaults and open questions

**User-selected requirements:** T3 Code foundation; Guild RPG concept; epics = projects and missions = threads; smaller quests for engineering tasks; persistent adventurers and parties with engineering classes/leadership; model-family bindings; random adventurer names and appearances; Level 0 starts; actual individual/project/guild statistics; real code/Git integration; use the supplied HTML's character creation and graphical style; playable 2D side-scrolling headquarters; door interaction using E. The user wants a useful editor, not just tabs or an agent-watching room.

**Proposed design defaults from the discussion:** optional kingdom grouping; manually customizable Guild Master; the specific class list and fantasy labels; separate themed functional rooms; free recruitment with refreshable candidates; optional cosmetic customization; application-level orchestration with independent provider sessions when necessary; explicit state machines; worktrees for parallel writers; focus/hybrid modes; verified XP and cosmetic milestones; project portals, journals and trophies. These are refinable, but they should support the same product vision.

**Implementation choices not yet settled:** exact T3 revision and current provider capabilities; how T3's actual thread/session contracts represent mission and quest runs; whether to extract the existing Canvas system or introduce a lightweight compatible renderer; persistence schema and state-machine implementation; exact art assets for newly required rooms and action poses; model-family/version matching rules based on actual discovery; final XP curve, default party sizes, UI layout and concurrency policies. Do not present these as decisions already made by the user. Make reasonable, reversible implementation choices based on inspection and document deviations.

## 18. Reference notes for the coding agent

The companion HTML is self-contained and the original should remain available as a visual regression/reference tool. Useful locations in the provided version (line numbers approximate):

- Lines 99–166: creator and playable test room markup/controls.
- Lines 169–174: sprite frame dimensions and root anchor.
- Lines 279–621: palettes, heads, faces, headwear, outfits, boots, backs and weapons.
- Lines 643–715: poses and animation clips.
- Lines 717–791: species and category definitions.
- Lines 793–929: part composition, sheet generation, shared character drawing and thumbnails.
- Lines 932–954: device-pixel snapping and integer scaling helpers.
- Lines 956–1382: test room, collision, movement, camera, props, game loop and input handling.
- Lines 1385–1648: creator UI, share-code/JSON handling, local storage, shuffle, preview and controls.

The reference was inspected as source, not executed in a browser for this brief. Its existing test room has one controlled character and no Guild-specific AI or room system. The T3 source has not been audited as part of this brief. Inspect both before implementation; test actual behavior rather than assuming the descriptions guarantee production readiness.

---

**Guild's central promise:** Every adventurer has a real history. Every quest represents real work. Every room is a useful part of the engineering environment. Every animation and statistic should either be grounded in reality or clearly be cosmetic. Make a place the user enjoys returning to every day without sacrificing the speed, reliability and control they expect from a serious coding tool.
