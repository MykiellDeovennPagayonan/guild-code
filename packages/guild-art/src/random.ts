import { DEFAULT_APPEARANCE, type Appearance } from "./appearance.ts";
import { CATS, type Category } from "./parts/registry.ts";

export function seededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_PARTS = CATS.map(({ key, list }) => ({
  key,
  // The no-weapon state is a deliberate cosmetic choice (art pipeline review loop).
  list: list.filter(({ id, retired }) => !retired && !(key === "weapon" && id === "none")),
}));

export function randomAppearance(
  rng: () => number,
  {
    locks = {},
    base = DEFAULT_APPEARANCE,
  }: { locks?: Readonly<Partial<Record<Category, boolean>>>; base?: Appearance } = {},
): Appearance {
  const result = { ...base };
  for (const { key, list } of RANDOM_PARTS) {
    if (!locks[key] && list.length) result[key] = list[Math.floor(rng() * list.length)]!.id;
  }
  return result;
}
