-- Room OS schema for Supabase (Postgres). Mirrors the RoomStore data model used by the
-- local Room Agent so the cloud can hold the same rooms, devices, displays, scenes,
-- automations and logs. Row-level security keeps every row scoped to its owner.
--
-- NOT YET WIRED: the agent uses a local JSON store today (packages/agent/src/store.ts).
-- A SupabaseStore implementing the same interface is the next step for cloud sync.

create extension if not exists "pgcrypto";

create table rooms (
  id              text primary key,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  timezone        text,
  mode            text,
  watched_game_ids text[] not null default '{}',
  favorite_teams  text[] not null default '{}',
  active_delay_profile_id text,
  automations_paused_until timestamptz,
  guest_mode      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table devices (
  id           text primary key,
  room_id      text not null references rooms(id) on delete cascade,
  type         text not null check (type in ('television','monitor','projector','projector_screen','av_receiver','speaker','light','smart_plug','computer','browser_display','virtual_display','button')),
  name         text not null,
  position     jsonb,
  capabilities text[] not null default '{}',
  inputs       jsonb,
  groups       text[] not null default '{}',
  driver       text not null default 'mock',
  driver_config jsonb,
  status       text not null default 'SIMULATED' check (status in ('CONNECTED','SIMULATED','UNVERIFIED','OFFLINE')),
  state        jsonb not null default '{}',
  manual_hold_until timestamptz
);

create table display_roles (
  role        text primary key,
  label       text not null
);
insert into display_roles values
  ('MAIN_GAME','Primary Game'),('SECOND_GAME','Second Game'),('SCOREBOARD','Scoreboard'),('PLAYER_STATS','Player Stats'),
  ('FANTASY','Fantasy'),('LEAGUE_SCORES','League Scores'),('BRACKET','Bracket'),('SOCIAL','Social'),('ROOM_STATUS','Room Status'),
  ('MOVIE_INFO','Movie Info'),('PROJECTED_TICKER','Projected Ribbon'),('AMBIENT','Ambient Art'),('CUSTOM','Custom URL'),('OFF','Off');

create table display_devices (
  id           text primary key,
  room_id      text not null references rooms(id) on delete cascade,
  device_id    text references devices(id) on delete set null,
  name         text not null,
  kind         text not null check (kind in ('tv','monitor','projector','ultrawide')),
  role         text not null references display_roles(role),
  role_options jsonb,
  pairing_code text not null,
  paired       boolean not null default false,
  last_seen_at timestamptz,
  position     jsonb not null default '{"x":40,"y":50,"w":20,"h":12}'
);

create table display_presets (
  id          text primary key,
  room_id     text not null references rooms(id) on delete cascade,
  name        text not null,
  assignments jsonb not null default '[]'
);

create table room_modes (
  mode  text primary key,
  label text not null
);
insert into room_modes values ('SPORTS','Sports'),('MOVIE','Movie'),('MULTIVIEW','Multiview'),('WORK','Work'),('GAME_DAY','Game Day'),('PARTY','Party'),('AMBIENT','Ambient'),('ALL_OFF','All Off');

create table scenes (
  id        text primary key,
  room_id   text not null references rooms(id) on delete cascade,
  name      text not null,
  mode      text references room_modes(mode),
  suppress_sports_automations boolean not null default false
);

create table scene_actions (
  id        bigserial primary key,
  scene_id  text not null references scenes(id) on delete cascade,
  delay_ms  integer not null default 0,
  label     text,
  action    jsonb not null
);

create table teams (
  id          text primary key,
  league_id   text not null,
  abbreviation text not null,
  name        text not null,
  short_name  text,
  logo_url    text,
  primary_color   text,
  secondary_color text,
  celebration text,
  audio_clip  text,
  theme       text
);

create table games (
  id          text primary key,
  league_id   text not null,
  sport       text not null,
  start_time  timestamptz not null,
  status      text not null,
  home_team   text references teams(id),
  away_team   text references teams(id),
  home_score  integer not null default 0,
  away_score  integer not null default 0,
  period      integer,
  clock       text,
  situation   jsonb,
  provider    text not null,
  updated_at  timestamptz not null default now()
);

create table sports_events (
  id          text primary key,
  game_id     text not null,
  room_id     text references rooms(id) on delete cascade,
  ts          timestamptz not null,
  release_at  timestamptz,
  type        text not null,
  side        text,
  team_id     text,
  data        jsonb not null default '{}',
  confidence  real not null default 1,
  state       text not null check (state in ('pending','released','reversed','cancelled')),
  source      text not null check (source in ('provider','manual','engine')),
  text        text not null
);
create index on sports_events (room_id, ts desc);

create table broadcast_delay_profiles (
  id            text primary key,
  room_id       text not null references rooms(id) on delete cascade,
  name          text not null,
  source        text,
  app           text,
  device_id     text references devices(id) on delete set null,
  delay_ms      integer not null default 0,
  calibrated_at timestamptz,
  samples       integer[]
);

create table automations (
  id           text primary key,
  room_id      text not null references rooms(id) on delete cascade,
  name         text not null,
  enabled      boolean not null default true,
  cooldown_ms  integer,
  allowed_modes text[]
);

create table automation_triggers (
  id            bigserial primary key,
  automation_id text not null references automations(id) on delete cascade,
  event_types   text[] not null,
  teams         text[],
  watched_games_only boolean not null default true,
  manual        boolean not null default true
);

create table automation_steps (
  id            bigserial primary key,
  automation_id text not null references automations(id) on delete cascade,
  position      integer not null,
  step          jsonb not null
);

create table automation_runs (
  id              text primary key,
  automation_id   text references automations(id) on delete set null,
  room_id         text references rooms(id) on delete cascade,
  event_id        text,
  started_at      timestamptz not null,
  finished_at     timestamptz,
  status          text not null check (status in ('running','done','suppressed','failed','cancelled')),
  reason          text,
  log             jsonb not null default '[]'
);
create index on automation_runs (room_id, started_at desc);

create table timeline (
  id       text primary key,
  room_id  text not null references rooms(id) on delete cascade,
  ts       timestamptz not null,
  kind     text not null,
  text     text not null,
  detail   jsonb
);
create index on timeline (room_id, ts desc);

-- Row level security: a person sees only rooms they own.
alter table rooms enable row level security;
create policy rooms_owner on rooms for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['devices','display_devices','display_presets','scenes','sports_events','broadcast_delay_profiles','automations','automation_runs','timeline']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_owner on %I for all using (exists (select 1 from rooms r where r.id = %I.room_id and r.owner_id = auth.uid())) with check (exists (select 1 from rooms r where r.id = %I.room_id and r.owner_id = auth.uid()))', t, t, t, t);
  end loop;
end $$;

-- Realtime: the app subscribes to these for live updates when the cloud store is used.
alter publication supabase_realtime add table rooms, devices, display_devices, sports_events, automation_runs, timeline;
