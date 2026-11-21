// PROMPT VAULT · secure AI gateway (Supabase Edge Function, Deno)
// Secrets: AI_API_KEY (required), AI_BASE_URL, AI_MODEL, AI_RATE_LIMIT_PER_HOUR, ALLOWED_ORIGIN
// Deploy: supabase functions deploy ai   ·   Secrets: supabase secrets set AI_API_KEY=sk-...
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const STYLES = ['Professional', 'Simple', 'Detailed', 'Creative', 'Technical', 'Beginner-friendly', 'Concise'];
const MAX_PROMPT = 24000, MAX_GOAL = 4000, MAX_MSGS = 24;

const SYSTEM_BASE = `You are Prompt Vault's expert prompt engineer. You craft precise, effective prompts for AI assistants.
Always respond with ONLY a valid JSON object — no markdown fences, no commentary outside JSON.`;

function buildRequest(body: any): { messages: { role: string; content: string }[]; temperature: number; maxTokens: number } {
  const mode = body.mode;
  const platform = typeof body.platform === 'string' && body.platform !== 'Any' ? ` Target platform: ${body.platform}.` : '';
  switch (mode) {
    case 'improve':
      return {
        temperature: 0.4, maxTokens: 2200,
        messages: [{ role: 'system', content: `${SYSTEM_BASE}
Task: improve the user's prompt. Improve clarity, remove ambiguity, add missing context placeholders, strengthen instructions, define the expected output format, and improve structure — while preserving the user's intent.${platform}
Return JSON: {"prompt": "<the full improved prompt>", "explanation": "<2-4 sentences on what you changed and why>"}` },
        { role: 'user', content: body.prompt }],
      };
    case 'generate':
      return {
        temperature: 0.6, maxTokens: 2200,
        messages: [{ role: 'system', content: `${SYSTEM_BASE}
Task: write a complete, structured, ready-to-use prompt that achieves the user's goal. Include role, context, step-by-step instructions, constraints and expected output format.${platform}
Return JSON: {"prompt": "<the full generated prompt>", "explanation": "<1-3 sentences on how to use it>"}` },
        { role: 'user', content: body.goal }],
      };
    case 'rewrite':
      return {
        temperature: body.style === 'Creative' ? 0.8 : 0.4, maxTokens: 2200,
        messages: [{ role: 'system', content: `${SYSTEM_BASE}
Task: rewrite the user's prompt in a "${body.style}" style. Preserve every important instruction and the original intent.
Return JSON: {"prompt": "<the rewritten prompt>", "explanation": "<1-2 sentences>"}` },
        { role: 'user', content: body.prompt }],
      };
    case 'analyze':
      return {
        temperature: 0.2, maxTokens: 2000,
        messages: [{ role: 'system', content: `${SYSTEM_BASE}
Task: critically analyze the user's prompt. Be specific and honest; assessments are subjective guidance, not guarantees.
Return JSON exactly: {"analysis": {"clarity": "<2-3 sentence assessment>", "missing_information": ["..."], "ambiguities": ["..."], "weak_instructions": ["..."], "suggestions": ["..."], "recommended_structure": "<outline as plain text with line breaks>"}}` },
        { role: 'user', content: body.prompt }],
      };
    case 'variations':
      return {
        temperature: 0.75, maxTokens: 3200,
        messages: [{ role: 'system', content: `${SYSTEM_BASE}
Task: produce ${body.count} genuinely different alternative versions of the user's prompt, each exploring a distinct approach (e.g. structured, Socratic, concise, example-driven, role-based).
Return JSON: {"variations": [{"label": "<short name>", "focus": "<2-4 word approach>", "prompt": "<full alternative prompt>"}]} with exactly ${body.count} items.` },
        { role: 'user', content: body.prompt }],
      };
    case 'chat':
      return {
        temperature: 0.5, maxTokens: 2200,
        messages: [
          { role: 'system', content: `${SYSTEM_BASE}
You are iteratively refining a prompt with the user. The CURRENT prompt is below. Apply the user's latest instruction while preserving important existing requirements unless explicitly told to drop them.
CURRENT PROMPT:
"""
${body.prompt}
"""
Return JSON: {"prompt": "<the full revised prompt>", "reply": "<1-2 sentence conversational summary of what you changed>"}` },
          ...body.messages.map((m: any) => ({ role: m.role, content: m.content })),
        ],
      };
    default:
      throw new Error('unknown mode');
  }
}

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch { /* continue */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* continue */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed', code: 'bad_request' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization.', code: 'unauthorized' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid or expired session. Sign in again.', code: 'unauthorized' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body.', code: 'bad_request' }, 400); }

  const apiKey = Deno.env.get('AI_API_KEY');
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  const baseUrl = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');

  if (body.mode === 'status') return json({ configured: !!apiKey, model });
  if (!apiKey) return json({ error: 'The AI provider is not configured on the server. The owner must set the AI_API_KEY secret.', code: 'not_configured' }, 501);

  // ── Validation ──
  const modes = ['improve', 'generate', 'rewrite', 'analyze', 'variations', 'chat'];
  if (!modes.includes(body.mode)) return json({ error: 'Unknown mode.', code: 'bad_request' }, 400);
  const str = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (body.mode === 'generate') { if (!str(body.goal, MAX_GOAL)) return json({ error: 'Goal must be 1–4000 characters.', code: 'bad_request' }, 400); }
  else if (!str(body.prompt, MAX_PROMPT)) return json({ error: 'Prompt must be 1–24000 characters.', code: 'bad_request' }, 400);
  if (body.mode === 'rewrite' && !STYLES.includes(body.style)) return json({ error: 'Invalid style.', code: 'bad_request' }, 400);
  if (body.mode === 'variations') {
    body.count = Number(body.count);
    if (!Number.isInteger(body.count) || body.count < 2 || body.count > 5) return json({ error: 'Count must be 2–5.', code: 'bad_request' }, 400);
  }
  if (body.mode === 'chat') {
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MSGS)
      return json({ error: 'Messages must be a non-empty array (max 24).', code: 'bad_request' }, 400);
    for (const m of body.messages)
      if (!['user', 'assistant'].includes(m.role) || !str(m.content, 8000)) return json({ error: 'Invalid message.', code: 'bad_request' }, 400);
  }

  // ── Rate limit (per user, per hour) ──
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const limit = Number(Deno.env.get('AI_RATE_LIMIT_PER_HOUR') ?? 30);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countError } = await service.from('ai_request_log')
    .select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', hourAgo);
  if (countError) return json({ error: 'Rate limiter unavailable.', code: 'server_error' }, 500);
  if ((count ?? 0) >= limit) return json({ error: `Hourly AI limit reached (${limit}/hour). Try again later.`, code: 'rate_limited' }, 429);
  await service.from('ai_request_log').insert({ user_id: user.id });

  // ── Provider call ──
  let messages, temperature, maxTokens;
  try { ({ messages, temperature, maxTokens } = buildRequest(body)); }
  catch { return json({ error: 'Could not build the request.', code: 'bad_request' }, 400); }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let providerRes: Response;
  try {
    providerRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    });
  } catch {
    clearTimeout(timeout);
    return json({ error: 'The AI provider is unreachable or timed out. Try again shortly.', code: 'provider_unavailable' }, 502);
  }
  clearTimeout(timeout);

  if (!providerRes.ok) {
    if (providerRes.status === 401 || providerRes.status === 403)
      return json({ error: 'The provider rejected the server API key. The owner should verify AI_API_KEY.', code: 'provider_auth' }, 502);
    if (providerRes.status === 429)
      return json({ error: 'The AI provider is rate-limiting requests. Try again in a moment.', code: 'provider_rate_limited' }, 429);
    return json({ error: `The AI provider returned an error (${providerRes.status}).`, code: 'provider_error' }, 502);
  }

  let content = '';
  try { const data = await providerRes.json(); content = data.choices?.[0]?.message?.content ?? ''; }
  catch { return json({ error: 'Unexpected provider response.', code: 'provider_error' }, 502); }

  const parsed = extractJSON(content);
  const out: Record<string, unknown> = { mode: body.mode, model };

  if (body.mode === 'analyze') {
    const a = parsed?.analysis;
    if (!a || typeof a.clarity !== 'string') return json({ error: 'The model returned an unexpected analysis format. Try again.', code: 'provider_format' }, 502);
    const arr = (v: unknown) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    out.analysis = {
      clarity: a.clarity, missing_information: arr(a.missing_information), ambiguities: arr(a.ambiguities),
      weak_instructions: arr(a.weak_instructions), suggestions: arr(a.suggestions),
      recommended_structure: typeof a.recommended_structure === 'string' ? a.recommended_structure : '',
    };
  } else if (body.mode === 'variations') {
    const vs = parsed?.variations;
    if (!Array.isArray(vs) || !vs.length) return json({ error: 'The model returned no variations. Try again.', code: 'provider_format' }, 502);
    out.variations = vs.filter((v: any) => typeof v?.prompt === 'string')
      .map((v: any, i: number) => ({ label: String(v.label ?? `Variation ${i + 1}`), focus: String(v.focus ?? 'alternative'), prompt: v.prompt }));
  } else {
    const prompt = typeof parsed?.prompt === 'string' && parsed.prompt.trim() ? parsed.prompt : (parsed ? null : content.trim());
    if (!prompt) return json({ error: 'The model returned an empty result. Try again.', code: 'provider_format' }, 502);
    out.prompt = prompt;
    if (typeof parsed?.explanation === 'string') out.explanation = parsed.explanation;
    if (typeof parsed?.reply === 'string') out.reply = parsed.reply;
  }
  return json(out);
});
