import { DEFAULT_APPEARANCE } from "@t3tools/guild-art/appearance";
import type { GuildMaster } from "@t3tools/contracts/guild";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { SCENES } from "../world/scenes";
import { GuildEngine, type GuildEngineEvent } from "./GuildEngine";
import type { FrameScheduler } from "./loop";

class ManualFrames implements FrameScheduler {
  private readonly queue = new Map<number, FrameRequestCallback>();
  private next = 0;
  private now = 0;
  ran = 0;

  get pending() {
    return this.queue.size;
  }

  request(callback: FrameRequestCallback) {
    const id = ++this.next;
    this.queue.set(id, callback);
    return id;
  }

  cancel(id: number) {
    this.queue.delete(id);
  }

  advance(count: number) {
    for (let i = 0; i < count; i++) {
      this.now += 1000 / 60;
      const callbacks = Array.from(this.queue.values());
      this.queue.clear();
      for (const callback of callbacks) {
        this.ran++;
        callback(this.now);
      }
    }
  }
}

function key(
  target: EventTarget,
  type: "keydown" | "keyup",
  code: string,
  options?: KeyboardEventInit,
) {
  const event = new KeyboardEvent(type, { code, cancelable: true, bubbles: true, ...options });
  target.dispatchEvent(event);
  return event;
}

describe("Guild world in Chromium", () => {
  it("leaves focused text input alone and resumes movement after focus leaves", async () => {
    await using screen = await render(
      <>
        <div>
          <canvas />
        </div>
        <input aria-label="Message" />
      </>,
    );
    using _active = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    using _visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    using scope = new DisposableStack();
    const scheduler = new ManualFrames();
    const onEvent = vi.fn();
    const engine = new GuildEngine({ scheduler, onEvent });
    engine.mount(screen.container.querySelector("canvas")!);
    scope.defer(() => engine.unmount());
    const before = engine.location;
    await userEvent.type(screen.getByRole("textbox"), "ade ");
    const input = screen.container.querySelector("input")!;
    expect(input).toBe(document.activeElement);
    expect(input.value).toBe("ade ");
    expect(key(input, "keydown", "KeyD").defaultPrevented).toBe(false);
    scheduler.advance(20);
    expect(engine.location).toEqual(before);
    expect(onEvent).not.toHaveBeenCalled();

    input.blur();
    await Promise.resolve();
    expect(key(window, "keydown", "KeyD", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(key(window, "keydown", "KeyD").defaultPrevented).toBe(true);
    scheduler.advance(20);
    expect(engine.location.x).toBeGreaterThan(before.x + 10);
    key(window, "keyup", "KeyD");
  });

  it("cancels the pending frame on document blur or hide and clears held keys", async () => {
    await using screen = await render(
      <div>
        <canvas />
      </div>,
    );
    using focused = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    using visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    using scope = new DisposableStack();
    const scheduler = new ManualFrames();
    const engine = new GuildEngine({ scheduler });
    engine.mount(screen.container.querySelector("canvas")!);
    scope.defer(() => engine.unmount());

    key(window, "keydown", "KeyD");
    scheduler.advance(8);
    expect(scheduler.pending).toBe(1);
    const ran = scheduler.ran;
    const location = engine.location;

    focused.mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    expect(scheduler.pending).toBe(0);
    scheduler.advance(8);
    expect(scheduler.ran).toBe(ran);

    focused.mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    expect(scheduler.pending).toBe(1);
    scheduler.advance(8);
    expect(scheduler.ran).toBeGreaterThan(ran);
    expect(engine.location).toEqual(location);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(scheduler.pending).toBe(0);
  });

  it("walks into Recruitment and back through the paired door facing into the Hall", async () => {
    await using screen = await render(
      <div>
        <canvas />
        <span aria-live="polite" />
      </div>,
    );
    using _active = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    using _visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    using scope = new DisposableStack();
    const scheduler = new ManualFrames();
    const onEvent = vi.fn<(event: GuildEngineEvent) => void>();
    const onLocation = vi.fn();
    const live = screen.container.querySelector("span")!;
    const engine = new GuildEngine({
      scheduler,
      onEvent,
      onLocation,
      onPrompt(text) {
        live.textContent = text;
      },
    });
    const master: GuildMaster = {
      name: "Ari",
      appearance: DEFAULT_APPEARANCE,
      createdAt: "2026-11-27T00:00:00.000Z",
      location: { sceneId: "guild_hall", doorId: null, x: 30, facing: 1 },
    };
    engine.setMaster(master);
    engine.mount(screen.container.querySelector("canvas")!);
    scope.defer(() => engine.unmount());

    key(window, "keydown", "KeyD");
    scheduler.advance(341);
    key(window, "keyup", "KeyD");
    scheduler.advance(9);
    expect(live.textContent).toBe("[E] Enter Recruitment Hall");
    expect(onLocation).not.toHaveBeenCalled();

    key(window, "keydown", "KeyE");
    scheduler.advance(22);
    const recruitmentDoor = SCENES.recruitment_hall.doors[0]!;
    const recruitmentLocation = {
      sceneId: "recruitment_hall",
      doorId: recruitmentDoor.id,
      x: recruitmentDoor.x + 12,
      facing: 1,
    };
    expect(engine.location).toEqual(recruitmentLocation);
    expect(onLocation).toHaveBeenNthCalledWith(1, recruitmentLocation);

    key(window, "keydown", "KeyE", { repeat: true });
    scheduler.advance(22);
    expect(live.textContent).toBe("[E] Enter Guild Hall");
    expect(onLocation).toHaveBeenCalledOnce();

    key(window, "keyup", "KeyE");
    key(window, "keydown", "KeyE");
    scheduler.advance(22);
    const hallDoor = SCENES.guild_hall.doors[0]!;
    const hallLocation = {
      sceneId: "guild_hall",
      doorId: hallDoor.id,
      x: hallDoor.x - 12,
      facing: -1,
    };
    expect(engine.location).toEqual(hallLocation);
    expect(onLocation).toHaveBeenNthCalledWith(2, hallLocation);
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      "interact",
      "doorEntered",
      "interact",
      "doorEntered",
    ]);
    engine.unmount();
    expect(onLocation).toHaveBeenNthCalledWith(3, hallLocation);

    engine.setMaster({ ...master, location: { ...hallLocation, x: 180, facing: 1 } });
    engine.mount(screen.container.querySelector("canvas")!);
    expect(engine.location).toEqual(hallLocation);
  });

  it("clicks a door without walking and saves its destination when leaving during the fade", async () => {
    await using screen = await render(
      <div style={{ width: 400, height: 240 }}>
        <canvas />
      </div>,
    );
    using _active = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    using _visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    using scope = new DisposableStack();
    const scheduler = new ManualFrames();
    const onLocation = vi.fn();
    const onEvent = vi.fn();
    const engine = new GuildEngine({ scheduler, onLocation, onEvent });
    const door = SCENES.recruitment_hall.doors[0]!;
    engine.setMaster({
      name: "Ari",
      appearance: DEFAULT_APPEARANCE,
      createdAt: "2026-11-27T00:00:00.000Z",
      location: { sceneId: "recruitment_hall", doorId: null, x: 69, facing: 1 },
    });
    const canvas = screen.container.querySelector("canvas")!;
    engine.mount(canvas);
    scope.defer(() => engine.unmount());
    expect(engine.location.x - door.x).toBeGreaterThan(14);
    const bounds = canvas.getBoundingClientRect();
    const x = bounds.left + door.x * (bounds.width / 384);
    const y = bounds.top + (door.y - 12) * (bounds.height / 216);
    canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }));
    expect(canvas.style.cursor).toBe("pointer");
    canvas.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y }));
    expect(onEvent).toHaveBeenCalledWith({ type: "interact", target: door });
    expect(engine.location.sceneId).toBe("recruitment_hall");
    engine.unmount();
    expect(onLocation).toHaveBeenCalledExactlyOnceWith({
      sceneId: "guild_hall",
      doorId: "recruitment",
      facing: -1,
      x: 442,
    });
    expect(scheduler.pending).toBe(0);
  });
});
