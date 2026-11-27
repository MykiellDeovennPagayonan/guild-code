# Glossary: Guild term ↔ T3 term ↔ code

Use these names consistently in code, docs and UI. In UI copy, a fantasy label always appears next to its engineering meaning ([agent-rules.md](agent-rules.md) §3).

## People and identities

| Guild term | Meaning | T3 counterpart | Code identifier |
|---|---|---|---|
| Guild | The user's whole collection of adventurers, epics, parties and stats, on one environment | Environment | `GuildSnapshot`, `GuildSettings` |
| Guild Master | The user's own playable character. Never a provider session | — (the user) | `GuildMaster` |
| Adventurer | A persistent named AI character with appearance, class and model binding | — (not a thread or session) | `Adventurer`, `GuildAdventurerId` |
| Candidate | A generated, not-yet-hired adventurer in the Recruitment Hall | — | `generateCandidate(seed, index)` |
| Class | Engineering specialty with default instructions and posture; no permissions | — | `ClassId` |
| Model binding | Provider instance + model family (+ optional pinned model and options) | `ModelSelection` (`instanceId`, `model`, `options`) | `ModelBinding` |
| Model family | A group of models derived from discovery (e.g. Claude "sonnet") | none (Guild-derived) | `family.key`, e.g. `claudeAgent:sonnet` |
| Level, XP | Totals from reward events for accepted, evidenced work | — | `RewardEvent`, `xp`, `level` |

## Work

| Guild term | Meaning | T3 counterpart | Code identifier |
|---|---|---|---|
| Kingdom | Optional grouping of epics (client, company) | — | `Kingdom` |
| Epic | A software project | Project (`ProjectId`) | `Epic` |
| Mission | A major objective within an epic | Its primary thread (`ThreadId`) | `Mission` |
| Quest | A small actionable unit of work | — | `Quest`, `GuildQuestId` |
| Quest category | Fantasy label for the kind of work (Bounty = bug fix, …) | — | `QuestCategory` |
| Attempt (brief: "run/attempt") | One concrete execution of a quest (or a conversation) by an adventurer | One thread launched by Guild | `Attempt`, `GuildAttemptId` |
| Attempt turn | One provider turn inside an attempt's thread (a T3 run can contain several) | Provider turn (`ProviderTurnId`), within a run (`RunId`) | `AttemptTurn` |
| — | T3's own retry unit inside a run; **not** a Guild attempt | Run attempt (`RunAttemptId`) | `t3RunAttemptId` |
| Party | A group of adventurers working a mission | — | `Party`, `PartyMember` |
| Formation | A reusable party template (roles + policy) | — | `Formation` |
| Expedition | One coordinated execution of a mission by a party | — | `Expedition` |
| Leader | An appointed party role, not a class | — | role `leader` |
| Evidence | A revision-pinned record that a criterion is met (diff, commit, PR, test run, report, verdict, user decision) | Checkpoints, PRs (sources) | `Evidence`, `EvidenceKind` |
| Finding | A structured review result (severity, location, evidence, recommendation) | — | `Finding` |
| Guild approval | A decision the user must make (plan, scope change, override, merge gate, …) | Separate from T3 runtime requests | `GuildApproval` |
| Permission prompt | A provider asking to run a command or edit a file | Runtime request (`pendingRuntimeRequest`) | T3 types |
| Lifecycle state | Stored state of a quest/mission/attempt, changed by validated commands | — | `QuestStatus`, `AttemptStatus`, `MissionStatus` |
| Live state | Derived real-time state of an attempt's thread (working, awaiting approval, rate-limited…) | Thread shell status | `deriveAttemptLiveState` |
| Guild briefing | The visible labelled block at the top of an attempt's first message | Initial message text | — |

## Engineering metaphors (brief §9)

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
| Workspace lease | Guild's record of who may write a worktree |

## World

| Term | Meaning | Code identifier |
|---|---|---|
| Scene / room | A side-view level connected by doors | `SceneDef`, `SceneId` |
| Door | A paired transition between scenes | `DoorDef` |
| Interactable | An object E or a click acts on (quest board, workbench…) | `InteractableDef` |
| NPC slot | A named spot where adventurers sit, stand or work | `NpcSlotDef` |
| Presentation model | What each NPC shows, derived from real state | `NpcPresentation` |
| Sheet | All poses of one appearance, cached | `buildSheetFrames`, `sheetCache` |
| Adventure / Hybrid / Focus mode | Full world / world + working panel / normal T3 UI | route `/guild`, T3 routes |
| HUD | Compact status bar (active, needs you, rate-limited, connection) | — |

For T3's own vocabulary (environment, project, thread, turn, provider, checkpoint…) see [docs/internals/00_glossary.md](../internals/00_glossary.md).
