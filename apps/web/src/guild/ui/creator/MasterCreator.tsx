import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import type { GuildMaster } from "@t3tools/contracts/guild";
import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import { CATS, type Category } from "@t3tools/guild-art/parts/registry";
import { randomAppearance } from "@t3tools/guild-art/random";
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, ShuffleIcon, UnlockIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useAtomCommand } from "../../../state/use-atom-command";
import { guildCommandError, guildCommandId, guildEnvironment } from "../../state/guild";
import { GuildOverlay, useGuildAction } from "../GuildOverlay";
import { Portrait } from "../Portrait";

export function MasterCreator({
  environmentId,
  master,
  onClose,
}: {
  environmentId: EnvironmentId;
  master: GuildMaster | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(master?.name ?? "");
  const [appearance, setAppearance] = useState(master?.appearance ?? DEFAULT_APPEARANCE);
  const [category, setCategory] = useState<Category>("species");
  const [locks, setLocks] = useState<Partial<Record<Category, boolean>>>({});
  const command = master ? guildEnvironment.updateMaster : guildEnvironment.createMaster;
  const allowed = useAtomValue(command.permissionAtom(environmentId));
  const save = useAtomCommand(command, { reportFailure: false });
  const action = useGuildAction();
  const selected = CATS.find(({ key }) => key === category)!;

  return (
    <GuildOverlay
      title={master ? "Edit Guild Master" : "Create your Guild Master"}
      onClose={onClose}
      wide
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!allowed || !name.trim() || name.trim().length > 24) return;
          void action.run(async () => {
            const result = await save({
              environmentId,
              input: { commandId: guildCommandId(), name: name.trim(), appearance },
            });
            if (result._tag === "Failure") throw guildCommandError(result);
            onClose();
          });
        }}
      >
        <div className="grid items-start gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="grid gap-1.5" aria-label="Appearance categories">
            {CATS.map(({ key, label, list }) => {
              const options = list.filter(({ retired }) => !retired);
              const index = options.findIndex(({ id }) => id === appearance[key]);
              const choose = (offset: number) => {
                setCategory(key);
                const part = options[(index + offset + options.length) % options.length]!;
                setAppearance({ ...appearance, [key]: part.id });
              };
              return (
                <div key={key} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-pressed={Boolean(locks[key])}
                    aria-label={`Lock ${label}`}
                    onClick={() => setLocks({ ...locks, [key]: !locks[key] })}
                  >
                    {locks[key] ? <LockIcon /> : <UnlockIcon />}
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Previous ${label}`}
                    onClick={() => choose(-1)}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant={key === category ? "secondary" : "outline"}
                    size="sm"
                    aria-pressed={key === category}
                    onClick={() => setCategory(key)}
                  >
                    <span className="truncate capitalize">
                      {label} · {options[index]?.name ?? appearance[key]}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Next ${label}`}
                    onClick={() => choose(1)}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3">
            <div className="grid place-items-center rounded-lg border bg-muted/40">
              <Portrait appearance={appearance} scale={4} animate />
            </div>
            <div className="grid grid-cols-3 gap-1.5" aria-label={`${selected.label} options`}>
              {selected.list
                .filter(({ retired }) => !retired)
                .map(({ id, name: partName }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={appearance[category] === id}
                    className="flex min-w-0 flex-col items-center rounded-md border p-1 text-xs hover:bg-accent focus-visible:outline-ring aria-pressed:border-ring aria-pressed:bg-accent"
                    onClick={() => setAppearance({ ...appearance, [category]: id })}
                  >
                    <Portrait appearance={{ ...appearance, [category]: id }} scale={1} />
                    <span className="max-w-full truncate">{partName}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="guild-master-name">Name</Label>
          <Input
            id="guild-master-name"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={24}
            required
          />
        </div>
        {action.error && (
          <p role="alert" className="text-sm text-destructive">
            {action.error.message}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setAppearance(randomAppearance(Math.random, { locks, base: appearance }))
            }
          >
            <ShuffleIcon /> Shuffle
          </Button>
          <Button type="submit" disabled={!allowed || !name.trim() || action.pending}>
            {master ? "Save Guild Master" : "Enter the Guild"}
          </Button>
        </div>
      </form>
    </GuildOverlay>
  );
}
