import type { Category, Garment, GenerateInput, GenerateResult, OutfitSuggestion } from './types';
const NEUTRALS = new Set(['white','cream','beige','grey','black','navy','brown','olive','tan']);
const LEVEL = { sport: 0, casual: 1, smart_casual: 2, formal: 3 } as const;
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seasonOf = (d: string) => { const m = new Date(d).getMonth(); return m < 2 || m === 11 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'; };
const by = (g: Garment[], c: Category) => g.filter(x => x.category === c);
function caption(items: Garment[]) { const lvl = Math.max(...items.map(i => LEVEL[i.formality])); return lvl >= 3 ? 'Sharp, simple and ready for work.' : lvl === 2 ? 'Polished and comfortable.' : 'Clean, relaxed and versatile.'; }
export function generate(input: GenerateInput): GenerateResult {
  const { prefs, ctx, count } = input; const rand = rng(ctx.seed); const season = seasonOf(ctx.date);
  const pool = input.garments.filter(g => !prefs.dislikedColours.includes(g.colourFamily) && (g.season === 'all' || g.season === season));
  for (const slot of ['top', 'bottom', 'footwear'] as Category[]) if (!by(pool, slot).length) return { ok: false, code: 'MISSING_SLOT', slot };
  const cold = ctx.temperatureC !== undefined && ctx.temperatureC < 12, hot = ctx.temperatureC !== undefined && ctx.temperatureC > 24;
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const seen = new Set<string>(); const cands: { items: Garment[]; score: number; why: string[] }[] = [];
  for (let i = 0; i < 300; i++) {
    const items = [pick(by(pool, 'top')), pick(by(pool, 'bottom')), pick(by(pool, 'footwear'))];
    const outer = by(pool, 'outerwear'); if (outer.length && !hot && (cold || rand() < 0.4)) items.push(pick(outer));
    const key = items.map(x => x.id).sort().join(); if (seen.has(key)) continue; seen.add(key);
    const why: string[] = []; let s = 0;
    const accents = items.filter(x => !NEUTRALS.has(x.colourFamily)).length; if (accents <= 1) { s += 40 - accents * 10; why.push('Balanced palette'); }
    if (items.filter(x => x.pattern !== 'solid').length <= 1) s += 10;
    const lv = items.map(x => LEVEL[x.formality]); if (Math.max(...lv) - Math.min(...lv) <= 1) { s += 20; why.push('Consistent formality'); }
    if (items.some(x => prefs.likedColours.includes(x.colourFamily))) { s += 15; why.push('Uses colours you like'); }
    s -= items.filter(x => input.recentGarmentIds?.includes(x.id)).length * 5; s += rand() * 5;
    if (cold && items.some(x => x.category === 'outerwear')) why.push('Suited to cool weather');
    cands.push({ items, score: s, why });
  }
  cands.sort((a, b) => b.score - a.score);
  const out: OutfitSuggestion[] = []; const usedTops = new Set<string>();
  for (const c of cands) { const top = c.items[0].id; if (out.length < count && (!usedTops.has(top) || usedTops.size >= by(pool, 'top').length)) { usedTops.add(top); out.push({ items: c.items.map((g, p) => ({ slot: g.category, garmentId: g.id, position: p })), score: c.score, caption: caption(c.items), explanation: c.why }); } }
  return { ok: true, outfits: out };
}
