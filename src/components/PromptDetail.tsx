import { useEffect, useState } from 'react';
import { X, Copy, Pencil, Star, Pin, Trash2, Download, Eye, GitCompare, RotateCcw, Clock, BarChart3, FileText, Hash } from 'lucide-react';
import type { PromptVersion } from '../types';
import { PLATFORM_COLORS } from '../types';
import { useVault, useCopyPrompt, useCopyText } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { Badge, Button, Dropdown, IconBtn, MenuItem, Modal, useConfirm, cx } from './ui';
import { VersionCompareModal } from './VersionCompare';
import { diffLines, diffStats } from '../lib/diff';
import { fmtDateTime, timeAgo, download, wordCount } from '../lib/utils';
import { toMarkdown, toPlainText } from '../lib/backup';

function SnapshotModal({ v, onClose, onRestore }: { v: PromptVersion | null; onClose: () => void; onRestore: (v: PromptVersion) => void }) {
  const copyText = useCopyText();
  return (
    <Modal open={!!v} onClose={onClose} wide title={v ? `Version ${v.version_number} — ${v.title}` : ''}
      footer={v ? <>
        <Button variant="subtle" onClick={onClose}>Close</Button>
        <Button onClick={() => void copyText(v.content)}><Copy size={14} />Copy this version</Button>
        <Button variant="primary" onClick={() => onRestore(v)}><RotateCcw size={14} />Restore this version</Button>
      </> : null}>
      {v && (<>
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
          <Badge>{fmtDateTime(v.created_at)}</Badge><Badge>{v.change_note || 'Edited'}</Badge><Badge>{v.platform}</Badge>
        </div>
        {v.description && <p className="text-sm text-muted mb-3">{v.description}</p>}
        <pre className="card p-3 font-mono text-[12.5px] whitespace-pre-wrap break-words text-ink leading-relaxed max-h-[55vh] overflow-y-auto">{v.content}</pre>
      </>)}
    </Modal>
  );
}

export function PromptDetail() {
  const { detail, closeDetail, openEditor } = useUI();
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopyPrompt();
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const [compareOpen, setCompareOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PromptVersion | null>(null);
  const p = detail ? vault.getPrompt(detail.id) : undefined;

  useEffect(() => { if (detail) setTab(detail.tab); }, [detail]);
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, closeDetail]);
  useEffect(() => { if (detail && !p) closeDetail(); }, [detail, p, closeDetail]);
  if (!detail || !p) return null;

  const versions = vault.versionsFor(p.id);
  const cat = vault.categoryById(p.category_id);

  const restore = async (v: PromptVersion) => {
    const ok = await confirm({
      title: `Restore version ${v.version_number}?`,
      message: <>The current state (v{p.version}) is preserved in history. Restoring creates a new version <b>v{p.version + 1}</b> with the content of v{v.version_number}.</>,
      confirmText: 'Restore', danger: false,
    });
    if (ok) {
      const done = await vault.restoreVersion(p.id, v.id);
      if (done) { toast.success(`Restored v${v.version_number} as new v${p.version + 1}. History preserved.`); setSnapshot(null); }
    }
  };

  const summary = (v: PromptVersion, prev?: PromptVersion) => {
    if (!prev) return v.change_note || 'Created';
    const s = diffStats(diffLines(prev.content, v.content));
    const bits = [v.change_note].filter(Boolean);
    if (s.added || s.removed) bits.push(`+${s.added} −${s.removed} lines`);
    return bits.join(' · ') || 'Edited';
  };

  const exportAs = (kind: 'json' | 'md' | 'txt') => {
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    if (kind === 'json') download(`${slug}.json`, JSON.stringify(vault.exportBackup([p.id]), null, 2), 'application/json');
    else if (kind === 'md') download(`${slug}.md`, toMarkdown([p], vault as any), 'text/markdown');
    else download(`${slug}.txt`, toPlainText([p], vault as any));
  };

  return (
    <div className="fixed inset-0 z-[70] animate-fade" role="dialog" aria-modal="true" aria-label={`Prompt: ${p.title}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDetail} />
      <aside className="absolute inset-y-0 right-0 w-full sm:w-[600px] bg-surface border-l border-line shadow-pop flex flex-col animate-slidein">
        <div className="flex items-start gap-2 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold text-ink text-lg leading-tight break-words">{p.title}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge><span className="w-2 h-2 rounded-full" style={{ background: cat?.color ?? '#827D6A' }} />{cat?.name ?? 'Uncategorized'}</Badge>
              <Badge><span className="w-2 h-2 rounded-full" style={{ background: PLATFORM_COLORS[p.platform] ?? '#827D6A' }} />{p.platform}</Badge>
              <Badge>v{p.version}</Badge>
              {p.is_pinned && <Badge className="text-gold border-gold/30"><Pin size={10} />Pinned</Badge>}
              {p.is_favorite && <Badge className="text-gold border-gold/30"><Star size={10} />Favorite</Badge>}
            </div>
          </div>
          <IconBtn label="Close panel" onClick={closeDetail}><X size={18} /></IconBtn>
        </div>
        <div className="flex border-b border-line shrink-0 px-5 gap-4">
          {(['overview', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cx('py-2.5 text-sm font-medium border-b-2 -mb-px transition capitalize', tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}>
              {t === 'history' ? `History (${versions.length})` : 'Overview'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'overview' ? (<>
            {p.description && <p className="text-sm text-muted leading-relaxed">{p.description}</p>}
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <Button size="sm" variant="primary" onClick={() => void copy(p)}><Copy size={13} />Copy</Button>
              </div>
              <pre className="card p-4 pr-24 font-mono text-[13px] whitespace-pre-wrap break-words text-ink leading-relaxed bg-surface2/50">{p.content}</pre>
            </div>
            {p.notes && <div><h4 className="label">Notes</h4><p className="text-sm text-muted whitespace-pre-wrap">{p.notes}</p></div>}
            {p.tag_ids.length > 0 && <div><h4 className="label">Tags</h4><div className="flex flex-wrap gap-1.5">{p.tag_ids.map(id => { const t = vault.tags.find(x => x.id === id); return t ? <Badge key={id} className="text-accent">#{t.name}</Badge> : null; })}</div></div>}
            {p.collection_ids.length > 0 && <div><h4 className="label">Collections</h4><div className="flex flex-wrap gap-1.5">{p.collection_ids.map(id => { const c = vault.collections.find(x => x.id === id); return c ? <Badge key={id}><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}</Badge> : null; })}</div></div>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { icon: <BarChart3 size={13} />, label: 'Used', value: `${p.usage_count}× · last ${timeAgo(p.last_used_at)}` },
                { icon: <Clock size={13} />, label: 'Updated', value: fmtDateTime(p.updated_at) },
                { icon: <FileText size={13} />, label: 'Created', value: fmtDateTime(p.created_at) },
                { icon: <Hash size={13} />, label: 'Size', value: `${wordCount(p.content)} words · ${p.content.length} chars` },
              ].map(m => (
                <div key={m.label} className="card p-2.5 bg-surface2/40">
                  <div className="text-[10px] uppercase tracking-wide text-muted flex items-center gap-1">{m.icon}{m.label}</div>
                  <div className="text-xs text-ink mt-1">{m.value}</div>
                </div>
              ))}
            </div>
          </>) : (<>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">Every save creates a version. Restoring never deletes history.</p>
              <Button size="sm" onClick={() => setCompareOpen(true)} disabled={versions.length < 2}><GitCompare size={13} />Compare</Button>
            </div>
            <ol className="relative border-l border-line ml-2 space-y-3">
              {versions.map((v, i) => {
                const isCurrent = v.version_number === p.version;
                return (
                  <li key={v.id} className="ml-4 relative">
                    <span className={cx('absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-surface', isCurrent ? 'bg-accent' : 'bg-muted/50')} />
                    <div className="card p-3 hover:border-accent/30 transition">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cx('text-xs font-bold', isCurrent ? 'text-accent' : 'text-ink')}>v{v.version_number}</span>
                        {isCurrent && <Badge className="text-accent border-accent/30 bg-accent-soft">current</Badge>}
                        <span className="text-[11px] text-muted ml-auto" title={fmtDateTime(v.created_at)}>{timeAgo(v.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted mt-1">{summary(v, versions[i + 1])}</p>
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="subtle" onClick={() => setSnapshot(v)}><Eye size={12} />View</Button>
                        <Button size="sm" variant="subtle" onClick={() => setCompareOpen(true)} disabled={versions.length < 2}><GitCompare size={12} />Compare</Button>
                        {!isCurrent && <Button size="sm" variant="subtle" className="text-accent" onClick={() => void restore(v)}><RotateCcw size={12} />Restore</Button>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>)}
        </div>
        <div className="px-5 py-3 border-t border-line flex items-center gap-1.5 shrink-0 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => void copy(p)}><Copy size={13} />Copy prompt</Button>
          <Button size="sm" onClick={() => openEditor({ promptId: p.id })}><Pencil size={13} />Edit</Button>
          <IconBtn label={p.is_favorite ? 'Remove favorite' : 'Favorite'} onClick={() => vault.toggleFavorite(p.id)} className={cx(p.is_favorite && 'text-gold')}><Star size={16} fill={p.is_favorite ? 'currentColor' : 'none'} /></IconBtn>
          <IconBtn label={p.is_pinned ? 'Unpin' : 'Pin'} onClick={() => vault.togglePin(p.id)} className={cx(p.is_pinned && 'text-gold')}><Pin size={16} fill={p.is_pinned ? 'currentColor' : 'none'} /></IconBtn>
          <Dropdown trigger={<IconBtn label="Export"><Download size={16} /></IconBtn>}>
            {close => (<>
              <MenuItem onClick={() => { close(); exportAs('json'); }}>JSON (with history)</MenuItem>
              <MenuItem onClick={() => { close(); exportAs('md'); }}>Markdown</MenuItem>
              <MenuItem onClick={() => { close(); exportAs('txt'); }}>Plain text</MenuItem>
            </>)}
          </Dropdown>
          <div className="flex-1" />
          <Button variant="danger" size="sm" onClick={async () => {
            if (await confirm({ title: 'Move to Trash?', message: <>“{p.title}” can be restored later from Trash.</>, confirmText: 'Move to Trash' })) {
              await vault.softDelete([p.id]); closeDetail();
            }
          }}><Trash2 size={13} />Delete</Button>
        </div>
      </aside>
      <VersionCompareModal promptId={p.id} open={compareOpen} onClose={() => setCompareOpen(false)} />
      <SnapshotModal v={snapshot} onClose={() => setSnapshot(null)} onRestore={v => void restore(v)} />
    </div>
  );
}
