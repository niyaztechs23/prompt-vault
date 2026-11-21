import { describe, expect, it } from 'vitest';
import { applyVersion, changedFields, versionFrom } from '../lib/versions';
import { makePrompt } from './helpers';

describe('version control', () => {
  it('snapshots all relevant fields', () => {
    const p = makePrompt({ tag_ids: ['t1'], collection_ids: ['c1'], notes: 'n', description: 'd' });
    const v = versionFrom(p, 'Created');
    expect(v.version_number).toBe(p.version);
    expect(v.title).toBe(p.title); expect(v.content).toBe(p.content);
    expect(v.description).toBe('d'); expect(v.notes).toBe('n');
    expect(v.tag_ids).toEqual(['t1']); expect(v.collection_ids).toEqual(['c1']);
    expect(v.change_note).toBe('Created');
  });
  it('restore produces the NEXT version and preserves identity/usage', () => {
    const p = makePrompt({ version: 4, usage_count: 12, is_favorite: true });
    const old = versionFrom(makePrompt({ version: 1, content: 'original content', title: 'Original title' }), 'Created');
    old.prompt_id = p.id;
    const restored = applyVersion(p, old);
    expect(restored.version).toBe(5);
    expect(restored.id).toBe(p.id);
    expect(restored.content).toBe('original content');
    expect(restored.title).toBe('Original title');
    expect(restored.usage_count).toBe(12);
    expect(restored.is_favorite).toBe(true);
  });
  it('a full edit→edit→restore chain keeps every historical state reachable', () => {
    let p = makePrompt({ content: 'v1 content' });
    const history = [versionFrom(p, 'Created')];
    p = { ...p, content: 'v2 content', version: 2 }; history.push(versionFrom(p, 'edit 1'));
    p = { ...p, content: 'v3 content', version: 3 }; history.push(versionFrom(p, 'edit 2'));
    const restored = applyVersion(p, history[0]);
    history.push(versionFrom(restored, 'Restored from v1'));
    expect(history.map(v => v.version_number)).toEqual([1, 2, 3, 4]);
    expect(history[3].content).toBe('v1 content');
    expect(history[1].content).toBe('v2 content');
    expect(history[2].content).toBe('v3 content');
  });
  it('reports changed fields between snapshots', () => {
    const a = versionFrom(makePrompt(), 'a');
    const b = versionFrom(makePrompt({ title: 'New', content: 'x', tag_ids: ['t2'] }), 'b');
    expect(changedFields(a, b)).toEqual(expect.arrayContaining(['title', 'content', 'tags']));
    expect(changedFields(a, a)).toEqual([]);
  });
});
