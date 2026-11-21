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

  if (!vault.ready) return <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><cfg.icon size={20} className="text-accent" />{cfg.title}</h1>
          <p className="text-sm text-muted mt-0.5">{cfg.desc} <span className="text-ink font-medium tabular-nums">· {hits.length}</span></p>
        </div>
        <Button variant="primary" onClick={() => ui.openEditor()}><Plus size={15} />New Prompt</Button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {CHIPS.map(c => (
          <Link key={c.to} to={c.to} className={cx('chip cursor-pointer transition hover:border-accent/40', (c.to === '/prompts' ? preset === 'all' : c.to === '/' + preset) && 'bg-accent-soft text-accent border-accent/40')}>{c.label}</Link>
        ))}
      </div>
      <FilterBar f={f} set={set} selectionMode={selectionMode} onSelectionMode={v => { setSelectionMode(v); if (!v) setSelection(new Set()); }} />
      {hits.length ? (
        <div className={f.view === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-2'}>
          {hits.map((h, i) => (
            <PromptCard key={h.prompt.id} p={h.prompt} q={f.q} snippet={h.snippet} view={f.view} index={i}
              selected={selection.has(h.prompt.id)} selectionMode={selectionMode}
              onToggleSelect={id => { setSelectionMode(true); toggle(id); }} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<cfg.icon size={22} />}
          title={f.q || f.cat || f.tag || f.platform ? 'No prompts match your filters' : preset === 'all' ? 'Your vault is empty' : `No ${cfg.title.toLowerCase()} yet`}
          hint={f.q ? 'Try a different search or clear the filters.' : preset === 'favorites' ? 'Star any prompt to find it here.' : preset === 'pinned' ? 'Pin important prompts to keep them at hand.' : preset === 'recent' ? 'Copy a prompt and it will show up here.' : 'Create your first prompt or import a backup.'}
          action={<div className="flex gap-2"><Button variant="primary" onClick={() => ui.openEditor()}><Plus size={14} />New Prompt</Button><Button onClick={() => ui.setImportOpen(true)}><Upload size={14} />Import</Button></div>} />
      )}
      <BulkBar ids={[...selection]} total={hits.length} clear={() => { setSelection(new Set()); setSelectionMode(false); }}
        selectAll={() => setSelection(new Set(hits.map(h => h.prompt.id)))} />
    </div>
  );
}
