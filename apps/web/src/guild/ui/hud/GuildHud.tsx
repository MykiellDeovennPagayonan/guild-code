import type { GuildConnection } from "@t3tools/guild-core/presentation";

import { Button } from "../../../components/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "../../../components/ui/popover";
import type { GuildRosterEntry } from "../../state/presentation";

export function GuildHud({
  connection,
  active,
  needsYou,
  onNeedsYou,
  onRoster,
  onAdventurer,
}: {
  connection: GuildConnection;
  active: readonly GuildRosterEntry[];
  needsYou: number;
  onNeedsYou: () => void;
  onRoster: () => void;
  onAdventurer: (entry: GuildRosterEntry) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Guild status">
      <span className="rounded-md border bg-background/90 px-2 py-1 text-xs" role="status">
        Connection ·{" "}
        {connection === "live" ? "Live" : connection === "stale" ? "Reconnecting" : "Offline"}
      </span>
      <Popover>
        <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
          Active · {active.length}
        </PopoverTrigger>
        <PopoverPopup align="start">
          <PopoverTitle>Active adventurers</PopoverTitle>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active work.</p>
          ) : (
            <ul className="grid gap-2">
              {active.map((entry) => (
                <li key={entry.adventurer.id}>
                  <Button variant="outline" size="sm" onClick={() => onAdventurer(entry)}>
                    {entry.adventurer.name}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.presentation.statusLine}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PopoverPopup>
      </Popover>
      <Button
        variant={needsYou > 0 ? "default" : "secondary"}
        size="sm"
        disabled={needsYou === 0}
        onClick={onNeedsYou}
      >
        Needs you · {needsYou}
      </Button>
      <Button variant="secondary" size="sm" onClick={onRoster}>
        Roster
      </Button>
    </div>
  );
}
