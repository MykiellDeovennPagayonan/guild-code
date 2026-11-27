import { type Appearance } from "@t3tools/guild-art/appearance";
import { type Anchors } from "@t3tools/guild-art/compose";
import { FH, FW } from "@t3tools/guild-art/frame";
import { PALETTES, paletteTable } from "@t3tools/guild-art/palettes";
import { buildSheetFrames, toRGBA } from "@t3tools/guild-art/sheet";

export interface CharacterSheet {
  readonly bitmap: ImageBitmap;
  readonly anchors: readonly Anchors[];
}

const CAPACITY = 64;
const cache = new Map<string, { sheet: CharacterSheet; used: number }>();
let access = 0;
const pending = new Map<string, Promise<CharacterSheet>>();

export function appearanceKey(appearance: Appearance) {
  return JSON.stringify(appearance, Object.keys(appearance).sort());
}

function buildSheet(appearance: Appearance) {
  // The idle adapter can be replaced with a worker without changing cache or drawing callers.
  return new Promise<CharacterSheet>((resolve, reject) => {
    const compose = () => {
      try {
        const frames = buildSheetFrames(appearance);
        const palette = PALETTES.find(({ id }) => id === appearance.palette) ?? PALETTES[0]!;
        const pixels = toRGBA(frames, paletteTable(palette));
        void createImageBitmap(new ImageData(pixels, frames.poses.length * FW, FH * 2)).then(
          (bitmap) => resolve({ bitmap, anchors: frames.anchors }),
          reject,
        );
      } catch (error) {
        reject(error);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(compose, { timeout: 500 });
    } else {
      window.setTimeout(compose, 0);
    }
  });
}

export function readSheet(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  entry.used = ++access;
  return entry.sheet;
}

export function requestSheet(appearance: Appearance) {
  const key = appearanceKey(appearance);
  const cached = readSheet(key);
  const ready = cached
    ? Promise.resolve(cached)
    : (pending.get(key) ??
      buildSheet(appearance)
        .then((sheet) => {
          cache.set(key, { sheet, used: ++access });
          if (cache.size > CAPACITY) {
            let oldest = key;
            let used = access;
            for (const [candidate, entry] of cache) {
              if (entry.used >= used) continue;
              oldest = candidate;
              used = entry.used;
            }
            cache.get(oldest)?.sheet.bitmap.close();
            cache.delete(oldest);
          }
          return sheet;
        })
        .finally(() => pending.delete(key)));
  if (!cached) pending.set(key, ready);
  return { key, ready };
}
