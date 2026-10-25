import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@forme/outfit-engine';
import { supabase } from '../../lib/supabase';

export interface GarmentRow {
  id: string; name: string; category: Category; subcategory: string | null; colour_hex: string | null; colour_family: string;
  pattern: string; season: string; formality: string; image_original_path: string; image_cutout_path: string | null;
}
export type GarmentInput = Omit<GarmentRow, 'id' | 'image_original_path' | 'image_cutout_path'>;

export const useGarments = () => useQuery({
  queryKey: ['garments'],
  queryFn: async () => {
    const { data, error } = await supabase.from('garments').select('*').eq('archived', false).order('created_at', { ascending: false });
    if (error) throw error;
    return data as GarmentRow[];
  },
});

export function useAddGarment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, original, cut }: { input: GarmentInput; original: Blob; cut: Blob | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id; if (!uid) throw new Error('Not signed in');
      const id = crypto.randomUUID(); const op = `${uid}/${id}.jpg`; const cp = cut ? `${uid}/${id}.png` : null;
      const cleanup = async () => { await supabase.storage.from('garments-original').remove([op]); if (cp) await supabase.storage.from('garments-cutout').remove([cp]); };
      const up1 = await supabase.storage.from('garments-original').upload(op, original, { contentType: 'image/jpeg' }); if (up1.error) throw up1.error;
      if (cp && cut) { const up2 = await supabase.storage.from('garments-cutout').upload(cp, cut, { contentType: 'image/png' }); if (up2.error) { await cleanup(); throw up2.error; } }
      const { error } = await supabase.from('garments').insert({ id, user_id: uid, ...input, image_original_path: op, image_cutout_path: cp });
      if (error) { await cleanup(); throw error; }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garments'] }),
  });
}

export function useUpdateGarment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<GarmentInput> & { archived?: boolean } }) => {
      const { error } = await supabase.from('garments').update(patch).eq('id', id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['garments'] }),
  });
}

export const useSignedUrl = (bucket: 'garments-original' | 'garments-cutout', path: string | null) => useQuery({
  queryKey: ['signedUrl', bucket, path], enabled: !!path, staleTime: 50 * 60 * 1000,
  queryFn: async () => { const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600); if (error) throw error; return data.signedUrl; },
});
