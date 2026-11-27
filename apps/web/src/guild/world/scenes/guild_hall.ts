import { flatRoom, type SceneDef } from "../../engine/scene";

const floor = 180;

export const guildHall = {
  ...flatRoom(42),
  id: "guild_hall",
  name: "Guild Hall",
  palette: "guild_hall",
  spawn: { x: 78, y: floor },
  doors: [
    {
      kind: "door",
      id: "recruitment",
      x: 454,
      y: floor,
      width: 22,
      height: 29,
      target: "recruitment_hall",
      targetDoor: "guild",
      label: "Recruitment Hall",
      facing: -1,
    },
  ],
  interactables: [
    {
      kind: "interactable",
      id: "quest_board",
      x: 157,
      y: floor,
      width: 32,
      height: 30,
      label: "Quest Board (Coming soon)",
    },
    {
      kind: "interactable",
      id: "bell",
      x: 374,
      y: floor,
      width: 20,
      height: 24,
      label: "Ring Bell",
    },
  ],
  props: [
    { propId: "lantern", x: 22, y: 110 },
    { propId: "hearth", x: 44, y: floor },
    { propId: "bench", x: 71, y: floor },
    { propId: "banner", x: 112, y: 123 },
    { propId: "quest_board", x: 157, y: floor },
    { propId: "lantern", x: 191, y: 132 },
    { propId: "work_table", x: 221, y: floor },
    { propId: "work_table", x: 274, y: floor },
    { propId: "banner", x: 294, y: 123 },
    { propId: "long_table", x: 326, y: floor },
    { propId: "bell", x: 374, y: floor },
    { propId: "lantern", x: 473, y: 150 },
  ],
  npcSlots: [
    { id: "hearth_left", x: 18, kind: "seat", activity: ["available"] },
    { id: "hearth_right", x: 69, kind: "seat", activity: ["available"] },
    { id: "work_left", x: 220, kind: "desk", activity: ["working"] },
    { id: "work_right", x: 273, kind: "desk", activity: ["working"] },
  ],
} satisfies SceneDef;
