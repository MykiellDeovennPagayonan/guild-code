import { flatRoom, ROOM_FLOOR as floor, type SceneDef } from "../../engine/scene";

export const recruitmentHall = {
  ...flatRoom(36),
  id: "recruitment_hall",
  name: "Recruitment Hall",
  architecture: {
    windows: [59, 150, 224, 310, 381],
    beams: [17, 132, 207, 294, 365, 420],
    glows: [
      [35, 163],
      [134, 121],
      [208, 121],
    ],
  },
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
      width: 46,
      height: 21,
      label: "Recruit at Reception",
    },
  ],
  props: [
    { propId: "banner", x: 94, y: 123 },
    { propId: "banner", x: 275, y: 123 },
    { propId: "receptionDesk", x: 130, y: floor },
    { propId: "noticeBoard", x: 188, y: 144 },
    { propId: "rug", x: 227, y: floor + 9 },
    { propId: "rug", x: 303, y: floor + 9 },
    { propId: "lantern", x: 134, y: 126 },
    { propId: "lantern", x: 208, y: 126 },
  ],
  npcSlots: [
    { id: "candidate_1", x: 208, kind: "stand", activity: ["available"] },
    { id: "candidate_2", x: 246, kind: "stand", activity: ["available"] },
    { id: "candidate_3", x: 284, kind: "stand", activity: ["available"] },
    { id: "candidate_4", x: 322, kind: "stand", activity: ["available"] },
  ],
} satisfies SceneDef;
