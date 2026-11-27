import { canvasContext } from "../render/pixelDisplay";

const glyphs = (
  "A010101111101101 B110101110101110 C011100100100011 D110101101101110 E111100110100111 F111100110100100 G011100101101011 H101101111101101 " +
  "I111010010010111 J001001001101010 K101101110101101 L100100100100111 M101111111101101 N110101101101101 O010101101101010 P110101110100100 " +
  "Q010101101110011 R110101110101101 S011100010001110 T111010010010010 U101101101101111 V101101101101010 W101101111111101 X101101010101101 " +
  "Y101101010010010 Z111001010100111 0111101101101111 1010110010010111 2110001010100111 3110001010001110 4101101111001001 5111100110001110 " +
  "6011100111101111 7111001010010010 8111101111101111 9111101111001110 .000000000000010 :000010000010000 /001001010100100 -000000111000000 " +
  "!010010010000010 +000010111010000 x000101010101000 >100010001010100 <001010100010001 ,000000000010100" +
  " [110100100100110 ]011001001001011 '010010000000000 ?110001010000010 (010100100100010 )010001001001010 #101111101111101"
).split(" ");
let atlas: CanvasRenderingContext2D | undefined;
const columns = new Map(glyphs.map((glyph, index) => [glyph[0], index * 3]));

function buildAtlas() {
  const context = canvasContext(glyphs.length * 3, 6);
  for (const [index, glyph] of glyphs.entries()) {
    for (let pixel = 0; pixel < 15; pixel++) {
      if (glyph[pixel + 1] !== "1") continue;
      const x = index * 3 + (pixel % 3);
      const y = Math.floor(pixel / 3);
      context.fillStyle = "#0c0812";
      context.fillRect(x, y + 1, 1, 1);
    }
    for (let pixel = 0; pixel < 15; pixel++) {
      if (glyph[pixel + 1] !== "1") continue;
      context.fillStyle = "#eceaf0";
      context.fillRect(index * 3 + (pixel % 3), Math.floor(pixel / 3), 1, 1);
    }
  }
  return context;
}

export const textWidth = (text: string) => Math.max(0, text.length * 4 - 1);

export function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  atlas ??= buildAtlas();
  for (let i = 0; i < text.length; i++) {
    const glyph = columns.get(text[i]);
    if (glyph === undefined) continue;
    context.drawImage(atlas.canvas, glyph, 0, 3, 6, Math.round(x) + i * 4, Math.round(y), 3, 6);
  }
}
