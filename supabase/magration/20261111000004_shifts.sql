-- =====================================================================
-- 004: الشفتات والدرج
-- ترقيم الأوردرات مربوط بالشفت، وشفت واحد مفتوح فقط في الفرع.
-- الفتح والقفل يتمّان عبر دوال RPC (open_shift / close_shift).
-- =====================================================================

create type public.shift_status as enum ('open', 'closed');

create table public.shifts (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id) on delete cascade,
  status             public.shift_status not null default 'open',
  opened_by          uuid references public.profiles(id) on delete set null,
  opened_at          timestamptz not null default now(),
  opening_cash       numeric(12,2) not null default 0 check (opening_cash >= 0),
  last_order_number  int not null default 0,
  closed_by          uuid references public.profiles(id) on delete set null,
  closed_at          timestamptz,
  counted_cash       numeric(12,2),
  expected_cash      numeric(12,2),
  cash_difference    numeric(12,2),
  close_notes        text
);
-- شفت واحد مفتوح فقط لكل فرع
create unique index shifts_one_open_per_branch on public.shifts (branch_id) where status = 'open';
create index shifts_branch_opened_idx on public.shifts (branch_id, opened_at desc);

-- حركات الدرج (دخل / خروج) أثناء الشفت
create type public.cash_direction as enum ('in', 'out');

create table public.cash_movements (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  shift_id   uuid not null references public.shifts(id) on delete cascade,
  direction  public.cash_direction not null,
  amount     numeric(12,2) not null check (amount > 0),
  reason     text not null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index cash_movements_shift_idx on public.cash_movements (shift_id);
