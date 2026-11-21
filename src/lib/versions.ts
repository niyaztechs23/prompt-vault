import type { Prompt, PromptVersion } from '../types';
import { nowISO, uuid } from './utils';

/** Snapshot of a prompt's state at a given version (git-commit style). */
export function versionFrom(p: Prompt, note: string): PromptVersion {
  return {
    id: uuid(), prompt_id: p.id, user_id: p.user_id, version_number: p.version,
    title: p.title, content: p.content, description: p.description, category_id: p.category_id,
    platform: p.platform, notes: p.notes, tag_ids: [...p.tag_ids], collection_ids: [...p.collection_ids],
    change_note: note, created_at: p.updated_at || nowISO(),
  };
}

/** Restore never destroys history: it produces the NEXT version with old content. */
export function applyVersion(current: Prompt, v: PromptVersion): Prompt {
  return {
    ...current, title: v.title, content: v.content, description: v.description,
    category_id: v.category_id, platform: v.platform, notes: v.notes,
    tag_ids: [...v.tag_ids], collection_ids: [...v.collection_ids],
    version: current.version + 1, updated_at: nowISO(),
  };
}

export function changedFields(a: PromptVersion, b: PromptVersion): string[] {
  const out: string[] = [];
  if (a.title !== b.title) out.push('title');
  if (a.content !== b.content) out.push('content');
  if (a.description !== b.description) out.push('description');
  if (a.category_id !== b.category_id) out.push('category');
  if (a.platform !== b.platform) out.push('platform');
  if (a.notes !== b.notes) out.push('notes');
  if (JSON.stringify([...a.tag_ids].sort()) !== JSON.stringify([...b.tag_ids].sort())) out.push('tags');
  if (JSON.stringify([...a.collection_ids].sort()) !== JSON.stringify([...b.collection_ids].sort())) out.push('collections');
  return out;
}
