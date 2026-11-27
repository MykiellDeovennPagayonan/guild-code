import { px } from "../frame.ts";

function F(id: string, name: string, rows: readonly string[]) {
  return { id, name, p: px(rows, 3, 0) };
}
export const FACES = [
  F("dots", "Dots", [".E...E.", ".E...E.", "...E..."]),
  F("happy", "Happy", [".E...E.", "E.E.E.E", "...E..."]),
  F("angry", "Angry", ["E.....E", ".E...E.", "..EEE.."]),
  F("sleepy", "Sleepy", [".......", "EE...EE", "...E..."]),
  F("cyclops", "Cyclops", ["..EEE..", "..EHE..", "..EEE.."]),
  F("shiny", "Shiny", ["EE...EE", "EH...EH", "...e..."]),
  F("grin", "Grin", [".E...E.", ".EWEWE.", "..EEE.."]),
  F("dizzy", "Dizzy", ["E.E.E.E", ".E...E.", "E.E.E.E"]),
  F("scan", "Scanner", [".......", "EEeeEEE", "......."]),
];
