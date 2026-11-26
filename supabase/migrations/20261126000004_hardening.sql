-- =====================================================================
-- 20261126000004: تشديدات — مفتاح منع تكرار الأوردر + طابعة الإيصالات
-- =====================================================================

-- طابعة الإيصالات المعينة للفرع (منفصلة عن طابعات ملصقات الأقسام)
alter table public.branch_settings
  add column if not exists receipt_printer_id uuid references public.printers(id) on delete set null;

-- ---------------------------------------------------------------------
-- إعادة طباعة إيصال العميل (الفاتورة) — تختلف عن ملصقات المطبخ:
-- تنشئ مهمة طباعة واحدة بكامل بيانات الأوردر على طابعة الإيصالات المعينة
-- ---------------------------------------------------------------------
create or replace function public.reprint_receipt(p_order uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_printer uuid;
  v_payload jsonb;
begin
  if not public.auth_has_perm('order.reprint') then
    raise exception 'NOT_ALLOWED: إعادة طباعة الإيصال';
  end if;
  select * into v_order from public.orders where id = p_order;
  if not found or not public.auth_can_access_branch(v_order.branch_id) then
    raise exception 'NOT_FOUND: الأوردر غير موجود';
  end if;

  select receipt_printer_id into v_printer
    from public.branch_settings where branch_id = v_order.branch_id;
  if v_printer is null then
    raise exception 'NO_RECEIPT_PRINTER: لم يتم تحديد طابعة إيصالات للفرع من الإعدادات';
  end if;

  v_payload := jsonb_build_object(
    'type', 'receipt',
    'order_number', v_order.order_number,
    'created_at', v_order.created_at,
    'order_type', v_order.order_type,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.item_name,
        'size', oi.size_name,
        'qty', oi.quantity,
        'unit_price', oi.unit_price,
        'extras', oi.extras_total,
        'line_total', oi.line_total
      ) order by oi.sort_order, oi.created_at)
      from public.order_items oi
      where oi.order_id = p_order and oi.status <> 'cancelled'), '[]'::jsonb),
    'subtotal', v_order.subtotal,
    'discount', v_order.discount_amount,
    'tax', v_order.tax_amount,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('method', p.method_name, 'amount', p.amount))
      from public.payments p where p.order_id = p_order), '[]'::jsonb)
  );

  insert into public.print_jobs (branch_id, printer_id, order_id, payload)
  values (v_order.branch_id, v_printer, p_order, v_payload);

  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'receipt_reprinted',
          jsonb_build_object('order_number', v_order.order_number), auth.uid());

  return jsonb_build_object('id', p_order, 'receipt_created', true);
end $$;

revoke execute on function public.reprint_receipt(uuid) from public, anon;
grant execute on function public.reprint_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- حساب الباقي للعميل في الدرج: النقدية الداخلة = المدفوع كاش - الباقي المردود
-- (إعادة تعريف دوال الريبو الأصلية بأقل تعديل ممكن)
-- ---------------------------------------------------------------------
create or replace function public.close_shift(p_counted_cash numeric, p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_shift public.shifts;
  v_cash_in numeric; v_change numeric; v_mov_in numeric; v_mov_out numeric; v_expected numeric;
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
  select coalesce(sum(o.change_amount),0) into v_change
    from public.orders o
   where o.shift_id = v_shift.id and o.status <> 'cancelled';
  select coalesce(sum(amount) filter (where direction = 'in'), 0),
         coalesce(sum(amount) filter (where direction = 'out'), 0)
    into v_mov_in, v_mov_out from public.cash_movements where shift_id = v_shift.id;

  v_expected := v_shift.opening_cash + (v_cash_in - v_change) + v_mov_in - v_mov_out;

  update public.shifts
     set status = 'closed', closed_by = auth.uid(), closed_at = now(),
         counted_cash = p_counted_cash, expected_cash = v_expected,
         cash_difference = p_counted_cash - v_expected, close_notes = p_notes
   where id = v_shift.id;
  return v_shift.id;
end $$;

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
    'cash_change', coalesce((select sum(o.change_amount) from public.orders o
               where o.shift_id = p_shift and o.status <> 'cancelled'), 0),
    'net_cash', coalesce((select sum(p.amount) from public.payments p
               join public.orders o on o.id = p.order_id and o.status <> 'cancelled'
               where p.shift_id = p_shift and p.is_cash), 0)
              - coalesce((select sum(o.change_amount) from public.orders o
               where o.shift_id = p_shift and o.status <> 'cancelled'), 0),
    'movements_in',  coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'in'), 0),
    'movements_out', coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'out'), 0),
    'orders_count', (select count(*) from public.orders where shift_id = p_shift and status <> 'cancelled'),
    'expected_cash', v_shift.expected_cash,
    'counted_cash', v_shift.counted_cash,
    'cash_difference', v_shift.cash_difference
  ) into v_result;
  return v_result;
end $$;
