import { Star, StarOff, Shapes, Tag, FolderOpen, Download, Trash2, X } from 'lucide-react';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { useConfirm, Button, Dropdown, MenuItem } from './ui';
import { download } from '../lib/utils';
import { toMarkdown, toPlainText } from '../lib/backup';

export function BulkBar({ ids, total, clear, selectAll }: { ids: string[]; total: number; clear: () => void; selectAll: () => void }) {
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  if (!ids.length) return null;
  const done = (msg: string) => toast.success(msg);
  const exportSel = (kind: 'json' | 'md' | 'txt') => {
    const prompts = vault.prompts.filter(p => ids.includes(p.id));
    if (kind === 'json') download('prompt-vault-selected.json', JSON.stringify(vault.exportBackup(ids), null, 2), 'application/json');
    else if (kind === 'md') download('prompt-vault-selected.md', toMarkdown(prompts, vault as any), 'text/markdown');
    else download('prompt-vault-selected.txt', toPlainText(prompts, vault as any));
    done(`Exported ${prompts.length} prompts.`);
  };
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 card shadow-pop bg-surface px-3 py-2 flex items-center gap-1.5 flex-wrap justify-center max-w-[94vw] animate-rise">
      <span className="text-xs font-semibold text-ink px-2 tabular-nums">{ids.length} selected</span>
      <button className="text-xs text-accent hover:underline px-1" onClick={selectAll}>All {total}</button>
      <div className="w-px h-5 bg-line mx-1" />
      <Button size="sm" variant="subtle" title="Add to favorites" onClick={async () => { await vault.bulkFavorite(ids, true); done('Added to favorites.'); }}><Star size={14} /></Button>
      <Button size="sm" variant="subtle" title="Remove from favorites" onClick={async () => { await vault.bulkFavorite(ids, false); done('Removed from favorites.'); }}><StarOff size={14} /></Button>
      <Dropdown align="left" trigger={<Button size="sm" variant="subtle"><Shapes size={14} />Category</Button>}>
        {close => (<>
          <MenuItem onClick={async () => { close(); await vault.bulkCategory(ids, null); done('Category cleared.'); }}>Uncategorized</MenuItem>
          {vault.categories.map(c => <MenuItem key={c.id} onClick={async () => { close(); await vault.bulkCategory(ids, c.id); done(`Assigned to ${c.name}.`); }}><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}</MenuItem>)}
        </>)}
      </Dropdown>
      <Dropdown align="left" trigger={<Button size="sm" variant="subtle"><Tag size={14} />Tag</Button>}>
        {close => vault.tags.length ? vault.tags.map(t => <MenuItem key={t.id} onClick={async () => { close(); await vault.bulkAddTag(ids, t.id); done(`Tag #${t.name} added.`); }}>#{t.name}</MenuItem>)
          : <div className="px-3 py-2 text-xs text-muted">No tags yet — create them in Categories → Tags.</div>}
      </Dropdown>
      <Dropdown align="left" trigger={<Button size="sm" variant="subtle"><FolderOpen size={14} />Collection</Button>}>
        {close => vault.collections.length ? vault.collections.map(c => <MenuItem key={c.id} onClick={async () => { close(); await vault.bulkAddCollection(ids, c.id); done(`Added to ${c.name}.`); }}><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.name}</MenuItem>)
          : <div className="px-3 py-2 text-xs text-muted">No collections yet.</div>}
      </Dropdown>
      <Dropdown trigger={<Button size="sm" variant="subtle"><Download size={14} />Export</Button>}>
        {close => (<>
          <MenuItem onClick={() => { close(); exportSel('json'); }}>JSON (with history)</MenuItem>
          <MenuItem onClick={() => { close(); exportSel('md'); }}>Markdown</MenuItem>
          <MenuItem onClick={() => { close(); exportSel('txt'); }}>Plain text</MenuItem>
        </>)}
      </Dropdown>
      <Button size="sm" variant="danger" onClick={async () => {
        if (await confirm({ title: `Move ${ids.length} prompts to Trash?`, message: 'You can restore them later from Trash.', confirmText: 'Move to Trash' })) {
          await vault.softDelete(ids); clear();
        }
      }}><Trash2 size={14} />Delete</Button>
      <Button size="sm" variant="subtle" onClick={clear} aria-label="Clear selection"><X size={14} /></Button>
    </div>
  );
}
