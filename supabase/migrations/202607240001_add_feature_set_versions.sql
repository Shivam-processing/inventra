alter table public.invention_cases
  add column feature_set_version integer not null default 0 check (feature_set_version >= 0);

update public.invention_cases
set feature_set_version = 1
where jsonb_typeof(approved_features::jsonb) = 'array'
  and jsonb_array_length(approved_features::jsonb) > 0;

alter table public.patent_searches
  add column feature_set_version integer not null default 0 check (feature_set_version >= 0);

update public.patent_searches search
set feature_set_version = invention.feature_set_version
from public.invention_cases invention
where invention.id = search.invention_id;

alter table public.overlap_reports
  add column feature_set_version integer not null default 0 check (feature_set_version >= 0);

update public.overlap_reports report
set feature_set_version = search.feature_set_version
from public.patent_searches search
where search.id = report.patent_search_id;

alter table public.patent_drafts
  add column feature_set_version integer not null default 0 check (feature_set_version >= 0);

update public.patent_drafts draft
set feature_set_version = search.feature_set_version
from public.patent_searches search
where search.id = draft.patent_search_id;

create index patent_searches_feature_version_idx
  on public.patent_searches (user_id, invention_id, feature_set_version, created_at desc);

create index overlap_reports_feature_version_idx
  on public.overlap_reports (user_id, invention_id, feature_set_version, created_at desc);

create index patent_drafts_feature_version_idx
  on public.patent_drafts (user_id, invention_id, feature_set_version, updated_at desc);
