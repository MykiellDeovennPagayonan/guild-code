import { expect, it } from "vite-plus/test";
import { DEFAULT_APPEARANCE } from "../src/appearance.ts";
import { buildParts, composeFrame } from "../src/compose.ts";
import { OUT, PropLayer, RI, px } from "../src/frame.ts";
import { MARKERS, MARKER_TABLE } from "../src/markers.ts";
import { layerToRGBA } from "../src/palettes.ts";
import { POSES } from "../src/poses.ts";
import { PROPS, ROOM_PROPS } from "../src/props/index.ts";
import { ROOM_PALETTES } from "../src/props/palettes.ts";
import { drawBackWall, drawStoneFloor, drawWoodenBeam, hash } from "../src/props/tiles.ts";

it("outlines root-relative stamps and resolves transparent and filled pixels through the palette", () => {
  const layer = new PropLayer(13, 7);
  expect([layer.rootX, layer.rootY]).toEqual([6, 7]);
  layer.put(px(["DD", ".D"]), 0, -4, { flip: true });
  layer.rect(0, -3, 2, 1, RI.G);
  layer.outline();

  expect(layer.get(-1, -4)).toBe(RI.D);
  expect(layer.get(1, -3)).toBe(RI.G);
  expect(layer.get(2, -2)).toBe(OUT);
  expect(layer.get(3, -2)).toBe(0);
  expect(layer.clipped).toBe(false);
  const table = ROOM_PALETTES.guild_hall;
  const { width, height, data } = layerToRGBA(layer, table);
  expect([width, height, data.length]).toEqual([13, 7, 364]);
  expect([...data.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
  const offset = ((layer.rootY - 3) * width + layer.rootX + 1) * 4;
  expect([...data.subarray(offset, offset + 4)]).toEqual([...table[RI.G]!, 255]);

  layer.set(0, 0, RI.D);
  expect(layer.clipped).toBe(true);
});

it("keeps every prop frame inside its footprint and resolves its roles in both room palettes", () => {
  for (const [id, art] of Object.entries(PROPS)) {
    const bounds = [art.frames[0]!.width, art.frames[0]!.height];
    for (const frame of art.frames) {
      expect([frame.width, frame.height], id).toEqual(bounds);
      expect(frame.clipped, id).toBe(false);
      expect(
        frame.d.some((role) => role === OUT),
        id,
      ).toBe(true);
      for (const table of Object.values(ROOM_PALETTES)) {
        expect(
          layerToRGBA(frame, table).data.some((byte) => byte !== 0),
          id,
        ).toBe(true);
      }
    }
    expect(new Set(art.frames.map((frame) => frame.d.join(","))).size, id).toBe(art.frames.length);
  }
  expect(PROPS.door.frames[0]).toMatchObject({ width: 20, height: 28 });
  expect(ROOM_PROPS.guild_hall).toContain("door");
  expect(ROOM_PROPS.recruitment_hall).toContain("door");
});

it("draws deterministic timber and stone tiles with a lit floor edge", () => {
  function draw() {
    const layer = new PropLayer(48, 36, 0, 0);
    drawBackWall(layer, 0, 0, 4, 2);
    drawWoodenBeam(layer, 0, 0, 24, 4, "horizontal");
    drawWoodenBeam(layer, 0, 4, 20, 4, "vertical");
    drawStoneFloor(layer, 0, 24, 4, 1);
    return layer;
  }
  const layer = draw();
  expect(layer.clipped).toBe(false);
  expect(layer.d).toEqual(draw().d);
  expect(hash(13, 7)).toBe(4132260045);
  expect(layer.get(4, 24)).not.toBe(layer.get(4, 25));
  expect(layer.get(9, 1)).not.toBe(layer.get(9, 4));
});

it("places status markers above tall hats as separate, readable layers", () => {
  const parts = buildParts({ ...DEFAULT_APPEARANCE, head: "tall", top: "wizard" });
  const pose = POSES.wr0!;
  const plain = composeFrame(parts, pose);
  const top = Math.floor(plain.layer.d.findIndex(Boolean) / plain.layer.width) - plain.layer.rootY;
  for (const id of ["attention", "approval", "question", "offline", "zzz"] as const) {
    const { layer, marker } = composeFrame(parts, { ...pose, marker: id });
    expect(layer.d).toEqual(plain.layer.d);
    expect(marker?.anchor).toEqual([plain.anchors.head[0], top - 2]);
    expect(marker?.layer).toBe(MARKERS[id]);
    expect(MARKERS[id].clipped).toBe(false);
    expect(layerToRGBA(MARKERS[id], MARKER_TABLE).data.some((byte) => byte !== 0)).toBe(true);
  }
});
