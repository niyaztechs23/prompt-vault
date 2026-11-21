import type { DataAdapter, Snapshot } from '../types';
import { PRESET_CATEGORIES } from '../types';
import { nowISO, uuid } from './utils';
import { versionFrom } from './versions';
import { blankPrompt } from './promptFactory';

export const STARTER_001_CONTENT = 'Use only the syllabus I provided. Help me get oriented to this course. Summarize what the course is about, the most important dates and deadlines, major assignments or exams, recurring expectations, and the three things I should pay attention to first. Flag anything that is unclear or that I should verify in the syllabus.';
export const STARTER_002_CONTENT = 'Ask me three short questions together about the most important information in this overview, then wait for my answers. After I answer, tell me what I understood correctly and name one point I should review. If one answer shows a gap, explain what I missed, ask me to answer that question again in my own words, wait for my second answer, then check it before you finish. Use only the syllabus.';

export function buildSeed(userId: string): Omit<Snapshot, 'settings'> {
  const t = nowISO();
  const categories = PRESET_CATEGORIES.map(c => ({ id: uuid(), user_id: userId, name: c.name, color: c.color, created_at: t }));
  const study = categories[0].id;
  const tags = ['study', 'syllabus', 'learning'].map(name => ({ id: uuid(), user_id: userId, name, created_at: t }));
  const p1 = blankPrompt(userId, {
    title: 'Syllabus Orientation & Course Understanding', content: STARTER_001_CONTENT,
    description: 'Understand a provided course syllabus and identify important course requirements, deadlines, assessments, and priorities.',
    category_id: study, platform: 'Any', tag_ids: [tags[0].id, tags[1].id],
  });
  const p2 = blankPrompt(userId, {
    title: 'Study Material Understanding Check', content: STARTER_002_CONTENT,
    description: 'Test understanding through short questions, feedback, review, and retry.',
    category_id: study, platform: 'Any', tag_ids: [tags[0].id, tags[2].id],
  });
  return {
    categories, tags, collections: [], prompts: [p1, p2],
    versions: [versionFrom(p1, 'Created · Starter library'), versionFrom(p2, 'Created · Starter library')],
    usage: [],
  };
}

/** Idempotent: gated by settings.seeded and an atomic claim (cloud-safe across devices). */
export async function ensureSeeded(adapter: DataAdapter, snap: Snapshot, userId: string): Promise<Snapshot> {
  if (snap.settings.seeded) return snap;
  if (!(await adapter.claimSeed())) return adapter.load();
  const seed = buildSeed(userId);
  await adapter.bulkImport(seed);
  const settings = { ...snap.settings, seeded: true };
  await adapter.saveSettings(settings);
  return {
    ...snap, settings,
    categories: [...snap.categories, ...seed.categories], tags: [...snap.tags, ...seed.tags],
    prompts: [...seed.prompts, ...snap.prompts], versions: [...seed.versions, ...snap.versions],
  };
}
