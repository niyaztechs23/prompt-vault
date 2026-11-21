import { useState } from 'react';
import { Copy, Star, Pin, MoreHorizontal, Pencil, Trash2, FolderOpen, Download, Clock, BarChart3, CheckSquare, Square } from 'lucide-react';
import type { Prompt } from '../types';
import { PLATFORM_COLORS } from '../types';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { cx, IconBtn, Dropdown, MenuItem, Badge, Modal, Button, useConfirm } from './ui';
import { CollectionChecklist } from './pickers';
import { splitHighlight } from '../lib/search';
import { timeAgo, download } from '../lib/utils';
import { toMarkdown, toPlainText } from '../lib/backup';

export function Highlight({ text, q }: { text: string; q: string }) {
  return <>{splitHighlight(text, q).map((p, i) => p.hit ? <mark key={i} className="bg-gold/30 text-ink rounded-sm px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>)}</>;
}

export function PromptCard({ p, q = '', snippet, view = 'grid', selected, selectionMode, onToggleSelect, index = 0, onRemoveFromCollection }: {
  p: Prompt; q?: string; snippet?: string | null; view?: 'grid' | 'list';
  selected?: boolean; selectionMode?: boolean; onToggleSelect?: (id: string) => void; index?: number;
  onRemoveFromCollection?: (id: string) => void;
}) {
  const vault = useVault();
  const ui = useUI();
  const copy = useCopyPrompt();
  const confirm = useConfirm();
  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState<string[]>(p.collection_ids);
  const cat = vault.categoryById(p.category_id);
  const tags = p.tag_ids.map(id => vault.tags.find(t => t.id === id)).filter(Boolean).slice(0, 3);

  const del = async () => {
    if (await confirm({ title: 'Move to Trash?', message: <>“{p.title}” will be moved to Trash. You can restore it any time.</>, confirmText: 'Move to Trash' }))
      void vault.softDelete([p.id]);
  };
  const exportAs = (kind: 'json' | 'md' | 'txt') => {
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    if (kind === 'json') download(`${slug}.json`, JSON.stringify(vault.exportBackup([p.id]), null, 2), 'application/json');
    else if (kind === 'md') download(`${slug}.md`, toMarkdown([p], vault as any), 'text/markdown');
    else download(`${slug}.txt`, toPlainText([p], vault as any));
  };

  const checkbox = (
    <button aria-label={selected ? 'Deselect prompt' : 'Select prompt'} onClick={e => { e.stopPropagation(); onToggleSelect?.(p.id); }}
      className={cx('text-accent transition', selectionMode || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
      {selected ? <CheckSquare size={16} /> : <Square size={16} className="text-muted" />}
    </button>
  );

  const actions = (
    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
      <IconBtn label={p.is_favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => vault.toggleFavorite(p.id)}
        className={cx(p.is_favorite && 'text-gold')}>
        <Star size={15} fill={p.is_favorite ? 'currentColor' : 'none'} />
      </IconBtn>
      <IconBtn label={p.is_pinned ? 'Unpin' : 'Pin prompt'} onClick={() => vault.togglePin(p.id)} className={cx(p.is_pinned && 'text-gold')}>
        <Pin size={15} fill={p.is_pinned ? 'currentColor' : 'none'} />
      </IconBtn>
      <Dropdown trigger={<IconBtn label="More actions"><MoreHorizontal size={15} /></IconBtn>}>
        {close => (<>
          <MenuItem icon={<Pencil size={14} />} onClick={() => { close(); ui.openEditor({ promptId: p.id }); }}>Edit</MenuItem>
          <MenuItem icon={<FolderOpen size={14} />} onClick={() => { close(); setCols(p.collection_ids); setColsOpen(true); }}>Collections…</MenuItem>
          {onRemoveFromCollection && <MenuItem icon={<FolderOpen size={14} />} onClick={() => { close(); onRemoveFromCollection(p.id); }}>Remove from collection</MenuItem>}
          <div className="border-t border-line my-1" />
          <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportAs('json'); }}>Export JSON</MenuItem>
          <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportAs('md'); }}>Export Markdown</MenuItem>
          <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportAs('txt'); }}>Export Text</MenuItem>
          <div className="border-t border-line my-1" />
          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { close(); void del(); }}>Move to Trash</MenuItem>
        </>)}
      </Dropdown>
    </div>
  );

  const meta = (
    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted">
      <Badge><span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color ?? '#827D6A' }} />{cat?.name ?? 'Uncategorized'}</Badge>
      <Badge><span className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLORS[p.platform] ?? '#827D6A' }} />{p.platform}</Badge>
      {tags.map(t => <Badge key={t!.id} className="text-accent/80">#{t!.name}</Badge>)}
      {p.tag_ids.length > 3 && <Badge>+{p.tag_ids.length - 3}</Badge>}
    </div>
  );

  const stats = (
    <div className="flex items-center gap-3 text-[11px] text-muted tabular-nums">
      <span className="flex items-center gap-1" title={`Used ${p.usage_count} times · last ${timeAgo(p.last_used_at)}`}><BarChart3 size={12} />{p.usage_count}×</span>
      <span className="flex items-center gap-1" title={`Updated ${timeAgo(p.updated_at)}`}><Clock size={12} />{timeAgo(p.updated_at)}</span>
      <span title={`Version ${p.version}`}>v{p.version}</span>
    </div>
  );

  return (
    <>
      <article onClick={() => selectionMode ? onToggleSelect?.(p.id) : ui.openDetail(p.id)}
        className={cx('card group cursor-pointer transition-all hover:border-accent/40 hover:shadow-card hover:-translate-y-0.5 animate-rise',
          selected && 'border-accent/60 ring-2 ring-accent/20', view === 'grid' ? 'p-4 flex flex-col gap-2.5' : 'px-4 py-3 flex items-center gap-3')}
        style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
        {view === 'grid' ? (<>
          <div className="flex items-start gap-2">
            {onToggleSelect && checkbox}
            <h3 className="font-semibold text-[14px] text-ink leading-snug line-clamp-1 flex-1"><Highlight text={p.title} q={q} /></h3>
            {actions}
          </div>
          {p.description && <p className="text-xs text-muted line-clamp-2 -mt-1"><Highlight text={p.description} q={q} /></p>}
          <p className="font-mono text-[11.5px] text-muted/90 bg-surface2/60 border border-line rounded-lg p-2.5 line-clamp-3 whitespace-pre-wrap break-words leading-relaxed">
            <Highlight text={snippet || p.content.slice(0, 220)} q={q} />
          </p>
          {meta}
          <div className="flex items-center justify-between mt-auto pt-1 border-t border-line/60">
            {stats}
            <button onClick={e => { e.stopPropagation(); void copy(p); }}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover px-2 py-1 rounded-md hover:bg-accent-soft transition">
              <Copy size={13} />Copy
            </button>
          </div>
        </>) : (<>
          {onToggleSelect && checkbox}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {p.is_pinned && <Pin size={12} className="text-gold shrink-0" fill="currentColor" />}
              {p.is_favorite && <Star size={12} className="text-gold shrink-0" fill="currentColor" />}
              <h3 className="font-semibold text-[13.5px] text-ink truncate"><Highlight text={p.title} q={q} /></h3>
            </div>
            <p className="text-[11.5px] text-muted truncate font-mono mt-0.5"><Highlight text={snippet || p.description || p.content.slice(0, 140)} q={q} /></p>
          </div>
          <div className="hidden md:block">{meta}</div>
          {stats}
          <button onClick={e => { e.stopPropagation(); void copy(p); }} className="p-1.5 rounded-md text-accent hover:bg-accent-soft transition" aria-label="Copy prompt"><Copy size={14} /></button>
          {actions}
        </>)}
      </article>
      <Modal open={colsOpen} onClose={() => setColsOpen(false)} title={`Collections — ${p.title}`}
        footer={<><Button variant="subtle" onClick={() => setColsOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={async () => { await vault.setPromptCollections(p.id, cols); setColsOpen(false); }}>Save</Button></>}>
        <CollectionChecklist value={cols} onChange={setCols} />
      </Modal>
    </>
  );
}
