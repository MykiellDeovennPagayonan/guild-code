import { PropLayer, px } from "../frame.ts";

export function prop(rows: readonly string[], details: readonly string[] = []) {
  const width = Math.max(...rows.map((row) => row.length));
  const layer = new PropLayer(width + 2, rows.length + 2);
  const x = 1 - layer.rootX;
  const y = 1 - layer.rootY;
  return layer.put(px(rows), x, y).outline().put(px(details), x, y);
}
