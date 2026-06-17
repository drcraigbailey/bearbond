alter table public.pairs
  add column if not exists last_scene text,
  add column if not exists last_scene_from uuid,
  add column if not exists last_scene_at timestamptz;

create index if not exists pairs_last_scene_at_idx
  on public.pairs (last_scene_at)
  where last_scene_at is not null;
