import { at, type Pixel } from "../frame.ts";

interface Back {
  readonly id: string;
  readonly name: string;
  readonly v: readonly (readonly Pixel[])[];
  readonly mirror?: number;
  pick(cape: number): number;
}

export const BACKS: readonly Back[] = [
  { id: "none", name: "None", v: [[]], pick: () => 0 },
  {
    id: "cape",
    name: "Cape",
    pick: (c) => c,
    v: [
      at(["..BBB", ".BBBB", ".BBBB", "BBBBB", "BBBBB", "bBBBB", "bb.bB"], -9, -9),
      at([".....BBBB", "..BBBBBBB", "BBBBBBBBB", "bBBBBBBB.", ".bbBbBB.."], -13, -10),
      at(
        [
          "bB.......",
          "bBB......",
          ".BBB.....",
          "..BBBB...",
          "...BBBB..",
          "....BBBB.",
          ".....BBBB",
          "......BBB",
        ],
        -12,
        -15,
      ),
      at([".BBB", ".BBB", "BBBB", "BBBB", "bBB.", "bB..", ".b.."], -8, -9),
      at(["......BBB", "...BBBBBB", "BBBBBBBBB", "bBBBBBBB.", "bbBBbBB.."], -13, -9),
    ],
  },
  {
    id: "pack",
    name: "Pack",
    pick: () => 0,
    v: [at([".CCC.", "CCcCC", "DDDDD", "DdGDD", ".ddd."], -9, -10)],
  },
  {
    id: "wings",
    name: "Wings",
    mirror: 1,
    pick: (c) => (c === 2 || c === 4 ? 1 : 0),
    v: [
      at([".WW....", "WWWW...", "WWWWWW.", ".WWWWWW", "..wWwWW", "...w.wW"], -11, -11),
      at(["WW.....", "WWW....", ".WWWW..", ".WWWWW.", "..wWWWW", "...wWwW", ".....wW"], -11, -13),
    ],
  },
  {
    id: "shield",
    name: "Shield",
    pick: () => 0,
    v: [
      at([".MMMMM.", "MAAAAAM", "MAAGAAM", "MAGGGAM", "MAAGAAM", "MAAAAAM", ".MMMMM."], -10, -10),
    ],
  },
  {
    id: "tail",
    name: "Tail",
    pick: (c) => (c === 1 || c === 4 || c === 2 ? 1 : 0),
    v: [
      at([".CC...", "C..C..", "C.....", "CC....", ".CCCCC", "...cCC"], -9, -8),
      at(["CC.....", "C.CCC..", "....CCC", ".....cC"], -10, -6),
    ],
  },
  {
    id: "jet",
    name: "Jetpack",
    pick: (c) => (c === 3 ? 1 : 0),
    v: [
      at([".MMM.", "MWMMM", "MmAAM", "MmMMM", ".mmm.", "..k.."], -9, -10),
      at([".MMM.", "MWMMM", "MmAAM", "MmMMM", ".mmm.", "..k..", ".GXG.", "..G.."], -9, -10),
    ],
  },
];
