import type { Appearance } from "@t3tools/guild-art/appearance";
import { MARKERS, MARKER_TABLE, type MarkerId } from "@t3tools/guild-art/markers";
import { layerToRGBA } from "@t3tools/guild-art/palettes";
import { CLIPS } from "@t3tools/guild-art/poses";

import { canvasContext } from "../render/pixelDisplay";
import { drawText, textWidth } from "./text";
import type { Facing } from "./player";
import type { SceneId } from "./scene";

export interface NpcEntity {
  readonly kind: "npc";
  readonly id: string;
  readonly name: string;
  readonly sceneId: SceneId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly facing: Facing;
  readonly appearance: Appearance;
  readonly clip: keyof typeof CLIPS;
  readonly marker?: MarkerId | null;
  readonly badgeCount?: number;
}

export interface GuildPresentation {
  readonly npcs: readonly NpcEntity[];
}

export class NpcClip {
  private frame = 0;
  private time = 0;

  constructor(private readonly clip: keyof typeof CLIPS) {}

  step(dt: number) {
    const { f, loop } = CLIPS[this.clip];
    this.time += dt * 1000;
    while (this.time >= f[this.frame]![1]) {
      this.time -= f[this.frame]![1];
      if (!loop && this.frame === f.length - 1) return;
      this.frame = (this.frame + 1) % f.length;
    }
  }

  pose(still: boolean) {
    return CLIPS[this.clip].f[still ? 0 : this.frame]![0];
  }
}

const markerImages = new Map<MarkerId, HTMLCanvasElement>();

function markerImage(id: MarkerId) {
  const existing = markerImages.get(id);
  if (existing) return existing;
  const { width, height, data } = layerToRGBA(MARKERS[id], MARKER_TABLE);
  const context = canvasContext(width, height);
  context.putImageData(new ImageData(data, width, height), 0, 0);
  markerImages.set(id, context.canvas);
  return context.canvas;
}

export function prepareNpcOverhead(entity: NpcEntity) {
  const name = entity.name.toUpperCase();
  const plate = entity.badgeCount ? `${name} x${entity.badgeCount}` : name;
  return {
    plate,
    width: textWidth(plate),
    marker: entity.marker ? markerImage(entity.marker) : null,
  };
}

export function drawNpcOverhead(
  context: CanvasRenderingContext2D,
  overhead: ReturnType<typeof prepareNpcOverhead>,
  x: number,
  y: number,
  height: number,
) {
  const center = Math.round(x);
  const top = Math.round(y) - height;
  const { plate, width, marker } = overhead;
  const left = Math.max(
    1,
    Math.min(context.canvas.width - width - 2, center - Math.floor(width / 2)),
  );
  context.fillStyle = "#16101c";
  context.fillRect(left - 2, top - 8, width + 4, 8);
  drawText(context, plate, left, top - 7);
  if (marker)
    context.drawImage(marker, center - Math.floor(marker.width / 2), top - marker.height - 10);
}
