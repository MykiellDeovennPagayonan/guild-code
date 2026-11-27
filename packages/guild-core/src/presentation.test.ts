import { RunId } from "@t3tools/contracts";
import { GuildAttemptId } from "@t3tools/contracts/guild";
import { describe, expect, it } from "vite-plus/test";

import {
  deriveAttemptLiveState,
  presentAdventurer,
  type AttemptPresentationInput,
  type GuildConnection,
  type ThreadShellSummary,
} from "./presentation.ts";

const at = "2026-11-28T11:18:20.000Z";
const shell = (overrides: Partial<ThreadShellSummary> = {}): ThreadShellSummary => ({
  status: "idle",
  pendingRuntimeRequest: null,
  ...overrides,
});
const input = (
  id: string,
  value: ThreadShellSummary | null,
  updatedAt = at,
): AttemptPresentationInput => ({
  attempt: { id: GuildAttemptId.make(id), status: "active", startedAt: at, statusReason: null },
  shell: value,
  updatedAt,
});

const cases: readonly {
  state: string;
  value: ThreadShellSummary | null;
  clip: string;
  marker: string | null;
  slot: string;
  connection?: GuildConnection;
}[] = [
  {
    state: "working",
    value: shell({ activityRunStatus: "running" }),
    clip: "write",
    marker: null,
    slot: "working",
  },
  {
    state: "working",
    value: shell({ activityRunStatus: "waiting", lastErrorClass: "usage_limit" }),
    clip: "write",
    marker: null,
    slot: "working",
  },
  {
    state: "preparing",
    value: shell({ status: "queued" }),
    clip: "idle",
    marker: null,
    slot: "working",
  },
  {
    state: "preparing",
    value: shell({ activityRunStatus: "preparing" }),
    clip: "idle",
    marker: null,
    slot: "working",
  },
  {
    state: "preparing",
    value: shell({ activityRunStatus: "starting" }),
    clip: "idle",
    marker: null,
    slot: "working",
  },
  {
    state: "waiting_on_other",
    value: shell({ status: "running", blockedOnThreadWait: true }),
    clip: "idle",
    marker: null,
    slot: "working",
  },
  {
    state: "awaiting_approval",
    value: shell({
      pendingRuntimeRequest: { kind: "file-change" },
      status: "failed",
      lastErrorClass: "usage_limit",
    }),
    clip: "idle",
    marker: "approval",
    slot: "approval",
  },
  {
    state: "awaiting_input",
    value: shell({ pendingRuntimeRequest: { kind: "user_input" }, activityRunStatus: "running" }),
    clip: "idle",
    marker: "question",
    slot: "working",
  },
  {
    state: "awaiting_auth",
    value: shell({ pendingRuntimeRequest: { kind: "auth_refresh" }, status: "failed" }),
    clip: "idle",
    marker: "attention",
    slot: "working",
  },
  {
    state: "failed",
    value: shell({ status: "failed", latestRunStopRequested: true }),
    clip: "idle",
    marker: "attention",
    slot: "working",
  },
  {
    state: "rate_limited",
    value: shell({ usageLimitResetAt: at, lastErrorClass: "usage_limit" }),
    clip: "sit",
    marker: "zzz",
    slot: "resting",
  },
  {
    state: "rate_limited",
    value: shell({ limitRecovery: { runId: RunId.make("run"), resetAt: at, autoResume: false } }),
    clip: "sit",
    marker: "zzz",
    slot: "resting",
  },
  {
    state: "disconnected",
    value: shell({ status: "failed", lastErrorClass: "transport_error" }),
    clip: "idle",
    marker: "offline",
    slot: "working",
  },
  { state: "unknown", value: null, clip: "idle", marker: "offline", slot: "available" },
  {
    state: "unknown",
    value: shell({ activityRunStatus: "running" }),
    clip: "idle",
    marker: "offline",
    slot: "working",
    connection: "offline",
  },
  {
    state: "unknown",
    value: shell({ pendingRuntimeRequest: { kind: "command" } }),
    clip: "idle",
    marker: "offline",
    slot: "approval",
    connection: "stale",
  },
  {
    state: "stopping",
    value: shell({ status: "running", latestRunStopRequested: true }),
    clip: "idle",
    marker: null,
    slot: "working",
  },
  {
    state: "idle",
    value: shell({ status: "completed", latestRunStopRequested: true }),
    clip: "sit",
    marker: null,
    slot: "available",
  },
  { state: "idle", value: shell(), clip: "sit", marker: null, slot: "available" },
  {
    state: "stopped",
    value: shell({ status: "cancelled" }),
    clip: "sit",
    marker: null,
    slot: "available",
  },
  {
    state: "stopped",
    value: shell({ status: "interrupted" }),
    clip: "sit",
    marker: null,
    slot: "available",
  },
];

describe("Guild world presentation", () => {
  it.each(cases)(
    "maps $state to $clip at $slot",
    ({ state, value, clip, marker, slot, connection = "live" }) => {
      expect(deriveAttemptLiveState(value, connection)).toBe(state);
      expect(presentAdventurer([input("attempt", value)], connection)).toMatchObject({
        sceneId: "guild_hall",
        state,
        clip,
        marker,
        slotActivity: slot,
      });
    },
  );

  it("orders open assignments by urgency, recency, then ID and counts the rest", () => {
    const approval = shell({ pendingRuntimeRequest: { kind: "command" } });
    const entries = [
      input("idle", shell()),
      input("stopping", shell({ activityRunStatus: "running", latestRunStopRequested: true })),
      input("working", shell({ activityRunStatus: "running" })),
      input("input", shell({ pendingRuntimeRequest: { kind: "user_input" } })),
      input("old-approval", approval, "2025-01-01T00:00:00.000Z"),
      input("new-approval-z", approval),
      input("new-approval-a", approval),
      input("auth", shell({ pendingRuntimeRequest: { kind: "auth_refresh" } })),
      input("failed", shell({ status: "failed" })),
      input("disconnected", shell({ status: "failed", lastErrorClass: "transport_error" })),
      input("wait", shell({ activityRunStatus: "running", blockedOnThreadWait: true })),
      input("preparing", shell({ status: "queued" })),
      input("limited", shell({ lastErrorClass: "usage_limit" })),
      input("unknown", null),
    ];
    const finished = input("completed", approval);
    const presentation = presentAdventurer(
      [...entries, { ...finished, attempt: { ...finished.attempt, status: "completed" } }],
      "live",
    );
    expect(presentation).toMatchObject({
      primaryAttemptId: "new-approval-a",
      badgeCount: entries.length - 1,
    });
    expect(presentation.activities.map(({ id }) => id)).toEqual([
      "new-approval-a",
      "new-approval-z",
      "old-approval",
      "input",
      "auth",
      "failed",
      "disconnected",
      "working",
      "wait",
      "preparing",
      "stopping",
      "limited",
      "idle",
      "unknown",
    ]);
  });

  it("uses a hearth seat when there is no active attempt", () => {
    expect(presentAdventurer([], "live")).toMatchObject({
      clip: "sit",
      marker: null,
      state: "available",
      fidelity: "cosmetic",
    });
  });

  it("uses the known recovery deadline and provider error", () => {
    expect(
      presentAdventurer(
        [input("limited", shell({ lastErrorClass: "usage_limit", usageLimitResetAt: at }))],
        "live",
      ).statusLine,
    ).toContain("11:18 UTC");
    expect(
      presentAdventurer(
        [
          input(
            "lost",
            shell({
              status: "failed",
              lastErrorClass: "transport_error",
              lastError: "Connection closed",
            }),
          ),
        ],
        "live",
      ).statusLine,
    ).toContain("Connection closed");
  });
});
