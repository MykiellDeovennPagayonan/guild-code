import { cw, px, type Point, type Layer } from "../frame.ts";

export interface HeadMetrics {
  readonly top: number;
  readonly fx: number;
  readonly fy: number;
  readonly brow: number;
  readonly mask: Layer;
  readonly solid: Layer;
  L(y: number): number;
  R(y: number): number;
  shell(n: number): Layer;
}

function H(id: string, name: string, face: Point, rows: readonly string[], crown?: number) {
  return { id, name, face, crown, p: px(rows, cw(rows), rows.length) };
}
export const HEADS = [
  H(
    "visor",
    "Visor",
    [1, -5],
    [
      "...HHHHHHHHH...",
      ".HHHHHHHHHHHHH.",
      "HHiiHHHHHHHHHHH",
      "HHHHHHHHHHHHHHH",
      "HHHHHHHHHHHHHHH",
      "HHHHHHHHHHHHHHH",
      ".hHHHHHHHHHHHh.",
      "...hhhhhhhhh...",
    ],
  ),
  H(
    "tall",
    "Tall",
    [0, -7],
    [
      "..HHHHHHH..",
      ".HHHHHHHHH.",
      "HHiHHHHHHHH",
      "HHiHHHHHHHH",
      "HHHHHHHHHHH",
      "HHHHHHHHHHH",
      "HHHHHHHHHHH",
      "HHHHHHHHHHH",
      "HHHHHHHHHHH",
      "HHHHHHHHHHH",
      "hHHHHHHHHHh",
      ".hHHHHHHHh.",
      "..hhhhhhh..",
    ],
  ),
  H(
    "round",
    "Round",
    [1, -6],
    [
      "....HHHHH....",
      "..HHHHHHHHH..",
      ".HHiHHHHHHHH.",
      "HHiHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      ".HHHHHHHHHHH.",
      "..hHHHHHHHh..",
      "....hhhhh....",
    ],
  ),
  H(
    "block",
    "Block",
    [1, -6],
    [
      ".HHHHHHHHHHH.",
      "HHiiHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "hhhhhhhhhhhhh",
      "hHhHhHhHhHhHh",
      ".hhhhhhhhhhh.",
    ],
  ),
  H(
    "pear",
    "Pear",
    [1, -5],
    [
      "....HHHHHHH....",
      "...HHHHHHHHH...",
      "...HiHHHHHHH...",
      "..HHHHHHHHHHH..",
      ".HHHHHHHHHHHHH.",
      "HHHHHHHHHHHHHHH",
      "HHHHHHHHHHHHHHH",
      "HHHHHHHHHHHHHHH",
      ".hHHHHHHHHHHHh.",
      "...hhhhhhhhh...",
    ],
  ),
  H(
    "cat",
    "Cat",
    [1, -5],
    [
      ".H.........H.",
      ".HeH.....HeH.",
      "..HHHHHHHHH..",
      ".HiHHHHHHHHH.",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      ".hHHHHHHHHHh.",
      "...hhhhhhh...",
    ],
    -8,
  ),
  H(
    "acorn",
    "Acorn",
    [1, -7],
    [
      "..HHHHHHHHH..",
      ".HHHHHHHHHHH.",
      "HHiiHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      "HHHHHHHHHHHHH",
      ".HHHHHHHHHHH.",
      "..hHHHHHHHh..",
      "...hHHHHHh...",
      ".....hhh.....",
    ],
  ),
];
