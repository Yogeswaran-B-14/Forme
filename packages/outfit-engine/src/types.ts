export type Category = 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory';
export type Formality = 'casual' | 'smart_casual' | 'formal' | 'sport';
export interface Garment { id: string; category: Category; colourFamily: string; pattern: 'solid'|'stripe'|'check'|'print'|'textured'|'other'; season: 'spring'|'summer'|'autumn'|'winter'|'all'; formality: Formality; }
export interface Preferences { likedColours: string[]; dislikedColours: string[]; }
export interface Context { date: string; temperatureC?: number; seed: number; }
export interface OutfitSuggestion { items: { slot: Category; garmentId: string; position: number }[]; score: number; caption: string; explanation: string[]; }
export interface GenerateInput { garments: Garment[]; prefs: Preferences; ctx: Context; recentGarmentIds?: string[]; count: number; }
export type GenerateResult = { ok: true; outfits: OutfitSuggestion[] } | { ok: false; code: 'MISSING_SLOT'; slot: Category };
export const ENGINE_VERSION = '1.0.0';
