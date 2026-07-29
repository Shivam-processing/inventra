create table public.manufacturing_analyses (
  id uuid primary key default gen_random_uuid(),
  invention_id uuid not null references public.invention_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_set_version integer not null check (feature_set_version >= 0),
  input_hash text not null check (length(input_hash) = 64),
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  provider text not null check (length(provider) between 1 and 40),
  provider_version text not null check (length(provider_version) between 1 and 40),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  analysis_result jsonb check (analysis_result is null or jsonb_typeof(analysis_result) = 'object'),
  supplier_search_result jsonb check (supplier_search_result is null or jsonb_typeof(supplier_search_result) = 'object'),
  supplier_checked_at timestamptz,
  error_code text check (error_code is null or length(error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'COMPLETED' and analysis_result is not null and completed_at is not null) or status <> 'COMPLETED')
);

create index manufacturing_analyses_owner_invention_idx
  on public.manufacturing_analyses (user_id, invention_id, created_at desc);

create index manufacturing_analyses_latest_completed_idx
  on public.manufacturing_analyses (user_id, invention_id, feature_set_version, completed_at desc)
  where status = 'COMPLETED';

create index manufacturing_analyses_input_lookup_idx
  on public.manufacturing_analyses (user_id, invention_id, input_hash, completed_at desc)
  where status = 'COMPLETED';

create unique index manufacturing_analyses_one_processing_input_idx
  on public.manufacturing_analyses (user_id, invention_id, input_hash)
  where status = 'PROCESSING';

create function public.set_manufacturing_analyses_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger manufacturing_analyses_set_updated_at
before update on public.manufacturing_analyses
for each row execute function public.set_manufacturing_analyses_updated_at();

alter table public.manufacturing_analyses enable row level security;

create policy "Users can read owned manufacturing analyses"
on public.manufacturing_analyses
for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = manufacturing_analyses.invention_id
      and invention.user_id = auth.uid()
  )
);

create policy "Users can create owned manufacturing analyses"
on public.manufacturing_analyses
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = manufacturing_analyses.invention_id
      and invention.user_id = auth.uid()
      and invention.feature_set_version = manufacturing_analyses.feature_set_version
  )
);

create policy "Users can update owned manufacturing analyses"
on public.manufacturing_analyses
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = manufacturing_analyses.invention_id
      and invention.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = manufacturing_analyses.invention_id
      and invention.user_id = auth.uid()
      and invention.feature_set_version = manufacturing_analyses.feature_set_version
  )
);

create policy "Users can delete owned manufacturing analyses"
on public.manufacturing_analyses
for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = manufacturing_analyses.invention_id
      and invention.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.manufacturing_analyses to authenticated;
