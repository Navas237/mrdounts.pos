-- =====================================================================
-- 003: سياسات ودوال إدارة المستخدمين والصلاحيات
-- =====================================================================

-- 1. تمكين صلاحيات الإضافة والحذف للمستخدمين على جدول profiles
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert'
  ) then
    create policy profiles_insert on public.profiles for insert to authenticated
      with check (public.auth_is_super() or public.auth_has_perm('users.manage'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_delete'
  ) then
    create policy profiles_delete on public.profiles for delete to authenticated
      using (public.auth_is_super() or public.auth_has_perm('users.manage'));
  end if;
end $$;

-- 2. دالة ذرية (Atomic RPC) لتحديث صلاحيات المستخدم وأقسامه دفعة واحدة
create or replace function public.save_user_permissions(
  p_user_id uuid,
  p_permissions text[],
  p_department_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- التحقق من صلاحية المنفذ
  if not (public.auth_is_super() or public.auth_has_perm('users.manage')) then
    raise exception 'NOT_AUTHORIZED: لا تملك صلاحية تعديل صلاحيات المستخدمين';
  end if;

  -- 1. تحديث الصلاحيات التفصيلية
  delete from public.user_permissions where user_id = p_user_id;

  if p_permissions is not null and array_length(p_permissions, 1) > 0 then
    insert into public.user_permissions (user_id, permission_key, granted_by)
    select p_user_id, unnest(p_permissions), auth.uid()
    on conflict do nothing;
  end if;

  -- 2. تحديث صلاحيات الوصول للأقسام
  delete from public.user_department_access where user_id = p_user_id;

  if p_department_ids is not null and array_length(p_department_ids, 1) > 0 then
    insert into public.user_department_access (user_id, department_id)
    select p_user_id, unnest(p_department_ids)
    on conflict do nothing;
  end if;
end $$;

revoke execute on function public.save_user_permissions(uuid, text[], uuid[]) from public, anon;
grant execute on function public.save_user_permissions(uuid, text[], uuid[]) to authenticated;
