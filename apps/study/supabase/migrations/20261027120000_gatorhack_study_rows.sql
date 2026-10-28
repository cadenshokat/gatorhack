-- WebAble mobile study (Gator Hack build): answers arrive as rows from participants' phones (apps/study/src/store/remote.ts).
-- The public (anon / publishable) key can only INSERT; it can never read, change or delete rows. Researchers read
-- with the service key (apps/study/scripts/export.mjs). It lives in the semester WebAble project, so every object is
-- named gatorhack_* to keep it apart from that project's own tables. Withdrawal goes through gatorhack_study_withdraw, which deletes a
-- session's rows only when the caller knows that session's secret, and leaves a tombstone.

create extension if not exists pgcrypto with schema extensions;

create table public.gatorhack_study_rows (
  row_id uuid primary key,
  session_id uuid not null,
  code text not null check (code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  cohort text not null check (cohort in ('pilot', 'main')),
  protocol text not null check (length(protocol) <= 64),
  kind text not null check (kind in ('session', 'trial', 'withdraw')),
  stage text check (length(stage) <= 32),
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (pg_column_size(payload) < 500000),
  created_at timestamptz not null default now()
);

comment on table public.gatorhack_study_rows is
  'Gator Hack WebAble mobile study answers (apps/study in cadenshokat/gatorhack). Insert-only for the public key; no names or contact details. Withdrawals delete by session.';

create index gatorhack_study_rows_session on public.gatorhack_study_rows (session_id, created_at);

alter table public.gatorhack_study_rows enable row level security;
revoke all on public.gatorhack_study_rows from anon, authenticated;
grant insert on public.gatorhack_study_rows to anon;

create policy "participants add rows" on public.gatorhack_study_rows
  for insert to anon
  with check (kind in ('session', 'trial'));

create function public.gatorhack_study_withdraw(p_session uuid, p_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text := encode(extensions.digest(p_secret, 'sha256'), 'hex');
  r public.gatorhack_study_rows%rowtype;
begin
  select * into r from public.gatorhack_study_rows
   where session_id = p_session and secret_hash = h and kind <> 'withdraw'
   limit 1;
  if not found then
    return false;
  end if;
  delete from public.gatorhack_study_rows where session_id = p_session and secret_hash = h;
  insert into public.gatorhack_study_rows (row_id, session_id, code, cohort, protocol, kind, stage, secret_hash, payload)
  values (gen_random_uuid(), p_session, r.code, r.cohort, r.protocol, 'withdraw', 'withdrawn', h, '{}'::jsonb);
  return true;
end;
$$;

revoke all on function public.gatorhack_study_withdraw(uuid, text) from public;
grant execute on function public.gatorhack_study_withdraw(uuid, text) to anon;
