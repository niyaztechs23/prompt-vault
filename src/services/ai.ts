import { supabase } from '../lib/supabase';

export type AIRequest =
  | { mode: 'status' }
  | { mode: 'improve'; prompt: string; platform?: string }
  | { mode: 'generate'; goal: string; platform?: string }
  | { mode: 'rewrite'; prompt: string; style: string }
  | { mode: 'analyze'; prompt: string }
  | { mode: 'variations'; prompt: string; count: number }
  | { mode: 'chat'; prompt: string; messages: { role: 'user' | 'assistant'; content: string }[] };

export interface Analysis {
  clarity: string; missing_information: string[]; ambiguities: string[];
  weak_instructions: string[]; suggestions: string[]; recommended_structure: string;
}
export interface Variation { label: string; focus: string; prompt: string }
export interface AIResponse {
  mode: string; model: string;
  prompt?: string; explanation?: string; reply?: string;
  analysis?: Analysis; variations?: Variation[];
}
export type AIStatus =
  | { state: 'ready'; model: string }
  | { state: 'no_backend' | 'signed_out' | 'not_configured' | 'error'; message: string };

export class AIError extends Error { constructor(message: string, public code: string) { super(message); } }

async function invoke(body: AIRequest): Promise<any> {
  if (!supabase) throw new AIError('Cloud backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable AI features.', 'no_backend');
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) {
    let payload: any = null;
    try { payload = await (error as any).context?.json(); } catch { /* non-JSON error body */ }
    const code = payload?.code ?? 'provider_error';
    const msg = payload?.error ?? (code === 'unauthorized' ? 'Your session expired. Sign in again to use AI features.' : 'The AI request failed. Please try again.');
    throw new AIError(msg, code);
  }
  return data;
}

export async function getAIStatus(): Promise<AIStatus> {
  if (!supabase) return { state: 'no_backend', message: 'AI features need the Supabase backend. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then deploy the "ai" Edge Function (see README).' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { state: 'signed_out', message: 'Sign in to use the AI Prompt Engineer. Your local library keeps working without an account.' };
  try {
    const data = await invoke({ mode: 'status' });
    if (!data?.configured) return { state: 'not_configured', message: 'The AI provider is not configured on the server. Set the AI_API_KEY secret on the "ai" Edge Function (see README → AI provider configuration).' };
    return { state: 'ready', model: data.model };
  } catch (e) {
    if (e instanceof AIError && e.code === 'unauthorized') return { state: 'signed_out', message: e.message };
    return { state: 'error', message: e instanceof Error ? e.message : 'Could not reach the AI backend.' };
  }
}

export async function runAI(req: AIRequest): Promise<AIResponse> { return invoke(req) as Promise<AIResponse>; }
