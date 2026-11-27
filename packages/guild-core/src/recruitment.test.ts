import { expect, it } from "vite-plus/test";

import { generateCandidateName } from "./names.ts";
import { visibleCandidateIndices, visibleCandidateNames } from "./recruitment.ts";

it("deterministically names the first four unhired indices without duplicating the active roster", () => {
  const pool = { seed: "fresh-pool", hiredIndices: [4, 0, 2] };
  expect(visibleCandidateIndices(pool)).toEqual([1, 3, 5, 6]);
  const active = visibleCandidateNames(pool, []).map(({ name }) => name.toUpperCase());
  const refreshed = visibleCandidateNames(pool, active);
  const distinct = new Set(
    [...active, ...refreshed.map(({ name }) => name)].map((name) => name.toLowerCase()),
  );
  expect(distinct.size).toBe(8);
  expect(visibleCandidateNames(pool, active)).toEqual(refreshed);
  expect(visibleCandidateNames({ ...pool, seed: "another-pool" }, active)).not.toEqual(refreshed);
});

it("redraws a taken name, then finds an unused numeral after exhausting the draws", () => {
  const first = generateCandidateName("seed", 0, []);
  const taken = new Set([first.toUpperCase()]);
  expect(generateCandidateName("seed", 0, taken)).not.toBe(first);
  for (let index = 0; index < 20; index++) {
    taken.add(generateCandidateName("seed", 0, taken).toUpperCase());
  }
  expect(generateCandidateName("seed", 0, taken)).toMatch(new RegExp(`^${first} [IVX]+$`));
  taken.add(`${first} II`.toUpperCase());
  expect(generateCandidateName("seed", 0, taken)).not.toBe(`${first} II`);
});
