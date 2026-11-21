import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FolderOpen, Plus, Pencil, Trash2, ArrowLeft, CheckSquare, Square, Search } from 'lucide-react';
import { CATEGORY_COLORS } from '../types';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { Button, EmptyState, Field, Input, Modal, Textarea, useConfirm, Skeleton, IconBtn } from './_shared';
import { ColorDots } from '../components/pickers';
import { PromptCard } from '../components/PromptCard';
import { norm } from '../lib/utils';

function CollectionForm({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: { id: string; name: string; description: string; color: string } }) {
  const vault = useVault();
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);
  const [err, setErr] = useState('');
  const save = async () => {
    if (name.trim().length < 2) { setErr('Name must be at least 2 characters.'); return; }
    if (existing) { await vault.updateCollection(existing.id, { name: name.trim(), description: desc.trim(), color }); toast.success('Collection updated.'); }
    else { const c = await vault.createCollection(name, desc, color); if (!c) return; toast.success(`Collection “${c.name}” created.`); }
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit collection' : 'New collection'}
      footer={<><Button variant="subtle" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save()}>{existing ? 'Save' : 'Create'}</Button></>}>
      <div className="space-y-4">
        <Field label="Name *" error={err}><Input autoFocus value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="e.g. Coding Assistant" /></Field>
        <Field label="Description"><Textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What belongs in this collection?" /></Field>
        <Field label="Color"><ColorDots value={color} onChange={setColor} /></Field>
      </div>
    </Modal>
  );
}

function AddPromptsModal({ open, onClose, collectionId }: { open: boolean; onClose: () => void; collectionId: string }) {
  const vault = useVault();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const list = useMemo(() => vault.prompts.filter(p => !p.collection_ids.includes(collectionId) && norm(p.title).includes(norm(q))), [vault.prompts, collectionId, q]);
  return (
    <Modal open={open} onClose={onClose} title="Add prompts to collection"
      footer={<><Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!sel.size} onClick={async () => { await vault.bulkAddCollection([...sel], collectionId); toast.success(`${sel.size} prompt${sel.size > 1 ? 's' : ''} added.`); setSel(new Set()); onClose(); }}>Add {sel.size || ''} prompts</Button></>}>
      <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {list.map(p => (
          <button key={p.id} className="menu-item" onClick={() => setSel(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}>
            {sel.has(p.id) ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} className="text-muted" />}
            <span className="truncate">{p.title}</span>
          </button>
        ))}
        {!list.length && <p className="text-sm text-muted text-center py-6">All matching prompts are already in this collection.</p>}
      </div>
    </Modal>
  );
}

export function Collections() {
  const vault = useVault();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  if (!vault.ready) return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><FolderOpen size={20} className="text-accent" />Collections</h1>
          <p className="text-sm text-muted mt-0.5">Group prompts by project or workflow. A prompt can belong to many collections.</p></div>
        <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} />New Collection</Button>
      </div>
      {vault.collections.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vault.collections.map((c, i) => {
            const count = vault.prompts.filter(p => p.collection_ids.includes(c.id)).length;
            return (
              <div key={c.id} className="card overflow-hidden hover:border-accent/40 hover:-translate-y-0.5 transition-all animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="h-1" style={{ background: c.color }} />
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <Link to={`/collections/${c.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink truncate">{c.name}</h3>
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{c.description || 'No description'}</p>
                    </Link>
                    <IconBtn label="Edit collection" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil size={14} /></IconBtn>
                    <IconBtn label="Delete collection" onClick={async () => {
                      if (await confirm({ title: `Delete “${c.name}”?`, message: 'The collection is removed. Its prompts are kept in your library.', confirmText: 'Delete collection' }))
                        await vault.deleteCollection(c.id);
                    }}><Trash2 size={14} /></IconBtn>
                  </div>
                  <Link to={`/collections/${c.id}`} className="chip mt-3 hover:border-accent/40">{count} prompt{count === 1 ? '' : 's'} →</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<FolderOpen size={22} />} title="No collections yet"
          hint="Try “College Projects”, “Daily AI Prompts”, “Coding Assistant” or “Research Prompts”."
          action={<Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={14} />Create your first collection</Button>} />
      )}
      {formOpen && <CollectionForm open onClose={() => setFormOpen(false)} existing={editing ?? undefined} />}
    </div>
  );
}

export function CollectionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const vault = useVault();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const c = vault.collections.find(x => x.id === id);
  const prompts = useMemo(() => vault.prompts.filter(p => c && p.collection_ids.includes(c.id)), [vault.prompts, c]);
  if (!vault.ready) return <Skeleton className="h-64" />;
  if (!c) return <EmptyState icon={<FolderOpen size={22} />} title="Collection not found" action={<Button onClick={() => nav('/collections')}>Back to collections</Button>} />;
  return (
    <div className="space-y-4">
      <Link to="/collections" className="text-xs text-muted hover:text-accent flex items-center gap-1"><ArrowLeft size={12} />Collections</Link>
      <div className="card p-5 flex items-start gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.color + '22', color: c.color }}><FolderOpen size={18} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="font-display text-xl font-bold text-ink">{c.name}</h1>
          <p className="text-sm text-muted">{c.description || 'No description'} · {prompts.length} prompts</p>
        </div>
        <Button onClick={() => setEditOpen(true)}><Pencil size={14} />Edit</Button>
        <Button variant="primary" onClick={() => setAddOpen(true)}><Plus size={14} />Add prompts</Button>
      </div>
      {prompts.length ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {prompts.map((p, i) => (
            <PromptCard key={p.id} p={p} index={i} onRemoveFromCollection={async pid => {
              await vault.setPromptCollections(pid, p.collection_ids.filter(x => x !== c.id));
              toast.success('Removed from collection.');
            }} />
          ))}
        </div>
      ) : <EmptyState icon={<FolderOpen size={22} />} title="This collection is empty" hint="Add existing prompts from your library."
        action={<Button variant="primary" onClick={() => setAddOpen(true)}><Plus size={14} />Add prompts</Button>} />}
      <AddPromptsModal open={addOpen} onClose={() => setAddOpen(false)} collectionId={c.id} />
      {editOpen && <CollectionForm open onClose={() => setEditOpen(false)} existing={c} />}
    </div>
  );
}
