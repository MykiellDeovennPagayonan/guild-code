import type { Appearance } from "../src/appearance.ts";
import { buildParts, composeFrame } from "../src/compose.ts";
import { OUT, PropLayer, type Point } from "../src/frame.ts";
import { layerToRGBA, paletteTable, type RGB } from "../src/palettes.ts";
import { getPart } from "../src/parts/registry.ts";
import { POSE_DEF } from "../src/poses.ts";
import { PROPS, type PropId } from "../src/props/index.ts";
import { ROOM_PALETTES, TILE, type RoomId } from "../src/props/palettes.ts";
import {
  drawArchedWindow,
  drawBackWall,
  drawDitheredGlow,
  drawStoneFloor,
  drawWoodenBeam,
  TILE_SIZE,
} from "../src/props/tiles.ts";

const WIDTH = 384;
const HEIGHT = 216;
const FLOOR = 180;

type Placement = readonly [id: PropId, x: number, y: number, frame?: number];
const layouts = {
  guild_hall: {
    windows: [27, 108, 234, 310],
    beams: [13, 94, 176, 286, 364],
    glows: [
      [43, 173, 15],
      [96, 119],
      [287, 119],
      [345, 163],
    ],
    props: [
      ["hearth", 43, FLOOR, 1],
      ["longTable", 112, FLOOR],
      ["bench", 116, FLOOR + 2],
      ["questBoard", 162, 152],
      ["banner", 201, 123],
      ["stool", 244, FLOOR],
      ["workTable", 269, FLOOR],
      ["bell", 307, 151],
      ["lantern", 96, 124, 1],
      ["lantern", 287, 124, 2],
      ["door", 348, FLOOR],
    ],
    cast: [74, 195, 320],
  },
  recruitment_hall: {
    windows: [59, 150, 224, 310],
    beams: [17, 132, 207, 294, 365],
    glows: [
      [29, 163],
      [134, 121],
      [208, 121],
    ],
    props: [
      ["door", 32, FLOOR],
      ["banner", 94, 123],
      ["banner", 275, 123],
      ["receptionDesk", 104, FLOOR],
      ["noticeBoard", 188, 144],
      ["rug", 249, FLOOR + 9],
      ["lantern", 134, 126, 1],
      ["lantern", 208, 126, 1],
    ],
    cast: [156, 228, 314],
  },
} as const satisfies Record<
  RoomId,
  {
    windows: readonly number[];
    beams: readonly number[];
    glows: readonly (readonly [x: number, y: number, radius?: number])[];
    props: readonly Placement[];
    cast: readonly number[];
  }
>;

export function pasteLayer(
  image: Pixels,
  layer: PropLayer,
  table: readonly RGB[],
  x: number,
  y: number,
  facing = 1,
) {
  const sprite = layerToRGBA(layer, table);
  const top = y - layer.rootY;
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      const src = (row * sprite.width + col) * 4;
      if (!sprite.data[src + 3]) continue;
      const px = x + (col - layer.rootX) * facing;
      const py = top + row;
      if (px < 0 || px >= image.width || py < 0 || py >= image.height) {
        throw new Error(`Sprite at (${x}, ${y}) clips the review image`);
      }
      image.data.set(sprite.data.subarray(src, src + 4), (py * image.width + px) * 4);
    }
  }
}

export function renderRoomReview(id: RoomId, appearances: readonly Appearance[]) {
  const { windows, beams, glows, props, cast } = layouts[id];
  const layer = new PropLayer(WIDTH, HEIGHT, 0, 0);
  const columns = WIDTH / TILE_SIZE;
  drawBackWall(layer, 0, 0, columns, FLOOR / TILE_SIZE);
  layer.rect(0, 0, WIDTH, 35, TILE.dark);
  for (let x = 0; x < WIDTH; x += 24) {
    drawWoodenBeam(layer, x, 0, 35, 4, "vertical");
  }
  drawWoodenBeam(layer, 0, 35, WIDTH, 8, "horizontal");
  drawWoodenBeam(layer, 0, 66, WIDTH, 5, "horizontal");
  for (const x of beams) {
    drawWoodenBeam(layer, x, 35, FLOOR - 35, 5, "vertical");
    for (let i = 0; i < 25; i++) {
      if (x + i + 8 <= WIDTH) {
        layer.rect(x + 4 + i, 67 - i, 4, 1, TILE.timberShade);
        layer.set(x + 4 + i, 66 - i, TILE.timberEdge);
      }
      if (x - i - 3 >= 0) {
        layer.rect(x - i - 3, 67 - i, 4, 1, TILE.timberShade);
        layer.set(x - i - 3, 66 - i, TILE.timberEdge);
      }
    }
  }
  for (const x of windows) drawArchedWindow(layer, x, 80, 21, 51);
  layer.rect(0, 142, WIDTH, 1, TILE.lite);
  layer.rect(0, 146, WIDTH, 1, TILE.dark);
  drawStoneFloor(layer, 0, FLOOR, columns, (HEIGHT - FLOOR) / TILE_SIZE);
  for (const [x, y, radius] of glows) drawDitheredGlow(layer, x, y, radius);
  if (layer.clipped) throw new Error(`${id} background clips`);

  const table = ROOM_PALETTES[id];
  const backdrop = layerToRGBA(layer, table);
  const environment = { ...backdrop, data: backdrop.data.slice() };
  const placements: readonly Placement[] = props;
  for (const [prop, x, y, frame = 0] of placements)
    pasteLayer(environment, PROPS[prop].frames[frame]!, table, x, y);
  const image = { ...environment, data: environment.data.slice() };
  const characters = cast.map((x, i) => {
    const appearance = appearances[i]!;
    const { layer } = composeFrame(buildParts(appearance), { ...POSE_DEF, w: -1 });
    const sprite = i % 2 ? layer.mirrored() : layer;
    pasteLayer(image, sprite, paletteTable(getPart("palette", appearance.palette)), x, FLOOR);
    return { layer: sprite, x, y: FLOOR };
  });
  return { image, backdrop, environment, characters };
}

type Pixels = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
};
const linear = Array.from({ length: 256 }, (_, byte) => {
  const channel = byte / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

function luminance(image: Pixels, x: number, y: number) {
  const offset = (y * image.width + x) * 4;
  const { data } = image;
  return (
    0.2126 * linear[data[offset]!]! +
    0.7152 * linear[data[offset + 1]!]! +
    0.0722 * linear[data[offset + 2]!]!
  );
}

const neighbors: readonly Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function maxNeighborContrast(image: Pixels) {
  let max = 0;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const value = luminance(image, x, y);
      if (x + 1 < WIDTH) max = Math.max(max, Math.abs(value - luminance(image, x + 1, y)));
      if (y + 1 < HEIGHT) max = Math.max(max, Math.abs(value - luminance(image, x, y + 1)));
    }
  }
  return max;
}

export function checkRoomContrast(
  id: RoomId,
  room: ReturnType<typeof renderRoomReview>,
  pngPixels: Pixels,
) {
  // Outline contrast measures readability against the architecture. The second check includes props and light sources.
  const backgroundPeak = maxNeighborContrast(room.backdrop);
  const environmentPeak = maxNeighborContrast(room.environment);
  const scale = pngPixels.width / WIDTH;
  let outlineMin = Infinity;
  let characterPeakMin = Infinity;
  for (const { layer, x, y } of room.characters) {
    let characterPeak = 0;
    for (let row = -layer.rootY; row < layer.height - layer.rootY; row++) {
      for (let col = -layer.rootX; col < layer.width - layer.rootX; col++) {
        const role = layer.get(col, row);
        if (!role) continue;
        const value = luminance(pngPixels, (x + col) * scale, (y + row) * scale);
        for (const [dx, dy] of neighbors) {
          const neighbor = layer.get(col + dx, row + dy);
          const nextX = x + col + dx;
          const nextY = y + row + dy;
          if (neighbor) {
            const adjacent = luminance(pngPixels, nextX * scale, nextY * scale);
            characterPeak = Math.max(characterPeak, Math.abs(value - adjacent));
          } else if (role === OUT) {
            const adjacent = luminance(pngPixels, nextX * scale, nextY * scale);
            outlineMin = Math.min(outlineMin, Math.abs(value - adjacent));
          }
        }
      }
    }
    characterPeakMin = Math.min(characterPeakMin, characterPeak);
  }
  const result = `outline min ${outlineMin.toFixed(4)} > backdrop max ${backgroundPeak.toFixed(4)}; character peak min ${characterPeakMin.toFixed(4)} > environment max ${environmentPeak.toFixed(4)}`;
  if (!(outlineMin > backgroundPeak && characterPeakMin > environmentPeak))
    throw new Error(`${id} contrast failed (${result})`);
  process.stdout.write(`${id} contrast passed (${result})\n`);
}
