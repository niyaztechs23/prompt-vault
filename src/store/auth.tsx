import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from '../lib/supabase';

interface AuthApi {
  configured: boolean; loading: boolean; user: User | null; session: Session | null; recovery: boolean;
  displayName: string;
  signUp: (email: string, password: string, name: string) => Promise<{ needsVerify: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  clearRecovery: () => void;
}
const Ctx = createContext<AuthApi | null>(null);
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('AuthProvider missing'); return c; };

function friendly(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/already registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.';
  if (/password should be/i.test(msg)) return 'Password must be at least 8 characters.';
  if (/email not confirmed/i.test(msg)) return 'Please verify your email first — check your inbox for the confirmation link.';
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCloudConfigured);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const api: AuthApi = {
    configured: isCloudConfigured, loading, user, session, recovery,
    displayName: (user?.user_metadata?.display_name as string) || user?.email?.split('@')[0] || 'Local user',
    async signUp(email, password, name) {
      if (!supabase) throw new Error('Cloud is not configured.');
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
      if (error) throw new Error(friendly(error.message));
      return { needsVerify: !data.session };
    },
    async signIn(email, password) {
      if (!supabase) throw new Error('Cloud is not configured.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(friendly(error.message));
    },
    async signOut() { if (supabase) { const { error } = await supabase.auth.signOut(); if (error) throw new Error(error.message); } },
    async sendReset(email) {
      if (!supabase) throw new Error('Cloud is not configured.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` });
      if (error) throw new Error(friendly(error.message));
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Cloud is not configured.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(friendly(error.message));
      setRecovery(false);
    },
    async updateDisplayName(name) {
      if (!supabase || !user) throw new Error('Sign in to update your profile.');
      const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
      if (error) throw new Error(friendly(error.message));
      await supabase.from('profiles').update({ display_name: name, updated_at: new Date().toISOString() }).eq('id', user.id);
    },
    clearRecovery: () => setRecovery(false),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
