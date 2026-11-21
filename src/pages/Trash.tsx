import { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { Button, EmptyState, useConfirm, Badge, Skeleton } from './_shared';
import { fmtDateTime, timeAgo } from '../lib/utils';

export function Trash() {
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const purge = async (ids: string[], title: string) => {
    if (await confirm({ title: `Permanently delete ${title}?`, message: 'This removes the prompt and its entire version history. This cannot be undone.', confirmText: 'Delete forever' })) {
      setBusy(ids[0] ?? 'all');
      await vault.permanentDelete(ids);
      setBusy(null);
      toast.success('Permanently deleted.');
    }
  };

  if (!vault.ready) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><Trash2 size={20} className="text-rose" />Trash</h1>
          <p className="text-sm text-muted mt-0.5">Deleted prompts stay here until you restore or permanently remove them.</p></div>
        {vault.trashed.length > 0 && (
          <Button variant="danger" loading={busy === 'all'} onClick={() => void purge(vault.trashed.map(p => p.id), `all ${vault.trashed.length} prompts`)}>
            <Trash2 size={14} />Empty Trash
          </Button>
        )}
      </div>
      {vault.trashed.length ? (
        <div className="card divide-y divide-line">
          {vault.trashed.map(p => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-surface2/40 transition">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium text-ink truncate">{p.title}</div>
                <div className="text-[11px] text-muted flex items-center gap-2">
                  <Badge>{vault.categoryName(p.category_id)}</Badge>
                  <span title={fmtDateTime(p.deleted_at)}>deleted {timeAgo(p.deleted_at)}</span>
                  <span>· v{p.version} · used {p.usage_count}×</span>
                </div>
              </div>
              <Button size="sm" onClick={async () => { await vault.restorePrompts([p.id]); toast.success(`“${p.title}” restored.`); }}><RotateCcw size={13} />Restore</Button>
              <Button size="sm" variant="danger" loading={busy === p.id} onClick={() => void purge([p.id], `“${p.title}”`)}><X size={13} />Delete forever</Button>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={<Trash2 size={22} />} title="Trash is empty" hint="Deleted prompts land here first, so nothing is ever lost by accident." />}
    </div>
  );
}
