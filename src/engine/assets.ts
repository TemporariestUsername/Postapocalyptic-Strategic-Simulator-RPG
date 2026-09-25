/** Asset paths and an image cache shared by the DOM UI and the canvas renderers. */
const BASE = './assets/';

/** Small icons ship as one JSON bundle of data URIs (see tools/process_assets.py bundle). */
const icons: Record<string, string> = {};

export async function loadIconBundle(): Promise<void> {
  try {
    const r = await fetch(`${BASE}icons.json`);
    Object.assign(icons, await r.json());
  } catch { /* icons will simply be missing */ }
}

export function img(path: string): string {
  return icons[path] ?? `${BASE}${path}.webp`;
}

/** Portrait used for a circular face token (the face crop is applied at draw time, see TOKEN_CROP). */
export function token(path: string): string {
  return img(path);
}

/** Face region of a head-and-shoulders portrait, as fractions of the image (square). */
export const TOKEN_CROP = { x: 0.2, y: 0.04, s: 0.6 };

export function isPortrait(path: string): boolean {
  return !path.startsWith('abilities/');
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

/** Faction banner emblem (factions + 'player'); free holds have none. */
export function sigil(faction: string): string | null {
  return ['cinder', 'choir', 'iron', 'pump', 'rats', 'dust', 'salt', 'player'].includes(faction) ? img(`sigils/${faction}`) : null;
}

export const CORE_IMAGES = [
  img('key/title'), img('key/logo'), img('key/map'), img('ui/metal'), img('ui/paper'), img('ui/leather'), img('ui/concrete'),
];
