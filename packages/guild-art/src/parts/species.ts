import { at, RI, type Layer, type Pixel } from "../frame.ts";
import type { HeadMetrics } from "./heads.ts";

interface Species {
  readonly id: string;
  readonly name: string;
  readonly build?: number;
  readonly fist?: number;
  readonly tail?: readonly Pixel[];
  back?(hd: HeadMetrics, layer: Layer): void;
  marks?(hd: Omit<HeadMetrics, "solid">, head: Layer): void;
  front?(hd: HeadMetrics): readonly Pixel[];
}

export const SPECIES: readonly Species[] = [
  { id: "nub", name: "Nub" },
  {
    id: "lopp",
    name: "Lopp",
    tail: at([".HH.", "HHiH", "HHHH", ".hh."], -11, -6),
    back(hd, L) {
      // long drooping ears
      const y0 = hd.top + 2;
      for (const s of [-1, 1]) {
        let e = s < 0 ? hd.L(y0) : hd.R(y0);
        L.set(e + s, y0, RI.H);
        L.set(e + 2 * s, y0, RI.H);
        for (let k = 1; k <= 7 && y0 + k <= 0; k++) {
          const edge = s < 0 ? hd.L(y0 + k) : hd.R(y0 + k);
          e = s < 0 ? Math.min(e, edge) : Math.max(e, edge);
          if (k === 1) L.set(e + s, y0 + k, RI.H);
          L.set(e + 2 * s, y0 + k, k >= 3 ? RI.e : RI.H);
          L.set(e + 3 * s, y0 + k, RI.H);
          if (k >= 4) L.set(e + 4 * s, y0 + k, RI.h); // the ear flares out towards its tip
        }
      }
    },
  },
  {
    id: "drakel",
    name: "Drakel",
    tail: at(["i.......", "HH......", ".HHH....", "..HHHHHH", "...hhhh."], -12, -7),
    back(hd, L) {
      // a ridge of spines down the back of the head
      for (const y of [hd.top + 2, hd.top + 4, hd.top + 6])
        if (y <= -1) {
          const x = hd.L(y);
          L.set(x - 1, y, RI.C);
          L.set(x - 2, y, RI.C);
          if (y + 1 <= -1) L.set(x - 1, y + 1, RI.c);
        }
    },
    front(hd) {
      // snout
      const y = hd.fy + 1,
        x = Math.max(hd.R(y), hd.R(y + 1)) + 1;
      return [
        [x, y, RI.H],
        [x + 1, y, RI.h],
        [x + 2, y, RI.H],
        [x, y + 1, RI.h],
        [x + 1, y + 1, RI.h],
      ];
    },
  },
  {
    id: "gillo",
    name: "Gillo",
    tail: at(["C.....", "CC....", "cCCHH.", "CC....", "C....."], -11, -8),
    back(hd, L) {
      // fan fins on both sides of the head
      const y = hd.fy;
      for (const s of [-1, 1]) {
        const e =
          s < 0
            ? Math.min(hd.L(y - 1), hd.L(y), hd.L(y + 1))
            : Math.max(hd.R(y - 1), hd.R(y), hd.R(y + 1));
        L.set(e + 2 * s, y - 2, RI.c);
        L.set(e + s, y - 1, RI.C);
        L.set(e + 2 * s, y - 1, RI.C);
        L.set(e + 3 * s, y - 1, RI.c);
        L.set(e + s, y, RI.C);
        L.set(e + 2 * s, y, RI.C);
        L.set(e + s, y + 1, RI.C);
        L.set(e + 2 * s, y + 1, RI.C);
        L.set(e + 3 * s, y + 1, RI.c);
        L.set(e + 2 * s, y + 2, RI.c);
      }
    },
    marks(hd, hf) {
      // a gill slit on the cheek
      for (const y of [hd.fy + 1, hd.fy + 2]) {
        const x = hd.L(y) + 1;
        if (hf.get(x, y) === RI.H && x < hd.fx - 3) hf.set(x, y, RI.h);
      }
    },
  },
  {
    id: "orrok",
    name: "Orrok",
    build: 1,
    fist: 1,
    marks(hd, hf) {
      // tusks rising from the jaw, outside the face
      for (const s of [-4, 4])
        for (const y of [hd.fy + 2, hd.fy + 3])
          if (y <= -1 && hf.get(hd.fx + s, y)) hf.set(hd.fx + s, y, y === hd.fy + 2 ? RI.W : RI.w);
    },
  },
];
