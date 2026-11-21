import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, BarChart3, BookOpen, Clock3, Copy, Files, FolderHeart, History, Pencil, Pin, Plus, Search, Shapes, Sparkles, Star, Upload, Users, WandSparkles } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { Button, EmptyState, Kbd, Skeleton } from '../components/ui';
import { timeAgo } from '../lib/utils';
import { useExportLibrary } from '../components/ImportExport';

export function DashboardWorkbench() {
  const auth = useAuth();
  const vault = useVault();
  const ui = useUI();
  const copy = useCopyPrompt();
  const exportLib = useExportLibrary();
  const recentUpdated = useMemo(() => [...vault.prompts].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5), [vault.prompts]);
  const recentUsed = useMemo(() => vault.prompts.filter(p => p.last_used_at).sort((a, b) => b.last_used_at!.localeCompare(a.last_used_at!)).slice(0, 5), [vault.prompts]);
  const pinned = useMemo(() => vault.prompts.filter(p => p.is_pinned).slice(0, 5), [vault.prompts]);
  const activity = useMemo(() => {
    const events: { id: string; kind: 'create' | 'edit' | 'copy'; text: string; at: string; promptId: string }[] = [];
    for (const p of vault.prompts) events.push({ id: 'c' + p.id, kind: 'create', text: `Created “${p.title}”`, at: p.created_at, promptId: p.id });
    for (const v of vault.versions) if (v.version_number > 1) events.push({ id: v.id, kind: 'edit', text: `v${v.version_number} of “${v.title}” — ${v.change_note || 'Edited'}`, at: v.created_at, promptId: v.prompt_id });
    for (const u of vault.usage.slice(0, 30)) { const p = vault.getPrompt(u.prompt_id); if (p) events.push({ id: u.id, kind: 'copy', text: `Copied “${p.title}”`, at: u.used_at, promptId: p.id }); }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [vault.prompts, vault.versions, vault.usage]);

  if (!vault.ready) return <div className="space-y-5"><Skeleton className="h-48" /><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const profileName = auth.displayName && auth.displayName !== 'Local user' ? auth.displayName.trim() : 'there';
  const stats = [
    { label: 'Prompts', value: vault.stats.total, icon: Files, tone: 'bg-[#E4EFE5] text-[#28513F] dark:bg-[#293B2F] dark:text-[#C1D7B8]', to: '/prompts' },
    { label: 'Categories', value: vault.stats.categories, icon: Shapes, tone: 'bg-[#E5EFF0] text-[#477C82] dark:bg-[#26383A] dark:text-[#9AC3C5]', to: '/categories' },
    { label: 'Favorites', value: vault.stats.favorites, icon: Star, tone: 'bg-[#F7E7B5] text-[#795A12] dark:bg-[#3B3424] dark:text-[#E6CA78]', to: '/favorites' },
    { label: 'Times copied', value: vault.stats.copies, icon: Copy, tone: 'bg-[#F6E0D7] text-[#A9503B] dark:bg-[#412E2B] dark:text-[#E99A80]', to: '/recent' },
  ];
  const PromptRow = ({ p, detail }: { p: typeof vault.prompts[number]; detail?: string }) => (
    <div className="group flex items-center gap-3 border-b border-line/80 py-3 last:border-0">
      <button aria-label={`Open ${p.title}`} className="min-w-0 flex-1 text-left" onClick={() => ui.openDetail(p.id)}>
        <span className="block truncate font-semibold text-ink group-hover:text-accent transition-colors">{p.title}</span>
        <span className="mt-1 block truncate text-xs text-muted">{vault.categoryName(p.category_id)} · {detail ?? timeAgo(p.updated_at)}</span>
      </button>
      <button aria-label={`Copy ${p.title}`} className="rounded-xl p-2 text-muted hover:bg-accent-soft hover:text-accent focus-visible:outline" onClick={() => void copy(p)}><Copy size={15} /></button>
      <button aria-label={`Edit ${p.title}`} className="rounded-xl p-2 text-muted hover:bg-surface2 hover:text-ink" onClick={() => ui.openEditor({ promptId: p.id })}><Pencil size={15} /></button>
    </div>
  );

  return (
    <div className="space-y-9">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-stretch animate-rise">
        <div className="py-2 md:py-5">
          <div className="eyebrow mb-4 flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full bg-rose" />A little room for good ideas</div>
          <h1 className="max-w-3xl font-display text-[clamp(2.7rem,6vw,5.25rem)] font-semibold leading-[.98] tracking-[-.055em] text-ink">
            {greeting}, {profileName}.<br /><span className="text-accent">Your prompts, kept close.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">Save your best prompts here, find them fast, and share only the ones you choose.</p>
          <button onClick={() => ui.setPalette(true)} className="mt-7 flex h-12 w-full max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left text-muted shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card">
            <Search size={17} className="text-accent" /><span className="flex-1">Search your prompt library</span><Kbd>⌘K</Kbd>
          </button>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => ui.openEditor()}><Plus size={16} />New prompt</Button>
            <Link to="/engineer"><Button><WandSparkles size={16} />Prompt engineer</Button></Link>
            <Button onClick={() => ui.setImportOpen(true)}><Upload size={15} />Import</Button>
            <Button onClick={() => exportLib('json')}><ArrowDownRight size={15} />Export</Button>
          </div>
        </div>
        <div className="relative flex min-h-[245px] flex-col justify-between overflow-hidden rounded-[28px] border border-[#28513F]/20 bg-[#28513F] p-6 text-[#FBF3E8] shadow-card dark:border-[#50634B] dark:bg-[#26342B] md:p-7">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full border-[22px] border-white/10" aria-hidden="true" />
          <div className="absolute bottom-[-38px] right-12 h-32 w-32 rotate-12 rounded-[28px] border border-white/20" aria-hidden="true" />
          <div className="relative flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em]">Your space, your rules</span>
            <BookOpen size={18} className="text-[#E9BE54]" />
          </div>
          <div className="relative mt-9">
            <div className="font-display text-3xl font-semibold leading-tight tracking-tight">Make more room<br />for the work.</div>
            <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-white/75">Your prompts stay private. Share only the ones you choose.</p>
            <Link to="/friends" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E8755A] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#D96B52] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white dark:bg-[#A9503B] dark:hover:bg-[#BC5C46]">
              Meet the community <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Vault overview" className="grid grid-cols-2 border-y border-line md:grid-cols-4">
        {stats.map((stat, i) => (
          <Link key={stat.label} to={stat.to} className={`group flex items-center gap-3 py-4 transition hover:bg-surface/70 md:px-4 ${i > 0 ? 'md:border-l md:border-line' : ''}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${stat.tone}`}><stat.icon size={17} /></span>
            <span><span className="block font-display text-2xl font-semibold leading-none tabular-nums text-ink">{stat.value}</span><span className="mt-1 block text-xs text-muted">{stat.label}</span></span>
          </Link>
        ))}
      </section>

      {pinned.length > 0 && <section className="animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="mb-3 flex items-center justify-between"><div><div className="eyebrow">Kept close</div><h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold"><Pin size={17} className="text-rose" />Pinned prompts</h2></div><Link to="/pinned" className="text-sm font-semibold text-accent hover:underline">See all <ArrowRight size={14} className="inline" /></Link></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pinned.map((p, i) => <button key={p.id} onClick={() => ui.openDetail(p.id)} className={`group rounded-2xl p-4 text-left transition hover:-translate-y-1 hover:shadow-card ${i % 3 === 0 ? 'bg-[#F5E5C9] dark:bg-[#342E23]' : i % 3 === 1 ? 'bg-[#E1ECE3] dark:bg-[#29372D]' : 'bg-[#F3DDD4] dark:bg-[#3A2C2A]'}`}>
          <span className="eyebrow">{vault.categoryName(p.category_id)}</span><span className="mt-2 block truncate font-display text-lg font-semibold text-ink">{p.title}</span><span className="mt-2 block line-clamp-2 font-mono text-xs leading-relaxed text-ink/70">{p.content.slice(0, 110)}</span><span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-accent"><Copy size={13} />Copy · {p.usage_count}×</span>
        </button>)}</div>
      </section>}

      <section className="grid gap-8 xl:grid-cols-[1fr_1fr_300px]">
        <div>
          <div className="mb-2 flex items-end justify-between"><div><div className="eyebrow">Freshly tended</div><h2 className="mt-1 font-display text-2xl font-semibold">Recently updated</h2></div><Link to="/prompts" className="text-xs font-semibold text-accent hover:underline">All prompts</Link></div>
          {recentUpdated.length ? recentUpdated.map(p => <PromptRow key={p.id} p={p} />) : <EmptyState icon={<Files size={19} />} title="Your first prompt is waiting" hint="Save a useful instruction and it will be easy to find here." action={<Button variant="primary" size="sm" onClick={() => ui.openEditor()}><Plus size={14} />Create prompt</Button>} />}
        </div>
        <div>
          <div className="mb-2 flex items-end justify-between"><div><div className="eyebrow">Ready when you are</div><h2 className="mt-1 font-display text-2xl font-semibold">Recently used</h2></div><Link to="/recent" className="text-xs font-semibold text-accent hover:underline">Usage history</Link></div>
          {recentUsed.length ? recentUsed.map(p => <PromptRow key={p.id} p={p} detail={`${p.usage_count}× · ${timeAgo(p.last_used_at)}`} />) : <div className="mt-3 rounded-2xl bg-surface2/70 p-5 text-sm leading-relaxed text-muted">Copy a saved prompt and it will appear here. Usage is tracked on successful copies.</div>}
        </div>
        <div className="rounded-2xl border border-line bg-surface/70 p-5">
          <div className="eyebrow">A little history</div><h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold"><History size={17} className="text-sky" />Recent activity</h2>
          {activity.length ? <ol className="mt-4 space-y-4">{activity.map(a => <li key={a.id} className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.kind === 'copy' ? 'bg-mint' : a.kind === 'edit' ? 'bg-sky' : 'bg-rose'}`} /><button className="min-w-0 text-left" onClick={() => ui.openDetail(a.promptId)}><span className="block truncate text-xs font-medium text-ink hover:text-accent">{a.text}</span><span className="mt-1 block text-[10px] text-muted">{timeAgo(a.at)}</span></button></li>)}</ol> : <p className="mt-4 text-sm leading-relaxed text-muted">Create, edit, or copy a prompt and your personal activity will show up here.</p>}
          <Link to="/history" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">Open history <ArrowRight size={13} /></Link>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[24px] border border-line bg-[#F4E8D4] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:bg-[#242923]">
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E9BE54] text-[#493714] dark:bg-[#403722] dark:text-[#E5C76D]"><Users size={19} /></span><div><div className="eyebrow">Good ideas travel better by choice</div><h2 className="mt-1 font-display text-xl font-semibold">A private vault with a community side.</h2><p className="mt-1 text-sm text-muted">Find friends, start a team, and choose what to share.</p></div></div>
        <Link to="/friends"><Button variant="primary">Explore friends & teams <ArrowRight size={15} /></Button></Link>
      </section>
    </div>
  );
}
