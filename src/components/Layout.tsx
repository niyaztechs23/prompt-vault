import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Vault, LayoutDashboard, Files, Star, Pin, FolderOpen, Shapes, Wand2, History, Trash2, Settings,
  Search, Plus, Menu, X, Cloud, CloudOff, HardDrive, RefreshCw, AlertTriangle, LogOut, LogIn, User,
  Check, Users, MessagesSquare, Share2, Moon, Sun, Monitor,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useVault } from '../store/vault';
import { useUI } from '../store/ui';
import { useToast } from '../store/toast';
import { cx, IconBtn, Kbd, Dropdown, MenuItem, Button } from './ui';
import { initials, errMsg } from '../lib/utils';
import { GlobalModals } from './GlobalModals';

const NAV_GROUPS = [
  { label: 'Workspace', items: [
    { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/prompts', label: 'All prompts', icon: Files, count: 'total' },
    { to: '/collections', label: 'Collections', icon: FolderOpen },
    { to: '/categories', label: 'Categories', icon: Shapes },
  ] },
  { label: 'Saved views', items: [
    { to: '/favorites', label: 'Favorites', icon: Star, count: 'favorites' },
    { to: '/pinned', label: 'Pinned', icon: Pin, count: 'pinned' },
    { to: '/recent', label: 'Recently used', icon: History },
    { to: '/most-used', label: 'Most used', icon: Files },
    { to: '/untagged', label: 'Untagged', icon: Files },
    { to: '/uncategorized', label: 'Uncategorized', icon: Shapes },
  ] },
  { label: 'Create & improve', items: [
    { to: '/engineer', label: 'AI Prompt Engineer', icon: Wand2 },
  ] },
  { label: 'Collaborate', items: [
    { to: '/shared', label: 'Shared prompts', icon: Share2 },
    { to: '/friends', label: 'Friends', icon: Users },
    { to: '/teams', label: 'Teams', icon: MessagesSquare },
  ] },
  { label: 'Account', items: [
    { to: '/history', label: 'History', icon: History },
    { to: '/trash', label: 'Trash', icon: Trash2, count: 'trashed' },
    { to: '/settings', label: 'Settings', icon: Settings },
  ] },
] as const;

function SyncChip() {
  const vault = useVault();
  const { sync, mode } = vault;
  const map = {
    local: { icon: <HardDrive size={13} />, label: 'On this device', cls: 'text-muted' },
    idle: { icon: <><Cloud size={13} /><Check size={10} className="-ml-1" /></>, label: 'Synced', cls: 'text-mint' },
    saving: { icon: <RefreshCw size={13} className="animate-spin" />, label: 'Saving', cls: 'text-sky' },
    offline: { icon: <CloudOff size={13} />, label: 'Offline', cls: 'text-gold' },
    error: { icon: <AlertTriangle size={13} />, label: 'Sync issue', cls: 'text-rose' },
  } as const;
  const state = mode === 'local' ? map.local : map[sync];
  const description = mode === 'local' ? 'Stored in this browser. Sign in to sync across devices.' : 'Select to sync your cloud vault now.';
  return (
    <button type="button" onClick={() => void vault.reload()} title={description}
      className={cx('hidden sm:flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-medium transition hover:border-accent/40', state.cls)}>
      {state.icon}<span>{state.label}</span>
    </button>
  );
}

function ThemeToggle() {
  const vault = useVault();
  const theme = vault.settings.theme;
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <IconBtn label={`Theme: ${theme}. Switch to ${next} theme`} title={`Theme: ${theme} · switch to ${next}`} onClick={() => vault.updateSettings({ theme: next })}>
      <Icon size={16} />
    </IconBtn>
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
      if (e.key === 'Escape' && mobileNav) { setMobileNav(false); return; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.setPalette(!ui.palette); }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); ui.openEditor(); }
      else if (!mod && !typing && e.key.toLowerCase() === 'n' && !ui.editor.open && !ui.palette) { e.preventDefault(); ui.openEditor(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, mobileNav]);

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-accent text-[#18201B] shadow-sm">
          <Vault size={19} aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-coral" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-[17px] font-bold leading-none tracking-tight text-ink">Prompt Vault</div>
          <div className="mt-1 text-[11px] text-muted">A home for useful ideas</div>
        </div>
        <IconBtn label="Close menu" className="ml-auto lg:hidden" onClick={() => setMobileNav(false)}><X size={16} /></IconBtn>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-4">
        <Button variant="primary" className="w-full justify-center" onClick={() => { setMobileNav(false); ui.openEditor(); }} title="New prompt (Ctrl/Cmd+N)">
          <Plus size={15} />New prompt<span className="ml-auto"><Kbd>N</Kbd></span>
        </Button>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {NAV_GROUPS.map(group => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="eyebrow mb-2 px-3">{group.label}</h2>
            <div className="space-y-1">
              {group.items.map(item => (
                <NavLink key={item.to} to={item.to} end={'end' in item ? item.end : undefined} onClick={() => setMobileNav(false)}
                  className={({ isActive }) => cx('nav-item min-h-10', isActive && 'nav-active')}>
                  <item.icon size={16} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {'count' in item && item.count && vault.stats[item.count as keyof typeof vault.stats] > 0 && (
                    <span className="rounded-lg bg-surface2 px-2 py-0.5 text-[10px] tabular-nums text-muted" aria-label={`${vault.stats[item.count as keyof typeof vault.stats]} ${item.label.toLowerCase()}`}>
                      {vault.stats[item.count as keyof typeof vault.stats]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-4">
        {auth.user ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface2/70 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xs font-bold text-accent" aria-hidden="true">{initials(auth.displayName)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-ink">{auth.displayName}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-mint"><Cloud size={10} aria-hidden="true" />Cloud sync active</div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { setMobileNav(false); nav('/auth'); }} className="w-full rounded-2xl border border-line bg-surface2/70 p-3 text-left transition hover:border-accent/40">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink"><HardDrive size={13} className="text-gold" aria-hidden="true" />Local vault</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted">Sign in to sync across devices <span aria-hidden="true">→</span></span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-shell min-h-screen bg-bg text-ink">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-line bg-surface lg:block" aria-label="Workspace sidebar">{sidebar}</aside>
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button type="button" aria-label="Close navigation menu" className="absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,320px)] animate-slidein border-r border-line bg-surface shadow-pop" aria-label="Mobile workspace navigation">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-5 lg:px-8">
          <IconBtn label="Open menu" className="shrink-0 lg:hidden" onClick={() => setMobileNav(true)}><Menu size={18} /></IconBtn>
          <button type="button" onClick={() => ui.setPalette(true)}
            className="input flex h-10 min-w-0 max-w-2xl flex-1 items-center gap-2.5 rounded-xl text-left text-muted transition hover:border-accent/40">
            <Search size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="flex-1 truncate text-xs sm:text-sm">Search prompts, tags, or categories</span>
            <span className="hidden sm:inline-flex"><Kbd>⌘ / Ctrl + K</Kbd></span>
          </button>
          <div className="flex-1" />
          <SyncChip />
          <ThemeToggle />
          <Button variant="primary" size="sm" className="shrink-0" onClick={() => ui.openEditor()} title="New prompt (Ctrl/Cmd+N)">
            <Plus size={14} /><span className="hidden sm:inline">New prompt</span>
          </Button>
          <Dropdown width="w-56" trigger={
            <button type="button" aria-label="Account menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface2 text-xs font-bold text-ink transition hover:border-accent/50 focus-visible:outline">
              {auth.user ? initials(auth.displayName) : <User size={15} aria-hidden="true" />}
            </button>}>
            {close => (<>
              <div className="mb-1 border-b border-line px-3 py-2">
                <div className="truncate text-sm font-semibold text-ink">{auth.user ? auth.displayName : 'Local mode'}</div>
                <div className="truncate text-xs text-muted">{auth.user?.email ?? 'Data stored in this browser'}</div>
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
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-4 py-6 pb-28 sm:px-6 lg:px-9 lg:py-8">
          {vault.loadError ? (
            <div role="alert" className="card mx-auto mt-10 max-w-lg p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 text-rose" size={28} />
              <h2 className="mb-1 font-display font-semibold">Could not load your vault</h2>
              <p className="mb-4 text-sm text-muted">{vault.loadError}</p>
              <div className="flex justify-center gap-2">
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
