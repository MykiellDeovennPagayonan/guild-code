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
  popoverOpen,
  onPopoverOpenChange,
  onNeedsYou,
  onRoster,
  onAdventurer,
}: {
  connection: GuildConnection;
  active: readonly GuildRosterEntry[] | null;
  needsYou: number | null;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
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
      <Popover open={popoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger render={<Button variant="secondary" size="sm" />}>
          Active · {active?.length ?? "Unknown"}
        </PopoverTrigger>
        <PopoverPopup align="start">
          <PopoverTitle>Active adventurers</PopoverTitle>
          {active === null ? (
            <p className="text-sm text-muted-foreground">Active work is unknown.</p>
          ) : active.length === 0 ? (
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
        variant={needsYou ? "default" : "secondary"}
        size="sm"
        disabled={!needsYou}
        onClick={onNeedsYou}
      >
        Needs you · {needsYou ?? "Unknown"}
      </Button>
      <Button variant="secondary" size="sm" onClick={onRoster}>
        Roster
      </Button>
    </div>
  );
}
