-- Restrictive guards are combined with the existing permissive application
-- policies, so an accidentally broad policy cannot bypass ownership checks.
alter table public.invention_cases enable row level security;
alter table public.invention_images enable row level security;
alter table public.patent_searches enable row level security;
alter table public.overlap_reports enable row level security;
alter table public.patent_drafts enable row level security;

create unique index patent_searches_one_processing_per_feature_set_idx
  on public.patent_searches (user_id, invention_id, feature_set_version)
  where status = 'PROCESSING';

create unique index overlap_reports_one_processing_per_search_idx
  on public.overlap_reports (user_id, invention_id, patent_search_id, feature_set_version)
  where status = 'PROCESSING';

create policy "Inventra invention ownership guard"
on public.invention_cases
as restrictive
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Inventra image ownership guard"
on public.invention_images
as restrictive
for all
to authenticated
using (
  auth.uid() = user_id
  and storage_path like auth.uid()::text || '/' || invention_id::text || '/%'
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = invention_images.invention_id
      and invention.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and storage_path like auth.uid()::text || '/' || invention_id::text || '/%'
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = invention_images.invention_id
      and invention.user_id = auth.uid()
  )
);

create policy "Inventra patent search ownership guard"
on public.patent_searches
as restrictive
for all
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = patent_searches.invention_id
      and invention.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = patent_searches.invention_id
      and invention.user_id = auth.uid()
  )
);

create policy "Inventra overlap report ownership guard"
on public.overlap_reports
as restrictive
for all
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = overlap_reports.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.patent_searches search
    where search.id = overlap_reports.patent_search_id
      and search.invention_id = overlap_reports.invention_id
      and search.user_id = auth.uid()
      and search.feature_set_version = overlap_reports.feature_set_version
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = overlap_reports.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.patent_searches search
    where search.id = overlap_reports.patent_search_id
      and search.invention_id = overlap_reports.invention_id
      and search.user_id = auth.uid()
      and search.feature_set_version = overlap_reports.feature_set_version
  )
);

create policy "Inventra patent draft ownership guard"
on public.patent_drafts
as restrictive
for all
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
      and search.feature_set_version = patent_drafts.feature_set_version
  )
  and exists (
    select 1
    from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
      and report.feature_set_version = patent_drafts.feature_set_version
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.invention_cases invention
    where invention.id = patent_drafts.invention_id
      and invention.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.patent_searches search
    where search.id = patent_drafts.patent_search_id
      and search.invention_id = patent_drafts.invention_id
      and search.user_id = auth.uid()
      and search.feature_set_version = patent_drafts.feature_set_version
  )
  and exists (
    select 1
    from public.overlap_reports report
    where report.id = patent_drafts.overlap_report_id
      and report.invention_id = patent_drafts.invention_id
      and report.patent_search_id = patent_drafts.patent_search_id
      and report.user_id = auth.uid()
      and report.feature_set_version = patent_drafts.feature_set_version
  )
);

create policy "Inventra storage image ownership guard"
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id <> 'invention-images'
  or (
    split_part(name, '/', 1) = auth.uid()::text
    and exists (
    select 1
    from public.invention_cases invention
    where invention.id::text = split_part(storage.objects.name, '/', 2)
      and invention.user_id = auth.uid()
    )
  )
)
with check (
  bucket_id <> 'invention-images'
  or (
    split_part(name, '/', 1) = auth.uid()::text
    and exists (
    select 1
    from public.invention_cases invention
    where invention.id::text = split_part(storage.objects.name, '/', 2)
      and invention.user_id = auth.uid()
    )
  )
);
