-- =====================================================================
-- 20261126000008: إصلاح الصلاحيات — أقل صلاحية لكل مستخدم
-- =====================================================================
-- المشكلة (موثقة في المايجريشنز السابقة نفسها):
--  * 20261123000002: دالة handle_new_user كانت تمنح كل مستخدم جديد
--    is_super_admin=true وكل الصلاحيات تلقائياً عند إنشاء حسابه.
--  * 20261123000004: سياسات allow-all على profiles و user_permissions و
--    user_department_access تجعل أي مستخدم مسجّل قادراً على منح نفسه
--    أي صلاحية مباشرة عبر PostgREST (تصعيد صلاحيات كامل).
--
-- الإصلاح:
--  1) إسقاط سياسات allow-all الثلاث. السياسات الأصلية من 20261111000007
--     (وإضافات 20261123000003 المقيدة بـ users.manage) تعود للعمل تلقائياً
--     لأن سياسات Postgres permissive.
--  2) استبدال handle_new_user: إنشاء البروفايل فقط، بلا أي صلاحيات إطلاقاً.
--     لا يوجد أي مسار تلقائي للأدمن: أي تسجيل جديد — أولاً كان أو غيره —
--     يحصل على حساب بلا صلاحيات حتى يمنحه مدير قائم صلاحياته صراحة
--     (create-user edge function أو save_user_permissions وكلاهما يفرض
--     users.manage على المنفذ).
--
-- إعداد أول مدير على نشر جديد (خطوة يدوية موثوقة وليست تلقائية):
--  بعد إنشاء أول حساب من لوحة Supabase (Auth > Users)، شغّل الملف
--  supabase/manual-first-admin.sql من SQL Editor مع بريد الحساب —
--  يتطلب وصول service/dashboard أي طرف موثوق، ولا يمكن لأي مسجل عادي
--  ترقية نفسه لأن RLS تمنع الكتابة المباشرة في user_permissions.
--
-- هذا الإصلاح لا يمس صلاحيات الحسابات الموجودة حالياً (لا revoke جماعي)؛
-- مراجعة أدوار الحسابات القائمة قرار منفصل بمعرفة المالك.

-- 1) إسقاط سياسات allow-all
drop policy if exists profiles_allow_all on public.profiles;
drop policy if exists user_permissions_allow_all on public.user_permissions;
drop policy if exists user_dept_allow_all on public.user_department_access;

-- 2) handle_new_user: بروفايل فقط، صفر صلاحيات
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
      false,
      true
    ) on conflict (id) do update set is_active = true;
  end if;

  return new;
end $$;
