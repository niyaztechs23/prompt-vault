import { useEffect, useState } from 'react';
import { HardDrive, Cloud, AlertTriangle } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { Button, Modal } from './ui';
import { PromptEditor } from './PromptEditor';
import { PromptDetail } from './PromptDetail';
import { SearchPalette } from './SearchPalette';
import { ImportModal } from './ImportExport';
import { PromptPickerModal } from './pickers';
import { LocalAdapter } from '../services/localAdapter';
import { fmtDateTime } from '../lib/utils';

function ConflictModal() {
  const vault = useVault();
  const c = vault.conflict;
  return (
    <Modal open={!!c} onClose={() => void vault.resolveConflict('theirs')} title="Sync conflict detected"
      footer={<>
        <Button onClick={() => void vault.resolveConflict('theirs')}><Cloud size={14} />Use cloud version</Button>
        <Button variant="primary" onClick={() => void vault.resolveConflict('mine')}><HardDrive size={14} />Keep my changes</Button>
      </>}>
      {c && (<div className="space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted"><AlertTriangle size={16} className="text-gold shrink-0 mt-0.5" />
          “{c.local.title}” was changed on another device while you were editing. Choose which version to keep — the other remains in version history.</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3 bg-surface2/40"><div className="text-xs font-semibold text-accent mb-1">Your edit</div><div className="text-[11px] text-muted">v{c.local.version} · {fmtDateTime(c.local.updated_at)}</div><p className="text-xs text-ink mt-2 line-clamp-3 font-mono">{c.local.content.slice(0, 160)}</p></div>
          <div className="card p-3 bg-surface2/40"><div className="text-xs font-semibold text-sky mb-1">Cloud version</div><div className="text-[11px] text-muted">v{c.remote.version} · {fmtDateTime(c.remote.updated_at)}</div><p className="text-xs text-ink mt-2 line-clamp-3 font-mono">{c.remote.content.slice(0, 160)}</p></div>
        </div>
      </div>)}
    </Modal>
  );
}

function MergeLocalModal() {
  const auth = useAuth();
  const vault = useVault();
  const toast = useToast();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.user || !vault.ready || vault.mode !== 'cloud') return;
    const flag = `pv_merge_asked_${auth.user.id}`;
    if (localStorage.getItem(flag)) return;
    let alive = true;
    new LocalAdapter().load().then(snap => {
      const active = snap.prompts.filter(p => !p.deleted_at);
      if (alive && active.length > 0) { setCount(active.length); setOpen(true); }
      else localStorage.setItem(flag, '1');
    }).catch(() => localStorage.setItem(flag, '1'));
    return () => { alive = false; };
  }, [auth.user?.id, vault.ready, vault.mode]);

  const finish = () => { if (auth.user) localStorage.setItem(`pv_merge_asked_${auth.user.id}`, '1'); setOpen(false); };
  const merge = async () => {
    setBusy(true);
    try {
      const local = await new LocalAdapter().load();
      const { validateBackup } = await import('../lib/backup');
      const envelope = { app: 'prompt-vault', format_version: 1, exported_at: new Date().toISOString(), data: { ...local, prompts: local.prompts.filter(p => !p.deleted_at) } };
      const check = validateBackup(JSON.stringify(envelope));
      if (check.ok) await vault.applyImport(vault.planImport(check.data, 'skip'));
      else toast.error('Local data could not be validated for merge.');
    } finally { setBusy(false); finish(); }
  };

  return (
    <Modal open={open} onClose={finish} title="Import your local prompts?"
      footer={<>
        <Button variant="subtle" onClick={finish}>Keep local only</Button>
        <Button variant="primary" loading={busy} onClick={() => void merge()}>Merge into my account</Button>
      </>}>
      <p className="text-sm text-muted leading-relaxed">
        You have <b className="text-ink">{count} prompt{count === 1 ? '' : 's'}</b> stored locally in this browser.
        Merge them into your cloud account to sync across devices? Duplicates are skipped, nothing is overwritten,
        and your local copy is left untouched.
      </p>
    </Modal>
  );
}

export function GlobalModals() {
  return (<>
    <PromptEditor />
    <PromptDetail />
    <SearchPalette />
    <ImportModal />
    <PromptPickerModal />
    <ConflictModal />
    <MergeLocalModal />
  </>);
}
