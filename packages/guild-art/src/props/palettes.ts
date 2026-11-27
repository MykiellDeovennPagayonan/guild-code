import { ROLE_CHARS } from "../frame.ts";
import { PALETTES, hexRGB, paletteTable } from "../palettes.ts";

const materials = {
  D: "#986b51",
  d: "#684435",
  M: "#a69da1",
  m: "#6d616d",
  W: "#d8c29c",
  w: "#ab8a70",
  G: "#d9a754",
  g: "#976139",
  X: "#f2d38b",
  k: "#4b3b4e",
  j: "#69576a",
};

const stone = {
  sky: "#42394f",
  far: "#45405a",
  mid: "#4d4862",
  base: "#5b4d63",
  seam: "#55475e",
  lite: "#605268",
  dark: "#51455b",
  out: "#483c51",
  cap: "#625464",
  capHi: "#645362",
  capLo: "#5b4a5d",
  timber: "#5c444c",
  timberEdge: "#684d50",
  timberShade: "#4c3a46",
  glow: "#624b53",
};

const hexPalettes = {
  guild_hall: {
    ...materials,
    A: "#854852",
    a: "#5a3847",
    L: "#aa6365",
    B: "#647555",
    b: "#495344",
    C: "#977053",
    c: "#695037",
    ...stone,
  },
  recruitment_hall: {
    ...materials,
    A: "#426f6d",
    a: "#345050",
    L: "#6e9290",
    B: "#676b89",
    b: "#4d5069",
    C: "#a6615e",
    c: "#744949",
    ...stone,
    sky: "#3d4055",
    far: "#424a5c",
    mid: "#4c5564",
    base: "#565368",
    seam: "#504d61",
    lite: "#5c596f",
    dark: "#4c495f",
    cap: "#5f566a",
    capHi: "#61586a",
    capLo: "#534b60",
    timber: "#524653",
    timberEdge: "#64515b",
    timberShade: "#473b4d",
    glow: "#605061",
  },
};

export type RoomId = keyof typeof hexPalettes;
type TileRole = keyof typeof stone;

const tileRoles = Object.keys(stone) as TileRole[];
export const TILE = Object.fromEntries(
  tileRoles.map((role, index) => [role, ROLE_CHARS.length + index]),
) as Readonly<Record<TileRole, number>>;

function roomTable(palette: (typeof hexPalettes)[RoomId]) {
  return [
    ...paletteTable({ ...PALETTES[0]!, ...palette }),
    ...tileRoles.map((role) => hexRGB(palette[role])),
  ];
}

export const ROOM_PALETTES = {
  guild_hall: roomTable(hexPalettes.guild_hall),
  recruitment_hall: roomTable(hexPalettes.recruitment_hall),
};
