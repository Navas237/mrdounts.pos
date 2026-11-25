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
