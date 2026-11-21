import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Vault, Mail, Lock, User, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles, History, Cloud, ShieldCheck } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { Button, Field, Input, cx } from './_shared';
import { errMsg } from '../lib/utils';

type View = 'signin' | 'signup' | 'forgot' | 'reset';

export function Auth() {
  const auth = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [name, setName] = useState(''); const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (auth.recovery) setView('reset'); }, [auth.recovery]);
  useEffect(() => { if (auth.user && !auth.recovery) nav('/', { replace: true }); }, [auth.user, auth.recovery, nav]);

  const submit = async () => {
    setError(''); setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && view !== 'reset') { setError('Enter a valid email address.'); return; }
    if (view !== 'forgot' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if ((view === 'signup' || view === 'reset') && password !== confirmPw) { setError('Passwords do not match.'); return; }
    if (view === 'signup' && name.trim().length < 2) { setError('Enter your display name.'); return; }
    setBusy(true);
    try {
      if (view === 'signin') { await auth.signIn(email, password); toast.success('Welcome back!'); nav('/'); }
      else if (view === 'signup') {
        const { needsVerify } = await auth.signUp(email, password, name.trim());
        if (needsVerify) setNotice('Account created! Check your inbox and click the verification link, then sign in.');
        else { toast.success('Account created — welcome to Prompt Vault!'); nav('/'); }
      }
      else if (view === 'forgot') { await auth.sendReset(email); setNotice('If that email exists, a password reset link is on its way. Check your inbox.'); }
      else { await auth.updatePassword(password); toast.success('Password updated. You are signed in.'); nav('/'); }
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      <div className="hidden lg:flex w-[44%] bg-surface border-r border-line flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-sky/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-card"><Vault size={20} className="text-white" /></div>
          <div><div className="font-display font-bold text-lg tracking-tight">PROMPT VAULT</div><div className="text-xs text-muted">Your AI Prompts. Organized. Optimized. Always Ready.</div></div>
        </div>
        <div className="relative space-y-5">
          {[
            { icon: Sparkles, title: 'AI Prompt Engineer', text: 'Improve, generate, rewrite and analyze prompts with a secure server-side AI backend.' },
            { icon: History, title: 'Full version history', text: 'Every save is a version. Compare diffs and restore safely — nothing is ever lost.' },
            { icon: Cloud, title: 'Sync across devices', text: 'Your library follows you, with conflict detection and local-first fallback.' },
            { icon: ShieldCheck, title: 'Private by design', text: 'Row Level Security ensures only you can ever read your prompts.' },
          ].map(f => (
            <div key={f.title} className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0"><f.icon size={16} /></div>
              <div><div className="text-sm font-semibold text-ink">{f.title}</div><div className="text-xs text-muted mt-0.5 leading-relaxed">{f.text}</div></div>
            </div>
          ))}
        </div>
        <p className="relative text-[11px] text-muted">Students · Developers · Designers · Researchers · Creators</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-xs text-muted hover:text-accent flex items-center gap-1 mb-6"><ArrowLeft size={12} />Continue in local mode</Link>
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center"><Vault size={16} className="text-white" /></div>
            <span className="font-display font-bold">PROMPT VAULT</span>
          </div>

          {!auth.configured ? (
            <div className="card p-6">
              <AlertTriangle className="text-gold mb-3" size={22} />
              <h1 className="font-display font-bold text-lg mb-2">Cloud sync not configured</h1>
              <p className="text-sm text-muted leading-relaxed mb-4">
                Authentication and cloud sync require a Supabase project. Add <code className="text-accent">VITE_SUPABASE_URL</code> and <code className="text-accent">VITE_SUPABASE_ANON_KEY</code> to your <code className="text-accent">.env</code>, apply the SQL migration, and restart the dev server. Full steps are in the README.
              </p>
              <p className="text-sm text-muted mb-4">Meanwhile, the entire app works in local mode — prompts, versions, search, collections, backups and more.</p>
              <Link to="/"><Button variant="primary" className="w-full">Use local mode</Button></Link>
            </div>
          ) : (<>
            {view !== 'reset' && view !== 'forgot' && (
              <div className="flex card p-1 mb-5">
                {(['signin', 'signup'] as const).map(v => (
                  <button key={v} onClick={() => { setView(v); setError(''); setNotice(''); }}
                    className={cx('flex-1 py-2 text-sm font-medium rounded-lg transition', view === v ? 'bg-accent text-white' : 'text-muted hover:text-ink')}>
                    {v === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
            )}
            <h1 className="font-display font-bold text-xl mb-1">
              {view === 'signin' ? 'Welcome back' : view === 'signup' ? 'Create your vault' : view === 'forgot' ? 'Reset your password' : 'Set a new password'}
            </h1>
            <p className="text-sm text-muted mb-5">
              {view === 'signin' ? 'Sign in to sync your prompts across devices.' : view === 'signup' ? 'Free, private, and ready in seconds.' : view === 'forgot' ? 'We will email you a secure reset link.' : 'Choose a new password for your account.'}
            </p>
            {error && <div className="card border-rose/40 bg-rose/10 p-3 text-sm text-rose mb-4 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</div>}
            {notice && <div className="card border-mint/40 bg-mint/10 p-3 text-sm text-ink mb-4 flex gap-2"><CheckCircle2 size={15} className="text-mint shrink-0 mt-0.5" />{notice}</div>}
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
              {view === 'signup' && <Field label="Display name"><div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" /></div></Field>}
              {view !== 'reset' && <Field label="Email"><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div></Field>}
              {view !== 'forgot' && <Field label={view === 'reset' ? 'New password' : 'Password'}><div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete={view === 'signin' ? 'current-password' : 'new-password'} /></div></Field>}
              {(view === 'signup' || view === 'reset') && <Field label="Confirm password"><div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" /></div></Field>}
              <Button variant="primary" className="w-full" loading={busy} type="submit">
                {view === 'signin' ? 'Sign in' : view === 'signup' ? 'Create account' : view === 'forgot' ? 'Send reset link' : 'Update password'}
              </Button>
            </form>
            <div className="flex justify-between mt-4 text-xs">
              {view === 'signin' && <button className="text-accent hover:underline" onClick={() => { setView('forgot'); setError(''); setNotice(''); }}>Forgot password?</button>}
              {(view === 'forgot' || view === 'reset') && <button className="text-accent hover:underline" onClick={() => { setView('signin'); auth.clearRecovery(); setError(''); setNotice(''); }}>Back to sign in</button>}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
