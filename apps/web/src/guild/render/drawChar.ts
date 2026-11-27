import { FH, FW, RX, RY } from "@t3tools/guild-art/frame";
import { POSE_INDEX } from "@t3tools/guild-art/poses";

import type { CharacterSheet } from "./sheetCache";

export function drawChar(
  context: CanvasRenderingContext2D,
  sheet: CharacterSheet,
  pose: string | number,
  x: number,
  y: number,
  facing: -1 | 1,
) {
  const index = typeof pose === "number" ? pose : POSE_INDEX[pose];
  if (index === undefined) return;
  context.drawImage(
    sheet.bitmap,
    index * FW,
    facing < 0 ? FH : 0,
    FW,
    FH,
    Math.round(x) - RX,
    Math.round(y) - RY,
    FW,
    FH,
  );
}
