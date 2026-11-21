export const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });

export const nowISO = () => new Date().toISOString();
export const norm = (s: string) => s.trim().toLowerCase();
export const promptKey = (p: { title: string; content: string }) => norm(p.title) + '\u0000' + norm(p.content);
export const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
export const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
export const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function download(filename: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong. Please try again.';
}
