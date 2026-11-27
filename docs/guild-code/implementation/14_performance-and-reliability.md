# 14 — Performance and reliability

> Status: Draft v1 (2026-11-27). Applies from Increment 1; recovery hardening in Increment 4. Decision D-006 is made here.

## Purpose

The rules that keep the game cheap while agents work, the sanctioned exception to T3's no-continuous-repaint rule, and how every failure case is handled explicitly, including restart recovery.

## Read first

1. Root [AGENTS.md](../../../AGENTS.md) *Performance* and *Taste*.
2. [docs/internals/16_performance-regressions.md](../../internals/16_performance-regressions.md).
3. [01_architecture.md](01_architecture.md), [02_domain-model.md](02_domain-model.md) §Bridging T3 events.

## Requirements covered

PERF-01…PERF-03, ANI-07, T3-05, ARCH-02, ACC-RECOV, MODE-06.

## Non-negotiables (from the brief)

- "Cache sprite sheets and static scene art, avoid expensive per-frame generation, and limit unnecessary redraws and provider requests." (PERF-01)
- "Offer reduced-motion and pause-animation options; pausing visuals does not imply pausing agents." (PERF-02)
- "Never automatically retry operations with irreversible side effects without knowing whether they previously succeeded." (PERF-03)

## Design

### The game loop exception (decision D-006)

T3's taste rule forbids continuously repainting animations. The Guild world is a game and must animate, so this is the **only** sanctioned exception, under these conditions:

- The loop runs only while **all** hold: a Guild world canvas is mounted, the mode is Adventure or Hybrid, `document.visibilityState === "visible"`, and the window is focused. Use `apps/web/src/lib/documentActivity.ts` (`subscribeDocumentActivity`). Electron throttles hidden windows but not unfocused ones (00 §7), so blur must stop the loop explicitly.
- When any condition fails, cancel the `requestAnimationFrame` loop entirely and draw one final still frame. No timers keep running.
- **Frame cap**: render at most 60 fps (skip render on frames closer than ~16 ms to the last one on high-refresh displays). Simulation stays at 120 Hz fixed steps (reference), clamped to 0.1 s per frame.
- **Hybrid with focus in the side panel**: the user is typing, so render at most **20 fps** (ambient only, the player can't move).
- **Reduced motion** (`prefers-reduced-motion` or the Guild setting): no particles, no parallax, no lamp flicker, no camera easing (camera snaps), idle clips paused on frame 0, NPC walking replaced by placement. Markers still show.
- **Pause animations** setting: renders a still frame on every presentation change and on player input only. Agents are unaffected (PERF-02); the HUD says "Animations paused · agents still working".

### Frame budget (PERF-01)

Targets on a normal laptop at 60 fps, with up to 12 NPCs visible:

- **≤ 2 ms main-thread time per frame** for update + render combined (measured with the engine's built-in debug overlay, toggled by a dev-only key).
- Per frame the engine does only: input, fixed-step physics for the player, NPC clip advance and position easing, particle update, and `drawImage` calls (one per tile layer chunk, prop, character, particle batch). No sprite composition, no palette work, no allocation in the hot path (reuse arrays).
- **Cached, built once**: character sheets (03 §Sheets and caching, in a worker), prop canvases, each scene's static tile layer (one offscreen canvas per scene, like the reference's `levelCv`), parallax strips, the pixel font glyph atlas.
- **Presentation model** recomputes only when inputs change (atoms), not per frame.
- **No network per frame.** The world never issues RPCs on its own. Fine-grained activity subscriptions are bounded (07 §Fine-grained activity).
- `report:client` (`docs/internals/16_performance-regressions.md`) gets a Guild scenario: the world open in Adventure mode with 12 NPCs, 3 working threads, for 30 s. Its renderer CPU must stay within a budget recorded in the first measurement (set in T1.4 and kept in the metrics config).

### Server-side cost

- `GuildRunBridge` handles only events for Guild threads (cheap lookup set by `threadId`) and coalesces per attempt like T3's per-thread coalescing.
- Guild stream deltas are small entity upserts; the snapshot is bounded (02 §Stream) and included in the transfer budget test.
- Stats are computed on request and cached by activity sequence (11).

### Failure catalogue (PERF-03)

Every case is handled explicitly and visible to the user:

| Failure | Detection | Behaviour |
|---|---|---|
| Provider rate limit | `lastErrorClass: usage_limit`, `usageLimitResetAt` (00 §2) | NPC rests with reset time; T3's own auto-resume (`UsageLimitRecoveryWorker`) applies if the user enabled it in T3; Guild doesn't add its own retry |
| Provider disconnected | `lastErrorClass: transport_error` | live state `disconnected` (07), offline marker, not a failure; "Continue" sends a new message to the same thread when the user asks |
| Provider session error | session status `error`, other error classes | live state `failed`; dialogue shows the error; "Continue" as above |
| Bound family / model unavailable | `resolveBinding` error (06) | no launch; reason and fix actions shown |
| Executed model outside family | bridge comparison (06) | warning; scheduler waits for acknowledgement (Increment 3+) |
| Command or tool failure inside a turn | T3 turn items | shown in the thread as T3 shows it; Guild doesn't interpret it |
| Permission rejected by the user | T3 runtime request resolved `decline` | the agent continues per provider behaviour; Guild records nothing special |
| Dirty worktree | VCS status | never touched automatically (10) |
| Lost session / thread deleted | bridge sees deletion | attempt `cancelled`, `statusReason: thread_deleted` |
| User cancellation | user action | attempts stopped via T3, leases released, quest `cancelled` |
| Guild outbox side effect fails | worker error | if T3 has an accepted receipt for the deterministic command id, treat as done; otherwise mark the attempt `failed` with the error. Re-running follows the single retry rule in 02 §Making changes |
| Client disconnected | connection phase | world shows unknown/offline states (07) |

### Restart recovery (T3-05, ARCH-02, ACC-RECOV)

On server startup, after T3's own recovery (`ProviderRuntimeRecoveryService.reconcile("startup")`, 00 §1) and before the scheduler starts:

1. **Guild outbox**: rows `running` are checked against T3: a call whose deterministic command id has an accepted T3 receipt is marked `done`; otherwise it goes back to `pending` under the retry rule in 02 §Making changes. This step runs after T3's `ProviderRuntimeRecoveryService.recover` in `apps/server/src/serverRuntimeStartup.ts` (wired by T1.9).
2. **Attempts** in `starting`/`active`: read their threads' recovered state. T3 cancels in-flight runs on restart, so most become live-`stopped`/`idle`; Guild attempts stay `active` (lifecycle) and show the real live state. If T3's "continue after server update" setting resumed the thread, that shows as working.
3. **Leases** held by terminal attempts are released.
4. **Scheduler** resumes from stored state (09); nothing is double-launched because each launch is keyed.
5. Identity, history, rewards and evidence need no recovery: they're committed rows.

## Invariants

1. The game loop never runs while the world is hidden, unfocused or unmounted.
2. No per-frame sprite composition, allocation-heavy work or network calls.
3. No automatic retry of an operation unless T3's receipts prove it is safe.
4. After restart, no adventurer, attempt, reward or evidence row is lost, and no launch is duplicated.

## Failure and reverse states

Covered by the catalogue. Reduced motion and pause animations are user toggles, reversible at any time.

## Out of scope

- WebGL renderers or engines.
- Audio by default (optional, muted by default, 04 §Ambient).

## Acceptance checks

1. Browser test: with the window blurred or the route hidden, no `requestAnimationFrame` callback runs (counted via an injected scheduler).
2. Engine debug overlay shows ≤ 2 ms/frame in the Increment 1 reference scene with 12 NPCs on the developer's machine; recorded in the T1.4 report.
3. Outbox recovery test: kill between commit and launch → one thread after restart; kill after launch → still one thread.
4. Restart integrated check: with an adventurer mid-conversation, restart the dev server; the adventurer, attempt and thread link are intact; no new thread appears (ACC-RECOV).

## Open questions

None.
