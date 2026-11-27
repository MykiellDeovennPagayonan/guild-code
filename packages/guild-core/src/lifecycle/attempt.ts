import type { Attempt } from "@t3tools/contracts/guild";

type ConversationEvent =
  | { readonly type: "launched" }
  | { readonly type: "ended"; readonly at: string }
  | { readonly type: "launch_failed"; readonly at: string; readonly reason: string }
  | { readonly type: "thread_deleted"; readonly at: string };

export function transitionConversation(attempt: Attempt, event: ConversationEvent): Attempt {
  if (attempt.kind !== "conversation") return attempt;
  switch (event.type) {
    case "launched":
      return attempt.status === "starting" ? { ...attempt, status: "active" } : attempt;
    case "ended":
      return attempt.status === "active"
        ? { ...attempt, status: "completed", endedAt: event.at }
        : attempt;
    case "launch_failed":
      return attempt.status === "starting"
        ? { ...attempt, status: "failed", endedAt: event.at, statusReason: event.reason }
        : attempt;
    case "thread_deleted":
      return attempt.status === "cancelled" && attempt.statusReason === event.type
        ? attempt
        : {
            ...attempt,
            status: "cancelled",
            statusReason: event.type,
            endedAt: attempt.endedAt ?? event.at,
          };
  }
}
