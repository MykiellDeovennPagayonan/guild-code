import type { Appearance } from "@t3tools/guild-art/appearance";
import { FH, FW } from "@t3tools/guild-art/frame";
import { CLIPS, POSE_INDEX } from "@t3tools/guild-art/poses";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { getDocumentActivity, subscribeDocumentActivity } from "../../lib/documentActivity";
import { cssForDevicePx, snapToDevicePixels } from "../render/pixelDisplay";
import { requestSheet } from "../render/sheetCache";
import "./portrait.css";

export function Portrait({
  appearance,
  scale = 2,
  animate = false,
}: {
  appearance: Appearance;
  scale?: number;
  animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { focused, visible } = useSyncExternalStore(subscribeDocumentActivity, getDocumentActivity);
  const frames = animate ? CLIPS.idle.f.length : 1;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- draws cached sprite cells into the mounted canvas
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let current = true;
    const snap = () => {
      canvas.parentElement!.style.width = cssForDevicePx(FW * scale);
      canvas.parentElement!.style.height = cssForDevicePx(FH * scale);
      canvas.style.width = cssForDevicePx(FW * frames * scale);
      canvas.style.height = cssForDevicePx(FH * scale);
      snapToDevicePixels(canvas.parentElement!);
    };
    snap();
    window.addEventListener("resize", snap);
    void requestSheet(appearance).ready.then(
      (sheet) => {
        if (!current) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.imageSmoothingEnabled = false;
        for (let i = 0; i < frames; i++) {
          const pose = POSE_INDEX[CLIPS.idle.f[i]![0]]!;
          context.drawImage(sheet.bitmap, pose * FW, 0, FW, FH, i * FW, 0, FW, FH);
        }
      },
      (error: unknown) => {
        console.warn("Could not draw the Guild portrait", error);
      },
    );
    return () => {
      current = false;
      window.removeEventListener("resize", snap);
    };
  }, [appearance, frames, scale]);

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ width: cssForDevicePx(FW * scale), height: cssForDevicePx(FH * scale) }}
      aria-hidden
    >
      <canvas
        ref={ref}
        width={FW * frames}
        height={FH}
        className="block max-w-none [image-rendering:pixelated]"
        data-guild-idle={animate || undefined}
        style={{ animationPlayState: focused && visible ? "running" : "paused" }}
      />
    </div>
  );
}
