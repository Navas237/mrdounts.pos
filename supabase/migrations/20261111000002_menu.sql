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
  donut_type_id uuid not null references public.donut_types(id) on delete cascade,
  pieces        int not null check (pieces > 0),
  price         numeric(10,2) not null default 0 check (price >= 0),
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  unique (donut_type_id, pieces)
);

-- أي قوائم صوصات تظهر للحشوة وأيها للتوبنج (الحدود لكل قطعة)
-- قوائم الحشوة تظهر للقطع المحشية فقط، وقوائم التوبنج لكل القطع
create table public.donut_type_groups (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  donut_type_id uuid not null references public.donut_types(id) on delete cascade,
  group_id      uuid not null references public.option_groups(id) on delete cascade,
  role          public.piece_role not null,
  min_select    int not null default 0 check (min_select >= 0),
  max_select    int check (max_select is null or max_select >= min_select),
  sort_order    int not null default 0,
  unique (donut_type_id, group_id, role)
);
