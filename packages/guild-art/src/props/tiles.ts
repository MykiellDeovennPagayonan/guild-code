import type { PropLayer } from "../frame.ts";
import { TILE } from "./palettes.ts";

export const TILE_SIZE = 12;

export function hash(column: number, row: number) {
  let h = (column * 73856093) ^ (row * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function brick(layer: PropLayer, column: number, row: number, x: number, y: number) {
  const h = hash(column, row);
  layer.rect(x, y, TILE_SIZE, TILE_SIZE, TILE.base);
  layer.rect(x, y + 5, TILE_SIZE, 1, TILE.seam);
  layer.rect(x, y + 11, TILE_SIZE, 1, TILE.seam);
  layer.rect(x + (row % 2 ? 3 : 8), y, 1, 5, TILE.seam);
  layer.rect(x + (row % 2 ? 8 : 3), y + 6, 1, 5, TILE.seam);
  layer.rect(x + 2 + (h % 8), y + 1 + ((h >>> 4) % 3), 2, 1, TILE.lite);
  layer.rect(x + 1 + ((h >>> 8) % 9), y + 7 + ((h >>> 12) % 3), 2, 1, TILE.dark);
}

export function drawBackWall(
  layer: PropLayer,
  x: number,
  y: number,
  columns: number,
  rows: number,
) {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      brick(layer, column, row, x + column * TILE_SIZE, y + row * TILE_SIZE);
    }
  }
}

export function drawStoneFloor(
  layer: PropLayer,
  x: number,
  y: number,
  columns: number,
  rows: number,
) {
  drawBackWall(layer, x, y, columns, rows);
  const width = columns * TILE_SIZE;
  layer.rect(x, y, width, 1, TILE.capHi);
  layer.rect(x, y + 1, width, 2, TILE.cap);
  layer.rect(x, y + 3, width, 1, TILE.capLo);
  for (let col = 0; col < columns; col++) {
    const h = hash(col, 0);
    for (let i = 0; i < TILE_SIZE; i += 3) {
      if ((h >>> i) & 1) layer.rect(x + col * TILE_SIZE + i, y + 4, 2, 1, TILE.capLo);
    }
  }
  layer.rect(x, y + rows * TILE_SIZE - 1, width, 1, TILE.out);
}

export function drawWoodenBeam(
  layer: PropLayer,
  x: number,
  y: number,
  length: number,
  thickness: number,
  direction: "horizontal" | "vertical",
) {
  const horizontal = direction === "horizontal";
  const strip = (along: number, across: number, size: number, depth: number, role: number) => {
    if (horizontal) layer.rect(x + along, y + across, size, depth, role);
    else layer.rect(x + across, y + along, depth, size, role);
  };
  strip(0, 0, length, thickness, TILE.timber);
  strip(0, 0, length, 1, TILE.timberEdge);
  strip(0, thickness - 1, length, 1, TILE.timberShade);
  if (thickness < 4) return;
  for (let along = 2; along + 5 < length; along += 7) {
    const h = hash(along + x, y);
    strip(along, 1 + (h % (thickness - 2)), 2 + ((h >>> 5) % 4), 1, TILE.timberShade);
  }
}

export function drawArchedWindow(
  layer: PropLayer,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const arch = [7, 4, 3, 2, 2, 1, 1, 1];
  for (let py = 0; py < height; py++) {
    const inset = arch[py] ?? 0;
    const left = x + inset;
    const inner = width - 2 * inset;
    layer.rect(left - 2, y + py, inner + 4, 1, TILE.out);
    layer.rect(left - 1, y + py, inner + 2, 1, TILE.lite);
    layer.rect(left, y + py, inner, 1, TILE.sky);
    for (let px = inset; px < width - inset; px++) {
      const hill = height - 14 + (hash(Math.floor((x + px) / 5), 7) % 6);
      const trees = height - 7 + (hash(Math.floor((x + px) / 3), 91) % 5);
      if (py >= hill) layer.set(x + px, y + py, py >= trees ? TILE.mid : TILE.far);
      else if (py > 3 && hash(x + px, y + py) % 129 === 0) layer.set(x + px, y + py, TILE.lite);
    }
  }
  const middle = x + Math.floor(width / 2);
  layer.rect(middle, y, 1, height, TILE.out);
  layer.rect(x - 1, y + Math.floor(height / 2), width + 2, 1, TILE.out);
  layer.rect(x - 3, y + height, width + 6, 1, TILE.cap);
  layer.rect(x - 2, y + height + 1, width + 4, 1, TILE.capLo);
}

export function drawDitheredGlow(layer: PropLayer, x: number, y: number, radius = 10) {
  const outer = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = dx * dx + dy * dy;
      const lit = distance < outer * 0.3 ? (dx + dy) & 1 : (dx & 1) === 0 && (dy & 1) === 0;
      if (distance <= outer && lit) layer.set(x + dx, y + dy, TILE.glow);
    }
  }
}
