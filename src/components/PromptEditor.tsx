import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, Pin, Save, AlertTriangle } from 'lucide-react';
import type { NewPromptInput } from '../types';
import { PLATFORMS } from '../types';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { Button, Field, Input, Modal, Select, Textarea, Toggle, useConfirm, cx } from './ui';
import { CollectionChecklist, TagPicker } from './pickers';
import { timeAgo, wordCount } from '../lib/utils';

interface FormState {
  title: string; content: string; description: string; category_id: string; platform: string;
  notes: string; is_favorite: boolean; is_pinned: boolean; tag_ids: string[]; collection_ids: string[]; changeNote: string;
}

export function PromptEditor() {
  const { editor, closeEditor } = useUI();
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  const existing = editor.promptId ? vault.getPrompt(editor.promptId) : undefined;
  const draftKey = `pv_draft_${editor.promptId ?? 'new'}`;

  const initialForm = useCallback((): FormState => ({
    title: existing?.title ?? editor.prefill?.title ?? '',
    content: existing?.content ?? editor.prefill?.content ?? '',
    description: existing?.description ?? editor.prefill?.description ?? '',
    category_id: existing?.category_id ?? editor.prefill?.category_id ?? vault.settings.default_category_id ?? '',
    platform: existing?.platform ?? editor.prefill?.platform ?? 'Any',
    notes: existing?.notes ?? editor.prefill?.notes ?? '',
    is_favorite: existing?.is_favorite ?? editor.prefill?.is_favorite ?? false,
    is_pinned: existing?.is_pinned ?? editor.prefill?.is_pinned ?? false,
    tag_ids: existing?.tag_ids ?? editor.prefill?.tag_ids ?? [],
    collection_ids: existing?.collection_ids ?? editor.prefill?.collection_ids ?? [],
    changeNote: '',
  }), [existing?.id, editor.prefill, vault.settings.default_category_id]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'draft' | 'saved'>('idle');
  const [draft, setDraft] = useState<{ data: FormState; savedAt: string } | null>(null);
  const formRef = useRef(form); formRef.current = form;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;

  useEffect(() => {
    if (!editor.open) return;
    const base = initialForm();
    setForm(base); setErrors({}); setDirty(false); setSaveState('idle'); setDraft(null);
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: FormState; savedAt: string; baseUpdatedAt?: string };
        const newer = !existing || parsed.savedAt > existing.updated_at;
        if (newer && JSON.stringify(parsed.data) !== JSON.stringify(base)) setDraft(parsed);
        else localStorage.removeItem(draftKey);
      }
    } catch { localStorage.removeItem(draftKey); }
  }, [editor.open, editor.promptId]);

  const set = (patch: Partial<FormState>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); setSaveState('idle'); };

  useEffect(() => {
    if (!editor.open || !dirty || !vault.settings.autosave) return;
    const t = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ data: formRef.current, savedAt: new Date().toISOString(), baseUpdatedAt: existing?.updated_at }));
      setSaveState('draft');
    }, 800);
    return () => clearTimeout(t);
  }, [form, dirty, editor.open, vault.settings.autosave, draftKey, existing?.updated_at]);

  useEffect(() => {
    if (!editor.open) return;
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [editor.open]);

  const save = useCallback(async () => {
    const f = formRef.current;
    const errs: typeof errors = {};
    if (f.title.trim().length < 2) errs.title = 'Title must be at least 2 characters.';
    if (!f.content.trim()) errs.content = 'Prompt content is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const input: NewPromptInput = {
      title: f.title.trim(), content: f.content, description: f.description.trim(),
      category_id: f.category_id || null, platform: f.platform, notes: f.notes,
      is_favorite: f.is_favorite, is_pinned: f.is_pinned, tag_ids: f.tag_ids, collection_ids: f.collection_ids,
    };
    const ok = existing ? await vault.updatePrompt(existing.id, input, f.changeNote) : !!(await vault.createPrompt(input));
    setSaving(false);
    if (ok) {
      localStorage.removeItem(draftKey);
      setDirty(false); setSaveState('saved');
      toast.success(existing ? 'Prompt saved — new version recorded.' : 'Prompt created.');
      closeEditor();
    }
  }, [existing, vault, toast, closeEditor, draftKey]);

  useEffect(() => {
    if (!editor.open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editor.open, save]);

  const tryClose = async () => {
    if (dirty) {
      const discard = await confirm({
        title: 'Discard unsaved changes?',
        message: vault.settings.autosave ? 'A recovery draft was autosaved, but your changes have not been saved to the library. Discarding removes the draft too.' : 'Your changes have not been saved and autosave is off.',
        confirmText: 'Discard changes',
      });
      if (!discard) return;
      localStorage.removeItem(draftKey);
    }
    closeEditor();
  };

  const counts = useMemo(() => `${wordCount(form.content)} words · ${form.content.length} characters`, [form.content]);

  return (
    <Modal open={editor.open} onClose={() => void tryClose()} wide
      title={existing ? `Edit prompt — v${existing.version} → v${existing.version + 1}` : 'New prompt'}
      footer={<>
        <span className={cx('text-xs mr-auto flex items-center gap-1.5', saveState === 'draft' ? 'text-gold' : 'text-muted')}>
          {saveState === 'draft' ? 'Draft autosaved' : dirty ? 'Unsaved changes' : 'Ready'} · <span className="tabular-nums">{counts}</span>
        </span>
        <Button variant="subtle" onClick={() => void tryClose()}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} loading={saving} title="Ctrl/Cmd+S"><Save size={14} />{existing ? 'Save changes' : 'Create prompt'}</Button>
      </>}>
      {draft && (
        <div className="mb-4 card p-3 border-gold/40 bg-gold/10 flex items-center gap-2 text-sm">
          <AlertTriangle size={15} className="text-gold shrink-0" />
          <span className="flex-1 text-ink">Recovery draft found from {timeAgo(draft.savedAt)}.</span>
          <Button size="sm" onClick={() => { setForm(draft.data); setDraft(null); setDirty(true); }}>Restore draft</Button>
          <Button size="sm" variant="subtle" onClick={() => { localStorage.removeItem(draftKey); setDraft(null); }}>Discard</Button>
        </div>
      )}
      <div className="space-y-4">
        <Field label="Title *" error={errors.title}>
          <Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. React code review assistant" autoFocus />
        </Field>
        <Field label="Short description">
          <Input value={form.description} onChange={e => set({ description: e.target.value })} placeholder="What does this prompt do?" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category">
            <Select value={form.category_id} onChange={e => set({ category_id: e.target.value })}>
              <option value="">Uncategorized</option>
              {vault.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="AI platform">
            <Select value={form.platform} onChange={e => set({ platform: e.target.value })}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tags"><TagPicker value={form.tag_ids} onChange={ids => set({ tag_ids: ids })} /></Field>
        <Field label="Collections"><CollectionChecklist value={form.collection_ids} onChange={ids => set({ collection_ids: ids })} /></Field>
        <Field label="Prompt content *" error={errors.content} hint="Full text is preserved — no length limit. Line breaks are kept when copying.">
          <Textarea value={form.content} onChange={e => set({ content: e.target.value })} rows={10}
            className="font-mono leading-relaxed min-h-[220px]"
            style={{ fontSize: vault.settings.editor_font_size }}
            placeholder="Write or paste your prompt here…" />
          {vault.settings.show_counts && <p className="text-[11px] text-muted mt-1 text-right tabular-nums">{counts}</p>}
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={form.notes} onChange={e => set({ notes: e.target.value })} rows={2} placeholder="Private reminders, model settings, context…" />
        </Field>
        {existing && (
          <Field label="Change note (optional)" hint="Shown in the version timeline.">
            <Input value={form.changeNote} onChange={e => set({ changeNote: e.target.value })} placeholder="What changed in this version?" />
          </Field>
        )}
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer"><Star size={15} className={form.is_favorite ? 'text-gold' : 'text-muted'} />Favorite<Toggle checked={form.is_favorite} onChange={v => set({ is_favorite: v })} label="Favorite" /></label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer"><Pin size={15} className={form.is_pinned ? 'text-gold' : 'text-muted'} />Pinned<Toggle checked={form.is_pinned} onChange={v => set({ is_pinned: v })} label="Pinned" /></label>
        </div>
      </div>
    </Modal>
  );
}
