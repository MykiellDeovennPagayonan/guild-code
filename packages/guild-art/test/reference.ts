// @effect-diagnostics-next-line nodeBuiltinImport:off -- The same fixture runs in tests and the Node sheet script.
import * as NodeFS from "node:fs";
import * as NodeVM from "node:vm";
import type { Anchors } from "../src/compose.ts";
import type { Appearance } from "../src/appearance.ts";
import type { Pose } from "../src/poses.ts";
import type { RGB } from "../src/palettes.ts";
import type { Category } from "../src/parts/registry.ts";
import type { CLIPS } from "../src/poses.ts";

type Config = Record<Category, number>;
interface ReferenceFrame {
  readonly d: Uint8Array;
  mirrored(): ReferenceFrame;
}
interface ReferenceImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}
interface Reference {
  buildParts(config: Config): unknown;
  composeFrame(parts: unknown, pose: Pose): { layer: ReferenceFrame; anchors: Anchors };
  readonly POSES: Readonly<Record<string, Pose>>;
  readonly POSE_NAMES: readonly string[];
  readonly CLIPS: typeof CLIPS;
  readonly CATS: readonly {
    readonly key: Category;
    readonly list: readonly { id: string }[];
  }[];
  readonly PALETTES: readonly { id: string }[];
  paletteTable(palette: { id: string }): readonly RGB[];
  readonly PRESETS: readonly Config[];
  encode(config: Config): string;
  toJSON(config: Config): Appearance & { code: string };
  buildSheet(config: Config): unknown;
}

function slice(html: string, start: string, end: string) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  if (from === -1 || to === -1) {
    throw new Error(`Reference boundary missing: ${from === -1 ? start : end}`);
  }
  return html.slice(from, to);
}

export function loadReference() {
  const url = new URL("../../../docs/guild-code/index-24.html", import.meta.url);
  const html = NodeFS.readFileSync(url, "utf8");
  const sprite = slice(html, "   SPRITE SYSTEM", "/* nudge an in-flow element");
  const code = sprite.slice(sprite.indexOf("*/") + 2);
  const creator = slice(html, "  const KEYS = CATS.map", "  function store()");
  const exports: { reference?: Reference } = {};
  const context = NodeVM.createContext({ exports });
  NodeVM.runInContext(
    `${code}\n${creator}\nexports.reference = {
      buildParts, composeFrame, POSES, POSE_NAMES, CLIPS, CATS, PALETTES, paletteTable,
      PRESETS, encode, toJSON, buildSheet
    };`,
    context,
    { filename: url.pathname },
  );
  const reference = exports.reference!;

  function renderReferenceSheet(cfg: Config) {
    // Capture the ImageData written to the same canvas that the reference's PNG button exports.
    let image: ReferenceImage | undefined;
    context.document = {
      createElement: () => ({
        getContext: () => ({
          createImageData: (width: number, height: number): ReferenceImage => ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: (data: ReferenceImage) => {
            image = data;
          },
        }),
      }),
    };
    try {
      reference.buildSheet(cfg);
    } finally {
      delete context.document;
    }
    if (!image) throw new Error("Reference buildSheet did not write ImageData");
    return image;
  }

  return { reference, renderReferenceSheet };
}
