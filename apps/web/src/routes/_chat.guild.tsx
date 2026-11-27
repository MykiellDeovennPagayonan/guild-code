import { createFileRoute } from "@tanstack/react-router";

import { useNavigateToMainApp } from "../components/sidebar/mainAppLocation";
import { GuildView } from "../guild/GuildView";

function GuildPage() {
  const navigateToMainApp = useNavigateToMainApp();
  return <GuildView onExit={navigateToMainApp} />;
}

export const Route = createFileRoute("/_chat/guild")({
  component: GuildPage,
});
