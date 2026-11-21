import { useMemo, useState } from 'react';
import { History as HistoryIcon, Eye, GitCompare, RotateCcw, Copy, BarChart3 } from 'lucide-react';
import type { PromptVersion } from '../types';
import { useVault, useCopyPrompt } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { Button, EmptyState, Modal, Select, useConfirm, cx, Badge, Skeleton } from './_shared';
import { VersionCompareModal } from '../components/VersionCompare';
import { fmtDateTime, timeAgo } from '../lib/utils';

export function History() {
  const vault = useVault();
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopyPrompt();
  const [tab, setTab] = useState<'versions' | 'usage'>('versions');
  const [promptFilter, setPromptFilter] = useState('');
  const [compareFor, setCompareFor] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PromptVersion | null>(null);

  const versions = useMemo(() => vault.versions
    .filter(v => (!promptFilter || v.prompt_id === promptFilter) && vault.getPrompt(v.prompt_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150), [vault.versions, promptFilter, vault.prompts]);
  const usage = useMemo(() => vault.usage.filter(u => !promptFilter || u.prompt_id === promptFilter).slice(0, 150), [vault.usage, promptFilter]);

  const restore = async (v: PromptVersion) => {
    const p = vault.getPrompt(v.prompt_id);
    if (!p) return;
    if (await confirm({ title: `Restore v${v.version_number} of “${p.title}”?`, danger: false, confirmText: 'Restore',
      message: <>Creates a new version v{p.version + 1} with this content. All current history is preserved.</> })) {
      const ok = await vault.restoreVersion(p.id, v.id);
      if (ok) toast.success(`Restored v${v.version_number} as v${p.version + 1}.`);
    }
  };

  if (!vault.ready) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><HistoryIcon size={20} className="text-accent" />Prompt History</h1>
          <p className="text-sm text-muted mt-0.5">Every version and every copy, across your whole library.</p></div>
        <Select className="w-56" value={promptFilter} onChange={e => setPromptFilter(e.target.value)} aria-label="Filter by prompt">
          <option value="">All prompts</option>
          {vault.prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
      </div>
      <div className="flex gap-4 border-b border-line">
        {(['versions', 'usage'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cx('py-2 text-sm font-medium border-b-2 -mb-px capitalize transition', tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}>
            {t === 'versions' ? `Versions (${versions.length})` : `Usage (${usage.length})`}
          </button>
        ))}
      </div>
      {tab === 'versions' ? (
        versions.length ? (
          <div className="card divide-y divide-line">
            {versions.map(v => {
              const p = vault.getPrompt(v.prompt_id)!;
              const isCurrent = v.version_number === p.version;
              return (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-surface2/40 transition">
                  <Badge className={cx(isCurrent && 'text-accent border-accent/30')}>v{v.version_number}</Badge>
                  <div className="flex-1 min-w-[180px] cursor-pointer" onClick={() => ui.openDetail(p.id, 'history')}>
                    <div className="text-sm font-medium text-ink truncate">{v.title}</div>
                    <div className="text-[11px] text-muted">{v.change_note || 'Edited'} · <span title={fmtDateTime(v.created_at)}>{timeAgo(v.created_at)}</span></div>
                  </div>
                  <Button size="sm" variant="subtle" onClick={() => setSnapshot(v)}><Eye size={12} />View</Button>
                  <Button size="sm" variant="subtle" onClick={() => setCompareFor(p.id)}><GitCompare size={12} />Compare</Button>
                  {!isCurrent && <Button size="sm" variant="subtle" className="text-accent" onClick={() => void restore(v)}><RotateCcw size={12} />Restore</Button>}
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<HistoryIcon size={22} />} title="No version history yet" hint="Edit any prompt — each save records a version you can compare and restore." />
      ) : (
        usage.length ? (
          <div className="card divide-y divide-line">
            {usage.map(u => {
              const p = vault.getPrompt(u.prompt_id);
              if (!p) return null;
              return (
                <div key={u.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface2/40 transition">
                  <BarChart3 size={14} className="text-mint shrink-0" />
                  <button className="text-sm text-ink flex-1 text-left truncate hover:text-accent transition" onClick={() => ui.openDetail(p.id)}>{p.title}</button>
                  <Badge className="text-mint border-mint/30">copied</Badge>
                  <span className="text-[11px] text-muted tabular-nums" title={fmtDateTime(u.used_at)}>{timeAgo(u.used_at)}</span>
                  <Button size="sm" variant="subtle" aria-label="Copy again" onClick={() => void copy(p)}><Copy size={12} /></Button>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<BarChart3 size={22} />} title="No usage recorded yet" hint="Usage is tracked when you copy a prompt — never when you just open it." />
      )}
      {compareFor && <VersionCompareModal promptId={compareFor} open onClose={() => setCompareFor(null)} />}
      <Modal open={!!snapshot} onClose={() => setSnapshot(null)} wide title={snapshot ? `v${snapshot.version_number} — ${snapshot.title}` : ''}
        footer={snapshot ? <>
          <Button variant="subtle" onClick={() => setSnapshot(null)}>Close</Button>
          <Button variant="primary" onClick={() => { void restore(snapshot); setSnapshot(null); }}><RotateCcw size={13} />Restore this version</Button>
        </> : null}>
        {snapshot && (<>
          <div className="flex gap-1.5 mb-3"><Badge>{fmtDateTime(snapshot.created_at)}</Badge><Badge>{snapshot.change_note || 'Edited'}</Badge></div>
          <pre className="card p-3 font-mono text-[12.5px] whitespace-pre-wrap break-words text-ink max-h-[55vh] overflow-y-auto">{snapshot.content}</pre>
        </>)}
      </Modal>
    </div>
  );
}
