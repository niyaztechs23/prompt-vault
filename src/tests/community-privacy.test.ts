import { describe, expect, it } from 'vitest';
import base from '../../supabase/migrations/0001_init.sql?raw';
import community from '../../supabase/migrations/0002_community.sql?raw';
import service from '../services/communityService.ts?raw';
import communityUi from '../pages/Community.tsx?raw';

const functionBody = (source: string, name: string) => {
  const start = source.indexOf(`create function community_private.${name}(`);
  expect(start, `function ${name} should exist`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('$$;', start);
  expect(end, `function ${name} should terminate`).toBeGreaterThan(start);
  return source.slice(start, end + 3);
};

describe('community authorization static contracts (not a live RLS test)', () => {
  it('keeps personal prompt rows owner-only and does not add a broader prompt policy', () => {
    expect(base).toMatch(/create policy "own prompts" on public\.prompts\s+for all using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)/i);
    expect(community).not.toMatch(/create policy[^;]*on public\.prompts/is);
  });

  it('creates a share only from an active prompt owned by the caller and snapshots only approved fields', () => {
    const body = functionBody(community, 'share_prompt');
    expect(body).toMatch(/where id = p_prompt_id and user_id = v_me and deleted_at is null/i);
    expect(body).toMatch(/title, content, description, platform, owner_display_name, owner_handle/i);
    expect(body).not.toMatch(/v_prompt\.(notes|is_favorite|is_pinned|usage_count|last_used_at|version|category_id)/i);
  });

  it('requires an active, unblocked friend or active team membership to read source shares', () => {
    const body = functionBody(community, 'can_read_share');
    expect(body).toMatch(/p_revoked_at is null and p_target_type = 'friend'/i);
    expect(body).toMatch(/community_private\.current_user_is_friend\(p_owner_id\)/i);
    expect(body).toMatch(/p_revoked_at is null and p_target_type = 'team'/i);
    expect(body).toMatch(/community_private\.is_active_team_member\(p_target_team_id\)/i);
  });

  it('makes a saved share a recipient-owned prompt, independent of future share deletion', () => {
    const body = functionBody(community, 'save_shared_prompt');
    expect(body).toMatch(/v_share\.revoked_at is not null/i);
    expect(body).toMatch(/insert into public\.prompts \(user_id, title, content, description, platform\)\s+values \(v_me, v_share\.title/i);
    expect(community).toMatch(/prompt_id uuid not null unique references public\.prompts\(id\) on delete cascade/i);
    expect(community).toMatch(/share_id uuid not null references public\.prompt_shares\(id\) on delete cascade/i);
  });

  it('scopes direct and team messaging by visible conversation or active membership', () => {
    expect(community).toMatch(/create policy "friends read their direct conversations"[\s\S]*?community_private\.current_user_is_friend\(user_high\)/i);
    expect(community).toMatch(/create policy "participants send direct messages"[\s\S]*?sender_id = \(select auth\.uid\(\)\)[\s\S]*?exists \(select 1 from public\.direct_conversations c where c\.id = conversation_id\)/i);
    expect(community).toMatch(/create policy "active members send team messages"[\s\S]*?sender_id = \(select auth\.uid\(\)\) and community_private\.is_active_team_member\(team_id\)/i);
  });

  it('makes blocking end pending and accepted friend state and forbids client-side block insertion', () => {
    const body = functionBody(community, 'block_user');
    expect(body).toMatch(/status in \('pending','accepted'\)/i);
    expect(body).toMatch(/status = 'removed'/i);
    expect(community).not.toMatch(/grant insert[^;]*on public\.user_blocks/i);
    expect(community).not.toMatch(/create policy[^;]*on public\.user_blocks[^;]*for insert/i);
  });

  it('hides revoked shares from recipients while preserving owner visibility', () => {
    const body = functionBody(community, 'can_read_share');
    expect(body).toMatch(/p_owner_id = auth\.uid\(\)/i);
    expect(body).toMatch(/p_revoked_at is null/i);
    expect(community).toMatch(/create policy "owners and active recipients read explicit shares"[\s\S]*?community_private\.can_read_share/i);
  });

  it('transfers ownership only from the current owner to an active member and updates both owner records', () => {
    const body = functionBody(community, 'transfer_team_owner');
    expect(body).toMatch(/select owner_id into v_owner_id from public\.teams where id = p_team_id for update/i);
    expect(body).toMatch(/v_owner_id <> v_me/i);
    expect(body).toMatch(/status = 'active' for update/i);
    expect(body).toMatch(/set role = 'member'[\s\S]*?set role = 'owner'[\s\S]*?update public\.teams set owner_id = p_user_id/i);
    expect(community).toMatch(/revoke all on all functions in schema community_private from public, anon/i);
    expect(community).toMatch(/grant execute on function community_private\.transfer_team_owner\(uuid,uuid\) to authenticated/i);
    expect(community).toMatch(/grant execute on function public\.transfer_team_owner\(uuid,uuid\) to authenticated/i);
    expect(community).toMatch(/revoke execute on function public\.transfer_team_owner\(uuid,uuid\) from public, anon/i);
  });

  it('uses a stable timestamp-plus-id keyset for both message streams', () => {
    expect(community).toMatch(/direct_messages_conversation_time_idx on public\.direct_messages \(conversation_id, created_at desc, id desc\)/i);
    expect(community).toMatch(/team_messages_team_time_idx on public\.team_messages \(team_id, created_at desc, id desc\)/i);
    expect(service.match(/created_at\.lt\.\$\{before\.created_at\}/g)).toHaveLength(2);
    expect(service.match(/created_at\.eq\.\$\{before\.created_at\},id\.lt\.\$\{before\.id\}/g)).toHaveLength(2);
    expect(service.match(/\.order\('created_at', \{ ascending: false \}\)\.order\('id', \{ ascending: false \}\)/g)).toHaveLength(2);
    expect(communityUi).toMatch(/created_at: first\.created_at, id: first\.id/);
  });
});
