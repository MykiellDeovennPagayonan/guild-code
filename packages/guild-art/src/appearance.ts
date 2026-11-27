import { CATS, type Category } from "./parts/registry.ts";

export type Appearance = { readonly v: 1 } & Readonly<Record<Category, string>>;

export const DEFAULT_APPEARANCE: Appearance = {
  v: 1,
  species: "nub",
  head: "visor",
  top: "brim",
  face: "dots",
  outfit: "tunic",
  boots: "plain",
  back: "none",
  weapon: "blade",
  palette: "ember",
};

type AppearanceIssue =
  | { readonly kind: "invalid-format" }
  | { readonly kind: "unsupported-version"; readonly version: unknown }
  | { readonly kind: "unknown-part"; readonly category: Category; readonly value: unknown };

// @effect-diagnostics-next-line extendsNativeError:off -- The codec also runs without an Effect runtime.
export class AppearanceError extends Error {
  override readonly name = "AppearanceError";
  readonly issue: AppearanceIssue;

  constructor(issue: AppearanceIssue) {
    const part =
      issue.kind === "unknown-part" &&
      (typeof issue.value === "string" || typeof issue.value === "number")
        ? ` "${issue.value}"`
        : "";
    super(
      issue.kind === "unknown-part"
        ? `Unknown appearance part${part} for ${issue.category}`
        : issue.kind === "unsupported-version"
          ? "Unsupported appearance schema version"
          : "Invalid appearance format",
    );
    this.issue = issue;
  }
}

function readObject(input: unknown, legacy: boolean): Appearance {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AppearanceError({ kind: "invalid-format" });
  }
  const value = input as Record<string, unknown>;
  if (value.v !== 1 && !(legacy && value.v === undefined)) {
    throw new AppearanceError({ kind: "unsupported-version", version: value.v });
  }
  const result = { ...DEFAULT_APPEARANCE };
  for (const { key, list, referenceCount } of CATS) {
    const part = legacy && key === "species" && value[key] === undefined ? "nub" : value[key];
    const id =
      legacy &&
      typeof part === "number" &&
      Number.isInteger(part) &&
      part >= 0 &&
      part < referenceCount
        ? list[part]?.id
        : part;
    if (typeof id !== "string" || !list.some((entry) => entry.id === id)) {
      throw new AppearanceError({ kind: "unknown-part", category: key, value: part });
    }
    result[key] = id;
  }
  return result;
}

export function parseAppearance(input: unknown): Appearance {
  return readObject(input, false);
}

export function importAppearance(input: string): Appearance {
  const text = input.trim();
  if (text.startsWith("{")) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new AppearanceError({ kind: "invalid-format" });
    }
    return readObject(value, true);
  }

  const match = /^#?(PX[12]|GLD(\d+))-([0-9a-z]+)$/i.exec(text);
  if (!match) throw new AppearanceError({ kind: "invalid-format" });
  const [, prefix, version, digits] = match;
  if (version !== undefined && version !== "1") {
    throw new AppearanceError({ kind: "unsupported-version", version });
  }
  const px1 = prefix?.toUpperCase() === "PX1";
  const width = version === undefined ? 1 : 2;
  const categories = px1 ? CATS.slice(1) : CATS;
  if (digits?.length !== categories.length * width) {
    throw new AppearanceError({ kind: "invalid-format" });
  }
  const result = { ...DEFAULT_APPEARANCE };
  for (const [i, { key, list, referenceCount }] of categories.entries()) {
    const index = Number.parseInt(digits.slice(i * width, (i + 1) * width), 36);
    const part = width === 1 && index >= referenceCount ? undefined : list[index];
    if (!part) throw new AppearanceError({ kind: "unknown-part", category: key, value: index });
    result[key] = part.id;
  }
  return result;
}

export function exportAppearance(
  appearance: Appearance,
  format: "GLD1" | "PX1" | "PX2" = "GLD1",
): string | undefined {
  const value = parseAppearance(appearance);
  if (format === "PX1" && value.species !== "nub") return undefined;
  const categories = format === "PX1" ? CATS.slice(1) : CATS;
  const width = format === "GLD1" ? 2 : 1;
  let digits = "";
  for (const { key, list, referenceCount } of categories) {
    const index = list.findIndex((entry) => entry.id === value[key]);
    if (width === 1 && index >= referenceCount) return undefined;
    if (index >= 36 ** width) return undefined;
    digits += index.toString(36).padStart(width, "0");
  }
  return `${format}-${digits}`;
}
