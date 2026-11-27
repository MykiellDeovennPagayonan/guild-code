import { RI, type Pixel, type Point } from "./frame.ts";

function crescent(
  cx: number,
  cy: number,
  r: number,
  ox: number,
  oy: number,
  r2: number,
  thin: number,
) {
  const out: Pixel[] = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const ex = dx - ox,
        ey = dy - oy,
        d2 = ex * ex + ey * ey;
      if (d2 <= r2 * r2 + r2) continue;
      if (cy + dy > -1) continue;
      const edge = d2 <= (r2 + 1.6) * (r2 + 1.6) || dx * dx + dy * dy > (r - 1.2) * (r - 1.2);
      out.push([cx + dx, cy + dy, thin ? RI.x : edge ? RI.x : RI.X]);
    }
  return out;
}
export const FX = {
  A0: crescent(11, -10, 8, -4, 1, 8, 0),
  A1: crescent(12, -9, 8, -2, 1, 8, 1),
  B0: crescent(10, -13, 9, -3, 3, 9, 0),
  B1: crescent(10, -14, 9, -2, 2, 9, 1),
};

export type Foot = readonly [x: number, y: number, tip: 0 | 1];
// Clockwise from north in quarter-turn variants of N and NE. -1 hides the weapon.
type WeaponDirection = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Body and feet use root coordinates. Head, hands, and shoulders use body coordinates.
export interface Pose {
  readonly b: Point;
  readonly h: Point;
  readonly hN: Point;
  readonly hF: Point;
  readonly sN: Point;
  readonly sF: Point;
  readonly fN: Foot;
  readonly fF: Foot;
  readonly w: WeaponDirection;
  readonly wz: 0 | 1;
  readonly cape: number;
  readonly fx: keyof typeof FX | null;
  readonly stow?: boolean;
}

export const LIFT = 0;
export const POSE_DEF: Pose = {
  b: [0, 0],
  h: [0, 0],
  hN: [-6, -5],
  hF: [4, -5],
  sN: [-6, -8],
  sF: [4, -8],
  fN: [-2, -2, 0],
  fF: [2, -2, 0],
  w: 6,
  wz: 1,
  cape: 0,
  fx: null,
};
const P = (o: Partial<Pose>) => Object.assign({}, POSE_DEF, o);
export const POSES: Record<string, Pose> = {
  i0: P({}),
  i1: P({ b: [0, 1], h: [0, -1] }),
  i2: P({ b: [0, 1] }),
  i3: P({ h: [0, 1] }),
  j0: P({
    b: [0, -1],
    h: [0, -1],
    fN: [-2, -2, 1],
    fF: [2, -2, 1],
    hN: [-7, -4],
    hF: [5, -4],
    cape: 3,
  }),
  j1: P({
    b: [0, -1],
    h: [0, -1],
    fN: [-3, -3, 1],
    fF: [3, -4, 0],
    hN: [-7, -4],
    hF: [6, -8],
    cape: 3,
  }),
  /* double jump: tuck, then stretch */
  d0: P({ h: [0, 1], fN: [-3, -3, 1], fF: [3, -4, 0], hN: [-8, -5], hF: [6, -4], w: 6, cape: 3 }),
  d1: P({
    b: [0, -2],
    h: [0, -1],
    fN: [-2, -2, 1],
    fF: [2, -3, 1],
    hN: [-8, -9],
    hF: [6, -9],
    w: 7,
    cape: 3,
  }),
  f0: P({ fN: [-3, -2, 1], fF: [3, -3, 1], hN: [-8, -8], hF: [6, -8], w: 7, cape: 2 }),
  f1: P({ h: [0, 1], fN: [-3, -3, 1], fF: [3, -2, 1], hN: [-8, -9], hF: [6, -7], w: 7, cape: 2 }),
  /* landing: impact, deepest squash, recover, small rebound */
  l0: P({
    b: [0, 1],
    h: [0, 1],
    fN: [-4, -2, 0],
    fF: [4, -2, 0],
    hN: [-8, -5],
    hF: [6, -5],
    cape: 2,
  }),
  l1: P({
    b: [0, 1],
    h: [0, 2],
    fN: [-4, -2, 0],
    fF: [4, -2, 0],
    hN: [-9, -5],
    hF: [7, -5],
    cape: 4,
  }),
  l2: P({ b: [0, 1], fN: [-3, -2, 0], fF: [3, -2, 0], hN: [-7, -5], hF: [5, -5] }),
  l3: P({ h: [0, -1] }),
  /* hit 1: overhead slash — wind-up, wind-up, IMPACT, follow-through, recovery */
  a0: P({ b: [-1, 0], h: [-1, 0], hN: [-7, -8], hF: [6, -6], w: 7, fN: [-3, -2, 0] }),
  a1: P({ b: [-1, -1], h: [-1, -1], hN: [-5, -10], hF: [6, -5], w: 0, fN: [-3, -2, 0] }),
  a2: P({
    b: [2, 1],
    h: [1, 0],
    sN: [1, -8],
    hN: [5, -7],
    hF: [2, -5],
    w: 2,
    fN: [-3, -2, 1],
    fF: [5, -2, 0],
    cape: 1,
    fx: "A0",
  }),
  a3: P({
    b: [2, 1],
    h: [1, 1],
    sN: [1, -8],
    hN: [4, -6],
    hF: [2, -5],
    w: 3,
    fN: [-3, -2, 1],
    fF: [5, -2, 0],
    cape: 4,
    fx: "A1",
  }),
  a4: P({ b: [1, 0], hN: [-6, -6], w: 5, fN: [-2, -2, 0], fF: [3, -2, 0] }),
  /* hit 2: rising uppercut */
  u0: P({ b: [0, 1], h: [0, 1], hN: [-7, -5], hF: [5, -5], w: 6, fN: [-3, -2, 0], fF: [3, -2, 0] }),
  u1: P({
    b: [-1, 1],
    h: [-1, 2],
    hN: [-8, -5],
    hF: [5, -4],
    w: 6,
    fN: [-3, -2, 0],
    fF: [3, -2, 0],
  }),
  u2: P({
    b: [2, -2],
    h: [0, -1],
    sN: [4, -8],
    hN: [7, -9],
    hF: [3, -5],
    w: 1,
    fN: [-2, -3, 1],
    fF: [4, -3, 1],
    cape: 3,
    fx: "B0",
  }),
  u3: P({
    b: [2, -2],
    h: [0, -1],
    sN: [4, -8],
    hN: [7, -11],
    hF: [3, -5],
    w: 0,
    fN: [-2, -3, 1],
    fF: [4, -4, 1],
    cape: 3,
    fx: "B1",
  }),
  u4: P({ b: [1, 0], hN: [-6, -8], w: 7, fN: [-2, -2, 0], fF: [3, -2, 0], cape: 2 }),
  u5: P({ b: [0, 1], h: [0, 1], hN: [-7, -5], w: 6 }),
};
/* run: 6 held poses (about 13 fps at full speed, in step with the attacks).
   The planted foot travels exactly STRIDE px back per frame, and the game advances
   one run frame per STRIDE px moved, so the feet keep pace with the ground. */
export const STRIDE = 5;
(() => {
  const st: Foot[] = [
    [5, -2, 0],
    [0, -2, 0],
    [-5, -2, 1],
  ];
  const sw: Foot[] = [
    [-4, -4, 1],
    [0, -5, 1],
    [4, -4, 0],
  ];
  const by = [0, 1, -1];
  for (let i = 0; i < 6; i++) {
    const c = Math.cos((i * Math.PI) / 3);
    POSES["r" + i] = P({
      b: [0, by[i % 3]!],
      h: [1, 0],
      fN: i < 3 ? st[i]! : sw[i - 3]!,
      fF: i < 3 ? sw[i]! : st[i - 3]!,
      hN: [Math.round(-6 - c), Math.abs(c) > 0.7 ? -6 : -5],
      hF: [Math.round(5 + c), c > 0.3 ? -6 : -5],
      cape: i < 3 ? 1 : 4,
    });
  }
})();
export const POSE_NAMES = Object.keys(POSES);
export const POSE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  POSE_NAMES.map((n, i) => [n, i]),
);

/* clips: [pose, milliseconds]; hit = index of the impact frame(s) */
const seq = (names: string[], ms: number | number[]) =>
  names.map((n, i): readonly [string, number] => [n, Array.isArray(ms) ? ms[i]! : ms]);
export const CLIPS = {
  idle: { name: "idle", f: seq(["i0", "i1", "i2", "i3"], 210), loop: true },
  run: {
    name: "run",
    f: seq(
      Array.from({ length: 6 }, (_, i) => "r" + i),
      76,
    ),
    loop: true,
    stride: STRIDE,
  },
  rise: { name: "jump", f: seq(["j0", "j1"], [70, 260]), loop: true },
  air: { name: "double", f: seq(["d0", "d1"], [70, 90]), loop: false },
  fall: { name: "fall", f: seq(["f0", "f1"], 90), loop: true },
  land: { name: "land", f: seq(["l0", "l1", "l2", "l3"], [60, 80, 70, 80]), loop: false },
  atk1: {
    name: "hit 1",
    f: seq(["a0", "a1", "a2", "a3", "a4"], [70, 60, 70, 70, 90]),
    loop: false,
    hit: [2],
  },
  atk2: {
    name: "hit 2",
    f: seq(["u0", "u1", "u2", "u3", "u4", "u5"], [70, 60, 80, 70, 80, 90]),
    loop: false,
    hit: [2],
  },
  combo: {
    name: "combo",
    f: seq(
      ["a0", "a1", "a2", "a3", "u0", "u1", "u2", "u3", "u4", "u5"],
      [70, 60, 70, 70, 70, 60, 80, 70, 80, 90],
    ),
    loop: false,
    hit: [2, 6],
  },
};
