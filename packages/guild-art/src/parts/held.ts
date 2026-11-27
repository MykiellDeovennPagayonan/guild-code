import { Layer, px } from "../frame.ts";

const quillN = px([".W.", ".WW", ".Ww", "Ww.", ".w.", ".D.", ".m."], 1, 5);
const quillNE = px([".....W", "....WW", "...WWw", "..Ww..", "..w...", ".D....", "m....."], 1, 5);

export const HELD_ITEMS = {
  quill: Array.from({ length: 8 }, (_, direction) =>
    new Layer().put(direction % 2 ? quillNE : quillN, 0, 0, { rot: direction >> 1 }).outline(),
  ),
};

export type HeldItemId = keyof typeof HELD_ITEMS;
