-- Memories Table for AI Assistant
-- Stores persistent memories about the user from conversations

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text, -- e.g., 'personal', 'work', 'family', 'fitness', 'preferences'
  importance integer not null default 1 check (importance >= 1 and importance <= 10), -- 1-10 scale
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz, -- Track when memory was last used in conversation
  access_count integer not null default 0 -- Track how often memory is accessed
);

-- Indexes for efficient querying
create index if not exists idx_memories_user_updated on public.memories(user_id, updated_at desc);
create index if not exists idx_memories_user_category on public.memories(user_id, category);
create index if not exists idx_memories_user_importance on public.memories(user_id, importance desc);
create index if not exists idx_memories_user_last_accessed on public.memories(user_id, last_accessed_at desc nulls last);

-- Trigger to keep updated_at fresh
drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

-- RLS
alter table public.memories enable row level security;

-- Policies
drop policy if exists memories_select_own on public.memories;
create policy memories_select_own on public.memories
  for select using (auth.uid() = user_id);

drop policy if exists memories_insert_own on public.memories;
create policy memories_insert_own on public.memories
  for insert with check (auth.uid() = user_id);

drop policy if exists memories_update_own on public.memories;
create policy memories_update_own on public.memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists memories_delete_own on public.memories;
create policy memories_delete_own on public.memories
  for delete using (auth.uid() = user_id);




