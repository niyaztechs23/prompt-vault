import { supabase } from '../lib/supabase';

export type Friend = { user_id: string; handle: string | null; display_name: string; avatar_url: string | null; friendship_created_at: string | null };
export type FriendRequest = { id: string; direction: 'incoming' | 'outgoing'; other_user_id: string; handle: string | null; display_name: string; avatar_url: string | null; created_at: string };
export type ProfileHit = { user_id: string; handle: string; display_name: string; avatar_url: string | null };
export type Team = { team_id: string; name: string; role: 'owner' | 'admin' | 'member'; member_count: number; created_at: string };
export type TeamInvite = { team_id: string; team_name: string; invited_by: string; inviter_name: string; inviter_handle: string | null; created_at: string };
export type TeamMember = { user_id: string; handle: string | null; display_name: string; avatar_url: string | null; role: 'owner' | 'admin' | 'member'; joined_at: string | null };
export type Message = { id: string; sender_id: string; body: string; created_at: string; conversation_id?: string; team_id?: string };
export type MessageCursor = Pick<Message, 'created_at' | 'id'>;
export type SharedPrompt = { id: string; source_prompt_id: string; owner_id: string; target_type: 'friend' | 'team'; target_user_id: string | null; target_team_id: string | null; title: string; content: string; description: string; platform: string; owner_display_name: string; owner_handle: string | null; created_at: string; revoked_at: string | null };
export type BlockedUser = { blocked_id: string; created_at: string };
export type ReportCategory = 'harassment' | 'spam' | 'inappropriate' | 'other';
export type ReportContext = 'friend' | 'team' | 'message' | 'share';

function client() {
  if (!supabase) throw new Error('Cloud collaboration is unavailable in local-only mode. Configure Supabase and sign in to continue.');
  return supabase;
}
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const result = await client().rpc(name, args as never);
  return unwrap(result as { data: T | null; error: { message: string } | null });
}

export const communityService = {
  async getMyHandle() {
    const { data, error } = await client().from('profiles').select('handle').maybeSingle();
    const row = unwrap({ data: data as { handle: string | null } | null, error });
    return row?.handle ?? null;
  },
  async overview() {
    const [friends, requests, teams, invitations] = await Promise.all([
      rpc<Friend[]>('list_friends'), rpc<FriendRequest[]>('list_friend_requests'),
      rpc<Team[]>('list_teams'), rpc<TeamInvite[]>('list_team_invitations'),
    ]);
    return { friends, requests, teams, invitations };
  },
  searchProfile: (handle: string) => rpc<ProfileHit[]>('search_profile', { p_handle: handle.trim().replace(/^@/, '') }),
  setHandle: (handle: string) => rpc<string>('set_my_handle', { p_handle: handle }),
  sendFriendRequest: (otherUserId: string) => rpc<string>('send_friend_request', { p_other_user_id: otherUserId }),
  respondFriendRequest: (requestId: string, action: 'accept' | 'decline' | 'cancel') => rpc<void>('respond_friend_request', { p_request_id: requestId, p_action: action }),
  removeFriend: (otherUserId: string) => rpc<void>('remove_friend', { p_other_user_id: otherUserId }),
  async listBlocks() {
    const { data, error } = await client().from('user_blocks').select('blocked_id,created_at').order('created_at', { ascending: false }).limit(200);
    return unwrap({ data: (data ?? []) as BlockedUser[], error });
  },
  blockUser: (otherUserId: string) => rpc<void>('block_user', { p_other_user_id: otherUserId }),
  async unblockUser(otherUserId: string) {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError) throw new Error(userError.message);
    if (!userData.user) throw new Error('Sign in to unblock an account.');
    const { error } = await client().from('user_blocks').delete().eq('blocker_id', userData.user.id).eq('blocked_id', otherUserId);
    if (error) throw new Error(error.message);
  },
  createTeam: (name: string) => rpc<string>('create_team', { p_name: name }),
  inviteTeamMember: (teamId: string, userId: string) => rpc<void>('invite_team_member', { p_team_id: teamId, p_user_id: userId }),
  respondTeamInvitation: (teamId: string, accept: boolean) => rpc<void>('respond_team_invitation', { p_team_id: teamId, p_accept: accept }),
  removeTeamMember: (teamId: string, userId: string) => rpc<void>('remove_team_member', { p_team_id: teamId, p_user_id: userId }),
  setTeamMemberRole: (teamId: string, userId: string, role: 'admin' | 'member') => rpc<void>('set_team_member_role', { p_team_id: teamId, p_user_id: userId, p_role: role }),
  transferTeamOwner: (teamId: string, userId: string) => rpc<void>('transfer_team_owner', { p_team_id: teamId, p_user_id: userId }),
  leaveTeam: (teamId: string) => rpc<void>('leave_team', { p_team_id: teamId }),
  listTeamMembers: (teamId: string) => rpc<TeamMember[]>('list_team_members', { p_team_id: teamId }),
  async getDirectConversation(otherUserId: string) {
    return rpc<string>('get_or_create_direct_conversation', { p_other_user_id: otherUserId });
  },
  async directMessages(conversationId: string, before?: MessageCursor) {
    let query = client().from('direct_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversationId);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    return unwrap({ data: ((data ?? []) as Message[]).reverse(), error });
  },
  async teamMessages(teamId: string, before?: MessageCursor) {
    let query = client().from('team_messages').select('id,team_id,sender_id,body,created_at').eq('team_id', teamId);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    return unwrap({ data: ((data ?? []) as Message[]).reverse(), error });
  },
  async sendDirectMessage(conversationId: string, senderId: string, body: string) {
    const { error } = await client().from('direct_messages').insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() });
    if (error) throw new Error(error.message);
  },
  async sendTeamMessage(teamId: string, senderId: string, body: string) {
    const { error } = await client().from('team_messages').insert({ team_id: teamId, sender_id: senderId, body: body.trim() });
    if (error) throw new Error(error.message);
  },
  subscribeToDirectMessages(conversationId: string, onInsert: (message: Message) => void) {
    const sb = client();
    const channel = sb.channel(`direct-${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, payload => onInsert(payload.new as Message));
    return new Promise<() => void>((resolve, reject) => {
      let settled = false;
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED' && !settled) { settled = true; resolve(() => { void sb.removeChannel(channel); }); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !settled) { settled = true; void sb.removeChannel(channel); reject(error ?? new Error('Direct-message realtime subscription failed.')); }
      });
    });
  },
  subscribeToTeamMessages(teamId: string, onInsert: (message: Message) => void) {
    const sb = client();
    const channel = sb.channel(`team-${teamId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` }, payload => onInsert(payload.new as Message));
    return new Promise<() => void>((resolve, reject) => {
      let settled = false;
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED' && !settled) { settled = true; resolve(() => { void sb.removeChannel(channel); }); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && !settled) { settled = true; void sb.removeChannel(channel); reject(error ?? new Error('Team-message realtime subscription failed.')); }
      });
    });
  },
  sharePrompt: (promptId: string, targetType: 'friend' | 'team', targetUserId: string | null, targetTeamId: string | null) => rpc<string>('share_prompt', { p_prompt_id: promptId, p_target_type: targetType, p_target_user_id: targetUserId, p_target_team_id: targetTeamId }),
  revokeShare: (shareId: string) => rpc<void>('revoke_prompt_share', { p_share_id: shareId }),
  saveSharedPrompt: (shareId: string) => rpc<string>('save_shared_prompt', { p_share_id: shareId }),
  async listShares() {
    const columns = 'id,source_prompt_id,owner_id,target_type,target_user_id,target_team_id,title,content,description,platform,owner_display_name,owner_handle,created_at,revoked_at';
    const { data, error } = await client().from('prompt_shares').select(columns).order('created_at', { ascending: false }).limit(100);
    return unwrap({ data: (data ?? []) as SharedPrompt[], error });
  },
  reportUser: (userId: string, category: ReportCategory, contextType: ReportContext, contextId: string | null, reason: string) => rpc<string>('report_user', { p_reported_user_id: userId, p_category: category, p_context_type: contextType, p_context_id: contextId, p_reason: reason }),
};
