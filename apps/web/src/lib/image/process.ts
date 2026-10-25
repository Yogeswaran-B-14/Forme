import imageCompression from 'browser-image-compression';

const FAMILIES: Record<string, [number, number, number]> = {
  white: [245, 245, 245], cream: [244, 237, 227], beige: [215, 198, 170], tan: [190, 150, 100], brown: [110, 75, 50], black: [25, 25, 25], grey: [130, 130, 130],
  navy: [25, 35, 75], blue: [70, 110, 180], olive: [85, 95, 55], green: [60, 130, 80], red: [180, 40, 40], pink: [230, 150, 170], yellow: [230, 200, 70], orange: [220, 120, 40], purple: [110, 70, 150],
};
export const COLOUR_FAMILIES = Object.keys(FAMILIES);

export const compress = (file: File): Promise<Blob> =>
  imageCompression(file, { maxWidthOrHeight: 1600, maxSizeMB: 0.8, useWebWorker: true, fileType: 'image/jpeg' });

/** Removes the background in the browser. Returns null on failure or after 20s so the caller can fall back to the original. */
export async function cutout(blob: Blob): Promise<Blob | null> {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    return await Promise.race([removeBackground(blob), new Promise<null>(resolve => setTimeout(() => resolve(null), 20000))]);
  } catch { return null; }
}

export async function dominantColour(blob: Blob): Promise<{ hex: string; family: string }> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d')!; ctx.drawImage(bmp, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data; let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  if (!n) return { hex: '#888888', family: 'grey' };
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  let best = 'grey', bestD = Infinity;
  for (const [name, [fr, fg, fb]] of Object.entries(FAMILIES)) { const dist = (r - fr) ** 2 + (g - fg) ** 2 + (b - fb) ** 2; if (dist < bestD) { bestD = dist; best = name; } }
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return { hex, family: best };
}
