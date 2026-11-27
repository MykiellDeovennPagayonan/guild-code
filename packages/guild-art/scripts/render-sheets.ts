// @effect-diagnostics nodeBuiltinImport:off -- The review CLI writes standalone files in Node.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";
import * as NodeZlib from "node:zlib";
import { DEFAULT_APPEARANCE, type Appearance } from "../src/appearance.ts";
import { buildParts, composeFrame, type Anchors } from "../src/compose.ts";
import { FH, FW, RX, RY, type PropLayer } from "../src/frame.ts";
import { FIXED, hexRGB, paletteTable, type RGB } from "../src/palettes.ts";
import { MARKERS, MARKER_TABLE } from "../src/markers.ts";
import { CATS, getPart } from "../src/parts/registry.ts";
import { CLIPS, POSE_DEF, POSES, type Pose } from "../src/poses.ts";
import { PROPS, ROOM_PROPS } from "../src/props/index.ts";
import { ROOM_PALETTES, TILE, type RoomId } from "../src/props/palettes.ts";
import { buildSheetFrames, toRGBA } from "../src/sheet.ts";
import { loadReference } from "../test/reference.ts";
import { renderRoomReview, checkRoomContrast, pasteLayer } from "./review-rooms.ts";

interface Image {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

function makeImage(width: number, height: number) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function chunk(name: string, data: Uint8Array) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length, 0);
  bytes.write(name, 4, "ascii");
  bytes.set(data, 8);
  bytes.writeUInt32BE(NodeZlib.crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

function png(image: Image) {
  const { width, height, data } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6], 8);
  const rowBytes = width * 4;
  const scanlines = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    scanlines.set(data.subarray(y * rowBytes, (y + 1) * rowBytes), y * (rowBytes + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", NodeZlib.deflateSync(scanlines)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function blit(dst: Image, src: Image, ox: number, oy: number) {
  for (let y = 0; y < src.height; y++) {
    dst.data.set(
      src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4),
      ((oy + y) * dst.width + ox) * 4,
    );
  }
}

function scale4(image: Image) {
  const result = makeImage(image.width * 4, image.height * 4);
  for (let y = 0; y < result.height; y++) {
    for (let x = 0; x < result.width; x++) {
      const from = ((y >> 2) * image.width + (x >> 2)) * 4;
      result.data.set(image.data.subarray(from, from + 4), (y * result.width + x) * 4);
    }
  }
  return result;
}

const FONT = Object.fromEntries(
  (
    "A010101111101101 B110101110101110 C011100100100011 D110101101101110 E111100110100111 F111100110100100 G011100101101011 H101101111101101 " +
    "I111010010010111 J001001001101010 K101101110101101 L100100100100111 M101111111101101 N110101101101101 O010101101101010 P110101110100100 " +
    "Q010101101110011 R110101110101101 S011100010001110 T111010010010010 U101101101101111 V101101101101010 W101101111111101 X101101010101101 " +
    "Y101101010010010 Z111001010100111 0111101101101111 1010110010010111 2110001010100111 3110001010001110 4101101111001001 5111100110001110 " +
    "6011100111101111 7111001010010010 8111101111101111 9111101111001110 -000000111000000"
  )
    .split(" ")
    .map((glyph) => [glyph[0], glyph.slice(1)]),
);

const LABEL_COLOR = [...hexRGB(FIXED.W), 255];

function label(image: Image, text: string, x: number, y: number) {
  for (const [i, ch] of [...text.toUpperCase()].entries()) {
    const glyph = FONT[ch];
    if (!glyph) continue;
    for (let j = 0; j < glyph.length; j++) {
      if (glyph[j] === "1") {
        image.data.set(
          LABEL_COLOR,
          ((y + Math.floor(j / 3)) * image.width + x + 4 * i + (j % 3)) * 4,
        );
      }
    }
  }
}

const DOTS: Record<keyof Anchors, RGB> = {
  root: [255, 255, 255],
  head: [154, 242, 218],
  handN: [245, 200, 75],
  handF: [232, 105, 74],
  back: [202, 162, 250],
  footN: [246, 133, 155],
  footF: [144, 212, 250],
};

const args = process.argv.slice(2);
const { values } = NodeUtil.parseArgs({
  args: args[0] === "--" ? args.slice(1) : args,
  options: {
    out: { type: "string" },
    anchors: { type: "boolean" },
  },
});
const dir = values.out
  ? NodePath.resolve(values.out)
  : NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "guild-art-"));
NodeFS.mkdirSync(dir, { recursive: true });

function write(name: string, image: Image) {
  const path = NodePath.join(dir, name + ".png");
  NodeFS.writeFileSync(path, png(image));
  process.stdout.write(path + "\n");
}

function reviewSheet(width: number, height: number) {
  const image = makeImage(width, height);
  const background = [...ROOM_PALETTES.guild_hall[TILE.base]!, 255];
  for (let i = 0; i < image.data.length; i += 4) image.data.set(background, i);
  return image;
}

function renderRow(
  image: Image,
  appearance: Appearance,
  poses: readonly Pose[],
  x: number,
  y: number,
  mirror: boolean,
) {
  const parts = buildParts(appearance);
  const composed = poses.map((pose) => composeFrame(parts, pose));
  const frames = composed.map(({ layer }) => layer.d);
  const mirrored = mirror ? composed.map(({ layer }) => layer.mirrored().d) : [];
  const width = FW * frames.length;
  const table = paletteTable(getPart("palette", appearance.palette));
  const rgba = toRGBA({ frames, mirrored }, table);
  for (let row = 0; row < FH * (mirror ? 2 : 1); row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      if (rgba[i + 3])
        image.data.set(rgba.subarray(i, i + 4), ((y + row) * image.width + x + col) * 4);
    }
  }
  if (!values.anchors) return;
  for (const [i, { anchors }] of composed.entries()) {
    for (const key of Object.keys(DOTS) as (keyof Anchors)[]) {
      const [ax, ay] = anchors[key];
      const left = x + i * FW + RX;
      const top = y + RY + ay;
      image.data.set([...DOTS[key], 255], (top * image.width + left + ax) * 4);
      if (mirror) image.data.set([...DOTS[key], 255], ((top + FH) * image.width + left - ax) * 4);
    }
  }
}

const GUTTER = 32;
for (const { key, list } of CATS) {
  const species = key === "species" ? ["species"] : ["nub", "orrok", "lopp"];
  const image = reviewSheet(GUTTER + list.length * FW, 7 + species.length * FH);
  for (const [col, part] of list.entries()) {
    const x = GUTTER + col * FW;
    label(image, part.name, x + 2, 1);
    for (const [row, id] of species.entries()) {
      const y = 7 + row * FH;
      label(image, id, 2, y + 15);
      renderRow(
        image,
        { ...DEFAULT_APPEARANCE, species: id, [key]: part.id },
        [POSE_DEF],
        x,
        y,
        false,
      );
    }
  }
  write(`parts-${key}`, scale4(image));
}

const { reference, renderReferenceSheet } = loadReference();
const presets = reference.PRESETS.map((cfg) => reference.toJSON(cfg));
const samples: Appearance[] = [
  presets[0]!,
  presets[2]!,
  {
    ...DEFAULT_APPEARANCE,
    species: "drakel",
    head: "cat",
    top: "long",
    outfit: "suit",
    back: "jet",
    weapon: "axe",
    palette: "tide",
  },
  presets[1]!,
  {
    ...DEFAULT_APPEARANCE,
    species: "orrok",
    head: "block",
    top: "horns",
    outfit: "plate",
    back: "wings",
    weapon: "mallet",
    palette: "sunny",
  },
];

const reviewClips = [
  ...Object.entries(CLIPS).map(([key, { f }]) => ({
    key,
    names: f.map(([name]) => name),
    poses: f.map(([name]) => POSES[name]!),
  })),
  {
    key: "weapon",
    names: ["held", "hidden", "stowed", "none"],
    poses: [POSE_DEF, { ...POSE_DEF, w: -1 }, { ...POSE_DEF, stow: true }, POSE_DEF] as const,
  },
];
for (const { key, names, poses } of reviewClips) {
  const seated = key === "sit" || key === "write";
  const cellWidth = seated ? 68 : FW;
  const image = reviewSheet(GUTTER + poses.length * cellWidth, 7 + samples.length * FH * 2);
  for (const [i, name] of names.entries()) label(image, name, GUTTER + i * cellWidth + 2, 1);
  for (const [i, appearance] of samples.entries()) {
    const y = 7 + i * FH * 2;
    label(image, appearance.species, 2, y + 15);
    if (seated) {
      label(image, "right", 2, y + 24);
      label(image, "left", 2, y + FH + 24);
      const table = ROOM_PALETTES.guild_hall;
      for (const [col, pose] of poses.entries()) {
        const x = GUTTER + col * cellWidth + (cellWidth - FW) / 2;
        for (const [row, facing] of [1, -1].entries()) {
          const floor = y + row * FH + RY;
          if (key === "write")
            pasteLayer(
              image,
              PROPS.workTable.frames[0]!,
              table,
              x + RX + 12 * facing,
              floor + 2,
              facing,
            );
          pasteLayer(image, PROPS.stool.frames[0]!, table, x + RX - 6 * facing, floor + 2, facing);
        }
        renderRow(image, appearance, [pose], x, y, true);
      }
    } else if (key === "weapon") {
      renderRow(image, appearance, poses.slice(0, -1), GUTTER, y, true);
      renderRow(image, { ...appearance, weapon: "none" }, [POSE_DEF], GUTTER + 3 * FW, y, true);
    } else {
      renderRow(image, appearance, poses, GUTTER, y, true);
    }
  }
  write(`poses-${key}`, scale4(image));
}

const referenceSheets = reference.PRESETS.map(renderReferenceSheet);
const { width, height } = referenceSheets[0]!;
const referenceImage = makeImage(width, height * presets.length);
const portImage = makeImage(width, height * presets.length);
for (const [i, appearance] of presets.entries()) {
  const sheet = buildSheetFrames(appearance, reference.POSE_NAMES);
  blit(referenceImage, referenceSheets[i]!, 0, i * height);
  blit(
    portImage,
    {
      width: sheet.poses.length * FW,
      height: FH * 2,
      data: toRGBA(sheet, paletteTable(getPart("palette", appearance.palette))),
    },
    0,
    i * height,
  );
}
// Native resolution keeps each pair of rows directly comparable with the HTML's PNG export.
write("reference", referenceImage);
write("presets", portImage);

function propSheet(
  entries: readonly { label: string; frame: PropLayer }[],
  table: readonly RGB[],
  columns = 4,
  cellHeight = 43,
) {
  const cellWidth = 68;
  const image = reviewSheet(columns * cellWidth, Math.ceil(entries.length / columns) * cellHeight);
  for (const [index, { label: name, frame }] of entries.entries()) {
    const center = (index % columns) * cellWidth + cellWidth / 2;
    const floor = Math.floor(index / columns) * cellHeight + cellHeight - 11;
    pasteLayer(image, frame, table, center, floor);
    label(image, name, center - name.length * 2, floor + 4);
  }
  return scale4(image);
}

for (const id of Object.keys(ROOM_PROPS) as RoomId[]) {
  const table = ROOM_PALETTES[id];
  write(
    `props-${id}`,
    propSheet(
      ROOM_PROPS[id].flatMap((propId) => {
        const { frames } = PROPS[propId];
        const name = propId.replace(/[A-Z]/g, (letter) => " " + letter);
        return frames.map((frame, i) => ({
          label: frames.length > 1 ? `${name} ${i + 1}` : name,
          frame,
        }));
      }),
      table,
    ),
  );
  const room = renderRoomReview(id, [samples[2]!, samples[3]!, samples[4]!]);
  const preview = scale4(room.image);
  write(`room-${id}`, preview);
  checkRoomContrast(id, room, preview);
}

write(
  "markers",
  propSheet(
    Object.entries(MARKERS).map(([name, marker]) => ({ label: name, frame: marker })),
    MARKER_TABLE,
    5,
    23,
  ),
);
