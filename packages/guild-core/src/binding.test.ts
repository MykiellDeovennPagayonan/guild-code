import {
  DEFAULT_SERVER_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerSettings,
  type ServerProvider,
} from "@t3tools/contracts";
import type { ModelBinding } from "@t3tools/contracts/guild";
import { expect, it } from "vite-plus/test";

import { resolveBinding } from "./binding.ts";
import { deriveFamilies } from "./families.ts";

const checkedAt = "2026-11-27T00:00:00.000Z";
const ready = {
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt,
  skills: [],
  slashCommands: [],
} as const;

// Catalog entries from ClaudeModelCatalog, ProviderRegistry, and AntigravityProvider fixtures.
const sonnet = {
  slug: "claude-sonnet-4-6",
  name: "Claude Sonnet 4.6",
  aliases: ["sonnet-4.6", "claude-sonnet-4.6", "claude-sonnet-4-6-20251117"],
  isCustom: false,
  isDefault: true,
  capabilities: null,
};
const claude: ServerProvider = {
  ...ready,
  instanceId: ProviderInstanceId.make("claude-work"),
  driver: ProviderDriverKind.make("claudeAgent"),
  models: [
    { ...sonnet, slug: "claude-sonnet-4-5", aliases: ["sonnet-4.5"], isDefault: false },
    sonnet,
    { ...sonnet, slug: "sonnet-3-7", aliases: [], isLegacy: true },
  ],
};
const codex: ServerProvider = {
  ...ready,
  instanceId: ProviderInstanceId.make("codex"),
  driver: ProviderDriverKind.make("codex"),
  models: [
    {
      slug: "gpt-6-astra",
      name: "GPT 6 Astra",
      isCustom: false,
      isDefault: true,
      capabilities: null,
    },
    { slug: "gpt-6-luna", name: "GPT 6 Luna", isCustom: false, capabilities: null },
  ],
  usageLimits: {
    checkedAt,
    windows: [
      {
        id: "primary",
        label: "Session",
        kind: "session",
        usedPercent: 100,
        modelIds: ["gpt-6-astra"],
      },
    ],
  },
};
const acp: ServerProvider = {
  ...ready,
  instanceId: ProviderInstanceId.make("antigravity"),
  driver: ProviderDriverKind.make("antigravity"),
  models: [
    {
      slug: "neon",
      name: "Neon",
      aliases: ["antigravity-default"],
      isCustom: false,
      isDefault: true,
      capabilities: {
        optionDescriptors: [
          {
            id: "thought_level",
            label: "Thinking",
            type: "select",
            role: "reasoning",
            options: [
              { id: "medium", label: "Medium" },
              { id: "high", label: "High" },
            ],
          },
        ],
      },
    },
    { slug: "carbon", name: "Carbon", isCustom: false, capabilities: null },
  ],
};

function binding(provider: ServerProvider, family: string): ModelBinding {
  return {
    providerInstanceId: provider.instanceId,
    family: { key: `${provider.driver}:${family}`, label: family },
    pinnedModel: null,
    options: null,
  };
}

it("groups discovered family aliases, selects the in-family default, and allows legacy pins", () => {
  expect(
    deriveFamilies(claude).map(({ key, models }) => [key, models.map(({ slug }) => slug)]),
  ).toEqual([["claudeAgent:sonnet", ["claude-sonnet-4-5", "claude-sonnet-4-6", "sonnet-3-7"]]]);
  const sonnetBinding = binding(claude, "sonnet");
  expect(resolveBinding(sonnetBinding, [claude])).toEqual({
    ok: { instanceId: claude.instanceId, model: "claude-sonnet-4-6" },
  });
  expect(resolveBinding({ ...sonnetBinding, pinnedModel: "sonnet-3-7" }, [claude])).toMatchObject({
    ok: { model: "sonnet-3-7" },
  });
  expect(resolveBinding(sonnetBinding, [{ ...claude, models: [claude.models[2]!] }])).toMatchObject(
    {
      error: { code: "family_unavailable" },
    },
  );
  expect(resolveBinding({ ...sonnetBinding, pinnedModel: "opus" }, [claude])).toMatchObject({
    error: { code: "pinned_model_unavailable" },
  });
  expect(deriveFamilies(codex).map(({ key }) => key)).toEqual([
    "codex:gpt-6-astra",
    "codex:gpt-6-luna",
  ]);
});

it("validates ACP options and returns provider availability reasons", () => {
  const neon = binding(acp, "antigravity-default");
  expect(deriveFamilies(acp).map(({ key }) => key)).toEqual([
    "antigravity:antigravity-default",
    "antigravity:carbon",
  ]);
  expect(resolveBinding({ ...neon, options: { thought_level: "high" } }, [acp])).toEqual({
    ok: {
      instanceId: acp.instanceId,
      model: "neon",
      options: [{ id: "thought_level", value: "high" }],
    },
  });
  expect(resolveBinding({ ...neon, options: { thought_level: "max" } }, [acp])).toMatchObject({
    error: { code: "option_unavailable" },
  });
  expect(
    resolveBinding(neon, [
      { ...acp, auth: { status: "unauthenticated" }, message: "Sign in first." },
    ]),
  ).toEqual({
    error: { code: "provider_unavailable", reason: "Sign in first." },
  });
});

it("keeps the bound model at its usage limit and rejects a missing bound family with a fallback configured", () => {
  const snapshot = {
    providers: [codex],
    settings: {
      ...DEFAULT_SERVER_SETTINGS,
      fallbackModelSelection: { instanceId: codex.instanceId, model: "gpt-6-luna" },
    } satisfies ServerSettings,
  };
  expect(snapshot.settings.fallbackModelSelection.model).toBe("gpt-6-luna");
  const { providers } = snapshot;
  expect(resolveBinding(binding(codex, "gpt-6-astra"), providers)).toEqual({
    ok: { instanceId: codex.instanceId, model: "gpt-6-astra" },
  });
  expect(resolveBinding(binding(codex, "gpt-6-unoffered"), providers)).toMatchObject({
    error: { code: "family_unavailable" },
  });
});
