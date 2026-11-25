-- =====================================================================
-- 004: إزالة قفل السوبر أدمن وتفعيل الصلاحيات الكاملة للأدمن
-- =====================================================================

-- 1. إزالة التريجر المقيد الذي يمنع تحديث is_super_admin
drop trigger if exists profiles_guard on public.profiles;

-- 2. ترقية جميع المستخدمين الحاليين (خاصة حساب admin) ليكونوا سوبر أدمن
update public.profiles 
set is_super_admin = true, is_active = true;

-- 3. منح كافة الصلاحيات الحالية لجميع المستخدمين في user_permissions
insert into public.user_permissions (user_id, permission_key)
select pr.id, perm.key
from public.profiles pr
cross join public.permissions perm
on conflict do nothing;

-- 4. ربط جميع المستخدمين بكافة أقسام المطبخ الحالية
insert into public.user_department_access (user_id, department_id)
select pr.id, dept.id
from public.profiles pr
cross join public.departments dept
on conflict do nothing;

-- 5. فتح صلاحيات RLS لجداول المستخدمين والصلاحيات
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_allow_all') then
    create policy profiles_allow_all on public.profiles for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_permissions' and policyname = 'user_permissions_allow_all') then
    create policy user_permissions_allow_all on public.user_permissions for all to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_department_access' and policyname = 'user_dept_allow_all') then
    create policy user_dept_allow_all on public.user_department_access for all to authenticated using (true) with check (true);
  end if;
end $$;
