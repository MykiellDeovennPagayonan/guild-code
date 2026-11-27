import { FH, FW, Layer, RI } from "@t3tools/guild-art/frame";
import { PALETTES, paletteTable } from "@t3tools/guild-art/palettes";
import { toRGBA } from "@t3tools/guild-art/sheet";

import { canvasContext } from "./pixelDisplay";

type Rect = readonly [x: number, y: number, width: number, height: number, role: keyof typeof RI];

const shapes = {
  door: [
    [-10, -24, 20, 24, "m"],
    [-8, -28, 16, 5, "M"],
    [-7, -24, 14, 23, "D"],
    [-6, -24, 1, 22, "G"],
    [-1, -24, 1, 22, "d"],
    [4, -13, 2, 2, "G"],
    [-10, -2, 20, 2, "m"],
  ],
  hearth: [
    [-16, -21, 32, 21, "m"],
    [-17, -23, 34, 3, "M"],
    [-10, -15, 20, 14, "k"],
    [-8, -3, 17, 2, "D"],
    [-5, -7, 11, 5, "g"],
    [-2, -11, 5, 8, "G"],
    [-1, -6, 2, 4, "X"],
  ],
  long_table: [
    [-17, -11, 3, 11, "d"],
    [14, -11, 3, 11, "d"],
    [-20, -15, 40, 5, "D"],
    [-19, -11, 38, 1, "d"],
    [-6, -17, 5, 2, "W"],
  ],
  bench: [
    [-13, -6, 2, 6, "d"],
    [11, -6, 2, 6, "d"],
    [-15, -8, 30, 3, "D"],
  ],
  work_table: [
    [-13, -11, 3, 11, "d"],
    [10, -11, 3, 11, "d"],
    [-15, -14, 30, 4, "D"],
    [-5, -16, 10, 2, "W"],
    [-2, -15, 5, 1, "w"],
  ],
  quest_board: [
    [-12, -22, 3, 22, "d"],
    [9, -22, 3, 22, "d"],
    [-15, -29, 30, 20, "D"],
    [-13, -27, 26, 16, "d"],
    [-10, -25, 8, 10, "W"],
    [2, -23, 8, 9, "w"],
    [-8, -22, 4, 1, "D"],
    [-8, -19, 5, 1, "D"],
  ],
  bell: [
    [-8, -15, 16, 15, "d"],
    [-9, -16, 18, 2, "D"],
    [-3, -23, 6, 6, "g"],
    [-2, -23, 2, 5, "G"],
    [-5, -18, 10, 2, "G"],
  ],
  banner: [
    [-10, -33, 20, 2, "D"],
    [-7, -31, 14, 21, "a"],
    [-5, -30, 9, 18, "A"],
    [-5, -10, 10, 3, "a"],
    [-3, -21, 6, 2, "G"],
    [-1, -23, 2, 6, "G"],
  ],
  lantern: [
    [0, -20, 1, 13, "d"],
    [-3, -10, 7, 8, "k"],
    [-2, -9, 5, 5, "g"],
    [-1, -8, 2, 3, "G"],
    [0, -7, 1, 2, "X"],
  ],
  reception_desk: [
    [-17, -14, 34, 14, "d"],
    [-15, -12, 30, 10, "D"],
    [-19, -17, 38, 4, "D"],
    [-5, -20, 10, 3, "W"],
    [0, -10, 4, 3, "G"],
  ],
  notice_board: [
    [-14, -24, 28, 17, "d"],
    [-13, -23, 26, 15, "D"],
    [-10, -21, 9, 9, "w"],
    [1, -20, 8, 10, "W"],
    [2, -17, 5, 1, "d"],
  ],
  rug: [
    [-12, -2, 24, 3, "a"],
    [-10, -1, 20, 1, "A"],
  ],
} satisfies Record<string, readonly Rect[]>;

export type PropId = keyof typeof shapes;
const images = new Map<PropId, HTMLCanvasElement | null>();
const table = paletteTable(PALETTES[0]!);

export function getPropImage(propId: PropId) {
  const cached = images.get(propId);
  if (cached !== undefined) return cached;
  try {
    const layer = new Layer();
    for (const [x, y, width, height, role] of shapes[propId]) {
      layer.rect(x, y, width, height, RI[role]);
    }
    layer.outline();
    const context = canvasContext(FW, FH);
    const pixels = toRGBA({ frames: [layer.d], mirrored: [] }, table);
    context.putImageData(new ImageData(pixels.subarray(0, FW * FH * 4), FW, FH), 0, 0);
    images.set(propId, context.canvas);
    return context.canvas;
  } catch (error) {
    console.warn("Could not draw Guild prop", propId, error);
    images.set(propId, null);
    return null;
  }
}
