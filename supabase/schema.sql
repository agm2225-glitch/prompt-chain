-- Run this whole file in the Supabase SQL Editor.
-- It does NOT touch your existing prompt_chains / prompt_chain_steps tables (no drops, no column changes).
-- It only adds: a superadmin helper, a reorder function, two tables for run results, and an image bucket.

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

-- Atomic reorder for the existing prompt_chain_steps table (uses its order_by column)
drop function if exists public.reorder_steps(uuid, uuid[]);
create or replace function public.reorder_steps(p_chain_id bigint, p_step_ids bigint[])
returns void
language plpgsql
security invoker
as $$
begin
  update public.prompt_chain_steps s
     set order_by = o.ord
    from unnest(p_step_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.prompt_chain_id = p_chain_id;
end;
$$;

create table if not exists public.chain_runs (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null references public.prompt_chains(id) on delete cascade,
  input_text text,
  input_image_path text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists runs_chain_idx on public.chain_runs(chain_id, created_at desc);

create table if not exists public.chain_run_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.chain_runs(id) on delete cascade,
  step_id bigint references public.prompt_chain_steps(id) on delete set null,
  step_position integer not null,
  step_name text not null,
  output_text text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists outputs_run_idx on public.chain_run_outputs(run_id, step_position);

alter table public.chain_runs enable row level security;
alter table public.chain_run_outputs enable row level security;

drop policy if exists "superadmin all" on public.chain_runs;
create policy "superadmin all" on public.chain_runs for all
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "superadmin all" on public.chain_run_outputs;
create policy "superadmin all" on public.chain_run_outputs for all
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Private bucket for uploaded input images
insert into storage.buckets (id, name, public)
values ('chain-inputs', 'chain-inputs', false)
on conflict (id) do nothing;

drop policy if exists "superadmin storage" on storage.objects;
create policy "superadmin storage" on storage.objects for all
  using (bucket_id = 'chain-inputs' and public.is_superadmin())
  with check (bucket_id = 'chain-inputs' and public.is_superadmin());

-- So the app can list models in the step editor (skip if you already allow signed-in reads):
-- create policy "read models" on public.llm_models for select to authenticated using (true);
-- create policy "read providers" on public.llm_providers for select to authenticated using (true);
