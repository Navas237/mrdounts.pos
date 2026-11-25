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
