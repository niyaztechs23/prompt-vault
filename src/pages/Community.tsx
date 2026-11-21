import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Check, Copy, LockKeyhole, MessageCircle, Plus, Search, Send, Share2, ShieldAlert, ShieldCheck, Users, UserRoundPlus, X } from 'lucide-react';
import { Button, EmptyState, Input, Modal, Select, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../store/auth';
import { useVault } from '../store/vault';
import { useToast } from '../store/toast';
import { useConfirm } from '../components/ui';
import { communityService, type BlockedUser, type Friend, type FriendRequest, type Message, type ProfileHit, type SharedPrompt, type Team, type TeamInvite, type TeamMember } from '../services/communityService';

const COMMUNITY_TABS = [
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/teams', label: 'Teams', icon: MessageCircle },
  { to: '/shared', label: 'Shared with me', icon: Share2 },
];
type Page = 'friends' | 'teams' | 'shared';
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
const face = (person: { display_name?: string; handle?: string | null }) => (person.display_name?.trim() || person.handle || '?').slice(0, 2).toUpperCase();
const mergeMessages = (current: Message[], incoming: Message[]) => {
  const byId = new Map<string, Message>();
  [...current, ...incoming].forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
};

export function Community() {
  const location = useLocation();
  const { id: routeId } = useParams();
  const page: Page = location.pathname.startsWith('/teams') ? 'teams' : location.pathname.startsWith('/shared') ? 'shared' : 'friends';
  const { configured, loading: authLoading, user } = useAuth();
  const vault = useVault();
  const toast = useToast();
  const confirm = useConfirm();
  const refreshRequest = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invitations, setInvitations] = useState<TeamInvite[]>([]);
  const [shares, setShares] = useState<SharedPrompt[]>([]);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [query, setQuery] = useState('');
  const [handle, setHandle] = useState('');
  const [handleValue, setHandleValue] = useState<string | null>(null);
  const [profileLookup, setProfileLookup] = useState<ProfileHit[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersFor, setTeamMembersFor] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [friendModal, setFriendModal] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteHandle, setInviteHandle] = useState('');
  const [promptId, setPromptId] = useState('');
  const [reportReason, setReportReason] = useState('');

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    if (!configured || !user) return;
    setLoading(true); setLoadError('');
    try {
      const [overview, myProfile, allShares, myBlocks] = await Promise.all([
        communityService.overview(),
        communityService.getMyHandle(),
        communityService.listShares(),
        communityService.listBlocks(),
      ]);
      if (requestId !== refreshRequest.current) return;
      setFriends(overview.friends); setRequests(overview.requests); setTeams(overview.teams); setInvitations(overview.invitations);
      setHandleValue(myProfile); setShares(allShares); setBlocks(myBlocks);
      setSelectedFriend(current => page === 'friends' && routeId && overview.friends.some(x => x.user_id === routeId) ? routeId : overview.friends.some(x => x.user_id === current) ? current : overview.friends[0]?.user_id ?? '');
      setSelectedTeam(current => page === 'teams' && routeId && overview.teams.some(x => x.team_id === routeId) ? routeId : overview.teams.some(x => x.team_id === current) ? current : overview.teams[0]?.team_id ?? '');
    } catch (e) { if (requestId === refreshRequest.current) setLoadError(errorText(e)); }
    finally { if (requestId === refreshRequest.current) setLoading(false); }
  }, [configured, page, routeId, user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setMessages([]); setConversationId(''); setHasOlderMessages(false); setLoadError('');
    if (!user || page !== 'friends' || !selectedFriend) return;
    let cancelled = false; let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const id = await communityService.getDirectConversation(selectedFriend);
        if (cancelled) return;
        setConversationId(id);
        try {
          const stop = await communityService.subscribeToDirectMessages(id, m => {
            if (!cancelled && m.conversation_id === id) setMessages(current => mergeMessages(current, [m]));
          });
          if (cancelled) { stop(); return; }
          unsubscribe = stop;
        } catch (e) { if (!cancelled) setLoadError(errorText(e)); }
        const rows = await communityService.directMessages(id);
        if (!cancelled) { setMessages(current => mergeMessages(current, rows)); setHasOlderMessages(rows.length === 100); }
      } catch (e) { if (!cancelled) setLoadError(errorText(e)); }
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [page, selectedFriend, user]);
  useEffect(() => {
    setMessages([]); setHasOlderMessages(false); setTeamMembers([]); setTeamMembersFor(''); setLoadError('');
    if (!user || page !== 'teams' || !selectedTeam) return;
    let cancelled = false; let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        try {
          const stop = await communityService.subscribeToTeamMessages(selectedTeam, m => {
            if (!cancelled && m.team_id === selectedTeam) setMessages(current => mergeMessages(current, [m]));
          });
          if (cancelled) { stop(); return; }
          unsubscribe = stop;
        } catch (e) { if (!cancelled) setLoadError(errorText(e)); }
        const [rows, roster] = await Promise.all([communityService.teamMessages(selectedTeam), communityService.listTeamMembers(selectedTeam)]);
        if (cancelled) return;
        setMessages(current => mergeMessages(current, rows)); setHasOlderMessages(rows.length === 100);
        setTeamMembers(roster); setTeamMembersFor(selectedTeam);
      } catch (e) { if (!cancelled) setLoadError(errorText(e)); }
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [page, selectedTeam, user]);

  const friend = friends.find(x => x.user_id === selectedFriend);
  const team = teams.find(x => x.team_id === selectedTeam);
  const myShares = shares.filter(x => x.owner_id === user?.id);
  const inboundShares = shares.filter(x => x.owner_id !== user?.id && !x.revoked_at);
  const visibleFriends = useMemo(() => friends.filter(x => `${x.display_name} ${x.handle ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [friends, query]);
  const visibleTeams = useMemo(() => teams.filter(x => x.name.toLowerCase().includes(query.trim().toLowerCase())), [teams, query]);

  if (authLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;
  if (!configured || !user) return <div className="mx-auto max-w-3xl space-y-6 py-8">
    <Header page={page} />
    <div className="rounded-3xl border border-line bg-surface p-7 sm:p-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#34382F] text-[#D9B765]"><LockKeyhole size={22} /></div>
      <h2 className="mt-5 font-display text-2xl font-semibold">{!configured ? 'Collaboration needs a cloud connection' : 'Sign in to connect with people'}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Your local vault stays on this device. Friends, messaging, teams, and prompt sharing require an authenticated cloud account. Your prompts remain private unless you explicitly share them.</p>
      {configured ? <Link className="mt-5 inline-flex" to="/auth"><Button variant="primary">Sign in or create an account</Button></Link> : <p className="mt-5 rounded-xl border border-line bg-surface2 p-3 text-xs text-muted">No sample people or messages are shown in local mode.</p>}
    </div>
  </div>;

  const act = async (fn: () => Promise<unknown>, success: string, after = true) => {
    setBusy(true);
    try { await fn(); toast.success(success); if (after) await refresh(); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const lookup = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setProfileLookup([]);
    try { const results = await communityService.searchProfile(handle); setProfileLookup(results); if (!results.length) toast.info('No discoverable account matched that handle.'); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const createTeam = async (e: FormEvent) => {
    e.preventDefault(); const name = newTeamName.trim(); if (!name) return;
    await act(async () => { const id = await communityService.createTeam(name); setSelectedTeam(id); }, 'Your team is ready.');
    setNewTeamName(''); setTeamModal(false);
  };
  const inviteMember = async (e: FormEvent) => {
    e.preventDefault(); if (!team) return;
    setBusy(true);
    try {
      const matches = await communityService.searchProfile(inviteHandle);
      if (!matches.length) { toast.info('No discoverable account matched that handle.'); return; }
      if (matches.length !== 1) { toast.error('Choose one exact username.'); return; }
      await communityService.inviteTeamMember(team.team_id, matches[0].user_id);
      toast.success(`Invitation sent to @${matches[0].handle}.`); setInviteHandle(''); await refresh();
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const sendMessage = async (e: FormEvent) => {
    e.preventDefault(); const body = messageDraft.trim(); if (!body || !user) return;
    setBusy(true);
    try {
      if (page === 'friends' && conversationId) await communityService.sendDirectMessage(conversationId, user.id, body);
      else if (page === 'teams' && selectedTeam) await communityService.sendTeamMessage(selectedTeam, user.id, body);
      else throw new Error('Choose an active conversation first.');
      setMessageDraft('');
      const rows = page === 'friends' ? await communityService.directMessages(conversationId) : await communityService.teamMessages(selectedTeam);
      setMessages(current => mergeMessages(current, rows)); setHasOlderMessages(rows.length === 100);
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const loadOlderMessages = async () => {
    const first = messages[0];
    const cursor = first ? { created_at: first.created_at, id: first.id } : undefined;
    if (!cursor || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const older = page === 'friends' && conversationId
        ? await communityService.directMessages(conversationId, cursor)
        : page === 'teams' && selectedTeam
          ? await communityService.teamMessages(selectedTeam, cursor)
          : [];
      setMessages(current => mergeMessages(current, older));
      setHasOlderMessages(older.length === 100);
    } catch (e) { toast.error(errorText(e)); }
    finally { setLoadingOlderMessages(false); }
  };
  const submitHandle = async (e: FormEvent) => {
    e.preventDefault();
    await act(async () => { const saved = await communityService.setHandle(handle); setHandleValue(saved); }, 'Your username is set.');
  };
  const doShare = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = vault.prompts.find(p => p.id === promptId);
    if (!prompt || !user) return;
    const destination = page === 'friends' ? `@${friend?.handle ?? friend?.display_name}` : `team “${team?.name}”`;
    const ok = await confirm({ title: 'Share this prompt?', message: <><p><strong>{prompt.title}</strong> will be shared with {destination} as a read-only snapshot.</p><p className="mt-2">Only its title, prompt text, description, and platform are included. Private notes, history, tags, collections, and usage are not shared. You can revoke access later.</p></>, confirmText: 'Share privately', danger: false });
    if (!ok) return;
    setBusy(true);
    try {
      await communityService.sharePrompt(prompt.id, page === 'friends' ? 'friend' : 'team', page === 'friends' ? selectedFriend : null, page === 'teams' ? selectedTeam : null);
      toast.success('Prompt shared privately.'); setShareModal(false); await refresh();
    } catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  const report = async (e: FormEvent) => {
    e.preventDefault();
    if (!friend || !reportReason.trim()) return;
    await act(() => communityService.reportUser(friend.user_id, 'other', 'friend', null, reportReason), 'Report submitted for review.');
    setReportModal(false); setReportReason('');
  };
  const copyShared = async (share: SharedPrompt) => {
    const ok = await confirm({ title: 'Save an independent copy?', message: <>A new prompt owned by you will be created in your vault. It will no longer depend on the sender’s version; revoking the share will not delete your saved copy.</>, confirmText: 'Save to My Vault', danger: false });
    if (!ok) return;
    await act(async () => { await communityService.saveSharedPrompt(share.id); await vault.reload(); }, 'A private copy was saved to your vault.', false);
  };

  return <div className="space-y-6">
    <Header page={page} />
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="Community sections">{COMMUNITY_TABS.map(item => { const Icon = item.icon; return <Link key={item.to} aria-current={page === item.label.toLowerCase().split(' ')[0] ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${page === item.label.toLowerCase().split(' ')[0] ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`} to={item.to}><Icon size={15} />{item.label}</Link>; })}</nav>
    <div className="flex items-center gap-3 rounded-2xl border border-[#41483E] bg-[#252A25] px-4 py-3 text-sm"><LockKeyhole size={17} className="shrink-0 text-[#D9B765]" /><div><strong className="text-ink">Private by default.</strong><span className="ml-1 text-muted">Only an explicit share grants access; recipients see a limited, read-only snapshot.</span></div></div>
    {handleValue === null && <form onSubmit={submitHandle} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label htmlFor="my-handle" className="label">Choose your unique username</label><Input id="my-handle" value={handle} onChange={e => setHandle(e.target.value)} placeholder="e.g. promptmaker_8" pattern="[A-Za-z0-9_]{3,30}" required autoComplete="off" /><p className="mt-1 text-xs text-muted">3–30 letters, numbers, or underscores. People can discover you by this handle, not your email.</p></div><Button variant="primary" loading={busy}>Set username</Button></form>}
    {loading && <div className="flex items-center gap-2 py-2 text-sm text-muted"><Spinner />Loading private collaboration data…</div>}
    {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose"><span>{loadError}</span><Button size="sm" onClick={() => void refresh()}>Retry</Button></div>}
    {page === 'friends' && <section className="grid min-h-[500px] overflow-hidden rounded-[26px] border border-line bg-surface shadow-card xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-[#1A1D19] p-4 xl:border-b-0 xl:border-r"><div className="flex items-center justify-between"><div><div className="eyebrow">Your people</div><h2 className="mt-1 font-display text-xl font-semibold">Friends</h2></div><Button size="sm" variant="primary" onClick={() => setFriendModal(true)}><UserRoundPlus size={14} />Add</Button></div>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted"><Search size={14} aria-hidden="true" /><span className="sr-only">Search friends</span><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a friend" /></label>
        <div className="mt-3 space-y-1" role="list" aria-label="Accepted friends">{visibleFriends.map(person => <button key={person.user_id} aria-pressed={person.user_id === selectedFriend} onClick={() => setSelectedFriend(person.user_id)} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl p-3 text-left ${person.user_id === selectedFriend ? 'bg-[#293B2F]' : 'hover:bg-surface2/80'}`}><span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#293B2F] text-xs font-bold text-[#C1D7B8]">{face(person)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.display_name || person.handle}</span><span className="block truncate text-xs text-muted">@{person.handle}</span></span></button>)}</div>
        {!friends.length && !loading && <p className="px-2 py-6 text-sm text-muted">No accepted friends yet. Search by username to send a request.</p>}
        {requests.length > 0 && <div className="mt-5 border-t border-line pt-4"><h3 className="eyebrow">Friend requests</h3><div className="mt-2 space-y-2">{requests.map(r => <div key={r.id} className="rounded-xl bg-surface2 p-3"><div className="text-sm font-semibold">{r.display_name || `@${r.handle}`}</div><div className="text-xs text-muted">@{r.handle} · {r.direction}</div><div className="mt-2 flex gap-2">{r.direction === 'incoming' ? <><Button size="sm" variant="primary" onClick={() => void act(() => communityService.respondFriendRequest(r.id, 'accept'), 'Friend request accepted.')}>Accept</Button><Button size="sm" onClick={() => void act(() => communityService.respondFriendRequest(r.id, 'decline'), 'Request declined.')}>Decline</Button></> : <Button size="sm" onClick={() => void act(() => communityService.respondFriendRequest(r.id, 'cancel'), 'Request cancelled.')}>Cancel</Button>}</div></div>)}</div></div>}
        {blocks.length > 0 && <div className="mt-4 border-t border-line pt-4"><h3 className="eyebrow">Blocked accounts</h3>{blocks.map(b => <div key={b.blocked_id} className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface2 p-2 text-xs"><span className="truncate">Account {b.blocked_id.slice(0, 8)}…</span><Button size="sm" onClick={() => void act(() => communityService.unblockUser(b.blocked_id), 'Account unblocked.')}>Unblock</Button></div>)}</div>}
      </aside>
      <div className="flex min-h-[500px] min-w-0 flex-col"><ConversationHeader title={friend?.display_name || 'Choose a friend'} detail={friend ? `@${friend.handle}` : 'Only accepted friends can message'} onShare={() => setShareModal(true)} canShare={!!friend && !!handleValue} />
        {friend ? <><PrivacyLine />{hasOlderMessages && <div className="px-5 pt-3"><Button size="sm" loading={loadingOlderMessages} onClick={() => void loadOlderMessages()}>Load older messages</Button></div>}<MessageList messages={messages} userId={user.id} empty="Say hello. Direct messages are visible only to you and this accepted friend." />
          <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-line bg-[#1E211E] p-4"><label htmlFor="direct-message" className="sr-only">Write a direct message</label><Input id="direct-message" maxLength={4000} value={messageDraft} onChange={e => setMessageDraft(e.target.value)} placeholder="Write a private message…" /><Button variant="primary" aria-label="Send message" type="submit" disabled={!messageDraft.trim() || busy}><Send size={16} /></Button></form>
          <div className="flex flex-wrap gap-2 border-t border-line p-3"><Button size="sm" variant="danger" onClick={async () => { if (await confirm({ title: 'Block this account?', message: 'Blocking immediately hides your friendship and stops future messages and shares. Existing pending requests will be invalidated by the block action.', confirmText: 'Block account' })) await act(() => communityService.blockUser(friend.user_id), 'Account blocked.'); }}> <ShieldAlert size={13} />Block</Button><Button size="sm" onClick={() => setReportModal(true)}>Report</Button><Button size="sm" onClick={async () => { if (await confirm({ title: 'Remove this friend?', message: 'Direct messages and friend shares will no longer be available. You can send a new request later.', confirmText: 'Remove friend' })) await act(() => communityService.removeFriend(friend.user_id), 'Friend removed.'); }}>Remove friend</Button></div>
        </> : <EmptyState icon={<Users size={20} />} title="A private conversation starts with a friend" hint="Use the username search to send a request. Messaging unlocks after they accept." />}
      </div>
    </section>}
    {page === 'teams' && <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]"><aside className="rounded-3xl border border-line bg-surface p-4"><div className="flex items-center justify-between"><div><div className="eyebrow">Small circles</div><h2 className="mt-1 font-display text-xl font-semibold">Your teams</h2></div><Button size="sm" variant="primary" onClick={() => setTeamModal(true)}><Plus size={14} />Create</Button></div><label className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2"><Search size={14} aria-hidden="true" /><span className="sr-only">Search teams</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a team" /></label><div className="mt-3 space-y-1">{visibleTeams.map(t => <button key={t.team_id} aria-pressed={t.team_id === selectedTeam} onClick={() => setSelectedTeam(t.team_id)} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl p-3 text-left ${t.team_id === selectedTeam ? 'bg-[#3A2B2A]' : 'hover:bg-surface2'}`}><span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#3A2B2A] font-display font-bold text-[#E99A80]">{t.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.name}</span><span className="block text-xs text-muted">{t.member_count} members · {t.role}</span></span></button>)}</div>{!teams.length && <p className="py-5 text-sm text-muted">No teams yet. Create one or accept an invitation.</p>}</aside>
        <div className="flex min-h-[470px] flex-col overflow-hidden rounded-3xl border border-line bg-surface"><ConversationHeader title={team?.name || 'Choose a team'} detail={team ? `${team.member_count} members · private team` : 'Team messages require active membership'} onShare={() => setShareModal(true)} canShare={!!team && !!handleValue} /><PrivacyLine />{team ? <>{hasOlderMessages && <div className="px-5 pt-3"><Button size="sm" loading={loadingOlderMessages} onClick={() => void loadOlderMessages()}>Load older messages</Button></div>}<MessageList messages={messages} userId={user.id} empty="Start the group conversation. Only active team members can read and send messages." /><form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-line bg-[#1E211E] p-4"><label htmlFor="team-message" className="sr-only">Write a team message</label><Input id="team-message" maxLength={4000} value={messageDraft} onChange={e => setMessageDraft(e.target.value)} placeholder="Message the team…" /><Button variant="primary" aria-label="Send team message" type="submit" disabled={!messageDraft.trim() || busy}><Send size={16} /></Button></form><div className="border-t border-line p-4"><div className="flex flex-wrap items-end gap-2"><form onSubmit={inviteMember} className="flex min-w-[240px] flex-1 items-end gap-2"><div className="min-w-0 flex-1"><label htmlFor="invite-handle" className="label">Invite by username</label><Input id="invite-handle" value={inviteHandle} onChange={e => setInviteHandle(e.target.value)} placeholder="@username" /></div><Button type="submit" disabled={busy}><UserRoundPlus size={14} />Invite</Button></form>{team.role === 'owner' && <span className="chip">Owner controls</span>}</div><TeamWorkspacePanels team={team} members={teamMembersFor === team.team_id ? teamMembers : []} shares={shares.filter(s => s.target_type === 'team' && s.target_team_id === team.team_id && !s.revoked_at)} userId={user.id} onRefresh={refresh} onRosterRefresh={async () => { const roster = await communityService.listTeamMembers(team.team_id); setTeamMembers(roster); setTeamMembersFor(team.team_id); }} /></div></> : <EmptyState icon={<Users size={20} />} title="Teams keep group work together" hint="Create a private team, invite by username, and membership stays separate from prompt access." />}</div></div>
      {invitations.length > 0 && <div className="rounded-3xl border border-line bg-surface p-4"><h2 className="font-display text-lg font-semibold">Team invitations</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{invitations.map(i => <div key={i.team_id} className="flex items-center justify-between gap-3 rounded-xl bg-surface2 p-3"><div><div className="font-semibold">{i.team_name}</div><div className="text-xs text-muted">Invited by {i.inviter_name || `@${i.inviter_handle}`}</div></div><div className="flex gap-2"><Button size="sm" variant="primary" onClick={() => void act(() => communityService.respondTeamInvitation(i.team_id, true), 'Invitation accepted.')}>Accept</Button><Button size="sm" onClick={() => void act(() => communityService.respondTeamInvitation(i.team_id, false), 'Invitation declined.')}>Decline</Button></div></div>)}</div></div>}
    </section>}
    {page === 'shared' && <section className="space-y-8"><div><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="eyebrow">A shelf, not a public feed</div><h2 className="mt-1 font-display text-2xl font-semibold">Shared with me</h2><p className="mt-1 text-sm text-muted">Only active shares addressed to you or your current teams appear here.</p></div><Button size="sm" onClick={() => void refresh()}>Refresh</Button></div>{inboundShares.length ? <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inboundShares.map(s => <article key={s.id} className="overflow-hidden rounded-3xl border border-line bg-surface"><div className="h-1.5 bg-[#A8C59A]" /><div className="p-5"><div className="flex items-center justify-between"><span className="chip">{s.platform}</span><span className="text-xs text-muted">{s.target_type === 'team' ? 'Team share' : 'Friend share'}</span></div><h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3><p className="mt-1 text-sm text-muted">From {s.owner_display_name || `@${s.owner_handle}`}</p>{s.description && <p className="mt-3 text-sm text-muted">{s.description}</p>}<pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-[#171916] p-3 font-mono text-xs leading-relaxed text-[#E9E4D9]">{s.content}</pre><Button className="mt-4 w-full" variant="primary" onClick={() => void copyShared(s)}><Copy size={14} />Save to My Vault</Button></div></article>)}</div> : <EmptyState icon={<Share2 size={20} />} title="Nothing shared with you yet" hint="When a friend or an active teammate deliberately shares a prompt, it will appear here. No public prompt feed exists." />}</div>
        <div><h2 className="font-display text-xl font-semibold">Your active shares</h2><p className="mt-1 text-sm text-muted">Revoke a share to stop future access to its source snapshot. Copies recipients already saved remain theirs.</p>{myShares.length ? <ul className="mt-3 space-y-2">{myShares.map(s => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"><div><div className="font-semibold">{s.title}</div><div className="text-xs text-muted">{s.target_type === 'team' ? 'Team access' : `Shared with @${s.target_user_id}`} · {s.revoked_at ? 'Revoked' : 'Active'}</div></div>{!s.revoked_at && <Button size="sm" variant="danger" onClick={async () => { if (await confirm({ title: 'Revoke this share?', message: 'The recipient will no longer be able to open the shared source. Any copy they already saved remains in their vault.', confirmText: 'Revoke share' })) await act(() => communityService.revokeShare(s.id), 'Share revoked.'); }}>Revoke</Button>}</li>)}</ul> : <p className="mt-3 rounded-2xl border border-dashed border-line p-5 text-sm text-muted">You have not shared any prompts yet.</p>}</div></section>}

    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-4 text-sm text-muted"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" /><p><strong className="text-ink">A share is not a link to your vault.</strong> It exposes a limited snapshot of one prompt to one friend or team; your source stays yours. Saving creates a separately owned copy.</p></div>
    <Modal open={friendModal} onClose={() => { setFriendModal(false); setProfileLookup([]); }} title="Find a friend" footer={<Button variant="subtle" onClick={() => setFriendModal(false)}>Close</Button>}>
      <form onSubmit={lookup} className="space-y-3"><p className="text-sm text-muted">Search by a chosen username. Email addresses and private vaults are never searchable.</p><label htmlFor="friend-handle" className="label">Username</label><div className="flex gap-2"><Input id="friend-handle" value={handle} onChange={e => setHandle(e.target.value)} placeholder="@theirname" autoComplete="off" /><Button type="submit" variant="primary" loading={busy}><Search size={14} />Search</Button></div></form>
      {profileLookup.map(p => <div key={p.user_id} className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface2 p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#293B2F] text-sm font-bold text-[#C1D7B8]">{face(p)}</span><div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.display_name}</div><div className="text-xs text-muted">@{p.handle}</div></div><Button size="sm" variant="primary" onClick={() => void act(() => communityService.sendFriendRequest(p.user_id), 'Friend request sent.')}>Send request</Button></div>)}
    </Modal>
    <Modal open={teamModal} onClose={() => setTeamModal(false)} title="Create a private team" footer={<><Button variant="subtle" onClick={() => setTeamModal(false)}>Cancel</Button><Button variant="primary" onClick={e => { const form = (e.currentTarget.closest('[role=dialog]') as HTMLElement | null)?.querySelector('form'); form?.requestSubmit(); }}><Plus size={14} />Create team</Button></>}><form onSubmit={createTeam} className="space-y-3"><p className="text-sm text-muted">A team creates a private group conversation. Membership alone never exposes personal prompts.</p><label htmlFor="team-name" className="label">Team name</label><Input id="team-name" maxLength={80} value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Product studio" required /></form></Modal>
    <Modal open={shareModal} onClose={() => setShareModal(false)} title="Choose a prompt to share" footer={<><Button variant="subtle" onClick={() => setShareModal(false)}>Cancel</Button><Button variant="primary" onClick={e => { const form = (e.currentTarget.closest('[role=dialog]') as HTMLElement | null)?.querySelector('form'); form?.requestSubmit(); }} disabled={!promptId || busy}><Share2 size={14} />Review and share</Button></>}><form onSubmit={doShare} className="space-y-3"><p className="text-sm text-muted">{page === 'friends' ? `Recipient: ${friend?.display_name || `@${friend?.handle}`}` : `Team: ${team?.name}`}. Only a read-only snapshot is shared.</p>{vault.prompts.length ? <Select aria-label="Choose one of your prompts" value={promptId} onChange={e => setPromptId(e.target.value)}><option value="">Choose a prompt…</option>{vault.prompts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</Select> : <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Your active vault has no prompts to share.</p>}</form></Modal>
    <Modal open={reportModal} onClose={() => setReportModal(false)} title="Report this account" footer={<><Button variant="subtle" onClick={() => setReportModal(false)}>Cancel</Button><Button variant="danger" onClick={e => { const form = (e.currentTarget.closest('[role=dialog]') as HTMLElement | null)?.querySelector('form'); form?.requestSubmit(); }}>Submit report</Button></>}><form onSubmit={report} className="space-y-3"><p className="text-sm text-muted">Reports are private and help moderators review abuse. Include at least 10 characters.</p><label className="label" htmlFor="report-reason">What happened?</label><Textarea id="report-reason" minLength={10} maxLength={2000} value={reportReason} onChange={e => setReportReason(e.target.value)} required /></form></Modal>
  </div>;
}

function Header({ page }: { page: Page }) {
  const titles = { friends: ['Friends, not followers.', 'Find people by username, talk privately, and share only what you choose.'], teams: ['Good work takes a team.', 'Private rooms for conversations and prompts your team chooses to share.'], shared: ['Shared, by choice.', 'A quiet shelf for prompt snapshots people deliberately sent your way.'] } as const;
  const [title, subtitle] = titles[page];
  return <header><div className="eyebrow flex items-center gap-2"><Share2 size={13} className="text-rose" />Private collaboration</div><h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-[-.04em] md:text-5xl">{title}</h1><p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">{subtitle}</p></header>;
}
function TeamWorkspacePanels({ team, members, shares, userId, onRefresh, onRosterRefresh }: { team: Team; members: TeamMember[]; shares: SharedPrompt[]; userId: string; onRefresh: () => Promise<void>; onRosterRefresh: () => Promise<void> }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string, refreshRoster = false) => {
    setBusy(true);
    try { await fn(); toast.success(success); await onRefresh(); if (refreshRoster) await onRosterRefresh(); }
    catch (e) { toast.error(errorText(e)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4 border-t border-line p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="eyebrow">Active members</h3>
      {team.role !== 'owner' ? <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
        if (await confirm({ title: 'Leave this team?', message: 'You will lose access to its group messages and active team-shared prompts. You can be invited again later.', confirmText: 'Leave team' })) await run(() => communityService.leaveTeam(team.team_id), 'You left the team.');
      }}>Leave team</Button> : <span className="text-xs text-muted">Transfer ownership below to become a member before leaving.</span>}
    </div>
    <ul className="flex flex-wrap gap-2" aria-label="Team member controls">{members.map(m => {
      const canRemove = (team.role === 'owner' && m.role !== 'owner') || (team.role === 'admin' && m.role === 'member');
      const canChangeRole = team.role === 'owner' && m.role !== 'owner';
      return <li key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs">
        <span>{m.display_name || `@${m.handle}`} <span className="text-muted">· {m.role}</span></span>
        {canChangeRole && <button className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-accent underline" aria-label={`Change ${m.display_name || m.handle || 'member'} role to ${m.role === 'admin' ? 'member' : 'admin'}`} disabled={busy} onClick={() => void run(() => communityService.setTeamMemberRole(team.team_id, m.user_id, m.role === 'admin' ? 'member' : 'admin'), 'Member role updated.', true)}>{m.role === 'admin' ? 'Make member' : 'Make admin'}</button>}
        {team.role === 'owner' && m.role !== 'owner' && <button className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-accent underline" aria-label={`Transfer ownership to ${m.display_name || m.handle || 'this member'}`} disabled={busy} onClick={async () => {
          if (await confirm({ title: 'Transfer team ownership?', message: <><p><strong>{m.display_name || `@${m.handle}`}</strong> will become the owner. You will become a regular member and may leave afterward.</p><p className="mt-2">This changes who can manage roles and members.</p></>, confirmText: 'Transfer ownership' })) await run(() => communityService.transferTeamOwner(team.team_id, m.user_id), 'Team ownership transferred.', true);
        }}>Make owner</button>}
        {canRemove && <button className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-rose underline" aria-label={`Remove ${m.display_name || m.handle || 'member'} from team`} disabled={busy} onClick={async () => {
          if (await confirm({ title: 'Remove this member?', message: 'They will immediately lose access to this team’s messages and active team shares. They can be invited again later.', confirmText: 'Remove member', danger: true })) await run(() => communityService.removeTeamMember(team.team_id, m.user_id), 'Member removed from team.', true);
        }}>Remove</button>}
      </li>;
    })}</ul>
    <section className="rounded-2xl border border-line bg-[#1A1D19] p-4" aria-labelledby="team-shares-heading">
      <div className="flex items-center justify-between gap-3"><div><h3 id="team-shares-heading" className="font-display text-lg font-semibold">Prompts shared in this team</h3><p className="text-xs text-muted">Visible to active members; snapshots do not reveal private notes or history.</p></div><span className="chip">{shares.length}</span></div>
      {shares.length ? <ul className="mt-3 space-y-3">{shares.map(share => <li key={share.id} className="rounded-xl border border-line bg-surface p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold">{share.title}</div><div className="text-xs text-muted">{share.platform} · shared by {share.owner_display_name || `@${share.owner_handle}`}</div></div>{share.owner_id === userId && <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
        if (await confirm({ title: 'Revoke this team share?', message: 'Active team members will lose future access to this source snapshot. Copies already saved remain in their vaults.', confirmText: 'Revoke share', danger: true })) await run(() => communityService.revokeShare(share.id), 'Team share revoked.');
      }}>Revoke</Button>}</div>{share.description && <p className="mt-2 text-sm text-muted">{share.description}</p>}<pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-[#171916] p-3 font-mono text-xs leading-relaxed text-[#E9E4D9]">{share.content}</pre></li>)}</ul> : <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-muted">No prompts have been shared in this team yet. Sharing remains a separate, explicit action.</p>}
    </section>
  </div>;
}

function ConversationHeader({ title, detail, onShare, canShare }: { title: string; detail: string; onShare: () => void; canShare: boolean }) {
  return <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-7"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#293B2F] text-[#C1D7B8]"><MessageCircle size={17} /></span><div className="min-w-0"><h2 className="truncate font-display text-lg font-semibold">{title}</h2><p className="truncate text-xs text-muted">{detail}</p></div></div>{canShare && <Button size="sm" onClick={onShare}><Share2 size={14} />Share prompt</Button>}</header>;
}
function PrivacyLine() { return <div className="flex items-center gap-2 border-b border-line bg-[#1E211E] px-5 py-3 text-xs text-muted"><LockKeyhole size={13} className="text-accent" />This conversation is private to its active participants.</div>; }
function MessageList({ messages, userId, empty }: { messages: Message[]; userId: string; empty: string }) {
  const latest = messages[messages.length - 1];
  return <><span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{latest ? `${latest.sender_id === userId ? 'You sent' : 'New message'}: ${latest.body.slice(0, 240)}` : ''}</span><ol className="flex-1 space-y-3 overflow-y-auto px-5 py-6 sm:px-7" aria-label="Conversation messages">{messages.length ? messages.map(m => <li key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-[18px] px-4 py-3 text-sm leading-relaxed ${m.sender_id === userId ? 'rounded-br-md bg-accent text-white dark:text-[#18201B]' : 'rounded-bl-md bg-[#2A2E29] text-ink'}`}><span className="block whitespace-pre-wrap break-words">{m.body}</span><time className="mt-1 block text-right text-[10px] opacity-70" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time></div></li>) : <li className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{empty}</li>}</ol></>;
}
