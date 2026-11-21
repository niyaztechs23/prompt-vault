import type { Category, Collection, DataAdapter, Prompt, PromptVersion, Settings, Snapshot, Tag, UsageEvent } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { idbGet, idbSet } from '../lib/idb';

type ArrKey = 'prompts' | 'categories' | 'tags' | 'collections' | 'versions' | 'usage';

export class LocalAdapter implements DataAdapter {
  private async arr<T>(key: ArrKey): Promise<T[]> { return (await idbGet<T[]>(key)) ?? []; }
  private async patch<T extends { id: string }>(key: ArrKey, fn: (arr: T[]) => T[]): Promise<void> {
    await idbSet(key, fn(await this.arr<T>(key)));
  }
  private async upsert<T extends { id: string }>(key: ArrKey, item: T): Promise<void> {
    await this.patch<T>(key, arr => { const i = arr.findIndex(x => x.id === item.id); if (i >= 0) { arr = [...arr]; arr[i] = item; return arr; } return [item, ...arr]; });
  }

  async load(): Promise<Snapshot> {
    const [prompts, categories, tags, collections, versions, usage, settings] = await Promise.all([
      this.arr<Prompt>('prompts'), this.arr<Category>('categories'), this.arr<Tag>('tags'),
      this.arr<Collection>('collections'), this.arr<PromptVersion>('versions'), this.arr<UsageEvent>('usage'),
      idbGet<Settings>('settings'),
    ]);
    return { prompts, categories, tags, collections, versions, usage, settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) } };
  }
  async upsertPrompt(p: Prompt) { await this.upsert('prompts', p); }
  async insertVersion(v: PromptVersion) { await this.patch<PromptVersion>('versions', a => [v, ...a]); }
  async setPromptTags(id: string, tagIds: string[]) { await this.patch<Prompt>('prompts', a => a.map(p => p.id === id ? { ...p, tag_ids: tagIds } : p)); }
  async setPromptCollections(id: string, ids: string[]) { await this.patch<Prompt>('prompts', a => a.map(p => p.id === id ? { ...p, collection_ids: ids } : p)); }
  async deletePromptsPermanent(ids: string[]) {
    const set = new Set(ids);
    await this.patch<Prompt>('prompts', a => a.filter(p => !set.has(p.id)));
    await this.patch<PromptVersion>('versions', a => a.filter(v => !set.has(v.prompt_id)));
    await this.patch<UsageEvent>('usage', a => a.filter(u => !set.has(u.prompt_id)));
  }
  async upsertCategory(c: Category) { await this.upsert('categories', c); }
  async deleteCategory(id: string) {
    await this.patch<Category>('categories', a => a.filter(c => c.id !== id));
    await this.patch<Prompt>('prompts', a => a.map(p => p.category_id === id ? { ...p, category_id: null } : p));
  }
  async upsertTag(t: Tag) { await this.upsert('tags', t); }
  async deleteTag(id: string) {
    await this.patch<Tag>('tags', a => a.filter(t => t.id !== id));
    await this.patch<Prompt>('prompts', a => a.map(p => p.tag_ids.includes(id) ? { ...p, tag_ids: p.tag_ids.filter(t => t !== id) } : p));
  }
  async upsertCollection(c: Collection) { await this.upsert('collections', c); }
  async deleteCollection(id: string) {
    await this.patch<Collection>('collections', a => a.filter(c => c.id !== id));
    await this.patch<Prompt>('prompts', a => a.map(p => p.collection_ids.includes(id) ? { ...p, collection_ids: p.collection_ids.filter(c => c !== id) } : p));
  }
  async insertUsage(e: UsageEvent) { await this.patch<UsageEvent>('usage', a => [e, ...a].slice(0, 2000)); }
  async saveSettings(s: Settings) { await idbSet('settings', s); }
  async bulkImport(d: Partial<Omit<Snapshot, 'settings'>>) {
    for (const key of ['categories', 'tags', 'collections', 'prompts', 'versions', 'usage'] as ArrKey[]) {
      const items = (d as any)[key] as { id: string }[] | undefined;
      if (items?.length) await this.patch(key, a => [...items, ...a]);
    }
  }
  async clearAll() {
    for (const key of ['prompts', 'categories', 'tags', 'collections', 'versions', 'usage'] as ArrKey[]) await idbSet(key, []);
  }
  async claimSeed() { return true; }
}
