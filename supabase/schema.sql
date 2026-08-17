create table if not exists public.app_data (
  collection text not null,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists app_data_collection_updated_idx
  on public.app_data (collection, updated_at);

alter table public.app_data enable row level security;

-- The server uses the Supabase service-role key, so browser clients never receive
-- direct database credentials. Keep this table inaccessible to the public API.
