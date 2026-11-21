import { useMemo, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { useVault } from '../store/vault';
import { Badge, Modal, Select, cx } from './ui';
import { diffLines, diffStats } from '../lib/diff';
import { changedFields } from '../lib/versions';

export function DiffView({ a, b }: { a: string; b: string }) {
  const rows = useMemo(() => diffLines(a, b), [a, b]);
  const stats = diffStats(rows);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs">
        <Badge className="text-mint border-mint/30 bg-mint/10">+{stats.added} added</Badge>
        <Badge className="text-rose border-rose/30 bg-rose/10">−{stats.removed} removed</Badge>
        <span className="text-muted ml-auto flex items-center gap-2"><span className="w-2 h-2 rounded-sm bg-mint/40" />added<span className="w-2 h-2 rounded-sm bg-rose/40" />removed</span>
      </div>
      <div className="card overflow-hidden font-mono text-[12px] leading-relaxed max-h-[50vh] overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className={cx('px-3 py-0.5 whitespace-pre-wrap break-words flex gap-2',
            r.type === 'add' && 'bg-mint/10 text-mint', r.type === 'del' && 'bg-rose/10 text-rose', r.type === 'same' && 'text-muted')}>
            <span className="select-none w-3 shrink-0">{r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}</span>
            <span className="flex-1">{r.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareModal({ open, onClose, a, b, aLabel, bLabel }: { open: boolean; onClose: () => void; a: string; b: string; aLabel: string; bLabel: string }) {
  return (
    <Modal open={open} onClose={onClose} full title={<span className="flex items-center gap-2"><GitCompare size={15} className="text-accent" />{aLabel} → {bLabel}</span>}>
      <DiffView a={a} b={b} />
    </Modal>
  );
}

export function VersionCompareModal({ promptId, open, onClose }: { promptId: string; open: boolean; onClose: () => void }) {
  const vault = useVault();
  const versions = vault.versionsFor(promptId);
  const [aId, setAId] = useState<string>('');
  const [bId, setBId] = useState<string>('');
  const a = versions.find(v => v.id === aId) ?? versions[1] ?? versions[0];
  const b = versions.find(v => v.id === bId) ?? versions[0];
  const fields = a && b ? changedFields(a, b) : [];
  if (!versions.length) return null;
  return (
    <Modal open={open} onClose={onClose} full title={<span className="flex items-center gap-2"><GitCompare size={15} className="text-accent" />Compare versions</span>}>
      {versions.length < 2 ? (
        <p className="text-sm text-muted py-6 text-center">Only one version exists so far. Edit this prompt to create history you can compare.</p>
      ) : (<>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="label">Base version</label>
            <Select value={a?.id} onChange={e => setAId(e.target.value)}>
              {versions.map(v => <option key={v.id} value={v.id}>v{v.version_number} — {v.change_note || 'Edited'}</option>)}
            </Select></div>
          <div><label className="label">Compared version</label>
            <Select value={b?.id} onChange={e => setBId(e.target.value)}>
              {versions.map(v => <option key={v.id} value={v.id}>v{v.version_number} — {v.change_note || 'Edited'}</option>)}
            </Select></div>
        </div>
        {fields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs text-muted">Also changed:</span>
            {fields.filter(f => f !== 'content').map(f => <Badge key={f} className="text-gold border-gold/30">{f}</Badge>)}
            {fields.length === 1 && fields[0] === 'content' && <span className="text-xs text-muted">only content</span>}
          </div>
        )}
        {a && b && <DiffView a={a.content} b={b.content} />}
      </>)}
    </Modal>
  );
}
