-- PROMPT VAULT · private collaboration layer
-- Additive only. This migration assumes 0001_init.sql has already been applied.
-- No prompt is discoverable publicly. All collaboration data is scoped by RLS.

-- Public profile discovery is deliberately limited to a chosen handle and a small
-- profile projection returned by authenticated RPCs; profiles remain owner-only.
alter table public.profiles
  add column handle text,
  add constraint profiles_handle_format check (
    handle is null or handle ~ '^[a-z0-9_]{3,30}$'
  );
create unique index profiles_handle_unique on public.profiles (handle) where handle is not null;

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);
create unique index friend_requests_pair_unique
  on public.friend_requests (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index friend_requests_recipient_status_idx on public.friend_requests (recipient_id, status, created_at desc);
create index friend_requests_requester_status_idx on public.friend_requests (requester_id, status, created_at desc);

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id, blocker_id);

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low < user_high),
  unique (user_low, user_high)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index direct_messages_conversation_time_idx on public.direct_messages (conversation_id, created_at desc, id desc);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index teams_owner_created_idx on public.teams (owner_id, created_at desc);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'invited' check (status in ('invited','active','declined','removed')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (team_id, user_id)
);
create index team_members_user_status_idx on public.team_members (user_id, status, created_at desc);
create index team_members_team_status_idx on public.team_members (team_id, status, created_at);

create table public.team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index team_messages_team_time_idx on public.team_messages (team_id, created_at desc, id desc);

-- A share stores only an explicit, immutable snapshot of the fields recipients may see.
-- Private notes, tags, collections, versions, favorites, usage and account settings are omitted.
-- Team snapshots are visible to active members of the target team, including members
-- who join later; access ends when the share is revoked or membership is inactive.
create table public.prompt_shares (
  id uuid primary key default gen_random_uuid(),
  source_prompt_id uuid not null references public.prompts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('friend','team')),
  target_user_id uuid references auth.users(id) on delete cascade,
  target_team_id uuid references public.teams(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  content text not null check (char_length(content) <= 200000),
  description text not null default '',
  platform text not null default 'Any',
  owner_display_name text not null default '',
  owner_handle text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (
    (target_type = 'friend' and target_user_id is not null and target_team_id is null)
    or (target_type = 'team' and target_user_id is null and target_team_id is not null)
  )
);
create index prompt_shares_owner_time_idx on public.prompt_shares (owner_id, created_at desc);
create index prompt_shares_friend_active_idx on public.prompt_shares (target_user_id, created_at desc) where target_type = 'friend' and revoked_at is null;
create index prompt_shares_team_active_idx on public.prompt_shares (target_team_id, created_at desc) where target_type = 'team' and revoked_at is null;

create table public.saved_shared_prompts (
  share_id uuid not null references public.prompt_shares(id) on delete cascade,
  saver_id uuid not null references auth.users(id) on delete cascade,
  prompt_id uuid not null unique references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (share_id, saver_id)
);
create index saved_shared_prompts_saver_time_idx on public.saved_shared_prompts (saver_id, created_at desc);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('harassment','spam','inappropriate','other')),
  context_type text not null check (context_type in ('friend','team','message','share')),
  context_id uuid,
  reason text not null check (char_length(trim(reason)) between 10 and 2000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index user_reports_reporter_time_idx on public.user_reports (reporter_id, created_at desc);

-- Helpers live outside the exposed API schemas. They are security-definer only where
-- needed to inspect authorization rows hidden by RLS; every helper derives identity
-- from auth.uid() and uses a fixed empty search_path.
create schema community_private;
revoke all on schema community_private from public, anon;
grant usage on schema community_private to authenticated;

create function community_private.current_user_is_friend(p_other_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and p_other_user_id is not null
    and p_other_user_id <> auth.uid()
    and exists (
      select 1 from public.friend_requests f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.recipient_id = p_other_user_id)
          or (f.recipient_id = auth.uid() and f.requester_id = p_other_user_id))
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
         or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid())
    );
$$;

create function community_private.is_active_team_member(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create function community_private.is_team_admin(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid()
      and m.status = 'active' and m.role in ('owner','admin')
  );
$$;

create function community_private.can_read_share(
  p_owner_id uuid, p_target_type text, p_target_user_id uuid,
  p_target_team_id uuid, p_revoked_at timestamptz
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    p_owner_id = auth.uid()
    or (p_revoked_at is null and p_target_type = 'friend'
        and p_target_user_id = auth.uid()
        and community_private.current_user_is_friend(p_owner_id))
    or (p_revoked_at is null and p_target_type = 'team'
        and community_private.is_active_team_member(p_target_team_id))
  );
$$;

create function community_private.set_my_handle(p_handle text)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_handle text := lower(trim(coalesce(p_handle, '')));
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if v_handle !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'Use 3–30 lowercase letters, numbers, or underscores.';
  end if;
  update public.profiles set handle = v_handle, updated_at = now() where id = auth.uid();
  if not found then raise exception 'Profile not found.'; end if;
  return v_handle;
end;
$$;

create function community_private.search_profile(p_handle text)
returns table (user_id uuid, handle text, display_name text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and p.handle = lower(trim(coalesce(p_handle, '')))
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  limit 1;
$$;

create function community_private.list_friend_requests()
returns table (
  id uuid, direction text, other_user_id uuid, handle text,
  display_name text, avatar_url text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select f.id,
         case when f.recipient_id = auth.uid() then 'incoming' else 'outgoing' end,
         p.id, p.handle, p.display_name, p.avatar_url, f.created_at
  from public.friend_requests f
  join public.profiles p on p.id = case when f.recipient_id = auth.uid() then f.requester_id else f.recipient_id end
  where auth.uid() is not null and f.status = 'pending'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by f.created_at desc
  limit 100;
$$;

create function community_private.list_friends()
returns table (
  user_id uuid, handle text, display_name text, avatar_url text, friendship_created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.avatar_url, f.responded_at
  from public.friend_requests f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end
  where auth.uid() is not null and f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
    and community_private.current_user_is_friend(p.id)
  order by p.display_name, p.handle
  limit 200;
$$;

create function community_private.send_friend_request(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_row public.friend_requests%rowtype; v_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if p_other_user_id is null or p_other_user_id = v_me then raise exception 'Choose another user.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_other_user_id and p.handle is not null) then
    raise exception 'No user with that handle was found.';
  end if;
  if exists (select 1 from public.user_blocks b where
      (b.blocker_id = v_me and b.blocked_id = p_other_user_id)
      or (b.blocker_id = p_other_user_id and b.blocked_id = v_me)) then
    raise exception 'This friend request is unavailable.';
  end if;
  select * into v_row from public.friend_requests f
    where least(f.requester_id, f.recipient_id) = least(v_me, p_other_user_id)
      and greatest(f.requester_id, f.recipient_id) = greatest(v_me, p_other_user_id)
    for update;
  if found then
    if v_row.status = 'accepted' then raise exception 'You are already friends.'; end if;
    if v_row.status = 'pending' then
      if v_row.requester_id = v_me then raise exception 'Friend request already sent.'; end if;
      raise exception 'This person already sent you a request. Accept it from your requests.';
    end if;
    update public.friend_requests set requester_id = v_me, recipient_id = p_other_user_id,
      status = 'pending', created_at = now(), updated_at = now(), responded_at = null
      where id = v_row.id returning id into v_id;
    return v_id;
  end if;
  begin
    insert into public.friend_requests (requester_id, recipient_id) values (v_me, p_other_user_id) returning id into v_id;
  exception when unique_violation then
    raise exception 'A request between these accounts was just created. Refresh and try again.';
  end;
  return v_id;
end;
$$;

create function community_private.respond_friend_request(p_request_id uuid, p_action text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_row public.friend_requests%rowtype;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if p_action not in ('accept','decline','cancel') then raise exception 'Invalid request action.'; end if;
  select * into v_row from public.friend_requests where id = p_request_id for update;
  if not found or v_row.status <> 'pending' then raise exception 'Friend request is no longer pending.'; end if;
  if p_action in ('accept','decline') and v_row.recipient_id = v_me then
    if p_action = 'accept' and exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = v_row.requester_id and b.blocked_id = v_row.recipient_id)
         or (b.blocker_id = v_row.recipient_id and b.blocked_id = v_row.requester_id)
    ) then raise exception 'This request cannot be accepted while either account is blocked.'; end if;
    update public.friend_requests set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
      updated_at = now(), responded_at = now() where id = p_request_id;
  elsif p_action = 'cancel' and v_row.requester_id = v_me then
    update public.friend_requests set status = 'cancelled', updated_at = now(), responded_at = now()
      where id = p_request_id;
  else
    raise exception 'You cannot respond to this friend request.';
  end if;
end;
$$;

create function community_private.remove_friend(p_other_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or p_other_user_id is null then raise exception 'Sign in required.'; end if;
  update public.friend_requests set status = 'removed', updated_at = now(), responded_at = now()
  where status = 'accepted'
    and ((requester_id = v_me and recipient_id = p_other_user_id)
      or (recipient_id = v_me and requester_id = p_other_user_id));
  if not found then raise exception 'Accepted friendship not found.'; end if;
end;
$$;

create function community_private.block_user(p_other_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if p_other_user_id is null or p_other_user_id = v_me then raise exception 'Choose another account.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_me, p_other_user_id)
    on conflict (blocker_id, blocked_id) do nothing;
  -- Unblocking does not silently restore a friendship; users must establish one again.
  update public.friend_requests set status = 'removed', updated_at = now(), responded_at = now()
  where status in ('pending','accepted')
    and ((requester_id = v_me and recipient_id = p_other_user_id)
      or (recipient_id = v_me and requester_id = p_other_user_id));
end;
$$;

create function community_private.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_low uuid; v_high uuid; v_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if not community_private.current_user_is_friend(p_other_user_id) then
    raise exception 'Direct conversations require an accepted, unblocked friend.';
  end if;
  v_low := least(v_me, p_other_user_id); v_high := greatest(v_me, p_other_user_id);
  insert into public.direct_conversations (user_low, user_high) values (v_low, v_high)
    on conflict (user_low, user_high) do nothing;
  select id into v_id from public.direct_conversations where user_low = v_low and user_high = v_high;
  return v_id;
end;
$$;

create function community_private.create_team(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_name text := trim(coalesce(p_name, '')); v_team_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'Team name must be 1–80 characters.'; end if;
  insert into public.teams (owner_id, name) values (v_me, v_name) returning id into v_team_id;
  insert into public.team_members (team_id, user_id, role, status, invited_by, responded_at)
    values (v_team_id, v_me, 'owner', 'active', v_me, now());
  return v_team_id;
end;
$$;

create function community_private.invite_team_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_role text; v_status text;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if not community_private.is_team_admin(p_team_id) then raise exception 'Only team owners and admins can invite members.'; end if;
  if p_user_id is null or p_user_id = v_me then raise exception 'Choose another account.'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.handle is not null) then
    raise exception 'No user with that handle was found.';
  end if;
  select role, status into v_role, v_status from public.team_members
    where team_id = p_team_id and user_id = p_user_id for update;
  if found and v_status = 'active' then raise exception 'That person is already on this team.'; end if;
  if found then
    update public.team_members set role = 'member', status = 'invited', invited_by = v_me,
      created_at = now(), responded_at = null where team_id = p_team_id and user_id = p_user_id;
  else
    insert into public.team_members (team_id, user_id, role, status, invited_by)
      values (p_team_id, p_user_id, 'member', 'invited', v_me);
  end if;
end;
$$;

create function community_private.respond_team_invitation(p_team_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  update public.team_members set status = case when p_accept then 'active' else 'declined' end,
    responded_at = now()
  where team_id = p_team_id and user_id = v_me and status = 'invited';
  if not found then raise exception 'Team invitation is no longer available.'; end if;
end;
$$;

create function community_private.remove_team_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_actor_role text; v_target_role text;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  select role into v_actor_role from public.team_members
    where team_id = p_team_id and user_id = v_me and status = 'active';
  if v_actor_role is null or v_actor_role not in ('owner','admin') then
    raise exception 'Only team owners and admins can remove members.';
  end if;
  select role into v_target_role from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active' for update;
  if not found then raise exception 'Active team member not found.'; end if;
  if v_target_role = 'owner' then raise exception 'The team owner cannot be removed.'; end if;
  if v_actor_role = 'admin' and v_target_role = 'admin' then raise exception 'Admins cannot remove another admin.'; end if;
  update public.team_members set status = 'removed', responded_at = now()
    where team_id = p_team_id and user_id = p_user_id;
end;
$$;

create function community_private.set_team_member_role(p_team_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if not exists (select 1 from public.team_members m where m.team_id = p_team_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active') then
    raise exception 'Only the team owner can change member roles.';
  end if;
  if p_role not in ('admin','member') then raise exception 'Role must be admin or member.'; end if;
  update public.team_members set role = p_role
    where team_id = p_team_id and user_id = p_user_id and status = 'active' and role <> 'owner';
  if not found then raise exception 'Active non-owner member not found.'; end if;
end;
$$;

create function community_private.transfer_team_owner(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_owner_id uuid;
  v_target_role text;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if p_user_id is null or p_user_id = v_me then raise exception 'Choose another active member.'; end if;
  select owner_id into v_owner_id from public.teams where id = p_team_id for update;
  if not found or v_owner_id <> v_me then raise exception 'Only the current team owner can transfer ownership.'; end if;
  select role into v_target_role from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active' for update;
  if not found or v_target_role = 'owner' then raise exception 'Choose an active non-owner team member.'; end if;
  update public.team_members set role = 'member'
    where team_id = p_team_id and user_id = v_me and status = 'active' and role = 'owner';
  if not found then raise exception 'Current owner membership was not found.'; end if;
  update public.team_members set role = 'owner'
    where team_id = p_team_id and user_id = p_user_id and status = 'active';
  update public.teams set owner_id = p_user_id where id = p_team_id;
end;
$$;

create function community_private.leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  update public.team_members set status = 'removed', responded_at = now()
  where team_id = p_team_id and user_id = v_me and status = 'active' and role <> 'owner';
  if not found then raise exception 'You cannot leave this team. The owner must transfer ownership first.'; end if;
end;
$$;

create function community_private.list_teams()
returns table (team_id uuid, name text, role text, member_count bigint, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, mine.role, count(*) filter (where all_members.status = 'active'), t.created_at
  from public.team_members mine
  join public.teams t on t.id = mine.team_id
  join public.team_members all_members on all_members.team_id = t.id
  where auth.uid() is not null and mine.user_id = auth.uid() and mine.status = 'active'
  group by t.id, t.name, mine.role, t.created_at
  order by t.created_at desc
  limit 100;
$$;

create function community_private.list_team_invitations()
returns table (team_id uuid, team_name text, invited_by uuid, inviter_name text, inviter_handle text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.name, m.invited_by, p.display_name, p.handle, m.created_at
  from public.team_members m
  join public.teams t on t.id = m.team_id
  join public.profiles p on p.id = m.invited_by
  where auth.uid() is not null and m.user_id = auth.uid() and m.status = 'invited'
  order by m.created_at desc
  limit 100;
$$;

create function community_private.list_team_members(p_team_id uuid)
returns table (user_id uuid, handle text, display_name text, avatar_url text, role text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.handle, p.display_name, p.avatar_url, m.role, m.responded_at
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  where auth.uid() is not null and m.team_id = p_team_id and m.status = 'active'
    and community_private.is_active_team_member(p_team_id)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, p.display_name
  limit 100;
$$;

create function community_private.share_prompt(
  p_prompt_id uuid, p_target_type text, p_target_user_id uuid default null, p_target_team_id uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_prompt public.prompts%rowtype; v_profile public.profiles%rowtype; v_share_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  select * into v_prompt from public.prompts where id = p_prompt_id and user_id = v_me and deleted_at is null;
  if not found then raise exception 'Choose a prompt in your own active vault.'; end if;
  if char_length(v_prompt.content) > 200000 then raise exception 'This prompt is too large to share (200,000 characters maximum).'; end if;
  if p_target_type = 'friend' then
    if p_target_team_id is not null or p_target_user_id is null
      or not community_private.current_user_is_friend(p_target_user_id) then
      raise exception 'Direct shares require an accepted, unblocked friend.';
    end if;
  elsif p_target_type = 'team' then
    if p_target_user_id is not null or p_target_team_id is null
      or not community_private.is_active_team_member(p_target_team_id) then
      raise exception 'You must be an active member of the selected team.';
    end if;
  else
    raise exception 'Choose a friend or a team.';
  end if;
  select * into v_profile from public.profiles where id = v_me;
  insert into public.prompt_shares (
    source_prompt_id, owner_id, target_type, target_user_id, target_team_id,
    title, content, description, platform, owner_display_name, owner_handle
  ) values (
    v_prompt.id, v_me, p_target_type, p_target_user_id, p_target_team_id,
    v_prompt.title, v_prompt.content, v_prompt.description, v_prompt.platform,
    coalesce(v_profile.display_name, ''), v_profile.handle
  ) returning id into v_share_id;
  return v_share_id;
end;
$$;

create function community_private.revoke_prompt_share(p_share_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  update public.prompt_shares set revoked_at = now()
  where id = p_share_id and owner_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'Active share not found or not owned by you.'; end if;
end;
$$;

create function community_private.save_shared_prompt(p_share_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_share public.prompt_shares%rowtype; v_existing uuid; v_prompt_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  select * into v_share from public.prompt_shares where id = p_share_id for update;
  if not found or v_share.revoked_at is not null then raise exception 'This prompt is no longer shared with you.'; end if;
  if not community_private.can_read_share(v_share.owner_id, v_share.target_type,
      v_share.target_user_id, v_share.target_team_id, v_share.revoked_at)
      or v_share.owner_id = v_me then
    raise exception 'You are not a recipient of this prompt share.';
  end if;
  select prompt_id into v_existing from public.saved_shared_prompts
    where share_id = p_share_id and saver_id = v_me;
  if found then return v_existing; end if;
  insert into public.prompts (user_id, title, content, description, platform)
    values (v_me, v_share.title, v_share.content, v_share.description, v_share.platform)
    returning id into v_prompt_id;
  insert into public.saved_shared_prompts (share_id, saver_id, prompt_id)
    values (p_share_id, v_me, v_prompt_id);
  return v_prompt_id;
end;
$$;

create function community_private.report_user(
  p_reported_user_id uuid, p_category text, p_context_type text, p_context_id uuid, p_reason text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_id uuid;
begin
  if v_me is null then raise exception 'Sign in required.'; end if;
  if p_reported_user_id is null or p_reported_user_id = v_me then raise exception 'Choose another account.'; end if;
  if p_category not in ('harassment','spam','inappropriate','other') then raise exception 'Choose a report category.'; end if;
  if p_context_type not in ('friend','team','message','share') then raise exception 'Choose a report context.'; end if;
  if char_length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'Add 10–2,000 characters of context.'; end if;
  insert into public.user_reports (reporter_id, reported_user_id, category, context_type, context_id, reason)
    values (v_me, p_reported_user_id, p_category, p_context_type, p_context_id, trim(p_reason)) returning id into v_id;
  return v_id;
end;
$$;

-- RLS helpers are callable only by authenticated users and always use auth.uid().
revoke all on all functions in schema community_private from public, anon;
grant execute on function community_private.current_user_is_friend(uuid) to authenticated;
grant execute on function community_private.is_active_team_member(uuid) to authenticated;
grant execute on function community_private.is_team_admin(uuid) to authenticated;
grant execute on function community_private.can_read_share(uuid,text,uuid,uuid,timestamptz) to authenticated;

grant execute on function community_private.set_my_handle(text) to authenticated;
grant execute on function community_private.search_profile(text) to authenticated;
grant execute on function community_private.list_friend_requests() to authenticated;
grant execute on function community_private.list_friends() to authenticated;
grant execute on function community_private.send_friend_request(uuid) to authenticated;
grant execute on function community_private.respond_friend_request(uuid,text) to authenticated;
grant execute on function community_private.remove_friend(uuid) to authenticated;
grant execute on function community_private.block_user(uuid) to authenticated;
grant execute on function community_private.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function community_private.create_team(text) to authenticated;
grant execute on function community_private.invite_team_member(uuid,uuid) to authenticated;
grant execute on function community_private.respond_team_invitation(uuid,boolean) to authenticated;
grant execute on function community_private.remove_team_member(uuid,uuid) to authenticated;
grant execute on function community_private.set_team_member_role(uuid,uuid,text) to authenticated;
grant execute on function community_private.transfer_team_owner(uuid,uuid) to authenticated;
grant execute on function community_private.leave_team(uuid) to authenticated;
grant execute on function community_private.list_teams() to authenticated;
grant execute on function community_private.list_team_invitations() to authenticated;
grant execute on function community_private.list_team_members(uuid) to authenticated;
grant execute on function community_private.share_prompt(uuid,text,uuid,uuid) to authenticated;
grant execute on function community_private.revoke_prompt_share(uuid) to authenticated;
grant execute on function community_private.save_shared_prompt(uuid) to authenticated;
grant execute on function community_private.report_user(uuid,text,text,uuid,text) to authenticated;

-- Public, authenticated-only RPC surface. These invoker wrappers are safe to expose;
-- authorization and writes are delegated to constrained helpers in the unexposed schema.
create function public.set_my_handle(p_handle text) returns text
language sql security invoker set search_path = '' as $$ select community_private.set_my_handle(p_handle); $$;
create function public.search_profile(p_handle text)
returns table (user_id uuid, handle text, display_name text, avatar_url text)
language sql stable security invoker set search_path = '' as $$ select * from community_private.search_profile(p_handle); $$;
create function public.list_friend_requests()
returns table (id uuid, direction text, other_user_id uuid, handle text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from community_private.list_friend_requests(); $$;
create function public.list_friends()
returns table (user_id uuid, handle text, display_name text, avatar_url text, friendship_created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from community_private.list_friends(); $$;
create function public.send_friend_request(p_other_user_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.send_friend_request(p_other_user_id); $$;
create function public.respond_friend_request(p_request_id uuid, p_action text) returns void
language sql security invoker set search_path = '' as $$ select community_private.respond_friend_request(p_request_id, p_action); $$;
create function public.remove_friend(p_other_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.remove_friend(p_other_user_id); $$;
create function public.block_user(p_other_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.block_user(p_other_user_id); $$;
create function public.get_or_create_direct_conversation(p_other_user_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.get_or_create_direct_conversation(p_other_user_id); $$;
create function public.create_team(p_name text) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.create_team(p_name); $$;
create function public.invite_team_member(p_team_id uuid, p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.invite_team_member(p_team_id, p_user_id); $$;
create function public.respond_team_invitation(p_team_id uuid, p_accept boolean) returns void
language sql security invoker set search_path = '' as $$ select community_private.respond_team_invitation(p_team_id, p_accept); $$;
create function public.remove_team_member(p_team_id uuid, p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.remove_team_member(p_team_id, p_user_id); $$;
create function public.set_team_member_role(p_team_id uuid, p_user_id uuid, p_role text) returns void
language sql security invoker set search_path = '' as $$ select community_private.set_team_member_role(p_team_id, p_user_id, p_role); $$;
create function public.transfer_team_owner(p_team_id uuid, p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.transfer_team_owner(p_team_id, p_user_id); $$;
create function public.leave_team(p_team_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.leave_team(p_team_id); $$;
create function public.list_teams()
returns table (team_id uuid, name text, role text, member_count bigint, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from community_private.list_teams(); $$;
create function public.list_team_invitations()
returns table (team_id uuid, team_name text, invited_by uuid, inviter_name text, inviter_handle text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from community_private.list_team_invitations(); $$;
create function public.list_team_members(p_team_id uuid)
returns table (user_id uuid, handle text, display_name text, avatar_url text, role text, joined_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from community_private.list_team_members(p_team_id); $$;
create function public.share_prompt(p_prompt_id uuid, p_target_type text, p_target_user_id uuid default null, p_target_team_id uuid default null) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.share_prompt(p_prompt_id, p_target_type, p_target_user_id, p_target_team_id); $$;
create function public.revoke_prompt_share(p_share_id uuid) returns void
language sql security invoker set search_path = '' as $$ select community_private.revoke_prompt_share(p_share_id); $$;
create function public.save_shared_prompt(p_share_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.save_shared_prompt(p_share_id); $$;
create function public.report_user(p_reported_user_id uuid, p_category text, p_context_type text, p_context_id uuid, p_reason text) returns uuid
language sql security invoker set search_path = '' as $$ select community_private.report_user(p_reported_user_id, p_category, p_context_type, p_context_id, p_reason); $$;

-- Revoke only the RPC surface introduced here; leave the existing 0001 trigger
-- functions and any future unrelated public-schema functions untouched.
revoke execute on function public.set_my_handle(text) from public, anon;
revoke execute on function public.search_profile(text) from public, anon;
revoke execute on function public.list_friend_requests() from public, anon;
revoke execute on function public.list_friends() from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid,text) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.block_user(uuid) from public, anon;
revoke execute on function public.get_or_create_direct_conversation(uuid) from public, anon;
revoke execute on function public.create_team(text) from public, anon;
revoke execute on function public.invite_team_member(uuid,uuid) from public, anon;
revoke execute on function public.respond_team_invitation(uuid,boolean) from public, anon;
revoke execute on function public.remove_team_member(uuid,uuid) from public, anon;
revoke execute on function public.set_team_member_role(uuid,uuid,text) from public, anon;
revoke execute on function public.transfer_team_owner(uuid,uuid) from public, anon;
revoke execute on function public.leave_team(uuid) from public, anon;
revoke execute on function public.list_teams() from public, anon;
revoke execute on function public.list_team_invitations() from public, anon;
revoke execute on function public.list_team_members(uuid) from public, anon;
revoke execute on function public.share_prompt(uuid,text,uuid,uuid) from public, anon;
revoke execute on function public.revoke_prompt_share(uuid) from public, anon;
revoke execute on function public.save_shared_prompt(uuid) from public, anon;
revoke execute on function public.report_user(uuid,text,text,uuid,text) from public, anon;
grant execute on function public.set_my_handle(text) to authenticated;
grant execute on function public.search_profile(text) to authenticated;
grant execute on function public.list_friend_requests() to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid,text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.invite_team_member(uuid,uuid) to authenticated;
grant execute on function public.respond_team_invitation(uuid,boolean) to authenticated;
grant execute on function public.remove_team_member(uuid,uuid) to authenticated;
grant execute on function public.set_team_member_role(uuid,uuid,text) to authenticated;
grant execute on function public.transfer_team_owner(uuid,uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.list_teams() to authenticated;
grant execute on function public.list_team_invitations() to authenticated;
grant execute on function public.list_team_members(uuid) to authenticated;
grant execute on function public.share_prompt(uuid,text,uuid,uuid) to authenticated;
grant execute on function public.revoke_prompt_share(uuid) to authenticated;
grant execute on function public.save_shared_prompt(uuid) to authenticated;
grant execute on function public.report_user(uuid,text,text,uuid,text) to authenticated;

-- Enable RLS on every new client-accessible table.
alter table public.friend_requests enable row level security;
alter table public.user_blocks enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_messages enable row level security;
alter table public.prompt_shares enable row level security;
alter table public.saved_shared_prompts enable row level security;
alter table public.user_reports enable row level security;

create policy "participants read friend requests" on public.friend_requests
  for select to authenticated using ((select auth.uid()) in (requester_id, recipient_id));
create policy "users read their own blocks" on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "users unblock their own block" on public.user_blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);

create policy "friends read their direct conversations" on public.direct_conversations
  for select to authenticated using (
    ((select auth.uid()) = user_low and community_private.current_user_is_friend(user_high))
    or ((select auth.uid()) = user_high and community_private.current_user_is_friend(user_low))
  );
create policy "participants read direct messages" on public.direct_messages
  for select to authenticated using (
    exists (select 1 from public.direct_conversations c where c.id = conversation_id)
  );
create policy "participants send direct messages" on public.direct_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (select 1 from public.direct_conversations c where c.id = conversation_id)
  );

create policy "active members read teams" on public.teams
  for select to authenticated using (community_private.is_active_team_member(id));
create policy "members read team roster" on public.team_members
  for select to authenticated using (
    user_id = (select auth.uid()) or community_private.is_active_team_member(team_id)
  );
create policy "active members read team messages" on public.team_messages
  for select to authenticated using (community_private.is_active_team_member(team_id));
create policy "active members send team messages" on public.team_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and community_private.is_active_team_member(team_id)
  );

create policy "owners and active recipients read explicit shares" on public.prompt_shares
  for select to authenticated using (
    community_private.can_read_share(owner_id, target_type, target_user_id, target_team_id, revoked_at)
  );
create policy "users read their own saved-share records" on public.saved_shared_prompts
  for select to authenticated using ((select auth.uid()) = saver_id);
create policy "reporters can submit reports" on public.user_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and reporter_id <> reported_user_id
  );
create policy "reporters can read their own reports" on public.user_reports
  for select to authenticated using ((select auth.uid()) = reporter_id);

-- Explicit grants are required in addition to RLS; anonymous access is not granted.
revoke all on public.friend_requests, public.user_blocks, public.direct_conversations,
  public.direct_messages, public.teams, public.team_members, public.team_messages,
  public.prompt_shares, public.saved_shared_prompts, public.user_reports from anon;
grant select on public.friend_requests to authenticated;
grant select, delete on public.user_blocks to authenticated;
grant select on public.direct_conversations to authenticated;
grant select on public.direct_messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.direct_messages to authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select on public.team_messages to authenticated;
grant insert (team_id, sender_id, body) on public.team_messages to authenticated;
grant select on public.prompt_shares, public.saved_shared_prompts to authenticated;
grant select on public.user_reports to authenticated;
grant insert (reporter_id, reported_user_id, category, context_type, context_id, reason)
  on public.user_reports to authenticated;

-- Supabase Realtime streams only message rows permitted by the same RLS policies.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Expected Supabase publication supabase_realtime was not found.';
  end if;
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages') then
    execute 'alter publication supabase_realtime add table public.direct_messages';
  end if;
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_messages') then
    execute 'alter publication supabase_realtime add table public.team_messages';
  end if;
end;
$$;
