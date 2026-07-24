create table public.patent_drafts (
  id uuid primary key default gen_random_uuid(),
  invention_id uuid not null references public.invention_cases(id) on delete cascade,
  patent_search_id uuid not null references public.patent_searches(id) on delete cascade,
  overlap_report_id uuid not null references public.overlap_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sections jsonb not null default '{}'::jsonb check (jsonb_typeof(sections) = 'object'),
  original_sections jsonb not null default '{}'::jsonb check (jsonb_typeof(original_sections) = 'object'),
  provider_name text not null,
  provider_version text not null,
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  version integer not null default 1 check (version > 0),
  acknowledgement_at timestamptz not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invention_id, patent_search_id, overlap_report_id)
);

create index patent_drafts_owner_invention_idx
  on public.patent_drafts (user_id, invention_id, updated_at desc);

create index patent_drafts_source_chain_idx
  on public.patent_drafts (patent_search_id, overlap_report_id);

create function public.set_patent_drafts_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger patent_drafts_set_updated_at
before update on public.patent_drafts
for each row execute function public.set_patent_drafts_updated_at();

alter table public.patent_drafts enable row level security;

create policy "Users can read owned patent drafts"
on public.patent_drafts
for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1 from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
  )
  and exists (
    select 1 from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
  )
);

create policy "Users can create owned patent drafts"
on public.patent_drafts
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1 from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
      and search.status = 'COMPLETED'
  )
  and exists (
    select 1 from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
      and report.status = 'COMPLETED'
  )
);

create policy "Users can update owned patent drafts"
on public.patent_drafts
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1 from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
  )
  and exists (
    select 1 from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1 from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
  )
  and exists (
    select 1 from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
  )
);

grant select, insert, update on public.patent_drafts to authenticated;
