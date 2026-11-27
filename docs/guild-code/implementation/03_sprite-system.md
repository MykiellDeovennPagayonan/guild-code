# 03 — Sprite system

> Status: Draft v1 (2026-11-27). Increments: 1 (port, appearance, sheets), 5 (pose expansion). Owner of truth once built: `packages/guild-art`.

## Purpose

Every character and prop in Guild is drawn by one sprite system, ported from the reference [index-24.html](../index-24.html). This doc specifies the port: where it lives, how it stays pixel-identical to the reference, the appearance format that persists characters, how sheets are built and cached, and how the pose system grows to cover non-combat activities.

## Read first

1. [../index-24.html](../index-24.html) lines 168–954 (sprite system) and 956–1383 (test room). Read the code, not just this summary (ART-01).
2. [04_art-pipeline.md](04_art-pipeline.md) for how new art is authored.
3. [01_architecture.md](01_architecture.md) §Module layout.

## Requirements covered

ART-01, ART-02, ART-03, ART-04, ART-06, ART-08, ART-09, ANI-02 (pose mechanics), ANI-03, ANI-04, PRO-08, PERF-01 (sheet cost).

## Non-negotiables (from the brief)

- "Preserve the proportions, exaggerated heads, expressive faces, strong outlines and playful fantasy-creature style." (ART-03)
- "Reuse the actual asset definitions and composition rules. Do not require millions of pre-rendered images." (ART-04)
- "prefer stable part identifiers and an appearance schema/version rather than relying exclusively on array positions; retain compatibility with the original codes where practical." (ART-06)
- "Avoid fractional sprite scaling, antialiased sprite edges and mismatched prop resolution." (ART-08)
- "Generate/cache sprite sheets when appearance or cosmetic equipment changes, rather than recomposing all sprites each frame." (PRO-08)
- "No Guild-specific changes should be made to the original reference file in place." (ART-02)

## How the reference works (summary for orientation)

Read the source; this is a map.

| Concept | Reference location | What it does |
|---|---|---|
| Frame | `FW=48, FH=42, RX=24, RY=38` (line 174) | Every frame is a 48×42 grid of palette indices. The feet ("root") sit at (24, 38). The standing character is about 24×24. |
| Roles | `ROLE_CHARS` (177) | One character per palette slot. `.` and space are empty. `#`/`K` alias the outline. Art is authored as ASCII rows of role characters. |
| Layer | `class Layer` (183) | A `Uint8Array(48*42)` with root-relative `set/get/rect/put/blit/merge/outline/mirrored`. `put` supports quarter-turn rotation, mirroring and role remapping. |
| Outline | `Layer.outline` (201) | Every empty pixel touching a filled one (8-neighbour) becomes role `O`. Art is fill-only; outlines are automatic. |
| Palettes | `FIXED`, `PALETTES` (280–291) | Fixed roles (outline, metal, wood, white, gold, dark cloth, pure white) plus eight swappable palettes for the character roles. |
| Parts | `HEADS, FACES, TOPS, OUTFITS, BOOTS, BACKS, WEAPONS, SPECIES` (305–772) | Each part has an `id`, a `name` and pixel data or a builder. Tops and species read head metrics (`hd.L(y)`, `hd.R(y)`, `hd.shell(n)`) so every top fits every head. |
| Build | `buildParts(cfg)` (793) | Pre-composes the head (hat back, species back, head, face, hat front, snout), torso, back accessory variants and the weapon in 8 directions. |
| Pose | `POSE_DEF`, `POSES` (650–699) | A pose is a set of anchor offsets: body, head, near/far hand and shoulder, near/far foot (flat or tip), weapon direction and z-order, cape variant, slash effect. |
| Compose | `composeFrame(parts, pose)` (867) | Draws one frame in a fixed z-order (back accessory, tail, far hair, far arm, legs, torso, head, effect, weapon, near arm). Arms and legs are drawn procedurally between anchors. |
| Clips | `CLIPS` (705) | Sequences of `[poseName, ms]` with loop flags and impact frames. Run frames advance by distance (`STRIDE=5`), not time. |
| Sheet | `buildSheet(cfg)` (903) | Every pose right-facing on row 0, mirrored on row 1. `drawChar` blits one cell. |
| Display | `deviceBox`, `cssForDevicePx`, `fit()` (948–954, 1341) | Canvas sized to whole device pixels, picture drawn at a whole-number scale. |

## Design

### Module layout

The sprite system is a pure TypeScript package with no DOM dependency, so it can run in the browser, in a Web Worker, in Node tests and in the art render script.

```
packages/guild-art/
  package.json                 name "@t3tools/guild-art", private, type module, subpath exports (no barrel)
  src/
    frame.ts                   FW, FH, RX, RY, ROLE_CHARS, role index, Layer, px(), cw(), dilate(), widen()
    palettes.ts                FIXED, PALETTES, paletteTable()
    parts/heads.ts faces.ts tops.ts outfits.ts boots.ts backs.ts weapons.ts species.ts
    parts/registry.ts          category list, append-only id order, lookups by id
    poses.ts                   POSE_DEF, POSES, run generation, CLIPS
    compose.ts                 buildParts(), armLayer(), legLayer(), composeFrame()
    sheet.ts                   buildSheetFrames() -> indexed frames + anchors; toRGBA()
    appearance.ts              Appearance schema, validation, PX1/PX2 import, GLD1 code
    random.ts                  seeded PRNG and randomAppearance(seed, locks)
    props/                     prop layers (see 04_art-pipeline.md §Props)
  scripts/render-sheets.ts     writes PNG contact sheets for art review
  test/
    referenceParity.test.ts    pixel parity with index-24.html
    appearance.test.ts
```

The web app owns the only DOM code: `apps/web/src/guild/render/` turns indexed frames into `ImageBitmap` sheets and draws them (see §Sheets and caching).

Rules for the package:

- **No DOM, no globals, no randomness without a seed.** Functions take explicit inputs and return values.
- **Keep the reference's structure and names** where they are clear (`Layer`, `px`, `composeFrame`, `POSES`, `CLIPS`). A reader should be able to put a reference line next to its port and see the correspondence. Add TypeScript types; do not "improve" the algorithms during the port.
- **Port first, extend second.** Task T1.2 is a faithful port that passes the parity test. New parts, poses and props come in later commits, each with its own review.

### Reference parity test

The port must produce exactly the same pixels as the reference. This is the main guard against drift (ART-04, ART-09).

`packages/guild-art/test/referenceParity.test.ts`:

1. Read `docs/guild-code/index-24.html`. Extract the script text between the `SPRITE SYSTEM` banner comment and the `/* nudge an in-flow element` comment (the pure sprite code: frame, layer, palettes, parts, poses, clips, species, `buildParts`, `composeFrame`). Fail loudly if either marker is missing.
2. Evaluate it in `node:vm` in a fresh context, appending a line that copies `buildParts`, `composeFrame`, `POSES`, `POSE_NAMES`, `CATS`, `PALETTES`, `paletteTable` onto a result object. No DOM is needed for that slice.
3. For the three reference presets plus 200 configurations from a fixed seed, and for every pose name, compare `composeFrame(parts, pose).layer.d` and its `anchors` with the port's output. Byte-for-byte equality, including mirrored frames.
4. Compare `paletteTable` output for all eight palettes.

When new parts or poses are added later, the parity test still covers every reference part and pose unchanged. New content is not in the reference, so it is covered by the contact-sheet review in [04_art-pipeline.md](04_art-pipeline.md) and by invariant tests (below).

### Appearance format

Characters persist an `Appearance` value, never array indices.

```ts
// conceptual shape; the Effect Schema lives in packages/contracts (02_domain-model.md)
type Appearance = {
  v: 1;                    // appearance schema version
  species: string;         // part ids, e.g. "nub", "lopp"
  head: string;            // "visor", "tall", ...
  top: string;             // "brim", ... "bare"
  face: string;            // "dots", ...
  outfit: string;          // "tunic", ...
  boots: string;           // "plain" (named "Socks"), ...
  back: string;            // "none", "cape", ...
  weapon: string;          // "blade", ..., and "none" once added (§Held items)
  palette: string;         // "ember", ...
};
```

- **Ids are permanent.** A part id, once shipped, is never renamed, reused or removed. Display names may change. A part can be marked `retired: true` (hidden from shuffle and pickers) but must still render for characters that have it.
- **Registry order is append-only.** `parts/registry.ts` lists each category's ids in a fixed order that starts with the reference's order exactly. New parts are appended. This order exists only for compact codes.
- **Validation.** `parseAppearance` rejects unknown versions and unknown ids with a typed error. It never guesses a replacement. Callers decide what to do (the server refuses the write; the client shows the error).
- **Version upgrades.** If the shape changes, bump `v` and add a pure `migrateAppearance` from every older version. Stored rows are migrated on read, and the server writes back the new version on the next update.

**Codes.** The reference's share codes keep working (ART-06):

- `PX2-xxxxxxxxx`: nine base-36 characters, one per category in `CATS` order (species first). Import maps each index through the registry's original order. Export is possible only when every part is a reference part with index < 36.
- `PX1-xxxxxxxx`: eight characters with no species; imports as species `nub`, like the reference.
- JSON in the reference's `toJSON` shape (`{ v: 1, code, species: "nub", ... }`) imports by ids; a missing `species` means `nub`.
- `GLD1-…`: Guild's own code for any appearance, including new parts. Two base-36 characters per category in registry order (up to 1296 options per category), prefixed by the schema version. Codes are a convenience for sharing and testing; persistence always stores the id object.

### Randomisation

- `randomAppearance(rng, { locks, base })` picks each unlocked category uniformly from non-retired parts. It is used by the Guild Master creator's Shuffle and by recruitment.
- `rng` is a seeded PRNG (e.g. a small `mulberry32` or `xorshift`; implement it in `random.ts`, no new dependency). Recruitment stores the seed with the candidate so a candidate can be regenerated exactly in tests.
- The reference's "avoid repeating the current value 70% of the time" nudge applies to Shuffle only, not to recruitment.

### Sheets and caching

A **sheet** is every pose of one appearance, right-facing and mirrored. It is built once per appearance (plus held-item variant, §Held items) and reused by every view: world, dialogue portrait, roster card, recruitment preview, profile (PRO-08).

- `buildSheetFrames(appearance)` in the package returns `{ poses: string[], frames: Uint8Array[] /* right */, mirrored: Uint8Array[], anchors: Anchors[] }`. Pure and deterministic.
- `toRGBA(frames, paletteTable)` produces RGBA bytes for one sheet image (layout as the reference: one row right-facing, one row mirrored, `FW` per pose).
- **Web adapter** (`apps/web/src/guild/render/sheetCache.ts`):
  - Key: the canonical JSON of the appearance (sorted keys) plus the sheet-variant key. Two adventurers with identical appearances share a sheet.
  - Value: an `ImageBitmap` (created from `ImageData`) plus anchors.
  - Build sheets in a dedicated Web Worker (`sheetWorker.ts`) that imports `@t3tools/guild-art`, so composition never blocks a frame. The main thread keeps a placeholder (nothing drawn) until the bitmap arrives.
  - Bound the cache (LRU, 64 sheets by default). Evicted sheets are rebuilt on demand.
  - Portraits and thumbnails are cropped from the sheet's `i0` cell; never compose separately for them.
- `drawChar(ctx, sheet, pose, x, y, facing)` keeps the reference's signature and semantics: integer-rounded position, one `drawImage` per character.

### Display rules

These carry over from the reference and apply to every Guild canvas (world, creator preview, thumbnails, portraits):

- Render the world into an offscreen buffer at logical resolution, then copy it to the visible canvas at a **whole-number scale** chosen by `fit()`.
- Size visible canvases with `deviceBox()` and `cssForDevicePx()` so the canvas box is a whole number of device pixels; position with `snapToDevicePixels()` where the canvas is in normal flow.
- `imageSmoothingEnabled = false` on every context that draws sprites, and `image-rendering: pixelated` on the canvas element.
- Never scale sprites by a fractional factor and never rotate them by a non-quarter angle. Props share the character pixel grid (ART-08).
- Text inside the world uses the reference's 3×5 pixel font. Text in overlays (dialogue, quest board, panels) is normal HTML text for readability (QST-02).

These helpers live in `apps/web/src/guild/render/pixelDisplay.ts`, ported from the reference.

### Pose extensions

The reference poses cover idle, run, jump, double jump, fall, land and two attacks. Guild needs non-combat activities (ANI-02). Extend the **same** pose model so every generated character can perform every activity (ANI-03).

New optional pose fields (defaults keep every reference pose identical):

| Field | Meaning |
|---|---|
| `w: -1` | No weapon drawn (weapon hidden). Existing values 0..7 unchanged. |
| `stow: true` | Draw the weapon on the back at the `back` anchor, pointing down-diagonal, behind the body. Cosmetic "sheathed" look for work poses. |
| `hold?: HeldItemId` | Draw a held item (book, quill, hammer, scroll, flask, mug, crate, lantern, map) at the near hand instead of the weapon. Items use the weapon format (authored N and NE, quarter-turn rotation). |
| `holdF?: HeldItemId` | Same for the far hand (for two-handed carry, e.g. a crate). |
| `face?: FaceId` | Expression override for this pose (e.g. `sleepy` while sleeping, `happy` while celebrating). Requires a head layer per used face; build lazily and cache inside `buildParts`. |
| `sit?: SeatHeight` | Lowers the body and bends legs: hips drop by the seat height, feet move forward. Implemented in `legLayer` as a two-segment leg (hip→knee→foot) when `sit` is set. |
| `lie?: true` | The whole composed frame is rotated a quarter turn (exact, via `Layer` rotation) and re-anchored so the root sits on the bed surface. For sleeping. |
| `marker?: MarkerId` | An overhead marker drawn above the head anchor: `attention` (amber "!"), `approval` (gold scroll), `zzz`, `question`, `offline`. Markers are separate small layers, not baked into the body. |

New pose families (names are pose keys; clips sequence them):

| Activity | Poses | Clip | Notes |
|---|---|---|---|
| Walk | `k0..k5` | `walk` | Slower than run, smaller stride (`WALK_STRIDE = 3`), distance-driven like run. NPCs walk; the player runs. |
| Sit | `s0..s1` | `sit` | Seated idle with breathing. `w: -1` or `stow`. |
| Read | `rd0..rd2` | `read` | Seated or standing, `hold: book`, page-turn frame. |
| Write | `wr0..wr2` | `write` | Seated, `hold: quill`, small hand movement. |
| Think | `th0..th1` | `think` | Hand to chin, `face` unchanged. |
| Converse | `cv0..cv2` | `talk` | Gesturing hand, facing the other character. |
| Forge | `fg0..fg3` | `forge` | `hold: hammer`, strike with an impact frame and spark particles in the world layer. |
| Test | `ts0..ts3` | `practice` | Uses the reference attack anchors toward a training dummy; `hold` the bound weapon. |
| Rest | `sl0..sl1` | `sleep` | `lie: true`, `face: sleepy`, `marker: zzz`. |
| Carry | `ca0..ca3` | `carry` | Walk variant with `hold` + `holdF` crate. |
| Celebrate | `ce0..ce3` | `cheer` | Jump-in-place with arms up, `face: happy`. |
| Wait | `wa0..wa1` | `wait` | Standing idle, `marker: attention` or `approval` depending on cause. |

Body variants (ANI-03): the `build: 1` species (Orrok) widens the torso, and arms and legs already shift by `B`. Every new pose must be checked against all five species and the bulky outfits (`robe`, `suit`) in the contact sheet. Seated and lying poses must also be checked with every back accessory (wings, jetpack and cape are the risky ones) and with tall tops (wizard, long).

The exact anchor numbers for new poses are authored during T1.10 and T5.1 following [04_art-pipeline.md](04_art-pipeline.md); this doc fixes the mechanics, not the coordinates.

### Held items

`HELD_ITEMS` in `packages/guild-art/src/parts/held.ts` uses the `W()` weapon format. Initial set for Increment 1: `book`, `quill`, `hammer`, `scroll`. More items arrive with rooms (flask, mug, crate, lantern, map) in later increments.

Weapons become optional cosmetically: add weapon id `none` (appended to the registry). With `none`, `w` is ignored and nothing is drawn. Work poses use `stow` or `w: -1`, so a character's chosen weapon never blocks a work animation (ANI-04).

## Invariants

1. For every reference part and every reference pose, the port's frames and anchors equal the reference's exactly (parity test).
2. Part ids are never removed or reused; the registry is append-only.
3. Every frame fits the 48×42 grid; no new part may write outside it (the `Layer.set` bounds check already clips, but authored art must not rely on clipping — the art test asserts no pixel is clipped for any pose × part combination sampled).
4. Every combination of parts composes without throwing, for every pose (property test over seeded random appearances, at least 2,000 samples per run).
5. Sprite drawing on screen is always at integer positions and whole-number scale.
6. A sheet is a pure function of `(appearance, variant)`; the same input yields the same bytes.

## Failure and reverse states

- Unknown part id or schema version in stored data: the server refuses writes with that value; on read, the client draws a neutral silhouette and shows "Unknown appearance part `<id>`" in the profile instead of guessing. This should only happen if a database was edited by hand.
- Worker unavailable (old browser, CSP): fall back to building on the main thread during idle time (`requestIdleCallback`), one sheet per idle slot.
- A retired part stays renderable forever; un-retiring is just flipping the flag.

## Out of scope

- Any change to `index-24.html`.
- Smooth rotation, sub-pixel animation, skeletal animation or a new art style.
- Higher-resolution characters. The 48×42 frame is fixed.

## Acceptance checks

1. `vp test run packages/guild-art/test/referenceParity.test.ts` passes, and fails if one pixel of one head row is changed in the port (try it, then revert).
2. Property test: 2,000 seeded random appearances × all poses compose without error and without clipped pixels.
3. Appearance tests: PX2 and PX1 codes from the reference round-trip; reference JSON imports; unknown ids are rejected with a typed error; GLD1 round-trips every registry entry.
4. `scripts/render-sheets.ts` produces PNGs that match the reference's PNG export for the three presets (compare bytes of the decoded RGBA).
5. In the web app, a character drawn in the world, in a roster card and in a dialogue portrait is the same sheet (assert one cache entry per appearance in a browser test).

## Open questions

None for the port. Pose coordinates for new activities are authored in T1.10 and T5.1 and reviewed by the developer.
