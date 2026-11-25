import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Vault, Mail, Lock, User, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles, History, Cloud, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useToast } from '../store/toast';
import { Button, Field, Input, cx } from './_shared';
import { errMsg } from '../lib/utils';

type View = 'signin' | 'signup' | 'forgot' | 'reset';

function googleAuthErrorMessage(code: string, description: string): string {
  const reason = `${code} ${description}`.toLowerCase();
  if (/access_denied|cancel|denied by user/.test(reason)) return 'Google sign-in was cancelled. You can try again or continue with email.';
  if (/redirect_uri_mismatch/.test(reason)) return 'Google sign-in could not be completed because its redirect is not configured. Please try email sign-in or contact support.';
  if (/provider_disabled|provider is not enabled|invalid_client|unauthorized_client/.test(reason)) return 'Google sign-in is temporarily unavailable. Please try email sign-in or contact support.';
  return 'Google sign-in could not be completed. Please try again or continue with email.';
}

export function Auth() {
  const auth = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [name, setName] = useState(''); const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { if (auth.recovery) setView('reset'); }, [auth.recovery]);
  useEffect(() => { if (auth.user && !auth.recovery) nav('/', { replace: true }); }, [auth.user, auth.recovery, nav]);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get('error_code') || hash.get('error') || search.get('error_code') || search.get('error') || '';
    const description = hash.get('error_description') || search.get('error_description') || '';
    if (!code && !description) return;
    setGoogleBusy(false);
    setError(googleAuthErrorMessage(code, description));
    for (const params of [search, hash]) {
      for (const key of ['error', 'error_code', 'error_description', 'error_uri']) params.delete(key);
    }
    const nextUrl = `${window.location.pathname}${search.size ? `?${search}` : ''}${hash.size ? `#${hash}` : ''}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, []);

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

  const continueWithGoogle = async () => {
    setError(''); setNotice(''); setGoogleBusy(true);
    try { await auth.signInWithGoogle(); }
    catch (e) { setError(googleAuthErrorMessage('', errMsg(e))); setGoogleBusy(false); }
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
            {error && <div role="alert" aria-live="assertive" className="card border-rose/40 bg-rose/10 p-3 text-sm text-rose mb-4 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />{error}</div>}
            {notice && <div className="card border-mint/40 bg-mint/10 p-3 text-sm text-ink mb-4 flex gap-2"><CheckCircle2 size={15} className="text-mint shrink-0 mt-0.5" />{notice}</div>}
            {(view === 'signin' || view === 'signup') && <>
              <button type="button" onClick={() => void continueWithGoogle()} disabled={busy || googleBusy} aria-busy={googleBusy}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent/50 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                {googleBusy ? <><Loader2 size={18} aria-hidden="true" className="animate-spin" />Connecting to Google…</> : <><svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.47-4.76 7.16l7.73 6C44.42 37.93 46.98 31.8 46.98 24.55Z" />
                  <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19Z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.82l-7.73-6c-2.14 1.44-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
                </svg>Continue with Google</>}
              </button>
              <div className="flex items-center gap-3 my-5 text-[11px] text-muted" aria-hidden="true"><span className="h-px flex-1 bg-line" /><span>or use email</span><span className="h-px flex-1 bg-line" /></div>
            </>}
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
              {view === 'signup' && <Field label="Display name"><div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" value={name} onChange={e => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" /></div></Field>}
              {view !== 'reset' && <Field label="Email"><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div></Field>}
              {view !== 'forgot' && <Field label={view === 'reset' ? 'New password' : 'Password'}><div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8 pr-11" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete={view === 'signin' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"><span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>{showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button></div></Field>}
              {(view === 'signup' || view === 'reset') && <Field label="Confirm password"><div className="relative"><Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8 pr-11" type={showConfirmPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowConfirmPw(v => !v)} aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirmPw} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"><span className="sr-only">{showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}</span>{showConfirmPw ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button></div></Field>}
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
