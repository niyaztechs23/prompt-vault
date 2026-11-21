import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from '../lib/diff';

describe('diffLines', () => {
  it('marks identical text as unchanged', () => {
    const rows = diffLines('a\nb\nc', 'a\nb\nc');
    expect(rows.every(r => r.type === 'same')).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
  });
  it('detects pure additions', () => {
    const rows = diffLines('a\nc', 'a\nb\nc');
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0 });
    expect(rows.find(r => r.type === 'add')?.text).toBe('b');
  });
  it('detects pure removals', () => {
    const rows = diffLines('a\nb\nc', 'a\nc');
    expect(diffStats(rows)).toEqual({ added: 0, removed: 1 });
  });
  it('detects modifications as remove+add', () => {
    const rows = diffLines('hello world', 'hello vault');
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
  });
  it('handles empty inputs', () => {
    expect(diffStats(diffLines('', 'x'))).toEqual({ added: 1, removed: 1 });
    expect(diffLines('', '').length).toBe(1);
  });
  it('preserves order in a mixed edit', () => {
    const rows = diffLines('a\nb\nc\nd', 'a\nx\nc\nd\ne');
    expect(rows.map(r => r.text)).toEqual(['a', 'b', 'x', 'c', 'd', 'e']);
    expect(rows.map(r => r.type)).toEqual(['same', 'del', 'add', 'same', 'same', 'add']);
  });
  it('falls back gracefully on huge inputs', () => {
    const big = Array.from({ length: 2500 }, (_, i) => `line ${i}`).join('\n');
    const rows = diffLines(big, big + '\nextra');
    expect(rows.length).toBeGreaterThan(0);
  });
});
