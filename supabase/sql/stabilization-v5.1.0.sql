-- Additive deployment prerequisite. Does not modify residents, reports or river measurements.
create table if not exists public.access_attempt_windows (
  rate_key text primary key,
  attempts integer not null check (attempts > 0),
  window_started_at timestamptz not null default now()
);
alter table public.access_attempt_windows enable row level security;
revoke all on public.access_attempt_windows from public, anon, authenticated;
grant select, insert, update, delete on public.access_attempt_windows to service_role;
create index if not exists access_attempt_windows_age_idx on public.access_attempt_windows(window_started_at);

-- A single atomic UPSERT serializes concurrent reservations for the same key.
-- Invoker rights and explicit grants keep the RPC unavailable to public clients.
create or replace function public.reserve_access_attempt(p_key text, p_limit integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_row public.access_attempt_windows; v_now timestamptz := clock_timestamp();
begin
  if length(p_key) <> 64 or p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_RATE_PARAMETERS';
  end if;
  insert into public.access_attempt_windows as w(rate_key,attempts,window_started_at)
  values(p_key,1,v_now)
  on conflict(rate_key) do update set
    attempts = case when w.window_started_at <= v_now - interval '15 minutes' then 1 else least(w.attempts+1,101) end,
    window_started_at = case when w.window_started_at <= v_now - interval '15 minutes' then v_now else w.window_started_at end
  returning * into v_row;
  if v_row.attempts > p_limit then
    return greatest(1,ceil(extract(epoch from (v_row.window_started_at + interval '15 minutes' - v_now)))::integer);
  end if;
  return 0;
end;
$$;
revoke all on function public.reserve_access_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_access_attempt(text,integer) to service_role;
comment on table public.access_attempt_windows is 'v5.1.0 access reservations; periodically delete windows older than 24h. No PINs, emails or raw IPs.';
select cron.schedule('monitora-access-window-cleanup','17 3 * * *',
  $cleanup$delete from public.access_attempt_windows where window_started_at < now() - interval '24 hours'$cleanup$);

