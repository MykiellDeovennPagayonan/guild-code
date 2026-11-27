import * as Schema from "effect/Schema";
import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import {
  type EnvironmentId,
  type ProjectId,
  type ServerProvider,
  type ThreadId,
} from "@t3tools/contracts";
import { GuildBindingError, type Attempt } from "@t3tools/contracts/guild";
import { resolveBinding } from "@t3tools/guild-core/binding";
import { isOpenAttempt, type GuildConnection } from "@t3tools/guild-core/presentation";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useAtomCommand } from "../../../state/use-atom-command";
import { guildCommandError, guildCommandId, guildEnvironment } from "../../state/guild";
import type { GuildRosterEntry } from "../../state/presentation";
import { AdventurerIdentity, ProviderBindingIssue } from "../AdventurerIdentity";
import { GuildOverlay, GuildSelect, useGuildAction } from "../GuildOverlay";
import { Portrait } from "../Portrait";

const isGuildBindingError = Schema.is(GuildBindingError);

export function AdventurerDialogue({
  entry,
  environmentId,
  projects,
  providers,
  threads,
  connection,
  onClose,
  onProfile,
  openThread,
}: {
  entry: GuildRosterEntry;
  environmentId: EnvironmentId;
  projects: readonly EnvironmentProject[];
  providers: readonly ServerProvider[];
  threads: ReadonlyMap<ThreadId, EnvironmentThreadShell>;
  connection: GuildConnection;
  onClose: () => void;
  onProfile: () => void;
  openThread: (threadId: ThreadId) => void;
}) {
  const { adventurer, presentation, history } = entry;
  const { binding } = adventurer;
  const profile = useAtomValue(
    guildEnvironment.profile({
      environmentId,
      input: { adventurerId: adventurer.id },
    }),
  );
  const latestConversation = adventurer.latestConversation;
  const currentAttempt = history.find(
    (attempt) => attempt.kind === "conversation" && isOpenAttempt(attempt),
  );
  const threadId = currentAttempt?.threadId ?? latestConversation?.threadId;
  const thread = threadId ? threads.get(threadId) : undefined;
  const profileAdventurer = AsyncResult.getOrElse(profile, () => undefined)?.adventurer;
  const provider = providers.find(({ instanceId }) => instanceId === binding.providerInstanceId);
  const resolution = resolveBinding(
    profileAdventurer?.binding ?? { ...binding, options: null },
    providers,
  );
  const bindingError = "error" in resolution ? resolution.error.reason : null;
  const preview = thread?.source.latestVisibleMessage;
  const [form, setForm] = useState<"orders" | "continue" | null>(null);
  const action = useGuildAction();
  const canEnd = useAtomValue(guildEnvironment.endConversation.permissionAtom(environmentId));
  const canStart = useAtomValue(guildEnvironment.startConversation.permissionAtom(environmentId));
  const canContinue = useAtomValue(
    guildEnvironment.continueConversation.permissionAtom(environmentId),
  );
  const end = useAtomCommand(guildEnvironment.endConversation, { reportFailure: false });
  const start = useAtomCommand(guildEnvironment.startConversation, { reportFailure: false });
  const continueConversation = useAtomCommand(guildEnvironment.continueConversation, {
    reportFailure: false,
  });

  const send = (message: string, projectId: ProjectId | null, workspace: "root" | "worktree") =>
    action.run(async () => {
      if (bindingError) return;
      if (form === "orders" && projectId && !currentAttempt) {
        const result = await start({
          environmentId,
          input: {
            commandId: guildCommandId(),
            adventurerId: adventurer.id,
            projectId,
            message,
            workspace,
          },
        });
        if (result._tag === "Failure") throw guildCommandError(result);
      } else if (form === "continue" && currentAttempt?.status === "active") {
        const result = await continueConversation({
          environmentId,
          input: { commandId: guildCommandId(), attemptId: currentAttempt.id, message },
        });
        if (result._tag === "Failure") throw guildCommandError(result);
      } else return;
      setForm(null);
    });

  const endConversation = (target: Attempt) =>
    action.run(async () => {
      const result = await end({
        environmentId,
        input: { commandId: guildCommandId(), attemptId: target.id },
      });
      if (result._tag === "Failure") throw guildCommandError(result);
      setForm(null);
    });

  const live = connection === "live";
  const messageEnabled =
    form === "orders"
      ? canStart && Boolean(profileAdventurer) && !currentAttempt
      : canContinue && currentAttempt?.status === "active";
  const providerError = isGuildBindingError(action.error)
    ? action.error.reason
    : live
      ? bindingError
      : null;

  let availability: string;
  switch (presentation.state) {
    case "unknown":
      availability = connection === "offline" ? "Offline" : "Status unknown";
      break;
    case "awaiting_approval":
    case "awaiting_input":
    case "awaiting_auth":
      availability = "Needs you";
      break;
    case "working":
    case "waiting_on_other":
      availability = "Working";
      break;
    default:
      availability = currentAttempt
        ? "In a conversation"
        : bindingError
          ? "Model binding unavailable"
          : "Available";
  }
  const statusLine = presentation.state === "available" ? availability : presentation.statusLine;
  const terminal = latestConversation?.terminal;
  const sendError = currentAttempt?.status === "active" ? currentAttempt.statusReason : null;

  return (
    <GuildOverlay title={adventurer.name} onClose={onClose}>
      <div className="mb-4 flex items-center gap-4">
        <Portrait appearance={adventurer.appearance} scale={3} animate />
        <div className="min-w-0">
          <AdventurerIdentity
            classId={adventurer.classId}
            level={adventurer.level}
            family={binding.family.label}
            pin={binding.pinnedModel}
          />
          <p className="mt-1 text-sm">{availability}</p>
        </div>
      </div>
      <div className="mb-4 grid gap-2 rounded-lg border p-3 text-sm wrap-break-word">
        <p className="text-muted-foreground">No quest · conversation</p>
        <p role="status">{statusLine}</p>
        {terminal?.status === "failed" && !currentAttempt && (
          <p role="alert" className="text-destructive">
            {terminal.statusReason ?? "The conversation failed to start."}
          </p>
        )}
        {sendError && (
          <p role="alert" className="text-destructive">
            {sendError}
          </p>
        )}
        {preview?.role === "assistant" && preview.text.trim() ? (
          <p className="line-clamp-3 text-muted-foreground">{preview.text}</p>
        ) : (
          thread && <p className="text-muted-foreground">Open conversation to read the thread.</p>
        )}
        {provider?.driver === "cursor" && (
          <p className="text-muted-foreground">
            This provider reports no approvals or structured questions.
          </p>
        )}
        {presentation.badgeCount > 0 && (
          <details>
            <summary>×{presentation.badgeCount} other assignments</summary>
            <ul className="mt-2 grid gap-2">
              {presentation.activities.map(({ id, statusLine }) => {
                const item = history.find((value) => value.id === id);
                return (
                  item && (
                    <li key={id}>
                      <Button variant="link" size="sm" onClick={() => openThread(item.threadId)}>
                        {threads.get(item.threadId)?.title ?? "Conversation"}
                      </Button>
                      <p>{statusLine}</p>
                    </li>
                  )
                );
              })}
            </ul>
          </details>
        )}
      </div>
      {profile._tag === "Failure" && !profileAdventurer && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {guildCommandError(profile).message}
        </p>
      )}
      {providerError && (
        <ProviderBindingIssue
          environmentId={environmentId}
          instanceId={binding.providerInstanceId}
          family={binding.family.label}
          reason={providerError}
        />
      )}
      {action.error && !isGuildBindingError(action.error) && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {action.error.message}
        </p>
      )}
      {form && (
        <OrdersForm
          key={form}
          continuing={form === "continue"}
          projects={projects}
          lastProjectId={profileAdventurer?.lastProjectId ?? null}
          disabled={!live || Boolean(bindingError) || !messageEnabled || action.pending}
          onSend={send}
          onCancel={() => setForm(null)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!form &&
          (currentAttempt ? (
            <Button
              disabled={
                !live ||
                !canContinue ||
                currentAttempt.status !== "active" ||
                Boolean(bindingError) ||
                action.pending
              }
              onClick={() => setForm("continue")}
            >
              Continue
            </Button>
          ) : (
            <Button
              disabled={
                !live || !canStart || !profileAdventurer || Boolean(bindingError) || action.pending
              }
              onClick={() => setForm("orders")}
            >
              Give orders
            </Button>
          ))}
        {threadId && (thread || currentAttempt) && (
          <Button variant="outline" onClick={() => openThread(threadId)}>
            Open conversation
          </Button>
        )}
        {currentAttempt?.status === "active" && (
          <Button
            variant="outline"
            disabled={!live || !canEnd || action.pending}
            onClick={() => void endConversation(currentAttempt)}
          >
            End conversation
          </Button>
        )}
        <Button variant="ghost" onClick={onProfile}>
          Profile
        </Button>
      </div>
    </GuildOverlay>
  );
}

function OrdersForm({
  continuing,
  projects,
  lastProjectId,
  disabled,
  onSend,
  onCancel,
}: {
  continuing: boolean;
  projects: readonly EnvironmentProject[];
  lastProjectId: ProjectId | null;
  disabled: boolean;
  onSend: (message: string, projectId: ProjectId | null, workspace: "root" | "worktree") => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState<ProjectId | null>(null);
  const projectId =
    selection ??
    (projects.some(({ id }) => id === lastProjectId) ? lastProjectId : (projects[0]?.id ?? null));
  const [workspace, setWorkspace] = useState<"root" | "worktree">("root");
  const canSend =
    !disabled &&
    Boolean(message.trim()) &&
    (continuing || projects.some(({ id }) => id === projectId));
  return (
    <form
      className="mb-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend(message.trim(), projectId, workspace);
      }}
    >
      {!continuing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <GuildSelect
            label="Project"
            value={projectId}
            placeholder="Choose a project"
            choices={projects.map(({ id, title }) => ({ value: id, label: title }))}
            onChange={setSelection}
          />
          <GuildSelect
            label="Workspace"
            value={workspace}
            choices={[
              { value: "root", label: "Project root" },
              { value: "worktree", label: "New worktree" },
            ]}
            onChange={(value) => {
              if (value) setWorkspace(value);
            }}
          />
        </div>
      )}
      {!continuing && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">Add a project in the workspace first.</p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="guild-orders">Message</Label>
        <Textarea
          id="guild-orders"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSend}>
          {continuing ? "Send message" : "Send orders"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
