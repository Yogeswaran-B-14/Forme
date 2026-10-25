import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { CalendarDays, Shirt, Sparkles, Sun, User } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { generate, type Garment } from '@forme/outfit-engine';
import { supabase } from '../lib/supabase';
import { WardrobePage } from '../features/wardrobe/WardrobePage';

const tabs = [['/today', 'Today', Sun], ['/studio', 'Studio', Sparkles], ['/wardrobe', 'Wardrobe', Shirt], ['/week', 'My Week', CalendarDays], ['/you', 'You', User]] as const;

function Shell() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s)); return () => data.subscription.unsubscribe(); }, []);
  if (session === undefined) return null;
  if (!session) return <Navigate to="/welcome" replace />;
  return (<div className="min-h-screen pb-24"><Outlet /><nav className="tabbar" aria-label="Main">{tabs.map(([to, label, Icon]) => (
    <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 text-xs ${isActive ? 'opacity-100' : 'opacity-60'}`}><Icon size={22} />{label}</NavLink>))}</nav></div>);
}
const Page = ({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) => (<main className="px-5 pt-14"><h1 className="font-serif text-3xl">{title}</h1><p className="mb-6 text-sm opacity-80">{sub}</p>{children}</main>);

function Welcome() {
  const nav = useNavigate();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) nav('/today', { replace: true }); }); }, [nav]);
  return (<main className="flex min-h-screen flex-col justify-between px-6 py-16"><div className="mt-24 text-center"><h1 className="font-serif text-6xl font-light tracking-widest">FORME</h1><p className="mt-3 text-[11px] tracking-[0.2em]">YOUR WARDROBE. A BRIGHTER YOU.</p></div>
    <div className="space-y-3"><h2 className="text-center font-serif text-2xl">Let's get started</h2><p className="mb-4 text-center text-sm opacity-80">Choose your identity to personalise your experience.</p>
      {['Male', 'Female', 'Other'].map(p => <button key={p} className="pill" onClick={() => { localStorage.setItem('forme.presentation', p.toLowerCase()); nav('/login'); }}>{p}<span>›</span></button>)}</div></main>);
}
function Login() {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState('');
  const send = async () => { const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/today' } }); setMsg(error ? error.message : 'Check your email for the sign-in link.'); };
  return (<Page title="Sign in" sub="We'll email you a magic link."><input className="pill mb-3 bg-cream/10" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /><button className="pill justify-center bg-cream text-ink" onClick={send}>Send link</button><p className="mt-3 text-sm">{msg}</p></Page>);
}
const demo: Garment[] = [
  { id: 'a', category: 'top', colourFamily: 'cream', pattern: 'solid', season: 'all', formality: 'casual' }, { id: 'b', category: 'top', colourFamily: 'blue', pattern: 'solid', season: 'all', formality: 'smart_casual' },
  { id: 'c', category: 'bottom', colourFamily: 'beige', pattern: 'solid', season: 'all', formality: 'casual' }, { id: 'd', category: 'bottom', colourFamily: 'navy', pattern: 'solid', season: 'all', formality: 'smart_casual' },
  { id: 'e', category: 'footwear', colourFamily: 'white', pattern: 'solid', season: 'all', formality: 'casual' }, { id: 'f', category: 'outerwear', colourFamily: 'olive', pattern: 'solid', season: 'all', formality: 'casual' }];
function Today() {
  const [seed, setSeed] = useState(1);
  const r = generate({ garments: demo, prefs: { likedColours: [], dislikedColours: [] }, ctx: { date: new Date().toISOString().slice(0, 10), seed }, count: 1 });
  return (<Page title="Today" sub="Smart. Effortless. You.">{r.ok ? <div className="rounded-card bg-cream p-5 text-ink"><p className="font-serif text-xl">Today's Look</p><p className="text-sm">{r.outfits[0].caption}</p><p className="mt-2 text-xs">{r.outfits[0].items.map(i => `${i.slot}: ${i.garmentId}`).join(' · ')}</p></div> : <p>Add a {r.slot} to get your first look.</p>}
    <button className="pill mt-4 justify-center" onClick={() => setSeed(s => s + 1)}>Regenerate (demo wardrobe)</button></Page>);
}
const Stub = ({ title, sub }: { title: string; sub: string }) => <Page title={title} sub={sub}><p className="text-sm opacity-70">Build this screen in the matching phase of docs/BUILD_GUIDE.md.</p></Page>;

export function App() {
  return (<Routes><Route path="/welcome" element={<Welcome />} /><Route path="/login" element={<Login />} />
    <Route element={<Shell />}><Route path="/today" element={<Today />} /><Route path="/studio" element={<Stub title="Studio" sub="Style it your way." />} />
      <Route path="/wardrobe" element={<WardrobePage />} /><Route path="/week" element={<Stub title="My Week" sub="Outfits planned, so you can focus on what matters." />} />
      <Route path="/you" element={<Stub title="You" sub="Your preferences." />} /></Route><Route path="*" element={<Navigate to="/today" replace />} /></Routes>);
}
