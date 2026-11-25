-- =====================================================================
-- 003: طرق الدفع، مناطق التوصيل، الخصومات، العملاء، أجهزة الكول سنتر
-- =====================================================================

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  name       text not null,
  is_cash    boolean not null default false,   -- يدخل في حساب الدرج
  sort_order int not null default 0,
  is_active  boolean not null default true,
  unique (branch_id, name)
);

create table public.delivery_zones (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  name       text not null,
  fee        numeric(10,2) not null default 0 check (fee >= 0),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  unique (branch_id, name)
);

create type public.discount_type as enum ('amount', 'percent');

-- خصومات جاهزة (اختيارية). الكاشير يقدر كمان يكتب خصم يدوي على الأوردر.
create table public.discounts (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  name          text not null,
  discount_type public.discount_type not null,
  value         numeric(10,2) not null check (value > 0),
  is_active     boolean not null default true,
  unique (branch_id, name)
);

-- ---------------------------------------------------------------------
-- العملاء (مشتركون بين كل الفروع) وعناوينهم
-- ---------------------------------------------------------------------
create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  phone             text not null unique check (phone ~ '^[0-9+]{6,20}$'),
  name              text not null default '',
  notes             text,
  created_branch_id uuid references public.branches(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_addresses (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(id) on delete cascade,
  label            text,                                   -- مثال: البيت / الشغل
  address          text not null,
  landmark         text,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  is_default       boolean not null default false,
  created_at       timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses (customer_id);

-- ---------------------------------------------------------------------
-- الكول سنتر: أجهزة الأندرويد + أحداث المكالمات (ظهور بيانات المتصل فقط)
-- الإدخال في call_events يتم من Edge Function بمفتاح الخدمة.
-- ---------------------------------------------------------------------
create table public.call_center_devices (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  name        text not null,
  token_hash  text not null unique,   -- نخزن الهاش فقط، مش التوكن
  is_active   boolean not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now()
);

create type public.call_status as enum ('ringing', 'answered', 'missed', 'converted', 'dismissed');

create table public.call_events (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  device_id   uuid references public.call_center_devices(id) on delete set null,
  phone       text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status      public.call_status not null default 'ringing',
  order_id    uuid,                   -- يتربط بعد التحويل لأوردر
  created_at  timestamptz not null default now()
);
create index call_events_branch_created_idx on public.call_events (branch_id, created_at desc);

-- ربط المتصل بالعميل تلقائياً لو الرقم موجود
create or replace function public.call_events_link_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.customer_id is null then
    select id into new.customer_id from public.customers where phone = new.phone;
  end if;
  return new;
end $$;
create trigger call_events_link_customer before insert on public.call_events
  for each row execute function public.call_events_link_customer();
