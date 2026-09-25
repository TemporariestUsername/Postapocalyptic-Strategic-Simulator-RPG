/** Asset paths and an image cache shared by the DOM UI and the canvas renderers. */
const BASE = './assets/';

export function img(path: string): string {
  return `${BASE}${path}.webp`;
}

/** Circular face-crop token for a portrait path like "portraits/duelist_1". */
export function token(path: string): string {
  if (path.startsWith('abilities/')) return img(path);
  return `${BASE}tokens/${path}.webp`;
}

const cache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): HTMLImageElement {
  let im = cache.get(src);
  if (!im) {
    im = new Image();
    im.decoding = 'async';
    im.src = src;
    cache.set(src, im);
  }
  return im;
}

export function preloadImages(srcs: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  const total = srcs.length;
  return new Promise((resolve) => {
    if (!total) return resolve();
    for (const s of srcs) {
      const im = loadImage(s);
      const finish = () => {
        done++;
        onProgress?.(done, total);
        if (done === total) resolve();
      };
      if (im.complete && im.naturalWidth) finish();
      else {
        im.addEventListener('load', finish, { once: true });
        im.addEventListener('error', finish, { once: true });
      }
    }
  });
}

export const CORE_IMAGES = [
  img('key/title'), img('key/logo'), img('key/map'), img('ui/metal'), img('ui/paper'), img('ui/leather'), img('ui/concrete'),
];
