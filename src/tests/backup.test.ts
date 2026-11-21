import { describe, expect, it } from 'vitest';
import { buildBackup, planMerge, toMarkdown, toPlainText, validateBackup } from '../lib/backup';
import { emptySnapshot, makePrompt } from './helpers';
import { versionFrom } from '../lib/versions';

describe('backup validation', () => {
  it('round-trips an exported backup', () => {
    const snap = emptySnapshot();
    const p = makePrompt();
    snap.prompts = [p]; snap.versions = [versionFrom(p, 'Created')];
    snap.categories = [{ id: 'cat1', user_id: 'u1', name: 'Study & Education', color: '#38BDF8', created_at: '2026-01-01' }];
    const env = buildBackup(snap);
    const result = validateBackup(JSON.stringify(env));
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.data.prompts.length).toBe(1); expect(result.data.versions.length).toBe(1); }
  });
  it('rejects malformed JSON and foreign files', () => {
    expect(validateBackup('{nope').ok).toBe(false);
    expect(validateBackup(JSON.stringify({ hello: 'world' })).ok).toBe(false);
    const bad = validateBackup(JSON.stringify({ app: 'prompt-vault', data: { prompts: [{ title: 42 }] } }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.length).toBeGreaterThan(0);
  });
});

describe('merge planning', () => {
  const target = emptySnapshot();
  target.categories = [{ id: 'tc', user_id: 'me', name: 'Study & Education', color: '#38BDF8', created_at: '2026-01-01' }];
  const existing = makePrompt({ id: 'p-exists', title: 'Shared', content: 'same body' });
  target.prompts = [existing];

  const incoming = {
    prompts: [
      { ...makePrompt({ id: 'p-exists', title: 'Shared', content: 'same body' }) },
      { ...makePrompt({ id: 'p-new', title: 'Fresh', content: 'new body', category_id: 'ic', tag_ids: ['it'] }) },
    ],
    categories: [{ id: 'ic', user_id: 'other', name: 'study & education', color: '#fff', created_at: '2026-01-01' }],
    tags: [{ id: 'it', user_id: 'other', name: 'fresh-tag', created_at: '2026-01-01' }],
    collections: [], versions: [], usage: [],
  };

  it('skips duplicates and remaps category by name (case-insensitive)', () => {
    const plan = planMerge(target, incoming as any, 'skip', 'me');
    expect(plan.skipped).toBe(1);
    expect(plan.prompts.length).toBe(1);
    expect(plan.categories.length).toBe(0);
    expect(plan.prompts[0].category_id).toBe('tc');
    expect(plan.prompts[0].user_id).toBe('me');
    expect(plan.tags.length).toBe(1);
    expect(plan.prompts[0].tag_ids).toEqual([plan.tags[0].id]);
  });
  it('imports duplicates as copies with fresh ids when requested', () => {
    const plan = planMerge(target, incoming as any, 'copy', 'me');
    expect(plan.prompts.length).toBe(2);
    expect(new Set(plan.prompts.map(p => p.id)).size).toBe(2);
    expect(plan.prompts.some(p => p.id === 'p-exists')).toBe(false);
  });
  it('never mutates the target snapshot', () => {
    const before = JSON.stringify(target);
    planMerge(target, incoming as any, 'skip', 'me');
    expect(JSON.stringify(target)).toBe(before);
  });
  it('synthesizes a version for imported prompts without history and remaps existing history', () => {
    const withVersions = { ...incoming, versions: [{ ...versionFrom(incoming.prompts[1] as any, 'v1'), prompt_id: 'p-new' }] };
    const plan = planMerge(target, withVersions as any, 'skip', 'me');
    const imported = plan.prompts[0];
    const versions = plan.versions.filter(v => v.prompt_id === imported.id);
    expect(versions.length).toBe(1);
    expect(versions[0].change_note).toBe('v1');
    const noVersions = planMerge(target, incoming as any, 'skip', 'me');
    expect(noVersions.versions[0].change_note).toBe('Imported');
  });
});

describe('text exports', () => {
  it('include titles and full content', () => {
    const snap = emptySnapshot();
    const p = makePrompt({ title: 'My Prompt', content: 'full\nmultiline\nbody' });
    const md = toMarkdown([p], snap); const txt = toPlainText([p], snap);
    expect(md).toContain('# My Prompt'); expect(md).toContain('multiline');
    expect(txt).toContain('My Prompt'); expect(txt).toContain('full\nmultiline\nbody');
  });
});
