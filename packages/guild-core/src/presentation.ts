import type { OrchestrationV2ThreadShell } from "@t3tools/contracts";
import type { Attempt } from "@t3tools/contracts/guild";

export type GuildConnection = "live" | "stale" | "offline";

export type ThreadShellSummary = Pick<
  OrchestrationV2ThreadShell,
  | "status"
  | "activityRunStatus"
  | "blockedOnThreadWait"
  | "lastError"
  | "lastErrorClass"
  | "usageLimitResetAt"
  | "limitRecovery"
  | "latestRunStopRequested"
> & {
  readonly hasPendingApproval?: boolean;
  readonly hasPendingInput?: boolean;
  readonly pendingRuntimeRequest: Pick<
    NonNullable<OrchestrationV2ThreadShell["pendingRuntimeRequest"]>,
    "kind"
  > | null;
};

export function deriveAttemptLiveState(
  shell: ThreadShellSummary | null,
  connection: GuildConnection,
) {
  if (connection !== "live" || shell === null) return "unknown";

  const request = shell.pendingRuntimeRequest?.kind;
  if (
    shell.hasPendingApproval ||
    (request !== undefined && request !== "user_input" && request !== "auth_refresh")
  ) {
    return "awaiting_approval";
  }
  if (shell.hasPendingInput || request === "user_input") return "awaiting_input";
  if (request === "auth_refresh") return "awaiting_auth";

  const activity = shell.activityRunStatus === undefined ? shell.status : shell.activityRunStatus;
  const running = activity === "running" || activity === "waiting";
  if (!running && (shell.lastErrorClass === "usage_limit" || shell.limitRecovery))
    return "rate_limited";
  if (shell.status === "failed") {
    return shell.lastErrorClass === "transport_error" ? "disconnected" : "failed";
  }

  const preparing =
    activity === "preparing" || activity === "starting" || shell.status === "queued";
  if (shell.latestRunStopRequested && (running || preparing)) return "stopping";
  if (preparing) return "preparing";
  if (running) return shell.blockedOnThreadWait ? "waiting_on_other" : "working";
  if (shell.status === "interrupted" || shell.status === "cancelled") return "stopped";
  return "idle";
}

export type AttemptLiveState = ReturnType<typeof deriveAttemptLiveState>;
export type AttemptPresentationInput = {
  readonly attempt: Pick<Attempt, "id" | "status" | "statusReason" | "startedAt">;
  readonly shell: (ThreadShellSummary & { readonly title?: string }) | null;
  readonly updatedAt?: string | undefined;
};

const PRIORITY = {
  awaiting_approval: 0,
  awaiting_input: 1,
  awaiting_auth: 2,
  failed: 3,
  disconnected: 4,
  working: 5,
  waiting_on_other: 6,
  preparing: 7,
  stopping: 8,
  rate_limited: 9,
  idle: 10,
  stopped: 10,
  unknown: 11,
} satisfies Record<AttemptLiveState, number>;

const POSES = {
  available: { slotActivity: "available", clip: "sit", marker: null, statusLine: "Available" },
  idle: { slotActivity: "available", clip: "sit", marker: null, statusLine: "Ready for orders" },
  stopped: { slotActivity: "available", clip: "sit", marker: null, statusLine: "Stopped" },
  working: { slotActivity: "working", clip: "write", marker: null, statusLine: "Working" },
  preparing: { slotActivity: "working", clip: "idle", marker: null, statusLine: "Starting…" },
  waiting_on_other: {
    slotActivity: "working",
    clip: "idle",
    marker: null,
    statusLine: "Waiting on another thread",
  },
  awaiting_approval: {
    slotActivity: "approval",
    clip: "idle",
    marker: "approval",
    statusLine: "Needs your approval",
  },
  awaiting_input: {
    slotActivity: "working",
    clip: "idle",
    marker: "question",
    statusLine: "Has a question for you",
  },
  awaiting_auth: {
    slotActivity: "working",
    clip: "idle",
    marker: "attention",
    statusLine: "Provider sign-in needed",
  },
  failed: { slotActivity: "working", clip: "idle", marker: "attention", statusLine: "Failed" },
  rate_limited: {
    slotActivity: "resting",
    clip: "sit",
    marker: "zzz",
    statusLine: "Resting · usage limit reset time unknown",
  },
  stopping: { slotActivity: "working", clip: "idle", marker: null, statusLine: "Stopping…" },
  unknown: {
    slotActivity: "available",
    clip: "idle",
    marker: "offline",
    statusLine: "Unknown · not connected",
  },
  disconnected: {
    slotActivity: "working",
    clip: "idle",
    marker: "offline",
    statusLine: "Provider disconnected",
  },
} as const;

export function describeAttemptState(state: AttemptLiveState, input: AttemptPresentationInput) {
  const { shell, attempt } = input;
  const error = shell?.lastError ?? attempt.statusReason;
  if ((state === "failed" || state === "disconnected") && error) {
    return `${POSES[state].statusLine} · ${error}`;
  }
  const resetAt = shell?.usageLimitResetAt ?? shell?.limitRecovery?.resetAt;
  if (state === "rate_limited" && resetAt) {
    return `Resting · usage limit resets ${resetAt.slice(11, 16)} UTC`;
  }
  if (state === "working" && shell?.title) return `Working · ${shell.title}`;
  return POSES[state].statusLine;
}

export function isOpenAttempt({ status }: Pick<Attempt, "status">) {
  return (
    status === "starting" || status === "active" || status === "paused" || status === "submitted"
  );
}

export function presentAdventurer(
  attempts: readonly AttemptPresentationInput[],
  connection: GuildConnection,
) {
  const activities = attempts
    .filter(({ attempt }) => isOpenAttempt(attempt))
    .map((input): AttemptPresentationInput & { state: AttemptLiveState } => ({
      ...input,
      state:
        connection === "live" && input.shell === null && input.attempt.status === "starting"
          ? "preparing"
          : deriveAttemptLiveState(input.shell, connection),
    }))
    .sort(
      (a, b) =>
        PRIORITY[a.state] - PRIORITY[b.state] ||
        (b.updatedAt ?? b.attempt.startedAt).localeCompare(a.updatedAt ?? a.attempt.startedAt) ||
        a.attempt.id.localeCompare(b.attempt.id),
    );
  const primary = activities[0];
  const state = primary?.state ?? (connection !== "live" ? "unknown" : "available");
  const pose = POSES[state];
  const lastState =
    state === "unknown" && primary ? deriveAttemptLiveState(primary.shell, "live") : state;

  return {
    ...pose,
    sceneId: "guild_hall" as const,
    slotActivity: POSES[lastState].slotActivity,
    state,
    statusLine: primary ? describeAttemptState(primary.state, primary) : pose.statusLine,
    badgeCount: Math.max(0, activities.length - 1),
    primaryAttemptId: primary?.attempt.id ?? null,
    fidelity:
      state === "unknown" || state === "disconnected"
        ? ("unknown" as const)
        : state === "available"
          ? ("cosmetic" as const)
          : ("coarse" as const),
    activities: activities.map((entry) => ({
      id: entry.attempt.id,
      state: entry.state,
      statusLine: describeAttemptState(entry.state, entry),
    })),
  };
}
