import { cycledIndex } from "./cycle.js";

const ACCENTED_VARIANTS: Record<string, string> = {
  a: "áàâäãåā",
  c: "çćč",
  e: "éèêëē",
  i: "íìîïī",
  n: "ñń",
  o: "óòôöõøō",
  s: "ßśš",
  u: "úùûüū",
  y: "ýÿ",
  z: "žźż",
};

const CYCLES = Object.entries(ACCENTED_VARIANTS).flatMap(([letter, variants]) => [
  [letter, ...variants],
  [letter.toUpperCase(), ...variants.toUpperCase()],
]);

// Terminals have no press-and-hold accent menu, so the last letter cycles through its accents instead.
export function cycleLastLetterAccent(text: string, step: 1 | -1 = 1): string {
  const lastLetter = text.slice(-1);
  const cycle = CYCLES.find((letters) => letters.includes(lastLetter));
  if (!cycle) return text;
  return text.slice(0, -1) + cycle[cycledIndex(cycle.indexOf(lastLetter), step, cycle.length)];
}
