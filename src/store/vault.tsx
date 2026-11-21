import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Category, Collection, DataAdapter, DuplicateMode, ID, NewPromptInput, Prompt, PromptVersion, Settings, Snapshot, Tag, UsageEvent } from '../types';
import { DEFAULT_SETTINGS, ConflictError } from '../types';
import { LocalAdapter } from '../services/localAdapter';
import { CloudAdapter } from '../services/cloudAdapter';
import { ensureSeeded } from '../lib/seed';
import { blankPrompt } from '../lib/promptFactory';
import { applyVersion, versionFrom } from '../lib/versions';
import { buildBackup, planMerge, type BackupData, type BackupEnvelope, type MergePlan } from '../lib/backup';
import { copyText, errMsg, nowISO, uuid, norm } from '../lib/utils';
import { useAuth } from './auth';
import { useToast } from './toast';

type SyncState = 'idle' | 'saving' | 'error' | 'offline';
interface VaultState extends Snapshot { ready: boolean; mode: 'local' | 'cloud'; loadError: string | null; sync: SyncState; conflict: { local: Prompt; remote: Prompt } | null }

const initial: VaultState = {
  prompts: [], categories: [], tags: [], collections: [], versions: [], usage: [],
  settings: DEFAULT_SETTINGS, ready: false, mode: 'local', loadError: null, sync: 'idle', conflict: null,
};

export interface VaultApi extends Omit<VaultState, 'prompts'> {
  prompts: Prompt[]; trashed: Prompt[];
  getPrompt: (id: ID) => Prompt | undefined;
  versionsFor: (id: ID) => PromptVersion[];
  categoryName: (id: ID | null) => string;
  categoryById: (id: ID | null) => Category | undefined;
  createPrompt: (input: NewPromptInput) => Promise<Prompt | undefined>;
  updatePrompt: (id: ID, patch: Partial<Prompt>, note?: string) => Promise<boolean>;
  toggleFavorite: (id: ID) => void; togglePin: (id: ID) => void; recordUsage: (id: ID) => void;
  softDelete: (ids: ID[]) => Promise<void>; restorePrompts: (ids: ID[]) => Promise<void>;
  permanentDelete: (ids: ID[]) => Promise<void>; emptyTrash: () => Promise<void>;
  restoreVersion: (promptId: ID, versionId: ID) => Promise<boolean>;
  createCategory: (name: string, color: string) => Promise<Category | undefined>;
  renameCategory: (id: ID, name: string) => Promise<void>; deleteCategory: (id: ID) => Promise<void>;
  createTag: (name: string) => Promise<Tag | undefined>; renameTag: (id: ID, name: string) => Promise<void>; deleteTag: (id: ID) => Promise<void>;
  createCollection: (name: string, description: string, color: string) => Promise<Collection | undefined>;
  updateCollection: (id: ID, patch: Partial<Collection>) => Promise<void>; deleteCollection: (id: ID) => Promise<void>;
  setPromptCollections: (id: ID, ids: ID[]) => Promise<void>;
  bulkFavorite: (ids: ID[], val: boolean) => Promise<void>; bulkCategory: (ids: ID[], catId: ID | null) => Promise<void>;
  bulkAddTag: (ids: ID[], tagId: ID) => Promise<void>; bulkAddCollection: (ids: ID[], colId: ID) => Promise<void>;
  planImport: (data: BackupData, dup: DuplicateMode) => MergePlan;
  applyImport: (plan: MergePlan) => Promise<void>;
  exportBackup: (ids?: ID[]) => BackupEnvelope;
  updateSettings: (patch: Partial<Settings>) => void;
  deleteAllData: () => Promise<void>;
  reload: () => Promise<void>; retryInit: () => void;
  resolveConflict: (choice: 'mine' | 'theirs') => Promise<void>;
  stats: { total: number; favorites: number; pinned: number; copies: number; categories: number; collections: number; tags: number; trashed: number };
}

const Ctx = createContext<VaultApi | null>(null);
export const useVault = () => { const c = useContext(Ctx); if (!c) throw new Error('VaultProvider missing'); return c; };

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<VaultState>(initial);
  const ref = useRef(state);
  const adapter = useRef<DataAdapter | null>(null);
  const [initKey, setInitKey] = useState(0);
  const uid = user?.id ?? 'local';

  const apply = useCallback((patch: Partial<VaultState>) => { ref.current = { ...ref.current, ...patch }; setState(ref.current); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      apply({ ready: false, loadError: null, conflict: null });
      const mode = user && configured ? 'cloud' : 'local';
      const a: DataAdapter = mode === 'cloud' ? new CloudAdapter(user!.id) : new LocalAdapter();
      adapter.current = a;
      try {
        const snap = await ensureSeeded(a, await a.load(), mode === 'cloud' ? user!.id : 'local');
        if (alive) apply({ ...snap, ready: true, mode, sync: 'idle' });
      } catch (e) { if (alive) apply({ ...initial, ready: true, mode, loadError: errMsg(e) }); }
    })();
    return () => { alive = false; };
  }, [user?.id, configured, initKey, apply]);

  const reload = useCallback(async () => {
    if (!adapter.current || ref.current.sync === 'saving') return;
    try { const snap = await adapter.current.load(); apply({ ...snap, sync: 'idle', loadError: null }); }
    catch (e) { apply({ sync: navigator.onLine ? 'error' : 'offline' }); toast.error('Sync failed: ' + errMsg(e)); }
  }, [apply, toast]);

  useEffect(() => {
    const onFocus = () => { if (ref.current.mode === 'cloud' && ref.current.ready && ref.current.sync === 'idle') reload(); };
    const onOnline = () => { apply({ sync: 'idle' }); if (ref.current.mode === 'cloud') reload(); };
    const onOffline = () => apply({ sync: 'offline' });
    window.addEventListener('focus', onFocus); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    if (!navigator.onLine) apply({ sync: 'offline' });
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [reload, apply]);

  /** Optimistic mutation with rollback + conflict surfacing. */
  const run = useCallback(async (patch: Partial<VaultState>, persist: (a: DataAdapter) => Promise<void>): Promise<boolean> => {
    const prev = ref.current;
    apply({ ...patch, sync: 'saving' });
    try { await persist(adapter.current!); apply({ sync: navigator.onLine ? 'idle' : 'offline' }); return true; }
    catch (e) {
      if (e instanceof ConflictError) {
        apply({ prompts: prev.prompts, versions: prev.versions, sync: 'idle', conflict: { local: e.local, remote: e.remote } });
      } else {
        apply({ prompts: prev.prompts, versions: prev.versions, categories: prev.categories, tags: prev.tags, collections: prev.collections, usage: prev.usage, sync: navigator.onLine ? 'error' : 'offline' });
        toast.error((navigator.onLine ? '' : 'You are offline — change not saved. ') + errMsg(e));
      }
      return false;
    }
  }, [apply, toast]);

  const replacePrompt = (arr: Prompt[], p: Prompt) => arr.map(x => x.id === p.id ? p : x);
  const getPrompt = useCallback((id: ID) => ref.current.prompts.find(p => p.id === id), []);

  const api: VaultApi = useMemo(() => {
    const active = state.prompts.filter(p => !p.deleted_at);
    const trashed = state.prompts.filter(p => !!p.deleted_at);

    const createPrompt = async (input: NewPromptInput) => {
      const p = blankPrompt(uid, input);
      const v = versionFrom(p, 'Created');
      const ok = await run(
        { prompts: [p, ...ref.current.prompts], versions: [v, ...ref.current.versions] },
        async a => { await a.upsertPrompt(p, 'insert'); await a.setPromptTags(p.id, p.tag_ids); await a.setPromptCollections(p.id, p.collection_ids); await a.insertVersion(v); },
      );
      return ok ? p : undefined;
    };

    const updatePrompt = async (id: ID, patch: Partial<Prompt>, note?: string) => {
      const prev = ref.current.prompts.find(p => p.id === id);
      if (!prev) return false;
      const next: Prompt = { ...prev, ...patch, id: prev.id, version: prev.version + 1, updated_at: nowISO() };
      const v = versionFrom(next, note?.trim() || 'Edited');
      const tagsChanged = JSON.stringify(prev.tag_ids) !== JSON.stringify(next.tag_ids);
      const colsChanged = JSON.stringify(prev.collection_ids) !== JSON.stringify(next.collection_ids);
      return run(
        { prompts: replacePrompt(ref.current.prompts, next), versions: [v, ...ref.current.versions] },
        async a => {
          await a.upsertPrompt(next, 'update', prev.version);
          if (tagsChanged) await a.setPromptTags(id, next.tag_ids);
          if (colsChanged) await a.setPromptCollections(id, next.collection_ids);
          await a.insertVersion(v);
        },
      );
    };

    const patchFlags = (ids: ID[], fn: (p: Prompt) => Prompt) => {
      const targets = ref.current.prompts.filter(p => ids.includes(p.id)).map(fn);
      void run({ prompts: ref.current.prompts.map(p => targets.find(t => t.id === p.id) ?? p) },
        async a => { for (const t of targets) await a.upsertPrompt(t, 'update'); });
    };

    const recordUsage = (id: ID) => {
      const p = ref.current.prompts.find(x => x.id === id); if (!p) return;
      const t = nowISO();
      const next = { ...p, usage_count: p.usage_count + 1, last_used_at: t };
      const ev: UsageEvent = { id: uuid(), prompt_id: id, user_id: uid, action: 'copy', used_at: t };
      void run({ prompts: replacePrompt(ref.current.prompts, next), usage: [ev, ...ref.current.usage].slice(0, 500) },
        async a => { await a.upsertPrompt(next, 'update'); await a.insertUsage(ev); });
    };

    const softDelete = async (ids: ID[]) => {
      const t = nowISO();
      const ok = await run({ prompts: ref.current.prompts.map(p => ids.includes(p.id) ? { ...p, deleted_at: t } : p) },
        async a => { for (const id of ids) { const p = ref.current.prompts.find(x => x.id === id); if (p) await a.upsertPrompt(p, 'update'); } });
      if (ok) toast.success(`${ids.length} prompt${ids.length > 1 ? 's' : ''} moved to Trash`, { label: 'Undo', fn: () => void restorePrompts(ids) });
    };
    const restorePrompts = async (ids: ID[]) => {
      await run({ prompts: ref.current.prompts.map(p => ids.includes(p.id) ? { ...p, deleted_at: null } : p) },
        async a => { for (const id of ids) { const p = ref.current.prompts.find(x => x.id === id); if (p) await a.upsertPrompt(p, 'update'); } });
    };
    const permanentDelete = async (ids: ID[]) => {
      const set = new Set(ids);
      await run({
        prompts: ref.current.prompts.filter(p => !set.has(p.id)),
        versions: ref.current.versions.filter(v => !set.has(v.prompt_id)),
        usage: ref.current.usage.filter(u => !set.has(u.prompt_id)),
      }, a => a.deletePromptsPermanent(ids));
    };

    const restoreVersion = async (promptId: ID, versionId: ID) => {
      const cur = ref.current.prompts.find(p => p.id === promptId);
      const v = ref.current.versions.find(x => x.id === versionId);
      if (!cur || !v) return false;
      const next = applyVersion(cur, v);
      const snap = versionFrom(next, `Restored from v${v.version_number}`);
      return run({ prompts: replacePrompt(ref.current.prompts, next), versions: [snap, ...ref.current.versions] },
        async a => {
          await a.upsertPrompt(next, 'update', cur.version);
          await a.setPromptTags(next.id, next.tag_ids); await a.setPromptCollections(next.id, next.collection_ids);
          await a.insertVersion(snap);
        });
    };

    const createCategory = async (name: string, color: string) => {
      if (ref.current.categories.some(c => norm(c.name) === norm(name))) { toast.error('A category with that name already exists.'); return undefined; }
      const c: Category = { id: uuid(), user_id: uid, name: name.trim(), color, created_at: nowISO() };
      const ok = await run({ categories: [...ref.current.categories, c] }, a => a.upsertCategory(c));
      return ok ? c : undefined;
    };
    const createTag = async (name: string) => {
      const clean = name.trim().replace(/^#/, '');
      const existing = ref.current.tags.find(t => norm(t.name) === norm(clean));
      if (existing) return existing;
      const t: Tag = { id: uuid(), user_id: uid, name: clean, created_at: nowISO() };
      const ok = await run({ tags: [...ref.current.tags, t] }, a => a.upsertTag(t));
      return ok ? t : undefined;
    };
    const createCollection = async (name: string, description: string, color: string) => {
      if (ref.current.collections.some(c => norm(c.name) === norm(name))) { toast.error('A collection with that name already exists.'); return undefined; }
      const c: Collection = { id: uuid(), user_id: uid, name: name.trim(), description: description.trim(), color, created_at: nowISO() };
      const ok = await run({ collections: [...ref.current.collections, c] }, a => a.upsertCollection(c));
      return ok ? c : undefined;
    };

    const setPromptCollections = async (id: ID, ids: ID[]) => {
      const p = ref.current.prompts.find(x => x.id === id); if (!p) return;
      const next = { ...p, collection_ids: ids };
      await run({ prompts: replacePrompt(ref.current.prompts, next) }, a => a.setPromptCollections(id, ids));
    };

    const bulkAddLink = async (ids: ID[], key: 'tag_ids' | 'collection_ids', linkId: ID) => {
      const targets = ref.current.prompts.filter(p => ids.includes(p.id) && !p[key].includes(linkId))
        .map(p => ({ ...p, [key]: [...p[key], linkId] }));
      if (!targets.length) return;
      await run({ prompts: ref.current.prompts.map(p => targets.find(t => t.id === p.id) ?? p) },
        async a => { for (const t of targets) key === 'tag_ids' ? await a.setPromptTags(t.id, t.tag_ids) : await a.setPromptCollections(t.id, t.collection_ids); });
    };

    const resolveConflict = async (choice: 'mine' | 'theirs') => {
      const c = ref.current.conflict; if (!c) return;
      apply({ conflict: null });
      if (choice === 'mine') {
        const next = { ...c.local, version: c.remote.version + 1, updated_at: nowISO() };
        const v = versionFrom(next, 'Resolved conflict — kept local changes');
        try {
          await adapter.current!.upsertPrompt(next, 'update', c.remote.version);
          await adapter.current!.setPromptTags(next.id, next.tag_ids);
          await adapter.current!.setPromptCollections(next.id, next.collection_ids);
          await adapter.current!.insertVersion(v);
        } catch (e) { toast.error(errMsg(e)); }
      }
      await reload();
      toast.success(choice === 'mine' ? 'Your changes were kept and synced.' : 'Loaded the cloud version.');
    };

    return {
      ...state, prompts: active, trashed,
      getPrompt,
      versionsFor: (id: ID) => state.versions.filter(v => v.prompt_id === id).sort((a, b) => b.version_number - a.version_number),
      categoryName: (id: ID | null) => state.categories.find(c => c.id === id)?.name ?? 'Uncategorized',
      categoryById: (id: ID | null) => state.categories.find(c => c.id === id),
      createPrompt, updatePrompt,
      toggleFavorite: (id) => { const p = getPrompt(id); if (p) patchFlags([id], x => ({ ...x, is_favorite: !x.is_favorite })); },
      togglePin: (id) => { const p = getPrompt(id); if (p) patchFlags([id], x => ({ ...x, is_pinned: !x.is_pinned })); },
      recordUsage, softDelete, restorePrompts, permanentDelete,
      emptyTrash: () => permanentDelete(ref.current.prompts.filter(p => p.deleted_at).map(p => p.id)),
      restoreVersion,
      createCategory,
      renameCategory: async (id, name) => {
        const c = ref.current.categories.find(x => x.id === id); if (!c) return;
        if (ref.current.categories.some(x => x.id !== id && norm(x.name) === norm(name))) { toast.error('A category with that name already exists.'); return; }
        const next = { ...c, name: name.trim() };
        await run({ categories: ref.current.categories.map(x => x.id === id ? next : x) }, a => a.upsertCategory(next));
      },
      deleteCategory: async (id) => {
        await run({
          categories: ref.current.categories.filter(c => c.id !== id),
          prompts: ref.current.prompts.map(p => p.category_id === id ? { ...p, category_id: null } : p),
        }, a => a.deleteCategory(id));
      },
      createTag,
      renameTag: async (id, name) => {
        const t = ref.current.tags.find(x => x.id === id); if (!t) return;
        const next = { ...t, name: name.trim().replace(/^#/, '') };
        await run({ tags: ref.current.tags.map(x => x.id === id ? next : x) }, a => a.upsertTag(next));
      },
      deleteTag: async (id) => {
        await run({
          tags: ref.current.tags.filter(t => t.id !== id),
          prompts: ref.current.prompts.map(p => p.tag_ids.includes(id) ? { ...p, tag_ids: p.tag_ids.filter(t => t !== id) } : p),
        }, a => a.deleteTag(id));
      },
      createCollection,
      updateCollection: async (id, patch) => {
        const c = ref.current.collections.find(x => x.id === id); if (!c) return;
        const next = { ...c, ...patch };
        await run({ collections: ref.current.collections.map(x => x.id === id ? next : x) }, a => a.upsertCollection(next));
      },
      deleteCollection: async (id) => {
        await run({
          collections: ref.current.collections.filter(c => c.id !== id),
          prompts: ref.current.prompts.map(p => p.collection_ids.includes(id) ? { ...p, collection_ids: p.collection_ids.filter(c => c !== id) } : p),
        }, a => a.deleteCollection(id));
      },
      setPromptCollections,
      bulkFavorite: async (ids, val) => patchFlags(ids, p => ({ ...p, is_favorite: val })),
      bulkCategory: async (ids, catId) => { for (const id of ids) await updatePrompt(id, { category_id: catId }, 'Category assigned (bulk)'); },
      bulkAddTag: (ids, tagId) => bulkAddLink(ids, 'tag_ids', tagId),
      bulkAddCollection: (ids, colId) => bulkAddLink(ids, 'collection_ids', colId),
      planImport: (data, dup) => planMerge(ref.current, data, dup, uid),
      applyImport: async (plan) => {
        const ok = await run({
          categories: [...ref.current.categories, ...plan.categories], tags: [...ref.current.tags, ...plan.tags],
          collections: [...ref.current.collections, ...plan.collections], prompts: [...plan.prompts, ...ref.current.prompts],
          versions: [...plan.versions, ...ref.current.versions], usage: [...plan.usage, ...ref.current.usage].slice(0, 500),
        }, a => a.bulkImport(plan));
        if (ok) toast.success(`Imported ${plan.prompts.length} prompt${plan.prompts.length === 1 ? '' : 's'}${plan.skipped ? ` · ${plan.skipped} duplicate${plan.skipped > 1 ? 's' : ''} skipped` : ''}.`);
      },
      exportBackup: (ids) => buildBackup(ref.current, ids),
      updateSettings: (patch) => {
        const next = { ...ref.current.settings, ...patch };
        void run({ settings: next }, a => a.saveSettings(next));
      },
      deleteAllData: async () => {
        const ok = await run({
          prompts: [], categories: [], tags: [], collections: [], versions: [], usage: [],
          settings: { ...ref.current.settings, seeded: true, default_category_id: null },
        }, async a => { await a.clearAll(); await a.saveSettings({ ...ref.current.settings, seeded: true, default_category_id: null }); });
        if (ok) toast.success('All vault data was deleted.');
      },
      reload, retryInit: () => setInitKey(k => k + 1), resolveConflict,
      stats: {
        total: active.length, favorites: active.filter(p => p.is_favorite).length, pinned: active.filter(p => p.is_pinned).length,
        copies: active.reduce((s, p) => s + p.usage_count, 0), categories: state.categories.length,
        collections: state.collections.length, tags: state.tags.length, trashed: trashed.length,
      },
    };
  }, [state, run, uid, toast, getPrompt, reload, apply]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Copy a stored prompt with usage tracking + clipboard error handling. */
export function useCopyPrompt() {
  const vault = useVault();
  const toast = useToast();
  return useCallback(async (p: Prompt) => {
    const ok = await copyText(p.content);
    if (ok) { vault.recordUsage(p.id); toast.success('Prompt copied to clipboard'); }
    else toast.error('Clipboard is unavailable in this browser context. Open the prompt and copy manually.');
    return ok;
  }, [vault, toast]);
}

/** Copy arbitrary text (e.g. AI results) — no usage tracking, no fake records. */
export function useCopyText() {
  const toast = useToast();
  return useCallback(async (text: string) => {
    const ok = await copyText(text);
    if (ok) toast.success('Copied to clipboard');
    else toast.error('Clipboard is unavailable in this browser context. Select the text and copy manually.');
    return ok;
  }, [toast]);
}

export function ThemeApplier() {
  const { settings } = useVault();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.classList.toggle('light', !dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    applyTheme();
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [settings.theme]);
  return null;
}
