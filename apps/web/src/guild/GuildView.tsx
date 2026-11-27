import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import type { GuildAdventurerId, GuildMasterLocation } from "@t3tools/contracts/guild";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import type { GuildConnection } from "@t3tools/guild-core/presentation";
import type { AtomRegistry } from "effect/reactivity";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "../components/ui/button";
import { useProjects } from "../state/entities";
import {
  useEnvironment,
  useEnvironmentProviders,
  usePrimaryEnvironmentId,
} from "../state/environments";
import { useEnvironmentShellStatus } from "../state/shell";
import { buildThreadRouteParams } from "../threadRoutes";
import { GuildEngine, type GuildEngineEvent } from "./engine/GuildEngine";
import {
  guildCommandId,
  guildEnvironment,
  guildMasterAtom,
  guildSnapshotAtom,
  guildThreadShellsAtom,
} from "./state/guild";
import { candidateId, presentGuild, type Candidate } from "./state/presentation";
import { MasterCreator } from "./ui/creator/MasterCreator";
import { AdventurerDialogue } from "./ui/dialogue/AdventurerDialogue";
import { GuildHud } from "./ui/hud/GuildHud";
import {
  HireAdventurer,
  RecruitmentDesk,
  useRefreshCandidates,
} from "./ui/recruitment/Recruitment";
import { AdventurerProfile, GuildRoster } from "./ui/roster/GuildRoster";

const saves = new Map<EnvironmentId, Promise<void>>();

function saveMasterLocation(
  registry: AtomRegistry.AtomRegistry,
  environmentId: EnvironmentId,
  location: GuildMasterLocation,
) {
  const command = guildEnvironment.setMasterLocation;
  if (!registry.get(command.permissionAtom(environmentId))) return;
  // A rapid room change or route exit must not let an older save land after the latest one.
  const write = async () => {
    await runAtomCommand(registry, command, {
      environmentId,
      input: { commandId: guildCommandId(), ...location },
    });
  };
  const pending = saves.get(environmentId);
  const save = pending?.then(write, write) ?? write();
  saves.set(environmentId, save);
  const release = () => {
    if (saves.get(environmentId) === save) saves.delete(environmentId);
  };
  void save.then(release, release);
}

type Overlay =
  | { kind: "master" | "roster" | "recruitment" }
  | { kind: "dialogue" | "profile"; adventurerId: GuildAdventurerId }
  | { kind: "hire"; candidate: Candidate };

interface GuildViewProps {
  readonly onExit: () => void;
  readonly onEvent?: (event: GuildEngineEvent) => void;
  readonly requestedAdventurer?: GuildAdventurerId | undefined;
  readonly editMaster?: boolean | undefined;
  readonly clearRequest?: () => void;
}

export function GuildView(props: GuildViewProps) {
  const environmentId = usePrimaryEnvironmentId();
  return environmentId === null ? (
    <main className="grid flex-1 place-content-center gap-3">
      <p>Connect an environment to open the Guild.</p>
      <Button variant="secondary" onClick={props.onExit}>
        Back to workspace
      </Button>
    </main>
  ) : (
    <GuildWorld key={environmentId} environmentId={environmentId} {...props} />
  );
}

function GuildWorld({
  environmentId,
  onExit,
  onEvent,
  requestedAdventurer,
  editMaster,
  clearRequest,
}: GuildViewProps & {
  environmentId: EnvironmentId;
}) {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const masterAtom = guildMasterAtom(environmentId);
  const snapshot = useAtomValue(guildSnapshotAtom(environmentId));
  const master = snapshot?.master;
  const shells = useAtomValue(guildThreadShellsAtom(environmentId));
  const guildSynchronized = useAtomValue(guildEnvironment.synchronized(environmentId));
  const phase = useEnvironment(environmentId)?.connection.phase;
  const shellStatus = useEnvironmentShellStatus(environmentId);
  const connection: GuildConnection =
    phase === "connected" && shellStatus === "live" && guildSynchronized
      ? "live"
      : phase === "connected" || phase === "connecting" || phase === "reconnecting"
        ? "stale"
        : "offline";
  const providers = useEnvironmentProviders().get(environmentId) ?? [];
  const projects = useProjects().filter(
    (project) => project.environmentId === environmentId && project.archivedAt == null,
  );
  const world = presentGuild(snapshot, shells, environmentId, connection);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [creatorDismissed, setCreatorDismissed] = useState(false);
  const [scene, setScene] = useState(() => master?.location.sceneId ?? "guild_hall");
  const [paused, setPaused] = useState(false);
  const [hudPopoverOpen, setHudPopoverOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<GuildEngine>(null);
  const refresh = useRefreshCandidates(environmentId);

  const routed = requestedAdventurer
    ? ({ kind: "dialogue", adventurerId: requestedAdventurer } as const)
    : editMaster
      ? ({ kind: "master" } as const)
      : null;
  const activeOverlay =
    master === null && !creatorDismissed ? ({ kind: "master" } as const) : (routed ?? overlay);
  const activeEntry =
    activeOverlay && "adventurerId" in activeOverlay
      ? world.roster.find(({ adventurer }) => adventurer.id === activeOverlay.adventurerId)
      : undefined;
  const inputEnabled = Boolean(master) && activeOverlay === null && !hudPopoverOpen;

  const openThread = (threadId: ThreadId) => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams({ environmentId, threadId }),
    });
  };
  const openOverlay = (next: Overlay | null) => {
    if (routed) clearRequest?.();
    if (next) engineRef.current?.setInputEnabled(false);
    if (next === null && master === null) setCreatorDismissed(true);
    setOverlay(next);
  };
  const closeOverlay = () => openOverlay(null);

  const readPaused = useEffectEvent(() => paused);
  const readInputEnabled = useEffectEvent(() => inputEnabled);
  const emit = useEffectEvent((event: GuildEngineEvent) => {
    onEvent?.(event);
    if (event.type === "doorEntered") {
      setScene(event.location.sceneId);
    } else if (event.type === "interact") {
      const { target } = event;
      if (target.kind === "npc") {
        const candidate = world.candidates.find((item) => candidateId(item) === target.id);
        const recruit = world.roster.find(({ adventurer }) => adventurer.id === target.id);
        if (candidate) openOverlay({ kind: "hire", candidate });
        else if (recruit) openOverlay({ kind: "dialogue", adventurerId: recruit.adventurer.id });
      } else if (target.kind === "interactable" && target.id === "reception") {
        openOverlay({ kind: "recruitment" });
        void refresh.refresh();
      } else if (target.kind === "interactable" && target.id === "bell") {
        const threadId = world.needsYou[0];
        if (threadId) openThread(threadId);
      }
    }
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- binds the canvas engine and streams the Guild Master into it
  useEffect(() => {
    const canvas = canvasRef.current;
    const prompt = promptRef.current;
    if (!canvas || !prompt) return;
    const engine = new GuildEngine({
      onEvent: (event) => emit(event),
      onLocation: (location) => saveMasterLocation(registry, environmentId, location),
      onPrompt(text) {
        prompt.textContent = text;
      },
    });
    const unmountPermission = registry.mount(
      guildEnvironment.setMasterLocation.permissionAtom(environmentId),
    );
    const unsubscribe = registry.subscribe(
      masterAtom,
      (currentMaster) => {
        if (currentMaster === undefined) return;
        engine.setMaster(currentMaster);
        if (currentMaster) setScene(engine.location.sceneId);
      },
      { immediate: true },
    );
    engineRef.current = engine;
    engine.setAnimationsPaused(readPaused());
    engine.setInputEnabled(readInputEnabled());
    engine.mount(canvas);
    setScene(engine.location.sceneId);
    return () => {
      unsubscribe();
      engine.unmount();
      unmountPermission();
      engineRef.current = null;
      prompt.textContent = "";
    };
  }, [environmentId, masterAtom, registry]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- synchronizes React overlays and live server state with the mounted world
  useEffect(() => {
    engineRef.current?.setInputEnabled(inputEnabled);
    engineRef.current?.setPresentation(world);
  }, [inputEnabled, world]);

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="max-w-none shrink-0 [image-rendering:pixelated] focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={inputEnabled ? 0 : -1}
        aria-label="Guild world. Use A and D or the arrow keys to move, Space to jump, and E to interact."
      />
      <span ref={promptRef} className="sr-only" aria-live="polite" />
      <div className="absolute inset-x-4 top-10 flex flex-wrap items-start justify-between gap-2">
        <GuildHud
          connection={connection}
          active={world.active}
          needsYou={world.needsYouCount}
          popoverOpen={hudPopoverOpen}
          onPopoverOpenChange={(open) => {
            if (open) engineRef.current?.setInputEnabled(false);
            setHudPopoverOpen(open);
          }}
          onNeedsYou={() => {
            const threadId = world.needsYou[0];
            if (threadId) openThread(threadId);
          }}
          onAdventurer={({ adventurer }) => {
            setHudPopoverOpen(false);
            openOverlay({ kind: "dialogue", adventurerId: adventurer.id });
          }}
          onRoster={() => openOverlay({ kind: "roster" })}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {master === null && (
            <Button size="sm" onClick={() => openOverlay({ kind: "master" })}>
              Create your Guild Master
            </Button>
          )}
          {master && scene === "recruitment_hall" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refresh.refresh()}
              disabled={!refresh.allowed || refresh.pending}
            >
              Refresh candidates
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const next = !paused;
              setPaused(next);
              engineRef.current?.setAnimationsPaused(next);
            }}
          >
            {paused ? "Resume animations" : "Pause animations"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onExit}>
            Back to workspace
          </Button>
          {paused && (
            <span role="status" className="text-xs">
              Animations paused
            </span>
          )}
          {refresh.error && activeOverlay?.kind !== "recruitment" && (
            <span role="alert" className="text-sm text-destructive">
              {refresh.error.message}
            </span>
          )}
        </div>
      </div>
      {activeOverlay?.kind === "master" && master !== undefined && (
        <MasterCreator environmentId={environmentId} master={master} onClose={closeOverlay} />
      )}
      {activeOverlay?.kind === "recruitment" && (
        <RecruitmentDesk
          candidates={world.candidates}
          action={refresh}
          openCandidate={(candidate) => openOverlay({ kind: "hire", candidate })}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.kind === "hire" && (
        <HireAdventurer
          key={candidateId(activeOverlay.candidate)}
          candidate={activeOverlay.candidate}
          environmentId={environmentId}
          providers={providers}
          onBack={() => openOverlay({ kind: "recruitment" })}
          onClose={closeOverlay}
        />
      )}
      {activeOverlay?.kind === "roster" && (
        <GuildRoster
          roster={world.roster}
          onClose={closeOverlay}
          onRecruit={() => openOverlay({ kind: "recruitment" })}
          onEditMaster={() => openOverlay({ kind: "master" })}
          onProfile={({ adventurer }) =>
            openOverlay({ kind: "profile", adventurerId: adventurer.id })
          }
        />
      )}
      {activeEntry && activeOverlay?.kind === "profile" && (
        <AdventurerProfile
          key={activeEntry.adventurer.id}
          entry={activeEntry}
          environmentId={environmentId}
          providers={providers}
          onClose={closeOverlay}
          openThread={openThread}
          onBack={() => openOverlay({ kind: "roster" })}
          onDialogue={() =>
            openOverlay({ kind: "dialogue", adventurerId: activeEntry.adventurer.id })
          }
        />
      )}
      {activeEntry && activeOverlay?.kind === "dialogue" && (
        <AdventurerDialogue
          key={activeEntry.adventurer.id}
          entry={activeEntry}
          environmentId={environmentId}
          projects={projects}
          providers={providers}
          threads={world.threads}
          connection={connection}
          onClose={closeOverlay}
          openThread={openThread}
          onProfile={() =>
            openOverlay({ kind: "profile", adventurerId: activeEntry.adventurer.id })
          }
        />
      )}
      {activeOverlay?.kind === "dialogue" && !activeEntry && snapshot && (
        <div
          className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-background p-3"
          role="status"
        >
          Adventurer unavailable
          <Button size="sm" variant="secondary" onClick={closeOverlay}>
            Dismiss
          </Button>
        </div>
      )}
    </main>
  );
}
