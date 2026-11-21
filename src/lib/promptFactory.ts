import type { NewPromptInput, Prompt } from '../types';
import { nowISO, uuid } from './utils';

export function blankPrompt(userId: string, input: NewPromptInput): Prompt {
  const t = nowISO();
  return {
    id: uuid(), user_id: userId, title: input.title, content: input.content,
    description: input.description ?? '', category_id: input.category_id ?? null,
    platform: input.platform ?? 'Any', notes: input.notes ?? '',
    is_favorite: input.is_favorite ?? false, is_pinned: input.is_pinned ?? false,
    usage_count: 0, last_used_at: null, version: 1,
    created_at: t, updated_at: t, deleted_at: null,
    tag_ids: input.tag_ids ?? [], collection_ids: input.collection_ids ?? [],
  };
}
