import type { Appearance } from "@t3tools/guild-art/appearance";
import { CLIPS } from "@t3tools/guild-art/poses";

import type { Facing } from "./player";
import type { SceneId } from "./scene";

export interface NpcEntity {
  readonly kind: "npc";
  readonly id: string;
  readonly name: string;
  readonly sceneId: SceneId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly facing: Facing;
  readonly appearance: Appearance;
  readonly clip: keyof typeof CLIPS;
}

export interface GuildPresentation {
  readonly npcs: readonly NpcEntity[];
}

export class NpcClip {
  private frame = 0;
  private time = 0;

  constructor(private readonly clip: keyof typeof CLIPS) {}

  step(dt: number) {
    const { f, loop } = CLIPS[this.clip];
    this.time += dt * 1000;
    while (this.time >= f[this.frame]![1]) {
      this.time -= f[this.frame]![1];
      if (!loop && this.frame === f.length - 1) return;
      this.frame = (this.frame + 1) % f.length;
    }
  }

  pose(still: boolean) {
    return CLIPS[this.clip].f[still ? 0 : this.frame]![0];
  }
}
