import { FH, FW, RX, RY, OUT, RI, Layer, px, type Pixel } from "../frame.ts";
import type { HeadMetrics } from "./heads.ts";

interface TopLayers {
  readonly far: Layer;
  readonly back: Layer;
  readonly front: Layer;
}
interface Top {
  readonly id: string;
  readonly name: string;
  make(hd: HeadMetrics, layers: TopLayers): void;
}

function paintMask(
  dst: Layer,
  mask: Layer,
  base: number,
  shade: number,
  pred: (x: number, y: number) => boolean,
) {
  for (let y = -RY; y < FH - RY; y++) {
    let n = 0;
    for (let x = -RX; x < FW - RX; x++) {
      if (!mask.get(x, y) || (pred && !pred(x, y))) continue;
      dst.set(x, y, shade && n < 2 ? shade : base);
      n++;
    }
  }
}
/* sprite hats: whole sprite sits behind the head, rows above the cut line
   are repeated in front, and the cut row becomes the brim line */
function hatSprite(hd: HeadMetrics, T: TopLayers, p: readonly Pixel[], over: number) {
  const full = new Layer().put(p, 0, hd.top).outline();
  T.back.blit(full, 0, 0);
  const cut = hd.top + over;
  for (let y = -RY; y < cut; y++)
    for (let x = -RX; x < FW - RX; x++) {
      let c = full.get(x, y);
      if (!c) continue;
      if (y === cut - 1 && hd.solid.get(x, y)) c = OUT;
      T.front.set(x, y, c);
    }
}
const BRIM = px(
  [
    "..........aa.AA........",
    ".........aLa.AA........",
    "........aLaa.AA........",
    "..AAAAAAAAAAAAAAAAAAA..",
    ".LAAAAAAAAAAAAAAAAALAA.",
    "LAAAAAAAAAAAAAAAAAAALAA",
    "aAAAAAAAAAAAAAAAAAAAALA",
    "aaAAAAAAAAAAAAAAAAAAAAA",
    "aaaAAAAAAAAAAAAAAAAAALA",
    ".aaaAAAAAAAAAAAAAAAAAA.",
    "..aaaLAAAAAAAAAAAAAAA..",
    "....aaLAAAAAAAAAAAA....",
    "......aaAAAAAAAAA......",
  ],
  11,
  6,
);
const KASA = (() => {
  const rows = ["............AAA............"],
    ws = [5, 11, 17, 23, 27];
  ws.forEach((w, i) => {
    const pad = ".".repeat((27 - w) / 2);
    let r = "";
    for (let x = 0; x < w; x++) r += x === 0 || (x + i * 2) % 6 === 2 ? "c" : "C";
    rows.push(pad + r + pad);
  });
  rows.push("c".repeat(27));
  return px(rows, 13, 4);
})();
const WIZARD = px(
  [
    ".......AA............",
    "......AAAA...........",
    "......aAAA...........",
    ".......aAAA..........",
    ".......aAGAA.........",
    "......aAAAAAA........",
    "......aAAAAAAA.......",
    ".....aaAAAAAAAL......",
    ".....GGGGgCgGGG......",
    "..aAAAAAAAAAAAAAAAL..",
    "aaAAAAAAAAAAAAAAAAALL",
  ],
  10,
  9,
);
const CROWN = px(["G..G..G", "GG.G.GG", "GAGCGAG", "ggggggg"], 3, 3);
const HORN = px(["W...", "wW..", ".wW.", "..wW"], 3, 3);
const CREST = px([".CCC...", "CCcCCC.", "CCCcCCC"], 3, 2);
const PONY = px([".CC.", "CCC.", ".CCC", ".cCC", "..cC"], 3, 0);
const HOODTIP = px(["AA..", "aAAA"], 3, 1);

export const TOPS: readonly Top[] = [
  {
    id: "brim",
    name: "Brim",
    make(hd, T) {
      hatSprite(hd, T, BRIM, 2);
    },
  },
  {
    id: "kasa",
    name: "Kasa",
    make(hd, T) {
      hatSprite(hd, T, KASA, 2);
    },
  },
  {
    id: "wizard",
    name: "Wizard",
    make(hd, T) {
      hatSprite(hd, T, WIZARD, 2);
    },
  },
  {
    id: "helm",
    name: "Helm",
    make(hd, T) {
      const s = hd.shell(2),
        A = RI.A,
        a = RI.a;
      paintMask(T.back, s, A, a, (_x, y) => y <= 0);
      paintMask(
        T.front,
        s,
        A,
        a,
        (x, y) => y < hd.fy - 1 || (y <= 0 && (x < hd.L(y) || x > hd.R(y))),
      );
      for (let x = -RX; x < RX; x++) if (T.front.get(x, hd.fy - 2)) T.front.set(x, hd.fy - 2, RI.M);
      T.front.put(CREST, -1, hd.top - 3);
      T.back.outline();
      T.front.outline();
    },
  },
  {
    id: "horns",
    name: "Horns",
    make(hd, T) {
      const s = hd.shell(1),
        t = hd.top;
      paintMask(T.front, s, RI.M, RI.m, (_x, y) => y < t + 2);
      for (let x = -RX; x < RX; x++) if (T.front.get(x, t + 1)) T.front.set(x, t + 1, RI.g);
      T.front.put(HORN, hd.L(t + 1) - 2, t);
      T.front.put(HORN, hd.R(t + 1) + 2, t, { flip: true });
      T.front.outline();
    },
  },
  {
    id: "spikes",
    name: "Spikes",
    make(hd, T) {
      const s = hd.shell(1),
        t = hd.top,
        cap = Math.min(hd.brow - 1, t + 1),
        C = RI.C,
        c = RI.c;
      paintMask(T.back, s, c, 0, (_x, y) => y <= t + 4 && y <= -2);
      for (const y of [t + 1, t + 3]) {
        const x = hd.L(Math.min(y, -1)) - 2;
        T.back.set(x, y, c);
        T.back.set(x - 1, y, c);
        T.back.set(x - 1, y + 1, c);
        T.back.set(x, y - 1, c);
      }
      paintMask(T.front, s, C, c, (_x, y) => y <= cap);
      const r = cap + 1;
      for (let x = hd.L(r); x <= hd.R(r); x++) if ((x - hd.L(r)) % 3 < 2) T.front.set(x, r, C);
      for (let x = hd.L(t) - 1; x <= hd.R(t) - 1; x += 3) {
        T.front.rect(x, t - 2, 2, 1, C);
        T.front.set(x, t - 3, C);
      }
      T.back.outline();
      T.front.outline();
    },
  },
  {
    id: "long",
    name: "Long",
    make(hd, T) {
      const t = hd.top,
        cap = Math.min(hd.brow - 1, t + 1),
        C = RI.C,
        c = RI.c;
      paintMask(
        T.back,
        hd.shell(2),
        C,
        c,
        (x, y) => y <= -2 || (y <= 1 && (x < hd.L(-1) || x > hd.R(-1))),
      );
      paintMask(T.front, hd.shell(1), C, c, (_x, y) => y <= cap);
      const r = cap + 1;
      for (let x = hd.L(r); x <= hd.fx - 2; x++) T.front.set(x, r, C);
      T.far.put(PONY, hd.L(-2) - 1, -3);
      T.far.outline();
      T.back.outline();
      T.front.outline();
    },
  },
  {
    id: "hood",
    name: "Hood",
    make(hd, T) {
      const s = hd.shell(2),
        t = hd.top;
      paintMask(T.back, s, RI.A, RI.a, (_x, y) => y <= 0);
      T.back.put(HOODTIP, hd.L(t) + 1, t - 2);
      paintMask(T.front, s, RI.A, RI.a, (_x, y) => y <= Math.min(t + 1, hd.brow));
      T.front.put(HOODTIP, hd.L(t) + 1, t - 2);
      T.back.outline();
      T.front.outline();
    },
  },
  {
    id: "crown",
    name: "Crown",
    make(hd, T) {
      hatSprite(hd, T, CROWN, 1);
    },
  },
  { id: "bare", name: "Bare", make() {} },
];
