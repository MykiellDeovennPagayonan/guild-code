# Agent rules for building Guild

These rules apply to every agent that implements, reviews or documents Guild. They sit on top of the root [AGENTS.md](../../AGENTS.md); where the two conflict, [decisions.md](decisions.md) decides, then this file, then the root file.

## 1. Before you start

1. Read [README.md](README.md) end to end. It is short on purpose.
2. Read [decisions.md](decisions.md). Entries marked **USER** are the developer's own choices and are locked. **DEFAULT** entries are the orchestrator's choices; you may propose changing one, but you may not silently deviate from it. **OPEN** entries are unresolved; if your task touches one, stop and ask.
3. Open your task card in [implementation/tasks/](implementation/tasks/). Read every doc it lists under _Read first_, in order.
4. For every requirement ID on the card, read its verbatim quote in [traceability.md](traceability.md). The quote is the spec. The design docs explain how to meet it; they never override it.
5. Check [implementation/00_foundation-audit.md](implementation/00_foundation-audit.md) before relying on any T3 capability. Entries marked **checked** or **reported** carry a file citation; open the cited file before you build on it. If you need something marked **unconfirmed** or not listed, verify it in the code first and update the audit with the file and line.

## 2. Hard rules

These follow from the brief's non-goals ([traceability.md §Non-goals](traceability.md#non-goals-brief-16)). Breaking one fails review no matter how good the rest of the change is.

- **Never fake reality.** No invented activity, token counts, test results, Git changes, character history or provider output presented as real. If a value is unknown, show it as unknown. Unknown is never zero.
- **The world is a view.** The game reads engineering state; it never owns it. Walking, animations, rooms and overlays must never start, stop or change real work except through an explicit user action wired to a server command.
- **Cosmetics never grant access.** Class, level, rank, title, weapon, hat or party role never changes permissions, sandbox, runtime mode, approved tools or model family. Permissions come only from explicit configuration the user approved.
- **No silent model substitution.** If the bound family is unavailable, fail visibly with the reason and offer an explicit change. Never fall back.
- **Engineering is reachable without the game.** Every real operation you add must also be reachable from focus mode, the command palette or a direct link. No walking, jumping, combat, levels or waiting in front of real work.
- **The reference file is read-only.** Never edit [index-24.html](index-24.html). It is the visual regression source.
- **Don't invent technical details.** No guessed APIs, flags, env vars, model names or contract fields. Look them up in the code or ask.

## 3. How to work

- **Surgical changes.** Touch only what your card needs. If you find an unrelated problem, note it in your report; don't fix it.
- **Own your files.** Each card lists the files and directories it owns. Do not edit files another in-flight card owns. If you must, stop and report the overlap.
- **State machines over booleans.** Quest, mission, run and party state are explicit enums with validated transitions (see [08_quest-lifecycle.md](implementation/08_quest-lifecycle.md)). Never derive real state from an animation, and never track workflow with loose flags.
- **Idempotency.** Every server mutation that can be retried (reconnects, restarts, duplicate tool calls) must be safe to apply twice. Use T3's command receipts or a natural unique key; see [02_domain-model.md](implementation/02_domain-model.md).
- **T3 conventions apply to Guild code.** Effect services with `Effect.fn("Service.operation")`, wire schemas in `packages/contracts`, client mutations through `createEnvironmentRpcCommand`, UI primitives from `apps/web/src/components/ui` without restyling, no unreasoned React effects. The root [AGENTS.md](../../AGENTS.md) _Taste_ section applies in full.
- **Copy is English only** (decision U-006). Guild strings do not go through the i18n system. Fantasy labels always sit next to the real engineering term, for example "Bounty · Bug fix", "Expedition camp · worktree `quest/api`".
- **Performance.** The game loop only runs while a Guild world view is visible and the window is focused (see [14_performance-and-reliability.md](implementation/14_performance-and-reliability.md)). Never add a continuously repainting animation outside the game canvas.

## 4. Verifying your work

Every card ends with numbered checks. You are not done until each one has evidence you can show.

- Run the tests the card names with `vp test run <files>`, and `vp run typecheck` for the packages you touched. Before handing back, run `vp run check:changed`. Do not run repo-wide checks unless asked.
- **Prove a test can fail.** For each new behavioural test, break the code briefly, watch it fail, then restore it.
- **Art changes** need a rendered PNG contact sheet (see [04_art-pipeline.md](implementation/04_art-pipeline.md) §Review loop) that you have looked at, compared against the reference sheet, and attached to your report. The developer approves new art; agents do not.
- **User-visible changes** need one real pass in the running app (the `test-t3-app` skill for web and desktop). Walk the flow as the user would, using the free `Replay (dev)` provider unless the card needs a real one; if so, use that provider's cheapest model.
- **Never run a dev server against `~/.t3/userdata`.** It is the developer's live database. See the root [AGENTS.md](../../AGENTS.md) _The three ways to hurt yourself_.

## 5. When the design is wrong or missing

The docs will have gaps. When you hit one:

1. Do not guess and do not quietly pick something.
2. If the answer follows clearly from the brief's quotes and the existing decisions, write it down: add a DEFAULT entry to [decisions.md](decisions.md) with your reasoning, and update the design doc section in the same change.
3. If it is a real product choice (what the user sees, what is allowed, what is stored about them), add an OPEN entry and stop work on that part. Report it.
4. If the audit was wrong about T3, fix [00_foundation-audit.md](implementation/00_foundation-audit.md) and flag which design sections relied on the wrong claim.

## 6. Keeping docs true

- If your change makes any sentence in `docs/guild-code/` wrong, fix that sentence in the same change. Rewrite; don't append a second account.
- These docs are a pre-implementation spec, so they list fields, states and flows. Once a part is built, the code is the source of truth for those details: shrink the doc section to the decisions, invariants and reasons, and link to the code.
- Update [traceability.md](traceability.md) when you add, split or rename a task, and tick the proof column's evidence in your report.

## 7. Reporting back

End every task with a report containing:

- The card ID and the requirement IDs you covered.
- What changed, by file.
- Each check from the card with its evidence (command output, screenshot path, PNG path).
- Anything skipped, untested or failing, said plainly.
- Any decisions you added (with IDs) and any OPEN questions.
- Unrelated problems you noticed but did not fix.
