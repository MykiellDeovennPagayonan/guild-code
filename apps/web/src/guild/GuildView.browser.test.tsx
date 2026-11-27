import { createMemoryHistory } from "@tanstack/react-router";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  ORCHESTRATION_V2_WS_METHODS,
  ProviderInstanceId,
  RuntimeRequestId,
  WS_METHODS,
  type ThreadId,
} from "@t3tools/contracts";
import {
  GuildAdventurerId,
  GuildAttemptId,
  type Adventurer,
  type Attempt,
  type GuildCreateMasterInput,
  type GuildHireAdventurerInput,
  type GuildMaster,
  type GuildSnapshot,
  type GuildStartConversationInput,
  type GuildStreamItem,
} from "@t3tools/contracts/guild";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import { generateCandidate } from "@t3tools/guild-core/recruitment";
import type * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "../AppRoot";
import "../components/ChatView";
import { useComposerDraftStore } from "../composerDraftStore";
import { openCommandPalette } from "../commandPaletteBus";
import { __setClientSettingsForTests } from "../hooks/useSettings";
import stylesheet from "../index.css?inline";
import { startMainAppLocationTracking } from "../components/sidebar/mainAppLocation";
import { installCommandPaletteCommands } from "../shortcuts/commandPaletteCommands";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { getRouter } from "../router";
import {
  CODEX_PROVIDER,
  ENVIRONMENT_ID,
  PROJECT_ID,
  answerRpc,
  dispatchedCommands,
  emitThreadShell,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
  type FakeThread,
} from "../../test/fakeEnvironment";
import { render } from "../../test/render";
import { GuildEngine } from "./engine/GuildEngine";
import { SCENES } from "./world/scenes";

vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (original) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    original<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

const at = "2026-11-28T12:00:00.000Z";
const clock = DateTime.makeUnsafe(at);
const providerId = ProviderInstanceId.make("codex");
const settings = {
  candidatePool: { seed: "guild-browser", hiredIndices: [] },
  maxConcurrentAttempts: 3,
  xpRulesVersion: 1,
};
const master: GuildMaster = {
  name: "Guild Master",
  appearance: DEFAULT_APPEARANCE,
  createdAt: at,
  location: { sceneId: "guild_hall", doorId: null, x: 78, facing: 1 },
};
const adventurer: Adventurer = {
  id: GuildAdventurerId.make("test-scout"),
  name: "Bram",
  appearance: DEFAULT_APPEARANCE,
  appearanceVersion: 1,
  level: 0,
  xp: 0,
  rank: null,
  classId: "scout",
  binding: {
    providerInstanceId: providerId,
    family: { key: "codex:gpt-5.4", label: "GPT-5.4" },
    pinnedModel: null,
    options: null,
  },
  status: "active",
  defaults: { runtimeMode: "approval-required", interactionMode: "default", maxWriteAttempts: 1 },
  instructions: "",
  specialties: [],
  lastProjectId: PROJECT_ID,
  createdAt: at,
  updatedAt: at,
  hiredAt: at,
};

function attemptFor(threadId: ThreadId): Attempt {
  return {
    id: GuildAttemptId.make(`attempt-${threadId}`),
    adventurerId: adventurer.id,
    kind: "conversation",
    role: null,
    questId: null,
    attemptNumber: null,
    threadId,
    projectId: PROJECT_ID,
    providerInstanceId: providerId,
    classIdAtStart: adventurer.classId,
    familyKeyAtStart: adventurer.binding.family.key,
    requestedModel: "gpt-5.4",
    requestedOptions: null,
    executedModels: [],
    workspace: { strategy: "root", worktreePath: null, branch: null, baseRevision: null },
    usage: { status: "unavailable" },
    status: "active",
    statusReason: null,
    errorClass: null,
    createdAt: at,
    startedAt: at,
    endedAt: null,
  };
}

function fixtures({
  identity = master,
  threads = [],
  attempts = [],
  includeAdventurer = false,
  providers = [{ ...CODEX_PROVIDER, displayName: "Codex" }],
}: {
  identity?: GuildMaster | null;
  threads?: readonly FakeThread[];
  attempts?: readonly Attempt[];
  includeAdventurer?: boolean;
  providers?: readonly unknown[];
} = {}) {
  __setClientSettingsForTests({ ...DEFAULT_CLIENT_SETTINGS, onboardingCompletedAt: at });
  appAtomRegistry.reset();
  const stack = new DisposableStack();
  const style = document.createElement("style");
  style.textContent = stylesheet;
  document.head.append(style);
  stack.defer(() => style.remove());
  stack.defer(() => appAtomRegistry.reset());
  stack.use(
    installFakeEnvironment(threads, {
      acceptCommands: true,
      providers,
    }),
  );
  const first = attempts[0];
  const snapshot: GuildSnapshot = {
    master: identity,
    settings,
    adventurers:
      first || includeAdventurer
        ? [
            {
              ...adventurer,
              latestConversation: first ? { attemptId: first.id, threadId: first.threadId } : null,
            },
          ]
        : [],
    attempts,
  };
  stack.use(
    answerRpc(WS_METHODS.guildSubscribe, () =>
      Stream.concat(
        Stream.make({ _tag: "snapshot", sequence: 1, guild: snapshot } satisfies GuildStreamItem),
        Stream.never,
      ),
    ),
  );
  stack.use(answerRpc(WS_METHODS.guildSetMasterLocation, () => Effect.succeed(identity ?? master)));
  stack.use(
    answerRpc(WS_METHODS.guildGetAdventurerProfile, () =>
      Effect.succeed({ adventurer, changes: [] }),
    ),
  );
  stack.use(
    answerRpc(WS_METHODS.guildListAttempts, () => Effect.succeed({ attempts, nextCursor: null })),
  );
  const created = vi.fn((value: GuildCreateMasterInput) => Effect.succeed({ ...master, ...value }));
  stack.use(answerRpc(WS_METHODS.guildCreateMaster, created));
  const hired = vi.fn((_value: GuildHireAdventurerInput) => Effect.succeed(adventurer));
  stack.use(answerRpc(WS_METHODS.guildHireAdventurer, hired));
  const launched = vi.fn(() => Effect.never);
  stack.use(answerRpc(ORCHESTRATION_V2_WS_METHODS.launchThread, launched));
  const started = vi.fn((_: GuildStartConversationInput) =>
    Effect.succeed(attemptFor(threadWithHistory("guild-launched", 0).id)),
  );
  stack.use(answerRpc(WS_METHODS.guildStartConversation, started));
  return { created, hired, launched, started, [Symbol.dispose]: () => stack.dispose() };
}

function guildRouter(path = "/guild") {
  return getRouter(createMemoryHistory({ initialEntries: [path] }));
}

function guildViewport() {
  const container = document.createElement("div");
  container.id = "root";
  return container;
}

function clickWorld(x: number, y: number) {
  const canvas = page.getByLabelText(/^Guild world/).element();
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Guild canvas was not mounted.");
  const rect = canvas.getBoundingClientRect();
  const scale = Math.floor(Math.min(canvas.width / 384, canvas.height / 216));
  canvas.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      clientX:
        rect.left + (((canvas.width - 384 * scale) / 2 + x * scale) * rect.width) / canvas.width,
      clientY:
        rect.top + (((canvas.height - 216 * scale) / 2 + y * scale) * rect.height) / canvas.height,
    }),
  );
}

async function select(label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

it("saves the creator's latest appearance with locked choices intact and leaves world input off", async () => {
  using fixture = fixtures({ identity: null });
  const router = guildRouter();
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  const dialog = page.getByRole("dialog", { name: "Create your Guild Master" });
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Next species", exact: true }).click();
  const selected = dialog.getByRole("button", { name: /^species ·/ });
  const locked = selected.element().textContent;
  expect(locked).not.toContain("Human");
  await dialog.getByRole("button", { name: "Lock species", exact: true }).click();
  const palette = dialog.getByRole("button", { name: /^palette ·/ });
  const originalPalette = palette.element().textContent;
  using _shuffle = vi.spyOn(Math, "random").mockReturnValue(0.99);
  await dialog.getByRole("button", { name: "Shuffle" }).click();
  expect(palette.element().textContent).not.toBe(originalPalette);
  await expect.element(selected).toHaveTextContent(locked ?? "");

  const name = dialog.getByRole("textbox", { name: "Name" });
  await userEvent.type(name, "Dawn Walker");
  await expect.element(name).toHaveValue("Dawn Walker");
  const move = new KeyboardEvent("keydown", {
    key: "d",
    code: "KeyD",
    cancelable: true,
    bubbles: true,
  });
  selected.element().dispatchEvent(move);
  expect(move.defaultPrevented).toBe(false);
  await dialog.getByRole("button", { name: "Enter the Guild" }).click();
  const { CATS } = await import("@t3tools/guild-art/parts/registry");
  const part = CATS.find(({ key }) => key === "species")!.list.find(({ name }) =>
    locked?.endsWith(name),
  )!;
  await vi.waitFor(() =>
    expect(fixture.created).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Dawn Walker",
        appearance: expect.objectContaining({ species: part.id }),
      }),
    ),
  );
  await expect.element(dialog).not.toBeInTheDocument();
});

it("explains disabled providers and hires the selected candidate using only pool identity", async () => {
  using fixture = fixtures({
    identity: { ...master, location: { ...master.location, sceneId: "recruitment_hall" } },
    providers: [
      { ...CODEX_PROVIDER, displayName: "Codex" },
      {
        ...CODEX_PROVIDER,
        instanceId: "codex-disabled",
        displayName: "Codex Work",
        enabled: false,
        status: "disabled",
        unavailableReason: "Connect your work account first.",
      },
    ],
  });
  const router = guildRouter();
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  await expect.element(page.getByText("Connection · Live")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Refresh candidates" })).toBeVisible();
  const candidate = generateCandidate(settings.candidatePool.seed, 0, []);
  clickWorld(SCENES.recruitment_hall.npcSlots[0]!.x, SCENES.recruitment_hall.spawn.y - 12);
  await expect.element(page.getByRole("dialog", { name: `Hire ${candidate.name}` })).toBeVisible();
  const provider = page.getByRole("combobox", { name: "Provider", exact: true });
  await provider.click();
  const disabled = page.getByRole("option", { name: /Codex Work/ });
  await expect.element(disabled).toHaveAttribute("aria-disabled", "true");
  await expect.element(disabled.getByText("Connect your work account first.")).toBeVisible();
  await page.getByRole("option", { name: "Codex", exact: true }).click();
  await page.getByRole("combobox", { name: "Class", exact: true }).click();
  await page.getByRole("option", { name: /^Scout/ }).click();
  await expect
    .element(page.getByRole("combobox", { name: "Permission policy" }))
    .toHaveTextContent("Supervised");
  await select("Model family", "GPT-5.4");
  await page.getByRole("textbox", { name: "Specialties" }).fill("react, sql");
  await page.getByRole("button", { name: "Hire", exact: true }).click();
  await vi.waitFor(() =>
    expect(fixture.hired).toHaveBeenCalledWith({
      commandId: expect.any(String),
      pool: { seed: settings.candidatePool.seed, index: 0 },
      classId: "scout",
      binding: {
        providerInstanceId: providerId,
        family: { key: "codex:gpt-5.4", label: "GPT-5.4" },
        pinnedModel: null,
        options: null,
      },
      defaults: {
        runtimeMode: "approval-required",
        interactionMode: "default",
        maxWriteAttempts: 1,
      },
      specialties: ["react", "sql"],
      instructions: expect.stringContaining("Explore"),
    }),
  );
});

it("draws working, approval, question and disconnected NPC states and routes the HUD to the right attempt", async () => {
  const thread = threadWithHistory("guild-working", 1);
  const running = {
    ...thread,
    shell: { status: "running" as const, activityRunStatus: "running" as const },
  };
  const other = threadWithHistory("regular-thread", 1);
  using _fixture = fixtures({ threads: [other, running], attempts: [attemptFor(thread.id)] });
  using present = vi.spyOn(GuildEngine.prototype, "setPresentation");
  const router = guildRouter();
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  const npc = () => present.mock.lastCall?.[0].npcs.find(({ id }) => id === adventurer.id);
  await expect.element(page.getByRole("button", { name: "Active · 1" })).toBeVisible();
  expect(npc()).toMatchObject({
    clip: "write",
    x: SCENES.guild_hall.npcSlots.find(({ kind }) => kind === "desk")?.x,
  });
  const pending = (kind: "command" | "user_input") => ({
    id: RuntimeRequestId.make("runtime-request"),
    kind,
    createdAt: clock,
  });
  await emitThreadShell({
    ...running,
    shell: { ...running.shell, pendingRuntimeRequest: pending("command") },
  });
  await expect.element(page.getByRole("button", { name: "Needs you · 1" })).toBeEnabled();
  expect(npc()).toMatchObject({ clip: "idle", marker: "approval" });
  await emitThreadShell({
    ...running,
    shell: { ...running.shell, pendingRuntimeRequest: pending("user_input") },
  });
  await vi.waitFor(() => expect(npc()).toMatchObject({ clip: "idle", marker: "question" }));
  await emitThreadShell({
    ...running,
    shell: { status: "failed", activityRunStatus: null, lastErrorClass: "transport_error" },
  });
  await vi.waitFor(() => expect(npc()).toMatchObject({ clip: "idle", marker: "offline" }));
  await expect.element(page.getByRole("button", { name: "Needs you · 0" })).toBeDisabled();
  await emitThreadShell({
    ...running,
    shell: { ...running.shell, pendingRuntimeRequest: pending("command") },
  });
  await page.getByRole("button", { name: "Needs you · 1" }).click();
  await vi.waitFor(() =>
    expect(router.state.location.pathname).toBe(`/${ENVIRONMENT_ID}/${thread.id}`),
  );
});

it("keeps a thread's running attempt and composer draft when toggling Guild", async () => {
  const thread = threadWithHistory("guild-toggle", 1);
  const running = {
    ...thread,
    shell: { status: "running" as const, activityRunStatus: "running" as const },
  };
  using fixture = fixtures({ threads: [running], attempts: [attemptFor(thread.id)] });
  const path = `/${ENVIRONMENT_ID}/${thread.id}`;
  const router = guildRouter(path);
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  using commands = new DisposableStack();
  commands.defer(startMainAppLocationTracking(router));
  commands.defer(installCommandPaletteCommands(router));
  const ref = scopeThreadRef(ENVIRONMENT_ID, thread.id);
  const editor = page.getByTestId("composer-editor");
  useComposerDraftStore.getState().setPrompt(ref, "Keep this draft with Bram");
  await expect.element(editor).toHaveTextContent("Keep this draft with Bram");
  const toggle = () =>
    userEvent.keyboard(
      navigator.platform.includes("Mac")
        ? "{Meta>}{Alt>}g{/Alt}{/Meta}"
        : "{Control>}{Alt>}g{/Alt}{/Control}",
    );
  await toggle();
  await expect.element(page.getByRole("button", { name: "Active · 1" })).toBeVisible();
  await toggle();
  await vi.waitFor(() => expect(router.state.location.pathname).toBe(path));
  await expect.element(editor).toHaveTextContent("Keep this draft with Bram");
  openCommandPalette({ query: "Bram" });
  await page.getByRole("option", { name: /Talk to Bram/ }).click();
  const dialogue = page.getByRole("dialog", { name: adventurer.name });
  await dialogue.getByRole("button", { name: "Open conversation" }).click();
  await vi.waitFor(() => expect(router.state.location.pathname).toBe(path));
  await expect.element(editor).toHaveTextContent("Keep this draft with Bram");

  expect(fixture.launched).not.toHaveBeenCalled();
  expect(fixture.started).not.toHaveBeenCalled();
  expect(dispatchedCommands().map(({ type }) => type)).not.toContain("message.dispatch");
});

it("shows the unavailable family and its provider settings link without launching work", async () => {
  const thread = threadWithHistory("guild-unavailable", 1);
  using fixture = fixtures({
    threads: [thread],
    attempts: [attemptFor(thread.id)],
    providers: [
      { ...CODEX_PROVIDER, models: CODEX_PROVIDER.models.filter(({ slug }) => slug !== "gpt-5.4") },
    ],
  });
  const router = guildRouter(`/guild?adventurerId=${adventurer.id}`);
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  const dialog = page.getByRole("dialog", { name: adventurer.name });
  await expect
    .element(dialog.getByText("GPT-5.4 · The provider offers no model in this family."))
    .toBeVisible();
  await expect.element(dialog.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect
    .element(dialog.getByRole("link", { name: "Open provider settings" }))
    .toHaveAttribute(
      "href",
      `/settings/providers?environmentId=${ENVIRONMENT_ID}&instanceId=${providerId}`,
    );
  await userEvent.keyboard("{Escape}");
  await expect.element(dialog).not.toBeInTheDocument();
  expect(fixture.started).not.toHaveBeenCalled();
  expect(dispatchedCommands().map(({ type }) => type)).not.toContain("message.dispatch");
});

it("gives orders in the last project with an explicitly chosen worktree", async () => {
  using fixture = fixtures({ includeAdventurer: true });
  const router = guildRouter(`/guild?adventurerId=${adventurer.id}`);
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  const send = page.getByRole("button", { name: "Give orders", exact: true });
  await send.click();
  const workspace = page.getByRole("combobox", { name: "Workspace", exact: true });
  const move = new KeyboardEvent("keydown", {
    key: "d",
    code: "KeyD",
    bubbles: true,
    cancelable: true,
  });
  workspace.element().dispatchEvent(move);
  expect(move.defaultPrevented).toBe(false);
  await expect
    .element(page.getByRole("combobox", { name: "Project", exact: true }))
    .toHaveTextContent("render");
  await expect
    .element(page.getByRole("combobox", { name: "Workspace", exact: true }))
    .toHaveTextContent("Project root");
  await select("Workspace", "New worktree");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Trace the login flow.");
  await page.getByRole("button", { name: "Send orders" }).click();
  await vi.waitFor(() =>
    expect(fixture.started).toHaveBeenCalledWith({
      commandId: expect.any(String),
      adventurerId: adventurer.id,
      projectId: PROJECT_ID,
      message: "Trace the login flow.",
      workspace: "worktree",
    }),
  );
});

it("continues the recorded attempt without sending a new model selection", async () => {
  const thread = threadWithHistory("guild-continue", 1);
  using fixture = fixtures({ threads: [thread], attempts: [attemptFor(thread.id)] });
  const router = guildRouter(`/guild?adventurerId=${adventurer.id}`);
  // AppRoot brings its own router.
  await using _app = await render(<AppRoot router={router} />, {
    router: false,
    container: guildViewport(),
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Check the login test.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await vi.waitFor(() => {
    const messages = dispatchedCommands().filter(({ type }) => type === "message.dispatch");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ threadId: thread.id, text: "Check the login test." });
    expect(messages[0]).not.toHaveProperty("modelSelection");
  });
  expect(fixture.launched).not.toHaveBeenCalled();
  expect(fixture.started).not.toHaveBeenCalled();
});
