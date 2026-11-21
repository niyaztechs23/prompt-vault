export type DiffRow = { type: 'same' | 'add' | 'del'; text: string };

/** Line-level LCS diff. Falls back to replace-block for very large inputs. */
export function diffLines(a: string, b: string): DiffRow[] {
  const A = a.split('\n'), B = b.split('\n');
  const m = A.length, n = B.length;
  if (m * n > 4_000_000)
    return [...A.map(text => ({ type: 'del' as const, text })), ...B.map(text => ({ type: 'add' as const, text }))];
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) { rows.push({ type: 'same', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ type: 'del', text: A[i] }); i++; }
    else { rows.push({ type: 'add', text: B[j] }); j++; }
  }
  while (i < m) rows.push({ type: 'del', text: A[i++] });
  while (j < n) rows.push({ type: 'add', text: B[j++] });
  return rows;
}

export const diffStats = (rows: DiffRow[]) => ({
  added: rows.filter(r => r.type === 'add').length,
  removed: rows.filter(r => r.type === 'del').length,
});
