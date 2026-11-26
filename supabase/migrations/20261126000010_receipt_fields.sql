-- إيصال العميل 80mm: list_orders يرجّع عنوان العميل والمنطقة وخيارات الصنف وتفاصيل كل قطعة
-- (حشو/توبنج). نفس الصلاحيات والتقييد بالفرع كما كان؛ إضافة حقول فقط.
create or replace function public.list_orders(
  p_shift_id uuid default null,
  p_status text default null,
  p_limit int default 100,
  p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_any_perm(array['screen.orders','order.edit','order.reprint','order.cancel']) then
    raise exception 'NOT_ALLOWED: عرض الطلبات';
  end if;
  return (
    select coalesce(jsonb_agg(t.order_row order by t.created_at desc), '[]'::jsonb)
    from (
      select
        o.created_at,
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'shift_id', o.shift_id,
          'order_type', o.order_type,
          'status', o.status,
          'customer_name', o.customer_name,
          'customer_phone', o.customer_phone,
          'subtotal', o.subtotal,
          'discount_amount', o.discount_amount,
          'tax_amount', o.tax_amount,
          'delivery_fee', o.delivery_fee,
          'total', o.total,
          'notes', o.notes,
          'address_snapshot', o.address_snapshot,
          'delivery_zone_name', o.delivery_zone_name,
          'cancel_reason', o.cancel_reason,
          'created_at', o.created_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', oi.id,
              'item_name', oi.item_name,
              'size_name', oi.size_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'extras_total', oi.extras_total,
              'line_total', oi.line_total,
              'status', oi.status,
              'notes', oi.notes,
              'pieces', oi.pieces,
              'donut_type_name', oi.donut_type_name,
              'was_modified', oi.was_modified,
              'options', coalesce((
                select jsonb_agg(jsonb_build_object('option_name', oo.option_name))
                  from public.order_item_options oo where oo.order_item_id = oi.id), '[]'::jsonb),
              'piece_details', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'piece_no', pc.piece_no,
                         'kind', pc.piece_kind,
                         'filling', (select po.option_name from public.order_item_piece_options po
                                      where po.piece_id = pc.id and po.role = 'filling' limit 1),
                         'topping', (select po.option_name from public.order_item_piece_options po
                                      where po.piece_id = pc.id and po.role = 'topping' limit 1))
                       order by pc.piece_no)
                  from public.order_item_pieces pc where pc.order_item_id = oi.id), '[]'::jsonb)
            ) order by oi.sort_order, oi.created_at)
            from public.order_items oi where oi.order_id = o.id), '[]'::jsonb),
          'payments', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', p.id,
              'method_name', p.method_name,
              'is_cash', p.is_cash,
              'amount', p.amount,
              'reference', p.reference
            ))
            from public.payments p where p.order_id = o.id), '[]'::jsonb)
        ) as order_row
      from public.orders o
      where o.branch_id = v_branch
        and (p_shift_id is null or o.shift_id = p_shift_id)
        and (p_status is null or o.status::text = p_status)
      order by o.created_at desc
      limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0)
    ) t);
end $$;
