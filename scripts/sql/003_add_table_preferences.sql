-- Table Preferences for storing user table-specific preferences (e.g., column orders)
create table if not exists public.table_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, table_name)
);

-- Index for efficient querying
create index if not exists idx_table_preferences_user_table on public.table_preferences(user_id, table_name);

-- Trigger to keep updated_at fresh
drop trigger if exists table_preferences_set_updated_at on public.table_preferences;
create trigger table_preferences_set_updated_at
before update on public.table_preferences
for each row execute function public.set_updated_at();

-- RLS
alter table public.table_preferences enable row level security;

-- Policies
drop policy if exists table_preferences_select_own on public.table_preferences;
create policy table_preferences_select_own on public.table_preferences
  for select using (auth.uid() = user_id);

drop policy if exists table_preferences_insert_own on public.table_preferences;
create policy table_preferences_insert_own on public.table_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists table_preferences_update_own on public.table_preferences;
create policy table_preferences_update_own on public.table_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists table_preferences_delete_own on public.table_preferences;
create policy table_preferences_delete_own on public.table_preferences
  for delete using (auth.uid() = user_id);
