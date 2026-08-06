-- =====================================================
-- Supabase schema actualizado para ReportaRD
-- Ejecuta esto en el SQL Editor de Supabase
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- PROFILES
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  sector text,
  created_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists email text;

-- =====================================================
-- REPORTS
-- =====================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  report_type text not null,
  urgency text not null,
  description text,
  location_text text,
  latitude double precision,
  longitude double precision,
  status text not null default 'en_revision',
  tracking_number text unique,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.reports
add column if not exists image_url text;

-- =====================================================
-- REPORT EVIDENCE
-- =====================================================

create table if not exists public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  file_url text not null,
  file_type text,
  created_at timestamptz not null default now()
);

-- =====================================================
-- ALERTS
-- =====================================================

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  title text not null,
  severity text not null,
  radius_meters integer,
  created_at timestamptz not null default now()
);

-- =====================================================
-- INDEX
-- =====================================================

create index if not exists reports_created_at_idx
on public.reports(created_at desc);

create index if not exists reports_location_idx
on public.reports(latitude, longitude);

-- =====================================================
-- RLS
-- =====================================================

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_evidence enable row level security;
alter table public.alerts enable row level security;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- =====================================================
-- REPORTS POLICIES
-- =====================================================

drop policy if exists "reports_select_all" on public.reports;

create policy "reports_select_all"
on public.reports
for select
using (true);

drop policy if exists "reports_insert_all" on public.reports;

create policy "reports_insert_all"
on public.reports
for insert
with check (true);

-- =====================================================
-- REPORT EVIDENCE POLICIES
-- =====================================================

drop policy if exists "report_evidence_select_all" on public.report_evidence;

create policy "report_evidence_select_all"
on public.report_evidence
for select
using (true);

drop policy if exists "report_evidence_insert_all" on public.report_evidence;

create policy "report_evidence_insert_all"
on public.report_evidence
for insert
with check (true);

-- =====================================================
-- ALERTS POLICIES
-- =====================================================

drop policy if exists "alerts_select_all" on public.alerts;

create policy "alerts_select_all"
on public.alerts
for select
using (true);

-- =====================================================
-- STORAGE BUCKET
-- =====================================================

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', true)
on conflict (id) do update
set public = true;

-- =====================================================
-- STORAGE POLICIES
-- =====================================================

drop policy if exists "evidencias_read_all" on storage.objects;

create policy "evidencias_read_all"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'evidencias');

drop policy if exists "evidencias_insert_all" on storage.objects;

create policy "evidencias_insert_all"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'evidencias');