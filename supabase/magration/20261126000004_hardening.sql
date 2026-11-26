-- =====================================================================
-- 20261126000004: تشديدات — مفتاح منع تكرار الأوردر + طابعة الإيصالات
-- =====================================================================

-- مفتاح طلب العميل: يمنع بيع مكرر عند إعادة إرسال نفس المحاولة (شبكة/زرار مرتين)
alter table public.orders add column if not exists client_request_id text;
create unique index if not exists orders_client_request_uidx
  on public.orders (branch_id, client_request_id)
  where client_request_id is not null;

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
