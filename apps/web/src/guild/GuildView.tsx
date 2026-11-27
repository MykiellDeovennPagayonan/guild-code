import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { createGuildEnvironmentAtoms } from "@t3tools/client-runtime/state/guild";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import { CommandId, type EnvironmentId } from "@t3tools/contracts";
import type { GuildMasterLocation } from "@t3tools/contracts/guild";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "../components/ui/button";
import { connectionAtomRuntime } from "../connection/runtime";
import { randomUUID } from "../lib/utils";
import { usePrimaryEnvironmentId } from "../state/environments";
import { GuildEngine, type GuildEngineEvent } from "./engine/GuildEngine";

const guildEnvironment = createGuildEnvironmentAtoms(connectionAtomRuntime);
const masterByEnvironment = Atom.family((environmentId: EnvironmentId | null) =>
  Atom.make((get) =>
    environmentId === null
      ? null
      : AsyncResult.getOrElse(get(guildEnvironment.state(environmentId)), () => undefined)?.guild
          .master,
  ),
);

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
      input: { commandId: CommandId.make(randomUUID()), ...location },
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

interface GuildViewProps {
  readonly onExit: () => void;
  readonly onEvent?: (event: GuildEngineEvent) => void;
}

export function GuildView({ onExit, onEvent }: GuildViewProps) {
  const environmentId = usePrimaryEnvironmentId();
  const registry = useContext(RegistryContext);
  const masterAtom = masterByEnvironment(environmentId);
  const master = useAtomValue(masterAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const promptRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<GuildEngine>(null);
  const [paused, setPaused] = useState(false);
  const readPaused = useEffectEvent(() => paused);
  const emit = useEffectEvent((event: GuildEngineEvent) => {
    if (onEvent) onEvent(event);
    else if (event.type === "interact") console.debug("Guild interaction", event.target);
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- binds the canvas engine to the DOM node and observes the Guild Master atom
  useEffect(() => {
    const canvas = canvasRef.current;
    const prompt = promptRef.current;
    if (!canvas || !prompt) return;
    const engine = new GuildEngine({
      onEvent: (event) => emit(event),
      onLocation(location) {
        if (environmentId !== null) saveMasterLocation(registry, environmentId, location);
      },
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
        if (currentMaster !== undefined) engine.setMaster(currentMaster);
      },
      { immediate: true },
    );
    engineRef.current = engine;
    engine.setAnimationsPaused(readPaused());
    engine.mount(canvas);
    return () => {
      unsubscribe();
      engine.unmount();
      unmountPermission();
      engineRef.current = null;
      prompt.textContent = "";
    };
  }, [environmentId, masterAtom, registry]);

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="max-w-none shrink-0 [image-rendering:pixelated] focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        aria-label="Guild world. Use A and D or the arrow keys to move, Space to jump, and E to interact."
      />
      <span ref={promptRef} className="sr-only" aria-live="polite" />
      <div className="absolute inset-x-4 top-10 flex flex-wrap items-center justify-end gap-2">
        {master === null ? <Button size="sm">Create your Guild Master</Button> : null}
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
        {paused ? <span role="status">Animations paused · agents still working</span> : null}
      </div>
    </main>
  );
}
