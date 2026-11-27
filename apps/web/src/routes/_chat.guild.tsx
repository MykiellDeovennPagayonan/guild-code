import { createFileRoute } from "@tanstack/react-router";
import { GuildAdventurerId } from "@t3tools/contracts/guild";

import { useNavigateToMainApp } from "../components/sidebar/mainAppLocation";
import { GuildView } from "../guild/GuildView";

function GuildPage() {
  const navigateToMainApp = useNavigateToMainApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <GuildView
      onExit={navigateToMainApp}
      requestedAdventurer={search.adventurerId}
      editMaster={search.editMaster}
      clearRequest={() => void navigate({ search: {}, replace: true })}
    />
  );
}

export const Route = createFileRoute("/_chat/guild")({
  component: GuildPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    ...(typeof raw.adventurerId === "string" && raw.adventurerId.trim()
      ? { adventurerId: GuildAdventurerId.make(raw.adventurerId) }
      : {}),
    ...(raw.editMaster === true ? { editMaster: true } : {}),
  }),
});
