import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Files, Star, Pin, Clock, BarChart3, Tag, Shapes, Plus, Upload } from 'lucide-react';
import type { SortKey } from '../types';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { filterPrompts, sortPrompts } from '../lib/search';
import { FilterBar, type FilterState } from '../components/FilterBar';
import { BulkBar } from '../components/BulkBar';
import { PromptCard } from '../components/PromptCard';
import { Button, EmptyState, Skeleton, cx } from './_shared';

const PRESETS: Record<string, { title: string; desc: string; icon: any; filter: (p: any) => boolean; sort?: SortKey }> = {
  all: { title: 'All Prompts', desc: 'Your complete prompt library.', icon: Files, filter: () => true },
  favorites: { title: 'Favorites', desc: 'Prompts you starred for quick access.', icon: Star, filter: p => p.is_favorite, sort: 'favorites' },
  pinned: { title: 'Pinned Prompts', desc: 'Your most important prompts, always at hand.', icon: Pin, filter: p => p.is_pinned, sort: 'pinned' },
  recent: { title: 'Recently Used', desc: 'Ordered by the last time you copied each prompt.', icon: Clock, filter: p => !!p.last_used_at },
  'most-used': { title: 'Most Used', desc: 'Your workhorses, ranked by usage count.', icon: BarChart3, filter: () => true, sort: 'usage' },
  untagged: { title: 'Untagged Prompts', desc: 'Prompts without any tags — tidy them up.', icon: Tag, filter: p => p.tag_ids.length === 0 },
  uncategorized: { title: 'Uncategorized Prompts', desc: 'Prompts without a category.', icon: Shapes, filter: p => !p.category_id },
};
const CHIPS = [
  { to: '/prompts', label: 'All' }, { to: '/recent', label: 'Recently used' }, { to: '/most-used', label: 'Most used' },
  { to: '/untagged', label: 'Untagged' }, { to: '/uncategorized', label: 'Uncategorized' },
];

export function Prompts({ preset }: { preset: keyof typeof PRESETS }) {
  const vault = useVault();
  const ui = useUI();
  const cfg = PRESETS[preset];
  const [params, setParams] = useSearchParams();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const f: FilterState = {
    q: params.get('q') ?? '', sort: (params.get('sort') as SortKey) ?? cfg.sort ?? vault.settings.default_sort,
    cat: params.get('cat') ?? '', tag: params.get('tag') ?? '', platform: params.get('platform') ?? '',
    view: (params.get('view') as 'grid' | 'list') ?? vault.settings.default_view,
  };
  const set = (patch: Partial<FilterState>) => {
    const next = { ...f, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set('q', next.q);
    if (next.sort !== (cfg.sort ?? vault.settings.default_sort)) p.set('sort', next.sort);
    if (next.cat) p.set('cat', next.cat); if (next.tag) p.set('tag', next.tag); if (next.platform) p.set('platform', next.platform);
    if (next.view !== vault.settings.default_view) p.set('view', next.view);
    setParams(p, { replace: true });
  };

  useEffect(() => { setSelection(new Set()); setSelectionMode(false); }, [preset]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelection(new Set()); setSelectionMode(false); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo(() => {
    const base = vault.prompts.filter(cfg.filter);
    const found = filterPrompts(base, { q: f.q, categoryId: f.cat, tagId: f.tag, platform: f.platform }, {
      categoryName: vault.categoryName, tagNames: ids => ids.map(id => vault.tags.find(t => t.id === id)?.name ?? ''),
    });
    if (preset === 'recent') return found.sort((a, b) => (b.prompt.last_used_at ?? '').localeCompare(a.prompt.last_used_at ?? ''));
    if (f.q) return found;
    return sortPrompts(found.map(h => h.prompt), f.sort).map(p => ({ prompt: p, score: 0, snippet: null }));
  }, [vault.prompts, vault.tags, vault.categories, f.q, f.sort, f.cat, f.tag, f.platform, preset]);

  const toggle = (id: string) => setSelection(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!vault.ready) return <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Loading prompts">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap rounded-2xl border border-line bg-surface px-4 py-5 sm:px-6 sm:py-6 shadow-card">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted mb-2">Prompt Vault <span aria-hidden="true">/</span> Library</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2.5"><span className="grid place-items-center rounded-xl bg-accent-soft p-2 text-accent"><cfg.icon size={20} aria-hidden="true" /></span>{cfg.title}</h1>
          <p className="text-sm text-muted mt-2">{cfg.desc} <span className="text-ink font-semibold tabular-nums">· {hits.length} {hits.length === 1 ? 'prompt' : 'prompts'}</span></p>
        </div>
        <Button variant="primary" onClick={() => ui.openEditor()}><Plus size={15} aria-hidden="true" />New Prompt</Button>
      </header>
      <nav aria-label="Prompt library shortcuts" className="flex gap-2 overflow-x-auto pb-1">
        {CHIPS.map(c => (
          <Link key={c.to} to={c.to} aria-current={(c.to === '/prompts' ? preset === 'all' : c.to === '/' + preset) ? 'page' : undefined} className={cx('chip shrink-0 cursor-pointer transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', (c.to === '/prompts' ? preset === 'all' : c.to === '/' + preset) && 'bg-accent-soft text-accent border-accent/40')}>{c.label}</Link>
        ))}
      </nav>
      <FilterBar f={f} set={set} selectionMode={selectionMode} onSelectionMode={v => { setSelectionMode(v); if (!v) setSelection(new Set()); }} />
      {hits.length ? (
        <section aria-label={`${cfg.title} results`} className={f.view === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4' : 'space-y-2'}>
          {hits.map((h, i) => (
            <PromptCard key={h.prompt.id} p={h.prompt} q={f.q} snippet={h.snippet} view={f.view} index={i}
              selected={selection.has(h.prompt.id)} selectionMode={selectionMode}
              onToggleSelect={id => { setSelectionMode(true); toggle(id); }} />
          ))}
        </section>
      ) : (
        <EmptyState icon={<cfg.icon size={22} />}
          title={f.q || f.cat || f.tag || f.platform ? 'No prompts match these filters' : preset === 'all' ? 'Your vault is ready for its first prompt' : `No ${cfg.title.toLowerCase()} yet`}
          hint={f.q || f.cat || f.tag || f.platform ? 'Try a broader search or clear one or more filters to see matching prompts.' : preset === 'favorites' ? 'Star any prompt to keep it close at hand.' : preset === 'pinned' ? 'Pin important prompts to keep them easy to find.' : preset === 'recent' ? 'Copy a prompt and it will appear here.' : preset === 'most-used' ? 'Prompts will be ranked here as you use them.' : preset === 'untagged' ? 'Everything is tagged. New prompts without tags will appear here.' : preset === 'uncategorized' ? 'Everything has a category. New uncategorized prompts will appear here.' : 'Create a prompt from scratch or import a backup to bring your library in.'}
          action={<div className="flex gap-2"><Button variant="primary" onClick={() => ui.openEditor()}><Plus size={14} />New Prompt</Button><Button onClick={() => ui.setImportOpen(true)}><Upload size={14} />Import</Button></div>} />
      )}
      <BulkBar ids={[...selection]} total={hits.length} clear={() => { setSelection(new Set()); setSelectionMode(false); }}
        selectAll={() => setSelection(new Set(hits.map(h => h.prompt.id)))} />
    </div>
  );
}
