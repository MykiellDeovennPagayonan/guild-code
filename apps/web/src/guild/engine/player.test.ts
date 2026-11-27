import { describe, expect, it } from "vite-plus/test";

import { STEP } from "./loop";
import { Player, TILE, type CollisionMap, type PlayerInput } from "./player";

const START_Y = 120;
const floorRow = START_Y / TILE;
const solidFloor = (_col: number, row: number) => row === floorRow;
const flat: CollisionMap = { height: 144, solid: solidFloor, floor: solidFloor };
const still = { left: false, right: false, jump: false, jumpPressed: false };
const holdJump = { ...still, jump: true };
const pressJump = { ...holdJump, jumpPressed: true };

function step(player: Player, count: number, input: PlayerInput, map = flat) {
  for (let i = 0; i < count; i++) player.step(STEP, input, map);
}

function jumpHeight(player: Player) {
  const origin = player.y;
  let top = origin;
  player.step(STEP, pressJump, flat);
  for (let i = 0; i < 65; i++) {
    top = Math.min(top, player.y);
    player.step(STEP, holdJump, flat);
  }
  return origin - top;
}

describe("reference movement", () => {
  it("reaches a held apex of 33 px and launches a double jump at 80% height", () => {
    const player = new Player(60, START_Y);
    const first = jumpHeight(player);
    expect(first).toBeCloseTo(33, 0);
    expect(player.ground).toBe(false);
    const second = jumpHeight(player);
    expect(second / first).toBeCloseTo(0.8, 1);
    expect(player.airJumps).toBe(0);
  });

  it("allows a coyote jump for 0.09 s, then spends the air jump", () => {
    const voidMap = { height: 144, solid: () => false, floor: () => false };
    for (const [ticks, airJumps] of [
      [10, 1],
      [11, 0],
    ] as const) {
      const player = new Player(60, START_Y);
      player.step(STEP, still, voidMap);
      expect(player.coyote).toBe(0.09);
      step(player, ticks - 1, still, voidMap);
      player.step(STEP, pressJump, voidMap);
      expect(player.vy).toBeLessThan(0);
      expect(player.airJumps).toBe(airJumps);
    }
  });

  it("buffers presses near landing for 0.12 s without spending an air jump", () => {
    const player = new Player(60, START_Y - 6);
    player.ground = false;
    player.vy = 100;
    player.step(STEP, pressJump, flat);
    expect(player.jumpBuffer).toBe(0.12);
    expect(player.airJumps).toBe(1);
    step(player, 8, holdJump);
    expect(player.vy).toBeLessThan(0);
    expect(player.jumpBuffer).toBe(0);
    expect(player.airJumps).toBe(1);
  });

  it("lands on a one-tile-thick platform at the 225 px/s fall cap and respawns from a gap", () => {
    const player = new Player(60, START_Y);
    const platform = (col: number, row: number) => row === floorRow && col >= 4 && col <= 5;
    const map = { height: 144, solid: platform, floor: platform };
    player.step(STEP, still, map);
    player.y = START_Y - 70;
    player.ground = false;
    step(player, 50, still, map);
    expect(player.vy).toBe(225);
    step(player, 40, still, map);
    expect(player.y).toBe(START_Y);
    expect(player.ground).toBe(true);
    expect(player.vy).toBe(0);

    step(player, 60, { ...still, right: true }, map);
    step(player, 90, still, map);
    expect(player.y).toBe(START_Y);
    expect(player.x).toBeLessThan(6 * TILE - 7);
  });
});
