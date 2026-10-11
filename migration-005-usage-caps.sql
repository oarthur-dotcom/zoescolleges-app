-- Zoe's Colleges M5: per-user AI question limits tied to plan tier
-- Tracks daily Zoe-AI usage per user; resets at midnight UTC.

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_date date not null,
  count int not null default 0,
  last_used_at timestamptz not null default now(),
  primary key (user_id, question_date)
);
create index ai_usage_user_idx on public.ai_usage(user_id);

-- ============ ROW LEVEL SECURITY ============
alter table public.ai_usage enable row level security;

create policy "users read own usage" on public.ai_usage
  for select using (user_id = auth.uid());

-- The Netlify function (via security definer) increments usage
create or replace function public.increment_ai_usage(uid uuid)
returns record language plpgsql security definer set search_path = public as $$
declare
  today date := current_date;
  used int;
  quota int;
  plan text;
  fid uuid;
begin
  -- Get the user's family and plan
  select family_id into fid from public.members where user_id = uid;
  select plan into plan from public.families where id = fid;

  -- Set quota based on plan
  quota := case plan
    when 'free' then 3
    when 'family' then 15
    else 999999  -- family_plus: unlimited
  end;

  -- Increment or create usage row for today
  insert into public.ai_usage (user_id, question_date, count, last_used_at)
    values (uid, today, 1, now())
  on conflict (user_id, question_date) do
    update set count = count + 1, last_used_at = now();

  -- Get updated count
  select count into used from public.ai_usage
    where user_id = uid and question_date = today;

  return row(used, quota, (used >= quota));
end $$;
