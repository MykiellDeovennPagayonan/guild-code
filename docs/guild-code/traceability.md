# Traceability: brief requirements → design → tasks → checks

Every requirement in [brief.md](brief.md) has an ID here. The **Requirement** column quotes the brief word for word; when a design doc and this quote disagree, the quote wins and the doc is wrong. **Design** names the doc section that specifies it. **Task** names the task card that builds it. **Proof** is the acceptance check that shows it works (the `ACC-*` rows mirror brief §15).

Rules for this file:

- Never reword a quote. If a requirement is unclear, add an OPEN entry to [decisions.md](decisions.md) instead.
- A row with no Task is a gap. A row with no Proof is unverifiable. Both block calling an increment done.
- When a task card is added, renamed or split, update its rows here in the same change.

Doc shorthand: `00`–`14` are files in [implementation/](implementation/); `T1.x`–`T5.x` are task cards in [implementation/tasks/](implementation/tasks/).

## Vision and pillars (brief §1)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| VIS-01 | "A working personal AI coding environment, not a mockup, a virtual office, a standalone RPG with fake agents, or a collection of themed dashboard tabs." | README §Vision in one page | all | ACC-* |
| VIS-02 | "These are real AI coding sessions, not scripted dialogue or visual simulations of work." | 01 §Truth flows one way; 07 | T1.9, T1.10 | ACC-PROV |
| VIS-03 | "Every adventurer is a persistent, named character with a randomly generated appearance, an assigned class and a binding to an AI model family. All adventurers begin at Level 0 with zero experience and no fabricated work history." | 06 | T1.6, T1.7 | ACC-REC |
| VIS-04 | "The user controls their own character, walks through corridors, enters rooms by approaching doors and pressing **E**, and interacts directly with adventurers, quest boards, workstations, books, and other objects." | 05 | T1.4, T1.5 | ACC-NAV |
| VIS-05 | "The visual world is the primary navigation experience. Actual code, diffs, terminals and conversations remain first-class functional interfaces." | 13 | T1.11, T4.* | ACC-ENG |
| PIL-01 | "**Persistent identities:** Adventurers are long-lived entities rather than disposable provider threads. Their identity survives session termination, restarts, project changes and permitted model upgrades." | 02 §Adventurer; 06 | T1.6, T1.8 | ACC-REC, ACC-RECOV |
| PIL-02 | "**Real engineering:** Every important activity is grounded in actual provider events, Git, files, test results, approvals or recorded work. Never manufacture activity or performance data to make the world seem busy." | 01 §Truth flows one way; 07; 11 | all | ACC-LIVE, ACC-METRIC |
| PIL-03 | "**Playable headquarters:** Side-view rooms, pixel-perfect sprites, contextual interaction and a user-controlled Guild Master. Do not default to an isometric office or a tab-only dashboard." | 03; 05 | T1.2–T1.5 | ACC-VIS, ACC-NAV |
| PIL-04 | "**Practical orchestration:** Quests, parties, dependency graphs, isolated workspaces, verification gates and user control make multi-agent development usable." | 08; 09 | T2.*, T3.* | ACC-PARTY |
| PIL-05 | "**Existing AI providers:** Reuse the user's supported T3 provider authentication and subscriptions where possible. Do not require a separate paid API by default, invent supported models, or bypass provider limits." | 06 §Model bindings; 00 §5 | T1.7 | ACC-PROV |
| PIL-06 | "**Low friction:** The game is a meaningful interface, not an obstacle. All essential engineering operations must also be reachable directly without mandatory traversal, combat, waiting or progression." | 13 §Direct access | T1.11, T1.12 | ACC-ENG |
| PIL-07 | "**Honest progression:** XP reflects verified contributions; level does not claim to represent model intelligence. Metrics distinguish actual measured data from unavailable or estimated data." | 11 | T2.8, T4.6 | ACC-PROG, ACC-METRIC |

## T3 foundation (brief §2)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| T3-01 | "Preserve existing T3 workflows and supported providers, including their authentication, permission prompts, streaming responses and error behavior." | 01 §Truth flows one way; 13 §The three modes | T1.1, T1.12 | T1.1 baseline |
| T3-02 | "Introduce a Guild domain layer and adapter around T3's actual contracts rather than deeply rewriting all provider implementations." | 01; 02 | T1.6 | review |
| T3-03 | "A Guild mission corresponds to a primary T3 development thread. A quest or execution attempt may create a child/associated provider session; do not assume native nested T3 threads or provider subagents exist." | 02 §Naming; 09 §Execution substrate | T2.2, T2.4 | ACC-HIER |
| T3-04 | "A provider session is not an adventurer. Maintain explicit links among adventurer, quest, execution attempt, actual provider/model and T3 thread/session identifiers." | 02 §Attempt | T1.9, T2.4 | ACC-HIER |
| T3-05 | "Continue provider execution independently of scene transitions, open panels, window focus and rendering. Persist state and reconcile it after restart or reconnection wherever supported." | 01 §Truth flows one way; 14 §Restart recovery | T1.9, T4.7 | ACC-LIVE, ACC-RECOV |
| T3-06 | "Prefer independently managed provider sessions for application-level orchestration if native subagents are unsupported or incompatible with the user's provider-sharing setup. This must still respect the provider's policies, concurrency, subscription and authorization limits." | 09 §Execution substrate | T3.4 | ACC-PARTY |
| T3-07 | "Keep any newly introduced execution tools constrained by the existing approval and sandbox boundaries. A fantasy class, weapon or rank must never grant additional permissions automatically." | 09 §Guild MCP tools; 12 | T3.3 | ACC-CTRL |
| T3-08 | "Keep the original T3 interface available as a focus/compatibility mode, or preserve equivalent working capabilities if the upstream architecture requires another approach." | 13 §The three modes | T1.12 | ACC-ENG |
| T3-09 | "Before implementation, inspect the actual repository version, license, setup instructions, application boundaries, provider contracts, model discovery, authentication flow, session lifecycle, persistence, event transport, project/thread model, Git/worktree capabilities, approval system, file editing and terminal support." | 00 | T1.1 | 00 exists, verified |

## Model family bindings (brief §2.2)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| MOD-01 | "A binding should identify a provider/account configuration, an allowed model family, and optionally a specific pinned model/version and supported reasoning effort." | 06 §Model bindings | T1.7 | unit tests |
| MOD-02 | "Use model discovery or explicit configuration based on actual provider capabilities." | 06 §Resolution at launch | T1.7 | unit tests |
| MOD-03 | "Do not silently substitute a different family when the requested family is unavailable. Show the reason and allow an explicit user-approved configuration change." | 06 §Unavailable family | T1.7, T1.9 | ACC-PROV |
| MOD-04 | "Record the exact model used for every run." | 02 §Attempt; 11 | T1.9, T2.8, T4.6 | ACC-METRIC |
| MOD-05 | "A compatible version upgrade should retain character identity and history; an intentional family change should be auditable and reflected in model-specific performance reporting." | 06 §Binding changes; 11 | T1.7, T4.6 | unit tests |

## Visual reference and sprites (brief §3)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| ART-01 | "Read and use the supplied HTML itself, not just the description in this document." | 03 | T1.2 | parity test |
| ART-02 | "No Guild-specific changes should be made to the original reference file in place." | 03 §Non-negotiables | all | git diff on `index-24.html` is empty |
| ART-03 | "Preserve the proportions, exaggerated heads, expressive faces, strong outlines and playful fantasy-creature style. Do not replace it with realistic people, generated portraits, generic RPG sprites, vector avatars, 3D characters or an unrelated high-resolution art style." | 03; 04 §Style rules for characters | T1.2, T5.1 | art review |
| ART-04 | "Reuse the actual asset definitions and composition rules. Do not require millions of pre-rendered images." | 03 §Design | T1.2 | parity test |
| ART-05 | "Preserve existing useful capabilities in the Guild Master's creator and optional cosmetic customization." | 06 §The Guild Master | T1.3 | ACC-VIS |
| ART-06 | "For long-term persistence, prefer stable part identifiers and an appearance schema/version rather than relying exclusively on array positions; retain compatibility with the original codes where practical." | 03 §Appearance format | T1.2 | unit tests |
| ART-07 | "Retain the feel of movement and the crisp pixel art." | 05 §Movement | T1.4 | physics parity test |
| ART-08 | "Avoid fractional sprite scaling, antialiased sprite edges and mismatched prop resolution." | 03 §Display rules; 04 | T1.4 | screenshot check |
| ART-09 | "Reuse or carefully extract the current renderer and animations into reusable components so all character instances share the same visual system." | 03 | T1.2 | review |
| ART-10 | "They are not evidence that combat, doors, multiple NPCs, persistence across scenes or live agent behavior already exist. Do not mistake the prototype for a multi-agent game engine." | 00 §Reference prototype | T1.4, T1.5 | T1.4 checks |

## Animations and props (brief §3.3)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| ANI-01 | "Prioritize idle, walk/run and practical room interactions first." | 04 §Action poses | T1.2, T1.10 | T1.2 checks |
| ANI-02 | "Add shared action poses for sitting, reading, writing, thinking, conversing, working at a forge, testing, sleeping/resting, carrying items, celebrating and waiting for attention." | 03 §Pose extensions; 04 §Action poses | T1.10, T2.9, T5.1 | art review |
| ANI-03 | "Reuse the compositional pose/anchor system so every randomly generated character can perform the same activities. Include sensible variants for different body shapes and accessories." | 03 §Pose extensions | T5.1 | contact-sheet check |
| ANI-04 | "Weapons can be stowed or hidden during noncombat activity; add a cosmetic no-weapon state if needed." | 03 §Held items | T1.10 | contact-sheet check |
| ANI-05 | "Expand that palette into a cozy fantasy guild: wooden beams, stone walls, candles, lanterns, tapestries, fireplaces, bookshelves, desks, maps, anvils, banners, beds and magical portals." | 04 §Room art | T1.5, T5.2 | art review |
| ANI-06 | "Keep background contrast lower than characters and important interactive objects." | 04 §Style rules for characters | T1.5 | contrast check |
| ANI-07 | "Small dust particles, flickering lamps, subtle parallax and restrained ambient animation are desirable. Audio is optional and should be independently mutable." | 04 §Ambient animation; 14 §Frame budget | T5.3 | T5.3 checks |

## Navigation and controls (brief §4.1–4.2)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| NAV-01 | "On first launch, create the Guild Master using the full manual character creator from the reference. Randomization is available, but the user can select and lock individual parts." | 06 §The Guild Master | T1.3 | ACC-VIS |
| NAV-02 | "The Guild Master's appearance and current location persist." | 02 §GuildMaster; 05 §Scenes and doors | T1.3, T1.5 | restart check |
| NAV-03 | "The Guild Master is controlled by the user, not a provider session; it is distinct from the hired adventurer roster." | 02 §GuildMaster | T1.3 | review |
| NAV-04 | Controls table: "A / D or Left / Right — Move horizontally; Space — Jump; double jump while airborne; E — Contextual interaction with nearest eligible object, adventurer or door; Escape — Close the active overlay or return from the current interaction; J (optional) — Playful attack in appropriate scenes, not an engineering command; Mouse — Select NPCs, doors, objects and engineering UI controls" | 05 §Movement | T1.4, T1.5 | ACC-NAV |
| NAV-05 | "Near an interactable, show a concise contextual prompt, such as `[E] Enter Forge`, `[E] Talk to Mira`, `[E] Read Quest Board`." | 05 §Interaction | T1.5 | ACC-NAV |
| NAV-06 | "If multiple objects overlap, choose a deterministic nearest/facing target or allow target selection. Do not fire interaction repeatedly while a key is held." | 05 §Interaction | T1.5 | unit tests |
| NAV-07 | "Suppress world movement and shortcuts while the user is typing, editing code or operating terminal input. Provide predictable input focus and accessible direct actions." | 05 §Input focus | T1.4 | ACC-NAV |
| NAV-08 | "The headquarters is a collection of actual 2D side-view scenes connected by doors. Approach a door and press E to enter. Preserve return-door locations, room state and camera transitions." | 05 §Scenes and doors | T1.5 | ACC-NAV |
| NAV-09 | "Rooms may include optional platforms, stairs, decorative walkable areas and jumping, but every essential work function must be accessible without platforming skill." | 05 §Level design rules | T1.5 | review |
| NAV-10 | "Keep distances small and provide fast travel or a command palette. Never make a user walk through several scenes to answer an urgent approval request." | 13 §Direct access | T1.11 | ACC-ENG |
| NAV-11 | "Suggested room layout (not an isometric floor plan): a central guild hall and adjoining corridor with doors into other individual side-scrolling scenes. Room transitions can be short fades or door animations." | 05 §Scenes and doors | T1.5 | T1.5 checks |

## Rooms (brief §4.3)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| ROOM-01 | "Guild Hall — Hearth, tables, quest board, bell, available adventurers — Overview of active work, notifications, assignments, inbox, recent completions" | 05 §Room catalogue | T1.5, T2.6 | T1.5 checks |
| ROOM-02 | "Recruitment Hall — Reception desk and prospective recruits — Generate candidates, choose classes/models, hire adventurers" | 05; 06 | T1.6, T1.7 | ACC-REC |
| ROOM-03 | "Barracks — Beds, personal corners, character emblems — Roster, profiles, availability, loadouts, history, archive/retire characters" | 05; 06 §Profile and lifecycle | T1.8, T5.4 | T1.8 checks |
| ROOM-04 | "War Room — Large map table, banners, party leaders — Mission planning, quest decomposition, parties, dependencies, approvals, execution controls" | 05; 09 | T3.* | ACC-PARTY |
| ROOM-05 | "Forge — Anvils, workbenches, embers, writing adventurers — Source tree, editor, terminal, branch/worktree state, diffs, commits, PRs" | 05; 10 §Forge | T4.1–T4.3 | ACC-ENG |
| ROOM-06 | "Library — Shelves, scrolls, desks, Scouts and Scribes — Repository exploration, project instructions, architecture maps, ADRs, journals, documentation" | 05; 12 | T5.5 | T5.5 checks |
| ROOM-07 | "Training Grounds — Practice dummies, targets, test stations, Clerics — Test suites, runs, failures, verification evidence, regression tracking" | 05; 10 §Training Grounds | T4.4 | ACC-REVIEW |
| ROOM-08 | "Treasury — Chests, ledgers, crystals — Provider usage, token counts, known quotas/costs, guild and adventurer statistics" | 05; 11 §Treasury | T4.6 | ACC-METRIC |
| ROOM-09 | "Council Chamber — Meeting table, decision scrolls — Approval requests, architectural decisions, security escalations, merge/release gates" | 05; 10 §Council | T4.5 | ACC-CTRL |
| ROOM-10 | "Portal Room — Magical portals and project banners — Kingdom/epic selection and project registration; project-specific scenes later" | 05; 02 §Epic | T2.1 | ACC-HIER |
| ROOM-11 | "Trophy Hall — Release banners and trophies — Verified releases, milestones, completed missions and guild chronicles" | 05; 11 §Milestones, Trophy Hall, chronicles | T5.6 | T5.6 checks |
| ROOM-12 | "These are proposed functional locations; they need not all be built in the first increment. Prefer a few distinct, genuinely useful rooms over many empty ones." | 05 §Room catalogue | README §Increments | review |

## Presentation modes (brief §4.4)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| MODE-01 | "**Adventure mode:** Full-screen game world, physical exploration and contextual interactions. Primary identity of Guild." | 13 | T1.4 | ACC-NAV |
| MODE-02 | "**Hybrid mode:** World visible alongside a selected character's conversation, quest, diff or code editor." | 13 §Hybrid mode details | T1.11, T4.1, T5.7 | T1.11 checks |
| MODE-03 | "**Focus mode:** Conventional engineering interface (retain T3 or equivalent) optimized for prolonged coding, large diffs, terminal work and complex reviews." | 13 §The three modes | T1.12 | ACC-ENG |
| MODE-04 | "All modes share the same underlying data and execution state. Switching modes or rooms must not duplicate a provider session, cancel work, reset characters or lose unsaved edits." | 01; 13 §Switching safely | T1.12 | ACC-LIVE |
| MODE-05 | "Keep a compact global status HUD for active agents, blockers, current project and pending approvals. Allow direct opening of an agent, mission, quest or file via search/shortcuts." | 13 §HUD | T1.11, T2.7 | T1.11 checks |
| MODE-06 | "The world should remain enjoyable even if the user spends hours in focus mode." | 13 §The three modes; 14 | T1.12 | T1.12 checks |

## Recruitment and identity (brief §5.1–5.2)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| REC-01 | "When entering the Recruitment Hall, the user sees several randomized candidate characters (suggested: 3–5). Each has a randomly generated fantasy name and a randomized appearance based on the reference's modular categories." | 06 §Candidates | T1.6 | ACC-REC |
| REC-02 | "The user can refresh the candidate pool on demand; no paid rerolls, artificial wait periods or scarce hiring currency." | 06 §Candidates | T1.6 | ACC-REC |
| REC-03 | "Candidate generation can use local deterministic name/appearance data without a provider request. Avoid duplicate names where feasible, but always use unique internal IDs." | 06 §Candidates | T1.6 | unit tests |
| REC-04 | "Inspect a candidate, assign their class and model family, select supported reasoning preferences and approved tools, optionally define specialties and instructions, and hire them." | 06 §Hiring | T1.7 | ACC-REC |
| REC-05 | "Appearance and name are random by default; optional rename or cosmetic customization may be available without changing identity." | 06 §Profile and lifecycle | T1.8 | unit tests |
| REC-06 | "The user's explicit requirement is random recruitment, so manual character construction must not be necessary for hiring. The Guild Master remains manually customizable." | 06 | T1.6 | ACC-REC |
| REC-07 | "Every new hire begins at **Level 0, XP 0** with no quest history, no code contributions, no tokens consumed, no accomplishments and no performance score." | 06 §Hiring; 11 | T1.7 | unit tests |
| REC-08 | "Do not generate fake intelligence, strength, coding aptitude or pre-earned experience. Hiring is free in game terms; actual provider usage remains subject to the user's subscription/API arrangements." | 06 | T1.7 | review |
| PRO-01 | "Immutable internal identity, created/hired timestamps, display name, appearance configuration and appearance schema version." | 02 §Adventurer | T1.6 | schema tests |
| PRO-02 | "Current class, optional specialties and role/rank; history of meaningful configuration changes." | 02 §Adventurer; 06 | T1.7 | schema tests |
| PRO-03 | "Provider/account reference, model-family binding, optional pinned version, supported reasoning effort and approved tools." | 02; 06 | T1.7 | schema tests |
| PRO-04 | "Persistent instruction profile, journal, project-specific knowledge and relevant reusable skills." | 12 | T1.7, T5.5 | T1.7 checks |
| PRO-05 | "Current availability, assigned parties/missions, active execution attempt(s), resource limits and blocked/approval state." | 02; 07 | T1.9, T3.4 | T1.9 checks |
| PRO-06 | "Level, XP, titles, achievements and actual lifetime/per-project/per-class/per-model statistics." | 11 | T2.8, T4.6 | T2.8 checks |
| PRO-07 | "Historical quests, attempts, reviews, contributions, findings, collaborations, and evidence links." | 02; 08 | T2.* | T2.* checks |
| PRO-08 | "Appearance must stay consistent across recruitment preview, dialogue, world, roster and history. Generate/cache sprite sheets when appearance or cosmetic equipment changes, rather than recomposing all sprites each frame." | 03 §Sheets and caching | T1.2 | ACC-VIS |
| PRO-09 | "A retired or archived character retains history. Resuming a quest or opening a new session with the same character must not create a new adventurer." | 06 §Profile and lifecycle | T1.8, T2.4 | unit tests |

## Classes, equipment, knowledge (brief §5.3–5.4)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| CLS-01 | "Class is the character's engineering specialty, not a claim about the model's intelligence. It determines default role instructions and recommended tools; actual permissions are enforced separately." | 06 §Classes; 12 | T1.7 | review |
| CLS-02 | "The user chooses a class during hiring rather than having it randomly assigned. Classes may evolve or be changed explicitly without erasing history." | 06 §Classes | T1.7, T1.8 | unit tests |
| CLS-03 | Class table: Warrior, Ranger, Scout, Mage, Cleric, Paladin, Artificer, Scribe, Commander, each with the "Primary work" and "Default posture" given in brief §5.3. | 06 §Classes | T1.7 | T1.7 checks |
| CLS-04 | "**Party leader is an appointment, not an exclusive class or a level requirement.** Any suitable adventurer can be appointed leader." | 09 §Leader workflow | T3.1 | unit tests |
| CLS-05 | "A Level 0 character must not be artificially prevented from leading if the user chooses it. An observer is an assignment role, often filled by a Mage or Scout, rather than another mandatory class." | 09 §Parties and formations | T3.1 | unit tests |
| EQP-01 | "Separate visual equipment from actual engineering equipment. A sword, shield, hat or staff is a cosmetic asset. An engineering loadout includes approved CLI tools, MCP servers, skills, project instructions and explicit permission scopes." | 12 §Loadout UI | T5.4 | review |
| EQP-02 | "Cosmetics never grant real access." | 12 §Invariants | T5.4 | ACC-PROG |
| EQP-03 | "An adventurer's journal records approved durable discoveries, decisions, conventions and lessons. Project knowledge must be scoped by project and authorization; do not indiscriminately carry private context from one client repository to another." | 12 §Journal | T5.5 | unit tests |
| EQP-04 | "Distinguish a provider's session context from stored Guild knowledge. Retrieve relevant notes on subsequent runs. Notes should include provenance and staleness where possible and be editable or removable." | 12 §Journal | T5.5 | T5.5 checks |
| EQP-05 | "This is retrieval and configuration, not model training or automatic increases in model intelligence." | 12 | T5.5 | review |

## Work hierarchy (brief §6)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| HIER-01 | Terms table: Guild, Kingdom, Epic, Mission, Quest, Party, Expedition, Run/attempt with the meanings given in brief §6. | glossary; 02 | T2.1–T2.4 | ACC-HIER |
| HIER-02 | "A party is associated with the mission/expedition; it is not another level of task hierarchy. A quest may have many attempts and evidence records." | 02 §Entity overview | T2.3, T3.1 | schema tests |
| HIER-03 | "A solo task is a valid expedition; avoid requiring artificial hierarchy for a tiny request (allow quick mission/quest creation)." | 08 §Quick quests | T2.5 | T2.5 checks |
| HIER-04 | "An epic stores repository/workspace configuration, default branch, instructions, optionally multiple associated repositories or workspaces if supported, linked missions, knowledge, and project statistics. Kingdom grouping is optional to reduce friction for personal projects." | 02 §Epic, §Kingdom | T2.1 | T2.1 checks |
| HIER-05 | "A mission stores the objective, context, constraints, plan, assigned party, target branch/workspace, dependencies, acceptance criteria, status and execution history." | 02 §Mission | T2.2 | schema tests |

## Quest board and lifecycle (brief §7)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| QST-01 | "The quest board is a physical object in the Guild Hall and optionally in project scenes. Press E to open a usable backlog interface styled like a quest journal." | 05; 08 §Quest board UI | T2.6 | T2.6 checks |
| QST-02 | "It supports posting, editing, prioritizing, assigning, filtering, dependency inspection, status updates, canceling and opening real work. Use readable text and standard keyboard navigation even if the surrounding art is fantasy themed." | 08 §Quest board UI | T2.6 | browser test |
| QST-03 | Quest categories table (Construction, Bounty, Reconnaissance, Investigation, Inspection, Trial, Purification, Defense, Infrastructure, Chronicle, Research) with engineering equivalents and preferred classes as given in brief §7.1. | 08 §Quest categories | T2.3 | T2.3 checks |
| QST-04 | "The fantasy type labels are proposed defaults, not mandatory jargon. Always show the actual engineering meaning." | 08 §Quest categories; agent-rules | T2.6 | review |
| QST-05 | "A quest includes its objective, scope, expected outputs, acceptance criteria, priority/difficulty, dependencies, assigned adventurer(s), observer/reviewer where relevant, workspace/base revision, approved tools and resource limits. It records all attempts, blockers, findings and evidence. Read-only quests may deliver a report instead of code or a PR." | 02 §Quest; 08 | T2.3 | schema tests |
| QST-06 | "Do not manage the workflow only through disconnected booleans or visual animations. Model quest, mission, run and party availability separately and derive visual state from them." | 08 §Two kinds of state | T2.2, T2.3 | unit tests |
| QST-07 | "Draft/proposed → posted/ready → assigned/queued → in progress → submitted for review → independently verified (when required) → accepted/completed." | 08 §Quest states | T2.3 | unit tests |
| QST-08 | "In progress can become blocked, paused, canceled or failed; resume or retry must be explicit and retain prior attempt history." | 08 §Quest states | T2.3, T2.4 | unit tests |
| QST-09 | "Review/verification can request changes, sending the quest to rework and a new attempt as appropriate." | 08 §Quest states | T2.3 | unit tests |
| QST-10 | "A prerequisite failure prevents dependent quests from starting unless explicitly resolved or overridden under the applicable policy." | 08 §Dependencies | T3.2 | unit tests |
| QST-11 | "Merge or release is a separate engineering outcome; a completed research or documentation quest need not have a PR. For a mission that requires a merge, verify the configured integration gate before marking that mission delivered." | 08 §Mission states | T2.2, T4.5 | unit tests |
| QST-12 | "State must be persisted, transitions validated, duplicate events idempotent, and failure paths observable." | 02 §Persistence; 08 | T2.3 | unit tests |
| QST-13 | "An agent's claim of completion is not sufficient by itself. Gate completion on the quest's applicable acceptance criteria and recorded evidence, such as reviewed changes, a confirmed report, test results or a user decision." | 08 §Evidence gates | T2.5 | ACC-QUEST |
| QST-14 | "Distinguish blocked, provider rate-limited, awaiting permission, canceled, failed and disconnected/unknown states." | 07; 08 §Attempt states | T1.10, T2.4 | ACC-LIVE |

## Parties and orchestration (brief §8)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| PTY-01 | "The user should be able to assign one adventurer directly, assemble a temporary party or save a persistent named party/formation." | 09 §Parties and formations | T2.3, T3.1 | ACC-PARTY |
| PTY-02 | "A formation defines roles and policies; a persistent party can retain named members and collaboration statistics." | 09 §Parties and formations | T3.1 | T3.1 checks |
| PTY-03 | "Members must be available under configured concurrency constraints. Default to one active writable assignment per adventurer, with explicit concurrency overrides where supported." | 09 §Availability and concurrency | T3.4 | unit tests |
| PTY-04 | Example formations table (Solo, Bug hunt, Feature party, Audit expedition, Major expedition) from brief §8.1. | 09 §Parties and formations | T3.1 | T3.1 checks |
| PTY-05 | "These are suggested templates, not fixed party sizes. The user should be able to choose any compatible available members. Never force a large party for a trivial task or spawn more sessions than the configured budget permits." | 09 §Availability and concurrency | T3.4 | unit tests |
| PTY-06 | "Manual command: The Guild Master posts quests, selects adventurers and controls major transitions. Delegated command: The party leader proposes plans and quests, then delegates and coordinates within the approved scope. Autonomous expedition: The party operates within a previously approved plan, permission set, budget and verification policy. Escalate new risk, scope changes, unresolved conflicts and destructive actions. The user can pause, cancel or intervene." | 09 §Orchestration modes | T3.5 | T3.5 checks |
| PTY-07 | Leader workflow (brief §8.3): "1. Discuss the mission with the Guild Master and inspect the available project context. 2. Propose a plan with small quests, scopes, dependencies, acceptance criteria, ownership and verification requirements. 3. Identify independent workstreams, assign classes/members and establish workspaces. 4. Start eligible quests when their dependencies and permissions are satisfied, subject to resource limits. 5. Collect structured reports, tool results, blockers, findings and actual code changes. Pair implementors with observers when requested. 6. Replan or propose corrective quests as needed without silently expanding scope. 7. Integrate compatible changes, resolve conflicts under explicit ownership, and run cross-quest checks. 8. Request independent verification and human approval according to policy. Deliver a concise mission report and evidence, then record outcomes and progression." | 09 §Leader workflow | T3.2–T3.6, T4.3 | ACC-PARTY |
| PTY-08 | "An orchestration engine should own task dependencies, scheduling, workspace leases, budgets, cancellation, retries and durable execution state. The leader's model supplies planning and judgment; do not let a natural-language response alone control authorization or declare success." | 09 §Scheduler | T3.4 | review |
| PTY-09 | "Provide structured application-level actions for proposing quests, assigning members, reporting blockers, submitting findings, requesting approval and submitting work. Validate actions server-side against the mission policy. Keep raw provider transcripts available for inspection." | 09 §Guild MCP tools | T3.3 | evals, unit tests |
| PTY-10 | "Approach an adventurer and press E to open a dialogue overlay with their name, class, level, model family, current quest and latest meaningful status." | 05; 13 §Dialogue overlay | T1.9 | ACC-NAV |
| PTY-11 | "Dialogue should be backed by actual recorded status; do not spend model tokens just to create ambient chatter. When the user sends a real message, it should reach the correct bound provider session or a new explicitly associated run." | 13 §Dialogue overlay | T1.9 | ACC-PROV |
| PTY-14 | "Support individual chat, party planning, quest comments, findings and guild notifications." | 02 §QuestNote; 09; 13 §Inbox and notices | T1.9, T2.6, T3.3, T2.7 | T2.6 checks |
| PTY-12 | "Agent-to-agent coordination uses persisted structured records in addition to conversation. A finding records its severity, exact location where applicable, evidence, affected revision, recommendation, and resolution status." | 02 §Finding; 09 | T3.3 | schema tests |
| PTY-13 | "Independent verification should avoid simply asking the same implementation session to grade its own work. The app should retain an evidence trail and let the user inspect or challenge findings." | 08 §Evidence gates; 10 | T3.6 | ACC-REVIEW |

## Engineering and Git (brief §9)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| GIT-01 | "The Forge is not a simulation of coding. It exposes actual source files, editing, Git, terminals, provider activity and changes." | 10 §Forge | T4.1 | ACC-ENG |
| GIT-02 | Metaphor table (Established kingdom = default/base branch, Expedition camp = worktree, …) in brief §9; "with the real technical terminology always visible." | glossary; 10 | T4.1 | review |
| GIT-09 | "For complex missions, optionally create a mission integration branch and separate quest branches/worktrees for independent writing tasks." | 10 §Integration, §Workspace leases | T4.3 | T4.3 checks |
| GIT-03 | "Each writable workspace must have clear ownership and a known base revision. Read-only explorers and reviewers can inspect a pinned snapshot or an explicitly selected worktree without requiring writable branches." | 10 §Workspace leases | T3.4, T4.2 | ACC-WS |
| GIT-04 | "Do not have multiple independent agents blindly edit the same working tree. Detect dirty state, overlapping paths, stale bases and conflicts. Provide user-controlled handoff and integration operations. Never automatically overwrite existing user changes or delete a dirty worktree." | 10 §Workspace leases | T4.2 | ACC-WS |
| GIT-05 | "Example: `main` → `mission/seller-registration` → parallel quest branches for API and UI. Integrate both into the mission branch, test the integrated result, then open or merge a PR according to user approval. This is a suggested branching strategy, not mandatory for all tasks. Existing repositories may use different conventions. Support ordinary local work and inspection-only quests without unnecessary branches." | 10 §Integration | T4.2 | T4.2 checks |
| GIT-06 | "The user should be able to see the actual file tree and open/edit files; inspect added/modified/deleted files; open unified or side-by-side diffs; see staged and unstaged changes, current branch, base revision, commits, conflicts and worktrees; access a terminal tied to the selected workspace; inspect diagnostics, tests, build output and command history; and open real pull requests where supported. Provide safe controls for reviewing, staging, committing, branch/worktree management, conflict resolution, merging and reverting, aligned with the existing provider and Git permissions. Preserve standard editing ergonomics (search, keyboard shortcuts, syntax highlighting, large readable panels) rather than forcing code into a tiny in-world dialogue box." | 10 §Forge; 00 §6 | T4.1 | ACC-ENG |
| GIT-07 | "Show the correct workspace, branch, adventurer and quest in all relevant panels. User edits can occur independently of the AI; do not attribute them to an agent." | 10 §Attribution | T4.1, T4.6 | T4.1 checks |
| GIT-08 | "Opening or inspecting a diff must never implicitly run a destructive command. Require explicit approval for destructive Git actions, sensitive credentials, production changes, external side effects and merges where configured. Avoid representing a visual animation as proof of a commit or deployment." | 10 §Merge gates | T4.2, T4.5 | ACC-CTRL |
| TST-01 | "Training Grounds shows real test executions: command, exit code, duration, relevant output, counts when parsable, failed cases and linked commit/workspace." | 10 §Training Grounds | T4.4 | ACC-REVIEW |
| TST-02 | "Distinguish not run, running, passed, failed, canceled and stale results. If code changes after verification, invalidate affected evidence or clearly show its revision. Do not infer that a whole project passed based on one test." | 10 §Evidence staleness | T4.4 | unit tests |
| TST-03 | "Test evidence, review findings and integration outcomes should be accessible from the quest/mission and from a character's profile." | 06 §Profile and lifecycle; 08 §Quest board UI | T4.4, T4.6 | T4.4 checks |

## Living NPCs (brief §10)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| NPC-01 | "An adventurer's physical behavior reflects the current real execution state whenever meaningful. Ambient wandering, sitting or resting can be cosmetic for available agents." | 07 | T1.10 | ACC-LIVE |
| NPC-02 | "Use a deterministic presentation policy when a character has multiple activities; show a count and provide a way to inspect all assignments rather than cloning the character without explanation." | 07 §Step 2 | T3.7 | unit tests |
| NPC-03 | State → presentation table in brief §10 (Available, Planning, Exploring/researching, Implementing/fixing, Reviewing, Testing, Blocked, Awaiting user approval, Provider rate-limited, Disconnected/unknown, Completed and accepted). | 07 §Step 3 | T1.10, T2.9 | ACC-LIVE |
| NPC-04 | "The app should infer activity only from actual task role/status and available provider events. If only coarse session status is available, use coarse animations rather than pretending to know what the model is thinking." | 07 §Step 1 | T1.10 | unit tests |
| NPC-05 | "NPC navigation is a presentation layer, not the scheduler: walking to the Forge does not start a real provider run by itself. Agents continue working when off-screen, when the game is paused visually, and when an editor overlay is open, subject to actual runtime availability." | 01; 07 | T1.10 | ACC-LIVE |

## Statistics and progression (brief §11)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| STAT-01 | "Track where supported: total and accepted quests, failed/canceled/blocked attempts, first-pass acceptance, rework, confirmed bugs discovered/fixed, validated review findings, verified test contributions, lines added/removed, files modified, commits, merged PRs, projects/parties participated in, active execution duration, blocked duration, input/output/cached tokens, reported or estimated cost, tokens per accepted quest, current and historical model versions, specialties and achievements." | 11 §Adventurer statistics | T2.8, T4.6 | ACC-METRIC |
| STAT-02 | "Record the source and definition of metrics. Git diff additions/deletions are not synonymous with useful output." | 11 §Metric registry | T4.6 | review |
| STAT-03 | "Count accepted work separately from attempted work and avoid double counting repeatedly edited lines, merged changes, retries or shared contributions." | 11 §Adventurer statistics | T4.6 | unit tests |
| STAT-04 | "Associate actual work with quest, workspace, revision and responsible agent when reliably available; label unattributed or mixed work instead of guessing." | 11 §Adventurer statistics | T4.6 | unit tests |
| STAT-05 | "Token and cost data vary by provider. Show unknown/unavailable when not exposed; do not treat unknown as zero. Label cost estimates and do not infer subscription quotas from context size or token totals." | 11 §Metric registry | T2.8, T4.6 | ACC-METRIC |
| STAT-06 | "Compare agents by task type, complexity, sample size and model version rather than raw volume alone." | 11 §Adventurer statistics | T4.6 | T4.6 checks |
| STAT-07 | Guild-wide, epic and party statistics in brief §11.3; "Show clear date ranges and drilldowns. Distinguish a quest-count progress percentage from an estimate of engineering effort." | 11 §Guild, epic, party statistics | T4.6 | T4.6 checks |
| STAT-08 | "The Treasury exposes actual provider statistics and configuration, including known budgets and rate-limit signals. Optional fantasy names like mana or stamina may accompany the real labels, but do not conflate context window, token count, concurrency, money or provider subscription limits. No artificial energy system should prevent the user from working." | 11 §Treasury | T4.6 | review |
| XP-01 | "All adventurers start at Level 0 and 0 XP. Award XP for accepted, evidenced work, with category-appropriate rewards: an accepted investigation, valid review finding, verified fix, accepted documentation or completed implementation can each contribute." | 11 §XP | T2.8 | unit tests |
| XP-02 | "Optional bonuses for independently verified or first-pass work should not discourage raising legitimate issues or punish hard quests unfairly. No XP solely for tokens consumed, lines written, number of tool calls or elapsed time." | 11 §XP | T2.8 | unit tests |
| XP-03 | "Use idempotent reward records so retries/reconnects cannot repeatedly award XP for the same achievement." | 11 §XP | T2.8 | unit tests |
| XP-04 | "Suggested progression (tunable, not a user-fixed formula): Level 0 novice; at milestone levels 10, 25, 50, 75 and 100 unlock cosmetic emblems, capes, accessories, titles and decorations. Retain recognizable original identity." | 11 §Levels | T5.4 | T5.4 checks |
| XP-05 | "Level should not automatically increase real permissions, change model family or claim higher intelligence. Do not lock necessary software engineering functionality behind progression." | 11 §Invariants | T2.8 | review |

## Later features (brief §12)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| LATER-01 | "Project portals and themed environments: choose a reusable biome for each epic (marketplace, academy, fortress, forest ruins), with project-specific quest board, history, party area and stats. Do not generate a new world on every launch." | 05 §Portals | T5.8 | T5.8 checks |
| LATER-02 | "Campaign map: display real quest dependencies and independent workstreams. Completing a dependency unlocks downstream work, not an unrelated arbitrary level gate." | 09 §War Room | T5.9 | T5.9 checks |
| LATER-03 | "Repository exploration: show discovered modules, entry points, relationships and knowledge gaps; mark findings stale when relevant code changes." | 12 §Library | T5.5 | T5.5 checks |
| LATER-04 | "Royal correspondence: incoming Git issues, PR requests and CI failures become letters or notices when an actual integration supplies them. User controls external access." | 13 §Inbox and notices | T5.10 | T5.10 checks |
| LATER-05 | "Chronicles: replay a mission from recorded events, decisions, tool actions, revisions and outcomes, without recreating or inventing hidden reasoning." | 11 §Milestones, Trophy Hall, chronicles | T5.6 | T5.6 checks |
| LATER-06 | "Trophy Hall: cosmetic trophies/banners for confirmed releases and milestones." | 11 §Milestones, Trophy Hall, chronicles | T5.6 | T5.6 checks |
| LATER-07 | "Personal quarters: beds, memorabilia and decorations reflecting earned history. No need for simulated hunger, injury, wages or sleep schedules." | 05; 11 | T5.4 | T5.4 checks |
| LATER-08 | "Skill trees/loadouts: organize approved instructions, tools and project specialties. Never present a cosmetic unlock as an unauthorized capability." | 12 §Loadout UI | T5.4 | T5.4 checks |
| LATER-09 | "Optional combat or minigames: reuse the supplied jump/attack animations and training dummy for fun; these must not affect real task results, provider billing, permissions or access to engineering tools." | 05 §Play | T5.11 | T5.11 checks |

## Architecture and reliability (brief §13)

| ID | Requirement (verbatim) | Design | Task | Proof |
|---|---|---|---|---|
| ARCH-01 | "The visual world should consume a read model of the underlying engineering state. It should not be the authority for quest state, execution or permissions. Maintain one source of truth across the game and editor." | 01 §Truth flows one way | T1.9 | review |
| ARCH-02 | "Agent execution belongs to the appropriate application/runtime layer, not the render loop. Persist IDs and relationships, and reconcile provider events after restart." | 01; 14 §Restart recovery | T1.9, T4.7 | ACC-RECOV |
| ARCH-03 | "Introduce only the new persistence and scheduling components genuinely needed; reuse existing facilities when appropriate. Design for local/personal use first, avoiding an unnecessary cloud backend or multiplayer infrastructure." | 01; 02 | all | review |
| ARCH-04 | "Keep new features modular enough to maintain upstream compatibility and avoid god files." | 01 §Module layout (see D-002 on upstream) | all | review |
| ARCH-05 | Entities in brief §13.1 and "Important relationships" paragraph; "The implementation should preserve invariants around ownership, attribution, idempotency and identity." | 02 | T1.6, T2.* | schema tests |
| ARCH-06 | Persistence layer responsibilities (brief §13 table): "Durable records, event identifiers, state transitions, recovery, migrations, backup/export" | 02 §Persistence, §Stream (export); 14 §Restart recovery | T1.6, T4.7 | T4.7 checks |
| PERF-01 | "The game should remain responsive while multiple coding agents are active on a normal laptop. Cache sprite sheets and static scene art, avoid expensive per-frame generation, and limit unnecessary redraws and provider requests." | 14 §Frame budget | T1.4 | perf check |
| PERF-02 | "Animation and rendering should not compete with orchestration for critical execution state. Offer reduced-motion and pause-animation options; pausing visuals does not imply pausing agents." | 14 §The game loop exception | T1.4 | T1.4 checks |
| PERF-03 | "Handle rate limits, provider disconnection, unavailable models, failed commands, rejected permissions, dirty worktrees, lost sessions and user cancellation explicitly. Never automatically retry operations with irreversible side effects without knowing whether they previously succeeded." | 14 §Failure catalogue | T1.9, T4.7 | unit tests |

## Acceptance criteria (brief §15)

These are the product-level proofs referenced above. Each increment's task file says which of them it must demonstrate.

| ID | Area | Observable acceptance criterion (verbatim) | Demonstrated in |
|---|---|---|---|
| ACC-VIS | Visual fidelity | "Characters are composed from the supplied reference's modular style and appear consistently in preview, gameplay and profiles. Native pixels remain sharp at supported window sizes." | Inc 1 |
| ACC-NAV | Player navigation | "Move, jump, approach an actual door, press E, enter a distinct room, and return at the correct door. Interactions do not trigger while typing into chat or code." | Inc 1 |
| ACC-REC | Recruitment | "Generate several candidates with random names and appearances; select a class and supported model family; hire at Level 0/0 XP. The same identity and appearance reappear after restart." | Inc 1 |
| ACC-PROV | Provider execution | "Start a real run using a configured T3 provider and the recruited adventurer's allowed family; stream actual output and show real error/permission states. An unavailable family never silently falls back to another." | Inc 1 |
| ACC-HIER | Hierarchy | "Link an actual repository as an epic; create a mission and smaller quests; trace each quest and execution back to its parent and provider session." | Inc 2 |
| ACC-QUEST | Quest lifecycle | "Assign, execute, block/resume, submit, request changes and accept a quest. Invalid transitions are prevented; attempts and evidence remain inspectable. An agent claiming success without required evidence does not complete the quest." | Inc 2 |
| ACC-PARTY | Parties | "Assemble named adventurers, appoint a leader, approve a quest plan, execute independent quests in parallel under configured limits, and honor dependencies and cancellation." | Inc 3 |
| ACC-WS | Workspace safety | "Run independent writing quests in isolated workspaces where appropriate; inspect actual Git diffs; preserve existing user changes; detect conflicts before integration." | Inc 4 |
| ACC-REVIEW | Review and tests | "An independent agent reviews or verifies work. Display actual findings, test results and associated revisions; report stale verification after relevant changes." | Inc 3 (review), Inc 4 (tests) |
| ACC-ENG | Engineering access | "Inspect/edit actual files, use a real terminal, view a diff and navigate to the appropriate conversation without mandatory walking or game progression." | Inc 1 (via focus mode), Inc 4 (Forge) |
| ACC-LIVE | Live world | "NPC status follows recorded execution state; blocked or unknown states are distinguishable. Switching scenes or presentation modes does not duplicate or terminate active sessions." | Inc 1, Inc 2 |
| ACC-METRIC | Metrics | "Accepted work, attributed lines added/removed, execution records and provider-exposed usage update the correct character, epic and guild statistics; unavailable values remain unavailable." | Inc 2 (initial), Inc 4 (full) |
| ACC-PROG | Progression | "New characters begin at zero; accepted outcomes grant XP once per reward event; failed/retried attempts do not inflate rewards; cosmetics never grant actual permissions." | Inc 2 |
| ACC-RECOV | Recovery | "Restart/reconnect without losing character identity, associations, history, or silently repeating dangerous actions. Reconcile active executions as supported by the runtime." | Inc 1 (identity), Inc 4 (executions) |
| ACC-CTRL | User control | "Pause/cancel work where supported, inspect pending approvals, reject scope changes, and take over a workspace. Actual execution boundaries remain enforced regardless of UI/class." | Inc 3, Inc 4 |

## Non-goals (brief §16)

Every task card inherits these. A change that violates one is rejected in review regardless of its other merits.

| ID | Non-goal (verbatim) |
|---|---|
| NON-01 | "No purely decorative virtual office; the primary world is side-scrolling and directly interactive." |
| NON-02 | "No game-only pretend coding, synthetic token counts, fake tests, fake Git changes, fabricated character histories or simulated provider responses presented as real." |
| NON-03 | "No replacing the reference art with unrelated characters or a 3D/isometric aesthetic." |
| NON-04 | "No paid in-game recruitment, compulsory waiting, artificial stamina restrictions, grind or mandatory combat to access software engineering tools." |
| NON-05 | "No automatic cross-family model substitution, credential duplication/leakage or bypassing provider subscription, safety, approval or concurrency limits." |
| NON-06 | "No treating an RPG class, rank, quest or leader's text as authorization to run dangerous commands or access another project's private data." |
| NON-07 | "No automatic rewriting of upstream T3 architecture without inspecting it; no unnecessary reimplementation of working provider integrations." |
| NON-08 | "No claim that character XP trains the model, increases intelligence, or measures quality simply by code volume." |
| NON-09 | "No need for multiplayer, cloud accounts, a game economy, elaborate combat or procedural world generation in the initial version." |
