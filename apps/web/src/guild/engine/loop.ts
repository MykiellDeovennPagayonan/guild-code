export const STEP = 1 / 120;

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

const browserFrames: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (id) => window.cancelAnimationFrame(id),
};

export class WorldLoop {
  private frameId: number | undefined;
  private running = false;
  private lastTime: number | undefined;
  private lastRender = -Infinity;
  private accumulated = 0;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
    private readonly fps: () => number,
    private readonly scheduler = browserFrames,
  ) {}

  setRunning(running: boolean) {
    if (this.running === running) return;
    this.running = running;
    if (running) {
      this.frameId = this.scheduler.request(this.frame);
    } else {
      if (this.frameId !== undefined) this.scheduler.cancel(this.frameId);
      this.frameId = undefined;
      this.lastTime = undefined;
      this.lastRender = -Infinity;
      this.accumulated = 0;
    }
  }

  private readonly frame: FrameRequestCallback = (now) => {
    this.frameId = undefined;
    if (!this.running) return;
    this.accumulated += Math.min(0.1, (now - (this.lastTime ?? now)) / 1000);
    this.lastTime = now;
    while (this.running && this.accumulated >= STEP) {
      this.accumulated -= STEP;
      this.step(STEP);
    }
    if (!this.running) return;
    // Frame timestamps can round a refresh interval down by a fraction of a millisecond.
    if (now - this.lastRender >= 1000 / this.fps() - 0.15) {
      this.lastRender = now;
      this.render();
    }
    if (this.running) this.frameId = this.scheduler.request(this.frame);
  };
}
