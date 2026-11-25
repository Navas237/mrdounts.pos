-- =====================================================================
-- File: 20261111000001_foundation.sql
-- =====================================================================

-- =====================================================================
-- 001: الأساس — الفروع، المستخدمون، الصلاحيات، الدوال المساعدة
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- الفروع
-- ---------------------------------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger branches_updated_at before update on public.branches
  for each row execute function public.set_updated_at();

-- إعدادات كل فرع (الضريبة، اللوجو، ...)
create table public.branch_settings (
  branch_id   uuid primary key references public.branches(id) on delete cascade,
  logo_url    text,
  currency    text not null default 'EGP',
  tax_enabled boolean not null default false,
  tax_name    text not null default 'ضريبة',
  tax_rate    numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  timezone    text not null default 'Africa/Cairo',
  extra       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create trigger branch_settings_updated_at before update on public.branch_settings
  for each row execute function public.set_updated_at();

create or replace function public.branches_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.branch_settings (branch_id) values (new.id);
  return new;
end $$;
create trigger branches_after_insert after insert on public.branches
  for each row execute function public.branches_after_insert();

-- ---------------------------------------------------------------------
-- المستخدمون (مرتبطون بـ auth.users)
-- اسم الدخول = username + @MRDOUNTS.COM (يُضاف في التطبيق)
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  branch_id      uuid not null references public.branches(id),
  username       text not null,
  full_name      text not null default '',
  phone          text,
  is_active      boolean not null default true,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,32}$')
);
create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_branch_idx on public.profiles (branch_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- كتالوج الصلاحيات (ثابت من النظام) + صلاحيات كل مستخدم (ديناميك)
-- ---------------------------------------------------------------------
create table public.permissions (
  key         text primary key,
  kind        text not null check (kind in ('screen','action')),
  group_name  text not null,
  label_ar    text not null,
  sort_order  int  not null default 0
);

create table public.user_permissions (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  granted_by     uuid references public.profiles(id) on delete set null,
  granted_at     timestamptz not null default now(),
  primary key (user_id, permission_key)
);

-- ---------------------------------------------------------------------
-- دوال مساعدة للصلاحيات (تُستخدم في RLS والـ RPC)
-- ---------------------------------------------------------------------
create or replace function public.auth_branch_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select branch_id from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.auth_is_super()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid() and is_active), false)
$$;

create or replace function public.auth_can_access_branch(b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select b is not null and (b = public.auth_branch_id() or public.auth_is_super())
$$;

create or replace function public.auth_has_perm(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.auth_is_super() or exists (
    select 1
    from public.user_permissions up
    join public.profiles pr on pr.id = up.user_id and pr.is_active
    where up.user_id = auth.uid() and up.permission_key = p)
$$;

create or replace function public.auth_has_any_perm(p text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.auth_is_super() or exists (
    select 1
    from public.user_permissions up
    join public.profiles pr on pr.id = up.user_id and pr.is_active
    where up.user_id = auth.uid() and up.permission_key = any(p))
$$;

revoke execute on function public.auth_branch_id(), public.auth_is_super(),
  public.auth_can_access_branch(uuid), public.auth_has_perm(text),
  public.auth_has_any_perm(text[]) from public, anon;
grant execute on function public.auth_branch_id(), public.auth_is_super(),
  public.auth_can_access_branch(uuid), public.auth_has_perm(text),
  public.auth_has_any_perm(text[]) to authenticated;

-- منع تصعيد الصلاحيات: غير السوبر أدمن لا يغيّر الفرع أو صفة السوبر أدمن
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.auth_is_super() then
    if new.is_super_admin is distinct from old.is_super_admin
       or new.branch_id is distinct from old.branch_id
       or new.id is distinct from old.id then
      raise exception 'NOT_ALLOWED: لا يمكن تغيير الفرع أو صلاحية السوبر أدمن';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- إنشاء البروفايل تلقائياً عند إنشاء مستخدم من السيرفر (Edge Function بمفتاح الخدمة)
-- نقرأ من raw_app_meta_data لأنها لا يستطيع المستخدم تعديلها بنفسه.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := nullif(new.raw_app_meta_data->>'branch_id','')::uuid;
begin
  if v_branch is null then
    return new;  -- لا بروفايل (مثلاً أول سوبر أدمن يُنشأ يدوياً)
  end if;
  insert into public.profiles (id, branch_id, username, full_name)
  values (
    new.id, v_branch,
    lower(split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'full_name', '')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- كتالوج الصلاحيات
-- (شاشات الأقسام نفسها تُمنح عبر user_department_access لأن الأقسام ديناميك)
-- ---------------------------------------------------------------------
insert into public.permissions (key, kind, group_name, label_ar, sort_order) values
  ('screen.cashier',   'screen', 'الشاشات',  'شاشة الكاشير', 10),
  ('screen.pickup',    'screen', 'الشاشات',  'شاشة البيك أب', 20),
  ('screen.customers', 'screen', 'الشاشات',  'شاشة العملاء', 30),
  ('screen.drawer',    'screen', 'الشاشات',  'شاشة الدرج والشفتات', 40),
  ('screen.callcenter','screen', 'الشاشات',  'شاشة الكول سنتر', 50),
  ('screen.admin',     'screen', 'الشاشات',  'لوحة الإدارة', 60),
  ('shift.open',       'action', 'الشفت',    'فتح شفت', 110),
  ('shift.close',      'action', 'الشفت',    'قفل شفت', 120),
  ('drawer.view',      'action', 'الدرج',    'عرض تقرير الدرج', 130),
  ('drawer.movement',  'action', 'الدرج',    'تسجيل حركة درج (دخل/خروج)', 140),
  ('order.create',     'action', 'الأوردر',  'إنشاء أوردر', 210),
  ('order.edit',       'action', 'الأوردر',  'تعديل أوردر', 220),
  ('order.cancel',     'action', 'الأوردر',  'إلغاء أوردر أو صنف', 230),
  ('order.discount',   'action', 'الأوردر',  'تطبيق خصم', 240),
  ('order.deliver',    'action', 'الأوردر',  'تم التسليم (البيك أب)', 250),
  ('order.reprint',    'action', 'الأوردر',  'إعادة طباعة ملصق', 260),
  ('kitchen.prepare',  'action', 'الأقسام',  'بدء التجهيز وخلص (في الأقسام المسموحة)', 310),
  ('donut.control',    'action', 'الأقسام',  'التحكم في دفعات الدونتس (إيقاف/استئناف/خلص)', 320),
  ('customers.view',   'action', 'العملاء',  'عرض العملاء', 410),
  ('customers.manage', 'action', 'العملاء',  'إضافة وتعديل العملاء', 420),
  ('menu.manage',      'action', 'الإدارة',  'إدارة المنيو والأسعار', 510),
  ('settings.manage',  'action', 'الإدارة',  'إدارة الإعدادات (دفع، مناطق، ضريبة، طابعات)', 520),
  ('users.manage',     'action', 'الإدارة',  'إدارة المستخدمين والصلاحيات', 530),
  ('print.manage',     'action', 'الطباعة',  'تشغيل خدمة الطباعة (Print Agent)', 610);


-- =====================================================================
-- File: 20261111000002_menu.sql
-- =====================================================================

-- =====================================================================
-- 002: المنيو الديناميك
-- أقسام ← أصناف ← أحجام ← مجموعات اختيارات (صوصات/توبنج) ← خيارات بإضافة سعر
-- + بنية الدونتس (ميني/عادي ← أحجام بوكس ← قوائم حشوة وتوبنج)
-- =====================================================================

create type public.department_behavior as enum (
  'simple',        -- مشروبات: صنف + حجم + سعر
  'customizable',  -- وافل: صنف + حجم + صوصات وتوبنج بحدود
  'donut_box'      -- دونتس: بوكسات وقطع ومحشي/توبنج
);

-- ---------------------------------------------------------------------
-- الطابعات
-- ---------------------------------------------------------------------
create table public.printers (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete cascade,
  name            text not null,
  connection_type text not null default 'lan' check (connection_type in ('lan','usb','bluetooth')),
  ip_address      text,
  port            int  default 9100,
  paper_width_mm  int,
  paper_height_mm int,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (branch_id, name)
);
create trigger printers_updated_at before update on public.printers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- الأقسام
-- ---------------------------------------------------------------------
create table public.departments (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  name          text not null,
  behavior      public.department_behavior not null default 'simple',
  prints_labels boolean not null default false,
  printer_id    uuid references public.printers(id) on delete set null,
  color         text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, name)
);
create index departments_branch_idx on public.departments (branch_id);
create trigger departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

-- أي الأقسام يرى المستخدم شاشتها
create table public.user_department_access (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  primary key (user_id, department_id)
);

-- ---------------------------------------------------------------------
-- الأصناف والأحجام (وافل / مشروبات)
-- ---------------------------------------------------------------------
create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  name          text not null,
  description   text,
  image_url     text,
  base_price    numeric(10,2) not null default 0 check (base_price >= 0), -- يُستخدم لو الصنف بدون أحجام
  allow_notes   boolean not null default true,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index menu_items_branch_dept_idx on public.menu_items (branch_id, department_id);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

create table public.item_sizes (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  item_id    uuid not null references public.menu_items(id) on delete cascade,
  name       text not null,
  price      numeric(10,2) not null default 0 check (price >= 0),
  is_default boolean not null default false,
  sort_order int not null default 0,
  is_active  boolean not null default true
);
create index item_sizes_item_idx on public.item_sizes (item_id);

-- ---------------------------------------------------------------------
-- مجموعات الاختيارات (قوائم الصوصات / التوبنج) وخياراتها
-- max_select = NULL يعني مفتوح بدون حد أقصى
-- ---------------------------------------------------------------------
create table public.option_groups (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  name        text not null,
  min_select  int not null default 0 check (min_select >= 0),
  max_select  int check (max_select is null or max_select >= min_select),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (branch_id, name)
);

create table public.options (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id) on delete cascade,
  group_id    uuid not null references public.option_groups(id) on delete cascade,
  name        text not null,
  extra_price numeric(10,2) not null default 0 check (extra_price >= 0), -- الإضافة تتحسب تلقائي عند الاختيار
  sort_order  int not null default 0,
  is_active   boolean not null default true
);
create index options_group_idx on public.options (group_id);

-- ربط المجموعات بالأصناف مع إمكانية تعديل الحدود لكل صنف
create table public.item_option_groups (
  item_id         uuid not null references public.menu_items(id) on delete cascade,
  group_id        uuid not null references public.option_groups(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  override_limits boolean not null default false,
  min_select      int not null default 0 check (min_select >= 0),
  max_select      int check (max_select is null or max_select >= min_select),
  sort_order      int not null default 0,
  primary key (item_id, group_id)
);

-- ---------------------------------------------------------------------
-- الدونتس: نوع (ميني/عادي) ← أحجام البوكس ← قوائم الحشوة والتوبنج
-- ---------------------------------------------------------------------
create type public.piece_role as enum ('filling', 'topping');

create table public.donut_types (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  unique (branch_id, name)
);

create table public.donut_box_sizes (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  pieces        int not null check (pieces > 0),
  regular_price numeric(10,2) not null default 0 check (regular_price >= 0),
  mini_price    numeric(10,2) not null default 0 check (mini_price >= 0),
  stuffed_price numeric(10,2) not null default 0 check (stuffed_price >= 0),
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  unique (branch_id, pieces)
);


-- =====================================================================
-- File: 20261111000003_commerce.sql
-- =====================================================================

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


-- =====================================================================
-- File: 20261111000004_shifts.sql
-- =====================================================================

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


-- =====================================================================
-- File: 20261111000005_orders.sql
-- =====================================================================

-- =====================================================================
-- 005: الأوردرات
-- كل القيم (الأسماء والأسعار) تُخزَّن كـ Snapshot وقت الطلب، فتعديل المنيو
-- لاحقاً لا يغيّر الأوردرات القديمة.
-- =====================================================================

create type public.order_type   as enum ('dine_in', 'takeaway', 'delivery', 'pickup');
create type public.order_status as enum ('active', 'delivered', 'cancelled');
create type public.item_status  as enum ('pending', 'preparing', 'ready', 'cancelled');
create type public.piece_kind   as enum ('stuffed', 'topping_only');   -- محشي / توبنج بس
create type public.batch_status as enum ('open', 'locked', 'done');

-- ---------------------------------------------------------------------
-- دفعات الدونتس + حالة الاستلام (إيقاف/استئناف)
-- ---------------------------------------------------------------------
create table public.donut_batches (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id) on delete cascade,
  status     public.batch_status not null default 'open',
  created_at timestamptz not null default now(),
  locked_at  timestamptz,
  done_at    timestamptz,
  done_by    uuid references public.profiles(id) on delete set null
);
-- دفعة مفتوحة واحدة فقط لكل فرع
create unique index donut_batches_one_open on public.donut_batches (branch_id) where status = 'open';
create index donut_batches_branch_idx on public.donut_batches (branch_id, status);

create table public.donut_station (
  branch_id  uuid primary key references public.branches(id) on delete cascade,
  receiving  boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.branches_create_donut_station()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.donut_station (branch_id) values (new.id);
  return new;
end $$;
create trigger branches_create_donut_station after insert on public.branches
  for each row execute function public.branches_create_donut_station();

-- ---------------------------------------------------------------------
-- الأوردر
-- ---------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  shift_id         uuid references public.shifts(id),           -- يُملأ تلقائياً
  order_number     int,                                          -- يُملأ تلقائياً (يبدأ من 1 في كل شفت)
  order_type       public.order_type not null,
  status           public.order_status not null default 'active',

  customer_id      uuid references public.customers(id) on delete set null,
  customer_name    text,
  customer_phone   text,
  address_snapshot jsonb,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_zone_name text,
  delivery_fee     numeric(10,2) not null default 0 check (delivery_fee >= 0),

  subtotal         numeric(12,2) not null default 0,
  discount_type    public.discount_type,
  discount_value   numeric(10,2) not null default 0 check (discount_value >= 0),
  discount_amount  numeric(12,2) not null default 0,
  tax_rate         numeric(5,2)  not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,

  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  delivered_by     uuid references public.profiles(id) on delete set null,
  cancelled_at     timestamptz,
  cancelled_by     uuid references public.profiles(id) on delete set null,
  cancel_reason    text,
  unique (shift_id, order_number)
);
create index orders_branch_created_idx on public.orders (branch_id, created_at desc);
create index orders_branch_status_idx  on public.orders (branch_id, status);
create index orders_customer_idx       on public.orders (customer_id, created_at desc);
create index orders_shift_idx          on public.orders (shift_id);

alter table public.call_events
  add constraint call_events_order_fk foreign key (order_id)
  references public.orders(id) on delete set null;

-- ---------------------------------------------------------------------
-- أصناف الأوردر
-- الدونتس: كل بوكس = سطر مستقل (quantity = 1)
-- ---------------------------------------------------------------------
create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  order_id        uuid not null references public.orders(id) on delete cascade,
  department_id   uuid not null references public.departments(id),
  menu_item_id    uuid references public.menu_items(id) on delete set null,
  size_id         uuid references public.item_sizes(id) on delete set null,
  item_name       text not null,
  size_name       text,
  quantity        int not null default 1 check (quantity > 0),
  unit_price      numeric(10,2) not null default 0 check (unit_price >= 0),
  extras_total    numeric(10,2) not null default 0,   -- يُحسب تلقائياً من الخيارات
  line_total      numeric(12,2) not null default 0,   -- (unit_price + extras_total) * quantity
  notes           text,
  status          public.item_status not null default 'pending',
  preparing_at    timestamptz,
  ready_at        timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  was_modified    boolean not null default false,
  -- الدونتس
  donut_type_id   uuid references public.donut_types(id) on delete set null,
  donut_type_name text,
  box_size_id     uuid references public.donut_box_sizes(id) on delete set null,
  pieces          int check (pieces is null or pieces > 0),
  donut_batch_id  uuid references public.donut_batches(id) on delete set null,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint donut_box_single check (box_size_id is null or quantity = 1)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_dept_status_idx on public.order_items (branch_id, department_id, status);
create index order_items_batch_idx on public.order_items (donut_batch_id);

-- اختيارات الوافل/المشروبات (صوصات، توبنج، ...)
create table public.order_item_options (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  group_id      uuid references public.option_groups(id) on delete set null,
  option_id     uuid references public.options(id) on delete set null,
  group_name    text,
  option_name   text not null,
  extra_price   numeric(10,2) not null default 0 check (extra_price >= 0)
);
create index order_item_options_item_idx on public.order_item_options (order_item_id);

-- قطع الدونتس داخل البوكس
create table public.order_item_pieces (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  piece_no      int not null check (piece_no > 0),
  piece_kind    public.piece_kind not null,
  unique (order_item_id, piece_no)
);

-- صوصات كل قطعة (حشوة / توبنج) — الإضافة تتحسب على القطعة الواحدة
create table public.order_item_piece_options (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  piece_id    uuid not null references public.order_item_pieces(id) on delete cascade,
  role        public.piece_role not null,
  group_id    uuid references public.option_groups(id) on delete set null,
  option_id   uuid references public.options(id) on delete set null,
  option_name text not null,
  extra_price numeric(10,2) not null default 0 check (extra_price >= 0)
);
create index order_item_piece_options_piece_idx on public.order_item_piece_options (piece_id);

-- ---------------------------------------------------------------------
-- الدفع (ممكن يتقسم على أكتر من طريقة)
-- ---------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  order_id          uuid not null references public.orders(id) on delete cascade,
  shift_id          uuid references public.shifts(id),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  method_name       text not null,
  is_cash           boolean not null default false,
  amount            numeric(12,2) not null check (amount > 0),
  reference         text,
  created_by        uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_shift_idx on public.payments (shift_id);

-- ---------------------------------------------------------------------
-- سجل أحداث الأوردر (الأساس لإشعارات الشاشات: إلغاء، تعديل، جاهز...)
-- ---------------------------------------------------------------------
create table public.order_events (
  id            bigint generated always as identity primary key,
  branch_id     uuid not null references public.branches(id),
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  event_type    text not null,
  payload       jsonb not null default '{}'::jsonb,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index order_events_branch_created_idx on public.order_events (branch_id, created_at desc);
create index order_events_order_idx on public.order_events (order_id);

-- ---------------------------------------------------------------------
-- مهام الطباعة (ملصق لكل صنف) — خدمة الطباعة المحلية تسمعها وتطبع
-- ---------------------------------------------------------------------
create type public.print_status as enum ('pending', 'printing', 'printed', 'failed');

create table public.print_jobs (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  printer_id    uuid not null references public.printers(id) on delete cascade,
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  status        public.print_status not null default 'pending',
  payload       jsonb not null,        -- { logo_url, order_number, item_name }
  attempts      int not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  printed_at    timestamptz
);
create index print_jobs_queue_idx on public.print_jobs (printer_id, status, created_at);


-- =====================================================================
-- File: 20261111000006_logic.sql
-- =====================================================================

-- =====================================================================
-- 006: المنطق داخل قاعدة البيانات
-- ترقيم الأوردر، الإجماليات، ملصقات الطباعة، دفعات الدونتس، الشفتات، الإلغاء والتسليم
-- =====================================================================

-- ---------------------------------------------------------------------
-- الأوردر: تجهيز قبل الإدخال (الشفت، الرقم، الضريبة) — الاسم يبدأ بـ a_ ليسبق b_
-- ---------------------------------------------------------------------
create or replace function public.a_orders_prepare()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_shift_id uuid;
  v_settings public.branch_settings;
begin
  select id into v_shift_id from public.shifts
   where branch_id = new.branch_id and status = 'open' for update;
  if v_shift_id is null then
    raise exception 'NO_OPEN_SHIFT: لا يوجد شفت مفتوح';
  end if;

  update public.shifts set last_order_number = last_order_number + 1
   where id = v_shift_id returning last_order_number into new.order_number;
  new.shift_id := v_shift_id;

  select * into v_settings from public.branch_settings where branch_id = new.branch_id;
  new.tax_rate := case when coalesce(v_settings.tax_enabled, false) then v_settings.tax_rate else 0 end;
  new.created_by := coalesce(new.created_by, auth.uid());
  new.status := 'active';
  return new;
end $$;
create trigger a_orders_prepare before insert on public.orders
  for each row execute function public.a_orders_prepare();

-- الإجماليات: خصم ← ضريبة ← توصيل ← إجمالي (الضريبة على (الأصناف − الخصم) فقط)
create or replace function public.b_orders_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.discount_value > 0)
     and (tg_op = 'INSERT' or new.discount_value is distinct from old.discount_value
          or new.discount_type is distinct from old.discount_type)
     and auth.uid() is not null
     and not public.auth_has_perm('order.discount') then
    raise exception 'NOT_ALLOWED: ليس لديك صلاحية تطبيق خصم';
  end if;

  new.discount_amount := least(new.subtotal,
    case new.discount_type
      when 'percent' then round(new.subtotal * least(new.discount_value, 100) / 100, 2)
      when 'amount'  then new.discount_value
      else 0 end);
  new.tax_amount := round((new.subtotal - new.discount_amount) * new.tax_rate / 100, 2);
  new.total := new.subtotal - new.discount_amount + new.tax_amount + new.delivery_fee;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
create trigger b_orders_totals before insert or update on public.orders
  for each row execute function public.b_orders_totals();

-- ---------------------------------------------------------------------
-- أصناف الأوردر: حساب السطر + توقيتات الحالة + تعيين دفعة الدونتس
-- ---------------------------------------------------------------------
create or replace function public.order_items_before()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_behavior public.department_behavior;
  v_receiving boolean;
  v_batch uuid;
begin
  new.line_total := (new.unit_price + new.extras_total) * new.quantity;

  if tg_op = 'INSERT' then
    select behavior into v_behavior from public.departments where id = new.department_id;
    if v_behavior = 'donut_box' then
      select receiving into v_receiving from public.donut_station where branch_id = new.branch_id;
      if coalesce(v_receiving, true) then
        select id into v_batch from public.donut_batches
         where branch_id = new.branch_id and status = 'open';
        if v_batch is null then
          insert into public.donut_batches (branch_id) values (new.branch_id) returning id into v_batch;
        end if;
        new.donut_batch_id := v_batch;
      else
        new.donut_batch_id := null;   -- قايمة انتظار (Pending)
      end if;
    end if;
  else
    new.updated_at := now();
    if new.status is distinct from old.status then
      if new.status = 'preparing' and new.preparing_at is null then new.preparing_at := now(); end if;
      if new.status = 'ready'     then new.ready_at := now(); end if;
      if new.status = 'cancelled' then new.cancelled_at := now(); end if;
    end if;
    if (new.quantity, new.notes, new.unit_price, new.size_id)
       is distinct from (old.quantity, old.notes, old.unit_price, old.size_id) then
      new.was_modified := true;
    end if;
  end if;
  return new;
end $$;
create trigger order_items_before before insert or update on public.order_items
  for each row execute function public.order_items_before();

-- subtotal للأوردر (بدون الأصناف الملغية) — يتجاهل الأوردر الملغي حتى يحتفظ بإجماليه الأصلي
create or replace function public.order_items_refresh_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
begin
  update public.orders o
     set subtotal = coalesce((select sum(line_total) from public.order_items
                               where order_id = v_order and status <> 'cancelled'), 0)
   where o.id = v_order and o.status = 'active';
  return null;
end $$;
-- ملاحظة: لا نستخدم UPDATE OF لأن line_total يتغير داخل تريجر BEFORE ولا يُحسب ضمن قائمة SET
create trigger order_items_refresh_order_i
  after insert on public.order_items
  for each row execute function public.order_items_refresh_order();
create trigger order_items_refresh_order_u
  after update on public.order_items
  for each row
  when (old.line_total is distinct from new.line_total or old.status is distinct from new.status)
  execute function public.order_items_refresh_order();
create trigger order_items_refresh_order_d
  after delete on public.order_items
  for each row execute function public.order_items_refresh_order();

-- إضافات الأصناف تتحسب تلقائي من الخيارات
create or replace function public.refresh_item_extras(p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.order_items
     set extras_total =
         coalesce((select sum(extra_price) from public.order_item_options where order_item_id = p_item), 0)
       + coalesce((select sum(po.extra_price)
                     from public.order_item_piece_options po
                     join public.order_item_pieces p on p.id = po.piece_id
                    where p.order_item_id = p_item), 0)
   where id = p_item;
end $$;

create or replace function public.item_options_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_item_extras(case when tg_op = 'DELETE' then old.order_item_id else new.order_item_id end);
  return null;
end $$;
create trigger item_options_after after insert or update or delete on public.order_item_options
  for each row execute function public.item_options_after();

create or replace function public.piece_options_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_piece uuid := case when tg_op = 'DELETE' then old.piece_id else new.piece_id end;
  v_item uuid;
begin
  select order_item_id into v_item from public.order_item_pieces where id = v_piece;
  if v_item is not null then perform public.refresh_item_extras(v_item); end if;
  return null;
end $$;
create trigger piece_options_after after insert or update or delete on public.order_item_piece_options
  for each row execute function public.piece_options_after();

-- ---------------------------------------------------------------------
-- الأحداث + ملصقات الطباعة
-- ---------------------------------------------------------------------
create or replace function public.order_items_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dept public.departments;
  v_number int;
  v_logo text;
  i int;
begin
  select * into v_dept from public.departments where id = new.department_id;
  select order_number into v_number from public.orders where id = new.order_id;

  insert into public.order_events (branch_id, order_id, order_item_id, department_id, event_type, payload, created_by)
  values (new.branch_id, new.order_id, new.id, new.department_id, 'item_created',
          jsonb_build_object('item_name', new.item_name, 'order_number', v_number), auth.uid());

  -- ملصق لكل صنف (بعدد الكمية) على طابعة القسم
  if v_dept.prints_labels and v_dept.printer_id is not null then
    select logo_url into v_logo from public.branch_settings where branch_id = new.branch_id;
    for i in 1..new.quantity loop
      insert into public.print_jobs (branch_id, printer_id, order_id, order_item_id, department_id, payload)
      values (new.branch_id, v_dept.printer_id, new.order_id, new.id, new.department_id,
              jsonb_build_object('logo_url', v_logo, 'order_number', v_number,
                                 'item_name', new.item_name || coalesce(' - ' || new.size_name, '')));
    end loop;
  end if;
  return null;
end $$;
create trigger order_items_after_insert after insert on public.order_items
  for each row execute function public.order_items_after_insert();

create or replace function public.order_items_after_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event text;
begin
  if new.status is distinct from old.status then
    v_event := case new.status
      when 'preparing' then 'item_preparing'
      when 'ready'     then 'item_ready'
      when 'cancelled' then 'item_cancelled'
      else 'item_status' end;
    insert into public.order_events (branch_id, order_id, order_item_id, department_id, event_type, payload, created_by)
    values (new.branch_id, new.order_id, new.id, new.department_id, v_event,
            jsonb_build_object('item_name', new.item_name, 'reason', new.cancel_reason), auth.uid());
  elsif new.was_modified and not old.was_modified then
    insert into public.order_events (branch_id, order_id, order_item_id, department_id, event_type, payload, created_by)
    values (new.branch_id, new.order_id, new.id, new.department_id, 'item_modified',
            jsonb_build_object('item_name', new.item_name), auth.uid());
  end if;
  return null;
end $$;
create trigger order_items_after_update after update on public.order_items
  for each row execute function public.order_items_after_update();

-- ---------------------------------------------------------------------
-- تحقق داخلي: عن طريق الصلاحيات + القسم
-- ---------------------------------------------------------------------
create or replace function public._can_work_dept(p_dept uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.auth_is_super() or (
    public.auth_has_perm('kitchen.prepare') and exists (
      select 1 from public.user_department_access
       where user_id = auth.uid() and department_id = p_dept))
$$;

-- ---------------------------------------------------------------------
-- RPC: الشفتات
-- ---------------------------------------------------------------------
create or replace function public.open_shift(p_opening_cash numeric default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.auth_has_perm('shift.open') then raise exception 'NOT_ALLOWED: فتح الشفت'; end if;
  insert into public.shifts (branch_id, opened_by, opening_cash)
  values (public.auth_branch_id(), auth.uid(), coalesce(p_opening_cash, 0))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'SHIFT_ALREADY_OPEN: يوجد شفت مفتوح بالفعل';
end $$;

create or replace function public.close_shift(p_counted_cash numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_shift public.shifts;
  v_cash_in numeric; v_mov_in numeric; v_mov_out numeric; v_expected numeric;
begin
  if not public.auth_has_perm('shift.close') then raise exception 'NOT_ALLOWED: قفل الشفت'; end if;
  select * into v_shift from public.shifts
   where branch_id = public.auth_branch_id() and status = 'open' for update;
  if not found then raise exception 'NO_OPEN_SHIFT: لا يوجد شفت مفتوح'; end if;

  if exists (select 1 from public.orders where shift_id = v_shift.id and status = 'active') then
    raise exception 'ACTIVE_ORDERS_EXIST: يوجد أوردرات شغالة لم تُسلّم بعد';
  end if;

  select coalesce(sum(p.amount),0) into v_cash_in
    from public.payments p
    join public.orders o on o.id = p.order_id and o.status <> 'cancelled'
   where p.shift_id = v_shift.id and p.is_cash;
  select coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
    into v_mov_in, v_mov_out from public.cash_movements where shift_id = v_shift.id;

  v_expected := v_shift.opening_cash + v_cash_in + v_mov_in - v_mov_out;

  update public.shifts
     set status = 'closed', closed_by = auth.uid(), closed_at = now(),
         counted_cash = p_counted_cash, expected_cash = v_expected,
         cash_difference = p_counted_cash - v_expected, close_notes = p_notes
   where id = v_shift.id;
  return v_shift.id;
end $$;

-- تقرير الدرج لشفت
create or replace function public.drawer_report(p_shift uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_shift public.shifts; v_result jsonb;
begin
  select * into v_shift from public.shifts where id = p_shift;
  if not found or not public.auth_can_access_branch(v_shift.branch_id)
     or not public.auth_has_perm('drawer.view') then
    raise exception 'NOT_ALLOWED: تقرير الدرج';
  end if;
  select jsonb_build_object(
    'shift_id', v_shift.id,
    'status', v_shift.status,
    'opening_cash', v_shift.opening_cash,
    'payments_by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', t.method_name, 'is_cash', t.is_cash, 'total', t.total))
        from (select p.method_name, p.is_cash, sum(p.amount) as total
                from public.payments p join public.orders o on o.id = p.order_id and o.status <> 'cancelled'
               where p.shift_id = p_shift group by p.method_name, p.is_cash) t), '[]'::jsonb),
    'movements_in',  coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'in'), 0),
    'movements_out', coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'out'), 0),
    'orders_count', (select count(*) from public.orders where shift_id = p_shift and status <> 'cancelled'),
    'expected_cash', v_shift.expected_cash,
    'counted_cash', v_shift.counted_cash,
    'cash_difference', v_shift.cash_difference
  ) into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- RPC: الأوردرات (إلغاء، تسليم) والأصناف (تجهيز، خلص، إلغاء)
-- ---------------------------------------------------------------------
create or replace function public.cancel_order(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  if not public.auth_has_perm('order.cancel') then raise exception 'NOT_ALLOWED: إلغاء الأوردر'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or not public.auth_can_access_branch(v_order.branch_id) then
    raise exception 'NOT_FOUND: الأوردر غير موجود';
  end if;
  if v_order.status <> 'active' then raise exception 'INVALID_STATE: الأوردر ليس شغالاً'; end if;

  update public.orders set status = 'cancelled', cancelled_at = now(),
         cancelled_by = auth.uid(), cancel_reason = p_reason where id = p_order;
  update public.order_items set status = 'cancelled', cancel_reason = p_reason
   where order_id = p_order and status <> 'cancelled';
  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'order_cancelled',
          jsonb_build_object('order_number', v_order.order_number, 'reason', p_reason), auth.uid());
end $$;

create or replace function public.cancel_order_item(p_item uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.order_items;
begin
  if not public.auth_has_perm('order.cancel') then raise exception 'NOT_ALLOWED: إلغاء الصنف'; end if;
  select * into v_item from public.order_items where id = p_item for update;
  if not found or not public.auth_can_access_branch(v_item.branch_id) then
    raise exception 'NOT_FOUND: الصنف غير موجود';
  end if;
  update public.order_items set status = 'cancelled', cancel_reason = p_reason
   where id = p_item and status <> 'cancelled';
end $$;

create or replace function public.start_item(p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.order_items;
begin
  select * into v_item from public.order_items where id = p_item for update;
  if not found or not public.auth_can_access_branch(v_item.branch_id)
     or not public._can_work_dept(v_item.department_id) then
    raise exception 'NOT_ALLOWED: بدء التجهيز';
  end if;
  update public.order_items set status = 'preparing' where id = p_item and status = 'pending';
end $$;

create or replace function public.finish_item(p_item uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.order_items;
begin
  select * into v_item from public.order_items where id = p_item for update;
  if not found or not public.auth_can_access_branch(v_item.branch_id)
     or not public._can_work_dept(v_item.department_id) then
    raise exception 'NOT_ALLOWED: خلص';
  end if;
  update public.order_items set status = 'ready' where id = p_item and status in ('pending','preparing');
end $$;

-- تم التسليم: كل الأصناف (غير الملغية) لازم تكون جاهزة
create or replace function public.deliver_order(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  if not public.auth_has_perm('order.deliver') then raise exception 'NOT_ALLOWED: تم التسليم'; end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or not public.auth_can_access_branch(v_order.branch_id) then
    raise exception 'NOT_FOUND: الأوردر غير موجود';
  end if;
  if v_order.status <> 'active' then raise exception 'INVALID_STATE: الأوردر ليس شغالاً'; end if;
  if exists (select 1 from public.order_items where order_id = p_order and status not in ('ready','cancelled')) then
    raise exception 'ITEMS_NOT_READY: يوجد أصناف لم تجهز بعد';
  end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = auth.uid()
   where id = p_order;
  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'order_delivered',
          jsonb_build_object('order_number', v_order.order_number), auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- RPC: شاشة الدونتس (إيقاف الاستلام / استئنافه / خلص الدفعة)
-- ---------------------------------------------------------------------
create or replace function public.donut_stop_receiving()
returns void language plpgsql security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id();
begin
  if not public.auth_has_perm('donut.control') then raise exception 'NOT_ALLOWED: التحكم في الدونتس'; end if;
  update public.donut_station set receiving = false, updated_at = now(), updated_by = auth.uid()
   where branch_id = v_branch;
  -- قفل الدفعة المفتوحة وبدء تجهيز أصنافها
  update public.order_items set status = 'preparing'
   where status = 'pending' and donut_batch_id in
     (select id from public.donut_batches where branch_id = v_branch and status = 'open');
  update public.donut_batches set status = 'locked', locked_at = now()
   where branch_id = v_branch and status = 'open';
end $$;

create or replace function public.donut_resume_receiving()
returns void language plpgsql security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id(); v_batch uuid;
begin
  if not public.auth_has_perm('donut.control') then raise exception 'NOT_ALLOWED: التحكم في الدونتس'; end if;
  update public.donut_station set receiving = true, updated_at = now(), updated_by = auth.uid()
   where branch_id = v_branch;

  if exists (select 1 from public.order_items oi
              join public.departments d on d.id = oi.department_id and d.behavior = 'donut_box'
             where oi.branch_id = v_branch and oi.donut_batch_id is null and oi.status = 'pending') then
    select id into v_batch from public.donut_batches where branch_id = v_branch and status = 'open';
    if v_batch is null then
      insert into public.donut_batches (branch_id) values (v_branch) returning id into v_batch;
    end if;
    update public.order_items oi set donut_batch_id = v_batch
      from public.departments d
     where d.id = oi.department_id and d.behavior = 'donut_box'
       and oi.branch_id = v_branch and oi.donut_batch_id is null and oi.status = 'pending';
  end if;
end $$;

create or replace function public.donut_finish_batch(p_batch uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_batch public.donut_batches;
begin
  if not public.auth_has_perm('donut.control') then raise exception 'NOT_ALLOWED: التحكم في الدونتس'; end if;
  select * into v_batch from public.donut_batches where id = p_batch for update;
  if not found or not public.auth_can_access_branch(v_batch.branch_id) then
    raise exception 'NOT_FOUND: الدفعة غير موجودة';
  end if;
  if v_batch.status = 'done' then raise exception 'INVALID_STATE: الدفعة منتهية'; end if;

  update public.order_items set status = 'ready'
   where donut_batch_id = p_batch and status in ('pending','preparing');
  update public.donut_batches
     set status = 'done', done_at = now(), done_by = auth.uid(),
         locked_at = coalesce(locked_at, now())
   where id = p_batch;
end $$;

-- ---------------------------------------------------------------------
-- صلاحيات التنفيذ: للمستخدمين المسجلين فقط
-- ---------------------------------------------------------------------
revoke execute on function
  public.open_shift(numeric), public.close_shift(numeric, text), public.drawer_report(uuid),
  public.cancel_order(uuid, text), public.cancel_order_item(uuid, text),
  public.start_item(uuid), public.finish_item(uuid), public.deliver_order(uuid),
  public.donut_stop_receiving(), public.donut_resume_receiving(), public.donut_finish_batch(uuid),
  public._can_work_dept(uuid), public.refresh_item_extras(uuid)
  from public, anon;
grant execute on function
  public.open_shift(numeric), public.close_shift(numeric, text), public.drawer_report(uuid),
  public.cancel_order(uuid, text), public.cancel_order_item(uuid, text),
  public.start_item(uuid), public.finish_item(uuid), public.deliver_order(uuid),
  public.donut_stop_receiving(), public.donut_resume_receiving(), public.donut_finish_batch(uuid)
  to authenticated;


-- =====================================================================
-- File: 20261111000007_rls_realtime.sql
-- =====================================================================

-- =====================================================================
-- 007: سياسات الأمان (RLS) + Realtime
-- القاعدة: كل مستخدم يرى بيانات فرعه فقط، والتعديل حسب الصلاحية.
-- العمليات الحساسة (شفت، إلغاء، تسليم، دفعات الدونتس) تتم عبر RPC فقط.
-- =====================================================================

-- دالة مساعدة مؤقتة لتطبيق السياسات على الجداول المرتبطة بفرع
create or replace function public._rls_branch_table(
  t text, write_perms text[], select_perms text[] default null, allow_delete boolean default true)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security', t);

  if select_perms is null then
    execute format($f$create policy %I on public.%I for select to authenticated
      using (public.auth_can_access_branch(branch_id))$f$, t||'_select', t);
  else
    execute format($f$create policy %I on public.%I for select to authenticated
      using (public.auth_can_access_branch(branch_id) and public.auth_has_any_perm(%L))$f$,
      t||'_select', t, select_perms);
  end if;

  if write_perms is not null then
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check (public.auth_can_access_branch(branch_id) and public.auth_has_any_perm(%L))$f$,
      t||'_insert', t, write_perms);
    execute format($f$create policy %I on public.%I for update to authenticated
      using (public.auth_can_access_branch(branch_id) and public.auth_has_any_perm(%L))
      with check (public.auth_can_access_branch(branch_id))$f$,
      t||'_update', t, write_perms);
    if allow_delete then
      execute format($f$create policy %I on public.%I for delete to authenticated
        using (public.auth_can_access_branch(branch_id) and public.auth_has_any_perm(%L))$f$,
        t||'_delete', t, write_perms);
    end if;
  end if;
end $$;

-- ---------------- المنيو (إدارة المنيو) ----------------
select public._rls_branch_table(t, array['menu.manage'])
from unnest(array['departments','menu_items','item_sizes','option_groups','options',
                  'item_option_groups','donut_types','donut_box_sizes']) as t;

-- ---------------- الإعدادات ----------------
select public._rls_branch_table(t, array['settings.manage'])
from unnest(array['printers','payment_methods','delivery_zones','discounts','call_center_devices']) as t;

-- ---------------- العمليات (أوردرات) ----------------
select public._rls_branch_table('orders',      array['order.create','order.edit'], null, false);
select public._rls_branch_table('order_items', array['order.create','order.edit']);
select public._rls_branch_table('order_item_options',       array['order.create','order.edit']);
select public._rls_branch_table('order_item_pieces',        array['order.create','order.edit']);
select public._rls_branch_table('order_item_piece_options', array['order.create','order.edit']);
select public._rls_branch_table('payments', array['order.create','order.edit'], null, false);

-- للقراءة فقط (الكتابة عبر RPC/Triggers)
select public._rls_branch_table('shifts',         null);
select public._rls_branch_table('donut_batches',  null);
select public._rls_branch_table('donut_station',  null);
select public._rls_branch_table('order_events',   null);
select public._rls_branch_table('call_events',    array['order.create','screen.callcenter'], null, false);

-- حركات الدرج
select public._rls_branch_table('cash_movements', null, array['drawer.view','drawer.movement']);
create policy cash_movements_insert on public.cash_movements for insert to authenticated
  with check (
    public.auth_can_access_branch(branch_id)
    and public.auth_has_perm('drawer.movement')
    and exists (select 1 from public.shifts s where s.id = shift_id and s.branch_id = branch_id and s.status = 'open'));

-- مهام الطباعة: الخدمة المحلية (print.manage) تقرأ وتحدّث، ومن يملك إعادة الطباعة ينشئ مهام
select public._rls_branch_table('print_jobs', array['print.manage','order.reprint'], null, false);

-- ---------------- الفروع والإعدادات ----------------
alter table public.branches enable row level security;
create policy branches_select on public.branches for select to authenticated
  using (public.auth_can_access_branch(id));
create policy branches_write on public.branches for all to authenticated
  using (public.auth_is_super()) with check (public.auth_is_super());

alter table public.branch_settings enable row level security;
create policy branch_settings_select on public.branch_settings for select to authenticated
  using (public.auth_can_access_branch(branch_id));
create policy branch_settings_update on public.branch_settings for update to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('settings.manage'))
  with check (public.auth_can_access_branch(branch_id));

-- ---------------- المستخدمون والصلاحيات ----------------
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_can_access_branch(branch_id));
create policy profiles_update on public.profiles for update to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('users.manage'))
  with check (public.auth_can_access_branch(branch_id));
-- لا يوجد insert/delete: الإنشاء عبر السيرفر (Edge Function) بمفتاح الخدمة

alter table public.permissions enable row level security;
create policy permissions_select on public.permissions for select to authenticated using (true);

alter table public.user_permissions enable row level security;
create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));
-- المدير يمنح فقط صلاحيات يملكها هو (لمنع تصعيد الصلاحيات)
create policy user_permissions_insert on public.user_permissions for insert to authenticated
  with check (public.auth_has_perm('users.manage') and public.auth_has_perm(permission_key)
    and exists (select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));
create policy user_permissions_delete on public.user_permissions for delete to authenticated
  using (public.auth_has_perm('users.manage')
    and exists (select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));

alter table public.user_department_access enable row level security;
create policy uda_select on public.user_department_access for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));
create policy uda_insert on public.user_department_access for insert to authenticated
  with check (public.auth_has_perm('users.manage')
    and exists (select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));
create policy uda_delete on public.user_department_access for delete to authenticated
  using (public.auth_has_perm('users.manage')
    and exists (select 1 from public.profiles p where p.id = user_id and public.auth_can_access_branch(p.branch_id)));

-- ---------------- العملاء (مشتركون بين الفروع) ----------------
alter table public.customers enable row level security;
create policy customers_select on public.customers for select to authenticated
  using (public.auth_has_any_perm(array['customers.view','customers.manage','order.create','screen.callcenter']));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.auth_has_any_perm(array['customers.manage','order.create','screen.callcenter']));
create policy customers_update on public.customers for update to authenticated
  using (public.auth_has_any_perm(array['customers.manage','order.create']))
  with check (true);

alter table public.customer_addresses enable row level security;
create policy customer_addresses_select on public.customer_addresses for select to authenticated
  using (public.auth_has_any_perm(array['customers.view','customers.manage','order.create','screen.callcenter']));
create policy customer_addresses_write on public.customer_addresses for all to authenticated
  using (public.auth_has_any_perm(array['customers.manage','order.create']))
  with check (public.auth_has_any_perm(array['customers.manage','order.create']));

drop function public._rls_branch_table(text, text[], text[], boolean);

-- ---------------------------------------------------------------------
-- Realtime: الشاشات تستقبل التحديثات لحظياً
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['orders','order_items','order_events','print_jobs',
                             'donut_batches','donut_station','call_events','shifts'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;


-- =====================================================================
-- File: seed.sql
-- =====================================================================

-- =====================================================================
-- بيانات أولية: فرع + أقسام + طرق دفع + أنواع الدونتس وأحجام البوكس
-- كل ده قابل للتعديل من لوحة الإدارة. غيّر اسم الفرع حسب مشروعك.
-- =====================================================================

do $$
declare
  v_branch uuid;
  v_type uuid;
  v_pieces int;
  v_i int := 0;
  v_t text;
begin
  insert into public.branches (name, code) values ('الفرع الرئيسي', 'MAIN')
  returning id into v_branch;

  insert into public.departments (branch_id, name, behavior, prints_labels, sort_order) values
    (v_branch, 'وافل',     'customizable', true,  1),
    (v_branch, 'مشروبات',  'simple',       true,  2),
    (v_branch, 'دونتس',    'donut_box',    false, 3);

  insert into public.payment_methods (branch_id, name, is_cash, sort_order) values
    (v_branch, 'نقدي',        true,  1),
    (v_branch, 'فيزا',        false, 2),
    (v_branch, 'إنستاباي',    false, 3),
    (v_branch, 'فودافون كاش', false, 4);

  foreach v_t in array array['عادي', 'ميني', 'حشو'] loop
    v_i := v_i + 1;
    insert into public.donut_types (branch_id, name, sort_order) values (v_branch, v_t, v_i);
  end loop;
end $$;


