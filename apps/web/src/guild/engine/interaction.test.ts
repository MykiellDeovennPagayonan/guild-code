import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import { describe, expect, it } from "vite-plus/test";

import { SCENES } from "../world/scenes";
import { GuildKeys } from "./input";
import { selectTarget } from "./interaction";
import type { NpcEntity } from "./npc";
import { TILE } from "./player";
import type { DoorDef } from "./scene";

const door = SCENES.guild_hall.doors[0]!;
const npc: NpcEntity = {
  id: "mira",
  kind: "npc",
  name: "Mira",
  x: door.x,
  y: door.y,
  width: 20,
  height: 22,
  sceneId: "guild_hall",
  facing: 1,
  appearance: DEFAULT_APPEARANCE,
  clip: "idle",
};

describe("Guild interactions", () => {
  it("has one reversible door pair on flat walkable routes", () => {
    const scenes = Object.values(SCENES);
    expect(scenes.flatMap((scene) => scene.doors)).toHaveLength(2);
    for (const scene of scenes) {
      const row = scene.spawn.y / TILE;
      expect(scene.tiles[row]).toBe("#".repeat(scene.cols));
      expect(scene.tiles.slice(0, row).every((tiles) => /^\.+$/.test(tiles))).toBe(true);
      for (const exit of scene.doors) {
        const entrance = SCENES[exit.target].doors.find(({ id }) => id === exit.targetDoor);
        expect(entrance).toMatchObject({ target: scene.id, targetDoor: exit.id });
      }
    }
  });

  it("picks an NPC over an overlapping door and prefers the faced target in a tie", () => {
    expect(selectTarget([door, npc], door.x - 3, door.y, 1)).toBe(npc);
    const left: DoorDef = { ...door, x: door.x - 7 };
    const right: NpcEntity = { ...npc, x: door.x + 6 };
    expect(selectTarget([right, left], door.x, door.y, -1)).toBe(left);
    expect(selectTarget([left, right], door.x, door.y, 1)).toBe(right);
    expect(selectTarget([left, right], door.x, door.y - 25, 1)).toBeUndefined();
  });

  it("uses the nearest anchor for the two-pixel tie band and id for equal priority", () => {
    const near = { ...door, id: "b", x: 105 };
    const tied = { ...door, id: "a", x: 107 };
    const outside = { ...npc, x: 109 };
    expect(selectTarget([outside, tied, near], 100, door.y, 1)).toBe(tied);
    expect(selectTarget([near, tied, outside], 100, door.y, 1)).toBe(tied);
  });

  it("emits one E edge until a release and ignores a repeat after blur", () => {
    const keys = new GuildKeys();
    keys.keyDown("KeyE", false);
    expect(keys.interactPressed).toBe(true);
    keys.consumeEdges();
    keys.keyDown("KeyE", true);
    keys.keyDown("KeyE", false);
    expect(keys.interactPressed).toBe(false);
    keys.keyUp("KeyE");
    keys.keyDown("KeyE", false);
    expect(keys.interactPressed).toBe(true);
    keys.clear();
    keys.keyDown("KeyE", true);
    expect(keys.interactPressed).toBe(false);
  });
});
