import { deriveAttemptLiveState, type ThreadShellSummary } from "@t3tools/guild-core/presentation";
import { presentThreadShell } from "@t3tools/client-runtime/state/models";
import { RuntimeRequestId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import { ENVIRONMENT_ID, shellOf, threadWithHistory } from "../../../test/fakeEnvironment";
import { resolveSidebarThreadStatus } from "../../components/Sidebar.logic";

const cases = [
  [
    "approval",
    "awaiting_approval",
    { status: "running", pendingRuntimeRequest: { kind: "command" } },
  ],
  ["input", "awaiting_input", { status: "running", pendingRuntimeRequest: { kind: "user_input" } }],
  ["waiting", "waiting_on_other", { status: "running", blockedOnThreadWait: true }],
  ["preparing", "preparing", { status: "preparing" }],
  ["working", "working", { status: "running" }],
  ["working", "working", { status: "waiting" }],
  ["limited", "rate_limited", { status: "failed", lastErrorClass: "usage_limit" }],
  ["failed", "failed", { status: "failed" }],
  ["ready", "idle", { status: "completed" }],
  ["ready", "stopped", { status: "cancelled" }],
] satisfies ReadonlyArray<readonly [string, string, Partial<ThreadShellSummary>]>;

it.each(cases)("agrees on sidebar %s and world %s for the same shell", (sidebar, guild, fields) => {
  const shell: ThreadShellSummary = { pendingRuntimeRequest: null, ...fields };
  const fixture = shellOf(threadWithHistory("sidebar-agreement", 1));
  const raw = {
    ...fixture,
    status: shell.status,
    lastErrorClass: shell.lastErrorClass ?? null,
    blockedOnThreadWait: shell.blockedOnThreadWait ?? false,
    pendingRuntimeRequest: shell.pendingRuntimeRequest && {
      ...shell.pendingRuntimeRequest,
      id: RuntimeRequestId.make("sidebar-agreement"),
      createdAt: fixture.updatedAt,
    },
  };
  expect(resolveSidebarThreadStatus(presentThreadShell(ENVIRONMENT_ID, raw))).toBe(sidebar);
  expect(deriveAttemptLiveState(raw, "live")).toBe(guild);
});
