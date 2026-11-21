import type { Prompt, SortKey } from '../types';
import { escapeReg, norm } from './utils';

export interface SearchCtx { categoryName: (id: string | null) => string; tagNames: (ids: string[]) => string[] }
export interface SearchHit { prompt: Prompt; score: number; snippet: string | null }

export function matchPrompt(p: Prompt, q: string, ctx: SearchCtx): SearchHit | null {
  const needle = norm(q);
  if (!needle) return { prompt: p, score: 0, snippet: null };
  let score = 0;
  if (norm(p.title).includes(needle)) score += 5;
  if (norm(p.description).includes(needle)) score += 3;
  if (ctx.tagNames(p.tag_ids).some(t => norm(t).includes(needle))) score += 3;
  if (norm(ctx.categoryName(p.category_id)).includes(needle)) score += 2;
  const idx = p.content.toLowerCase().indexOf(needle);
  if (idx >= 0) score += 1;
  if (score === 0) return null;
  let snippet: string | null = null;
  if (idx >= 0 && !norm(p.title).includes(needle)) {
    const start = Math.max(0, idx - 50), end = Math.min(p.content.length, idx + needle.length + 70);
    snippet = (start > 0 ? '…' : '') + p.content.slice(start, end).replace(/\n+/g, ' ') + (end < p.content.length ? '…' : '');
  }
  return { prompt: p, score, snippet };
}

export function searchPrompts(prompts: Prompt[], q: string, ctx: SearchCtx): SearchHit[] {
  return prompts.map(p => matchPrompt(p, q, ctx)).filter((h): h is SearchHit => !!h)
    .sort((a, b) => b.score - a.score || b.prompt.updated_at.localeCompare(a.prompt.updated_at));
}

export function splitHighlight(text: string, q: string): { text: string; hit: boolean }[] {
  if (!q.trim()) return [{ text, hit: false }];
  const re = new RegExp(`(${escapeReg(q.trim())})`, 'ig');
  return text.split(re).filter(s => s !== '').map(s => ({ text: s, hit: s.toLowerCase() === q.trim().toLowerCase() }));
}

export function sortPrompts(prompts: Prompt[], sort: SortKey): Prompt[] {
  const arr = [...prompts];
  switch (sort) {
    case 'created': return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'title': return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'usage': return arr.sort((a, b) => b.usage_count - a.usage_count || b.updated_at.localeCompare(a.updated_at));
    case 'favorites': return arr.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || b.updated_at.localeCompare(a.updated_at));
    case 'pinned': return arr.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at));
    default: return arr.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

export interface Filters { q: string; categoryId: string; tagId: string; platform: string }
export function filterPrompts(prompts: Prompt[], f: Filters, ctx: SearchCtx): SearchHit[] {
  let list = prompts;
  if (f.categoryId) list = list.filter(p => p.category_id === f.categoryId);
  if (f.tagId) list = list.filter(p => p.tag_ids.includes(f.tagId));
  if (f.platform) list = list.filter(p => p.platform === f.platform);
  return searchPrompts(list, f.q, ctx);
}
