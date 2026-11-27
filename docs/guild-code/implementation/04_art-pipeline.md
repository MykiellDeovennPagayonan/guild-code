# 04 — Art pipeline

> Status: Draft v1 (2026-11-27). Increments: 1 (first poses, first rooms, held items), 5 (full expansion). Decision U-005 governs this doc.

## Purpose

All new Guild art (character parts, action poses, held items, room props, tiles and backgrounds) is made by agents writing code in the reference's own format: ASCII rows of palette roles, automatic outlines, integer anchors. This doc is the style guide and the production loop that keeps that art consistent with [index-24.html](../index-24.html) while adding "more fantasy designs" (U-005).

## Read first

1. [03_sprite-system.md](03_sprite-system.md) (mechanics: frame, roles, poses, held items, appearance).
2. [../index-24.html](../index-24.html): every part definition (lines 279–621), poses (643–699), props and level drawing (1028–1104).

## Requirements covered

ART-03, ART-08, ANI-01, ANI-02, ANI-03, ANI-04, ANI-05, ANI-06, ANI-07.

## Non-negotiables (from the brief)

- "Preserve the proportions, exaggerated heads, expressive faces, strong outlines and playful fantasy-creature style. Do not replace it with realistic people, generated portraits, generic RPG sprites, vector avatars, 3D characters or an unrelated high-resolution art style." (ART-03)
- "Expand that palette into a cozy fantasy guild: wooden beams, stone walls, candles, lanterns, tapestries, fireplaces, bookshelves, desks, maps, anvils, banners, beds and magical portals." (ANI-05)
- "Keep background contrast lower than characters and important interactive objects." (ANI-06)
- "Avoid fractional sprite scaling, antialiased sprite edges and mismatched prop resolution." (ART-08)
- Decision U-005: new art is made by agent iteration "with same logic as the html file but with more fantasy designs".

## Design

### Authoring format

All art is code. No image files are committed as art sources.

- **Characters, held items, small props:** `px(rows, anchorX, anchorY)` ASCII rows using `ROLE_CHARS`, exactly like the reference. Fill only; `outline()` adds the dark edge.
- **Large props** (bookshelf, map table, anvil, hearth, portal, bed): a `PropLayer` that generalises `Layer` to any size (`new PropLayer(w, h, rootX, rootY)`) with the same `set/put/rect/outline` behaviour. Root is bottom-centre, on the floor line. Authored in ASCII the same way.
- **Tiles and backgrounds:** procedural drawing like the reference's `buildLevel` (flat fills, 1-px seams, hashed specks, lit top caps, darkened right/bottom edges), driven by a room palette (below). Repeating patterns use the reference's `hash(c, r)` so they are stable across reloads.

Everything renders through the same pipeline (`layerToImage` with a palette table), so props and characters share pixel size and outline weight (ART-08).

### Palette roles and what they mean

The reference encodes meaning in its roles. Keep it:

| Role                | Meaning in the reference                         | Use it for                                                              |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `O` (also `#`, `K`) | Outline, `#241432`                               | Automatic outline; occasional interior detail lines (eyes slits, seams) |
| `A a L`             | Primary colour, shade, light                     | Main garment, hat, banner field                                         |
| `B b`               | Secondary, shade                                 | Trousers, trims, second cloth                                           |
| `C c`               | Accent, shade                                    | Belts, hair, crests, fins                                               |
| `H h i`             | Body/skin of the species: base, shade, highlight | Heads, ears, tails                                                      |
| `E e`               | Eyes; eye accent or blush                        | Faces only                                                              |
| `S s`               | Hands/skin, shade                                | Hands, bare arms                                                        |
| `M m`               | Metal, shade (fixed)                             | Armour, tools, nails, hinges                                            |
| `D d`               | Wood/leather, shade (fixed)                      | Handles, furniture, books' covers                                       |
| `W w`               | Off-white, shade (fixed)                         | Paper, bone, cloth highlights                                           |
| `G g`               | Gold, shade (fixed)                              | Coins, trims, lamp flames, emblems                                      |
| `k j`               | Dark cloth, its light (fixed)                    | Ninja cloth, lamp posts, shadows on props                               |
| `X` / `x`           | Pure white / palette light                       | Effects only (slashes, sparkles); never outlined                        |
| `P`                 | Leg placeholder                                  | Remapped to the outfit's leg role                                       |

Rules:

- **Light comes from the top-left.** Highlights (`i`, `L`, `W`) sit on upper-left edges; shades (`h`, `a`, `b`, `c`, `s`, `m`, `d`) sit on the bottom row and right side. Look at any reference head: `i` near the top-left, `h` along the bottom.
- **Two-tone shading, not gradients.** A surface has a base and at most one shade and one highlight.
- **No new roles without a decision.** If a design truly needs a new fixed colour (e.g. a crystal cyan for portals), add a DEFAULT decision and append the role; never repurpose an existing role's meaning.
- **Environment palettes.** Rooms define their own colour table keyed by the same roles plus room-only tile colours (like the reference's `C` object: `sky, far, mid, base, seam, lite, dark, cap*`). Characters always keep their own palette.

### Style rules for characters

Measured from the reference; new parts must stay inside these ranges.

- Standing height about 24 px from feet to top of head (without tall hats). Heads are big: 11–15 px wide, 8–13 px tall. Torso about 9–11 px wide and 5 px tall. Legs 3–4 px.
- Faces are a 7×3 grid placed at the head's face anchor. Expressions use 1–3 px features. Never draw a mouth wider than 3 px or eyes larger than 3×3.
- Tops must work on all seven reference heads (and all new heads). Use the `hd` metrics (`hd.top`, `hd.L(y)`, `hd.R(y)`, `hd.shell(n)`, `hd.brow`, `hd.fx/fy`) like the reference does; never hard-code a head's width.
- Species changes the body under clothing (ears, fins, spines, tails, snouts, build). Keep the reference's split: `back`, `marks`, `front`, `tail`, `build`, `fist`.
- Weapons and held items are authored pointing N and NE only; other directions are exact quarter-turns (no smooth rotation).
- Silhouette first: a new part must read at 1× scale in the 48×42 frame. If it doesn't read as a dark-outlined shape at 1×, simplify it.

### "More fantasy" — direction for new content

The reference is playful creature-fantasy: soft chunky shapes, bright accents, simple faces. Extend it in that spirit. Proposed additions (each is a suggestion to author and review, not a commitment):

- **Species:** Mossling (leafy head sprouts, root toes), Owlkin (feather tufts, small beak via `front`), Emberling (flame wisps via `back`, warm glow highlight), Stonekin (`build: 1`, carved marks), Shroomfolk (cap integrated with head shell).
- **Heads:** Mushroom, Crystal, Skull-mask, Lantern, Bean.
- **Tops:** Witch hat (bent tip), Antlers, Mage cowl, Feathered cap, Bandana, Circlet with gem, Plague-doctor hood, Laurel.
- **Faces:** Monocle, Bearded, Starry-eyed, Wink, Determined, Spectacles.
- **Outfits** that hint at the classes without locking them: Ranger jerkin, Cleric vestment (with emblem), Paladin tabard, Artificer apron (with pockets), Scribe robe (ink-stained), Commander coat (epaulettes), Scout cloak, Archmage robe (star pattern).
- **Boots:** Curled slippers, Fur boots, Greaves, Roots (Mossling).
- **Backs:** Quiver, Spellbook satchel, Banner pole, Lute, Scroll case, Familiar (small owl/cat sitting on shoulder anchor).
- **Weapons:** Bow, Staff, Tome, War hammer, Dagger, Lantern staff, Spear, and `none`.
- **Palettes:** Arcane (violet/teal), Forest (green/brown), Royal (blue/gold), Rose (pink/cream), Dusk (indigo/orange), Frost (ice/silver).

Class identity in the world comes from a **class emblem** (a small icon above or beside the name plate and on the roster card) and from the **held item** in work poses, not from forcing outfits. Appearance stays random (REC-01, decision D-007).

### Action poses

Order of work (ANI-01): walk, sit, wait/attention marker, read, write and forge first (Increment 1–2, because they show real states), then think, converse, test, rest, carry and celebrate (Increment 2–5).

For each new pose family:

1. Start from the nearest reference pose and change as few anchors as possible.
2. Keep the reference's rhythm: 3–6 frames, 60–260 ms per frame, distance-driven for locomotion.
3. Put the impact or key frame where a viewer expects it (e.g. hammer contact), and mark it with `hit` in the clip for particle timing.
4. Check every species, both builds and the risky accessories (wings, jetpack, cape, tall tops, bulky outfits) in the contact sheet.

### Room art

Each room is a side view: floor line, back wall, mid-ground props, foreground props, parallax layers behind the wall's windows or arches.

- **Contrast hierarchy** (ANI-06): background walls and parallax use low-contrast, desaturated tones from the reference's purple-stone family (`C.far`, `C.mid`, `C.base` range). Interactable objects (doors, quest board, workstation, desk) use full-contrast props with outlines and at least one bright accent (gold `G`, palette `A`). Characters must remain the highest-contrast element in the scene. Check: the luminance difference between a character's outline and its immediate background must be larger than between any background element and its neighbour (the contrast check script computes this on the room PNG).
- **Cozy fantasy materials:** wooden beams (`D d` with `k` shadow lines), stone walls (reference brickwork), candles and lanterns (gold flame `G X` with the reference's dithered glow halo), tapestries and banners (palette `A a L` cloth with `G` trim), fireplaces (stone + animated flame), bookshelves (alternating book spines in `A B C D` roles), desks, maps (`W w` parchment with `D` lines), anvils (`M m` with `k`), beds, portals (ring of `M` with an animated interior).
- **Doors** are the most important prop: always full contrast, always the same footprint (about 20×28 px), always lit by a lamp, always labelled by the in-world prompt when near.

### Ambient animation

Allowed (ANI-07): lamp and candle flicker (2–3 frame palette swap at 200–400 ms), hearth flame (3–4 frames), dust motes (a handful of 1-px particles drifting slowly), subtle parallax, banner sway (row shear like the reference dummy, max 1 px). Not allowed: anything that redraws when the world view is hidden (14_performance-and-reliability.md), screen-filling effects, flashing faster than 3 Hz.

Audio (optional, later): independent mute toggles for ambient sound and UI sounds, default muted.

### Review loop

Every art change goes through this loop before it is shown to the developer:

1. **Render.** `vp run --filter @t3tools/guild-art render-sheets -- --out <scratchpad dir>` writes PNGs at 4× nearest-neighbour scale:
   - `parts-<category>.png`: every option of a category on the default character, labelled, plus the same row on species Orrok and Lopp.
   - `poses-<clip>.png`: every frame of a clip for five sample characters (one per species), right and left facing, with anchor dots optional (`--anchors`).
   - `props-<room>.png`: every prop for a room on its floor line.
   - `room-<id>.png`: a full room composition at logical resolution with three sample characters standing in it.
   - `reference.png`: the same layout rendered from the reference HTML (via the parity harness) for side-by-side comparison.
2. **Look.** Open the PNGs (the Read tool displays images). Compare against `reference.png` and this style guide.
3. **Self-check** against this list and fix before showing:
   - Outlines are automatic and unbroken; no stray single pixels; no clipped pixels at frame edges.
   - Light from top-left; two-tone shading.
   - Part fits every head / species / build shown.
   - Silhouette reads at 1×.
   - Background contrast lower than characters; doors and interactables clearly readable.
   - No colours outside the role tables.
4. **Show the developer.** Attach the PNG paths in the task report. The developer approves new art (agent-rules §4).
   - **Appearance parts** (anything in the random pool): add with `retired: true` until approved, then flip the flag.
   - **Poses, held items, markers, props, tiles and the weapon id `none`** are not in the random pool, so `retired` doesn't apply. A card that adds them isn't done until the developer has approved their contact sheets; until then they may exist in the branch but the card stays open.

The render script lives at `packages/guild-art/scripts/render-sheets.ts` and encodes PNGs itself (a minimal PNG writer over `node:zlib`; no new dependency).

## Invariants

1. Art is code in the role format; no binary art sources.
2. Every rendered pixel colour comes from a role table.
3. Characters are always the highest-contrast element against their immediate background.
4. Approved art only appears in random generation.

## Failure and reverse states

- Rejected art stays in the code with `retired: true` or is deleted before it ships. Once an id has shipped in a stored appearance it can only be retired, never deleted (03 invariant 2).

## Out of scope

- Generated images (AI image models), imported sprite packs, or hand-drawn bitmaps.
- Changing the reference's existing parts.

## Acceptance checks

1. The render script produces every listed PNG and `reference.png` matches the reference's own sheet export for the presets.
2. Every new part appears in a contact sheet reviewed and approved by the developer before `retired` is cleared.
3. The room contrast check passes for every room PNG.

## Open questions

None. Art taste is decided per review by the developer.
