-- =====================================================================
-- إعداد أول مدير للنظام — خطوة يدوية لمرة واحدة على نشر جديد
-- =====================================================================
-- شغّل هذا الملف من Supabase SQL Editor (أو بمفتاح الخدمة) بعد إنشاء
-- أول حساب من Auth > Users. عدّل البريد أدناه لبريد الحساب المقصود.
-- لا يمكن تنفيذه من داخل التطبيق ولا بصلاحية مستخدم عادي.

do $$
declare
  v_email text := 'ADMIN@EXAMPLE.COM'; -- <<< عدّل البريد هنا
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'لا يوجد حساب بالبريد %', v_email;
  end if;

  update public.profiles set is_super_admin = true, is_active = true where id = v_user;

  insert into public.user_permissions (user_id, permission_key)
  select v_user, key from public.permissions
  on conflict do nothing;
end $$;
