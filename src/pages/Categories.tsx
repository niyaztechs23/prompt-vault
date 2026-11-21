import { useMemo, useState } from 'react';
import { Shapes, Tag, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { CATEGORY_COLORS } from '../types';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { Button, EmptyState, Field, Input, Modal, useConfirm, cx, Skeleton } from './_shared';
import { ColorDots } from '../components/pickers';
import { norm } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export function Categories() {
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const [tab, setTab] = useState<'categories' | 'tags'>('categories');
  const [catModal, setCatModal] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [tagModal, setTagModal] = useState<{ id?: string; name: string } | null>(null);
  const [tagQ, setTagQ] = useState('');
  const [err, setErr] = useState('');

  const counts = useMemo(() => {
    const cat = new Map<string, number>(), tag = new Map<string, number>();
    for (const p of vault.prompts) {
      if (p.category_id) cat.set(p.category_id, (cat.get(p.category_id) ?? 0) + 1);
      for (const t of p.tag_ids) tag.set(t, (tag.get(t) ?? 0) + 1);
    }
    return { cat, tag };
  }, [vault.prompts]);

  const saveCat = async () => {
    if (!catModal) return;
    if (catModal.name.trim().length < 2) { setErr('Name must be at least 2 characters.'); return; }
    if (catModal.id) { await vault.renameCategory(catModal.id, catModal.name); toast.success('Category renamed.'); }
    else { const c = await vault.createCategory(catModal.name, catModal.color); if (!c) return; toast.success(`Category “${c.name}” created.`); }
    setCatModal(null); setErr('');
  };
  const saveTag = async () => {
    if (!tagModal) return;
    const name = tagModal.name.trim().replace(/^#/, '');
    if (!name) { setErr('Tag name is required.'); return; }
    if (vault.tags.some(t => t.id !== tagModal.id && norm(t.name) === norm(name))) { setErr('That tag already exists.'); return; }
    if (tagModal.id) { await vault.renameTag(tagModal.id, name); toast.success('Tag renamed.'); }
    else { await vault.createTag(name); toast.success(`Tag #${name} created.`); }
    setTagModal(null); setErr('');
  };

  if (!vault.ready) return <Skeleton className="h-64" />;
  const tags = vault.tags.filter(t => norm(t.name).includes(norm(tagQ)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><Shapes size={20} className="text-accent" />Categories & Tags</h1>
          <p className="text-sm text-muted mt-0.5">The organization backbone of your vault.</p></div>
        <Button variant="primary" onClick={() => tab === 'categories' ? setCatModal({ name: '', color: CATEGORY_COLORS[vault.categories.length % CATEGORY_COLORS.length] }) : setTagModal({ name: '' })}>
          <Plus size={15} />{tab === 'categories' ? 'New Category' : 'New Tag'}
        </Button>
      </div>
      <div className="flex gap-4 border-b border-line">
        {(['categories', 'tags'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cx('py-2 text-sm font-medium border-b-2 -mb-px capitalize transition', tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink')}>
            {t} ({t === 'categories' ? vault.categories.length : vault.tags.length})
          </button>
        ))}
      </div>
      {tab === 'categories' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vault.categories.map((c, i) => (
            <div key={c.id} className="card p-4 flex items-center gap-3 hover:border-accent/40 transition animate-rise" style={{ animationDelay: `${i * 25}ms` }}>
              <button className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 hover:scale-105 transition" style={{ background: c.color + '22', color: c.color }}
                onClick={() => nav(`/prompts?cat=${c.id}`)} aria-label={`Browse ${c.name}`}><Shapes size={16} /></button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => nav(`/prompts?cat=${c.id}`)}>
                <div className="text-sm font-medium text-ink truncate">{c.name}</div>
                <div className="text-[11px] text-muted">{counts.cat.get(c.id) ?? 0} prompts</div>
              </div>
              <Button size="sm" variant="subtle" aria-label={`Rename ${c.name}`} onClick={() => { setErr(''); setCatModal({ id: c.id, name: c.name, color: c.color }); }}><Pencil size={13} /></Button>
              <Button size="sm" variant="subtle" aria-label={`Delete ${c.name}`} onClick={async () => {
                const n = counts.cat.get(c.id) ?? 0;
                if (await confirm({ title: `Delete “${c.name}”?`, message: n ? `${n} prompt${n > 1 ? 's' : ''} will be kept and moved to Uncategorized. Nothing is deleted.` : 'This category is empty.', confirmText: 'Delete category' })) {
                  await vault.deleteCategory(c.id); toast.success('Category deleted. Prompts were kept.');
                }
              }}><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
      ) : (<>
        <div className="relative max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input className="pl-8" placeholder="Search tags…" value={tagQ} onChange={e => setTagQ(e.target.value)} /></div>
        {tags.length ? (
          <div className="card divide-y divide-line">
            {tags.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface2/50 transition">
                <Tag size={14} className="text-accent" />
                <button className="text-sm font-medium text-ink flex-1 text-left hover:text-accent transition" onClick={() => nav(`/prompts?tag=${t.id}`)}>#{t.name}</button>
                <span className="text-[11px] text-muted tabular-nums">{counts.tag.get(t.id) ?? 0} prompts</span>
                <Button size="sm" variant="subtle" aria-label={`Rename tag ${t.name}`} onClick={() => { setErr(''); setTagModal({ id: t.id, name: t.name }); }}><Pencil size={13} /></Button>
                <Button size="sm" variant="subtle" aria-label={`Delete tag ${t.name}`} onClick={async () => {
                  if (await confirm({ title: `Delete tag #${t.name}?`, message: 'The tag is removed from all prompts. Prompts themselves are kept.', confirmText: 'Delete tag' })) {
                    await vault.deleteTag(t.id); toast.success('Tag deleted.');
                  }
                }}><Trash2 size={13} /></Button>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={<Tag size={22} />} title={tagQ ? 'No tags match' : 'No tags yet'} hint="Tags are also created inline while editing prompts."
          action={<Button variant="primary" onClick={() => setTagModal({ name: tagQ })}><Plus size={14} />Create tag</Button>} />}
      </>)}
      <Modal open={!!catModal} onClose={() => setCatModal(null)} title={catModal?.id ? 'Rename category' : 'New category'}
        footer={<><Button variant="subtle" onClick={() => setCatModal(null)}>Cancel</Button><Button variant="primary" onClick={() => void saveCat()}>{catModal?.id ? 'Save' : 'Create'}</Button></>}>
        {catModal && <div className="space-y-4">
          <Field label="Name *" error={err}><Input autoFocus value={catModal.name} onChange={e => { setCatModal({ ...catModal, name: e.target.value }); setErr(''); }} /></Field>
          <Field label="Color"><ColorDots value={catModal.color} onChange={color => setCatModal({ ...catModal, color })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!tagModal} onClose={() => setTagModal(null)} title={tagModal?.id ? 'Rename tag' : 'New tag'}
        footer={<><Button variant="subtle" onClick={() => setTagModal(null)}>Cancel</Button><Button variant="primary" onClick={() => void saveTag()}>{tagModal?.id ? 'Save' : 'Create'}</Button></>}>
        {tagModal && <Field label="Tag name *" error={err}><Input autoFocus value={tagModal.name} onChange={e => { setTagModal({ ...tagModal, name: e.target.value }); setErr(''); }} placeholder="e.g. react" /></Field>}
      </Modal>
    </div>
  );
}
