# 13 — Presentation modes, HUD and direct access

> Status: Draft v1 (2026-11-27). Increment 1 (route, adventure + focus, HUD, dialogue, palette, basic hybrid), 2 (inbox), 5 (hybrid polish, correspondence). Decision D-023 is made here.

## Purpose

The three ways to use Guild (Adventure, Hybrid, Focus), how switching between them is safe, the always-visible status HUD, the dialogue overlay, and every shortcut that makes engineering work reachable without walking.

## Read first

1. [01_architecture.md](01_architecture.md) §Truth flows one way, §Web engine structure.
2. [05_world-and-rooms.md](05_world-and-rooms.md) §Input focus, §Interaction.
3. [00_foundation-audit.md](00_foundation-audit.md) §7 (routing, panels, keybindings, lint).

## Requirements covered

VIS-05, PIL-06, T3-01, T3-08, MODE-01…MODE-06, NAV-10, PTY-10, PTY-11, LATER-04, ACC-ENG, ACC-LIVE.

## Non-negotiables (from the brief)

- "All modes share the same underlying data and execution state. Switching modes or rooms must not duplicate a provider session, cancel work, reset characters or lose unsaved edits." (MODE-04)
- "Keep a compact global status HUD for active agents, blockers, current project and pending approvals. Allow direct opening of an agent, mission, quest or file via search/shortcuts." (MODE-05)
- "All essential engineering operations must also be reachable directly without mandatory traversal, combat, waiting or progression." (PIL-06)
- "Never make a user walk through several scenes to answer an urgent approval request." (NAV-10)

## Design

### The three modes (MODE-01…MODE-03)

| Mode | What you see | Where |
|---|---|---|
| **Adventure** | Full-window world canvas, overlays on top, HUD | `/guild` route, sidebar hidden (`AppSidebarLayout` `showSidebar={false}`) |
| **Hybrid** | World on the left, a working panel on the right: an adventurer's conversation (embedded `ChatView`), a quest, a diff, files or a terminal | `/guild?panel=<kind>&thread=<id>` (search params), resizable split |
| **Focus** | The normal T3 interface, unchanged, plus small Guild additions (HUD chip, palette entries, Guild pages) | All existing T3 routes; Guild pages under `/guild/*` that render as normal pages |

Route (decision D-023): `apps/web/src/routes/_chat.guild.tsx` (under `_chat` for the auth guard), with child pages `_chat.guild.board.tsx`, `_chat.guild.roster.tsx`, `_chat.guild.adventurer.$id.tsx`, `_chat.guild.missions.$id.tsx`, `_chat.guild.council.tsx`, `_chat.guild.treasury.tsx` added in the increments that need them. Register `/guild` in `components/sidebar/mainAppLocation.ts` as a utility page so the sidebar and back navigation behave like Workflows and Usage.

**Focus mode is T3.** Guild never removes or restyles T3 views (T3-01, T3-08). Guild threads are ordinary threads in the sidebar, titled `<Name> · <task>`.

### Switching safely (MODE-04)

- Modes are views over the same atoms and server state. Switching unmounts or mounts the canvas only; no command is sent.
- The engine pauses its loop when hidden and resumes when shown (14). Real work is unaffected because it never ran on the client (01).
- **Unsaved edits**: the composer draft store and file save sessions are T3's and survive navigation already. Hybrid mode embeds the same components, so drafts follow the thread. A browser test types into the embedded composer, switches to focus mode and back, and checks the draft is intact.
- The world restores the Guild Master's scene and door on return (05).
- A keybinding toggles Guild ↔ the last focus-mode location (§Keybindings).

### HUD (MODE-05)

A compact bar along the top of Adventure and Hybrid modes, and a single **Guild chip** in focus mode (in the app header/sidebar footer area) that expands into the same content:

- **Current epic** (project) picker.
- **Active**: number of adventurers working; click for a list with live states.
- **Needs you**: count of approvals + questions + blocked quests + failed attempts. Click opens the **Council** overlay directly at the first item, from any room or mode (NAV-10). It never requires walking.
- **Rate-limited**: count with the next reset time, when any.
- **Connection**: live / reconnecting / offline (07 §unknown).
- Quick buttons: Quest board, Roster, Command palette, Mode toggle.

The HUD reads only the guild snapshot and the shell stream (cheap) and renders as normal HTML over the canvas, using T3 UI primitives.

### Direct access (PIL-06, NAV-10)

Every Guild function is reachable without the world:

- **Command palette** entries (added inline in `apps/web/src/components/CommandPalette.tsx` like `action:workflows`): "Open Guild", "Quest board", "New quick quest", "Roster", "Recruit adventurers", "Council: pending approvals", "Treasury", "Go to <room>" (fast travel: teleports the Guild Master with a fade), and search results for **adventurers, missions and quests by name** that open their page or dialogue. Files are already searchable in T3's palette.
- **Fast travel**: "Go to <room>" in the palette and a map button in the HUD; the corridor door signs show live counts.
- **Links**: every Guild entity has a focus-mode page URL; every attempt links to its thread.

### Keybindings

Keybinding commands are a closed contract union (00 §7). Add:

- `guild.toggle`: open Guild / return to focus mode. Default `mod+shift+g`.
- `guild.questBoard`: open the quest board. Default unbound.

Each needs the contract entry (`packages/contracts/src/keybindings.ts`), a default in `packages/shared/src/keybindings.ts`, and a label in `apps/web/src/components/settings/KeybindingsSettings.logic.ts`. In-world keys (A/D, Space, E, J, Esc) are not keybinding commands; they are engine input (05) and are not remappable in v1.

### Dialogue overlay (PTY-10, PTY-11)

Opened by E or a click on an adventurer, or from the roster/palette:

- Header: animated portrait (sheet `i0` cell scaled ×4), name, class and emblem, `Level N`, model family (and pinned model), availability.
- **Current**: primary attempt's quest and live status line (07), with "×N other assignments" expandable into the full list.
- **Latest meaningful status**: the most recent of: last assistant message preview (from the shell's `latestVisibleMessage` when present, else "Open conversation to read"), latest blocker, finding or submission. Never generated text; no model tokens are spent to fill it (PTY-11).
- **Actions**: Give orders / Continue (06), Open conversation (hybrid or focus), View changes (diff), Read report, Profile, Assign to quest, Ask for clarification (sends a message to the primary attempt's thread). Messages are sent to the correct bound thread through T3's `message.dispatch`, or start a new explicitly associated attempt (PTY-11).
- Esc closes. World input is off while the dialogue has a text field focused.

### Inbox and notices (Increment 2; LATER-04 in Increment 5)

- The **Guild Hall bell** and the HUD's "Needs you" open the **inbox**: needs-the-user items (approvals, questions, blocked, failed), recent submissions awaiting review, recent acceptances. Derived from state; dismissing a "recent" item stores a per-item seen marker.
- T3's own desktop notifications already fire for Guild threads (they are normal threads, 00 §2); Guild does not add a second notification for the same event. Guild-only events (plan proposed, finding filed, quest submitted) use the same notification path with the adventurer's name.
- **Royal correspondence** (Increment 5, LATER-04): when T3's issue tracker or PR integrations supply incoming issues, PR review requests or CI failures, they appear as letters on a notice board in the Guild Hall, each convertible into a quest. Only integrations the user has enabled in T3 feed it.

### Hybrid mode details (Increment 1 basic, Increment 5 polish)

- Increment 1: Hybrid shows one embedded conversation (the selected adventurer's attempt thread) using the `WorkflowThreadPane` pattern. The split is resizable; the world scales to whole pixels (05 §Viewport).
- Increment 4–5: the panel can show any right-panel kind (diff, files, terminal, PR) for that thread, a quest detail, or the board; the selected adventurer is highlighted in the world; clicking another NPC switches the panel.

## Invariants

1. No mode switch sends a command or changes server state.
2. Every Guild function is reachable from focus mode or the command palette.
3. Approvals are reachable in one action from anywhere.
4. Focus mode remains the unmodified T3 interface plus additive Guild entry points.

## Failure and reverse states

- Every overlay closes with Esc; every mode switch has its reverse.
- If the Guild route fails to load (e.g. a bug in the engine), focus mode is unaffected; the HUD chip shows "Guild unavailable" with the error.

## Out of scope

- Mobile Guild UI (U-004).

## Acceptance checks

1. From focus mode, open an adventurer's conversation, diff and a file in two actions or fewer using the palette (ACC-ENG).
2. Switching Adventure → Focus → Hybrid while an attempt is running: the thread keeps running, no new thread is created, the composer draft survives (ACC-LIVE).
3. With a pending approval, the HUD badge opens the Council at that approval from inside the Barracks (NAV-10).
4. The dialogue shows only recorded status; with no messages it says so instead of inventing text.

## Open questions

None.
