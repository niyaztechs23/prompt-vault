import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { uuid } from '../lib/utils';

interface Toast { id: string; kind: 'success' | 'error' | 'info'; msg: string; action?: { label: string; fn: () => void } }
interface ToastApi { success: (msg: string, action?: Toast['action']) => void; error: (msg: string, action?: Toast['action']) => void; info: (msg: string, action?: Toast['action']) => void }
const Ctx = createContext<ToastApi | null>(null);
export const useToast = () => { const c = useContext(Ctx); if (!c) throw new Error('ToastProvider missing'); return c; };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
    const tm = timers.current.get(id); if (tm) clearTimeout(tm); timers.current.delete(id);
  }, []);
  const push = useCallback((kind: Toast['kind'], msg: string, action?: Toast['action']) => {
    const id = uuid();
    setToasts(t => [...t.slice(-4), { id, kind, msg, action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500));
  }, [dismiss]);
  const api = useRef<ToastApi>({ success: (m, a) => push('success', m, a), error: (m, a) => push('error', m, a), info: (m, a) => push('info', m, a) });
  const icons = { success: <CheckCircle2 size={16} className="text-mint shrink-0" />, error: <AlertTriangle size={16} className="text-rose shrink-0" />, info: <Info size={16} className="text-sky shrink-0" /> };
  return (
    <Ctx.Provider value={api.current}>
      {children}
      <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className="card shadow-pop px-3.5 py-3 flex items-start gap-2.5 animate-rise bg-surface">
            {icons[t.kind]}
            <div className="text-sm text-ink flex-1 break-words">{t.msg}
              {t.action && <button className="ml-2 text-accent font-semibold hover:underline" onClick={() => { t.action!.fn(); dismiss(t.id); }}>{t.action.label}</button>}
            </div>
            <button aria-label="Dismiss notification" className="text-muted hover:text-ink" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
