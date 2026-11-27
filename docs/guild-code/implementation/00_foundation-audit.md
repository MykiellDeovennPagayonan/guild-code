# 00 — Foundation audit: what T3 already provides

> Status: Audit of the checkout at commit `2e90f75413` (2026-11-27). Increment: all. Satisfies T3-09.

## Purpose

The brief says to inspect T3 before committing to integration choices (T3-09). This is that inspection: for each capability the brief needs, what T3 already has, where it lives, and the gaps Guild must fill. Design docs build on this file; implementers check it before relying on T3.

## How to read the markers

- **checked**: the orchestrator re-read the cited source while writing this doc.
- **reported**: an audit agent read the cited source; the citation is specific. Open the file before you build on it (it takes a minute and catches drift).
- **unconfirmed**: searched but not proven either way. Verify before relying on it, then update this file.

Paths are repo-relative. Line numbers drift; search for the named symbol if a line is off.

## Summary: capabilities vs gaps

| Brief needs                                             | T3 has                                                                                                                                           | Gap for Guild                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Real provider sessions, streaming, approvals            | Yes: 11 drivers, provider instances, sessions, runtime requests                                                                                  | None; reuse as is                                                                        |
| Persistent identities across sessions                   | Threads persist; nothing like an "agent identity"                                                                                                | **Adventurer entity** (new)                                                              |
| Model family binding, no fallback, exact model recorded | `ModelSelection`, per-turn executed model; **no family concept**; an automatic **fallback** exists for new threads without an explicit selection | **Family resolution** (new); always pass explicit selection; detect executed-model drift |
| Epics = projects, missions = threads                    | Projects (`workspaceRoot`), threads                                                                                                              | Guild records wrapping them                                                              |
| Quests, attempts, evidence, state machines              | Runs, attempts, statuses on threads; no work-item concept                                                                                        | **Quests, attempts, evidence** (new)                                                     |
| Application-level orchestration                         | `delegate_task` child threads, workflows, scheduled tasks, `ThreadLaunchService`                                                                 | **Guild scheduler** with dependencies and budgets (new)                                  |
| Structured agent actions                                | MCP server with ~90 tools and strict access declarations                                                                                         | **Guild MCP toolkit** (new)                                                              |
| Worktrees, diffs, Git, PRs, terminal, editor            | All present                                                                                                                                      | Ownership/lease layer and attribution (new, thin)                                        |
| Test evidence                                           | **None** (only PR CI checks)                                                                                                                     | **Evidence records** (new)                                                               |
| Token usage, cost, rate limits                          | Per-turn token usage, transcript cost scanning, usage-limit windows                                                                              | Per-adventurer aggregation (new)                                                         |
| Status for NPCs                                         | Rich thread shell status and turn item types                                                                                                     | Presentation mapping (new)                                                               |
| Notifications                                           | Thread notification coordinator, dock badge                                                                                                      | Guild inbox reuses it                                                                    |
| Persistence and recovery                                | SQLite, migrations, event store with **1-day retention**, startup reconciliation                                                                 | Guild tables (new) with permanent history                                                |
| Canvas game, pixel rendering                            | **None**                                                                                                                                         | Engine (new)                                                                             |

## 1. Orchestration and persistence

- **Command → event → projection → outbox → worker.** `OrchestratorV2` (`apps/server/src/orchestration-v2/Orchestrator.ts:575`); decisions are the `switch (command.type)` in `dispatchOnce` (`Orchestrator.ts:16112`). `EventSink.commitCommand` commits receipt, events, projections and outbox in one transaction (`EventSink.ts:788-880`). The `EffectWorker` runs outbox effects (`EffectWorker.ts:165-748`). _reported_
- **Every command maps to a thread** via `commandThreadId` (`Orchestrator.ts:646-730`) and runs under that thread's lock (`ThreadCommandExecutor.ts:8-28`). _reported_. This is why Guild entities are not modelled as orchestrator aggregates (01 §Why Guild has its own tables).
- **Idempotency.** `orchestration_command_receipts` keyed by `command_id`; a repeated command replays the stored result (`Orchestrator.ts:16666-16679`). _reported_
- **Event retention is one day**: `RETAINED_EVENT_HISTORY = Duration.days(1)` (`apps/server/src/orchestration-v2/ProjectionMaintenance.ts:55`). _checked_. Projections cannot be rebuilt from the log; Guild must copy anything it needs permanently.
- **Side-domain tables precedent.** Plain SQL tables with a repository service and their own client stream: workflows (`persistence/Migrations/110_Workflows.ts`, idempotency key index at :37), scheduled tasks (`scheduledTasks/ScheduledTaskService.ts:275` `subscribeList`), issue tracker bindings (`persistence/IssueTrackerBindings.ts:37-113`), PR review guides (`persistence/PullRequestReviewGuides.ts:22-87`). _reported_
- **Migrations.** One file per migration `persistence/Migrations/NNN_Name.ts`, registered in `persistence/Migrations.ts` (`migrationEntries`). Latest is `119_WorkflowRunSubject.ts`; **Guild starts at 120**. _checked_
- **Restart recovery.** `ProviderRuntimeRecoveryService.reconcile("startup")` cancels non-terminal runs and expires pending requests (`ProviderRuntimeRecoveryService.ts:1094-1180`); optional auto-continue after update (`RestartContinuation.ts:170`). _reported_. Guild's run records must reconcile against this (14 §Recovery).
- **Unconfirmed:** whether each migration runs in its own transaction; whether `dispatchOnce` is exhaustiveness-checked.

## 2. Threads, projects, and status signals

- **Thread record** `OrchestrationV2AppThread` (`packages/contracts/src/orchestrationV2.ts:501-604`): `id`, `projectId`, `title`, `providerInstanceId`, `modelSelection`, `runtimeMode`, `interactionMode`, `branch`, `worktreePath`, `lineage`, `delegatedFrom?`, `workflowRun?`, timestamps for archive/settle/snooze/delete. _reported_
- **Lineage** `{parentThreadId, relationshipToParent: fork|subagent, rootThreadId, sideChat?, workflowStep?}` (`orchestrationV2.ts:189-196`); `isListedThreadLineage` hides subagents, side chats and workflow steps from thread lists (`:203-206`). _checked_. Precedent for tagging threads by origin: `workflowRun` (`:521`). _checked_
- **Project** `OrchestrationProjectShell` (`packages/contracts/src/orchestrationProject.ts:8-30`): `id`, `title`, `workspaceRoot`, `repositoryIdentity?`, `defaultModelSelection`, `scripts`, `trackedFolders?`. One active project per workspace root (`ProjectCommands.ts:130-136`). _reported_
- **Status values** (all in `orchestrationV2.ts`) _reported_:
  - Run: `preparing | queued | starting | running | waiting | completed | interrupted | failed | cancelled | rolled_back` (:719-730).
  - Shell thread status: `idle` + run statuses (:2391-2394); `activityRunStatus` (:2450-2452); `blockedOnThreadWait` (:2453).
  - Provider session: `starting | ready | running | waiting | stopped | error` (:1115).
  - Errors: `lastErrorClass` ∈ `usage_limit | provider_error | transport_error | permission_error | validation_error | unknown` (:1725-1732); `usageLimitResetAt` (:2458); `limitRecovery` (:2484).
  - Pending request summary `pendingRuntimeRequest {kind, blocking?, userOnly?}` (:2397-2405); kinds `command | file-read | file-change | mcp-elicitation | permission | dynamic_tool_call | user_input | auth_refresh`.
- **Activity detail** is only on the per-thread detail stream: turn item types `command_execution` (command text), `file_change` (paths), `file_search`, `web_search`, `reasoning`, `assistant_message`, `dynamic_tool`, `approval_request`, `user_input_request`, `todo_list`, `subagent`, `error` (`orchestrationV2.ts:1914-2150`). Reads appear as `dynamic_tool`; `classifyToolActivity` buckets tools into `command | read | file_change | search | other` (`packages/shared/src/toolActivity.ts:273`). _reported_
- **Provider differences:** Cursor never reports approvals or structured questions (`packages/provider-cursor/src/server/adapter.ts:134-146`); Codex emits no `file_search`; ACP agents depend on the agent sending tool `kind`. Grok, Kiro, Fx, Antigravity capability flags are _unconfirmed_.
- **Summary status function:** `resolveSidebarThreadStatus` → `approval | input | request | preparing | working | waiting | failed | limited | ready` (`apps/web/src/components/Sidebar.logic.ts:964`). _checked_. It lives in `apps/web`; Guild's presentation policy should move or mirror its priority order in `packages/guild-core` with a test that the two agree.
- **Streams and cost:** `orchestration.subscribeShell` carries every thread's shell cheaply; `orchestration.subscribeThread` is per thread and heavy (`orchestrationV2.ts:4130-4131`, perf doc `docs/internals/16_performance-regressions.md`). _reported_
- **Client state:** atoms in `apps/web/src/state/entities.ts` (`useThreadStatus`, `useQuietThreadShell`, `useThreadVisibleTurnItems`) over `packages/client-runtime` factories. _reported_

## 3. Launching and controlling threads

- **`ThreadLaunchService.launch(input)`** (`apps/server/src/orchestration-v2/ThreadLaunchService.ts:243`, implementation `:1445`). _checked_. Input `OrchestrationV2ThreadLaunchInput` requires `commandId`, `projectId`, `title`, **explicit `modelSelection`**, `runtimeMode`, `interactionMode`, `workspaceStrategy`, optional `initialMessage` and `threadId` (`orchestrationV2.ts:4181-4202`). _checked_
- **Workspace strategy:** `root | existing_worktree | worktree{baseRef, branch?, startFromOrigin?, repositories?}` (`orchestrationV2.ts:786-800`); worktree creation and naming in `ThreadLaunchService.ts:704-965` and `vcs/GitVcsDriverCore.ts:6604-6640`. _reported_
- **Precedents for app-launched threads:** workflow agent steps (`apps/server/src/workflows/WorkflowAgentThreads.ts:209-224`) and scheduled tasks (`ScheduledTaskService.ts:1126-1150` launch, `:1086-1121` send to bound thread). _reported_
- **`creationSource`** literals: `web | mobile | mcp | provider | server` (`orchestrationV2.ts:103-109`). _checked_. Guild-launched threads use `server`.
- **Mid-thread model change** is allowed (`thread.model-selection.set`, `orchestrationV2.ts:3602-3605`) and agents can change options themselves (`ProviderAdapter.ts:123-132`). _reported_. Guild must detect a model change on an adventurer's thread (06 §Family drift).

## 4. Delegation, MCP and workflows

- **MCP transport:** HTTP `/mcp` with a per-session bearer token bound to `{threadId, providerSessionId, providerInstanceId, subagent}` (`apps/server/src/mcp/McpSessionRegistry.ts:122-152`; issued in `ProviderSessionManager.ts:616-696`). Every main adapter injects it (Claude, Codex, Cursor, OpenCode, Muse, Pi; ACP via a stdio bridge). _reported_
- **Adding a tool:** schemas in `packages/contracts`, `Tool.make` in `apps/server/src/mcp/toolkits/<name>/tools.ts`, handlers wrapped in an `McpToolAccess` declaration (mandatory), registration in `McpHttpServer.ts` `layerTools`, exposure predicates in `McpInvocationContext.ts`, deferred unless in `McpToolExposure.ts` `DIRECT_TOOLS`, context budget `apps/server/src/provider/agentContextBudget.json`, evals in `evals/mcp-tool-use/cases/`. Raw registration is forbidden by lint `t3code/no-raw-mcp-registration`. _reported_
- **`delegate_task`:** creates a child thread (`lineage.relationshipToParent: "subagent"`) in the parent's project, optional fresh worktree from the parent's HEAD, provider/model resolved by `resolveTarget` (`OrchestratorMcpService.ts:1705-1849`), results delivered to the parent by a wake message, cancellation cascades (`:3119-3330`). Children's modes can never exceed the parent's (`delegatedTaskModes.ts:39-91`). **No concurrency or nesting-depth cap found** (_unconfirmed_ beyond search). _reported_
- **Workflows:** durable on Effect's cluster workflow engine with SQL storage; agent steps are ordinary threads tagged `workflowRun` (`apps/server/src/workflows/`). Labs feature. _reported_. Guild does not build on workflows (decision D-010) but copies their launch pattern.
- **Scheduled tasks:** prompts on a schedule; idempotent by fire key (`ScheduledTaskService.ts:977-1200`). _reported_

## 5. Providers, models and usage

- **Drivers:** codex, claudeAgent, cursor, grok, fx, opencode, antigravity, kiro, pi, muse, acpRegistry (`apps/server/src/provider/builtInDrivers.ts:33-45`). Routing is by **provider instance** (`ProviderInstanceId`), each with its own config and credentials (`packages/contracts/src/providerInstance.ts:75-82`). _reported_
- **Models:** `ServerProviderModel {slug, name, shortName?, subProvider?, aliases?, isDefault?, isLegacy?, capabilities}` (`packages/contracts/src/server.ts:78-93`); reasoning effort is a `select` option with `role: "reasoning"` (`packages/contracts/src/model.ts:24-35`). Manifest `apps/server/src/provider/model-manifest.json` refreshed hourly, plus live discovery per driver. _reported_
- **No model family field exists.** Closest: `CLAUDE_CODE_FAMILY_ALIASES = {opus, sonnet, haiku, fable}` (`apps/server/src/provider/ClaudeModelCatalog.ts:434-439`), manifest `aliases`. _reported_
- **Automatic fallback exists:** `resolveNewThreadModelSelection` swaps to `settings.fallbackModelSelection` when no explicit selection is given and the default's usage window is exhausted (`packages/shared/src/usageLimits.ts:67-104`). _checked_. `ThreadLaunchService.launch` itself takes an explicit selection and does not apply it. Guild must never call the fallback resolver.
- **Executed model per turn:** `OrchestrationV2ProviderTurn.model` — "The model the provider reported running this turn's root agent, which can differ from the requested one." (`orchestrationV2.ts:1379`). _checked_. Claude on Bedrock/Vertex can silently run a default model; Codex reports `model/rerouted`. _reported_
- **Token usage per turn:** `TurnTokenUsage {usageStatus: complete|partial|unavailable, inputTokens, outputTokens, cachedInputTokens, cacheCreationTokens, reasoningTokens, models}` on `ProviderTurn.turnTokenUsage` (`packages/contracts/src/providerRuntime.ts:56-86`). Produced by Claude, Codex, OpenCode, Muse, Cursor, ACP. _reported_
- **Cost:** `UsageService` scans provider transcripts into daily buckets with `costSource` (provider-reported, list price, or unpriced) (`apps/server/src/usage/`). Per-turn cost is generally not available (only ACP fills `cost`). _reported_
- **Rate limits:** a limited turn ends `failed` with `class: "usage_limit"` and `resetAt`; account windows on `ServerProvider.usageLimits` (`packages/contracts/src/providerUsageLimits.ts`); `UsageLimitRecoveryWorker` can auto-resume. _reported_
- **Concurrency:** no per-provider session cap in T3 (`ProviderInstallationGate.ts:14` uses `Number.MAX_SAFE_INTEGER`). _reported_. Guild must provide its own budget.

## 6. Git, worktrees, diffs, terminal, editor, approvals

- **Worktrees:** created at thread launch or by `vcs.createWorktree`; ownership is only the thread's `branch`/`worktreePath`; reverse lookup `orchestration.getWorktreeThreadIds`; `sharedCheckoutGuard` refuses checkout changes while another thread runs in the same path; cleanup rules in settings (`storageCleanup.ts`). _reported_
- **Git actions:** status stream (`subscribeVcsStatus`), branches, commit/push/PR via `git.runStackedAction`, PR actions incl. merge and revert via `pullRequests.runAction`, `checkpoint.rollback`. Agents use shell git under normal approvals. **No separate staged view** (one working-tree list; diff panel has an `unstaged` selection). _reported_
- **Checkpoints and diffs:** hidden refs per scope and turn, attributable to `threadId` + `runId` (`orchestrationV2.ts:1636-1650`); `getTurnDiff`, `getFullThreadDiff`, `review.*` RPCs; `DiffPanel` with split/unified, file tree, comments (`@pierre/diffs`). _reported_
- **Terminal:** keyed by `threadId` + `terminalId` with `cwd`/`worktreePath`, history replay (`apps/server/src/terminal/Manager.ts`). _reported_
- **Files:** tree (`@pierre/trees`), editable viewer (`@pierre/diffs/edit`, saves via `projects.writeFile`), content search (`projects.searchContents`). _reported_
- **Approvals:** runtime modes `approval-required | auto-accept-edits | auto | full-access` (`packages/contracts/src/providerPolicy.ts:25-32`); pending requests on the thread projection; answered by `runtime-request.respond`; agents cannot approve permission requests. _reported_
- **Tests:** **no first-class test runs or results.** Only `ProjectScript` (labelled shell commands) and PR CI checks. _reported_

## 7. Web app

- **Routing:** TanStack Router file routes in `apps/web/src/routes/` (e.g. `_chat.usage.tsx`); `AppSidebarLayout` accepts `showSidebar={false}` (`__root.tsx:221`). Modal/utility page lists in `components/sidebar/mainAppLocation.ts`. _reported_
- **Panels:** right panel kinds `diff, files, file, preview, device, terminal, pull-request, pull-requests, issue, thread, linked-thread` in `rightPanelStore.ts`, but **only ChatView renders them**. Embeddable precedent: `workflows/WorkflowThreadPane.tsx` mounts `<ChatView embedded>` for any thread. _reported_
- **Keybindings** are a closed contract union (`packages/contracts/src/keybindings.ts`), defaults in `packages/shared/src/keybindings.ts`, dispatcher `apps/web/src/shortcuts/dispatcher.ts` with an `editableFocus` guard (`lib/editableFocus.ts`). _reported_
- **Lint constraints that shape Guild code:** React Compiler on, `no-manual-memo`, `no-unreasoned-state-sync`, `shadcn/no-restyle`, `no-raw-colors`, `no-low-value-comments`, and **`t3code/no-untranslated-copy` is an error for `apps/web/src/**`** (`vite.config.ts:610`, _checked_). See decision U-006 for how English-only copy complies.
- **Animation:** no game or continuous-render code exists; `lib/visibleAnimation.ts` and `lib/documentActivity.ts` provide visibility/focus helpers. Electron throttles hidden windows but not unfocused ones. _reported_
- **Tests:** Vitest `unit` (node, no DOM) and `browser` (Playwright Chromium) projects; scenarios in `scripts/scenarios/`. _reported_

## Reference prototype (ART-10)

`index-24.html` has one player-controlled character, one test room, a training dummy and a finish flag. It has **no** doors, scenes, NPCs, persistence across scenes, overlays, or live data. Everything in [05_world-and-rooms.md](05_world-and-rooms.md) beyond movement and rendering is new work.

## Gaps Guild must build (index)

1. Adventurer identity, model binding and family resolution → [06](06_recruitment-and-identity.md).
2. Guild tables, history, idempotency → [02](02_domain-model.md).
3. Quests, attempts, evidence and state machines → [08](08_quest-lifecycle.md).
4. Scheduler with dependencies, budgets and leases; Guild MCP tools → [09](09_orchestration-and-parties.md).
5. Workspace ownership layer, test evidence, approval gates → [10](10_engineering-surfaces.md).
6. Stats and XP over durable records → [11](11_progression-and-stats.md).
7. Canvas engine, scenes, sprites → [03](03_sprite-system.md), [05](05_world-and-rooms.md).
8. Presentation mapping from real status → [07](07_npc-status-mapping.md).
