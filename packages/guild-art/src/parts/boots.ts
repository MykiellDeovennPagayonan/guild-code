import { px, type Pixel } from "../frame.ts";

function B(id: string, name: string, flat: readonly string[], tip: readonly string[]) {
  return { id, name, v: [px(flat, 1, 1), px(tip, 1, 1)] satisfies [Pixel[], Pixel[]] };
}
export const BOOTS = [
  B("plain", "Socks", ["PP.", "PPP"], ["PP.", ".PP"]),
  B("leather", "Leather", ["dd.", "DDD"], ["dd.", ".DD"]),
  B("sabaton", "Sabaton", ["MM.", "mMMM"], ["MM.", ".mMM"]),
  B("sneaker", "Sneaker", ["AL.", "WWW"], ["AL.", ".WW"]),
  B("sandal", "Sandal", ["SC.", "DDD"], ["SC.", ".DD"]),
  B("stomper", "Stomper", ["BBB", "kkkk"], ["BB.", ".kkk"]),
];
