-- Permanent invention deletion must remove only records owned through the
-- deleted invention. Existing workflow history remains untouched otherwise.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.invention_images'::regclass
      and confrelid = 'public.invention_cases'::regclass
  loop
    execute format('alter table public.invention_images drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.patent_searches'::regclass
      and confrelid = 'public.invention_cases'::regclass
  loop
    execute format('alter table public.patent_searches drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select conname from pg_constraint
    where contype = 'f'
      and conrelid = 'public.overlap_reports'::regclass
      and confrelid in ('public.invention_cases'::regclass, 'public.patent_searches'::regclass)
  loop
    execute format('alter table public.overlap_reports drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.invention_images
  add constraint invention_images_invention_id_fkey
  foreign key (invention_id) references public.invention_cases(id) on delete cascade not valid;

alter table public.patent_searches
  add constraint patent_searches_invention_id_fkey
  foreign key (invention_id) references public.invention_cases(id) on delete cascade not valid;

alter table public.overlap_reports
  add constraint overlap_reports_invention_id_fkey
  foreign key (invention_id) references public.invention_cases(id) on delete cascade not valid,
  add constraint overlap_reports_patent_search_id_fkey
  foreign key (patent_search_id) references public.patent_searches(id) on delete cascade not valid;

grant delete on public.invention_cases to authenticated;

drop policy if exists "Users can delete owned inventions" on public.invention_cases;
create policy "Users can delete owned inventions"
on public.invention_cases
for delete
to authenticated
using (auth.uid() = user_id);
