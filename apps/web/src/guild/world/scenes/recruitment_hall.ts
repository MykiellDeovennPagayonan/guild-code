import { flatRoom, type SceneDef } from "../../engine/scene";

const floor = 180;

export const recruitmentHall = {
  ...flatRoom(36),
  id: "recruitment_hall",
  name: "Recruitment Hall",
  palette: "recruitment_hall",
  spawn: { x: 69, y: floor },
  doors: [
    {
      kind: "door",
      id: "guild",
      x: 38,
      y: floor,
      width: 22,
      height: 29,
      target: "guild_hall",
      targetDoor: "recruitment",
      label: "Guild Hall",
      facing: 1,
    },
  ],
  interactables: [
    {
      kind: "interactable",
      id: "reception",
      x: 130,
      y: floor,
      width: 40,
      height: 21,
      label: "Recruit at Reception",
    },
  ],
  props: [
    { propId: "lantern", x: 19, y: 150 },
    { propId: "notice_board", x: 89, y: floor - 8 },
    { propId: "reception_desk", x: 130, y: floor },
    { propId: "banner", x: 187, y: 125 },
    { propId: "rug", x: 208, y: floor - 2 },
    { propId: "rug", x: 246, y: floor - 2 },
    { propId: "rug", x: 284, y: floor - 2 },
    { propId: "rug", x: 322, y: floor - 2 },
    { propId: "banner", x: 341, y: 125 },
    { propId: "lantern", x: 386, y: 132 },
  ],
  npcSlots: [
    { id: "candidate_1", x: 208, kind: "stand", activity: ["available"] },
    { id: "candidate_2", x: 246, kind: "stand", activity: ["available"] },
    { id: "candidate_3", x: 284, kind: "stand", activity: ["available"] },
    { id: "candidate_4", x: 322, kind: "stand", activity: ["available"] },
  ],
} satisfies SceneDef;
