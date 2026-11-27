import type { Appearance } from "./appearance.ts";
import { buildParts, composeFrame, type Anchors } from "./compose.ts";
import { FW, FH } from "./frame.ts";
import type { RGB } from "./palettes.ts";
import { POSES, POSE_NAMES } from "./poses.ts";

export interface SheetFrames {
  readonly poses: readonly string[];
  readonly frames: readonly Uint8Array[];
  readonly mirrored: readonly Uint8Array[];
  readonly anchors: readonly Anchors[];
}

export function buildSheetFrames(
  appearance: Appearance,
  names: readonly string[] = POSE_NAMES,
): SheetFrames {
  const parts = buildParts(appearance);
  const frames: Uint8Array[] = [];
  const mirrored: Uint8Array[] = [];
  const anchors: Anchors[] = [];
  for (const name of names) {
    const frame = composeFrame(parts, POSES[name]!);
    frames.push(frame.layer.d);
    mirrored.push(frame.layer.mirrored().d);
    anchors.push(frame.anchors);
  }
  return { poses: [...names], frames, mirrored, anchors };
}

export function toRGBA(sheet: Pick<SheetFrames, "frames" | "mirrored">, table: readonly RGB[]) {
  const width = sheet.frames.length * FW;
  const data = new Uint8ClampedArray(width * FH * 2 * 4);
  for (const [row, frames] of [sheet.frames, sheet.mirrored].entries()) {
    for (const [col, frame] of frames.entries()) {
      for (let y = 0; y < FH; y++) {
        for (let x = 0; x < FW; x++) {
          const c = frame[y * FW + x];
          if (!c) continue;
          const i = ((row * FH + y) * width + col * FW + x) * 4;
          const [r, g, b] = table[c]!;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  return data;
}
