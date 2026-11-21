import { describe, expect, it } from 'vitest';
import { buildSeed, ensureSeeded, STARTER_001_CONTENT, STARTER_002_CONTENT } from '../lib/seed';
import { PRESET_CATEGORIES } from '../types';
import { emptySnapshot, FakeAdapter } from './helpers';

describe('starter library', () => {
  it('preserves the exact required wording', () => {
    expect(STARTER_001_CONTENT).toBe('Use only the syllabus I provided. Help me get oriented to this course. Summarize what the course is about, the most important dates and deadlines, major assignments or exams, recurring expectations, and the three things I should pay attention to first. Flag anything that is unclear or that I should verify in the syllabus.');
    expect(STARTER_002_CONTENT).toBe('Ask me three short questions together about the most important information in this overview, then wait for my answers. After I answer, tell me what I understood correctly and name one point I should review. If one answer shows a gap, explain what I missed, ask me to answer that question again in my own words, wait for my second answer, then check it before you finish. Use only the syllabus.');
    expect(STARTER_001_CONTENT).not.toMatch(/[“”‘’]/);
  });
  it('builds all 11 predefined categories and both starter prompts in Study & Education', () => {
    const seed = buildSeed('u1');
    expect(seed.categories.length).toBe(PRESET_CATEGORIES.length);
    expect(seed.prompts.length).toBe(2);
    const study = seed.categories.find(c => c.name === 'Study & Education')!;
    for (const p of seed.prompts) {
      expect(p.category_id).toBe(study.id);
      expect(p.version).toBe(1);
      expect(p.deleted_at).toBeNull();
    }
    expect(seed.prompts[0].title).toBe('Syllabus Orientation & Course Understanding');
    expect(seed.prompts[1].title).toBe('Study Material Understanding Check');
    expect(seed.versions.length).toBe(2);
  });
  it('seeds exactly once, even across repeated sign-ins / devices', async () => {
    const adapter = new FakeAdapter();
    const first = await ensureSeeded(adapter, emptySnapshot(), 'u1');
    expect(first.prompts.length).toBe(2);
    expect(first.settings.seeded).toBe(true);
    const second = await ensureSeeded(adapter, await adapter.load(), 'u1');
    expect(second.prompts.length).toBe(2);
    const stale = emptySnapshot();
    const third = await ensureSeeded(adapter, stale, 'u1');
    expect(third.prompts.length).toBe(2);
    expect(adapter.snap.prompts.length).toBe(2);
  });
});
