import type { Point, PropLayer } from "./frame.ts";
import { FIXED, paletteTable } from "./palettes.ts";
import { prop } from "./props/art.ts";

export const MARKERS = {
  attention: prop(["GGG", "GGg", "GGg", ".g.", "...", ".G."]),
  approval: prop([".GGGGg.", "gGWWgGg", "gGWWgGg", ".GWWg..", ".GgGg..", "..gg..."]),
  question: prop([".WWW.", "Ww.wW", "...Ww", "..Ww.", "..w..", ".....", "..W.."]),
  offline: prop([".mmm.", "mj.mm", "...mm", "..mm.", "..m..", ".....", "..m.."]),
  zzz: prop([
    "........WWW",
    "..........w",
    ".........w.",
    "....WWW.Www",
    "......w....",
    ".WW..w.....",
    "..w.Www....",
    ".ww........",
  ]),
};

export type MarkerId = keyof typeof MARKERS;
export const MARKER_TABLE = paletteTable(FIXED);

export function markerAbove(id: MarkerId, body: PropLayer, head: Point) {
  const firstPixel = body.d.findIndex(Boolean);
  const top = firstPixel === -1 ? head[1] : Math.floor(firstPixel / body.width) - body.rootY;
  const anchor: Point = [head[0], top - 2];
  return { layer: MARKERS[id], anchor };
}
