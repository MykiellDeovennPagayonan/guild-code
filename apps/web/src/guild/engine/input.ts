import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { isEditableFocused } from "../../lib/editableFocus";
import { registerCommands } from "../../shortcuts/dispatcher";

const GAME_KEYS = new Map<string, string>([
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["Space", "jump"],
  ["KeyW", "jump"],
  ["ArrowUp", "jump"],
  ["KeyZ", "jump"],
  ["KeyE", "interact"],
  ["Escape", "escape"],
]);

export class GuildKeys {
  private readonly held = new Set<string>();
  jumpPressed = false;
  interactPressed = false;
  escapePressed = false;

  get left() {
    return this.held.has("ArrowLeft") || this.held.has("KeyA");
  }

  get right() {
    return this.held.has("ArrowRight") || this.held.has("KeyD");
  }

  get jump() {
    return (
      this.held.has("Space") ||
      this.held.has("KeyW") ||
      this.held.has("ArrowUp") ||
      this.held.has("KeyZ")
    );
  }

  get needsFrame() {
    return (
      this.left || this.right || this.jumpPressed || this.interactPressed || this.escapePressed
    );
  }

  keyDown(code: string, repeat: boolean) {
    const key = GAME_KEYS.get(code);
    if (!key) return false;
    if (repeat || this.held.has(code)) return true;
    if (key === "jump" && !this.jump) this.jumpPressed = true;
    if (key === "interact") this.interactPressed = true;
    if (key === "escape") this.escapePressed = true;
    this.held.add(code);
    return true;
  }

  keyUp(code: string) {
    this.held.delete(code);
  }

  consumeEdges() {
    this.jumpPressed = false;
    this.interactPressed = false;
    this.escapePressed = false;
  }

  clear() {
    this.held.clear();
    this.consumeEdges();
  }
}

export class GuildInput {
  readonly keys = new GuildKeys();
  private releaseScope: (() => void) | undefined;
  private observer: MutationObserver | undefined;

  constructor(
    private readonly acceptsInput: () => boolean,
    private readonly onChange: () => void,
  ) {}

  get enabled() {
    return this.releaseScope !== undefined;
  }

  mount() {
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("focusin", this.refresh);
    document.addEventListener("focusout", this.onFocusOut);
    this.observer = new MutationObserver(this.refresh);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "data-command-palette"],
    });
    this.refresh();
  }

  unmount() {
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("focusin", this.refresh);
    document.removeEventListener("focusout", this.onFocusOut);
    this.observer?.disconnect();
    this.observer = undefined;
    this.releaseScope?.();
    this.releaseScope = undefined;
    this.keys.clear();
  }

  readonly refresh = () => {
    const enabled =
      this.acceptsInput() &&
      !isEditableFocused() &&
      !document.querySelector('[role="alertdialog"]') &&
      !isCommandPaletteOpen();
    if (enabled === this.enabled) return;
    if (enabled) {
      this.releaseScope = registerCommands({}, { capture: true, onKeyDown: this.onKeyDown });
    } else {
      this.releaseScope?.();
      this.releaseScope = undefined;
      this.keys.clear();
    }
    this.onChange();
  };

  private readonly onFocusOut = () => {
    // focusout fires before the next activeElement is installed.
    queueMicrotask(() => {
      if (this.observer) this.refresh();
    });
  };

  private readonly onBlur = () => {
    this.keys.clear();
    this.refresh();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.keyUp(event.code);

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) {
      return false;
    }
    if (
      event.code === "Space" &&
      event.target instanceof Element &&
      event.target.closest("button, a[href], [role=button]")
    ) {
      return false;
    }
    this.refresh();
    if (
      !this.enabled ||
      isEditableFocused(event.target) ||
      !this.keys.keyDown(event.code, event.repeat)
    ) {
      return false;
    }
    event.preventDefault();
    this.onChange();
    return true;
  };
}
