import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Vault, LayoutDashboard, Files, Star, Pin, FolderOpen, Shapes, Wand2, History, Trash2, Settings,
  Search, Plus, Menu, X, Cloud, CloudOff, HardDrive, RefreshCw, AlertTriangle, LogOut, LogIn, User, Check,
  Users, MessagesSquare, Share2,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { cx, IconBtn, Kbd, Dropdown, MenuItem, Button } from './ui';
import { initials, errMsg } from '../lib/utils';
import { GlobalModals } from './GlobalModals';

const NAV_GROUPS = [
  { label: 'YOUR VAULT', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/prompts', label: 'All Prompts', icon: Files, count: 'total' },
    { to: '/favorites', label: 'Favorites', icon: Star, count: 'favorites' },
    { to: '/pinned', label: 'Pinned Prompts', icon: Pin, count: 'pinned' },
    { to: '/collections', label: 'Collections', icon: FolderOpen },
    { to: '/categories', label: 'Categories', icon: Shapes },
  ] },
  { label: 'WITH OTHERS', items: [
    { to: '/friends', label: 'Friends', icon: Users },
    { to: '/teams', label: 'Teams', icon: MessagesSquare },
    { to: '/shared', label: 'Shared Prompts', icon: Share2 },
    { to: '/engineer', label: 'AI Prompt Engineer', icon: Wand2 },
  ] },
  { label: 'ARCHIVE', items: [
    { to: '/history', label: 'Prompt History', icon: History },
    { to: '/trash', label: 'Trash', icon: Trash2, count: 'trashed' },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
] as const;

function SyncChip() {
  const vault = useVault();
  const { sync, mode } = vault;
  const map = {
    local: { icon: <HardDrive size={13} />, label: 'Local vault', cls: 'text-muted' },
    idle: { icon: <><Cloud size={13} /><Check size={10} className="-ml-1" /></>, label: 'Synced', cls: 'text-mint' },
    saving: { icon: <RefreshCw size={13} className="animate-spin" />, label: 'Syncing…', cls: 'text-sky' },
    offline: { icon: <CloudOff size={13} />, label: 'Offline', cls: 'text-gold' },
    error: { icon: <AlertTriangle size={13} />, label: 'Sync error', cls: 'text-rose' },
  } as const;
  const s = mode === 'local' ? map.local : map[sync === 'idle' ? 'idle' : sync];
  return (
    <button onClick={() => void vault.reload()} title={mode === 'local' ? 'Stored in this browser (IndexedDB). Sign in to sync across devices.' : 'Click to sync now'}
      className={cx('hidden sm:flex items-center gap-1.5 chip cursor-pointer hover:border-accent/40', s.cls)}>{s.icon}<span>{s.label}</span></button>
  );
}

export function Layout() {
  const auth = useAuth();
  const vault = useVault();
  const ui = useUI();
  const toast = useToast();
  const nav = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.setPalette(!ui.palette); }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); ui.openEditor(); }
      else if (!mod && !typing && e.key.toLowerCase() === 'n' && !ui.editor.open && !ui.palette) { e.preventDefault(); ui.openEditor(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-[76px] shrink-0 border-b border-line">
        <div className="w-9 h-9 rounded-xl bg-accent text-white dark:text-[#18201B] flex items-center justify-center shadow-sm relative"><Vault size={18} /><span className="absolute w-2 h-2 rounded-full bg-rose right-0.5 top-0.5 border-2 border-accent" /></div>
        <div>
          <div className="font-display font-bold text-[17px] tracking-tight text-ink leading-none">Prompt Vault</div>
          <div className="text-[10px] text-muted mt-1">Ideas, kept close.</div>
        </div>
        <IconBtn label="Close menu" className="ml-auto lg:hidden" onClick={() => setMobileNav(false)}><X size={16} /></IconBtn>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6" aria-label="Main navigation">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="eyebrow px-3 mb-2">{group.label}</div>
            <div className="space-y-1">{group.items.map(item => (
              <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : undefined} onClick={() => setMobileNav(false)}
                className={({ isActive }) => cx('nav-item', isActive && 'nav-active')}>
                <item.icon size={16} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {'count' in item && item.count && vault.stats[item.count as keyof typeof vault.stats] > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface2 text-muted tabular-nums">{vault.stats[item.count as keyof typeof vault.stats]}</span>
                )}
              </NavLink>
            ))}</div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-line shrink-0">
        {auth.user ? (
          <div className="rounded-2xl p-3 bg-surface2/70 border border-line">
            <div className="text-xs font-medium text-ink truncate">{auth.displayName}</div>
            <div className="text-[10px] text-muted truncate">{auth.user.email}</div>
            <div className="text-[10px] text-mint mt-1 flex items-center gap-1"><Cloud size={10} />Cloud sync active</div>
          </div>
        ) : (
          <button onClick={() => nav('/auth')} className="rounded-2xl w-full p-3 text-left hover:border-accent/40 transition bg-surface2/70 border border-line">
            <div className="text-xs font-medium text-ink flex items-center gap-1.5"><HardDrive size={12} className="text-gold" />Local mode</div>
            <div className="text-[10px] text-muted mt-0.5">Sign in to sync across devices →</div>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-shell bg-bg text-ink">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 border-r border-line bg-surface z-40">{sidebar}</aside>
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface border-r border-line animate-fade">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-[76px] border-b border-line bg-bg/95 backdrop-blur flex items-center gap-3 px-4 lg:px-8">
          <IconBtn label="Open menu" className="lg:hidden" onClick={() => setMobileNav(true)}><Menu size={18} /></IconBtn>
          <button onClick={() => ui.setPalette(true)}
            className="flex items-center gap-2 input h-11 max-w-xl flex-1 text-muted hover:border-accent/40 transition text-left">
            <Search size={15} /><span className="flex-1 text-sm truncate">Find a prompt, idea, or note…</span><Kbd>⌘K</Kbd>
          </button>
          <div className="flex-1 hidden md:block" />
          <SyncChip />
          <Button variant="primary" size="sm" onClick={() => ui.openEditor()} title="New prompt (Ctrl/Cmd+N)"><Plus size={14} /><span className="hidden sm:inline">Add Prompt</span></Button>
          <Dropdown width="w-56" trigger={
            <button aria-label="Account menu" className="w-10 h-10 rounded-2xl bg-accent text-white dark:text-[#18201B] text-xs font-bold flex items-center justify-center hover:opacity-90 transition">
              {auth.user ? initials(auth.displayName) : <User size={14} />}
            </button>}>
            {close => (<>
              <div className="px-3 py-2 border-b border-line mb-1">
                <div className="text-sm font-medium text-ink truncate">{auth.user ? auth.displayName : 'Local mode'}</div>
                <div className="text-xs text-muted truncate">{auth.user?.email ?? 'Data stored in this browser'}</div>
              </div>
              <MenuItem icon={<Settings size={14} />} onClick={() => { close(); nav('/settings'); }}>Settings</MenuItem>
              {auth.user ? (
                <MenuItem icon={<LogOut size={14} />} onClick={async () => { close(); try { await auth.signOut(); toast.info('Signed out. You are now in local mode.'); } catch (e) { toast.error(errMsg(e)); } }}>Sign out</MenuItem>
              ) : (
                <MenuItem icon={<LogIn size={14} />} onClick={() => { close(); nav('/auth'); }}>Sign in / Create account</MenuItem>
              )}
            </>)}
          </Dropdown>
        </header>
        <main className="px-4 lg:px-10 py-8 max-w-[1480px] mx-auto pb-28">
          {vault.loadError ? (
            <div className="card p-8 text-center max-w-lg mx-auto mt-10">
              <AlertTriangle className="text-rose mx-auto mb-3" size={28} />
              <h2 className="font-display font-semibold mb-1">Could not load your vault</h2>
              <p className="text-sm text-muted mb-4">{vault.loadError}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="primary" onClick={vault.retryInit}><RefreshCw size={14} />Retry</Button>
                {auth.user && <Button onClick={() => void auth.signOut()}>Use local mode</Button>}
              </div>
            </div>
          ) : <Outlet />}
        </main>
      </div>
      <GlobalModals />
    </div>
  );
}
