import { PropLayer } from "@t3tools/guild-art/frame";
import { ROOM_PALETTES, TILE, type RoomId } from "@t3tools/guild-art/props/palettes";
import {
  drawArchedWindow,
  drawBackWall,
  drawDitheredGlow,
  drawStoneFloor,
  drawWoodenBeam,
  TILE_SIZE,
} from "@t3tools/guild-art/props/tiles";

import { layerCanvas } from "./props";

export interface RoomArchitecture {
  readonly windows: readonly number[];
  readonly beams: readonly number[];
  readonly glows: readonly (readonly [x: number, y: number, radius?: number])[];
}

export const WINDOW_TOP = 80;
const WINDOW_WIDTH = 21;
const WINDOW_HEIGHT = 51;
const WINDOW_MARGIN = 3;

export function buildRoomLayers(
  room: RoomId,
  { windows, beams, glows }: RoomArchitecture,
  width: number,
  height: number,
  floor: number,
) {
  const layer = new PropLayer(width, height, 0, 0);
  const columns = width / TILE_SIZE;
  drawBackWall(layer, 0, 0, columns, floor / TILE_SIZE);
  layer.rect(0, 0, width, 35, TILE.dark);
  for (let x = 0; x < width; x += 24) drawWoodenBeam(layer, x, 0, 35, 4, "vertical");
  drawWoodenBeam(layer, 0, 35, width, 8, "horizontal");
  drawWoodenBeam(layer, 0, 66, width, 5, "horizontal");
  for (const x of beams) {
    drawWoodenBeam(layer, x, 35, floor - 35, 5, "vertical");
    for (let i = 0; i < 25; i++) {
      if (x + i + 8 <= width) {
        layer.rect(x + 4 + i, 67 - i, 4, 1, TILE.timberShade);
        layer.set(x + 4 + i, 66 - i, TILE.timberEdge);
      }
      if (x - i - 3 >= 0) {
        layer.rect(x - i - 3, 67 - i, 4, 1, TILE.timberShade);
        layer.set(x - i - 3, 66 - i, TILE.timberEdge);
      }
    }
  }
  for (const x of windows) {
    drawArchedWindow(layer, x, WINDOW_TOP, WINDOW_WIDTH, WINDOW_HEIGHT);
    // Leave the trim and the mullions in the wall so only the landscape moves.
    for (let y = WINDOW_TOP; y < WINDOW_TOP + WINDOW_HEIGHT; y++) {
      for (let px = x; px < x + WINDOW_WIDTH; px++) {
        const role = layer.get(px, y);
        if (role === TILE.sky || role === TILE.far || role === TILE.mid) layer.set(px, y, 0);
      }
    }
  }
  layer.rect(0, 142, width, 1, TILE.lite);
  layer.rect(0, 146, width, 1, TILE.dark);
  drawStoneFloor(layer, 0, floor, columns, (height - floor) / TILE_SIZE);
  for (const [x, y, radius] of glows) drawDitheredGlow(layer, x, y, radius);

  // Render a wide window so the side arches and centre mullion sit outside the usable strip.
  const landscapeWidth = 2 * width + 2;
  const landscape = new PropLayer(
    landscapeWidth + 2 * WINDOW_MARGIN,
    WINDOW_HEIGHT + 2,
    WINDOW_MARGIN,
    -WINDOW_TOP,
  );
  drawArchedWindow(landscape, 0, WINDOW_TOP, landscapeWidth, WINDOW_HEIGHT);
  const palette = ROOM_PALETTES[room];
  return {
    wall: layerCanvas(layer, palette),
    landscape: layerCanvas(landscape, palette),
    landscapeMargin: WINDOW_MARGIN,
  };
}
