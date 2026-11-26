import { Search, LayoutGrid, List, CheckSquare, X } from 'lucide-react';
import type { SortKey } from '../types';
import { PLATFORMS, SORT_OPTIONS } from '../types';
import { useVault } from '../store/vault';
import { cx, IconBtn, Input, Select } from './ui';

export interface FilterState { q: string; sort: SortKey; cat: string; tag: string; platform: string; view: 'grid' | 'list' }

export function FilterBar({ f, set, selectionMode, onSelectionMode }: {
  f: FilterState; set: (patch: Partial<FilterState>) => void; selectionMode: boolean; onSelectionMode: (v: boolean) => void;
}) {
  const vault = useVault();
  const hasFilters = f.q || f.cat || f.tag || f.platform;
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3 sm:px-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative flex-1 basis-full sm:basis-56 min-w-[180px]">
        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input className="pl-9 h-10 w-full" placeholder="Search titles, content, tags…" value={f.q} onChange={e => set({ q: e.target.value })} aria-label="Search prompts" />
      </div>
      <Select className="w-full sm:w-40" value={f.sort} onChange={e => set({ sort: e.target.value as SortKey })} aria-label="Sort prompts">
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      <Select className="flex-1 sm:flex-none sm:w-40" value={f.cat} onChange={e => set({ cat: e.target.value })} aria-label="Filter by category">
        <option value="">All categories</option>
        {vault.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Select className="flex-1 sm:flex-none sm:w-36" value={f.tag} onChange={e => set({ tag: e.target.value })} aria-label="Filter by tag">
        <option value="">All tags</option>
        {vault.tags.map(t => <option key={t.id} value={t.id}>#{t.name}</option>)}
      </Select>
      <Select className="flex-1 sm:flex-none sm:w-36" value={f.platform} onChange={e => set({ platform: e.target.value })} aria-label="Filter by platform">
        <option value="">All platforms</option>
        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
      </Select>
      {hasFilters && <IconBtn label="Clear filters" onClick={() => set({ q: '', cat: '', tag: '', platform: '' })}><X size={15} /></IconBtn>}
      <div className="flex items-center gap-1 ml-auto">
        <IconBtn label={selectionMode ? 'Exit selection mode' : 'Select multiple'} onClick={() => onSelectionMode(!selectionMode)}
          className={cx(selectionMode && 'text-accent bg-accent-soft')}><CheckSquare size={16} /></IconBtn>
        <div className="flex rounded-lg border border-line overflow-hidden" role="group" aria-label="Prompt layout">
          <button type="button" aria-label="Grid view" aria-pressed={f.view === 'grid'} onClick={() => set({ view: 'grid' })} className={cx('p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent', f.view === 'grid' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink')}><LayoutGrid size={15} aria-hidden="true" /></button>
          <button type="button" aria-label="List view" aria-pressed={f.view === 'list'} onClick={() => set({ view: 'list' })} className={cx('p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent', f.view === 'list' ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink')}><List size={15} aria-hidden="true" /></button>
        </div>
      </div>
      </div>
    </div>
  );
}
