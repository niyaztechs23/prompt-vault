import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NewPromptInput, Prompt } from '../types';

interface EditorState { open: boolean; promptId?: string; prefill?: Partial<NewPromptInput> }
interface UIApi {
  editor: EditorState;
  openEditor: (opts?: { promptId?: string; prefill?: Partial<NewPromptInput> }) => void;
  closeEditor: () => void;
  detail: { id: string; tab: 'overview' | 'history' } | null;
  openDetail: (id: string, tab?: 'overview' | 'history') => void;
  closeDetail: () => void;
  palette: boolean; setPalette: (v: boolean) => void;
  importOpen: boolean; setImportOpen: (v: boolean) => void;
  promptPicker: { title: string; onPick: (p: Prompt) => void } | null;
  openPromptPicker: (title: string, onPick: (p: Prompt) => void) => void;
  closePromptPicker: () => void;
}
const Ctx = createContext<UIApi | null>(null);
export const useUI = () => { const c = useContext(Ctx); if (!c) throw new Error('UIProvider missing'); return c; };

export function UIProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [detail, setDetail] = useState<UIApi['detail']>(null);
  const [palette, setPalette] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [promptPicker, setPromptPicker] = useState<UIApi['promptPicker']>(null);
  const api = useMemo<UIApi>(() => ({
    editor,
    openEditor: (opts) => setEditor({ open: true, promptId: opts?.promptId, prefill: opts?.prefill }),
    closeEditor: () => setEditor({ open: false }),
    detail, openDetail: (id, tab = 'overview') => setDetail({ id, tab }), closeDetail: () => setDetail(null),
    palette, setPalette, importOpen, setImportOpen,
    promptPicker, openPromptPicker: (title, onPick) => setPromptPicker({ title, onPick }), closePromptPicker: () => setPromptPicker(null),
  }), [editor, detail, palette, importOpen, promptPicker]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
