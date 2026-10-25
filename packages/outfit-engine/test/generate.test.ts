import { describe, expect, it } from 'vitest';
import { generate, type Garment } from '../src';
const g = (id: string, category: Garment['category'], colourFamily = 'beige'): Garment => ({ id, category, colourFamily, pattern: 'solid', season: 'all', formality: 'casual' });
const wardrobe = [g('t1','top'), g('t2','top','white'), g('b1','bottom'), g('b2','bottom','navy'), g('f1','footwear','white'), g('o1','outerwear','olive')];
const base = { garments: wardrobe, prefs: { likedColours: [], dislikedColours: [] }, ctx: { date: '2026-04-16', seed: 1 }, count: 3 };
describe('generate', () => {
  it('fills required slots', () => { const r = generate(base); expect(r.ok).toBe(true); if (r.ok) r.outfits.forEach(o => ['top','bottom','footwear'].forEach(s => expect(o.items.some(i => i.slot === s)).toBe(true))); });
  it('is deterministic per seed', () => expect(generate(base)).toEqual(generate(base)));
  it('respects disliked colours', () => { const r = generate({ ...base, prefs: { likedColours: [], dislikedColours: ['white'] } }); if (r.ok) r.outfits.forEach(o => expect(o.items.some(i => i.garmentId === 't2' || i.garmentId === 'f1')).toBe(false)); });
  it('reports a missing slot', () => expect(generate({ ...base, garments: [g('t1','top')] })).toMatchObject({ ok: false, code: 'MISSING_SLOT' }));
});
