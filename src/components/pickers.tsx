import { useMemo, useState } from 'react';
import { Plus, Search, X, Check } from 'lucide-react';
import { CATEGORY_COLORS } from '../types';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { cx, Input, Modal, Badge } from './ui';
import { norm } from '../lib/utils';

export function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_COLORS.map(c => (
        <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => onChange(c)}
          className={cx('w-6 h-6 rounded-full border-2 transition', value === c ? 'border-ink scale-110' : 'border-transparent hover:scale-110')}
          style={{ background: c }} />
      ))}
    </div>
  );
}

export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const vault = useVault();
  const [q, setQ] = useState('');
  const suggestions = vault.tags.filter(t => !value.includes(t.id) && norm(t.name).includes(norm(q))).slice(0, 6);
  const exact = vault.tags.some(t => norm(t.name) === norm(q.replace(/^#/, '')));
  const add = (id: string) => { onChange([...value, id]); setQ(''); };
  const create = async () => { if (!q.trim()) return; const t = await vault.createTag(q); if (t) add(t.id); };
  return (
    <div className="input min-h-[42px] flex flex-wrap items-center gap-1.5 py-1.5 relative">
      {value.map(id => {
        const t = vault.tags.find(x => x.id === id);
        return t ? (
          <Badge key={id} className="bg-accent-soft text-accent border-accent/30">#{t.name}
            <button type="button" aria-label={`Remove tag ${t.name}`} onClick={() => onChange(value.filter(v => v !== id))}><X size={11} /></button>
          </Badge>
        ) : null;
      })}
      <input className="bg-transparent outline-none text-sm flex-1 min-w-[100px] placeholder:text-muted/70"
        placeholder="Add tags… (Enter to create)" value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0] && !q.includes(' ')) add(suggestions[0].id); else void create(); }
          if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
        }} />
      {q && (
        <div className="absolute left-0 top-full mt-1 z-30 card shadow-pop p-1.5 w-56">
          {suggestions.map(t => <button key={t.id} type="button" className="menu-item" onClick={() => add(t.id)}>#{t.name}</button>)}
          {!exact && q.trim() && <button type="button" className="menu-item text-accent" onClick={() => void create()}><Plus size={14} />Create “{q.trim().replace(/^#/, '')}”</button>}
        </div>
      )}
    </div>
  );
}

export function CollectionChecklist({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const vault = useVault();
  const [name, setName] = useState('');
  if (!vault.collections.length && !name)
    return <p className="text-xs text-muted">No collections yet — create one below or on the Collections page.</p>;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {vault.collections.map(c => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" onClick={() => onChange(on ? value.filter(v => v !== c.id) : [...value, c.id])}
              className={cx('chip cursor-pointer transition', on ? 'bg-accent-soft text-accent border-accent/40' : 'hover:border-accent/30')}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}{on && <Check size={11} />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input placeholder="New collection name" value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" />
        <button type="button" className="chip hover:border-accent/40 shrink-0" onClick={async () => {
          if (!name.trim()) return;
          const c = await vault.createCollection(name, '', CATEGORY_COLORS[vault.collections.length % CATEGORY_COLORS.length]);
          if (c) { onChange([...value, c.id]); setName(''); }
        }}><Plus size={12} />Create</button>
      </div>
    </div>
  );
}

/** Global searchable prompt picker (used by AI Lab, history, etc.). */
export function PromptPickerModal() {
  const { promptPicker, closePromptPicker } = useUI();
  const vault = useVault();
  const [q, setQ] = useState('');
  const list = useMemo(() => vault.prompts.filter(p => norm(p.title + ' ' + p.description).includes(norm(q))).slice(0, 40), [vault.prompts, q]);
  return (
    <Modal open={!!promptPicker} onClose={() => { setQ(''); closePromptPicker(); }} title={promptPicker?.title ?? 'Choose a prompt'}>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input autoFocus className="pl-8" placeholder="Search your library…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {list.map(p => (
          <button key={p.id} className="menu-item flex-col items-start gap-0.5 border border-transparent hover:border-accent/30"
            onClick={() => { promptPicker?.onPick(p); setQ(''); closePromptPicker(); }}>
            <span className="font-medium">{p.title}</span>
            <span className="text-xs text-muted">{vault.categoryName(p.category_id)} · v{p.version} · used {p.usage_count}×</span>
          </button>
        ))}
        {!list.length && <p className="text-sm text-muted text-center py-6">No prompts match “{q}”.</p>}
      </div>
    </Modal>
  );
}
