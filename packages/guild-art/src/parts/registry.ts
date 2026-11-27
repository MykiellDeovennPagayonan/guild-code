import { PALETTES } from "../palettes.ts";
import { BACKS } from "./backs.ts";
import { BOOTS } from "./boots.ts";
import { FACES } from "./faces.ts";
import { HEADS } from "./heads.ts";
import { OUTFITS } from "./outfits.ts";
import { SPECIES } from "./species.ts";
import { TOPS } from "./tops.ts";
import { REFERENCE_WEAPON_COUNT, WEAPONS } from "./weapons.ts";

// Code positions are permanent. Append to these lists and keep the legacy counts fixed.
const PARTS = {
  species: SPECIES,
  head: HEADS,
  top: TOPS,
  face: FACES,
  outfit: OUTFITS,
  boots: BOOTS,
  back: BACKS,
  weapon: WEAPONS,
  palette: PALETTES,
};

export type Category = keyof typeof PARTS;

interface PartChoice {
  readonly id: string;
  readonly name: string;
  readonly retired?: boolean;
}

export const CATS: readonly {
  readonly key: Category;
  readonly label: string;
  readonly list: readonly PartChoice[];
  readonly referenceCount: number;
}[] = [
  { key: "species", label: "species", list: PARTS.species, referenceCount: 5 },
  { key: "head", label: "head", list: PARTS.head, referenceCount: 7 },
  { key: "top", label: "top", list: PARTS.top, referenceCount: 10 },
  { key: "face", label: "face", list: PARTS.face, referenceCount: 9 },
  { key: "outfit", label: "outfit", list: PARTS.outfit, referenceCount: 8 },
  { key: "boots", label: "boots", list: PARTS.boots, referenceCount: 6 },
  { key: "back", label: "back", list: PARTS.back, referenceCount: 7 },
  { key: "weapon", label: "weapon", list: PARTS.weapon, referenceCount: REFERENCE_WEAPON_COUNT },
  { key: "palette", label: "palette", list: PARTS.palette, referenceCount: 8 },
];

export function getPart<K extends Category>(key: K, id: string) {
  const parts: readonly (typeof PARTS)[K][number][] = PARTS[key];
  const part = parts.find((option) => option.id === id);
  if (!part) throw new Error(`Unknown ${key} id "${id}"`);
  return part;
}
