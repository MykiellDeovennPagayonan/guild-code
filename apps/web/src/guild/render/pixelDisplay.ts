const deviceRatio = () => window.devicePixelRatio || 1;

export function deviceBox(pixels: number) {
  const ratio = deviceRatio();
  for (let size = pixels; size < pixels + 64; size++) {
    const css = size / ratio;
    if (Math.abs(css - Math.round(css)) < 1e-4) return size;
  }
  for (let size = pixels; size < pixels + 200; size++) {
    const css = (size / ratio) * 64;
    if (Math.abs(css - Math.round(css)) < 1e-3) return size;
  }
  return pixels;
}

export function cssForDevicePx(pixels: number) {
  return `${Math.round((pixels / deviceRatio()) * 64) / 64}px`;
}

export function snapToDevicePixels(element: HTMLElement) {
  const ratio = deviceRatio();
  element.style.position = "relative";
  element.style.left = "0px";
  element.style.top = "0px";
  const bounds = element.getBoundingClientRect();
  const x = bounds.left + window.scrollX;
  const y = bounds.top + window.scrollY;
  // Round up to the browser's layout step so the edge reaches the device pixel.
  const snap = (value: number) => Math.ceil((Math.round(value * ratio) / ratio) * 64 - 1e-6) / 64;
  element.style.left = `${snap(x) - x}px`;
  element.style.top = `${snap(y) - y}px`;
}

export function canvasContext(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  return context;
}
