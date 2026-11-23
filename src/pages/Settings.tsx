import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, Monitor, Moon, Sun, Type, FolderCog, User, Database, Wand2, AlertTriangle, RefreshCw, CheckCircle2, LogOut, KeyRound, Mail } from 'lucide-react';
import type { Settings as SettingsT, SortKey } from '../types';
import { SORT_OPTIONS } from '../types';
import { useVault } from '../store/vault';
import { useAuth } from '../store/auth';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { Button, Field, Input, Select, Toggle, useConfirm, cx, Badge, Skeleton } from './_shared';
import { ExportMenu, useExportLibrary } from '../components/ImportExport';
import { getAIStatus, type AIStatus } from '../services/ai';
import { supabase } from '../lib/supabase';
import { formatBytes, errMsg, fmtDateTime } from '../lib/utils';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="card p-5 animate-rise"><h2 className="font-display font-semibold text-ink text-sm flex items-center gap-2 mb-4">{icon}{title}</h2>{children}</section>;
}

export function Settings() {
  const vault = useVault();
  const auth = useAuth();
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const exportLib = useExportLibrary();
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [name, setName] = useState(auth.displayName);
  const [resetEmail, setResetEmail] = useState(auth.user?.email ?? '');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const s = vault.settings;
  const set = (patch: Partial<SettingsT>) => vault.updateSettings(patch);

  useEffect(() => { getAIStatus().then(setAiStatus); }, []);
  useEffect(() => setName(auth.displayName), [auth.displayName]);

  const dataSize = formatBytes(JSON.stringify({ p: vault.prompts, v: vault.versions, c: vault.categories, t: vault.tags, col: vault.collections }).length);

  const saveName = async () => {
    setBusy('name');
    try { await auth.updateDisplayName(name.trim() || 'User'); toast.success('Profile updated.'); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) { toast.error('Enter a valid email address.'); return; }
    setBusy('reset');
    try { await auth.sendReset(resetEmail.trim()); setResetSent(true); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const deleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete your account?', requireText: 'DELETE', confirmText: 'Delete account forever',
      message: <>This permanently deletes your account, all cloud prompts, versions, collections and settings on every device. Export a backup first if you want to keep anything. This cannot be undone.</>,
    });
    if (!ok || !supabase) return;
    setBusy('delete');
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (error) {
        let payload: any = null; try { payload = await (error as any).context?.json(); } catch {}
        throw new Error(payload?.error ?? 'Account deletion failed. Is the delete-account function deployed?');
      }
      await auth.signOut();
      toast.success('Your account and all cloud data were deleted.');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  if (!vault.ready) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-4 max-w-3xl">
      <div><h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><SettingsIcon size={20} className="text-accent" />Settings</h1>
        <p className="text-sm text-muted mt-0.5">Personalize Prompt Vault. Changes save instantly{vault.mode === 'cloud' ? ' and sync to your account' : ''}.</p></div>

      <Section icon={<Monitor size={15} className="text-accent" />} title="Appearance">
        <div className="grid grid-cols-3 gap-2 max-w-sm">
          {([['dark', Moon, 'Dark'], ['light', Sun, 'Light'], ['system', Monitor, 'System']] as const).map(([val, Icon, label]) => (
            <button key={val} onClick={() => set({ theme: val })}
              className={cx('card p-3 flex flex-col items-center gap-1.5 transition', s.theme === val ? 'border-accent/60 bg-accent-soft text-accent' : 'text-muted hover:border-accent/30')}>
              <Icon size={16} /><span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Type size={15} className="text-accent" />} title="Editor">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div><div className="text-sm text-ink">Autosave recovery drafts</div><div className="text-xs text-muted">Keep a local draft while editing so interrupted work is recoverable.</div></div>
            <Toggle checked={s.autosave} onChange={v => set({ autosave: v })} label="Autosave drafts" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><div className="text-sm text-ink">Show word & character counts</div><div className="text-xs text-muted">Display counts under the content editor.</div></div>
            <Toggle checked={s.show_counts} onChange={v => set({ show_counts: v })} label="Show counts" />
          </div>
          <Field label={`Editor font size — ${s.editor_font_size}px`}>
            <input type="range" min={12} max={20} value={s.editor_font_size} onChange={e => set({ editor_font_size: Number(e.target.value) })}
              className="w-full max-w-xs accent-[#28513F]" aria-label="Editor font size" />
          </Field>
        </div>
      </Section>

      <Section icon={<FolderCog size={15} className="text-accent" />} title="Organization defaults">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Default category">
            <Select value={s.default_category_id ?? ''} onChange={e => set({ default_category_id: e.target.value || null })}>
              <option value="">Uncategorized</option>
              {vault.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Default sorting">
            <Select value={s.default_sort} onChange={e => set({ default_sort: e.target.value as SortKey })}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Default view">
            <Select value={s.default_view} onChange={e => set({ default_view: e.target.value as 'grid' | 'list' })}>
              <option value="grid">Grid</option><option value="list">List</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section icon={<Wand2 size={15} className="text-accent" />} title="AI Prompt Engineer">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {aiStatus?.state === 'ready'
            ? <Badge className="text-mint border-mint/30 bg-mint/10"><CheckCircle2 size={11} />Available · model: {aiStatus.model}</Badge>
            : <Badge className="text-gold border-gold/30 bg-gold/10"><AlertTriangle size={11} />{aiStatus ? 'Not available' : 'Checking…'}</Badge>}
          <Button size="sm" variant="subtle" onClick={() => { setAiStatus(null); getAIStatus().then(setAiStatus); }}><RefreshCw size={12} />Re-check</Button>
          <Link to="/engineer"><Button size="sm">Open AI Lab</Button></Link>
        </div>
        {aiStatus && aiStatus.state !== 'ready' && <p className="text-xs text-muted leading-relaxed">{aiStatus.message} API keys live only on the server (Supabase Edge Function secrets) — never in this browser. See README → “AI provider configuration”.</p>}
        {aiStatus?.state === 'ready' && <p className="text-xs text-muted">Requests are authenticated, validated and rate-limited server-side. The model is configured via the AI_MODEL function secret.</p>}
      </Section>

      <Section icon={<User size={15} className="text-accent" />} title="Account">
        {auth.user ? (
          <div className="space-y-4">
            <div className="text-xs text-muted">Signed in as <b className="text-ink">{auth.user.email}</b> · member since {fmtDateTime(auth.user.created_at)}</div>
            <div className="flex gap-2 items-end max-w-md">
              <Field label="Display name"><Input value={name} onChange={e => setName(e.target.value)} /></Field>
              <Button onClick={() => void saveName()} loading={busy === 'name'}>Save</Button>
            </div>
            <form onSubmit={e => void requestPasswordReset(e)} className="max-w-md space-y-3">
              <p className="text-xs text-muted">To change your password, request a secure link by email. Open the link from your inbox, then choose a new password on the reset page.</p>
              <Field label="Email for password authorization"><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" type="email" value={resetEmail} onChange={e => { setResetEmail(e.target.value); setResetSent(false); }} autoComplete="email" required /></div></Field>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" type="submit" loading={busy === 'reset'}><KeyRound size={13} />Email password reset link</Button>
              </div>
              {resetSent && <p role="status" className="text-xs text-mint">If an account matches that email, a password reset link is on its way. Check your inbox.</p>}
            </form>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="subtle" onClick={async () => { await auth.signOut(); toast.info('Signed out.'); }}><LogOut size={13} />Sign out</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">
            You are in <b className="text-ink">local mode</b> — data lives in this browser (IndexedDB).
            <Link to="/auth" className="text-accent hover:underline ml-1">Sign in or create an account</Link> to sync across devices; you'll be offered a safe merge of your local prompts.
          </div>
        )}
      </Section>

      <Section icon={<Database size={15} className="text-accent" />} title="Data — backup & restore">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {([['Prompts', vault.stats.total], ['Versions', vault.versions.length], ['Collections', vault.stats.collections], ['Storage', dataSize]] as const).map(([l, v]) => (
            <div key={l} className="card p-3 text-center bg-surface2/40"><div className="text-base font-display font-bold text-ink tabular-nums">{v}</div><div className="text-[10px] text-muted uppercase tracking-wide">{l}</div></div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportMenu onExport={exportLib} />
          <Button onClick={() => ui.setImportOpen(true)}>Import JSON backup</Button>
        </div>
        <p className="text-[11px] text-muted mt-2">JSON backups include prompts, categories, tags, collections, usage counts and full version history. Imports are validated and previewed before anything changes.</p>
      </Section>

      <Section icon={<AlertTriangle size={15} className="text-rose" />} title="Danger zone">
        <div className="flex gap-2 flex-wrap">
          <Button variant="danger" onClick={async () => {
            if (await confirm({ title: 'Delete all vault data?', requireText: 'DELETE', confirmText: 'Delete everything',
              message: `This removes all ${vault.stats.total} prompts, versions, categories, tags and collections ${vault.mode === 'cloud' ? 'from your cloud account (all devices)' : 'from this browser'}. Your account and preferences remain. Export a backup first!` }))
              await vault.deleteAllData();
          }}>Delete all data</Button>
          {auth.user && <Button variant="danger" loading={busy === 'delete'} onClick={() => void deleteAccount()}>Delete account permanently</Button>}
        </div>
      </Section>
    </div>
  );
}
