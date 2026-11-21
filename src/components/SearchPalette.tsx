import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, CornerDownLeft, Copy } from 'lucide-react';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { searchPrompts } from '../lib/search';
import { Kbd, cx } from './ui';
import { Highlight } from './PromptCard';

export function SearchPalette() {
  const { palette, setPalette, openDetail, openEditor } = useUI();
  const vault = useVault();
  const copy = useCopyPrompt();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchPrompts(vault.prompts, q, {
    categoryName: vault.categoryName, tagNames: ids => ids.map(id => vault.tags.find(t => t.id === id)?.name ?? ''),
  }).slice(0, 8), [vault.prompts, q, vault.tags, vault.categories]);

  useEffect(() => { if (palette) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [palette]);
  useEffect(() => setActive(0), [q]);
  if (!palette) return null;

  const open = (id: string) => { setPalette(false); openDetail(id); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setPalette(false);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && hits[active]) open(hits[active].prompt.id);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[12vh] px-4 animate-fade" role="dialog" aria-modal="true" aria-label="Global search">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPalette(false)} />
      <div className="relative card shadow-pop w-full max-w-xl overflow-hidden animate-rise">
        <div className="flex items-center gap-2.5 px-4 border-b border-line">
          <Search size={16} className="text-accent" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            className="flex-1 bg-transparent outline-none py-3.5 text-sm text-ink placeholder:text-muted/70"
            placeholder="Search titles, descriptions, content, categories, tags…" aria-label="Search" />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {hits.map((h, i) => (
            <div key={h.prompt.id} onMouseEnter={() => setActive(i)}
              className={cx('flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition', i === active ? 'bg-accent-soft' : 'hover:bg-surface2')}
              onClick={() => open(h.prompt.id)}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate"><Highlight text={h.prompt.title} q={q} /></div>
                <div className="text-[11px] text-muted truncate">
                  {vault.categoryName(h.prompt.category_id)} · {h.snippet ? <Highlight text={h.snippet} q={q} /> : h.prompt.description || h.prompt.content.slice(0, 80)}
                </div>
              </div>
              <button aria-label="Copy prompt" className="p-1.5 rounded text-muted hover:text-accent" onClick={e => { e.stopPropagation(); void copy(h.prompt); }}><Copy size={14} /></button>
              {i === active && <CornerDownLeft size={13} className="text-muted" />}
            </div>
          ))}
          {!hits.length && q && <p className="text-sm text-muted text-center py-6">No prompts match “{q}”.</p>}
          {!q && <p className="text-xs text-muted text-center py-5">Type to search your entire library instantly.</p>}
          {q && (
            <button className="menu-item text-accent mt-1 border-t border-line rounded-none pt-2.5"
              onClick={() => { setPalette(false); openEditor({ prefill: { title: q } }); }}>
              <Plus size={14} />Create new prompt titled “{q}”
            </button>
          )}
        </div>
        <div className="px-4 py-2 border-t border-line flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1"><Kbd>↑↓</Kbd>navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd>open</span>
          <span className="ml-auto">{vault.prompts.length} prompts indexed</span>
        </div>
      </div>
    </div>
  );
}
