import type { PropLayer } from "@t3tools/guild-art/frame";
import { layerToRGBA, type RGB } from "@t3tools/guild-art/palettes";
import { PROPS, type PropArt, type PropId } from "@t3tools/guild-art/props";
import { ROOM_PALETTES, type RoomId } from "@t3tools/guild-art/props/palettes";

import { canvasContext } from "./pixelDisplay";

export function layerCanvas(layer: PropLayer, palette: readonly RGB[]) {
  const { width, height, data } = layerToRGBA(layer, palette);
  const context = canvasContext(width, height);
  context.putImageData(new ImageData(data, width, height), 0, 0);
  return context.canvas;
}

function buildProp(room: RoomId, propId: PropId) {
  const { frames, frameMs }: PropArt = PROPS[propId];
  return {
    frameMs: frameMs ?? Infinity,
    frames: frames.map((layer) => ({
      image: layerCanvas(layer, ROOM_PALETTES[room]),
      rootX: layer.rootX,
      rootY: layer.rootY,
    })),
  };
}

const sprites = new Map<string, ReturnType<typeof buildProp> | null>();

export function getPropSprite(room: RoomId, propId: PropId) {
  const key = `${room}:${propId}`;
  const cached = sprites.get(key);
  if (cached !== undefined) return cached;
  try {
    const sprite = buildProp(room, propId);
    sprites.set(key, sprite);
    return sprite;
  } catch (error) {
    console.warn("Could not draw Guild prop", room, propId, error);
    sprites.set(key, null);
    return null;
  }
}
