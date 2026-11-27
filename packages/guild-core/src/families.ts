import type { ServerProvider, ServerProviderModel } from "@t3tools/contracts";

const claudeFamilyAliases = ["opus", "sonnet", "haiku", "fable"];

function modelFamilies(driver: string, model: ServerProviderModel) {
  const names = [model.slug, ...(model.aliases ?? [])];
  const claudeAliases =
    driver === "claudeAgent"
      ? claudeFamilyAliases.filter((alias) =>
          names.some((name) => name === alias || name.startsWith(`${alias}-`)),
        )
      : [];
  const aliases =
    claudeAliases.length > 0
      ? claudeAliases
      : (model.aliases ?? []).filter((alias) => /^[a-z][a-z_-]*$/i.test(alias));
  return aliases.length === 0
    ? [{ key: `${driver}:${model.slug}`, label: model.name }]
    : aliases.map((alias) => ({
        key: `${driver}:${alias}`,
        label: alias.charAt(0).toUpperCase() + alias.slice(1),
      }));
}

export function deriveFamilies(provider: Pick<ServerProvider, "driver" | "models">) {
  const families = new Map<
    string,
    { readonly key: string; readonly label: string; readonly models: ServerProviderModel[] }
  >();
  for (const model of provider.models) {
    for (const family of modelFamilies(provider.driver, model)) {
      const existing = families.get(family.key);
      if (existing === undefined) families.set(family.key, { ...family, models: [model] });
      else if (!existing.models.includes(model)) existing.models.push(model);
    }
  }
  return [...families.values()];
}

export function familyIncludesModel(
  familyKey: string,
  executedModel: string,
  provider: Pick<ServerProvider, "driver" | "models"> | undefined,
): boolean {
  const familyName = familyKey.slice(familyKey.indexOf(":") + 1);
  if (familyName === executedModel) return true;
  if (provider === undefined) return false;
  return (
    deriveFamilies(provider)
      .find(({ key }) => key === familyKey)
      ?.models.some(
        ({ slug, aliases }) => slug === executedModel || aliases?.includes(executedModel),
      ) ?? false
  );
}
