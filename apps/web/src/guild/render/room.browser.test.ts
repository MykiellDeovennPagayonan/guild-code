import { RI } from "@t3tools/guild-art/frame";
import { ROOM_PALETTES } from "@t3tools/guild-art/props/palettes";
import { expect, it, vi } from "vite-plus/test";

import { VIEW_HEIGHT, VIEW_WIDTH } from "../engine/camera";
import { pickTarget } from "../engine/interaction";
import { Scene, type SceneId } from "../engine/scene";
import { SCENES } from "../world/scenes";
import { canvasContext } from "./pixelDisplay";
import { WINDOW_TOP } from "./room";

const rooms: ReadonlyArray<{
  id: SceneId;
  anchors: readonly (readonly [x: number, y: number, role: number, targetId?: string])[];
}> = [
  {
    id: "guild_hall",
    anchors: [
      [44, 173, RI.G],
      [157, 141, RI.W, "quest_board"],
      [374, 145, RI.G, "bell"],
      [448, 164, RI.G, "recruitment"],
    ],
  },
  {
    id: "recruitment_hall",
    anchors: [
      [32, 164, RI.G, "guild"],
      [130, 173, RI.a, "reception"],
      [227, 183, RI.A],
    ],
  },
];

function pixel(context: CanvasRenderingContext2D, x: number, y: number) {
  return [...context.getImageData(x, y, 1, 1).data];
}

it.each(rooms)("draws $id props on a cached backdrop", ({ id, anchors }) => {
  using rasterize = vi.spyOn(CanvasRenderingContext2D.prototype, "putImageData");
  const def = SCENES[id];
  const scene = new Scene(def);
  const room = canvasContext(scene.width, scene.height);
  const view = canvasContext(VIEW_WIDTH, VIEW_HEIGHT);
  const palette = ROOM_PALETTES[id];
  const targets = [...def.doors, ...def.interactables];
  const tileLayers = rasterize.mock.calls.filter(
    ([pixels]) => pixels.width === scene.width && pixels.height === scene.height,
  );
  expect(tileLayers).toHaveLength(1);
  const rasterizations = rasterize.mock.calls.length;

  scene.draw(room, 0, 0, true);
  for (const [x, y, role, targetId] of anchors) {
    expect(pixel(room, x, y)).toEqual([...palette[role]!, 255]);
    if (targetId) expect(pickTarget(targets, x, y)?.id).toBe(targetId);
  }

  const cameraX = scene.width - VIEW_WIDTH;
  scene.draw(view, cameraX, 0, false);
  const windows = view.getImageData(0, WINDOW_TOP, VIEW_WIDTH, 51).data;
  scene.draw(view, cameraX, 0, true);
  const stationaryWindows = view.getImageData(0, WINDOW_TOP, VIEW_WIDTH, 51).data;
  expect(windows.some((channel, index) => channel !== stationaryWindows[index])).toBe(true);
  expect(rasterize).toHaveBeenCalledTimes(rasterizations);
  expect(pixel(view, 3, 15)).toEqual(pixel(room, cameraX + 3, 15));
});

it("advances hearth and lantern frames on visible draws and uses frame zero for reduced motion", () => {
  using focused = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  using _visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  using now = vi.spyOn(performance, "now").mockReturnValue(0);
  const scene = new Scene(SCENES.guild_hall);
  const view = canvasContext(VIEW_WIDTH, VIEW_HEIGHT);
  const palette = ROOM_PALETTES.guild_hall;
  const gold = [...palette[RI.G]!, 255];
  const highlight = [...palette[RI.X]!, 255];
  const hearth = () => pixel(view, 44, 173);
  const lantern = () => pixel(view, 96, 118);

  scene.draw(view, 0, 0, false);
  expect(hearth()).toEqual(gold);
  expect(lantern()).toEqual(gold);
  for (const time of [90, 180, 270]) {
    now.mockReturnValue(time);
    scene.draw(view, 0, 0, false);
  }
  expect(hearth()).toEqual(highlight);
  expect(lantern()).toEqual(gold);
  now.mockReturnValue(360);
  scene.draw(view, 0, 0, false);
  expect(lantern()).toEqual(highlight);

  focused.mockReturnValue(false);
  now.mockReturnValue(390);
  scene.draw(view, 0, 0, false);
  focused.mockReturnValue(true);
  now.mockReturnValue(1250);
  scene.draw(view, 0, 0, false);
  expect(lantern()).toEqual(highlight);

  scene.draw(view, 0, 0, true);
  expect(hearth()).toEqual(gold);
  expect(lantern()).toEqual(gold);
});
