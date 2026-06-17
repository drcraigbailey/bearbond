alter table public.pairs
  add column if not exists last_scene text,
  add column if not exists last_scene_from uuid,
  add column if not exists last_scene_at timestamptz;

create index if not exists pairs_last_scene_from_idx
  on public.pairs (last_scene_from)
  where last_scene_from is not null;
