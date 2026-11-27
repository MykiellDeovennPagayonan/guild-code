import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ServerProvider, ThreadId } from "@t3tools/contracts";
import type { GuildListAttemptsInput } from "@t3tools/contracts/guild";
import { resolveBinding } from "@t3tools/guild-core/binding";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { guildCommandError, guildEnvironment } from "../../state/guild";
import type { GuildRosterEntry } from "../../state/presentation";
import { AdventurerIdentity, ProviderBindingIssue } from "../AdventurerIdentity";
import { GuildOverlay } from "../GuildOverlay";
import { Portrait } from "../Portrait";

export function GuildRoster({
  roster,
  onClose,
  onProfile,
  onEditMaster,
  onRecruit,
}: {
  roster: readonly GuildRosterEntry[];
  onClose: () => void;
  onProfile: (entry: GuildRosterEntry) => void;
  onEditMaster: () => void;
  onRecruit: () => void;
}) {
  return (
    <GuildOverlay title="Roster" onClose={onClose}>
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Meet your first recruits in the Recruitment Hall.
        </p>
      ) : (
        <ul className="grid gap-2">
          {roster.map((entry) => {
            const { adventurer, presentation } = entry;
            return (
              <li
                key={adventurer.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-2"
              >
                <Portrait appearance={adventurer.appearance} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{adventurer.name}</p>
                  <AdventurerIdentity
                    classId={adventurer.classId}
                    level={adventurer.level}
                    family={adventurer.binding.family.label}
                    pin={adventurer.binding.pinnedModel}
                  />
                  <p className="mt-1 text-sm">{presentation.statusLine}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Profile for ${adventurer.name}`}
                  onClick={() => onProfile(entry)}
                >
                  Profile
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onEditMaster}>
          Edit Guild Master
        </Button>
        <Button variant="outline" onClick={onRecruit}>
          View candidates
        </Button>
      </div>
    </GuildOverlay>
  );
}

export function AdventurerProfile({
  entry,
  environmentId,
  providers,
  openThread,
  onClose,
  onBack,
  onDialogue,
}: {
  entry: GuildRosterEntry;
  environmentId: EnvironmentId;
  providers: readonly ServerProvider[];
  openThread: (id: ThreadId) => void;
  onClose: () => void;
  onBack: () => void;
  onDialogue: () => void;
}) {
  const { adventurer, presentation } = entry;
  const { binding } = adventurer;
  const profile = useAtomValue(
    guildEnvironment.profile({ environmentId, input: { adventurerId: adventurer.id } }),
  );
  const fullBinding = AsyncResult.getOrElse(profile, () => undefined)?.adventurer.binding;
  const resolution = resolveBinding(fullBinding ?? { ...binding, options: null }, providers);
  return (
    <GuildOverlay title={adventurer.name} onClose={onClose}>
      <div className="mb-5 flex items-center gap-4">
        <Portrait appearance={adventurer.appearance} scale={3} />
        <div className="min-w-0">
          <AdventurerIdentity
            classId={adventurer.classId}
            level={adventurer.level}
            family={adventurer.binding.family.label}
            pin={adventurer.binding.pinnedModel}
          />
          <p className="mt-1 text-sm">{presentation.statusLine}</p>
        </div>
      </div>
      {presentation.state !== "unknown" && "error" in resolution && (
        <ProviderBindingIssue
          environmentId={environmentId}
          instanceId={binding.providerInstanceId}
          family={binding.family.label}
          reason={resolution.error.reason}
        />
      )}
      <h3 className="mb-2 text-sm font-medium">Attempts</h3>
      <AttemptHistory
        key={adventurer.latestConversation?.attemptId}
        environmentId={environmentId}
        input={{ adventurerId: adventurer.id }}
        openThread={openThread}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onBack}>
          Back to roster
        </Button>
        <Button onClick={onDialogue}>Talk to {adventurer.name}</Button>
      </div>
    </GuildOverlay>
  );
}

function AttemptHistory({
  environmentId,
  input,
  openThread,
}: {
  environmentId: EnvironmentId;
  input: GuildListAttemptsInput;
  openThread: (id: ThreadId) => void;
}) {
  const result = useAtomValue(guildEnvironment.attempts({ environmentId, input }));
  const page = AsyncResult.getOrElse(result, () => undefined);
  const [showMore, setShowMore] = useState(false);
  if (!page && result._tag === "Failure") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {guildCommandError(result).message}
      </p>
    );
  }
  if (!page)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading attempts…
      </p>
    );
  if (page.attempts.length === 0)
    return <p className="text-sm text-muted-foreground">No attempts yet.</p>;

  return (
    <>
      <ul className="grid gap-1">
        {page.attempts.map(({ id, threadId, requestedModel, status, statusReason, startedAt }) => (
          <li
            key={id}
            className="flex flex-wrap items-center justify-between gap-1 rounded-lg border p-2 text-sm"
          >
            <div className="min-w-0">
              <p>
                {requestedModel} · <span className="capitalize">{status}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(startedAt).toLocaleString("en")}
              </p>
              {statusReason && <p className="text-xs text-muted-foreground">{statusReason}</p>}
            </div>
            {status !== "failed" && statusReason !== "thread_deleted" && (
              <Button variant="outline" size="sm" onClick={() => openThread(threadId)}>
                Open attempt thread
              </Button>
            )}
          </li>
        ))}
      </ul>
      {page.nextCursor &&
        (showMore ? (
          <div className="mt-1">
            <AttemptHistory
              environmentId={environmentId}
              input={{ ...input, cursor: page.nextCursor }}
              openThread={openThread}
            />
          </div>
        ) : (
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowMore(true)}>
              More attempts
            </Button>
          </div>
        ))}
    </>
  );
}
