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
