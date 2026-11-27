import * as NodeAssert from "node:assert/strict";
import { expect, it } from "vite-plus/test";
import { buildParts, composeFrame } from "../src/compose.ts";
import { PALETTES, paletteTable } from "../src/palettes.ts";
import { CATS } from "../src/parts/registry.ts";
import { CLIPS, POSES, POSE_NAMES } from "../src/poses.ts";
import { seededRng } from "../src/random.ts";
import { buildSheetFrames, toRGBA } from "../src/sheet.ts";
import { loadReference } from "./reference.ts";

it("matches the three presets and 200 seeded configurations in every reference pose", () => {
  const { reference } = loadReference();
  expect(POSE_NAMES).toEqual(reference.POSE_NAMES);
  expect(CLIPS).toEqual(reference.CLIPS);
  expect(
    CATS.map(({ key, list, referenceCount }) => ({
      key,
      ids: list.slice(0, referenceCount).map(({ id }) => id),
    })),
  ).toEqual(reference.CATS.map(({ key, list }) => ({ key, ids: list.map(({ id }) => id) })));

  const rng = seededRng(24);
  const configs = [
    ...reference.PRESETS,
    ...Array.from(
      { length: 200 },
      () =>
        Object.fromEntries(
          reference.CATS.map(({ key, list }) => [key, Math.floor(rng() * list.length)]),
        ) as (typeof reference.PRESETS)[number],
    ),
  ];
  for (const cfg of configs) {
    const original = reference.buildParts(cfg);
    const appearance = reference.toJSON(cfg);
    const port = buildParts(appearance);
    for (const name of reference.POSE_NAMES) {
      const expected = reference.composeFrame(original, reference.POSES[name]!);
      const actual = composeFrame(port, POSES[name]!);
      const label = `${appearance.code} / ${name}`;
      NodeAssert.equal(
        Buffer.compare(actual.layer.d, expected.layer.d),
        0,
        `${label} right pixels`,
      );
      NodeAssert.equal(
        Buffer.compare(actual.layer.mirrored().d, expected.layer.mirrored().d),
        0,
        `${label} mirrored pixels`,
      );
      expect(actual.anchors, label).toEqual(expected.anchors);
    }
  }
});

it("matches all eight palette tables and the RGBA bytes of each preset PNG export", () => {
  const { reference, renderReferenceSheet } = loadReference();
  expect(PALETTES.map(({ id }) => id)).toEqual(reference.PALETTES.map(({ id }) => id));
  for (const [i, palette] of PALETTES.entries()) {
    expect(paletteTable(palette)).toEqual(reference.paletteTable(reference.PALETTES[i]!));
  }
  for (const cfg of reference.PRESETS) {
    const data = toRGBA(
      buildSheetFrames(reference.toJSON(cfg)),
      paletteTable(PALETTES[cfg.palette]!),
    );
    expect(
      Buffer.compare(Buffer.from(data.buffer), Buffer.from(renderReferenceSheet(cfg).data.buffer)),
    ).toBe(0);
  }
});
