import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
export const cx = clsx;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; size?: 'sm' | 'md'; loading?: boolean };
export function Button({ variant = 'ghost', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none active:scale-[.98]',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-accent text-white dark:text-[#18201B] hover:bg-accent-hover shadow-glow',
        variant === 'ghost' && 'bg-surface2 text-ink border border-line hover:border-accent/40 hover:bg-accent-soft',
        variant === 'subtle' && 'text-muted hover:text-ink hover:bg-surface2',
        variant === 'danger' && 'bg-rose/10 text-rose border border-rose/30 hover:bg-rose/20',
        className,
      )}
      disabled={disabled || loading} {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  );
}

export function IconBtn({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label}
      className={cx('p-1.5 rounded-md text-muted hover:text-ink hover:bg-surface2 transition outline-none focus-visible:ring-2 focus-visible:ring-accent/50', className)}
      {...rest}>{children}</button>
  );
}

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx('input', className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx('input resize-y', className)} {...p} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className={cx('relative', className)}>
    <select className="input appearance-none pr-8 cursor-pointer" {...p}>{children}</select>
    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
  </div>
);
export const Field = ({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) => (
  <div><label className="label">{label}</label>{children}
    {error ? <p className="text-xs text-rose mt-1">{error}</p> : hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
  </div>
);

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative w-9 h-5 rounded-full transition shrink-0', checked ? 'bg-accent' : 'bg-surface2 border border-line')}>
      <span className={cx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface2 text-[10px] font-mono text-muted">{children}</kbd>
);
export const Badge = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx('chip', className)}>{children}</span>;
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx('animate-spin text-accent', className)} size={20} />;
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cx('rounded-xl bg-surface2 animate-shimmer', className)}
    style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(168,197,154,.16), transparent)', backgroundSize: '400px 100%' }} />
);

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 flex flex-col items-center text-center gap-3 animate-fade">
      <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center">{icon}</div>
      <h3 className="font-display font-semibold text-ink">{title}</h3>
      {hint && <p className="text-sm text-muted max-w-sm">{hint}</p>}
      {action}
    </div>
  );
}

/* ── Modal with focus trap, Escape, scroll lock ── */
export function Modal({ open, onClose, title, children, footer, wide, full }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; full?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = boxRef.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
      (el ?? boxRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && boxRef.current) {
        const items = [...boxRef.current.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); document.body.style.overflow = ''; window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={boxRef} tabIndex={-1}
        className={cx('relative card shadow-pop w-full flex flex-col animate-rise max-h-[92vh] sm:max-h-[86vh] rounded-b-none sm:rounded-xl outline-none',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg', full && 'sm:max-w-5xl')}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <h2 className="font-display font-semibold text-ink text-[15px]">{title}</h2>
          <IconBtn label="Close dialog" onClick={onClose} data-close><X size={16} /></IconBtn>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-line flex items-center justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Promise-based confirm ── */
interface ConfirmOpts { title: string; message: ReactNode; confirmText?: string; danger?: boolean; requireText?: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = (o: ConfirmOpts) => new Promise<boolean>(res => { resolver.current = res; setTyped(''); setOpts(o); });
  const done = (v: boolean) => { resolver.current(v); setOpts(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => done(false)} title={opts?.title ?? ''}
        footer={<>
          <Button variant="subtle" onClick={() => done(false)}>Cancel</Button>
          <Button variant={opts?.danger === false ? 'primary' : 'danger'} onClick={() => done(true)}
            disabled={!!opts?.requireText && typed !== opts.requireText}>{opts?.confirmText ?? 'Confirm'}</Button>
        </>}>
        <div className="text-sm text-muted leading-relaxed">{opts?.message}</div>
        {opts?.requireText && (
          <div className="mt-3">
            <label className="label">Type “{opts.requireText}” to confirm</label>
            <Input value={typed} onChange={e => setTyped(e.target.value)} autoFocus />
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ── Dropdown menu ── */
export function Dropdown({ trigger, children, align = 'right', width = 'w-52' }: { trigger: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); align?: 'left' | 'right'; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{trigger}</div>
      {open && (
        <div className={cx('absolute z-50 mt-1 card shadow-pop p-1.5 animate-fade max-h-72 overflow-y-auto', width, align === 'right' ? 'right-0' : 'left-0')}
          onClick={e => e.stopPropagation()}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
export const MenuItem = ({ icon, children, danger, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; danger?: boolean }) => (
  <button className={cx('menu-item', danger && 'text-rose hover:bg-rose/10')} {...rest}>{icon}{children}</button>
);
