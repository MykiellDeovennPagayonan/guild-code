# 01 — Architecture

> Status: Draft v1 (2026-11-27). Applies to all increments. Decisions D-001…D-006 in [decisions.md](../decisions.md) are made here.

## Purpose

Where Guild's code lives, how data flows between T3, the Guild domain, and the game world, and the rules that keep the world an honest view of real work.

## Read first

1. [../README.md](../README.md), [../decisions.md](../decisions.md).
2. [00_foundation-audit.md](00_foundation-audit.md) (what T3 already does, with file paths).
3. T3's own [docs/internals/01_architecture.md](../../internals/01_architecture.md) and [02_effect-services.md](../../internals/02_effect-services.md).

## Requirements covered

T3-01, T3-02, T3-05, ARCH-01, ARCH-02, ARCH-03, ARCH-04, MODE-04, NPC-05, PERF-02.

## Non-negotiables (from the brief)

- "The visual world should consume a read model of the underlying engineering state. It should not be the authority for quest state, execution or permissions. Maintain one source of truth across the game and editor." (ARCH-01)
- "Agent execution belongs to the appropriate application/runtime layer, not the render loop." (ARCH-02)
- "Introduce only the new persistence and scheduling components genuinely needed; reuse existing facilities when appropriate." (ARCH-03)
- "Continue provider execution independently of scene transitions, open panels, window focus and rendering." (T3-05)

## Design

### The layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│ apps/web/src/guild            GUILD PRESENTATION                         │
│   engine/   canvas loop, input, camera, scenes, player physics, NPC      │
│   world/    room definitions (data), doors, interactables                │
│   ui/       React overlays: creator, dialogue, quest board, HUD, panels  │
│   render/   sheet cache + worker, pixel-perfect display helpers          │
│   state/    presentation model derived from the read model               │
├──────────────────────────────────────────────────────────────────────────┤
│ packages/client-runtime/src/state/guild*.ts   GUILD CLIENT STATE         │
│   atoms over the guild stream + T3 thread shells; guild RPC commands     │
├──────────────────────────────────────────────────────────────────────────┤
│ packages/contracts/src/guild*.ts              WIRE CONTRACTS             │
│   Effect Schemas: entities, commands, stream items, RPC definitions      │
├──────────────────────────────────────────────────────────────────────────┤
│ packages/guild-core     PURE DOMAIN RULES (no I/O)                       │
│   state machines, name generator, family resolution, XP rules,           │
│   NPC presentation policy, dependency graph checks                       │
│ packages/guild-art      PURE SPRITE SYSTEM (no DOM)                      │
├──────────────────────────────────────────────────────────────────────────┤
│ apps/server/src/guild   GUILD DOMAIN + ORCHESTRATION (Effect services)   │
│   GuildStore      SQL repository (tables from migration 120+)            │
│   GuildService    commands, validation, guild stream                     │
│   GuildRunBridge  links runs to T3 threads; reacts to orchestration      │
│                   events (run status, usage, errors)                     │
│   GuildScheduler  quest dependencies, budgets, leases (Increment 3)      │
│   GuildEvidence   evidence records, staleness (Increments 2–4)           │
│ apps/server/src/mcp/toolkits/guild   Guild MCP tools (Increment 3)       │
├──────────────────────────────────────────────────────────────────────────┤
│ T3 (unchanged where possible)                                            │
│   OrchestratorV2, ThreadLaunchService, delegate_task, ProviderSession…,  │
│   worktrees, checkpoints, diffs, terminal, PRs, usage, approvals         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Truth flows one way

This is the single most important rule in Guild.

1. **Real state lives on the server.** T3 owns threads, runs, sessions, approvals, worktrees and diffs. Guild owns adventurers, quests, parties, evidence and rewards. Both persist in the server's SQLite database.
2. **Clients receive read models over the websocket.** The guild stream (Guild entities) plus T3's existing shell stream (thread status) are the inputs.
3. **The client derives a presentation model** with pure functions from `packages/guild-core` (for example `presentAdventurer(adventurer, runs, threadShells) → NpcPresentation`). This decides which room an NPC is in, which clip plays, which marker shows. It is recomputed when inputs change, not per frame.
4. **The engine renders the presentation model.** It owns only presentation state: positions, facing, current clip frame, camera, particles, which overlay is open.
5. **User actions go back as commands.** Hiring, assigning, approving, sending a message: overlays call guild or T3 RPC commands. The server validates, persists, and the change flows back through step 2.

Consequences:

- The engine never writes domain state and never calls a provider. An NPC walking to the Forge is decoration; it does not start work (NPC-05).
- Closing the world, switching rooms, switching modes or reloading the page changes nothing on the server (MODE-04, T3-05). Work continues because it never depended on the client.
- If the client is disconnected, the world shows "unknown/offline" for live state (07_npc-status-mapping.md) rather than guessing.

### Why Guild has its own tables (decision D-003)

T3's orchestrator is built around threads: every command must resolve to a `ThreadId` and is serialized under that thread's lock (`apps/server/src/orchestration-v2/Orchestrator.ts:646-730`, `ThreadCommandExecutor.ts:8-28`), and the event log keeps one day of history (`ProjectionMaintenance.ts:55`). Guild entities (adventurers, quests, parties) are not threads, and Guild needs permanent history (attempts, rewards, configuration changes).

So Guild follows the precedent T3 already uses for non-thread domains: plain SQL tables owned by a repository service, with their own stream to clients. Precedents: workflows (`apps/server/src/persistence/Migrations/110_Workflows.ts`, idempotency key index), scheduled tasks (`ScheduledTaskService.subscribeList`, `apps/server/src/scheduledTasks/ScheduledTaskService.ts:275`), issue tracker bindings (`persistence/IssueTrackerBindings.ts`).

Guild does **not** add new thread commands or events to `OrchestratorV2` unless a feature truly needs thread-level atomicity. Where Guild needs to act on a thread (start a run, send a message, cancel), it calls T3's existing services (`ThreadLaunchService`, thread management, `delegate_task` machinery) exactly as workflows and scheduled tasks do.

Details of tables, history and idempotency are in [02_domain-model.md](02_domain-model.md).

### How Guild drives real work

Guild runs real provider work by launching and messaging ordinary T3 threads:

| Guild action | T3 mechanism | Precedent |
|---|---|---|
| Talk to an adventurer / "give orders" (Increment 1) | Launch a thread with the adventurer's bound provider instance and model; later messages go to the same thread | `ThreadLaunchService.launch` as used by `WorkflowAgentThreads.ts:209-224` and `ScheduledTaskService.ts:1126-1150` |
| Mission (Increment 2) | One primary thread, created with the mission (T3-03) | — |
| Quest attempt (Increment 2–3) | A new thread per attempt, launched by Guild (app-level orchestration, T3-06), linked to the mission and quest by Guild's own tables | Workflows launch step threads the same way |
| Party leader delegating (Increment 3) | The leader's thread calls **Guild MCP tools** (propose quests, assign, report); Guild's scheduler launches member threads. The leader does not call `delegate_task` directly for Guild work | `apps/server/src/mcp/toolkits/*` |
| Cancel / pause | T3 interrupt and stop on the linked thread | `task_cancel` path in `OrchestratorMcpService.ts:3119-3330` |

`GuildRunBridge` watches T3's domain events for threads it launched (the same way `DelegatedTaskQuestionReactor` listens, `DelegatedTaskQuestionReactor.ts:250-275`) and records into Guild's tables what Guild must keep permanently: run status transitions, the exact model used, token usage when available, errors, and completion. Because T3's event log expires after a day, anything Guild needs for history is copied into Guild's run record when it happens.

### Module layout and ownership (decision D-001)

| Path | Contains | Notes |
|---|---|---|
| `packages/guild-art/` | Sprite system, parts, poses, props, appearance codec, PNG render script | Pure, no DOM. See [03](03_sprite-system.md). |
| `packages/guild-core/` | State machines, name generator, family resolution helpers, XP rules, presentation policy, dependency graph | Pure, no I/O, no Effect services. Used by server and web. Subpath exports, no barrel, like `packages/shared`. |
| `packages/contracts/src/guild.ts` (+ `guildRpc.ts` if large) | Effect Schemas for Guild entities, commands, stream items, RPC group | Wire changes only here (root AGENTS.md *Contracts*). |
| `packages/client-runtime/src/state/guild.ts` | Guild stream atoms and `createEnvironmentRpcCommand` commands | Mobile won't use it, but shared client state belongs here per repo convention. |
| `apps/server/src/guild/` | `GuildStore`, `GuildService`, `GuildRunBridge`, later `GuildScheduler`, `GuildEvidence` | Effect services with `Effect.fn("GuildService.operation")`. Thin RPC handlers in `ws.ts`. |
| `apps/server/src/persistence/Migrations/120_Guild*.ts` … | Guild tables | Registered in `persistence/Migrations.ts`. |
| `apps/server/src/mcp/toolkits/guild/` | Guild MCP tools (Increment 3) | Follow `McpToolAccess` declarations; evals required. |
| `apps/web/src/guild/` | Engine, world, overlays, render, presentation | Non-React engine classes; React only for overlays and the host component. |
| `apps/web/src/routes/_chat.guild.tsx` | The Guild route | See [13](13_presentation-modes.md). |

Even though upstream merges are off (U-003), keep Guild in these modules (ARCH-04, "avoid god files"). Edit T3 files only where Guild must hook in (route registration, command palette entries, keybinding contract, ws handler registration, `server.ts` wiring, shell fields if a status signal is missing). Each such edit is small and listed in the task card that makes it.

### Web engine structure

React Compiler is on and `useEffect` needs a reason comment (`apps/web/vite.config.ts:318`, rule `t3code/no-unreasoned-state-sync`). So the game is plain TypeScript classes outside React:

- `GuildEngine` (one instance per mounted world view): owns the canvas, the loop, the current scene, input, camera and entity list. Methods: `mount(canvas)`, `unmount()`, `setPresentation(model)`, `openScene(id, entry)`, `setMode(mode)`, `setInputEnabled(bool)`.
- The React host component creates the engine once, passes it the canvas element, and pushes new presentation models when atoms change. That is one effect with a reason comment ("binds the canvas engine to the DOM node and presentation atoms"), which is the legitimate external-system sync the rule allows.
- Overlays are React components rendered over the canvas. The engine emits typed events (`interact`, `doorEntered`, `escape`) that the host maps to overlay state.

Details: [05_world-and-rooms.md](05_world-and-rooms.md), [13_presentation-modes.md](13_presentation-modes.md), [14_performance-and-reliability.md](14_performance-and-reliability.md).

### Surfaces (decision U-004, U-007)

- **Web and desktop**: full Guild.
- **Mobile**: no Guild UI. Mobile must keep working: any contract change must stay optional for mobile clients, and `vp run check:changed` must pass for `apps/mobile` when shared packages change.
- **Remote access**: not a requirement now (U-007). Guild data still travels over the normal websocket contracts, so remote clients would work later without redesign. Do not add any local-only shortcut (direct file reads from the client, localhost URLs) that would block it.

## Invariants

1. The engine has no write path to domain state except user-initiated commands.
2. No provider request is ever made from the client for Guild purposes, and no model tokens are spent on ambient world behaviour (PTY-11).
3. Every Guild-launched thread is recorded in Guild's tables with its adventurer, quest/attempt (if any), provider instance and model before the first turn starts.
4. Guild history is never deleted by T3's event retention: anything Guild reports later is stored in Guild tables.

## Failure and reverse states

- Server restart: Guild tables persist; `GuildRunBridge` reconciles open runs on startup against T3's recovered thread state (14 §Recovery).
- Client reconnect: the guild stream resynchronises from a snapshot, like the shell stream.
- A Guild-launched thread deleted by the user in focus mode: the run record keeps its history and is marked `thread_deleted`; the adventurer is unaffected.

## Out of scope

- A separate Guild backend, cloud sync or multiplayer (NON-09).
- Rewriting T3's orchestrator, providers or adapters (NON-07).

## Acceptance checks

1. A code search shows no import of server or RPC clients inside `apps/web/src/guild/engine/`.
2. Closing the Guild route while a Guild-launched run is working leaves the run working (verified in the app and by checking the thread in focus mode).
3. Restarting the server keeps every adventurer and run record (Increment 1 restart check, 06 and 14).

## Open questions

None.
