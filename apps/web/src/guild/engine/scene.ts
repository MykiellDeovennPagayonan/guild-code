import { RX, RY } from "@t3tools/guild-art/frame";

import { canvasContext } from "../render/pixelDisplay";
import { getPropImage, type PropId } from "../render/props";
import { Camera, VIEW_HEIGHT, VIEW_WIDTH } from "./camera";
import { TILE, type CollisionMap, type Facing } from "./player";
import { drawText } from "./text";

export type SceneId = "guild_hall" | "recruitment_hall";

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

interface ParallaxLayerDef {
  readonly speed: number;
  readonly y: number;
  readonly kind: "pillars" | "arches";
}

const PALETTES = {
  guild_hall: {
    wall: "#1b1526",
    mortar: "#21192c",
    far: "#241a2e",
    farLite: "#2a2035",
    mid: "#2b2137",
    midLite: "#34283e",
    beam: "#322632",
    glow: "#3a2937",
  },
  recruitment_hall: {
    wall: "#171a26",
    mortar: "#1c2130",
    far: "#202637",
    farLite: "#262d40",
    mid: "#253044",
    midLite: "#2e3950",
    beam: "#343042",
    glow: "#393347",
  },
};

export interface SceneDef {
  readonly id: SceneId;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly string[];
  readonly palette: keyof typeof PALETTES;
  readonly parallax: readonly ParallaxLayerDef[];
  readonly props: readonly PropPlacement[];
  readonly doors: readonly DoorDef[];
  readonly interactables: readonly InteractableDef[];
  readonly npcSlots: readonly NpcSlotDef[];
  readonly spawn: { readonly x: number; readonly y: number };
}

export function flatRoom(cols: number) {
  return {
    cols,
    rows: 18,
    tiles: Array.from({ length: 18 }, (_, row) => (row < 15 ? "." : "#").repeat(cols)),
    parallax: [
      { kind: "pillars", speed: 0.2, y: 0 },
      { kind: "arches", speed: 0.45, y: 34 },
    ] satisfies ParallaxLayerDef[],
  };
}

function hash(x: number, y: number) {
  let value = (x * 73856093) ^ (y * 19349663);
  value = (value ^ (value >>> 13)) * 1274126177;
  return (value ^ (value >>> 16)) >>> 0;
}

export class Scene implements CollisionMap {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly camera = new Camera();
  private readonly wall: HTMLCanvasElement;
  private readonly foreground: HTMLCanvasElement;
  private readonly parallax: readonly { layer: ParallaxLayerDef; image: HTMLCanvasElement }[];

  constructor(readonly def: SceneDef) {
    this.width = def.cols * TILE;
    this.height = def.rows * TILE;
    this.title = def.name.toUpperCase();
    this.wall = this.buildWall();
    this.parallax = def.parallax.map((layer) => ({ layer, image: this.buildParallax(layer) }));
    this.foreground = this.buildForeground();
  }

  solid(col: number, row: number) {
    return col < 0 || col >= this.def.cols || this.def.tiles[row]?.[col] === "#";
  }

  floor(col: number, row: number) {
    return this.solid(col, row) || this.def.tiles[row]?.[col] === "=";
  }

  draw(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, still: boolean) {
    context.fillStyle = PALETTES[this.def.palette].wall;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    context.drawImage(this.wall, -cameraX, -cameraY);
    for (const { layer, image } of this.parallax) {
      const offset = Math.floor(cameraX * (still ? 1 : layer.speed)) % image.width;
      for (let x = -offset; x < VIEW_WIDTH; x += image.width) {
        context.drawImage(image, x, layer.y - Math.floor(cameraY * (still ? 1 : 0.5)));
      }
    }
    context.drawImage(this.foreground, -cameraX, -cameraY);
  }

  private buildWall() {
    const context = canvasContext(this.width, this.height);
    const colors = PALETTES[this.def.palette];
    context.fillStyle = colors.wall;
    context.fillRect(0, 0, this.width, this.height);
    context.fillStyle = colors.mortar;
    for (let row = 0; row < this.def.rows; row++) {
      const y = row * TILE;
      context.fillRect(0, y, this.width, 1);
      for (let x = row % 2 ? TILE : 0; x < this.width; x += TILE * 2) {
        context.fillRect(x, y, 1, TILE);
      }
    }
    return context.canvas;
  }

  private buildParallax(layer: ParallaxLayerDef) {
    const colors = PALETTES[this.def.palette];
    const context = canvasContext(192, VIEW_HEIGHT);
    for (const x of [34, 130]) {
      if (layer.kind === "pillars") {
        context.fillStyle = colors.far;
        context.fillRect(x - 2, 0, 24, VIEW_HEIGHT);
        context.fillRect(x - 6, 16, 32, 5);
        context.fillStyle = colors.farLite;
        context.fillRect(x, 21, 2, VIEW_HEIGHT - 21);
        context.fillRect(x - 6, 15, 32, 1);
      } else {
        context.fillStyle = colors.mid;
        context.fillRect(x - 11, 15, 6, 96);
        context.fillRect(x + 38, 15, 6, 96);
        context.fillRect(x - 5, 8, 7, 7);
        context.fillRect(x + 31, 8, 7, 7);
        context.fillRect(x + 2, 4, 29, 5);
        context.fillStyle = colors.midLite;
        context.fillRect(x + 2, 4, 29, 1);
        context.fillRect(x - 11, 110, 55, 2);
      }
    }
    return context.canvas;
  }

  private buildForeground() {
    const context = canvasContext(this.width, this.height);
    const colors = PALETTES[this.def.palette];
    for (const y of [15, this.def.spawn.y - 39]) {
      context.fillStyle = colors.beam;
      context.fillRect(0, y, this.width, 4);
      context.fillStyle = colors.mortar;
      context.fillRect(0, y + 3, this.width, 1);
    }

    for (let row = 0; row < this.def.rows; row++) {
      for (let col = 0; col < this.def.cols; col++) {
        if (!this.floor(col, row)) continue;
        const x = col * TILE;
        const y = row * TILE;
        const seed = hash(col, row);
        const solid = this.solid(col, row);
        context.fillStyle = "#342b47";
        context.fillRect(x, y, TILE, solid ? TILE : 5);
        if (solid) {
          context.fillStyle = "#2b233b";
          context.fillRect(x, y + 5, TILE, 1);
          context.fillRect(x, y + 11, TILE, 1);
          context.fillRect(x + (row % 2 ? 3 : 8), y, 1, 5);
          context.fillRect(x + (row % 2 ? 8 : 3), y + 6, 1, 5);
          context.fillStyle = "#41375b";
          context.fillRect(x + 2 + (seed % 8), y + 1 + ((seed >>> 4) % 3), 2, 1);
          context.fillStyle = "#261f35";
          context.fillRect(x + 1 + ((seed >>> 8) % 9), y + 7 + ((seed >>> 12) % 3), 2, 1);
        }
        if (!this.solid(col, row - 1)) {
          context.fillStyle = "#1b1126";
          context.fillRect(x, y, TILE, 1);
          context.fillStyle = "#75679a";
          context.fillRect(x, y + 1, TILE, 2);
          context.fillStyle = "#9a8cba";
          context.fillRect(x, y + 1, TILE, 1);
          context.fillStyle = "#52466f";
          context.fillRect(x, y + 3, TILE, 1);
        }
      }
    }

    for (const { propId, x, y } of this.def.props) {
      if (propId === "lantern") {
        context.fillStyle = colors.glow;
        for (let dy = -10; dy <= 10; dy++) {
          for (let dx = -10; dx <= 10; dx++) {
            const squared = dx * dx + dy * dy;
            if (squared <= 100 && (squared < 30 ? (dx + dy) % 2 : dx % 2 === 0 && dy % 2 === 0)) {
              context.fillRect(x + dx, y - 7 + dy, 1, 1);
            }
          }
        }
      }
      const image = getPropImage(propId);
      if (image) context.drawImage(image, x - RX, y - RY);
    }
    for (const door of this.def.doors) {
      const image = getPropImage("door");
      if (image) context.drawImage(image, door.x - RX, door.y - RY);
    }
    for (const item of this.def.interactables) {
      if (item.id === "quest_board") drawText(context, "COMING SOON", item.x - 21, item.y - 37);
    }
    return context.canvas;
  }
}
