# 11 — Statistics, XP and progression

> Status: Draft v1 (2026-11-27). Increment 2 (XP, first stats), 4 (full metrics, Treasury), 5 (achievements, cosmetics, milestones, chronicles). Decisions D-020, D-021 are made here.

## Purpose

What Guild measures, where each number comes from, how unknown values are shown, how XP is awarded once per real accomplishment, how levels unlock only cosmetics, and what the Treasury and Trophy Hall show.

## Read first

1. [02_domain-model.md](02_domain-model.md) §Attempt, §AttemptTurn, §RewardEvent.
2. [08_quest-lifecycle.md](08_quest-lifecycle.md) §Evidence gates.
3. [00_foundation-audit.md](00_foundation-audit.md) §5 (tokens, cost, limits).

## Requirements covered

PIL-07, PRO-06, MOD-04, MOD-05, STAT-01…STAT-08, XP-01…XP-05, ROOM-08, ROOM-11, LATER-05, LATER-06, ACC-METRIC, ACC-PROG.

## Non-negotiables (from the brief)

- "Show unknown/unavailable when not exposed; do not treat unknown as zero. Label cost estimates and do not infer subscription quotas from context size or token totals." (STAT-05)
- "Count accepted work separately from attempted work and avoid double counting …" (STAT-03)
- "No XP solely for tokens consumed, lines written, number of tool calls or elapsed time." (XP-02)
- "Use idempotent reward records so retries/reconnects cannot repeatedly award XP for the same achievement." (XP-03)
- "Level should not automatically increase real permissions, change model family or claim higher intelligence. Do not lock necessary software engineering functionality behind progression." (XP-05)

## Design

### Metric registry (STAT-02)

Every number Guild shows is defined once in `packages/guild-core/src/metrics.ts`:

```ts
type MetricDef = {
  id: string;                        // "accepted_quests"
  label: string;                     // "Accepted quests"
  definition: string;                // one sentence shown in a tooltip
  source: "guild_records" | "git" | "t3_turn_usage" | "t3_usage_scan" | "derived";
  kind: "count" | "duration" | "tokens" | "money" | "ratio" | "lines";
  estimate?: boolean;                // true → always labelled "estimate"
};
```

The UI shows each value with its label and, on hover or in a details row, its definition and source. A value is `{ value: number } | { unknown: reason }`; formatting renders unknown as "—" with the reason ("not reported by this provider"), never 0.

### Adventurer statistics (STAT-01)

Computed from Guild records (queries over attempts, quests, evidence, findings, rewards), scoped by **all time, per epic, per class held at the time, per model family and per executed model**, over a chosen date range:

| Metric | Source | Notes |
|---|---|---|
| Accepted quests | Guild | quests `accepted` with this adventurer as implementer/investigator |
| Attempts: total, failed, cancelled, blocked time | Guild | per attempt; blocked time from activity timestamps |
| First-pass acceptance | Derived | accepted with exactly one attempt, no `changes_requested` |
| Rework count | Guild | `changes_requested` transitions |
| Validated findings | Guild | findings authored with resolution `accepted` or `fixed` |
| Confirmed bugs fixed | Guild | accepted `bounty` quests |
| Verified test contributions | Guild + evidence | accepted `trial` quests, passing `test_run` evidence linked |
| Lines added/removed, files modified | Git | from the attempt's diff against base **at acceptance**, `mixed`/`unattributed` excluded and shown separately (10 §Attribution) |
| Commits, merged PRs | Git / T3 PRs | commits on the quest branch at acceptance; PRs merged that include them |
| Active execution duration | T3 turn timestamps | sum of turn durations from `AttemptTurn` |
| Input / output / cached tokens | T3 turn usage | sums of known values; `partial` or `unavailable` shown as such |
| Tokens per accepted quest | Derived | only when all included attempts have `complete` usage; otherwise unknown |
| Reported or estimated cost | T3 usage scan | labelled with `costSource` (provider-reported, list price estimate, unpriced) |
| Model versions used | Guild | distinct `executedModel`s with turn counts |
| Projects, parties participated | Guild | counts with links |

Counting rules (STAT-03, STAT-04):

- **Accepted vs attempted** are always separate columns.
- **Lines** are counted once per accepted quest: the final diff of the quest branch vs its base when accepted. Retries, rework and repeated edits within a quest therefore count once. When quest branches are integrated, lines are not counted again for the integration quest (it is tagged `integration`, its line metric excluded).
- **Shared work**: when a quest has several implementers, lines are shown per quest with all implementers listed, not split or duplicated.
- **Attribution**: only work linked to an attempt by thread and worktree counts for that adventurer. Anything else is `unattributed`.

Comparisons (STAT-06): the Barracks comparison view groups by quest category and difficulty, shows sample size next to every rate, and hides rates with fewer than 3 samples ("not enough data"). It never ranks adventurers by raw volume.

### Model-specific reporting (MOD-04, MOD-05)

Every attempt-level metric can be split by executed model. Turns run outside the bound family (06 §Executed-model drift) are attributed to the executed model. A family change on the adventurer is shown as a marker on their timeline charts.

### Guild, epic, party statistics (STAT-07)

- **Guild**: roster size, available/busy/blocked/resting counts (live), kingdoms, epics, missions, quests by state, accepted work, merged PRs, releases, usage, execution time, validated findings; trend charts by week.
- **Epic**: missions, open/blocked quests, worktree state, recent changes, test results by revision, findings, contributors, usage, delivered milestones.
- **Party**: missions completed together, acceptance and rework rates, execution time, role contributions, collaboration history.
- **Progress** shows "3 of 5 quests accepted (60 %)" as a count; it never claims an effort estimate (STAT-07).
- Every chart has a date range control and drill-down to the underlying quests or attempts.

Stats are computed by `GuildStats` (`apps/server/src/guild/GuildStats.ts`) on request (`guild.getStats(scope, range)`), with a cache invalidated by `GuildActivity` sequence. They are never pushed in the guild snapshot (02 §Stream).

### Treasury (STAT-08, ROOM-08; Increment 4)

The Treasury overlay (and `/guild/treasury`) shows real provider data:

- Per provider instance: status, auth, usage-limit windows from `ServerProvider.usageLimits` (kind, used %, reset time) exactly as T3 reports them (`packages/contracts/src/providerUsageLimits.ts`).
- Token usage by adventurer, epic and model from `AttemptTurn` records, with completeness labels.
- Cost from T3's `UsageService` buckets, always labelled with `costSource`; "estimate" for list-price values; "unpriced" where unknown.
- Guild budgets (09) and current live attempts.

Fantasy names may sit beside real labels ("Mana · tokens"), but context window, tokens, concurrency, money and subscription limits each have their own row and are never combined. There is no energy or stamina system (STAT-08, NON-04).

### XP (XP-01…XP-03, decision D-020)

- Everyone starts at 0 XP, level 0 (REC-07).
- XP is awarded only by **RewardEvents**, created by `GuildService` in the same transaction as the triggering transition. Each has a unique `sourceKey`, so the same accomplishment can never award twice (XP-03):

| Accomplishment | sourceKey | XP (rules v1) |
|---|---|---|
| Quest accepted, implementer/investigator | `quest:<questId>:accepted:<adventurerId>` | trivial 10, small 20, medium 40, large 80 |
| Bonus: accepted on first attempt | `quest:<questId>:first_pass:<adventurerId>` | +25 % of base, rounded |
| Bonus: independently verified | `quest:<questId>:verified:<adventurerId>` | +25 % of base, rounded |
| Verification performed (verdict recorded, quest later accepted) | `quest:<questId>:verifier:<adventurerId>` | 50 % of quest base |
| Finding validated (resolution accepted/fixed) | `finding:<findingId>:validated` | info 2, low 5, medium 10, high 20, critical 30 |
| Report confirmed by the user (report deliverables) | covered by quest accepted | — |
| Mission delivered, leader | `mission:<missionId>:delivered:<adventurerId>` | 30 + 5 per accepted quest, max 100 |

- **Never** XP for tokens, lines, tool calls, time or attempts (XP-02).
- Failed, cancelled or retried attempts award nothing; rework doesn't reduce the eventual award except losing the first-pass bonus. Raising a legitimate blocker or finding is never penalised (XP-02).
- Reopening an accepted quest does not remove XP; re-acceptance doesn't re-award because the sourceKey already exists.
- Rules are versioned (`GuildSettings.xpRulesVersion`); a new version applies only to new rewards. Old rewards keep their values.

### Levels (XP-04, XP-05)

- Level from total XP with a gentle curve (rules v1): XP needed for level *n* = `round(25 * n^1.6)` cumulative. Level 10 ≈ 1,000 XP, level 25 ≈ 4,300, level 50 ≈ 13,000, level 100 ≈ 40,000. Tunable by a new rules version.
- Milestones at levels 10, 25, 50, 75, 100 unlock **cosmetics only**: emblem frames, capes and backs, accessories, titles, Barracks decorations (12, 04). The original appearance stays recognisable; unlocked items are optional.
- Level never changes permissions, runtime mode, model family, tools or access, and no engineering function is locked behind it (XP-05). A unit test asserts the launch path reads nothing from level or XP.
- The UI never describes level as skill or intelligence. Copy: "Level 12 · 1,310 XP from accepted work."

### Titles and achievements (Increment 5, decision D-021)

Achievements are evidence-based and idempotent (`Achievement.sourceKey`): e.g. **Bug Slayer** (10 accepted bounties), **Pathfinder** (5 accepted reconnaissance quests), **Architect** (10 validated high/critical findings), **Steadfast** (20 first-pass acceptances), **Veteran** (100 accepted quests). Each shows the records that earned it. A title is a cosmetic name tag.

### Milestones, Trophy Hall, chronicles (ROOM-11, LATER-05, LATER-06; Increment 5)

- A **milestone** is recorded when a mission is `delivered` with a merged PR, or the user tags a release (verified tag on the target branch). The Trophy Hall shows a banner per milestone linking to its evidence.
- **Chronicles** replay a mission from `GuildActivity`, attempts, findings, evidence and links to transcripts: a timeline, not a re-narration. No invented reasoning (LATER-05).

## Invariants

1. Unknown is never zero, anywhere.
2. Every metric has a definition and source.
3. One RewardEvent per sourceKey; XP is the sum of RewardEvents.
4. Level and XP never influence permissions, bindings or access.
5. Accepted and attempted work are always separate.

## Failure and reverse states

- A stats query that times out shows "couldn't load" with retry; it never shows partial numbers as totals.
- A provider that stops reporting usage: values from then on are unknown, earlier ones stay.

## Out of scope

- Leaderboards across users, economies, purchases (NON-04, NON-09).

## Acceptance checks

1. RewardEvent idempotency: accept, reopen, accept again → one reward; replaying the accept command → one reward (ACC-PROG).
2. A failed attempt then a successful one → no reward for the failure, no first-pass bonus.
3. Stats over fixtures: lines counted once across rework; mixed edits excluded; a provider with `unavailable` usage shows "—" with a reason, not 0 (ACC-METRIC).
4. Launch path has no dependency on XP or level (unit test).
5. Integrated pass (Increment 2): after accepting a quest, the adventurer's profile, the epic and guild stats update; unknown values stay unknown (ACC-METRIC).

## Open questions

None. XP numbers are tunable defaults (D-020).
