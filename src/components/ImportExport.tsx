import { useRef, useState } from 'react';
import { Upload, FileJson, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import type { DuplicateMode } from '../types';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { Button, Modal, cx } from './ui';
import { validateBackup, toMarkdown, toPlainText, type BackupData, type MergePlan } from '../lib/backup';
import { download } from '../lib/utils';

export function ExportMenu({ onExport }: { onExport: (kind: 'json' | 'md' | 'txt') => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => onExport('json')}><FileJson size={14} />JSON backup</Button>
      <Button onClick={() => onExport('md')}><Download size={14} />Markdown</Button>
      <Button onClick={() => onExport('txt')}><Download size={14} />Plain text</Button>
    </div>
  );
}

export function useExportLibrary() {
  const vault = useVault();
  const toast = useToast();
  return (kind: 'json' | 'md' | 'txt') => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'json') download(`prompt-vault-backup-${stamp}.json`, JSON.stringify(vault.exportBackup(), null, 2), 'application/json');
    else if (kind === 'md') download(`prompt-vault-${stamp}.md`, toMarkdown(vault.prompts, vault as any), 'text/markdown');
    else download(`prompt-vault-${stamp}.txt`, toPlainText(vault.prompts, vault as any));
    toast.success(`Library exported as ${kind.toUpperCase()}.`);
  };
}

type Stage = { step: 'pick' } | { step: 'error'; errors: string[] } | { step: 'preview'; data: BackupData; fileName: string } | { step: 'importing' };

export function ImportModal() {
  const { importOpen, setImportOpen } = useUI();
  const vault = useVault();
  const [stage, setStage] = useState<Stage>({ step: 'pick' });
  const [dup, setDup] = useState<DuplicateMode>('skip');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const plan: MergePlan | null = stage.step === 'preview' ? vault.planImport(stage.data, dup) : null;

  const close = () => { setImportOpen(false); setStage({ step: 'pick' }); setDup('skip'); };

  const readFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) { setStage({ step: 'error', errors: ['Only .json backup files are supported.'] }); return; }
    if (file.size > 25 * 1024 * 1024) { setStage({ step: 'error', errors: ['File is larger than 25 MB.'] }); return; }
    const text = await file.text();
    const result = validateBackup(text);
    if (!result.ok) setStage({ step: 'error', errors: result.errors });
    else setStage({ step: 'preview', data: result.data, fileName: file.name });
  };

  const doImport = async () => {
    if (!plan) return;
    setStage({ step: 'importing' });
    await vault.applyImport(plan);
    close();
  };

  return (
    <Modal open={importOpen} onClose={close} title="Import library" wide
      footer={stage.step === 'preview' ? <>
        <Button variant="subtle" onClick={() => setStage({ step: 'pick' })}>Choose another file</Button>
        <Button variant="primary" onClick={() => void doImport()}><Upload size={14} />Import {plan?.prompts.length} prompts</Button>
      </> : stage.step === 'importing' ? <Button loading disabled>Importing…</Button> : null}>
      {stage.step === 'pick' && (
        <div>
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void readFile(f); }}
            className={cx('border-2 border-dashed rounded-xl p-10 text-center transition cursor-pointer', drag ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40')}
            onClick={() => fileRef.current?.click()}>
            <Upload className="mx-auto text-accent mb-3" size={28} />
            <p className="text-sm font-medium text-ink">Drop your Prompt Vault JSON backup here</p>
            <p className="text-xs text-muted mt-1">or click to browse · validated before anything changes</p>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
          <p className="text-xs text-muted mt-3">Imports never overwrite existing prompts. Categories, tags and collections are matched by name; version history is preserved.</p>
        </div>
      )}
      {stage.step === 'error' && (
        <div className="card border-rose/40 bg-rose/10 p-4">
          <div className="flex items-center gap-2 text-rose font-medium text-sm mb-2"><AlertTriangle size={15} />This file could not be imported</div>
          <ul className="text-xs text-muted list-disc pl-5 space-y-1">{stage.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <Button size="sm" className="mt-3" onClick={() => setStage({ step: 'pick' })}>Try another file</Button>
        </div>
      )}
      {stage.step === 'preview' && plan && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-mint"><CheckCircle2 size={15} />Valid backup: <b className="text-ink">{stage.fileName}</b></div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {([['Prompts', plan.prompts.length], ['Categories', plan.categories.length], ['Tags', plan.tags.length], ['Collections', plan.collections.length], ['Versions', plan.versions.length]] as const).map(([label, n]) => (
              <div key={label} className="card p-3 text-center bg-surface2/40"><div className="text-lg font-display font-bold text-ink tabular-nums">{n}</div><div className="text-[10px] text-muted uppercase tracking-wide">{label}</div></div>
            ))}
          </div>
          <div>
            <h4 className="label">Duplicate handling ({plan.skipped} duplicate{plan.skipped === 1 ? '' : 's'} detected)</h4>
            <div className="space-y-2">
              {(['skip', 'copy'] as const).map(mode => (
                <label key={mode} className={cx('card p-3 flex items-start gap-2.5 cursor-pointer transition', dup === mode ? 'border-accent/60 bg-accent-soft' : 'hover:border-accent/30')}>
                  <input type="radio" name="dup" checked={dup === mode} onChange={() => setDup(mode)} className="mt-0.5 accent-[#28513F]" />
                  <span><span className="text-sm font-medium text-ink block">{mode === 'skip' ? 'Skip duplicates (recommended)' : 'Import duplicates as copies'}</span>
                    <span className="text-xs text-muted">{mode === 'skip' ? 'Prompts with the same title and content are not imported again.' : 'Duplicates are imported as separate prompts with new IDs.'}</span></span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted">Nothing in your current library will be modified or deleted.</p>
        </div>
      )}
      {stage.step === 'importing' && <div className="py-8 text-center text-sm text-muted">Importing and syncing…</div>}
    </Modal>
  );
}
