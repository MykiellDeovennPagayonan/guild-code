import { CLIPS, STRIDE } from "@t3tools/guild-art/poses";

export const TILE = 12;

const RUN = 66;
const JUMP_H = 33;
const RISE_T = 0.4;
const FALL_T = 0.34;
const HANG_K = 0.18;
const HANG_G = 0.5;
const RELEASE_G = 3;
const AIR_H = 0.8;
const FALL_CAP = 225;
const LAND_V = 98;
const HALF_WIDTH = 4;
const HEIGHT = 15;

// jumpTime is fixed at 1.00. The low-gravity hang supplies the rest of the height.
const baseHeight = JUMP_H / (1 + HANG_K * HANG_K);
const launch = (2 * baseHeight) / RISE_T;
const gravityUp = (2 * baseHeight) / (RISE_T * RISE_T);
const gravityDown = (2 * JUMP_H) / (FALL_T * FALL_T);
const hangVelocity = HANG_K * launch;
const airLaunch = launch * Math.sqrt(AIR_H);

export interface CollisionMap {
  readonly height: number;
  solid(col: number, row: number): boolean;
  floor(col: number, row: number): boolean;
}

export type Facing = -1 | 1;

export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly jumpPressed: boolean;
}

interface PlayerEffects {
  puff(x: number, y: number, count: number, spread: number, up: number): void;
  sparks(x: number, y: number): void;
}

type MovementClip = "idle" | "rise" | "air" | "fall" | "land" | "run";

const approach = (value: number, target: number, delta: number) =>
  value < target ? Math.min(target, value + delta) : Math.max(target, value - delta);

export class Player {
  vx = 0;
  vy = 0;
  ground = true;
  clip: MovementClip = "idle";
  frame = 0;
  coyote = 0;
  jumpBuffer = 0;
  airJumps = 1;
  blink = 0;
  private jumping = false;
  private frameTime = 0;
  private clipDone = false;
  private runDistance = 0;
  private readonly safe: { x: number; y: number };

  constructor(
    public x: number,
    public y: number,
    public facing: Facing = 1,
  ) {
    this.safe = { x, y };
  }

  pose(freezeIdle: boolean) {
    return CLIPS[this.clip].f[freezeIdle && this.clip === "idle" ? 0 : this.frame]![0];
  }

  private setClip(clip: MovementClip) {
    this.clip = clip;
    this.frame = 0;
    this.frameTime = 0;
    this.clipDone = false;
  }

  private advance(ms: number, loop: boolean) {
    const frames = CLIPS[this.clip].f;
    this.frameTime += ms;
    while (this.frameTime >= frames[this.frame]![1]) {
      this.frameTime -= frames[this.frame]![1];
      if (this.frame + 1 < frames.length) {
        this.frame++;
      } else if (loop) {
        this.frame = 0;
      } else {
        this.clipDone = true;
        this.frameTime = 0;
        return;
      }
    }
  }

  private gravity(held: boolean) {
    if (this.vy < 0) {
      if (this.jumping && !held) return gravityUp * RELEASE_G;
      return held && this.jumping && -this.vy < hangVelocity ? gravityUp * HANG_G : gravityUp;
    }
    return held && this.jumping && this.vy < hangVelocity ? gravityUp * HANG_G : gravityDown;
  }

  private groundSoon(map: CollisionMap) {
    if (this.vy <= 0) return false;
    const distance = Math.max(3, this.vy * 0.08);
    const left = Math.floor((this.x - HALF_WIDTH) / TILE);
    const right = Math.floor((this.x + HALF_WIDTH - 0.001) / TILE);
    for (
      let row = Math.floor(this.y / TILE);
      row <= Math.floor((this.y + distance) / TILE);
      row++
    ) {
      for (let col = left; col <= right; col++) {
        if (map.floor(col, row) && row * TILE >= this.y - 0.01) return true;
      }
    }
    return false;
  }

  step(dt: number, input: PlayerInput, map: CollisionMap, effects?: PlayerEffects) {
    const direction = input.left === input.right ? 0 : input.right ? 1 : -1;
    this.jumpBuffer = input.jumpPressed ? 0.12 : Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.ground ? 0.09 : Math.max(0, this.coyote - dt);
    this.blink = Math.max(0, this.blink - dt);

    if (direction) {
      if (this.ground && Math.abs(this.vx) > 38 && Math.sign(this.vx) !== direction) {
        effects?.puff(this.x, this.y - 1, 4, 22, 22);
      }
      this.facing = direction;
    }
    const acceleration = this.ground ? (direction ? 570 : 675) : direction ? 420 : 135;
    this.vx = approach(this.vx, direction * RUN, acceleration * dt);
    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.vy = -launch;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.ground = false;
        this.jumping = true;
        this.setClip("rise");
        effects?.puff(this.x, this.y - 1, 5, 27, 14);
      } else if (!this.ground && this.airJumps > 0 && !this.groundSoon(map)) {
        this.vy = Math.min(this.vy, -airLaunch);
        this.jumpBuffer = 0;
        this.airJumps--;
        this.jumping = true;
        this.setClip("air");
        effects?.sparks(this.x, this.y - 1);
      }
    }

    const oldX = this.x;
    const wasGround = this.ground;
    const distance =
      Math.max(Math.abs(this.vx), Math.abs(this.vy) + gravityUp * RELEASE_G * dt) * dt;
    const substeps = Math.min(32, Math.max(1, Math.ceil(distance / 3)));
    const step = dt / substeps;
    let fallVelocity = 0;
    for (let i = 0; i < substeps; i++) {
      this.x += this.vx * step;
      if (this.vx !== 0) {
        const col = Math.floor((this.x + Math.sign(this.vx) * HALF_WIDTH) / TILE);
        for (
          let row = Math.floor((this.y - HEIGHT) / TILE);
          row <= Math.floor((this.y - 0.01) / TILE);
          row++
        ) {
          if (map.solid(col, row)) {
            this.x = this.vx > 0 ? col * TILE - HALF_WIDTH - 0.001 : (col + 1) * TILE + HALF_WIDTH;
            this.vx = 0;
            break;
          }
        }
      }

      const gravity = this.gravity(input.jump);
      const dy = this.vy * step + 0.5 * gravity * step * step;
      this.vy = Math.min(FALL_CAP, this.vy + gravity * step);
      this.y += dy;
      this.ground = false;
      const left = Math.floor((this.x - HALF_WIDTH) / TILE);
      const right = Math.floor((this.x + HALF_WIDTH - 0.001) / TILE);
      if (dy >= 0) {
        const row = Math.floor(this.y / TILE);
        for (let col = left; col <= right; col++) {
          if (map.floor(col, row) && this.y - dy <= row * TILE + 0.01) {
            fallVelocity = Math.max(fallVelocity, this.vy);
            this.y = row * TILE;
            this.vy = 0;
            this.ground = true;
            break;
          }
        }
      } else {
        const row = Math.floor((this.y - HEIGHT) / TILE);
        for (let col = left; col <= right; col++) {
          if (map.solid(col, row)) {
            this.y = (row + 1) * TILE + HEIGHT;
            this.vy = 0;
            this.jumping = false;
            break;
          }
        }
      }
    }

    if (this.ground) {
      this.jumping = false;
      this.airJumps = 1;
      const row = Math.floor(this.y / TILE);
      if (
        map.floor(Math.floor((this.x - 7) / TILE), row) &&
        map.floor(Math.floor((this.x + 7) / TILE), row)
      ) {
        this.safe.x = this.x;
        this.safe.y = this.y;
      }
    }
    if (this.y > map.height + 45) {
      this.x = this.safe.x;
      this.y = this.safe.y;
      this.vx = this.vy = 0;
      this.blink = 0.7;
      this.setClip("idle");
      this.ground = true;
      this.jumping = false;
      this.airJumps = 1;
    }
    const hardLanding = !wasGround && this.ground && fallVelocity > LAND_V;
    if (hardLanding) effects?.puff(this.x, this.y - 1, 6, 33, 12);

    if (!this.ground) {
      if (this.clip === "air" && !this.clipDone) {
        this.advance(dt * 1000, false);
      } else if (this.vy < 0) {
        if (this.clip !== "rise") {
          const fromAir = this.clip === "air";
          this.setClip("rise");
          if (fromAir) this.frame = 1;
        }
        if (!this.clipDone) this.advance(dt * 1000, false);
      } else {
        if (this.clip !== "fall") this.setClip("fall");
        this.advance(dt * 1000, true);
      }
    } else if (hardLanding) {
      this.setClip("land");
    } else if (this.clip === "land" && !this.clipDone && !(direction && this.frame >= 2)) {
      this.advance(dt * 1000, false);
    } else if (Math.abs(this.vx) > 8) {
      if (this.clip !== "run") {
        this.setClip("run");
        this.runDistance = 0;
      }
      this.runDistance += Math.abs(this.x - oldX);
      this.frame = Math.floor(this.runDistance / STRIDE) % CLIPS.run.f.length;
    } else {
      if (this.clip !== "idle") this.setClip("idle");
      this.advance(dt * 1000, true);
    }
  }
}
