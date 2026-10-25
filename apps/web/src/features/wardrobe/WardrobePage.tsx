import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search } from 'lucide-react';
import { COLOUR_FAMILIES, compress, cutout, dominantColour } from '../../lib/image/process';
import { useAddGarment, useGarments, useSignedUrl, useUpdateGarment, type GarmentRow } from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name'),
  category: z.enum(['top', 'bottom', 'outerwear', 'footwear', 'accessory']),
  subcategory: z.string().optional(),
  colour_family: z.string().min(1),
  pattern: z.enum(['solid', 'stripe', 'check', 'print', 'textured', 'other']),
  season: z.enum(['spring', 'summer', 'autumn', 'winter', 'all']),
  formality: z.enum(['casual', 'smart_casual', 'formal', 'sport']),
});
type FormValues = z.infer<typeof schema>;
const CHIPS = [['all', 'All'], ['top', 'Tops'], ['bottom', 'Bottoms'], ['outerwear', 'Outerwear'], ['footwear', 'Footwear'], ['accessory', 'Accessories']] as const;
const field = 'min-h-[44px] w-full rounded-card bg-cream/10 px-3 text-cream';

function Tile({ g, onOpen }: { g: GarmentRow; onOpen: () => void }) {
  const cut = useSignedUrl('garments-cutout', g.image_cutout_path);
  const orig = useSignedUrl('garments-original', g.image_cutout_path ? null : g.image_original_path);
  const src = cut.data ?? orig.data;
  return (<button onClick={onOpen} aria-label={g.name} className="aspect-square overflow-hidden rounded-card bg-cream p-2">{src && <img src={src} alt={g.name} className="h-full w-full object-contain" />}</button>);
}

function GarmentSheet({ defaults, previewUrl, saving, onSave, onClose, onArchive }: { defaults: FormValues; previewUrl: string | null; saving: boolean; onSave: (v: FormValues) => void; onClose: () => void; onArchive?: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const sel = (name: keyof FormValues, opts: readonly string[]) => (<select className={field} {...register(name)}>{opts.map(o => <option key={o} value={o} className="text-ink">{o.replace('_', ' ')}</option>)}</select>);
  return (<div className="fixed inset-0 z-50 flex items-end bg-black/60" role="dialog" aria-modal="true">
    <form onSubmit={handleSubmit(onSave)} className="max-h-[90vh] w-full space-y-3 overflow-auto rounded-t-2xl bg-ink p-5">
      <h2 className="font-serif text-2xl">Review piece</h2>
      {previewUrl && <div className="mx-auto h-40 w-40 rounded-card bg-cream p-2"><img src={previewUrl} alt="" className="h-full w-full object-contain" /></div>}
      <input className={field} placeholder="Name (e.g. Olive overshirt)" {...register('name')} />{errors.name && <p className="text-xs">{errors.name.message}</p>}
      {sel('category', ['top', 'bottom', 'outerwear', 'footwear', 'accessory'])}
      <input className={field} placeholder="Type (shirt, chinos, sneakers…)" {...register('subcategory')} />
      {sel('colour_family', COLOUR_FAMILIES)}{sel('pattern', ['solid', 'stripe', 'check', 'print', 'textured', 'other'])}
      {sel('season', ['all', 'spring', 'summer', 'autumn', 'winter'])}{sel('formality', ['casual', 'smart_casual', 'formal', 'sport'])}
      <button type="submit" disabled={saving} className="pill justify-center bg-cream text-ink">{saving ? 'Saving…' : 'Save'}</button>
      {onArchive && <button type="button" onClick={onArchive} className="pill justify-center">Archive</button>}
      <button type="button" onClick={onClose} className="pill justify-center">Cancel</button>
    </form></div>);
}

type SheetState = { mode: 'new'; original: Blob; cut: Blob | null; previewUrl: string; defaults: FormValues; hex: string } | { mode: 'edit'; g: GarmentRow } | null;

export function WardrobePage() {
  const { data: garments = [], isLoading } = useGarments();
  const add = useAddGarment(); const update = useUpdateGarment();
  const [filter, setFilter] = useState<string>('all'); const [query, setQuery] = useState(''); const [showSearch, setShowSearch] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cutPreview = useSignedUrl('garments-cutout', sheet?.mode === 'edit' ? sheet.g.image_cutout_path : null);
  const origPreview = useSignedUrl('garments-original', sheet?.mode === 'edit' && !sheet.g.image_cutout_path ? sheet.g.image_original_path : null);

  const onFile = async (file?: File) => {
    if (!file) return; setBusy(true); setError('');
    try {
      const original = await compress(file); const cut = await cutout(original); const shown = cut ?? original; const { hex, family } = await dominantColour(shown);
      setSheet({ mode: 'new', original, cut, hex, previewUrl: URL.createObjectURL(shown), defaults: { name: '', category: 'top', subcategory: '', colour_family: family, pattern: 'solid', season: 'all', formality: 'casual' } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not process that photo'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const visible = garments.filter(g => (filter === 'all' || g.category === filter) && `${g.name} ${g.subcategory ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  return (<main className="px-5 pt-14">
    <div className="flex items-start justify-between"><div><h1 className="font-serif text-3xl">My Wardrobe</h1><p className="mb-4 text-sm opacity-80">Your collection, beautifully organised.</p></div>
      <div className="flex gap-2"><button className="chip flex items-center" aria-label="Search" onClick={() => setShowSearch(s => !s)}><Search size={18} /></button>
        <button className="chip flex items-center" aria-label="Add garment" onClick={() => fileRef.current?.click()}><Plus size={18} /></button></div></div>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onFile(e.target.files?.[0])} />
    {showSearch && <input className={`${field} mb-3`} placeholder="Search your wardrobe" value={query} onChange={e => setQuery(e.target.value)} />}
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{CHIPS.map(([k, label]) => <button key={k} className="chip shrink-0" data-active={filter === k} onClick={() => setFilter(k)}>{label}</button>)}</div>
    {busy && <p className="mb-3 text-sm">Preparing your piece… the first one takes longer.</p>}{error && <p className="mb-3 text-sm">{error}</p>}
    {garments.length < 20 && <p className="mb-3 text-xs opacity-70">{garments.length} of 20 pieces added</p>}
    {isLoading ? <p>Loading…</p> : visible.length === 0 ? <button className="pill justify-center" onClick={() => fileRef.current?.click()}>Add your first piece</button>
      : <div className="grid grid-cols-3 gap-2">{visible.map(g => <Tile key={g.id} g={g} onOpen={() => setSheet({ mode: 'edit', g })} />)}</div>}
    {sheet?.mode === 'new' && <GarmentSheet defaults={sheet.defaults} previewUrl={sheet.previewUrl} saving={add.isPending} onClose={() => setSheet(null)}
      onSave={v => add.mutate({ input: { ...v, subcategory: v.subcategory || null, colour_hex: sheet.hex }, original: sheet.original, cut: sheet.cut }, { onSuccess: () => setSheet(null), onError: e => setError(e.message) })} />}
    {sheet?.mode === 'edit' && <GarmentSheet key={sheet.g.id} previewUrl={cutPreview.data ?? origPreview.data ?? null} saving={update.isPending} onClose={() => setSheet(null)}
      defaults={{ name: sheet.g.name, category: sheet.g.category, subcategory: sheet.g.subcategory ?? '', colour_family: sheet.g.colour_family, pattern: sheet.g.pattern as FormValues['pattern'], season: sheet.g.season as FormValues['season'], formality: sheet.g.formality as FormValues['formality'] }}
      onSave={v => update.mutate({ id: sheet.g.id, patch: { ...v, subcategory: v.subcategory || null } }, { onSuccess: () => setSheet(null) })}
      onArchive={() => update.mutate({ id: sheet.g.id, patch: { archived: true } }, { onSuccess: () => setSheet(null) })} />}
  </main>);
}
