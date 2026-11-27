import type { PropId } from "@t3tools/guild-art/props";
import type { RoomId } from "@t3tools/guild-art/props/palettes";
import { TILE_SIZE } from "@t3tools/guild-art/props/tiles";

import { getDocumentActivity } from "../../lib/documentActivity";
import { getPropSprite } from "../render/props";
import { buildRoomLayers, type RoomArchitecture, WINDOW_TOP } from "../render/room";
import { Camera } from "./camera";
import type { CollisionMap, Facing } from "./player";

export type SceneId = RoomId;

interface TargetAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DoorDef extends TargetAnchor {
  readonly kind: "door";
  readonly label: string;
  readonly target: SceneId;
  readonly targetDoor: string;
  readonly facing: Facing;
  readonly locked?: string;
}

export interface InteractableDef extends TargetAnchor {
  readonly kind: "interactable";
  readonly label: string;
}

interface NpcSlotDef {
  readonly id: string;
  readonly x: number;
  readonly kind: "seat" | "stand" | "desk";
  readonly activity: readonly ("available" | "working")[];
}

interface PropPlacement {
  readonly propId: PropId;
  readonly x: number;
  readonly y: number;
}

export interface SceneDef {
  readonly id: SceneId;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly floorY: number;
  readonly tiles: readonly string[];
  readonly architecture: RoomArchitecture;
  readonly props: readonly PropPlacement[];
  readonly doors: readonly DoorDef[];
  readonly interactables: readonly InteractableDef[];
  readonly npcSlots: readonly NpcSlotDef[];
  readonly spawn: { readonly x: number; readonly y: number };
}

export const ROOM_FLOOR = 15 * TILE_SIZE;

export function flatRoom(cols: number) {
  return {
    cols,
    rows: 18,
    floorY: ROOM_FLOOR,
    tiles: Array.from({ length: 18 }, (_, row) => (row < 15 ? "." : "#").repeat(cols)),
  };
}

const MAX_AMBIENT_FRAME_GAP_MS = 100;

export class Scene implements CollisionMap {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly camera = new Camera();
  private readonly layers: ReturnType<typeof buildRoomLayers>;
  private readonly props;
  private ambientTime = 0;
  private lastDraw: number | undefined;

  constructor(readonly def: SceneDef) {
    this.width = def.cols * TILE_SIZE;
    this.height = def.rows * TILE_SIZE;
    this.title = def.name.toUpperCase();
    this.layers = buildRoomLayers(def.id, def.architecture, this.width, this.height, def.floorY);
    const doors = def.doors.map(({ x, y }) => ({ x, y, propId: "door" as const }));
    this.props = [...def.props, ...doors].flatMap(({ x, y, propId }) => {
      const sprite = getPropSprite(def.id, propId);
      return sprite ? [{ x, y, ...sprite }] : [];
    });
  }

  solid(col: number, row: number) {
    return col < 0 || col >= this.def.cols || this.def.tiles[row]?.[col] === "#";
  }

  floor(col: number, row: number) {
    return this.solid(col, row) || this.def.tiles[row]?.[col] === "=";
  }

  draw(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, still: boolean) {
    const { wall, landscape, landscapeMargin } = this.layers;
    const parallaxX = still ? cameraX : Math.floor(cameraX * 0.8);
    const elapsed = this.ambientElapsed(still);
    context.drawImage(landscape, -parallaxX - landscapeMargin, WINDOW_TOP - cameraY);
    context.drawImage(wall, -cameraX, -cameraY);
    for (const { x, y, frames, frameMs } of this.props) {
      const frame = frames[Math.floor(elapsed / frameMs) % frames.length]!;
      context.drawImage(frame.image, x - cameraX - frame.rootX, y - cameraY - frame.rootY);
    }
  }

  private ambientElapsed(still: boolean) {
    const { focused, visible } = getDocumentActivity();
    if (still || !focused || !visible) {
      this.lastDraw = undefined;
      return still ? 0 : this.ambientTime;
    }
    const now = performance.now();
    if (this.lastDraw !== undefined) {
      const gap = now - this.lastDraw;
      // The engine can draw once on suspension. Resume from the last visible frame.
      if (gap <= MAX_AMBIENT_FRAME_GAP_MS) this.ambientTime += gap;
    }
    this.lastDraw = now;
    return this.ambientTime;
  }
}
