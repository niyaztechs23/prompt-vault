import { z } from 'zod';
import type { Category, Collection, DuplicateMode, Prompt, PromptVersion, Settings, Snapshot, Tag, UsageEvent } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { nowISO, promptKey, uuid, norm } from './utils';
import { versionFrom } from './versions';

const iso = z.string();
const categorySchema = z.object({ id: z.string().min(1), user_id: z.string().default(''), name: z.string().min(1), color: z.string().default('#28513F'), created_at: iso.default(nowISO) });
const tagSchema = z.object({ id: z.string().min(1), user_id: z.string().default(''), name: z.string().min(1), created_at: iso.default(nowISO) });
const collectionSchema = z.object({ id: z.string().min(1), user_id: z.string().default(''), name: z.string().min(1), description: z.string().default(''), color: z.string().default('#28513F'), created_at: iso.default(nowISO) });
const promptSchema = z.object({
  id: z.string().min(1), user_id: z.string().default(''), title: z.string().min(1), content: z.string(),
  description: z.string().default(''), category_id: z.string().nullable().default(null),
  platform: z.string().default('Any'), notes: z.string().default(''),
  is_favorite: z.boolean().default(false), is_pinned: z.boolean().default(false),
  usage_count: z.number().int().nonnegative().default(0), last_used_at: iso.nullable().default(null),
  version: z.number().int().positive().default(1), created_at: iso.default(nowISO), updated_at: iso.default(nowISO),
  deleted_at: iso.nullable().default(null), tag_ids: z.array(z.string()).default([]), collection_ids: z.array(z.string()).default([]),
});
const versionSchema = z.object({
  id: z.string().min(1), prompt_id: z.string().min(1), user_id: z.string().default(''),
  version_number: z.number().int().positive(), title: z.string(), content: z.string(),
  description: z.string().default(''), category_id: z.string().nullable().default(null),
  platform: z.string().default('Any'), notes: z.string().default(''),
  tag_ids: z.array(z.string()).default([]), collection_ids: z.array(z.string()).default([]),
  change_note: z.string().default(''), created_at: iso.default(nowISO),
});
const usageSchema = z.object({ id: z.string().min(1), prompt_id: z.string().min(1), user_id: z.string().default(''), action: z.string().default('copy'), used_at: iso.default(nowISO) });
const dataSchema = z.object({
  prompts: z.array(promptSchema), categories: z.array(categorySchema).default([]),
  tags: z.array(tagSchema).default([]), collections: z.array(collectionSchema).default([]),
  versions: z.array(versionSchema).default([]), usage: z.array(usageSchema).default([]),
});
const envelopeSchema = z.object({ app: z.literal('prompt-vault'), format_version: z.number().default(1), exported_at: iso.default(nowISO), data: dataSchema });

export type BackupData = z.infer<typeof dataSchema>;
export interface BackupEnvelope { app: 'prompt-vault'; format_version: number; exported_at: string; counts: Record<string, number>; data: BackupData }

export function validateBackup(text: string): { ok: true; data: BackupData } | { ok: false; errors: string[] } {
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, errors: ['File is not valid JSON.'] }; }
  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.') || 'file'}: ${i.message}`);
    if ((json as any)?.app !== 'prompt-vault') issues.unshift('Not a Prompt Vault backup file (missing app marker).');
    return { ok: false, errors: issues };
  }
  return { ok: true, data: parsed.data.data };
}

export function buildBackup(snap: Snapshot, promptIds?: string[]): BackupEnvelope {
  const sel = promptIds ? new Set(promptIds) : null;
  const prompts = sel ? snap.prompts.filter(p => sel.has(p.id)) : snap.prompts;
  const catIds = new Set(prompts.map(p => p.category_id).filter(Boolean) as string[]);
  const tagIds = new Set(prompts.flatMap(p => p.tag_ids));
  const colIds = new Set(prompts.flatMap(p => p.collection_ids));
  const pIds = new Set(prompts.map(p => p.id));
  const data: BackupData = {
    prompts,
    categories: sel ? snap.categories.filter(c => catIds.has(c.id)) : snap.categories,
    tags: sel ? snap.tags.filter(t => tagIds.has(t.id)) : snap.tags,
    collections: sel ? snap.collections.filter(c => colIds.has(c.id)) : snap.collections,
    versions: snap.versions.filter(v => pIds.has(v.prompt_id)),
    usage: snap.usage.filter(u => pIds.has(u.prompt_id)),
  };
  return {
    app: 'prompt-vault', format_version: 1, exported_at: nowISO(),
    counts: { prompts: data.prompts.length, categories: data.categories.length, tags: data.tags.length, collections: data.collections.length, versions: data.versions.length },
    data,
  };
}

export interface MergePlan {
  categories: Category[]; tags: Tag[]; collections: Collection[];
  prompts: Prompt[]; versions: PromptVersion[]; usage: UsageEvent[]; skipped: number;
}

/** Pure merge: never overwrites target data. Matches categories/tags/collections by name. */
export function planMerge(target: Snapshot, incoming: BackupData, dup: DuplicateMode, userId: string): MergePlan {
  const plan: MergePlan = { categories: [], tags: [], collections: [], prompts: [], versions: [], usage: [], skipped: 0 };
  const usedIds = new Set<string>([
    ...target.prompts.map(p => p.id), ...target.categories.map(c => c.id), ...target.tags.map(t => t.id),
    ...target.collections.map(c => c.id), ...target.versions.map(v => v.id),
  ]);
  const fresh = (id: string) => { const out = usedIds.has(id) ? uuid() : id; usedIds.add(out); return out; };

  const mapByName = <T extends { id: string; name: string; user_id: string; created_at: string }>(
    existing: T[], inc: T[], out: T[], make: (t: T, id: string) => T,
  ) => {
    const byName = new Map(existing.map(e => [norm(e.name), e.id]));
    const idMap = new Map<string, string>();
    for (const item of inc) {
      const ex = byName.get(norm(item.name));
      if (ex) { idMap.set(item.id, ex); continue; }
      const id = fresh(item.id);
      out.push(make({ ...item, user_id: userId }, id));
      byName.set(norm(item.name), id); idMap.set(item.id, id);
    }
    return idMap;
  };
  const catMap = mapByName(target.categories, incoming.categories as Category[], plan.categories, (c, id) => ({ ...c, id }));
  const tagMap = mapByName(target.tags, incoming.tags as Tag[], plan.tags, (t, id) => ({ ...t, id }));
  const colMap = mapByName(target.collections, incoming.collections as Collection[], plan.collections, (c, id) => ({ ...c, id }));

  const keys = new Set(target.prompts.map(promptKey));
  const promptIdMap = new Map<string, string>();
  for (const raw of incoming.prompts) {
    const key = promptKey(raw);
    if (keys.has(key) && dup === 'skip') { plan.skipped++; continue; }
    const id = fresh(raw.id);
    keys.add(key);
    const p: Prompt = {
      ...(raw as Prompt), id, user_id: userId,
      category_id: raw.category_id ? catMap.get(raw.category_id) ?? null : null,
      tag_ids: [...new Set(raw.tag_ids.map(t => tagMap.get(t)).filter(Boolean) as string[])],
      collection_ids: [...new Set(raw.collection_ids.map(c => colMap.get(c)).filter(Boolean) as string[])],
    };
    plan.prompts.push(p); promptIdMap.set(raw.id, id);
  }
  const versionKeys = new Set(target.versions.map(v => `${v.prompt_id}:${v.version_number}`));
  const coveredPrompts = new Set<string>();
  for (const raw of incoming.versions) {
    const pid = promptIdMap.get(raw.prompt_id);
    if (!pid) continue;
    const vk = `${pid}:${raw.version_number}`;
    if (versionKeys.has(vk)) continue;
    versionKeys.add(vk); coveredPrompts.add(pid);
    plan.versions.push({
      ...(raw as PromptVersion), id: fresh(raw.id), prompt_id: pid, user_id: userId,
      category_id: raw.category_id ? catMap.get(raw.category_id) ?? null : null,
      tag_ids: raw.tag_ids.map(t => tagMap.get(t)).filter(Boolean) as string[],
      collection_ids: raw.collection_ids.map(c => colMap.get(c)).filter(Boolean) as string[],
    });
  }
  for (const p of plan.prompts)
    if (!coveredPrompts.has(p.id)) plan.versions.push(versionFrom(p, 'Imported'));
  for (const raw of incoming.usage.slice(0, 2000)) {
    const pid = promptIdMap.get(raw.prompt_id);
    if (pid) plan.usage.push({ ...(raw as UsageEvent), id: fresh(raw.id), prompt_id: pid, user_id: userId });
  }
  return plan;
}

export function toMarkdown(prompts: Prompt[], snap: Snapshot): string {
  const cat = (id: string | null) => snap.categories.find(c => c.id === id)?.name ?? 'Uncategorized';
  const tags = (ids: string[]) => ids.map(id => snap.tags.find(t => t.id === id)?.name).filter(Boolean).join(', ');
  return `# Prompt Vault Export\n\n_Exported ${new Date().toLocaleString()} · ${prompts.length} prompts_\n\n` +
    prompts.map(p =>
      `## ${p.title}\n\n> ${p.description || 'No description'}\n\n**Category:** ${cat(p.category_id)} · **Platform:** ${p.platform}${tags(p.tag_ids) ? ` · **Tags:** ${tags(p.tag_ids)}` : ''} · **Used:** ${p.usage_count}×\n\n\`\`\`text\n${p.content}\n\`\`\`\n${p.notes ? `\n**Notes:** ${p.notes}\n` : ''}`
    ).join('\n---\n\n');
}

export function toPlainText(prompts: Prompt[], snap: Snapshot): string {
  const cat = (id: string | null) => snap.categories.find(c => c.id === id)?.name ?? 'Uncategorized';
  return `PROMPT VAULT EXPORT — ${new Date().toLocaleString()} — ${prompts.length} prompts\n${'='.repeat(60)}\n\n` +
    prompts.map(p => `${p.title}\n${'-'.repeat(Math.min(60, p.title.length))}\nCategory: ${cat(p.category_id)} | Platform: ${p.platform} | Used: ${p.usage_count}x\n${p.description ? p.description + '\n' : ''}\n${p.content}\n`).join(`\n${'='.repeat(60)}\n\n`);
}

export const settingsWithDefaults = (s: Partial<Settings> | undefined): Settings => ({ ...DEFAULT_SETTINGS, ...(s ?? {}) });
