import { describe, expect, it } from 'vitest';
import { filterPrompts, matchPrompt, searchPrompts, sortPrompts, splitHighlight } from '../lib/search';
import { makePrompt } from './helpers';

const ctx = { categoryName: (id: string | null) => (id === 'c1' ? 'Programming & Development' : 'Uncategorized'), tagNames: (ids: string[]) => ids.map(i => (i === 't1' ? 'react' : 'other')) };

describe('search', () => {
  it('matches title, description, content, category and tags', () => {
    expect(matchPrompt(makePrompt({ title: 'React reviewer' }), 'react', ctx)!.score).toBeGreaterThanOrEqual(5);
    expect(matchPrompt(makePrompt({ description: 'checks hooks' }), 'HOOKS', ctx)!.score).toBe(3);
    expect(matchPrompt(makePrompt({ content: 'explain monads slowly' }), 'monads', ctx)!.score).toBe(1);
    expect(matchPrompt(makePrompt({ category_id: 'c1' }), 'programming', ctx)!.score).toBe(2);
    expect(matchPrompt(makePrompt({ tag_ids: ['t1'] }), 'react', ctx)!.score).toBe(3);
  });
  it('returns null for non-matches and a content snippet', () => {
    expect(matchPrompt(makePrompt(), 'zzzznope', ctx)).toBeNull();
    const hit = matchPrompt(makePrompt({ title: 'unrelated', content: 'x'.repeat(100) + ' needle ' + 'y'.repeat(100) }), 'needle', ctx)!;
    expect(hit.snippet).toContain('needle');
    expect(hit.snippet!.startsWith('…')).toBe(true);
  });
  it('ranks title matches above content matches', () => {
    const a = makePrompt({ id: 'a', title: 'needle title' });
    const b = makePrompt({ id: 'b', title: 'other', content: 'has needle inside' });
    expect(searchPrompts([b, a], 'needle', ctx)[0].prompt.id).toBe('a');
  });
  it('highlights safely with regex characters', () => {
    const parts = splitHighlight('cost is $5.00 (net)', '$5.00');
    expect(parts.find(p => p.hit)?.text).toBe('$5.00');
    expect(splitHighlight('abc', '').length).toBe(1);
  });
  it('sorts by every key', () => {
    const a = makePrompt({ id: 'a', title: 'Zebra', usage_count: 5, is_favorite: false, is_pinned: true, created_at: '2026-01-01', updated_at: '2026-01-01' });
    const b = makePrompt({ id: 'b', title: 'Alpha', usage_count: 9, is_favorite: true, is_pinned: false, created_at: '2026-02-01', updated_at: '2026-02-01' });
    expect(sortPrompts([a, b], 'title')[0].id).toBe('b');
    expect(sortPrompts([a, b], 'usage')[0].id).toBe('b');
    expect(sortPrompts([a, b], 'created')[0].id).toBe('b');
    expect(sortPrompts([a, b], 'updated')[0].id).toBe('b');
    expect(sortPrompts([a, b], 'favorites')[0].id).toBe('b');
    expect(sortPrompts([a, b], 'pinned')[0].id).toBe('a');
  });
  it('combines filters with search', () => {
    const list = [
      makePrompt({ id: 'a', title: 'react hooks', category_id: 'c1', tag_ids: ['t1'], platform: 'ChatGPT' }),
      makePrompt({ id: 'b', title: 'react class', category_id: 'c1', tag_ids: [], platform: 'Claude' }),
      makePrompt({ id: 'c', title: 'react native', category_id: null, tag_ids: ['t1'], platform: 'ChatGPT' }),
    ];
    const hits = filterPrompts(list, { q: 'react', categoryId: 'c1', tagId: 't1', platform: 'ChatGPT' }, ctx);
    expect(hits.map(h => h.prompt.id)).toEqual(['a']);
  });
});
