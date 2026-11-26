import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Wand2, Sparkles, PenLine, Stethoscope, Layers, MessageSquare, Copy, Save, RefreshCw,
  BookOpen, Send, RotateCcw, GitCompare, Tag, FolderOpen, AlertTriangle, CheckCircle2, Info, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Prompt } from '../types';
import { PLATFORMS, REWRITE_STYLES } from '../types';
import { useVault, useCopyText } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { useAuth } from '../store/auth';
import { getAIStatus, runAI, AIError, type AIStatus, type AIResponse, type Variation } from '../services/ai';
import { Button, Badge, Select, Textarea, useConfirm, cx, Modal } from './_shared';
import { CompareModal } from '../components/VersionCompare';
import { CollectionChecklist, TagPicker } from '../components/pickers';
import { wordCount } from '../lib/utils';

type Mode = 'improve' | 'generate' | 'rewrite' | 'analyze' | 'variations' | 'chat';
const MODES: { id: Mode; label: string; icon: any; desc: string }[] = [
  { id: 'improve', label: 'Improve', icon: Sparkles, desc: 'Analyze and strengthen an existing prompt.' },
  { id: 'generate', label: 'Generate', icon: Wand2, desc: 'Describe a goal — get a complete, structured prompt.' },
  { id: 'rewrite', label: 'Rewrite', icon: PenLine, desc: 'Rewrite a prompt in a chosen style.' },
  { id: 'analyze', label: 'Analyze', icon: Stethoscope, desc: 'Find weaknesses, gaps and ambiguities.' },
  { id: 'variations', label: 'Variations', icon: Layers, desc: 'Generate alternative approaches.' },
  { id: 'chat', label: 'Refine Chat', icon: MessageSquare, desc: 'Iterate with follow-up instructions.' },
];

function SetupCard({ status, recheck }: { status: AIStatus; recheck: () => void }) {
  const auth = useAuth();
  if (status.state === 'ready') return null;
  return (
    <div className="card p-5 border-gold/40 bg-gold/5 animate-rise">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-gold shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-display font-semibold text-ink text-sm">AI is not available yet</h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">{status.message}</p>
          <ol className="text-xs text-muted mt-3 space-y-1 list-decimal pl-4">
            <li>Create a Supabase project and apply <code className="text-accent">supabase/migrations/0001_init.sql</code>.</li>
            <li>Deploy the function: <code className="text-accent">supabase functions deploy ai</code></li>
            <li>Set <code className="text-accent">AI_API_KEY</code> in Supabase Dashboard → Edge Functions → Secrets. Never put it in Vercel or a <code className="text-accent">VITE_</code> variable. Groq is the default provider.</li>
            <li>Full instructions in the project README → “AI provider configuration”.</li>
          </ol>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={recheck}><RefreshCw size={13} />Re-check status</Button>
            {status.state === 'signed_out' && auth.configured && <Link to="/auth"><Button size="sm" variant="primary">Sign in</Button></Link>}
          </div>
          <p className="text-[11px] text-muted mt-3">All non-AI features (library, versions, search, backup, sync) work fully without AI.</p>
        </div>
      </div>
    </div>
  );
}

/** Every AI result gets: copy, save new, update existing, tags, collections. */
function ResultActions({ text, title, compact }: { text: string; title: string; compact?: boolean }) {
  const vault = useVault();
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const copyText = useCopyText();
  const [meta, setMeta] = useState<{ tag_ids: string[]; collection_ids: string[] }>({ tag_ids: [], collection_ids: [] });
  const [metaOpen, setMetaOpen] = useState<'tags' | 'collections' | null>(null);

  const saveNew = () => ui.openEditor({ prefill: { title: title.slice(0, 80), content: text, description: 'Created with the AI Prompt Engineer.', tag_ids: meta.tag_ids, collection_ids: meta.collection_ids } });
  const updateExisting = () => ui.openPromptPicker('Update which prompt?', async (p: Prompt) => {
    const ok = await confirm({
      title: `Replace “${p.title}”?`, danger: false, confirmText: 'Update prompt',
      message: <>The AI result becomes the new content (v{p.version + 1}). The current version is preserved in history.</>,
    });
    if (!ok) return;
    const done = await vault.updatePrompt(p.id, {
      content: text, tag_ids: [...new Set([...p.tag_ids, ...meta.tag_ids])],
      collection_ids: [...new Set([...p.collection_ids, ...meta.collection_ids])],
    }, 'Updated from AI Prompt Engineer');
    if (done) toast.success(`“${p.title}” updated — previous content saved as v${p.version}.`);
  });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Button size="sm" variant="primary" onClick={() => void copyText(text)}><Copy size={13} />Copy</Button>
      <Button size="sm" onClick={saveNew}><Save size={13} />Save as new</Button>
      <Button size="sm" onClick={updateExisting}><RefreshCw size={13} />Update existing</Button>
      <Button size="sm" variant="subtle" onClick={() => setMetaOpen('tags')} className={cx(meta.tag_ids.length && 'text-accent')}><Tag size={13} />Tags{meta.tag_ids.length ? ` (${meta.tag_ids.length})` : ''}</Button>
      <Button size="sm" variant="subtle" onClick={() => setMetaOpen('collections')} className={cx(meta.collection_ids.length && 'text-accent')}><FolderOpen size={13} />Collections{meta.collection_ids.length ? ` (${meta.collection_ids.length})` : ''}</Button>
      {!compact && <span className="text-[10px] text-muted ml-auto tabular-nums">{wordCount(text)} words</span>}
      <Modal open={!!metaOpen} onClose={() => setMetaOpen(null)} title={metaOpen === 'tags' ? 'Tags for this result' : 'Collections for this result'}
        footer={<Button variant="primary" onClick={() => setMetaOpen(null)}>Done</Button>}>
        <p className="text-xs text-muted mb-3">Applied when you save this result as a new prompt or update an existing one.</p>
        {metaOpen === 'tags'
          ? <TagPicker value={meta.tag_ids} onChange={ids => setMeta(m => ({ ...m, tag_ids: ids }))} />
          : <CollectionChecklist value={meta.collection_ids} onChange={ids => setMeta(m => ({ ...m, collection_ids: ids }))} />}
      </Modal>
    </div>
  );
}

function PromptBlock({ text, max = 260 }: { text: string; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 900;
  return (
    <div className="relative">
      <pre className={cx('card p-3 font-mono text-[12px] whitespace-pre-wrap break-words text-ink leading-relaxed bg-surface2/50 overflow-y-auto transition-all')}
        style={{ maxHeight: expanded ? 'none' : max }}>{text}</pre>
      {long && <button className="text-[11px] text-accent mt-1 flex items-center gap-1 hover:underline" onClick={() => setExpanded(e => !e)}>
        {expanded ? <><ChevronUp size={11} />Collapse</> : <><ChevronDown size={11} />Show full prompt</>}</button>}
    </div>
  );
}

export function Engineer() {
  const ui = useUI();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [mode, setMode] = useState<Mode>(() => MODES.some(m => m.id === requestedMode) ? requestedMode as Mode : 'improve');
  const [source, setSource] = useState('');
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState<string>(REWRITE_STYLES[0]);
  const [platform, setPlatform] = useState('Any');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string; la: string; lb: string } | null>(null);
  const [varSel, setVarSel] = useState<number[]>([]);
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'assistant'; content: string; prompt?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');

  const recheck = () => { setStatus(null); getAIStatus().then(setStatus); };
  useEffect(() => { getAIStatus().then(setStatus); }, []);
  const ready = status?.state === 'ready';
  const cfg = MODES.find(m => m.id === mode)!;

  const loadFromLibrary = (target: 'source' | 'chat') => ui.openPromptPicker('Load a prompt from your library', p => {
    if (target === 'source') setSource(p.content); else { setChatPrompt(p.content); setChatMsgs([]); }
    toast.info(`Loaded “${p.title}”.`);
  });

  const run = async () => {
    setError(null); setResult(null); setVarSel([]);
    setBusy(true);
    try {
      let res: AIResponse;
      if (mode === 'generate') res = await runAI({ mode, goal, platform });
      else if (mode === 'rewrite') res = await runAI({ mode, prompt: source, style });
      else if (mode === 'variations') res = await runAI({ mode, prompt: source, count });
      else if (mode === 'chat') {
        const instruction = chatInput.trim() || 'Improve this prompt.';
        const history = chatMsgs.map(m => ({ role: m.role, content: m.role === 'assistant' ? (m.prompt ?? m.content) : m.content }));
        res = await runAI({ mode, prompt: chatPrompt, messages: [...history, { role: 'user', content: instruction }] });
        setChatMsgs(m => [...m, { role: 'user', content: instruction }, { role: 'assistant', content: res.reply ?? 'Here is the revised prompt.', prompt: res.prompt }]);
        setChatPrompt(res.prompt ?? chatPrompt);
        setChatInput('');
        setBusy(false);
        return;
      }
      else res = await runAI({ mode, prompt: source, platform } as any);
      setResult(res);
    } catch (e) {
      setError(e instanceof AIError ? e.message : e instanceof Error ? e.message : 'The AI request failed.');
    } finally { setBusy(false); }
  };

  const canRun = ready && !busy && (mode === 'generate' ? goal.trim().length > 5 : mode === 'chat' ? chatPrompt.trim().length > 5 : source.trim().length > 5);
  const analysis = result?.analysis;

  const variationCompare = () => {
    const vs = result?.variations ?? [];
    if (varSel.length === 2) setCompare({ a: vs[varSel[0]].prompt, b: vs[varSel[1]].prompt, la: vs[varSel[0]].label, lb: vs[varSel[1]].label });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-bold text-ink flex items-center gap-2"><Wand2 size={20} className="text-accent" />AI Prompt Engineer</h1>
          <p className="text-sm text-muted mt-0.5">Improve, generate, rewrite, analyze and refine prompts with a real AI backend.</p>
        </div>
        {status?.state === 'ready'
          ? <Badge className="text-mint border-mint/30 bg-mint/10"><CheckCircle2 size={11} />Provider ready · {status.model}</Badge>
          : status ? <Badge className="text-gold border-gold/30 bg-gold/10"><AlertTriangle size={11} />Not configured</Badge>
          : <Badge><Loader2 size={11} className="animate-spin" />Checking provider…</Badge>}
      </div>
      {status && status.state !== 'ready' && <SetupCard status={status} recheck={recheck} />}

      <div className="card p-3 flex items-start gap-2 border-sky/20 bg-sky/5 text-xs text-muted leading-relaxed">
        <Info size={14} className="text-sky shrink-0 mt-0.5" />
        <p>Saving prompts does not send them anywhere. When you run an AI action, the submitted prompt and context are sent to the configured provider (Groq by default). Groq says inference data is not retained by default, but may be logged for reliability or abuse investigations for up to 30 days; its <a className="text-accent underline" href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">data controls</a> include Zero Data Retention. Avoid sensitive or confidential content unless you are comfortable with the provider's current terms.</p>
      </div>

      <section aria-label="Choose an engineering mode" className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Choose a mode</h2>
          <p className="hidden sm:block text-[11px] text-muted">Select a task to configure its inputs</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2" role="group" aria-label="Prompt engineering modes">
          {MODES.map(m => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setError(null); }}
              className={cx('group min-h-[76px] text-left rounded-xl border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg', mode === m.id ? 'bg-accent-soft border-accent/50 text-accent shadow-sm' : 'card hover:border-accent/30 hover:bg-surface2/50')}>
              <span className="flex items-center gap-2 text-xs font-semibold"><m.icon size={14} aria-hidden="true" />{m.label}</span>
              <span className="mt-1.5 block text-[10px] leading-snug text-muted">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <div className="card border-rose/40 bg-rose/10 p-3.5 flex items-start gap-2 text-sm animate-rise"><AlertTriangle size={15} className="text-rose shrink-0 mt-0.5" /><span className="text-ink">{error}</span></div>}

      {mode === 'chat' ? (
        <div className="card p-4 sm:p-5 space-y-4">
          {!chatMsgs.length && (<>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-ink">Start a refinement session</h3>
              <Button size="sm" variant="subtle" onClick={() => loadFromLibrary('chat')}><BookOpen size={13} />Load from library</Button></div>
            <label className="block space-y-1.5"><span className="label">Prompt to refine</span><Textarea aria-label="Prompt to refine" rows={6} className="font-mono text-[12.5px]" placeholder="Paste the prompt you want to refine…" value={chatPrompt} onChange={e => setChatPrompt(e.target.value)} /></label>
          </>)}
          {chatMsgs.length > 0 && (<>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-ink">Conversation ({chatMsgs.filter(m => m.role === 'user').length} refinements)</h3>
              <Button size="sm" variant="subtle" onClick={() => { setChatMsgs([]); setChatPrompt(''); }}><RotateCcw size={13} />Start over</Button>
            </div>
            <div className="card p-3 bg-surface2/40"><div className="label mb-1">Current prompt</div><PromptBlock text={chatPrompt} max={160} />
              <div className="mt-2"><ResultActions text={chatPrompt} title="Refined prompt" compact /></div></div>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {chatMsgs.map((m, i) => (
                <div key={i} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-accent text-white' : 'card bg-surface2/60 text-ink')}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.prompt && <div className="mt-2"><PromptBlock text={m.prompt} max={140} /><div className="mt-2"><ResultActions text={m.prompt} title="Refined prompt" compact /></div></div>}
                  </div>
                </div>
              ))}
            </div>
          </>)}
          <div className="flex flex-col sm:flex-row gap-2">
            <Textarea aria-label="Refinement instruction" className="min-w-0 flex-1" rows={2} placeholder={chatMsgs.length ? 'e.g. Make it shorter but preserve the important instructions…' : 'First instruction, e.g. “Make this prompt more professional”'}
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canRun) void run(); }} />
            <Button variant="primary" className="self-end w-full sm:w-auto" disabled={!canRun} loading={busy} onClick={() => void run()}><Send size={14} />Send</Button>
          </div>
          <p className="text-[10px] text-muted">Context is kept within this session. Ctrl/Cmd+Enter to send.</p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-4 items-start">
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5"><cfg.icon size={15} className="text-accent" />{cfg.label}</h3>
              {mode !== 'generate' && <Button size="sm" variant="subtle" onClick={() => loadFromLibrary('source')}><BookOpen size={13} />Load from library</Button>}
            </div>
            <p className="text-xs text-muted">{cfg.desc}</p>
            {mode === 'generate' ? (
              <label className="block space-y-1.5"><span className="label">What should the prompt accomplish?</span><Textarea aria-label="Goal for the generated prompt" rows={6} placeholder={'Describe what you want to achieve…\n\ne.g. "I want an AI to teach me C programming from beginner level."'}
                value={goal} onChange={e => setGoal(e.target.value)} /></label>
            ) : (
              <label className="block space-y-1.5"><span className="label">Prompt to {cfg.label.toLowerCase()}</span><Textarea aria-label={`Prompt to ${cfg.label.toLowerCase()}`} rows={9} className="font-mono text-[12.5px]" placeholder="Paste or type the prompt to work on…" value={source} onChange={e => setSource(e.target.value)} /></label>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {mode === 'rewrite' && <div className="flex items-center gap-2"><span className="text-xs text-muted">Style</span>
                <Select className="w-44" value={style} onChange={e => setStyle(e.target.value)}>{REWRITE_STYLES.map(s => <option key={s}>{s}</option>)}</Select></div>}
              {(mode === 'generate' || mode === 'improve') && <div className="flex items-center gap-2"><span className="text-xs text-muted">Target</span>
                <Select className="w-32" value={platform} onChange={e => setPlatform(e.target.value)}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</Select></div>}
              {mode === 'variations' && <div className="flex items-center gap-2"><span className="text-xs text-muted">Alternatives</span>
                <div className="flex items-center card overflow-hidden">
                  <button className="px-2.5 py-1 text-sm text-muted hover:text-ink" onClick={() => setCount(c => Math.max(2, c - 1))} aria-label="Fewer variations">−</button>
                  <span className="px-2 text-sm font-semibold text-ink tabular-nums">{count}</span>
                  <button className="px-2.5 py-1 text-sm text-muted hover:text-ink" onClick={() => setCount(c => Math.min(5, c + 1))} aria-label="More variations">+</button>
                </div></div>}
              <Button variant="primary" className="w-full sm:w-auto sm:ml-auto" disabled={!canRun} loading={busy} onClick={() => void run()}>
                <Sparkles size={14} />{busy ? 'Working…' : `Run ${cfg.label}`}
              </Button>
            </div>
            {mode !== 'generate' && <p className="text-[10px] text-muted text-right tabular-nums">{wordCount(source)} words · {source.length} chars</p>}
          </div>

          <div className="space-y-3">
            {busy && <div className="card p-8 text-center text-sm text-muted animate-fade"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={22} />The model is thinking…</div>}
            {!busy && !result && !error && (
              <div className="card p-8 text-center text-sm text-muted">
                <cfg.icon className="mx-auto text-accent/60 mb-2" size={24} />
                Results appear here. Every result can be copied, saved as a new prompt, or used to update an existing one.
              </div>
            )}
            {result?.prompt && (mode === 'improve' || mode === 'rewrite' || mode === 'generate') && (
              <div className="card p-4 space-y-3 animate-rise">
                <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-mint" /><h3 className="text-sm font-semibold text-ink">{mode === 'generate' ? 'Generated prompt' : mode === 'rewrite' ? `Rewritten — ${style}` : 'Improved prompt'}</h3><Badge className="ml-auto">{result.model}</Badge></div>
                {mode !== 'generate' && source && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <div><div className="label">Original</div><PromptBlock text={source} max={200} /></div>
                    <div><div className="label text-accent">Improved</div><PromptBlock text={result.prompt} max={200} /></div>
                  </div>
                )}
                {mode === 'generate' && <PromptBlock text={result.prompt} />}
                {result.explanation && <div className="card p-3 bg-sky/5 border-sky/30 text-xs text-muted flex gap-2"><Info size={14} className="text-sky shrink-0 mt-0.5" /><span>{result.explanation}</span></div>}
                {mode !== 'generate' && source && <Button size="sm" variant="subtle" onClick={() => setCompare({ a: source, b: result.prompt!, la: 'Original', lb: 'Improved' })}><GitCompare size={13} />Side-by-side diff</Button>}
                <ResultActions text={result.prompt} title={mode === 'generate' ? goal.slice(0, 60) : 'Improved prompt'} />
              </div>
            )}
            {analysis && mode === 'analyze' && (
              <div className="space-y-3 animate-rise">
                {([
                  ['Clarity assessment', analysis.clarity, null],
                  ['Missing information', null, analysis.missing_information],
                  ['Ambiguities', null, analysis.ambiguities],
                  ['Weak instructions', null, analysis.weak_instructions],
                  ['Suggested improvements', null, analysis.suggestions],
                ] as const).map(([title, text, list]) => (
                  <div key={title} className="card p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">{title}</h4>
                    {text && <p className="text-sm text-ink leading-relaxed">{text}</p>}
                    {list && (list.length ? <ul className="text-sm text-muted space-y-1 list-disc pl-4">{list.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="text-sm text-muted">None found.</p>)}
                  </div>
                ))}
                <div className="card p-4"><h4 className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">Recommended structure</h4>
                  <pre className="text-xs font-mono text-muted whitespace-pre-wrap">{analysis.recommended_structure}</pre></div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] text-muted flex items-center gap-1"><Info size={11} />AI assessments are subjective guidance, not objective guarantees.</p>
                  <Button size="sm" variant="primary" onClick={() => { setMode('improve'); }}><Sparkles size={13} />Improve this prompt</Button>
                </div>
              </div>
            )}
            {result?.variations && mode === 'variations' && (
              <div className="space-y-3 animate-rise">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted flex-1">Select two variations to compare them.</p>
                  <Button size="sm" disabled={varSel.length !== 2} onClick={variationCompare}><GitCompare size={13} />Compare selected</Button>
                </div>
                {result.variations.map((v: Variation, i: number) => (
                  <div key={i} className={cx('card p-4 space-y-2 transition', varSel.includes(i) && 'border-accent/60 ring-2 ring-accent/15')}>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" className="accent-[#28513F]" checked={varSel.includes(i)}
                          onChange={() => setVarSel(s => s.includes(i) ? s.filter(x => x !== i) : [...s.slice(-1), i])} />
                        <span className="text-sm font-semibold text-ink">{v.label}</span>
                      </label>
                      <Badge>{v.focus}</Badge>
                    </div>
                    <PromptBlock text={v.prompt} max={180} />
                    <ResultActions text={v.prompt} title={v.label} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {compare && <CompareModal open onClose={() => setCompare(null)} a={compare.a} b={compare.b} aLabel={compare.la} bLabel={compare.lb} />}
    </div>
  );
}
