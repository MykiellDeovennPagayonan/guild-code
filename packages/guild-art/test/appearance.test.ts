import { expect, it } from "vite-plus/test";
import {
  AppearanceError,
  DEFAULT_APPEARANCE,
  exportAppearance,
  importAppearance,
  parseAppearance,
} from "../src/appearance.ts";
import { CATS } from "../src/parts/registry.ts";
import { loadReference } from "./reference.ts";

it("round-trips the reference's PX2, PX1, and JSON appearances", () => {
  const { reference } = loadReference();
  for (const cfg of reference.PRESETS) {
    const { code, ...appearance } = reference.toJSON(cfg);
    expect(importAppearance(`#${code.toLowerCase()}`)).toEqual(appearance);
    expect(exportAppearance(appearance, "PX2")).toBe(code);
    expect(importAppearance(JSON.stringify(reference.toJSON(cfg)))).toEqual(appearance);

    const px1 = `PX1-${code.slice(5)}`;
    const { species: _species, ...withoutSpecies } = appearance;
    const nub = { ...withoutSpecies, species: "nub" };
    expect(importAppearance(px1)).toEqual(nub);
    expect(exportAppearance(nub, "PX1")).toBe(px1);
    expect(importAppearance(JSON.stringify(withoutSpecies))).toEqual(nub);
    expect(importAppearance(JSON.stringify(cfg))).toEqual(appearance);
  }
  expect(exportAppearance({ ...DEFAULT_APPEARANCE, species: "lopp" }, "PX1")).toBeUndefined();
  expect(exportAppearance({ ...DEFAULT_APPEARANCE, weapon: "none" }, "PX2")).toBeUndefined();
});

it("round-trips every registry entry through GLD1", () => {
  for (const { key, list } of CATS) {
    for (const { id } of list) {
      const appearance = { ...DEFAULT_APPEARANCE, [key]: id };
      const code = exportAppearance(appearance)!;
      expect(code).toMatch(/^GLD1-[0-9a-z]{18}$/);
      expect(importAppearance(code)).toEqual(appearance);
    }
  }
});

it("reports malformed formats, unknown IDs or indices, and unsupported versions", () => {
  expect(() => importAppearance("{")).toThrow(AppearanceError);
  expect(() => importAppearance("PX1-0000000")).toThrow(AppearanceError);
  expect(() => importAppearance("PX2-000000040")).toThrow(
    expect.objectContaining({ issue: { kind: "unknown-part", category: "weapon", value: 4 } }),
  );
  expect(() => parseAppearance({ ...DEFAULT_APPEARANCE, head: "unknown" })).toThrow(
    expect.objectContaining({
      issue: { kind: "unknown-part", category: "head", value: "unknown" },
    }),
  );
  expect(() => parseAppearance({ ...DEFAULT_APPEARANCE, head: 0 })).toThrow(AppearanceError);
  expect(() => parseAppearance({ ...DEFAULT_APPEARANCE, head: { toString: null } })).toThrow(
    AppearanceError,
  );
  expect(() => parseAppearance({ ...DEFAULT_APPEARANCE, v: 2 })).toThrow(
    expect.objectContaining({ issue: { kind: "unsupported-version", version: 2 } }),
  );
  expect(() => importAppearance("GLD2-000000000000000000")).toThrow(
    expect.objectContaining({ issue: { kind: "unsupported-version", version: "2" } }),
  );
});
