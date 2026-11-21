import type { Category, Collection, DataAdapter, Prompt, PromptVersion, Settings, Snapshot, Tag, UsageEvent } from '../types';
import { DEFAULT_SETTINGS, ConflictError } from '../types';
import { supabase } from '../lib/supabase';

type PromptRow = Omit<Prompt, 'tag_ids' | 'collection_ids'>;
const toRow = (p: Prompt): PromptRow => { const { tag_ids, collection_ids, ...row } = p; return row; };
const chunk = <T,>(a: T[], n = 200): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

export class CloudAdapter implements DataAdapter {
  constructor(private uid: string) { if (!supabase) throw new Error('Supabase is not configured.'); }
  private get sb() { return supabase!; }
  private check(error: { message: string } | null) { if (error) throw new Error(error.message); }

  private async links(promptIds?: string[]) {
    let pt = this.sb.from('prompt_tags').select('prompt_id, tag_id');
    let cp = this.sb.from('collection_prompts').select('prompt_id, collection_id');
    if (promptIds) { pt = pt.in('prompt_id', promptIds); cp = cp.in('prompt_id', promptIds); }
    const [a, b] = await Promise.all([pt, cp]);
    this.check(a.error); this.check(b.error);
    const tags = new Map<string, string[]>(), cols = new Map<string, string[]>();
    for (const r of a.data ?? []) tags.set(r.prompt_id, [...(tags.get(r.prompt_id) ?? []), r.tag_id]);
    for (const r of b.data ?? []) cols.set(r.prompt_id, [...(cols.get(r.prompt_id) ?? []), r.collection_id]);
    return { tags, cols };
  }

  async load(): Promise<Snapshot> {
    const [pr, ca, ta, co, ve, us, st] = await Promise.all([
      this.sb.from('prompts').select('*').order('updated_at', { ascending: false }),
      this.sb.from('categories').select('*').order('name'),
      this.sb.from('tags').select('*').order('name'),
      this.sb.from('collections').select('*').order('created_at'),
      this.sb.from('prompt_versions').select('*').order('created_at', { ascending: false }),
      this.sb.from('prompt_usage').select('*').order('used_at', { ascending: false }).limit(300),
      this.sb.from('user_settings').select('*').eq('user_id', this.uid).maybeSingle(),
    ]);
    for (const r of [pr, ca, ta, co, ve, us, st]) this.check(r.error);
    const { tags, cols } = await this.links();
    const prompts = ((pr.data ?? []) as PromptRow[]).map(r => ({ ...r, tag_ids: tags.get(r.id) ?? [], collection_ids: cols.get(r.id) ?? [] }));
    let settings: Settings;
    if (st.data) { const { user_id, updated_at, ...rest } = st.data as any; settings = { ...DEFAULT_SETTINGS, ...rest }; }
    else { settings = { ...DEFAULT_SETTINGS }; await this.saveSettings(settings); }
    return {
      prompts, categories: (ca.data ?? []) as Category[], tags: (ta.data ?? []) as Tag[],
      collections: (co.data ?? []) as Collection[], versions: (ve.data ?? []) as PromptVersion[],
      usage: (us.data ?? []) as UsageEvent[], settings,
    };
  }

  async upsertPrompt(p: Prompt, kind: 'insert' | 'update', expectedVersion?: number) {
    if (kind === 'insert') { this.check((await this.sb.from('prompts').insert(toRow(p))).error); return; }
    let q = this.sb.from('prompts').update(toRow(p)).eq('id', p.id).eq('user_id', this.uid);
    if (expectedVersion != null) q = q.eq('version', expectedVersion);
    const { data, error } = await q.select('id');
    this.check(error);
    if (expectedVersion != null && (!data || data.length === 0)) {
      const { data: remote, error: e2 } = await this.sb.from('prompts').select('*').eq('id', p.id).maybeSingle();
      this.check(e2);
      if (!remote) throw new Error('This prompt no longer exists in the cloud.');
      const { tags, cols } = await this.links([p.id]);
      throw new ConflictError(p, { ...(remote as PromptRow), tag_ids: tags.get(p.id) ?? [], collection_ids: cols.get(p.id) ?? [] });
    }
  }
  async insertVersion(v: PromptVersion) { this.check((await this.sb.from('prompt_versions').insert(v)).error); }
  async setPromptTags(promptId: string, tagIds: string[]) {
    this.check((await this.sb.from('prompt_tags').delete().eq('prompt_id', promptId)).error);
    if (tagIds.length) this.check((await this.sb.from('prompt_tags').insert(tagIds.map(tag_id => ({ prompt_id: promptId, tag_id, user_id: this.uid })))).error);
  }
  async setPromptCollections(promptId: string, ids: string[]) {
    this.check((await this.sb.from('collection_prompts').delete().eq('prompt_id', promptId)).error);
    if (ids.length) this.check((await this.sb.from('collection_prompts').insert(ids.map(collection_id => ({ prompt_id: promptId, collection_id, user_id: this.uid })))).error);
  }
  async deletePromptsPermanent(ids: string[]) { if (ids.length) this.check((await this.sb.from('prompts').delete().in('id', ids)).error); }
  async upsertCategory(c: Category) { this.check((await this.sb.from('categories').upsert(c)).error); }
  async deleteCategory(id: string) { this.check((await this.sb.from('categories').delete().eq('id', id)).error); }
  async upsertTag(t: Tag) { this.check((await this.sb.from('tags').upsert(t)).error); }
  async deleteTag(id: string) { this.check((await this.sb.from('tags').delete().eq('id', id)).error); }
  async upsertCollection(c: Collection) { this.check((await this.sb.from('collections').upsert(c)).error); }
  async deleteCollection(id: string) { this.check((await this.sb.from('collections').delete().eq('id', id)).error); }
  async insertUsage(e: UsageEvent) { this.check((await this.sb.from('prompt_usage').insert(e)).error); }
  async saveSettings(s: Settings) { this.check((await this.sb.from('user_settings').upsert({ user_id: this.uid, ...s, updated_at: new Date().toISOString() })).error); }

  async bulkImport(d: Partial<Omit<Snapshot, 'settings'>>) {
    const ins = async (table: string, rows: unknown[]) => { for (const c of chunk(rows)) if (c.length) this.check((await this.sb.from(table).insert(c)).error); };
    await ins('categories', d.categories ?? []); await ins('tags', d.tags ?? []); await ins('collections', d.collections ?? []);
    await ins('prompts', (d.prompts ?? []).map(toRow));
    const pt = (d.prompts ?? []).flatMap(p => p.tag_ids.map(tag_id => ({ prompt_id: p.id, tag_id, user_id: this.uid })));
    const cp = (d.prompts ?? []).flatMap(p => p.collection_ids.map(collection_id => ({ prompt_id: p.id, collection_id, user_id: this.uid })));
    await ins('prompt_tags', pt); await ins('collection_prompts', cp);
    await ins('prompt_versions', d.versions ?? []); await ins('prompt_usage', d.usage ?? []);
  }
  async clearAll() {
    for (const table of ['prompts', 'categories', 'tags', 'collections'])
      this.check((await this.sb.from(table).delete().eq('user_id', this.uid)).error);
  }
  async claimSeed(): Promise<boolean> {
    const { data, error } = await this.sb.from('user_settings').update({ seeded: true }).eq('user_id', this.uid).eq('seeded', false).select('user_id');
    this.check(error);
    return !!data && data.length > 0;
  }
}
