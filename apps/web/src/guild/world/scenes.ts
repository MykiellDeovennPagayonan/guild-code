import type { SceneDef, SceneId } from "../engine/scene";
import { guildHall } from "./scenes/guild_hall";
import { recruitmentHall } from "./scenes/recruitment_hall";

export const SCENES: Readonly<Record<SceneId, SceneDef>> = {
  guild_hall: guildHall,
  recruitment_hall: recruitmentHall,
};

export function findScene(id: string) {
  return Object.values(SCENES).find((scene) => scene.id === id) ?? SCENES.guild_hall;
}
