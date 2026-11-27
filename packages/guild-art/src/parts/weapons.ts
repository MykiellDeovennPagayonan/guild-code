import { px, type Point } from "../frame.ts";

function W(
  id: string,
  name: string,
  n: readonly string[],
  na: Point,
  ne: readonly string[],
  nea: Point,
) {
  return { id, name, n: px(n, na[0], na[1]), ne: px(ne, nea[0], nea[1]) };
}
export const REFERENCE_WEAPON_COUNT = 4;
export const WEAPONS = [
  W(
    "blade",
    "Blade",
    [".W.", ".Wm", ".Wm", ".Wm", ".Wm", ".Wm", "GGG", ".D.", ".G."],
    [1, 7],
    ["......W", ".....Wm", "....Wm.", "...Wm..", ".GWm...", "..GG...", ".D.G...", "G......"],
    [1, 6],
  ),
  W(
    "mallet",
    "Mallet",
    ["mBBBm", "mBLBm", "mBbBm", "..D..", "..D..", "..D..", "..D..", "..d.."],
    [2, 6],
    ["...mB..", "..mBBB.", "...BLBm", "...DBm.", "..D....", ".D.....", "d......"],
    [1, 5],
  ),
  W(
    "axe",
    "Axe",
    [".DWW", ".DMW", ".DWW", ".D..", ".D..", ".D..", ".D..", ".d.."],
    [1, 6],
    [".....D.", "....DMW", "...D.WW", "..D....", ".D.....", "d......"],
    [1, 4],
  ),
  W(
    "wand",
    "Star rod",
    [".G.", "GXG", ".G.", ".D.", ".D.", ".D.", ".D.", ".d."],
    [1, 6],
    ["....G.", "...GXG", "...DG.", "..D...", ".D....", "d....."],
    [1, 4],
  ),
  W("none", "None", [], [0, 0], [], [0, 0]),
];
