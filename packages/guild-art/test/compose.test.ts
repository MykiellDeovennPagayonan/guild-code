import * as NodeAssert from "node:assert/strict";
import { expect, it } from "vite-plus/test";
import { DEFAULT_APPEARANCE } from "../src/appearance.ts";
import { buildParts, composeFrame } from "../src/compose.ts";
import { Layer } from "../src/frame.ts";
import { getPart } from "../src/parts/registry.ts";
import { POSES, POSE_DEF } from "../src/poses.ts";
import { randomAppearance, seededRng } from "../src/random.ts";

it("composes 2,000 seeded appearances through every pose without clipping", () => {
  const rng = seededRng(2438);
  for (let i = 0; i < 2_000; i++) {
    const random = randomAppearance(rng);
    const appearance = i % 5 === 0 ? { ...random, weapon: "none" } : random;
    const parts = buildParts(appearance);
    for (const [name, pose] of Object.entries(POSES)) {
      const { layer } = composeFrame(parts, pose);
      NodeAssert.equal(layer.mirrored().clipped, false, `sample ${i}, ${name}`);
      NodeAssert.equal(
        composeFrame(parts, { ...pose, stow: true }).layer.mirrored().clipped,
        false,
        `sample ${i}, stowed ${name}`,
      );
    }
  }
});

it("tracks pixels lost to writes, outlining, blitting, and root-relative mirroring", () => {
  const edge = new Layer();
  edge.set(-24, 0, 1);
  expect(edge.clipped).toBe(false);
  expect(edge.mirrored().clipped).toBe(true);
  expect(new Layer().blit(edge, -1, 0).clipped).toBe(true);
  expect(new Layer().blit(edge, 0, 4).clipped).toBe(true);
  expect(edge.outline().clipped).toBe(true);
  const outside = new Layer();
  outside.set(24, 0, 1);
  expect(outside.clipped).toBe(true);
});

it("omits hidden weapons and stows a weapon behind the torso at the back anchor", () => {
  const parts = buildParts(DEFAULT_APPEARANCE);
  const none = buildParts({ ...DEFAULT_APPEARANCE, weapon: "none" });
  const hidden = composeFrame(parts, { ...POSE_DEF, w: -1 });
  expect(hidden.layer.d).toEqual(composeFrame(none, POSE_DEF).layer.d);
  expect(hidden.layer.d).toEqual(composeFrame(none, { ...POSE_DEF, stow: true }).layer.d);
  const stowed = composeFrame(parts, { ...POSE_DEF, stow: true });
  const expected = new Layer()
    .put(getPart("weapon", "blade").ne, ...hidden.anchors.back, { rot: 2 })
    .outline()
    .blit(hidden.layer, 0, 0);
  expect(stowed.layer.d).not.toEqual(hidden.layer.d);
  expect(stowed.layer.d).toEqual(expected.d);
  expect(stowed.anchors).toEqual(hidden.anchors);
});

it("replays the seed and keeps locked choices, including the no-weapon choice", () => {
  const base = { ...DEFAULT_APPEARANCE, weapon: "none" };
  const rng = seededRng(7);
  const replay = seededRng(7);
  for (let i = 0; i < 30; i++) {
    const options = { locks: { weapon: true, head: true }, base };
    const appearance = randomAppearance(rng, options);
    expect(appearance).toEqual(randomAppearance(replay, options));
    expect(appearance.weapon).toBe("none");
    expect(appearance.head).toBe(base.head);
    expect(randomAppearance(rng).weapon).not.toBe("none");
    randomAppearance(replay);
  }
});
