-- Strings Chat Schema Initialization
-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  model_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  name text,
  metadata jsonb,
  tool_invocations jsonb,
  tool_result jsonb,
  created_at timestamptz not null default now()
);

-- Documents (Embeddings)
create table if not exists public.documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  project_name text,
  embedding vector(1536)
);

-- Agents
create table if not exists public.user_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  content text not null,
  color_hex text,
  icon_key text,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid references public.user_agents(id) on delete cascade,
  agent_builtin_id text,
  is_enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint agent_pref_ref_chk check ((agent_id is not null) or (agent_builtin_id is not null))
);

-- Indexes
create index if not exists idx_conversations_user_updated on public.conversations(user_id, updated_at desc);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at asc);
create index if not exists idx_documents_project on public.documents(project_name);
create index if not exists documents_embedding_idx on public.documents using ivfflat (embedding vector_l2_ops) with (lists = 100);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_agents enable row level security;
alter table public.agent_preferences enable row level security;
alter table public.documents enable row level security;

-- Policies
-- Conversations
drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists conversations_mod_own on public.conversations;
create policy conversations_mod_own on public.conversations
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Messages
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select using (auth.uid() = user_id);

drop policy if exists messages_mod_own on public.messages;
create policy messages_mod_own on public.messages
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- User Agents
drop policy if exists agents_select_own on public.user_agents;
create policy agents_select_own on public.user_agents
  for select using (auth.uid() = user_id);

drop policy if exists agents_mod_own on public.user_agents;
create policy agents_mod_own on public.user_agents
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Agent Preferences
drop policy if exists agent_prefs_select_own on public.agent_preferences;
create policy agent_prefs_select_own on public.agent_preferences
  for select using (auth.uid() = user_id);

drop policy if exists agent_prefs_mod_own on public.agent_preferences;
create policy agent_prefs_mod_own on public.agent_preferences
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Documents: optional per-user isolation; comment out to share across users
drop policy if exists documents_read_all on public.documents;
create policy documents_read_all on public.documents for select using (true);




