alter table public.invention_cases
  add column if not exists proposed_brand_name text null
  check (proposed_brand_name is null or length(btrim(proposed_brand_name)) between 2 and 80);

create table public.trademark_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invention_id uuid null references public.invention_cases(id) on delete set null,
  brand_name text not null check (length(btrim(brand_name)) between 2 and 80),
  normalized_brand_name text not null check (length(normalized_brand_name) between 1 and 100),
  nice_class smallint not null check (nice_class between 1 and 45),
  goods_services_description text check (goods_services_description is null or length(goods_services_description) <= 3000),
  intended_market text check (intended_market in ('INDIA', 'INTERNATIONAL', 'INDIA_AND_INTERNATIONAL')),
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
  provider text not null check (length(provider) between 1 and 40),
  provider_version text not null check (length(provider_version) between 1 and 40),
  input_hash text not null check (length(input_hash) = 64),
  analysis_result jsonb check (analysis_result is null or jsonb_typeof(analysis_result) = 'object'),
  overall_status text check (overall_status is null or overall_status in ('LOWER_PRELIMINARY_RISK', 'POTENTIAL_CONFLICT', 'HIGH_PRELIMINARY_CONFLICT', 'INSUFFICIENT_VERIFICATION')),
  official_verification_status text not null default 'NOT_PERFORMED' check (official_verification_status in ('NOT_PERFORMED', 'SUPPLEMENTARY_OFFICIAL_SOURCES', 'VERIFIED_OFFICIAL_EVIDENCE')),
  error_code text check (error_code is null or length(error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'COMPLETED' and analysis_result is not null and completed_at is not null and overall_status is not null) or status <> 'COMPLETED')
);

create index trademark_searches_owner_created_idx on public.trademark_searches (user_id, created_at desc);
create index trademark_searches_invention_created_idx on public.trademark_searches (invention_id, created_at desc) where invention_id is not null;
create index trademark_searches_normalized_name_idx on public.trademark_searches (normalized_brand_name);
create index trademark_searches_latest_completed_idx on public.trademark_searches (user_id, completed_at desc) where status = 'COMPLETED';
create index trademark_searches_completed_input_idx on public.trademark_searches (user_id, input_hash, completed_at desc) where status = 'COMPLETED';
create unique index trademark_searches_one_processing_input_idx on public.trademark_searches (user_id, input_hash) where status = 'PROCESSING';

create function public.set_trademark_searches_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
create trigger trademark_searches_set_updated_at before update on public.trademark_searches for each row execute function public.set_trademark_searches_updated_at();

alter table public.trademark_searches enable row level security;
create policy "Users can read owned trademark searches" on public.trademark_searches for select to authenticated using (auth.uid() = user_id and (invention_id is null or exists (select 1 from public.invention_cases invention where invention.id = trademark_searches.invention_id and invention.user_id = auth.uid())));
create policy "Users can create owned trademark searches" on public.trademark_searches for insert to authenticated with check (auth.uid() = user_id and (invention_id is null or exists (select 1 from public.invention_cases invention where invention.id = trademark_searches.invention_id and invention.user_id = auth.uid())));
create policy "Users can update owned trademark searches" on public.trademark_searches for update to authenticated using (auth.uid() = user_id and (invention_id is null or exists (select 1 from public.invention_cases invention where invention.id = trademark_searches.invention_id and invention.user_id = auth.uid()))) with check (auth.uid() = user_id and (invention_id is null or exists (select 1 from public.invention_cases invention where invention.id = trademark_searches.invention_id and invention.user_id = auth.uid())));
create policy "Users can delete owned trademark searches" on public.trademark_searches for delete to authenticated using (auth.uid() = user_id and (invention_id is null or exists (select 1 from public.invention_cases invention where invention.id = trademark_searches.invention_id and invention.user_id = auth.uid())));
grant select, insert, update, delete on public.trademark_searches to authenticated;
