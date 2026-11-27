import { DEFAULT_APPEARANCE, type Appearance } from "@t3tools/guild-art/appearance";
import { PALETTES } from "@t3tools/guild-art/palettes";
import type { GuildMaster, GuildMasterLocation } from "@t3tools/contracts/guild";

import { getDocumentActivity, subscribeDocumentActivity } from "../../lib/documentActivity";
import { observeResize } from "../../lib/observeResize";
import { drawChar } from "../render/drawChar";
import {
  canvasContext,
  cssForDevicePx,
  deviceBox,
  snapToDevicePixels,
} from "../render/pixelDisplay";
import { appearanceKey, readSheet, requestSheet } from "../render/sheetCache";
import { findScene, SCENES } from "../world/scenes";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./camera";
import { GuildInput } from "./input";
import { interactionPrompt, pickTarget, selectTarget, type InteractionTarget } from "./interaction";
import { WorldLoop, type FrameScheduler } from "./loop";
import { drawNpcOverhead, NpcClip, type GuildPresentation, type NpcEntity } from "./npc";
import { Particles } from "./particles";
import { Player, TILE } from "./player";
import { Scene, type DoorDef, type SceneDef, type SceneId } from "./scene";
import { drawText, textWidth } from "./text";

const FADE = 0.16;
type WorldMode = "adventure" | "hybrid" | "focus";

export type GuildEngineEvent =
  | { readonly type: "interact"; readonly target: InteractionTarget }
  | { readonly type: "doorEntered"; readonly location: GuildMasterLocation }
  | { readonly type: "escape" };

interface EngineOptions {
  readonly scheduler?: FrameScheduler;
  readonly onEvent?: (event: GuildEngineEvent) => void;
  readonly onLocation?: (location: GuildMasterLocation) => void;
  readonly onPrompt?: (prompt: string) => void;
}

class CharacterSprite {
  readonly key: string;
  private status: "needed" | "pending" | "ready" | "failed" = "needed";

  constructor(
    private readonly appearance: Appearance,
    private readonly invalidate: () => void,
  ) {
    this.key = appearanceKey(appearance);
  }

  read() {
    const sheet = readSheet(this.key);
    if (!sheet && (this.status === "needed" || this.status === "ready")) this.load();
    return sheet;
  }

  private load() {
    this.status = "pending";
    void requestSheet(this.appearance).ready.then(
      () => {
        this.status = "ready";
        this.invalidate();
      },
      (error) => {
        this.status = "failed";
        console.warn("Could not draw Guild character", error);
      },
    );
  }
}

export class GuildEngine {
  private canvas: HTMLCanvasElement | undefined;
  private context: CanvasRenderingContext2D | undefined;
  private viewport: HTMLElement | undefined;
  private readonly buffer = canvasContext(VIEW_WIDTH, VIEW_HEIGHT);
  private readonly rooms = new Map<SceneId, Scene>();
  private scene: Scene | undefined;
  private entry: string | null = null;
  private player = new Player(0, 0);
  private playerSprite: CharacterSprite | undefined;
  private accent = PALETTES[0]!.L;
  private master: GuildMaster | null = null;
  private mode: WorldMode = "adventure";
  private inputEnabled = true;
  private reducedMotion = false;
  private animationsPaused = false;
  private active = false;
  private readonly input = new GuildInput(
    this.acceptsInput.bind(this),
    this.inputChanged.bind(this),
  );
  private readonly particles = new Particles();
  private readonly particleEffects = {
    puff: this.particles.puff.bind(this.particles),
    sparks: (x: number, y: number) => this.particles.sparks(x, y, this.accent),
  };
  private readonly loop: WorldLoop;
  private dispose: (() => void) | undefined;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private pointer: { x: number; y: number } | undefined;
  private targets: InteractionTarget[] = [];
  private npcs: { entity: NpcEntity; sprite: CharacterSprite; clip: NpcClip }[] = [];
  private presentation: GuildPresentation = { npcs: [] };
  private nearby: InteractionTarget | undefined;
  private hovered: InteractionTarget | undefined;
  private promptTarget: InteractionTarget | undefined;
  private prompt = "";
  private pixelPrompt = "";
  private transition: { door: DoorDef; elapsed: number; entered: boolean } | undefined;

  constructor(private readonly options: EngineOptions = {}) {
    this.loop = new WorldLoop(
      this.step.bind(this),
      this.draw,
      () => (this.mode === "hybrid" && !this.worldFocused() ? 20 : 60),
      options.scheduler,
    );
  }

  mount(canvas: HTMLCanvasElement, viewport: HTMLElement = canvas.parentElement!) {
    if (this.canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    this.canvas = canvas;
    this.context = context;
    this.viewport = viewport;
    this.restore(this.master?.location);
    this.setAppearance(this.master?.appearance ?? DEFAULT_APPEARANCE);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      this.reducedMotion = reduce.matches;
      if (this.reducedMotion) this.particles.clear();
      this.followCamera(0, true);
      this.invalidate();
    };
    const stopResize = observeResize(viewport, this.fit);
    let density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const densityChanged = () => {
      density.removeEventListener("change", densityChanged);
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      density.addEventListener("change", densityChanged);
      this.fit();
    };
    density.addEventListener("change", densityChanged);
    window.addEventListener("resize", this.fit);
    reduce.addEventListener("change", syncMotion);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("click", this.onClick);
    const stopActivity = subscribeDocumentActivity(this.syncActivity);
    this.input.mount();
    syncMotion();
    this.fit();
    this.syncActivity();
    this.dispose = () => {
      stopActivity();
      this.input.unmount();
      stopResize();
      density.removeEventListener("change", densityChanged);
      window.removeEventListener("resize", this.fit);
      reduce.removeEventListener("change", syncMotion);
      canvas.removeEventListener("pointermove", this.onPointerMove);
      canvas.removeEventListener("pointerleave", this.onPointerLeave);
      canvas.removeEventListener("click", this.onClick);
      canvas.style.cursor = "";
    };
  }

  unmount() {
    if (!this.canvas) return;
    this.loop.setRunning(false);
    this.dispose?.();
    this.dispose = undefined;
    if (this.transition && !this.transition.entered) this.enterDoor(this.transition.door);
    this.saveLocation();
    this.canvas = undefined;
    this.context = undefined;
    this.viewport = undefined;
    this.active = false;
    this.transition = undefined;
  }

  setMaster(master: GuildMaster | null) {
    const newlyPresent = master !== null && this.master === null;
    this.master = master;
    if (!this.canvas) return;
    this.setAppearance(master?.appearance ?? DEFAULT_APPEARANCE);
    if (newlyPresent) this.restore(master.location);
    this.invalidate();
  }

  setMode(mode: WorldMode) {
    this.mode = mode;
    if (this.canvas) this.syncActivity();
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (this.canvas) this.input.refresh();
  }

  setAnimationsPaused(paused: boolean) {
    this.animationsPaused = paused;
    if (paused) this.particles.clear();
    this.followCamera(0, true);
    this.invalidate();
    this.syncLoop();
  }

  setPresentation(presentation: GuildPresentation) {
    this.presentation = presentation;
    if (!this.scene) return;
    this.loadNpcs(this.scene.def);
    this.updateTarget();
    this.invalidate();
  }

  openScene(id: SceneId, doorId: string | null = null) {
    if (!this.canvas) return;
    this.transition = undefined;
    this.place(SCENES[id], doorId);
    this.saveLocation();
    this.invalidate();
  }

  get location(): GuildMasterLocation {
    return {
      sceneId: this.scene?.def.id ?? "guild_hall",
      doorId: this.entry,
      x: this.player.x,
      facing: this.player.facing,
    };
  }

  private restore(location: GuildMasterLocation | undefined) {
    this.transition = undefined;
    this.place(findScene(location?.sceneId ?? "guild_hall"), location?.doorId ?? null);
  }

  private place(def: SceneDef, doorId: string | null) {
    const door = def.doors.find(({ id }) => id === doorId);
    const scene = this.rooms.get(def.id) ?? new Scene(def);
    this.rooms.set(def.id, scene);
    this.scene = scene;
    this.entry = door?.id ?? null;
    this.player = door
      ? new Player(door.x + TILE * door.facing, door.y, door.facing)
      : new Player(def.spawn.x, def.spawn.y);
    this.followCamera(0, true);
    this.pointer = undefined;
    this.particles.clear();
    this.loadNpcs(def);
    this.updateTarget();
  }

  private setAppearance(appearance: Appearance) {
    if (this.playerSprite?.key === appearanceKey(appearance)) return;
    this.playerSprite = new CharacterSprite(appearance, this.invalidate);
    this.accent = (PALETTES.find(({ id }) => id === appearance.palette) ?? PALETTES[0]!).L;
  }

  private loadNpcs(def: SceneDef) {
    const previous = new Map(this.npcs.map((npc) => [npc.entity.id, npc]));
    this.npcs = this.presentation.npcs
      .filter((entity) => entity.sceneId === def.id)
      .map((entity) => {
        const npc = previous.get(entity.id);
        return {
          entity,
          sprite:
            npc && npc.sprite.key === appearanceKey(entity.appearance)
              ? npc.sprite
              : new CharacterSprite(entity.appearance, this.invalidate),
          clip: npc && npc.entity.clip === entity.clip ? npc.clip : new NpcClip(entity.clip),
        };
      });
    this.targets = [...def.doors, ...def.interactables, ...this.npcs.map(({ entity }) => entity)];
  }

  private saveLocation() {
    if (this.master) this.options.onLocation?.(this.location);
  }

  private enterDoor(door: DoorDef) {
    this.place(SCENES[door.target], door.targetDoor);
  }

  private activate(target: InteractionTarget) {
    if (this.transition || (target.kind === "door" && target.locked)) return;
    if (target.kind === "door") {
      this.transition = { door: target, elapsed: 0, entered: false };
      this.updateTarget();
    }
    this.options.onEvent?.({ type: "interact", target });
    this.syncLoop();
  }

  private worldFocused() {
    return this.mode !== "hybrid" || document.activeElement === this.canvas;
  }

  private acceptsInput() {
    return this.active && this.inputEnabled && this.worldFocused();
  }

  private inputChanged() {
    if (!this.input.enabled) {
      this.player.vx = 0;
      this.pointer = undefined;
    }
    this.updateTarget();
    this.invalidate();
    this.syncLoop();
  }

  private readonly syncActivity = () => {
    const { visible, focused } = getDocumentActivity();
    const active = Boolean(this.canvas) && this.mode !== "focus" && visible && focused;
    const wasActive = this.active;
    const hadInput = this.input.enabled;
    this.active = active;
    this.input.refresh();
    this.syncLoop();
    if (wasActive && !active && !hadInput) this.draw();
  };

  private syncLoop() {
    const moving = !this.player.ground || this.player.vx !== 0 || this.player.clip !== "idle";
    const hasWork = moving || this.transition !== undefined || this.input.keys.needsFrame;
    this.loop.setRunning(this.active && (!this.animationsPaused || hasWork));
  }

  private readonly invalidate = () => {
    if (!this.active || this.animationsPaused) this.draw();
  };

  private followCamera(dt: number, snap: boolean) {
    const scene = this.scene;
    if (scene) scene.camera.follow(this.player, scene.width, scene.height, dt, snap);
  }

  private step(dt: number) {
    const scene = this.scene;
    if (!scene) return;
    const keys = this.input.keys;
    const still = this.reducedMotion || this.animationsPaused;
    if (this.transition) {
      const transition = this.transition;
      transition.elapsed += dt;
      if (!transition.entered && transition.elapsed >= FADE) {
        transition.entered = true;
        this.enterDoor(transition.door);
        this.saveLocation();
        this.options.onEvent?.({ type: "doorEntered", location: this.location });
      }
      if (transition.elapsed >= FADE * 2) this.transition = undefined;
    } else {
      this.player.step(dt, keys, scene, still ? undefined : this.particleEffects);
      this.followCamera(dt, still);
    }
    if (!still) {
      for (const npc of this.npcs) npc.clip.step(dt);
      this.particles.step(dt);
    }
    this.updateTarget();
    if (keys.interactPressed && this.nearby) this.activate(this.nearby);
    if (keys.escapePressed) this.options.onEvent?.({ type: "escape" });
    keys.consumeEdges();
    if (this.animationsPaused) {
      this.syncLoop();
      if (!this.transition && this.player.clip === "idle" && !keys.needsFrame) this.draw();
    }
  }

  private updateTarget() {
    const scene = this.scene;
    if (!scene) return;
    const canPoint = this.input.enabled && !this.transition;
    this.nearby = canPoint
      ? selectTarget(this.targets, this.player.x, this.player.y, this.player.facing)
      : undefined;
    this.hovered =
      canPoint && this.pointer
        ? pickTarget(
            this.targets,
            this.pointer.x + Math.round(scene.camera.x),
            this.pointer.y + Math.round(scene.camera.y),
          )
        : undefined;
    if (this.canvas) {
      const cursor = this.hovered ? "pointer" : "";
      if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
    }
    const target = this.hovered ?? this.nearby;
    if (target === this.promptTarget) return;
    this.promptTarget = target;
    const prompt = target ? interactionPrompt(target) : "";
    if (prompt === this.prompt) return;
    this.prompt = prompt;
    this.pixelPrompt = prompt.toUpperCase();
    this.options.onPrompt?.(prompt);
  }

  private pointerPosition(event: MouseEvent) {
    const canvas = this.canvas!;
    const bounds = canvas.getBoundingClientRect();
    const x =
      (((event.clientX - bounds.left) * canvas.width) / bounds.width - this.offsetX) / this.scale;
    const y =
      (((event.clientY - bounds.top) * canvas.height) / bounds.height - this.offsetY) / this.scale;
    return x >= 0 && x < VIEW_WIDTH && y >= 0 && y < VIEW_HEIGHT ? { x, y } : undefined;
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    this.pointer = this.pointerPosition(event);
    this.updateTarget();
    this.invalidate();
  };

  private readonly onPointerLeave = () => {
    this.pointer = undefined;
    this.updateTarget();
    this.invalidate();
  };

  private readonly onClick = (event: MouseEvent) => {
    if (this.mode === "hybrid") this.canvas?.focus({ preventScroll: true });
    this.input.refresh();
    this.pointer = this.pointerPosition(event);
    this.updateTarget();
    if (this.hovered) this.activate(this.hovered);
    this.invalidate();
  };

  private readonly fit = () => {
    const { canvas, viewport } = this;
    if (!canvas || !viewport) return;
    const { width, height } = viewport.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.scale = Math.max(
      1,
      Math.floor(
        Math.min(((width - 8) * ratio) / VIEW_WIDTH, ((height - 8) * ratio) / VIEW_HEIGHT),
      ),
    );
    const gameWidth = VIEW_WIDTH * this.scale;
    const gameHeight = VIEW_HEIGHT * this.scale;
    const deviceWidth = deviceBox(gameWidth);
    const deviceHeight = deviceBox(gameHeight);
    if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
    canvas.style.width = cssForDevicePx(deviceWidth);
    canvas.style.height = cssForDevicePx(deviceHeight);
    this.offsetX = Math.floor((deviceWidth - gameWidth) / 2);
    this.offsetY = Math.floor((deviceHeight - gameHeight) / 2);
    snapToDevicePixels(canvas);
    this.draw();
  };

  private readonly draw = () => {
    const { context, scene } = this;
    if (!context || !scene) return;
    const buffer = this.buffer;
    const x = Math.round(scene.camera.x);
    const y = Math.round(scene.camera.y);
    const still = this.reducedMotion || this.animationsPaused;
    scene.draw(buffer, x, y, still);
    drawText(buffer, scene.title, 7, 7);
    for (const { entity, sprite, clip } of this.npcs) {
      if (entity.x < x - 48 || entity.x > x + VIEW_WIDTH + 48) continue;
      const sheet = sprite.read();
      if (sheet)
        drawChar(buffer, sheet, clip.pose(still), entity.x - x, entity.y - y, entity.facing);
    }
    const player = this.player;
    const playerSheet = this.playerSprite?.read();
    if (playerSheet && (still || Math.floor(player.blink * 16) % 2 === 0)) {
      drawChar(buffer, playerSheet, player.pose(still), player.x - x, player.y - y, player.facing);
    }
    if (!still) this.particles.draw(buffer, x, y);
    for (const { entity } of this.npcs) {
      if (entity.x < x || entity.x >= x + VIEW_WIDTH) continue;
      drawNpcOverhead(buffer, entity, entity.x - x, entity.y - y);
    }
    if (this.hovered) {
      const { x: anchorX, y: anchorY, width, height } = this.hovered;
      buffer.strokeStyle = "#f5c84b";
      buffer.strokeRect(
        Math.round(anchorX - width / 2) - x - 0.5,
        anchorY - height - y - 0.5,
        width + 1,
        height + 1,
      );
    }
    const target = this.hovered ?? this.nearby;
    if (target) {
      const width = textWidth(this.pixelPrompt);
      const left = Math.max(3, Math.min(VIEW_WIDTH - width - 3, target.x - x - width / 2));
      drawText(
        buffer,
        this.pixelPrompt,
        left,
        Math.max(15, target.y - y - target.height - (target.kind === "npc" ? 27 : 10)),
      );
    }
    if (this.transition) {
      const time = this.transition.elapsed;
      buffer.globalAlpha = Math.max(0, Math.min(1, time < FADE ? time / FADE : 2 - time / FADE));
      buffer.fillStyle = "#0c0812";
      buffer.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      buffer.globalAlpha = 1;
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.drawImage(
      buffer.canvas,
      this.offsetX,
      this.offsetY,
      VIEW_WIDTH * this.scale,
      VIEW_HEIGHT * this.scale,
    );
  };
}
