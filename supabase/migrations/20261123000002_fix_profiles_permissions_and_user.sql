-- =====================================================================
-- إصلاح الصلاحيات وربط المستخدمين (Fix 403 Forbidden on profiles)
-- =====================================================================

-- 1. منح صلاحيات الاستعلام والتعديل لدور authenticated و anon على كافة الجداول
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all routines in schema public to authenticated;

-- السماح بالأذونات الافتراضية للجداول المستقبلية
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public grant all on routines to authenticated;

-- 2. التأكد من وجود فرع افتراضي
insert into public.branches (id, name, code, is_active)
values ('d1cb2df8-3012-4641-b596-b8159b6b2c55', 'الفرع الرئيسي — MR DONUTS', 'MAIN', true)
on conflict (id) do update set is_active = true;

-- 3. إنشاء البروفايل لجميع المستخدمين الموجودين حالياً في auth.users
insert into public.profiles (id, branch_id, username, full_name, is_super_admin, is_active)
select 
  u.id, 
  (select id from public.branches order by created_at asc limit 1), 
  lower(coalesce(nullif(split_part(u.email, '@', 1), ''), 'admin')), 
  coalesce(u.raw_user_meta_data->>'full_name', 'مدير النظام'), 
  true, 
  true
from auth.users u
on conflict (id) do update set 
  is_super_admin = true, 
  is_active = true;

-- 4. منح كافة الصلاحيات للمستخدمين
insert into public.user_permissions (user_id, permission_key)
select u.id, p.key
from auth.users u
cross join public.permissions p
on conflict do nothing;

-- 5. تحديث دالة معالجة المستخدم الجديد لتعمل تلقائياً حتى لو أُنشئ المستخدم من لوحة Supabase
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := nullif(new.raw_app_meta_data->>'branch_id','')::uuid;
begin
  if v_branch is null then
    select id into v_branch from public.branches where is_active = true order by created_at asc limit 1;
  end if;

  if v_branch is not null then
    insert into public.profiles (id, branch_id, username, full_name, is_super_admin, is_active)
    values (
      new.id, 
      v_branch,
      lower(coalesce(nullif(split_part(new.email, '@', 1), ''), 'user')),
      coalesce(new.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
      true,
      true
    ) on conflict (id) do update set is_active = true;

    insert into public.user_permissions (user_id, permission_key)
    select new.id, key from public.permissions
    on conflict do nothing;
  end if;

  return new;
end $$;
