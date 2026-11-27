import { cw, px, type Pixel, type Point, type Role } from "../frame.ts";

interface OutfitStyle {
  readonly bottom: number;
  readonly sleeve: Role;
  readonly sleeveLen: number;
  readonly sleeveHi?: Role;
  readonly hand: Role;
  readonly leg: Role;
  readonly bulky: number;
  readonly pad?: readonly Pixel[];
}

type OutfitOptions = Partial<OutfitStyle> &
  (
    | { readonly behind: readonly Pixel[]; readonly behindAt: Point }
    | { readonly behind?: never; readonly behindAt?: never }
  );

type Outfit = OutfitStyle & { id: string; name: string; p: readonly Pixel[] } & OutfitOptions;

function O(id: string, name: string, rows: readonly string[], o: OutfitOptions = {}): Outfit {
  return Object.assign(
    {
      id,
      name,
      p: px(rows, cw(rows), rows.length - 1),
      bottom: -5,
      sleeve: "a",
      sleeveLen: 99,
      hand: "S",
      leg: "B",
      bulky: 0,
    },
    o,
  );
}
export const OUTFITS = [
  O("tunic", "Tunic", [".AAAAAAA.", "ALAAKAKAA", "AAAAAAAAA", "BBBBBBBBB", "bBBBBBBBB"], {
    sleeve: "a",
    sleeveHi: "L",
    leg: "B",
  }),
  O("plate", "Plate", [".MMMMMMM.", "MWMMAMMMm", "mMMAAAMMm", "DDDGGGDDD", "aAAA#AAAA"], {
    sleeve: "m",
    hand: "M",
    leg: "k",
    pad: px(["MMM", "mWm"], 1, 0),
  }),
  O(
    "robe",
    "Robe",
    ["..AAAAAAA..", ".aAAAGAAAA.", ".CCCCCCCCC.", ".aAAAAaAAA.", "aAAAAAaAAAA", "aLALALALALA"],
    { bottom: -4, sleeve: "A", sleeveHi: "L", bulky: 1, leg: "a" },
  ),
  O("overalls", "Overalls", [".CCCCCCC.", "CBCCCCCBC", "CBBBGBBBC", "BBBBBBBBB", "bBBBBBBBB"], {
    sleeve: "C",
    sleeveLen: 1,
    leg: "B",
  }),
  O("ninja", "Ninja", ["CCCCCCCCCCC", ".kkkkkkkkk.", ".kjkkkkkkk.", ".AAAAAAAAA.", ".kkkkkkkkk."], {
    sleeve: "k",
    hand: "k",
    leg: "k",
    behind: px(["CC..", "cCCC", "..cC"], 3, 2),
    behindAt: [-5, -7],
  }),
  O("suit", "Suit", ["..WWWWWWW..", ".WWkkkkkWW.", "WWWkAkGkWWW", "wWWWWWWWWWW", ".wWWWWWWWw."], {
    sleeve: "W",
    hand: "A",
    leg: "w",
    bulky: 1,
  }),
  O(
    "poncho",
    "Poncho",
    ["...AAAAAAA...", ".AALAALAALAA.", "aAAAAAAAAAAAA", "CcCcCcCcCcCcC", "..BBBBBBBBB.."],
    { sleeve: "A", sleeveLen: 1, leg: "B" },
  ),
  O("brawler", "Brawler", [".SSSSSSS.", "SDSSSSSSS", "SSDSSSSSS", "kkkGGkkkk", "BBBBBBBBB"], {
    sleeve: "S",
    sleeveLen: 0,
    hand: "W",
    leg: "B",
  }),
];
