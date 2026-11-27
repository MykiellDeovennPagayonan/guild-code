import { randomAppearance } from "@t3tools/guild-art/random";

import { generateCandidateName } from "./names.ts";
import { seededRandom } from "./random.ts";

interface CandidatePool {
  readonly seed: string;
  readonly hiredIndices: readonly number[];
}

export function visibleCandidateIndices(pool: CandidatePool, count = 4): number[] {
  const hired = new Set(pool.hiredIndices);
  const indices: number[] = [];
  for (let index = 0; indices.length < count; index++) {
    if (!hired.has(index)) indices.push(index);
  }
  return indices;
}

export function visibleCandidateNames(pool: CandidatePool, activeNames: Iterable<string>) {
  const taken = new Set(activeNames);
  return visibleCandidateIndices(pool).map((index) => {
    const name = generateCandidateName(pool.seed, index, taken);
    taken.add(name);
    return { index, name };
  });
}

export function generateCandidate(seed: string, index: number, takenNames: Iterable<string>) {
  return {
    name: generateCandidateName(seed, index, takenNames),
    appearance: randomAppearance(seededRandom(JSON.stringify([seed, index, "appearance"]))),
  };
}
