# Increment 4 — Forge and engineering completeness

> Brief §14 Increment 4: "Expose branch/worktree ownership, actual changes, editable source, terminal and diffs, using existing T3 functionality where possible. Support integration of parallel work and inspect failures/conflicts; protect dirty working trees. Add Training Grounds and Council functionality for real test evidence, reviews and approval gates. Expand telemetry, attribution and project statistics. Validate that stats survive restarts and that unknown provider metrics are handled honestly."

**Done when** every card's checks pass and T4.7's pass demonstrates ACC-WS, ACC-REVIEW (tests), ACC-ENG (Forge), ACC-METRIC (full), ACC-RECOV (executions), ACC-CTRL (merge gates, take over).

**First step:** re-read decisions and the Increment 3 report; update these cards.

Card format and rules: see [increment-1.md](increment-1.md).

```
T4.1 ─▶ T4.2 ─▶ T4.3
  └───▶ T4.4 ─▶ T4.5
T4.6 (after T4.2)    T4.7 (last)
```

---

## T4.1 — Forge scene and workbench access

- **Goal:** Forge room with a workbench per active write attempt opening T3's conversation, diff, files, terminal and PR views in hybrid mode with the Guild context header; workspace board.
- **Requirements:** ROOM-05, GIT-01, GIT-02, GIT-06, GIT-07 (context header), MODE-02, ACC-ENG.
- **Read first:** [10](../10_engineering-surfaces.md) §Reuse, §The Forge; [13](../13_presentation-modes.md) §Hybrid mode details.
- **Depends on:** Increment 3.
- **Owns:** `world/scenes/forge.ts`, `ui/forge/**`, the Guild context header component, Forge art (developer approval).
- **Checks:** from a workbench, open diff, files and terminal for that attempt's worktree; header shows adventurer, quest, path, branch, base, lease (10 check 6).

## T4.2 — Workspace safety

- **Goal:** Full lease enforcement, dirty-state protection, take over / hand back, overlap and stale-base detection, cleanup only when clean.
- **Requirements:** GIT-03, GIT-04, GIT-08, ACC-WS, ACC-CTRL (take over).
- **Read first:** [10](../10_engineering-surfaces.md) §Workspace leases, §Attribution, §Integration (pre-checks).
- **Depends on:** T4.1.
- **Owns:** `apps/server/src/guild/GuildGit.ts`, lease enforcement, take-over flow.
- **Checks:** 10 checks 1–3.

## T4.3 — Integration of parallel work

- **Goal:** Mission integration branch, predicted conflicts, integration quests, verification of the integrated revision.
- **Requirements:** GIT-05, PTY-07 (step 7), ACC-WS (conflicts).
- **Read first:** [10](../10_engineering-surfaces.md) §Integration.
- **Depends on:** T4.2.
- **Checks:** two quest branches integrated through an integration quest; a predicted conflict is flagged before merging; the integrated revision gets its own verification.

## T4.4 — Training Grounds and test evidence

- **Goal:** Per-epic approved test commands, `GuildTestRunner`, `test_run` evidence with parsing and revision, staleness, `guild_run_tests` tool, Training Grounds scene and `practice` pose.
- **Requirements:** TST-01, TST-02, ROOM-07, ANI-02 (testing), ACC-REVIEW (tests).
- **Read first:** [10](../10_engineering-surfaces.md) §Training Grounds, §Evidence staleness.
- **Depends on:** T4.1.
- **Owns:** migration `123_GuildTests.ts` (per-epic test commands), `apps/server/src/guild/GuildTestRunner.ts`, staleness in `GuildEvidence.ts`, `world/scenes/training_grounds.ts`, `ui/training/**`, parsers with fixtures.
- **Checks:** 10 check 4; agents cannot run unapproved commands (tool access test).

## T4.5 — Council gates and merge gates

- **Goal:** Complete Council (all approvals, findings); merge gate for `requiresMerge` missions; `integrating` → `delivered` only through the gate.
- **Requirements:** ROOM-09, QST-11, GIT-08, ACC-CTRL.
- **Read first:** [10](../10_engineering-surfaces.md) §Council, §Merge gates; [08](../08_quest-lifecycle.md) §Mission states.
- **Depends on:** T4.4.
- **Checks:** a mission can't reach `delivered` without merged PR, required checks, non-stale verification at the PR head, and the user's merge-gate approval; 10 check 5.

## T4.6 — Telemetry, attribution, full statistics, Treasury

- **Goal:** All metrics from 11 with sources and definitions, model splits, comparisons with sample sizes, party/epic/guild views with ranges and drill-downs, Treasury room.
- **Requirements:** STAT-01…STAT-08, MOD-05 (reporting), PIL-07, ROOM-08, GIT-07, ACC-METRIC.
- **Read first:** [11](../11_progression-and-stats.md).
- **Depends on:** T4.2.
- **Owns:** `GuildStats.ts` expansion, stats UI, `world/scenes/treasury.ts`, `ui/treasury/**`, `_chat.guild.treasury.tsx`.
- **Checks:** 11 check 3 across all metrics; Treasury shows T3's usage-limit windows exactly and labels cost sources.

## T4.7 — Recovery hardening and the Increment 4 pass

- **Goal:** Prove restart and reconnect behaviour for executions, leases, scheduler and stats; run the Increment 4 integrated pass.
- **Requirements:** T3-05, ARCH-02, PERF-03, ACC-RECOV, ACC-WS, ACC-REVIEW, ACC-ENG, ACC-METRIC, ACC-CTRL.
- **Read first:** [14](../14_performance-and-reliability.md) §Restart recovery, §Failure catalogue.
- **Depends on:** all other T4 cards.
- **Steps:** add `guild.export` (D-026); restart the server mid-expedition (running attempts, held leases, pending approvals, queued quests); verify every item in 14 §Restart recovery; then the integrated pass covering this file's ACC list; update traceability.
- **Checks:** report with evidence for each ACC; no duplicated thread or lost record after restart.
