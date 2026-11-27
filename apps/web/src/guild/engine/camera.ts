import type { Player } from "./player";

export const VIEW_WIDTH = 384;
export const VIEW_HEIGHT = 216;

export class Camera {
  x = 0;
  y = 0;

  follow(player: Player, width: number, height: number, dt: number, snap: boolean) {
    const x = Math.max(
      0,
      Math.min(width - VIEW_WIDTH, player.x + player.facing * 16 - VIEW_WIDTH / 2),
    );
    const y = Math.max(0, Math.min(height - VIEW_HEIGHT, player.y - 112));
    this.x += (x - this.x) * (snap ? 1 : Math.min(1, dt * 7));
    this.y += (y - this.y) * (snap ? 1 : Math.min(1, dt * 6));
  }
}
