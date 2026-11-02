-- Additive, non-destructive school profile statistics for the public website.
alter table public.school_public_statistics
  add column if not exists land_decimals integer,
  add column if not exists playground_decimals integer,
  add column if not exists floor_space_sqft numeric(12,2),
  add column if not exists room_count integer,
  add column if not exists annual_people jsonb not null default '[]'::jsonb,
  add column if not exists ssc_results jsonb not null default '[]'::jsonb,
  add column if not exists jsc_results jsonb not null default '[]'::jsonb,
  add column if not exists source_note text,
  add column if not exists is_published boolean not null default false;

-- Admins only may manage this content; the existing public SELECT policy is preserved.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='school_public_statistics'
      and policyname='Active Super Admins manage school statistics'
  ) then
    create policy "Active Super Admins manage school statistics"
      on public.school_public_statistics
      for all
      to authenticated
      using (
        exists (
          select 1 from public.user_profiles p
          where p.id = (select auth.uid())
            and p.role = 'super_admin'
            and p.is_active = true
        )
      )
      with check (
        exists (
          select 1 from public.user_profiles p
          where p.id = (select auth.uid())
            and p.role = 'super_admin'
            and p.is_active = true
        )
      );
  end if;
end $$;

grant select on public.school_public_statistics to anon, authenticated;
grant insert, update, delete on public.school_public_statistics to authenticated;

insert into public.school_public_statistics
  (id, land_decimals, playground_decimals, floor_space_sqft, room_count,
   annual_people, ssc_results, jsc_results, source_note, is_published)
values
  (1, 565, 104, 6514, 11,
   '[{"year":2024,"teachers":11,"employees":6,"students":215,"ratio":"20:1"},{"year":2023,"teachers":8,"employees":6,"students":201,"ratio":"25:1"},{"year":2022,"teachers":10,"employees":5,"students":214,"ratio":"21:1"},{"year":2021,"teachers":10,"employees":2,"students":225,"ratio":"23:1"},{"year":2020,"teachers":12,"employees":1,"students":null,"ratio":null},{"year":2019,"teachers":13,"employees":1,"students":null,"ratio":null},{"year":2018,"teachers":9,"employees":1,"students":null,"ratio":null},{"year":2017,"teachers":8,"employees":0,"students":null,"ratio":null},{"year":2016,"teachers":7,"employees":0,"students":null,"ratio":null},{"year":2015,"teachers":7,"employees":0,"students":null,"ratio":null},{"year":2014,"teachers":7,"employees":0,"students":null,"ratio":null},{"year":2013,"teachers":7,"employees":0,"students":null,"ratio":null}]'::jsonb,
   '[{"year":2026,"appeared":35,"passed":20,"failed":15,"gpa5":0,"pass_rate":"57.14%"},{"year":2025,"appeared":39,"passed":30,"failed":9,"gpa5":0,"pass_rate":"76.92%"},{"year":2024,"appeared":36,"passed":26,"failed":10,"gpa5":0,"pass_rate":"72.22%"},{"year":2023,"appeared":36,"passed":24,"failed":12,"gpa5":0,"pass_rate":"66.67%"},{"year":2022,"appeared":41,"passed":31,"failed":10,"gpa5":0,"pass_rate":"75.61%"},{"year":2021,"appeared":48,"passed":40,"failed":8,"gpa5":0,"pass_rate":"83.33%"},{"year":2020,"appeared":34,"passed":24,"failed":10,"gpa5":0,"pass_rate":"70.59%"},{"year":2019,"appeared":64,"passed":54,"failed":10,"gpa5":0,"pass_rate":"84.38%"},{"year":2018,"appeared":62,"passed":45,"failed":17,"gpa5":0,"pass_rate":"72.58%"},{"year":2017,"appeared":43,"passed":30,"failed":13,"gpa5":0,"pass_rate":"69.77%"},{"year":2016,"appeared":34,"passed":34,"failed":0,"gpa5":1,"pass_rate":"100.00%"},{"year":2014,"appeared":46,"passed":45,"failed":1,"gpa5":1,"pass_rate":"97.83%"},{"year":2013,"appeared":28,"passed":23,"failed":5,"gpa5":1,"pass_rate":"82.14%"},{"year":2012,"appeared":39,"passed":37,"failed":2,"gpa5":1,"pass_rate":"94.87%"},{"year":2011,"appeared":46,"passed":36,"failed":10,"gpa5":1,"pass_rate":"78.26%"},{"year":2010,"appeared":36,"passed":20,"failed":16,"gpa5":0,"pass_rate":"55.56%"},{"year":2009,"appeared":26,"passed":20,"failed":6,"gpa5":0,"pass_rate":"76.92%"}]'::jsonb,
   '[{"year":2019,"appeared":79,"passed":49,"failed":30,"gpa5":0,"pass_rate":"62.03%"},{"year":2018,"appeared":62,"passed":44,"failed":18,"gpa5":0,"pass_rate":"70.97%"},{"year":2017,"appeared":66,"passed":31,"failed":35,"gpa5":1,"pass_rate":"46.97%"},{"year":2016,"appeared":65,"passed":59,"failed":6,"gpa5":0,"pass_rate":"90.77%"},{"year":2015,"appeared":76,"passed":62,"failed":14,"gpa5":0,"pass_rate":"81.58%"},{"year":2014,"appeared":60,"passed":46,"failed":14,"gpa5":0,"pass_rate":"76.67%"},{"year":2013,"appeared":36,"passed":30,"failed":6,"gpa5":0,"pass_rate":"83.33%"},{"year":2012,"appeared":45,"passed":42,"failed":3,"gpa5":0,"pass_rate":"93.33%"},{"year":2011,"appeared":63,"passed":58,"failed":5,"gpa5":0,"pass_rate":"92.06%"},{"year":2010,"appeared":37,"passed":12,"failed":25,"gpa5":0,"pass_rate":"32.43%"}]'::jsonb,
   'Historical information transcribed from Sohopathi profile for EIIN 120140. Figures are third-party published data and should be verified against school records.', true)
on conflict (id) do update set
  land_decimals=excluded.land_decimals,
  playground_decimals=excluded.playground_decimals,
  floor_space_sqft=excluded.floor_space_sqft,
  room_count=excluded.room_count,
  annual_people=excluded.annual_people,
  ssc_results=excluded.ssc_results,
  jsc_results=excluded.jsc_results,
  source_note=excluded.source_note,
  is_published=excluded.is_published,
  updated_at=now();
