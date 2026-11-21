import type { DataAdapter, Prompt, Snapshot } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { blankPrompt } from '../lib/promptFactory';

export const emptySnapshot = (): Snapshot => ({
  prompts: [], categories: [], tags: [], collections: [], versions: [], usage: [],
  settings: { ...DEFAULT_SETTINGS },
});

export const makePrompt = (over: Partial<Prompt> = {}): Prompt => ({
  ...blankPrompt('u1', { title: 'Test prompt', content: 'Line one\nLine two\nLine three' }), ...over,
});

/** In-memory adapter for logic tests. */
export class FakeAdapter implements DataAdapter {
  snap = emptySnapshot();
  seedClaimed = false;
  async load() { return structuredClone(this.snap); }
  async upsertPrompt(p: Prompt) {
    const i = this.snap.prompts.findIndex(x => x.id === p.id);
    if (i >= 0) this.snap.prompts[i] = structuredClone(p); else this.snap.prompts.unshift(structuredClone(p));
  }
  async insertVersion(v: any) { this.snap.versions.unshift(structuredClone(v)); }
  async setPromptTags(id: string, ids: string[]) { const p = this.snap.prompts.find(x => x.id === id); if (p) p.tag_ids = ids; }
  async setPromptCollections(id: string, ids: string[]) { const p = this.snap.prompts.find(x => x.id === id); if (p) p.collection_ids = ids; }
  async deletePromptsPermanent(ids: string[]) {
    this.snap.prompts = this.snap.prompts.filter(p => !ids.includes(p.id));
    this.snap.versions = this.snap.versions.filter(v => !ids.includes(v.prompt_id));
  }
  async upsertCategory(c: any) { this.snap.categories.push(c); }
  async deleteCategory(id: string) { this.snap.categories = this.snap.categories.filter(c => c.id !== id); }
  async upsertTag(t: any) { this.snap.tags.push(t); }
  async deleteTag(id: string) { this.snap.tags = this.snap.tags.filter(t => t.id !== id); }
  async upsertCollection(c: any) { this.snap.collections.push(c); }
  async deleteCollection(id: string) { this.snap.collections = this.snap.collections.filter(c => c.id !== id); }
  async insertUsage(e: any) { this.snap.usage.unshift(e); }
  async saveSettings(s: any) { this.snap.settings = s; }
  async bulkImport(d: any) {
    for (const k of ['categories', 'tags', 'collections', 'prompts', 'versions', 'usage'] as const)
      if (d[k]) (this.snap as any)[k] = [...d[k], ...(this.snap as any)[k]];
  }
  async clearAll() { this.snap = { ...emptySnapshot(), settings: this.snap.settings }; }
  async claimSeed() { if (this.seedClaimed) return false; this.seedClaimed = true; return true; }
}
