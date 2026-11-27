import {
  isProviderAvailable,
  type ModelSelection,
  type ProviderOptionSelection,
  type ServerProvider,
} from "@t3tools/contracts";
import type { GuildBindingError, ModelBinding } from "@t3tools/contracts/guild";

import { deriveFamilies } from "./families.ts";

export function resolveBinding(
  binding: ModelBinding,
  providers: readonly ServerProvider[],
):
  | { readonly ok: ModelSelection }
  | { readonly error: Pick<GuildBindingError, "code" | "reason"> } {
  const provider = providers.find(({ instanceId }) => instanceId === binding.providerInstanceId);
  if (
    provider === undefined ||
    !provider.enabled ||
    !provider.installed ||
    provider.status === "disabled" ||
    provider.status === "error" ||
    provider.auth.status === "unauthenticated" ||
    !isProviderAvailable(provider)
  ) {
    return {
      error: {
        code: "provider_unavailable",
        reason:
          provider?.unavailableReason ??
          provider?.message ??
          (provider?.auth.status === "unauthenticated"
            ? "The provider is signed out."
            : "The provider is unavailable."),
      },
    };
  }

  const family = deriveFamilies(provider).find(({ key }) => key === binding.family.key);
  const candidates = family?.models.filter(({ isLegacy }) => !isLegacy) ?? [];
  const model =
    binding.pinnedModel === null
      ? (candidates.find(({ isDefault }) => isDefault) ?? candidates[0])
      : family?.models.find(({ slug }) => slug === binding.pinnedModel);
  if (model === undefined) {
    return {
      error:
        binding.pinnedModel === null
          ? { code: "family_unavailable", reason: "The provider offers no model in this family." }
          : {
              code: "pinned_model_unavailable",
              reason: "The pinned model is no longer offered in this family.",
            },
    };
  }

  const options: ProviderOptionSelection[] = [];
  for (const [id, value] of Object.entries(binding.options ?? {})) {
    const descriptor = model.capabilities?.optionDescriptors?.find((option) => option.id === id);
    if (descriptor?.type === "select" && descriptor.options.some((choice) => choice.id === value)) {
      options.push({ id, value });
    } else if (descriptor?.type === "boolean" && (value === "true" || value === "false")) {
      options.push({ id, value: value === "true" });
    } else {
      return {
        error: { code: "option_unavailable", reason: `Model option "${id}" is unavailable.` },
      };
    }
  }

  return {
    ok: {
      instanceId: provider.instanceId,
      model: model.slug,
      ...(binding.options === null ? {} : { options }),
    },
  };
}
