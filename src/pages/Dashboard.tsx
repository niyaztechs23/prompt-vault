import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Files, Shapes, Star, Pin, Plus, Wand2, Upload, Search, Copy, Clock, BarChart3, History, ArrowRight, Pencil } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { Button, Kbd, Skeleton, EmptyState } from './_shared';
import { timeAgo } from '../lib/utils';
import { useExportLibrary } from '../components/ImportExport';

export function Dashboard() {
  const auth = useAuth();
  const vault = useVault();
  const ui = useUI();
  const copy = useCopyPrompt();
  const exportLib = useExportLibrary();

  const recentUpdated = useMemo(() => [...vault.prompts].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5), [vault.prompts]);
  const recentUsed = useMemo(() => vault.prompts.filter(p => p.last_used_at).sort((a, b) => b.last_used_at!.localeCompare(a.last_used_at!)).slice(0, 5), [vault.prompts]);
  const pinned = useMemo(() => vault.prompts.filter(p => p.is_pinned).slice(0, 6), [vault.prompts]);
  const activity = useMemo(() => {
    const events: { id: string; icon: 'create' | 'edit' | 'copy'; text: string; at: string; promptId: string }[] = [];
    for (const p of vault.prompts) events.push({ id: 'c' + p.id, icon: 'create', text: `Created “${p.title}”`, at: p.created_at, promptId: p.id });
    for (const v of vault.versions) if (v.version_number > 1) events.push({ id: v.id, icon: 'edit', text: `v${v.version_number} of “${v.title}” — ${v.change_note || 'Edited'}`, at: v.created_at, promptId: v.prompt_id });
    for (const u of vault.usage.slice(0, 30)) { const p = vault.getPrompt(u.prompt_id); if (p) events.push({ id: u.id, icon: 'copy', text: `Copied “${p.title}”`, at: u.used_at, promptId: p.id }); }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [vault.prompts, vault.versions, vault.usage]);

  if (!vault.ready) return <div className="space-y-4"><Skeleton className="h-24" /><div className="grid sm:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const stats = [
    { label: 'Total prompts', value: vault.stats.total, icon: Files, color: 'text-accent bg-accent-soft', to: '/prompts', sub: `across ${vault.stats.categories} categories` },
    { label: 'Categories', value: vault.stats.categories, icon: Shapes, color: 'text-sky bg-sky/10', to: '/categories', sub: `${vault.stats.tags} tags · ${vault.stats.collections} collections` },
    { label: 'Favorites', value: vault.stats.favorites, icon: Star, color: 'text-gold bg-gold/10', to: '/favorites', sub: `${vault.stats.pinned} pinned` },
    { label: 'Total copies', value: vault.stats.copies, icon: BarChart3, color: 'text-mint bg-mint/10', to: '/recent', sub: 'usage tracked on every copy' },
  ];

  const Row = ({ p, right }: { p: typeof vault.prompts[number]; right?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface2 transition cursor-pointer group" onClick={() => ui.openDetail(p.id)}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink truncate">{p.title}</div>
        <div className="text-[11px] text-muted">{vault.categoryName(p.category_id)} · {right ?? timeAgo(p.updated_at)}</div>
      </div>
      <button aria-label={`Copy ${p.title}`} className="p-1.5 rounded text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition" onClick={e => { e.stopPropagation(); void copy(p); }}><Copy size={13} /></button>
      <button aria-label={`Edit ${p.title}`} className="p-1.5 rounded text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition" onClick={e => { e.stopPropagation(); ui.openEditor({ promptId: p.id }); }}><Pencil size={13} /></button>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="card p-6 relative overflow-hidden animate-rise">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[220px]">
            <h1 className="font-display text-2xl font-bold text-ink">{greeting}, {auth.displayName.split(' ')[0]} 👋</h1>
            <p className="text-sm text-muted mt-1">Your AI prompts. Organized. Optimized. Always ready.</p>
            <button onClick={() => ui.setPalette(true)} className="mt-4 input h-10 max-w-md w-full flex items-center gap-2 text-muted hover:border-accent/40 transition text-left">
              <Search size={15} /><span className="flex-1 text-sm">Search your vault…</span><Kbd>⌘K</Kbd>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => ui.openEditor()}><Plus size={15} />New Prompt</Button>
            <Link to="/engineer"><Button><Wand2 size={15} />AI Engineer</Button></Link>
            <Button onClick={() => ui.setImportOpen(true)}><Upload size={15} />Import</Button>
            <Button onClick={() => exportLib('json')}>Export</Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <Link key={s.label} to={s.to} className="card p-4 hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}><s.icon size={17} /></div>
            <div className="font-display text-2xl font-bold text-ink mt-3 tabular-nums">{s.value}</div>
            <div className="text-xs font-medium text-ink">{s.label}</div>
            <div className="text-[10px] text-muted mt-0.5">{s.sub}</div>
          </Link>
        ))}
      </section>

      {pinned.length > 0 && (
        <section className="animate-rise" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-ink text-sm flex items-center gap-1.5"><Pin size={14} className="text-gold" />Pinned</h2>
            <Link to="/pinned" className="text-xs text-accent hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {pinned.map(p => (
              <div key={p.id} className="card p-3 min-w-[220px] max-w-[260px] shrink-0 hover:border-accent/40 transition cursor-pointer" onClick={() => ui.openDetail(p.id)}>
                <div className="text-[13px] font-medium text-ink truncate">{p.title}</div>
                <div className="text-[11px] text-muted truncate mt-0.5 font-mono">{p.content.slice(0, 70)}</div>
                <button className="mt-2 text-[11px] text-accent flex items-center gap-1 hover:underline" onClick={e => { e.stopPropagation(); void copy(p); }}><Copy size={11} />Copy · {p.usage_count}×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 animate-rise" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-display font-semibold text-ink text-sm flex items-center gap-1.5"><Clock size={14} className="text-sky" />Recently updated</h2>
            <Link to="/prompts" className="text-xs text-accent hover:underline">All prompts</Link>
          </div>
          {recentUpdated.length ? recentUpdated.map(p => <Row key={p.id} p={p} />) : <p className="text-sm text-muted px-3 py-4">No prompts yet.</p>}
        </div>
        <div className="card p-4 animate-rise" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-display font-semibold text-ink text-sm flex items-center gap-1.5"><BarChart3 size={14} className="text-mint" />Recently used</h2>
            <Link to="/recent" className="text-xs text-accent hover:underline">Usage history</Link>
          </div>
          {recentUsed.length ? recentUsed.map(p => <Row key={p.id} p={p} right={`${p.usage_count}× · ${timeAgo(p.last_used_at)}`} />)
            : <p className="text-sm text-muted px-3 py-4">Copy a prompt and it will appear here — usage is tracked automatically.</p>}
        </div>
      </section>

      <section className="card p-4 animate-rise" style={{ animationDelay: '240ms' }}>
        <h2 className="font-display font-semibold text-ink text-sm flex items-center gap-1.5 mb-3 px-1"><History size={14} className="text-accent" />Recent activity</h2>
        {activity.length ? (
          <ol className="relative border-l border-line ml-3 space-y-2.5">
            {activity.map(a => (
              <li key={a.id} className="ml-4 relative cursor-pointer group" onClick={() => ui.openDetail(a.promptId)}>
                <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface ${a.icon === 'copy' ? 'bg-mint' : a.icon === 'edit' ? 'bg-sky' : 'bg-accent'}`} />
                <div className="text-[13px] text-ink group-hover:text-accent transition truncate">{a.text}</div>
                <div className="text-[10px] text-muted">{timeAgo(a.at)}</div>
              </li>
            ))}
          </ol>
        ) : <EmptyState icon={<History size={20} />} title="No activity yet" hint="Create, edit and copy prompts — every action shows up here." />}
      </section>
    </div>
  );
}
