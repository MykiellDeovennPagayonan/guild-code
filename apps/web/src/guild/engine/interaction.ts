import type { NpcEntity } from "./npc";
import type { Facing } from "./player";
import type { DoorDef, InteractableDef } from "./scene";

export type InteractionTarget = DoorDef | InteractableDef | NpcEntity;

const PRIORITY = { npc: 0, interactable: 1, door: 2 };
const ZONE_X = 14;
const ZONE_Y = 24;

function distanceInZone(target: InteractionTarget, x: number, y: number) {
  const distance = Math.abs(x - target.x);
  return distance <= ZONE_X && Math.abs(y - target.y) <= ZONE_Y ? distance : Infinity;
}

function precedes(
  candidate: InteractionTarget,
  current: InteractionTarget,
  x: number,
  facing: Facing,
) {
  const a = (candidate.x - x) * facing >= 0;
  const b = (current.x - x) * facing >= 0;
  if (a !== b) return a;
  const priority = PRIORITY[candidate.kind] - PRIORITY[current.kind];
  return priority < 0 || (priority === 0 && candidate.id < current.id);
}

export function selectTarget(
  targets: readonly InteractionTarget[],
  x: number,
  y: number,
  facing: Facing,
) {
  let nearest = Infinity;
  for (const target of targets) nearest = Math.min(nearest, distanceInZone(target, x, y));
  if (nearest === Infinity) return undefined;

  // Measure the tie band from the nearest anchor so its membership is independent of order.
  let selected: InteractionTarget | undefined;
  for (const target of targets) {
    if (distanceInZone(target, x, y) > nearest + 2) continue;
    if (!selected || precedes(target, selected, x, facing)) selected = target;
  }
  return selected;
}

export function pickTarget(targets: readonly InteractionTarget[], x: number, y: number) {
  let selected: InteractionTarget | undefined;
  let nearest = Infinity;
  for (const target of targets) {
    const distance = Math.abs(x - target.x);
    if (distance > target.width / 2 || y < target.y - target.height || y > target.y + 1) continue;
    if (
      distance < nearest ||
      (distance === nearest && selected && precedes(target, selected, x, 1))
    ) {
      selected = target;
      nearest = distance;
    }
  }
  return selected;
}

export function interactionPrompt(target: InteractionTarget) {
  switch (target.kind) {
    case "door":
      return target.locked ? `[E] ${target.locked}` : `[E] Enter ${target.label}`;
    case "interactable":
      return `[E] ${target.label}`;
    case "npc":
      return `[E] Talk to ${target.name}`;
  }
}
