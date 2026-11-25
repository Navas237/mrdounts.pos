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
                  'item_option_groups','donut_types','donut_box_sizes','donut_type_groups']) as t;

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
