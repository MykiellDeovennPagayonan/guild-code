import * as Schema from "effect/Schema";
import { useAtomValue } from "@effect/atom-react";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import {
  AuthOrchestrationOperateScope,
  MessageId,
  type EnvironmentId,
  type ProjectId,
  type ServerProvider,
  type ThreadId,
} from "@t3tools/contracts";
import { GuildBindingError, type Attempt } from "@t3tools/contracts/guild";
import { resolveBinding } from "@t3tools/guild-core/binding";
import { familyIncludesModel } from "@t3tools/guild-core/families";
import { isOpenAttempt, type GuildConnection } from "@t3tools/guild-core/presentation";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { randomUUID } from "../../../lib/utils";
import { useEnvironmentScope } from "../../../state/session";
import { threadEnvironment } from "../../../state/threads";
import { useAtomCommand } from "../../../state/use-atom-command";
import { useOrchestrationCommand } from "../../../state/use-orchestration-command";
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
  const latestPage = useAtomValue(
    guildEnvironment.attempts({
      environmentId,
      input: { adventurerId: adventurer.id },
    }),
  );
  const latest = latestConversation
    ? (history.find(({ id }) => id === latestConversation.attemptId) ??
      AsyncResult.getOrElse(latestPage, () => undefined)?.attempts.find(
        ({ id }) => id === latestConversation.attemptId,
      ))
    : undefined;
  const currentAttempt = history.find(
    (attempt) => attempt.kind === "conversation" && isOpenAttempt(attempt),
  );
  const attempt = currentAttempt ?? latest;
  const thread = attempt ? threads.get(attempt.threadId) : undefined;
  const profileAdventurer = AsyncResult.getOrElse(profile, () => undefined)?.adventurer;
  const provider = providers.find(({ instanceId }) => instanceId === binding.providerInstanceId);
  const resolution = resolveBinding(
    profileAdventurer?.binding ?? { ...binding, options: null },
    providers,
  );
  const bindingError = "error" in resolution ? resolution.error.reason : null;
  const preview = thread?.source.latestVisibleMessage;
  const available =
    presentation.state === "available" ||
    presentation.state === "idle" ||
    presentation.state === "stopped";
  const [form, setForm] = useState<"orders" | "continue" | null>(null);
  const action = useGuildAction();
  const canEnd = useAtomValue(guildEnvironment.endConversation.permissionAtom(environmentId));
  const canStart = useAtomValue(guildEnvironment.startConversation.permissionAtom(environmentId));
  const canContinue = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const end = useAtomCommand(guildEnvironment.endConversation, { reportFailure: false });
  const start = useAtomCommand(guildEnvironment.startConversation, { reportFailure: false });
  const continueTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
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
      } else if (form === "continue" && currentAttempt && thread && profileAdventurer) {
        const current = resolveBinding(profileAdventurer.binding, providers);
        if ("error" in current) throw new GuildBindingError(current.error);
        const sameBinding =
          thread.modelSelection.instanceId === binding.providerInstanceId &&
          (binding.pinnedModel
            ? binding.pinnedModel === thread.modelSelection.model
            : familyIncludesModel(binding.family.key, thread.modelSelection.model, provider));
        if (!sameBinding) {
          throw new Error(
            "The conversation is using a different model binding. Open the conversation to check its model.",
          );
        }
        const result = await continueTurn({
          environmentId,
          input: {
            threadId: currentAttempt.threadId,
            message: {
              messageId: MessageId.make(randomUUID()),
              role: "user",
              text: message,
              attachments: [],
            },
            runtimeMode: thread.runtimeMode,
            interactionMode: thread.interactionMode,
            dispatchMode: "queue",
          },
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
      : canContinue && Boolean(currentAttempt && thread && profileAdventurer);
  const providerError = isGuildBindingError(action.error)
    ? action.error.reason
    : live
      ? bindingError
      : null;

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
          <p className="mt-1 text-sm">
            {live ? (available && !bindingError ? "Available" : "Unavailable") : "Offline"}
          </p>
        </div>
      </div>
      <div className="mb-4 grid gap-2 rounded-lg border p-3 text-sm wrap-break-word">
        <p className="text-muted-foreground">No quest · conversation</p>
        <p role="status">{presentation.statusLine}</p>
        {latest?.status === "failed" && !currentAttempt && presentation.state !== "failed" && (
          <p className="text-destructive">
            {latest.statusReason ?? "The conversation failed to start."}
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
                !thread ||
                !profileAdventurer ||
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
        {attempt && (thread || attempt.status === "starting" || attempt.status === "active") && (
          <Button variant="outline" onClick={() => openThread(attempt.threadId)}>
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
