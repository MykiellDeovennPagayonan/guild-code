import { seededRandom } from "./random.ts";

const openings = [
  "Ad",
  "Aer",
  "Al",
  "Am",
  "Ar",
  "Bel",
  "Br",
  "Cal",
  "Cor",
  "Da",
  "Del",
  "Dra",
  "Eir",
  "El",
  "Em",
  "Eri",
  "Fa",
  "Fen",
  "Gal",
  "Hal",
  "Iri",
  "Is",
  "Ka",
  "Kel",
  "La",
  "Li",
  "Lor",
  "Mae",
  "Mer",
  "Mi",
  "Na",
  "Nel",
  "Or",
  "Ra",
  "Ren",
  "Sa",
  "Sel",
  "Tal",
  "Th",
  "Val",
] as const;

const endings = [
  "a",
  "adan",
  "ail",
  "ana",
  "arin",
  "as",
  "ask",
  "dan",
  "del",
  "den",
  "e",
  "el",
  "en",
  "eth",
  "ia",
  "iel",
  "in",
  "ira",
  "is",
  "ith",
  "lan",
  "len",
  "lin",
  "lor",
  "mere",
  "mir",
  "na",
  "nor",
  "on",
  "ora",
  "orn",
  "owen",
  "ra",
  "ren",
  "ric",
  "rin",
  "ros",
  "thas",
  "wen",
  "wyn",
] as const;

const candidates = openings
  .flatMap((opening) => endings.map((ending) => opening + ending))
  .filter((name) => !/[^aeiou]{4}|([a-z])\1\1|anal|arse|ass|damn|hell/i.test(name));

const romanNumerals = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function generateCandidateName(
  seed: string,
  index: number,
  takenNames: Iterable<string>,
): string {
  const random = seededRandom(JSON.stringify([seed, index]));
  const taken = new Set(Array.from(takenNames, (name) => name.toLowerCase()));
  const draw = () => candidates[Math.floor(random() * candidates.length)]!;
  const first = draw();
  let name = first;
  for (let redraw = 0; redraw < 20 && taken.has(name.toLowerCase()); redraw++) {
    name = draw();
  }
  if (!taken.has(name.toLowerCase())) return name;

  let numeral = 2;
  for (;;) {
    const numbered = `${first} ${romanNumerals[numeral - 2] ?? numeral}`;
    if (!taken.has(numbered.toLowerCase())) return numbered;
    numeral++;
  }
}
