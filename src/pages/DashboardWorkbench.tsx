import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, BookOpen, Copy, Files, History, Pencil, Pin, Plus, Search, Shapes,
  Star, Upload, Users, WandSparkles, Sparkles, PenLine, Stethoscope,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { Button, EmptyState, Kbd, Skeleton } from '../components/ui';
import { timeAgo } from '../lib/utils';
import { useExportLibrary } from '../components/ImportExport';

const AI_SHORTCUTS = [
  { mode: 'improve', label: 'Improve a prompt', description: 'Strengthen an existing prompt.', icon: Sparkles },
  { mode: 'generate', label: 'Generate a prompt', description: 'Start with a goal or idea.', icon: WandSparkles },
  { mode: 'rewrite', label: 'Rewrite a prompt', description: 'Choose a different style.', icon: PenLine },
  { mode: 'analyze', label: 'Analyze a prompt', description: 'Spot gaps and ambiguities.', icon: Stethoscope },
] as const;

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

  if (!vault.ready) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const profileName = auth.displayName && auth.displayName !== 'Local user' ? auth.displayName.trim() : 'there';
  const stats = [
    { label: 'Prompts', value: vault.stats.total, icon: Files, to: '/prompts', accent: 'text-mint' },
    { label: 'Categories', value: vault.stats.categories, icon: Shapes, to: '/categories', accent: 'text-sky' },
    { label: 'Favorites', value: vault.stats.favorites, icon: Star, to: '/favorites', accent: 'text-gold' },
    { label: 'Times copied', value: vault.stats.copies, icon: Copy, to: '/recent', accent: 'text-rose' },
  ];
  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';
  const PromptRow = ({ p, detail }: { p: typeof vault.prompts[number]; detail?: string }) => (
    <div className="group flex items-center gap-2 border-b border-line py-3 last:border-0">
      <button aria-label={`Open ${p.title}`} className={`min-w-0 flex-1 text-left ${focus}`} onClick={() => ui.openDetail(p.id)}>
        <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent">{p.title}</span>
        <span className="mt-1 block truncate text-xs text-muted">{vault.categoryName(p.category_id)} · {detail ?? timeAgo(p.updated_at)}</span>
      </button>
      <button aria-label={`Copy ${p.title}`} className={`rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink ${focus}`} onClick={() => void copy(p)}><Copy size={15} /></button>
      <button aria-label={`Edit ${p.title}`} className={`rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink ${focus}`} onClick={() => ui.openEditor({ promptId: p.id })}><Pencil size={15} /></button>
    </div>
  );

  return (
    <div className="-mx-4 space-y-7 bg-bg px-4 py-6 text-ink sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <section className="grid gap-6 border-b border-line pb-7 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.12em] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-rose" aria-hidden="true" />Prompt Vault <span aria-hidden="true">/</span> Workspace</div>
          <h1 className="font-display text-[clamp(2rem,4.6vw,3.75rem)] font-semibold leading-[1.03] tracking-[-.04em]">{greeting}, {profileName}<span className="text-accent">.</span></h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Your prompt library, ready when you are.</p>
          <button aria-label="Search your prompt library (Command or Control plus K)" onClick={() => ui.setPalette(true)} className={`input mt-5 flex h-11 max-w-xl items-center gap-3 text-left hover:border-accent/60 hover:bg-surface2 ${focus}`}>
            <Search size={16} className="text-accent" aria-hidden="true" /><span className="flex-1">Search your prompt library</span><Kbd>⌘ / Ctrl + K</Kbd>
          </button>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => ui.openEditor()}><Plus size={16} />New prompt</Button>
            <Link to="/engineer"><Button><WandSparkles size={16} />AI Prompt Engineer</Button></Link>
            <Button onClick={() => ui.setImportOpen(true)}><Upload size={15} />Import</Button>
            <Button onClick={() => exportLib('json')}><ArrowDownRight size={15} />Export</Button>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-gold"><BookOpen size={17} aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold">A thoughtful place for good work.</p><p className="mt-1 text-xs leading-relaxed text-muted">Keep your useful prompts close. Share only what you choose.</p><Link to="/friends" className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose hover:underline ${focus}`}>Meet the community <ArrowRight size={13} /></Link></div>
        </div>
      </section>

      <section aria-label="Vault overview" className="grid grid-cols-2 border-b border-line pb-5 md:grid-cols-4">
        {stats.map((stat, i) => <Link key={stat.label} to={stat.to} className={`group flex items-center gap-3 rounded-lg py-2 transition hover:bg-surface2/50 ${i > 0 ? 'md:border-l md:border-line md:pl-5' : ''} ${focus}`}>
          <stat.icon size={17} className={stat.accent} aria-hidden="true" /><span><span className="block font-display text-2xl font-semibold leading-none tabular-nums">{stat.value}</span><span className="mt-1 block text-xs text-muted">{stat.label}</span></span>
        </Link>)}
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="mb-3 flex items-end justify-between gap-3"><div><div className="eyebrow">Start with a task</div><h2 id="quick-actions-title" className="mt-1 font-display text-xl font-semibold">Quick actions</h2></div><span className="hidden text-xs text-muted sm:inline">Opens the selected mode in the AI workbench</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AI_SHORTCUTS.map(item => <Link key={item.mode} to={`/engineer?mode=${item.mode}`} className={`group rounded-xl border border-line bg-surface p-3 transition hover:border-accent/50 hover:bg-surface2 sm:p-4 ${focus}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><item.icon size={16} aria-hidden="true" /></span>
            <span className="mt-2 block text-xs font-semibold text-ink group-hover:text-accent sm:text-sm">{item.label}</span>
            <span className="mt-1 block text-[11px] leading-snug text-muted">{item.description}</span>
          </Link>)}
        </div>
      </section>

      {pinned.length > 0 && <section aria-labelledby="pinned-title">
        <div className="mb-3 flex items-end justify-between"><div><div className="eyebrow">Kept close</div><h2 id="pinned-title" className="mt-1 flex items-center gap-2 font-display text-xl font-semibold"><Pin size={16} className="text-rose" />Pinned prompts</h2></div><Link to="/pinned" className={`text-xs font-semibold text-accent hover:underline ${focus}`}>See all <ArrowRight size={13} className="inline" /></Link></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{pinned.map(p => <button key={p.id} aria-label={`Open pinned prompt ${p.title}`} onClick={() => ui.openDetail(p.id)} className={`rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent/40 hover:bg-surface2 ${focus}`}>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{vault.categoryName(p.category_id)}</span><span className="mt-1.5 block truncate text-sm font-semibold">{p.title}</span><span className="mt-2 block line-clamp-2 font-mono text-xs leading-relaxed text-muted">{p.content.slice(0, 110)}</span><span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold"><Copy size={13} />{p.usage_count} copies</span>
        </button>)}</div>
      </section>}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_280px]">
        <div>
          <div className="mb-2 flex items-end justify-between"><div><div className="eyebrow">Freshly tended</div><h2 className="mt-1 font-display text-xl font-semibold">Continue working</h2></div><Link to="/prompts" className={`text-xs font-semibold text-accent hover:underline ${focus}`}>All prompts</Link></div>
          {recentUpdated.length ? recentUpdated.map(p => <PromptRow key={p.id} p={p} />) : <EmptyState icon={<Files size={19} />} title="Your first prompt is waiting" hint="Save a useful instruction and it will be easy to find here." action={<Button variant="primary" size="sm" onClick={() => ui.openEditor()}><Plus size={14} />Create prompt</Button>} />}
        </div>
        <div>
          <div className="mb-2 flex items-end justify-between"><div><div className="eyebrow">Ready when you are</div><h2 className="mt-1 font-display text-xl font-semibold">Recently used</h2></div><Link to="/recent" className={`text-xs font-semibold text-accent hover:underline ${focus}`}>Usage history</Link></div>
          {recentUsed.length ? recentUsed.map(p => <PromptRow key={p.id} p={p} detail={`${p.usage_count}× · ${timeAgo(p.last_used_at)}`} />) : <div className="mt-3 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">Copy a saved prompt and it will appear here. Usage is tracked on successful copies.</div>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="eyebrow">A little history</div><h2 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold"><History size={16} className="text-sky" />Recent activity</h2>
          {activity.length ? <ol className="mt-4 space-y-3">{activity.map(a => <li key={a.id} className="flex gap-2.5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.kind === 'copy' ? 'bg-mint' : a.kind === 'edit' ? 'bg-sky' : 'bg-rose'}`} aria-hidden="true" /><button aria-label={`${a.text}, ${timeAgo(a.at)}; open prompt`} className={`min-w-0 text-left ${focus}`} onClick={() => ui.openDetail(a.promptId)}><span className="block truncate text-xs font-medium text-ink hover:text-accent">{a.text}</span><span className="mt-1 block text-[10px] text-muted">{timeAgo(a.at)}</span></button></li>)}</ol> : <p className="mt-3 text-sm leading-relaxed text-muted">Create, edit, or copy a prompt and your personal activity will show up here.</p>}
          <Link to="/history" className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline ${focus}`}>Open history <ArrowRight size={13} /></Link>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-gold"><Users size={17} aria-hidden="true" /></span><div><div className="eyebrow">Good ideas travel better by choice</div><h2 className="mt-1 text-sm font-semibold">A private vault with a community side.</h2><p className="mt-1 text-xs text-muted">Find friends, start a team, and choose what to share.</p></div></div>
        <Link to="/friends"><Button variant="primary">Explore friends &amp; teams <ArrowRight size={15} /></Button></Link>
      </section>
    </div>
  );
}
