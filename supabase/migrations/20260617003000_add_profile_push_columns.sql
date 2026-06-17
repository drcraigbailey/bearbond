alter table public.profiles
  add column if not exists push_token text,
  add column if not exists push_platform text,
  add column if not exists push_updated_at timestamptz;

create index if not exists profiles_push_token_idx
  on public.profiles (push_token)
  where push_token is not null;
