export type ID = string;
export type SortKey = 'updated' | 'created' | 'title' | 'usage' | 'favorites' | 'pinned';
export type DuplicateMode = 'skip' | 'copy';

export interface Category { id: ID; user_id: string; name: string; color: string; created_at: string }
export interface Tag { id: ID; user_id: string; name: string; created_at: string }
export interface Collection { id: ID; user_id: string; name: string; description: string; color: string; created_at: string }

export interface Prompt {
  id: ID; user_id: string; title: string; content: string; description: string;
  category_id: ID | null; platform: string; notes: string;
  is_favorite: boolean; is_pinned: boolean;
  usage_count: number; last_used_at: string | null; version: number;
  created_at: string; updated_at: string; deleted_at: string | null;
  tag_ids: ID[]; collection_ids: ID[];
}

export interface PromptVersion {
  id: ID; prompt_id: ID; user_id: string; version_number: number;
  title: string; content: string; description: string; category_id: ID | null;
  platform: string; notes: string; tag_ids: ID[]; collection_ids: ID[];
  change_note: string; created_at: string;
}

export interface UsageEvent { id: ID; prompt_id: ID; user_id: string; action: string; used_at: string }

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  default_category_id: ID | null; default_sort: SortKey; default_view: 'grid' | 'list';
  autosave: boolean; editor_font_size: number; show_counts: boolean;
  seeded: boolean; ai_model: string | null;
}

export interface Snapshot {
  prompts: Prompt[]; categories: Category[]; tags: Tag[]; collections: Collection[];
  versions: PromptVersion[]; usage: UsageEvent[]; settings: Settings;
}

export type NewPromptInput = Partial<Omit<Prompt, 'id' | 'user_id' | 'version' | 'usage_count' | 'created_at' | 'updated_at' | 'deleted_at' | 'last_used_at'>> & { title: string; content: string };

export interface DataAdapter {
  load(): Promise<Snapshot>;
  upsertPrompt(p: Prompt, kind: 'insert' | 'update', expectedVersion?: number): Promise<void>;
  insertVersion(v: PromptVersion): Promise<void>;
  setPromptTags(promptId: ID, tagIds: ID[]): Promise<void>;
  setPromptCollections(promptId: ID, ids: ID[]): Promise<void>;
  deletePromptsPermanent(ids: ID[]): Promise<void>;
  upsertCategory(c: Category): Promise<void>;
  deleteCategory(id: ID): Promise<void>;
  upsertTag(t: Tag): Promise<void>;
  deleteTag(id: ID): Promise<void>;
  upsertCollection(c: Collection): Promise<void>;
  deleteCollection(id: ID): Promise<void>;
  insertUsage(e: UsageEvent): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  bulkImport(data: Partial<Omit<Snapshot, 'settings'>>): Promise<void>;
  clearAll(): Promise<void>;
  claimSeed(): Promise<boolean>;
}

export class ConflictError extends Error {
  constructor(public local: Prompt, public remote: Prompt) { super('conflict'); this.name = 'ConflictError'; }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', default_category_id: null, default_sort: 'updated', default_view: 'grid',
  autosave: true, editor_font_size: 14, show_counts: true, seeded: false, ai_model: null,
};

export const PLATFORMS = ['Any', 'ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Midjourney', 'Perplexity', 'Llama'] as const;
export const PLATFORM_COLORS: Record<string, string> = {
  Any: '#827D6A', ChatGPT: '#387866', Claude: '#B67C33', Gemini: '#547F9F',
  Copilot: '#3E715A', Midjourney: '#BF6C58', Perplexity: '#4C8691', Llama: '#A9503B',
};

export const PRESET_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Study & Education', color: '#77A8AD' },
  { name: 'Programming & Development', color: '#387866' },
  { name: 'Cybersecurity', color: '#BF6C58' },
  { name: 'AI & Machine Learning', color: '#547F9F' },
  { name: 'Content Creation', color: '#D98D88' },
  { name: 'Design & Creativity', color: '#E9BE54' },
  { name: 'Productivity', color: '#4C8691' },
  { name: 'Business', color: '#A8C59A' },
  { name: 'Research', color: '#668C70' },
  { name: 'Personal', color: '#C48B3E' },
  { name: 'Other', color: '#827D6A' },
];

export const CATEGORY_COLORS = ['#77A8AD', '#387866', '#BF6C58', '#547F9F', '#D98D88', '#E9BE54', '#4C8691', '#A8C59A', '#668C70', '#C48B3E', '#827D6A'];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: 'Recently updated' }, { value: 'created', label: 'Recently created' },
  { value: 'title', label: 'Alphabetical' }, { value: 'usage', label: 'Most used' },
  { value: 'favorites', label: 'Favorites first' }, { value: 'pinned', label: 'Pinned first' },
];

export const REWRITE_STYLES = ['Professional', 'Simple', 'Detailed', 'Creative', 'Technical', 'Beginner-friendly', 'Concise'] as const;
