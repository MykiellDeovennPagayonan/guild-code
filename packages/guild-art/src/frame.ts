export const FW = 48,
  FH = 42,
  RX = 24,
  RY = 38;

/* colour roles: one char per palette slot */

const ROLES = [
  ".",
  "O",
  "A",
  "a",
  "L",
  "B",
  "b",
  "C",
  "c",
  "H",
  "h",
  "i",
  "E",
  "e",
  "S",
  "s",
  "M",
  "m",
  "D",
  "d",
  "W",
  "w",
  "G",
  "g",
  "k",
  "j",
  "X",
  "x",
  "P",
] as const;
export type Role = (typeof ROLES)[number];
type RoleChar = Role | "#" | "K" | " ";
export const ROLE_CHARS = ROLES.join("");
export const RI = {
  ...Object.fromEntries(ROLES.map((role, index) => [role, index])),
  "#": 1,
  K: 1,
  " ": 0,
} as Readonly<Record<RoleChar, number>>;

export type Point = readonly [x: number, y: number];
export type Pixel = readonly [x: number, y: number, role: number];

interface StampOptions {
  readonly rot?: number;
  readonly flip?: boolean;
  readonly map?: Readonly<Record<number, number>>;
}
export const OUT = 1;

export class Layer {
  d = new Uint8Array(FW * FH);
  clipped = false;
  set(x: number, y: number, c: number) {
    x += RX;
    y += RY;
    if (x >= 0 && x < FW && y >= 0 && y < FH) this.d[y * FW + x] = c;
    else if (c) this.clipped = true;
  }
  get(x: number, y: number) {
    x += RX;
    y += RY;
    return x >= 0 && x < FW && y >= 0 && y < FH ? this.d[y * FW + x]! : 0;
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  put(p: readonly Pixel[], x: number, y: number, o?: StampOptions) {
    const rot = (o && o.rot) || 0,
      flip = o && o.flip,
      map = o && o.map;
    for (let [X, Y, c] of p) {
      for (let k = 0; k < rot; k++) {
        const t = X;
        X = -Y;
        Y = t;
      }
      if (flip) X = -X;
      c = map?.[c] ?? c;
      this.set(x + X, y + Y, c);
    }
    return this;
  }
  outline() {
    const s = this.d,
      o = new Uint8Array(s);
    this.clipped ||= this.touchesEdge();
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const i = y * FW + x;
        if (s[i]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
            if (s[ny * FW + nx]) {
              hit = true;
              break;
            }
          }
        if (hit) o[i] = OUT;
      }
    this.d = o;
    return this;
  }
  blit(src: Layer, dx: number, dy: number) {
    this.clipped ||= src.clipped;
    dx = dx | 0;
    dy = dy | 0;
    const s = src.d,
      d = this.d;
    for (let y = 0; y < FH; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= FH) {
        this.clipped ||= s.subarray(y * FW, (y + 1) * FW).some(Boolean);
        continue;
      }
      for (let x = 0; x < FW; x++) {
        const c = s[y * FW + x]!;
        if (!c) continue;
        const tx = x + dx;
        if (tx < 0 || tx >= FW) {
          this.clipped = true;
          continue;
        }
        d[ty * FW + tx] = c;
      }
    }
    return this;
  }
  // Keep the existing outline and add outline only where the merged pixels meet empty space.
  merge(p: readonly Pixel[], x: number, y: number) {
    for (const q of p) this.set(x + q[0], y + q[1], q[2]);
    for (const q of p)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!this.get(x + q[0] + dx, y + q[1] + dy)) this.set(x + q[0] + dx, y + q[1] + dy, OUT);
    return this;
  }
  clone() {
    const l = new Layer();
    l.d.set(this.d);
    l.clipped = this.clipped;
    return l;
  }
  mirrored() {
    const l = new Layer();
    l.clipped = this.clipped;
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const c = this.d[y * FW + x]!;
        if (!c) continue;
        const tx = 2 * RX - x;
        if (tx >= 0 && tx < FW) l.d[y * FW + tx] = c;
        else l.clipped = true;
      }
    return l;
  }
  touchesEdge() {
    for (let x = 0; x < FW; x++) if (this.d[x] || this.d[(FH - 1) * FW + x]) return true;
    for (let y = 1; y < FH - 1; y++) if (this.d[y * FW] || this.d[(y + 1) * FW - 1]) return true;
    return false;
  }
}

export function px(rows: readonly string[], ax = 0, ay = 0) {
  const out: Pixel[] = [];
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y]!.length; x++) {
      const ch = rows[y]![x] as RoleChar;
      if (ch === "." || ch === " ") continue;
      const c = RI[ch];
      if (c === undefined) throw new Error('bad role "' + ch + '"');
      out.push([x - ax, y - ay, c]);
    }
  return out;
}
export const cw = (rows: readonly string[]) => (Math.max(...rows.map((r) => r.length)) - 1) >> 1;

export const at = (rows: readonly string[], x0: number, y0: number) => px(rows, -x0, -y0);

export function dilate(src: Layer, n: number) {
  let cur = new Layer();
  cur.clipped = src.clipped;
  for (let i = 0; i < src.d.length; i++) cur.d[i] = src.d[i] ? 1 : 0;
  for (let k = 0; k < n; k++) {
    const nx = new Layer(),
      eight = k % 2 === 1;
    nx.clipped = cur.clipped || cur.touchesEdge();
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        let v = cur.d[y * FW + x]!;
        if (!v)
          for (let dy = -1; dy <= 1 && !v; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!eight && dx && dy) continue;
              const ax = x + dx,
                ay = y + dy;
              if (ax < 0 || ay < 0 || ax >= FW || ay >= FH) continue;
              if (cur.d[ay * FW + ax]) {
                v = 1;
                break;
              }
            }
        nx.d[y * FW + x] = v;
      }
    cur = nx;
  }
  return cur;
}

export function widen(p: readonly Pixel[]) {
  const out: Pixel[] = [];
  for (const q of p) {
    if (q[0] <= -1) out.push([q[0] - 1, q[1], q[2]]);
    if (q[0] >= 1) out.push([q[0] + 1, q[1], q[2]]);
    if (q[0] >= -1 && q[0] <= 1) out.push(q);
  }
  return out;
}
