-- =====================================================================
-- 009: عمليات نقطة البيع عبر RPC
-- إنشاء الأوردر كاملاً، عرض الطلبات، تعديل طلب، إعادة الطباعة
-- كل الدوال security definer وتتحقق من الصلاحيات مثل باقي دوال النظام
-- =====================================================================

-- ---------------------------------------------------------------------
-- إنشاء أوردر كامل (أصناف + خيارات + قطع دونتس + مدفوعات) في معاملة واحدة
-- ---------------------------------------------------------------------
create or replace function public.create_order_full(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
  v_order_id uuid;
  v_order_number int;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_item jsonb;
  v_opt jsonb;
  v_piece jsonb;
  v_popt jsonb;
  v_pay jsonb;
  v_item_id uuid;
  v_piece_id uuid;
  v_donut_type_id uuid;
  v_box_size_id uuid;
begin
  if v_branch is null or not public.auth_has_perm('order.create') then
    raise exception 'NOT_ALLOWED: إنشاء الأوردر';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'EMPTY_ORDER: الأوردر بدون أصناف';
  end if;

  -- الأوردر الرئيسي (التريجرات تملأ الشفت والرقم والضريبة والإجماليات)
  insert into public.orders (
    branch_id, order_type, customer_name, customer_phone, address_snapshot,
    delivery_zone_id, delivery_zone_name, delivery_fee,
    discount_type, discount_value, notes)
  values (
    v_branch,
    (p_payload->>'order_type')::public.order_type,
    nullif(p_payload->>'customer_name',''),
    nullif(p_payload->>'customer_phone',''),
    nullif(p_payload->'address_snapshot','null'::jsonb),
    nullif(p_payload->>'delivery_zone_id','')::uuid,
    nullif(p_payload->>'delivery_zone_name',''),
    coalesce((p_payload->>'delivery_fee')::numeric, 0),
    nullif(p_payload->>'discount_type','')::public.discount_type,
    coalesce((p_payload->>'discount_value')::numeric, 0),
    nullif(p_payload->>'notes',''))
  returning id into v_order_id;

  -- الأصناف
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    -- حل نوع الدونتس وحجم البوكس بالاسم لو لم تُرسل المعرفات
    v_donut_type_id := nullif(v_item->>'donut_type_id','')::uuid;
    if v_donut_type_id is null and nullif(v_item->>'donut_type_name','') is not null then
      select id into v_donut_type_id from public.donut_types
       where branch_id = v_branch and name = v_item->>'donut_type_name' limit 1;
    end if;
    v_box_size_id := nullif(v_item->>'box_size_id','')::uuid;
    if v_box_size_id is null and v_donut_type_id is not null and nullif(v_item->>'pieces','') is not null then
      select id into v_box_size_id from public.donut_box_sizes
       where branch_id = v_branch and donut_type_id = v_donut_type_id
         and pieces = (v_item->>'pieces')::int limit 1;
    end if;

    insert into public.order_items (
      branch_id, order_id, department_id, menu_item_id, size_id,
      item_name, size_name, quantity, unit_price, notes,
      donut_type_id, donut_type_name, box_size_id, pieces)
    values (
      v_branch, v_order_id,
      (v_item->>'department_id')::uuid,
      nullif(v_item->>'menu_item_id','')::uuid,
      nullif(v_item->>'size_id','')::uuid,
      v_item->>'item_name',
      nullif(v_item->>'size_name',''),
      coalesce((v_item->>'quantity')::int, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      nullif(v_item->>'notes',''),
      v_donut_type_id,
      nullif(v_item->>'donut_type_name',''),
      v_box_size_id,
      nullif(v_item->>'pieces','')::int)
    returning id into v_item_id;

    -- خيارات الصنف (صوصات/إضافات الوافل والمشروبات)
    if jsonb_typeof(v_item->'options') = 'array' then
      for v_opt in select * from jsonb_array_elements(v_item->'options') loop
        insert into public.order_item_options (
          branch_id, order_item_id, group_id, option_id, group_name, option_name, extra_price)
        values (
          v_branch, v_item_id,
          nullif(v_opt->>'group_id','')::uuid,
          nullif(v_opt->>'option_id','')::uuid,
          nullif(v_opt->>'group_name',''),
          v_opt->>'option_name',
          coalesce((v_opt->>'extra_price')::numeric, 0));
      end loop;
    end if;

    -- قطع الدونتس وصوصات كل قطعة
    if jsonb_typeof(v_item->'donut_pieces') = 'array' then
      for v_piece in select * from jsonb_array_elements(v_item->'donut_pieces') loop
        insert into public.order_item_pieces (branch_id, order_item_id, piece_no, piece_kind)
        values (
          v_branch, v_item_id,
          (v_piece->>'piece_no')::int,
          (v_piece->>'piece_kind')::public.piece_kind)
        returning id into v_piece_id;

        if jsonb_typeof(v_piece->'options') = 'array' then
          for v_popt in select * from jsonb_array_elements(v_piece->'options') loop
            insert into public.order_item_piece_options (
              branch_id, piece_id, role, group_id, option_id, option_name, extra_price)
            values (
              v_branch, v_piece_id,
              (v_popt->>'role')::public.piece_role,
              nullif(v_popt->>'group_id','')::uuid,
              nullif(v_popt->>'option_id','')::uuid,
              v_popt->>'option_name',
              coalesce((v_popt->>'extra_price')::numeric, 0));
          end loop;
        end if;
      end loop;
    end if;
  end loop;

  -- الإجمالي النهائي بعد حساب التريجرات
  select total into v_total from public.orders where id = v_order_id;

  -- المدفوعات: مجموعها لازم يغطي الإجمالي (الزيادة = باقي للعميل)
  if jsonb_typeof(p_payload->'payments') = 'array' then
    select coalesce(sum((p->>'amount')::numeric), 0) into v_paid
      from jsonb_array_elements(p_payload->'payments') p;
    if v_paid + 0.01 < v_total then
      raise exception 'PAYMENT_SHORT: المدفوع (%) أقل من إجمالي الأوردر (%)', v_paid, v_total;
    end if;
    for v_pay in select * from jsonb_array_elements(p_payload->'payments') loop
      insert into public.payments (
        branch_id, order_id, shift_id, payment_method_id, method_name, is_cash, amount, reference)
      select
        v_branch, v_order_id, o.shift_id,
        nullif(v_pay->>'payment_method_id','')::uuid,
        v_pay->>'method_name',
        coalesce((v_pay->>'is_cash')::boolean, false),
        (v_pay->>'amount')::numeric,
        nullif(v_pay->>'reference','')
        from public.orders o where o.id = v_order_id;
    end loop;
  else
    raise exception 'NO_PAYMENT: الأوردر بدون دفع';
  end if;

  select order_number into v_order_number from public.orders where id = v_order_id;
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total', v_total, 'paid', v_paid);
end $$;

-- ---------------------------------------------------------------------
-- عرض الطلبات (صفحة الطلبات): مع الأصناف والمدفوعات
-- ---------------------------------------------------------------------
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
              'was_modified', oi.was_modified
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

-- ---------------------------------------------------------------------
-- تعديل طلب شغال: ملاحظات/خصم + إلغاء أصناف لم تبدأ + تغيير كمية ما لم يبدأ
-- + استبدال المدفوعات + إضافة أصناف جديدة
-- ---------------------------------------------------------------------
create or replace function public.edit_order(p_order uuid, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_item_id uuid;
  v_qty int;
  v_change jsonb;
  v_item jsonb;
  v_new_item_id uuid;
  v_pay jsonb;
  v_paid numeric(12,2);
begin
  if not public.auth_has_perm('order.edit') then
    raise exception 'NOT_ALLOWED: تعديل الأوردر';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or not public.auth_can_access_branch(v_order.branch_id) then
    raise exception 'NOT_FOUND: الأوردر غير موجود';
  end if;
  if v_order.status <> 'active' then
    raise exception 'INVALID_STATE: لا يمكن تعديل أوردر مسلّم أو ملغي';
  end if;

  -- ملاحظات وخصم (التريجر يفرض صلاحية الخصم ويعيد حساب الإجماليات)
  update public.orders set
    notes = coalesce(nullif(p_changes->>'notes','__keep__'), notes),
    discount_type = case when p_changes ? 'discount_type'
      then nullif(p_changes->>'discount_type','')::public.discount_type else discount_type end,
    discount_value = case when p_changes ? 'discount_value'
      then coalesce((p_changes->>'discount_value')::numeric, 0) else discount_value end
  where id = p_order;

  -- إلغاء أصناف (المسموح: لم يبدأ تجهيزها)
  if jsonb_typeof(p_changes->'cancel_item_ids') = 'array' then
    for v_change in select * from jsonb_array_elements(p_changes->'cancel_item_ids') loop
      v_item_id := (v_change #>> '{}')::uuid;
      update public.order_items
         set status = 'cancelled', cancel_reason = coalesce(nullif(p_changes->>'cancel_reason',''), 'تعديل الأوردر')
       where id = v_item_id and order_id = p_order and status = 'pending';
      if not found then
        raise exception 'ITEM_NOT_EDITABLE: صنف بدأ تجهيزه أو غير موجود، لا يمكن إلغاؤه';
      end if;
    end loop;
  end if;

  -- تغيير كميات (المسموح: لم يبدأ التجهيز، وليس بوكس دونتس)
  if jsonb_typeof(p_changes->'quantity_changes') = 'array' then
    for v_change in select * from jsonb_array_elements(p_changes->'quantity_changes') loop
      v_item_id := (v_change->>'item_id')::uuid;
      v_qty := (v_change->>'quantity')::int;
      if v_qty is null or v_qty < 1 then
        raise exception 'BAD_QUANTITY: كمية غير صالحة';
      end if;
      update public.order_items
         set quantity = v_qty
       where id = v_item_id and order_id = p_order and status = 'pending' and box_size_id is null;
      if not found then
        raise exception 'ITEM_NOT_EDITABLE: لا يمكن تغيير كمية صنف بدأ تجهيزه أو بوكس دونتس';
      end if;
    end loop;
  end if;

  -- إضافة أصناف جديدة (نفس شكل الإنشاء)
  if jsonb_typeof(p_changes->'add_items') = 'array' then
    for v_item in select * from jsonb_array_elements(p_changes->'add_items') loop
      insert into public.order_items (
        branch_id, order_id, department_id, menu_item_id, size_id,
        item_name, size_name, quantity, unit_price, notes,
        donut_type_id, donut_type_name, box_size_id, pieces)
      values (
        v_order.branch_id, p_order,
        (v_item->>'department_id')::uuid,
        nullif(v_item->>'menu_item_id','')::uuid,
        nullif(v_item->>'size_id','')::uuid,
        v_item->>'item_name',
        nullif(v_item->>'size_name',''),
        coalesce((v_item->>'quantity')::int, 1),
        coalesce((v_item->>'unit_price')::numeric, 0),
        nullif(v_item->>'notes',''),
        nullif(v_item->>'donut_type_id','')::uuid,
        nullif(v_item->>'donut_type_name',''),
        nullif(v_item->>'box_size_id','')::uuid,
        nullif(v_item->>'pieces','')::int)
      returning id into v_new_item_id;
    end loop;
  end if;

  -- استبدال المدفوعات بالكامل لو أُرسلت
  if jsonb_typeof(p_changes->'payments') = 'array' then
    delete from public.payments where order_id = p_order;
    select coalesce(sum((p->>'amount')::numeric), 0) into v_paid
      from jsonb_array_elements(p_changes->'payments') p;
    if v_paid + 0.01 < (select total from public.orders where id = p_order) then
      raise exception 'PAYMENT_SHORT: المدفوع أقل من إجمالي الأوردر بعد التعديل';
    end if;
    for v_pay in select * from jsonb_array_elements(p_changes->'payments') loop
      insert into public.payments (branch_id, order_id, shift_id, payment_method_id, method_name, is_cash, amount, reference)
      values (
        v_order.branch_id, p_order, v_order.shift_id,
        nullif(v_pay->>'payment_method_id','')::uuid,
        v_pay->>'method_name',
        coalesce((v_pay->>'is_cash')::boolean, false),
        (v_pay->>'amount')::numeric,
        nullif(v_pay->>'reference',''));
    end loop;
  end if;

  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'order_edited',
          jsonb_build_object('order_number', v_order.order_number), auth.uid());

  return jsonb_build_object('id', p_order, 'total', (select total from public.orders where id = p_order));
end $$;

-- ---------------------------------------------------------------------
-- إعادة طباعة: إعادة إنشاء مهام طباعة الملصقات لأصناف الأوردر غير الملغية
-- ---------------------------------------------------------------------
create or replace function public.reprint_order(p_order uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_item record;
  v_dept public.departments;
  v_logo text;
  v_count int := 0;
  i int;
begin
  if not public.auth_has_perm('order.reprint') then
    raise exception 'NOT_ALLOWED: إعادة الطباعة';
  end if;
  select * into v_order from public.orders where id = p_order;
  if not found or not public.auth_can_access_branch(v_order.branch_id) then
    raise exception 'NOT_FOUND: الأوردر غير موجود';
  end if;

  select logo_url into v_logo from public.branch_settings where branch_id = v_order.branch_id;

  for v_item in
    select * from public.order_items
     where order_id = p_order and status <> 'cancelled'
  loop
    select * into v_dept from public.departments where id = v_item.department_id;
    if v_dept.prints_labels and v_dept.printer_id is not null then
      for i in 1..v_item.quantity loop
        insert into public.print_jobs (branch_id, printer_id, order_id, order_item_id, department_id, payload)
        values (v_order.branch_id, v_dept.printer_id, p_order, v_item.id, v_item.department_id,
                jsonb_build_object('logo_url', v_logo, 'order_number', v_order.order_number,
                                   'item_name', v_item.item_name || coalesce(' - ' || v_item.size_name, ''),
                                   'reprint', true));
        v_count := v_count + 1;
      end loop;
    end if;
  end loop;

  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'order_reprinted',
          jsonb_build_object('order_number', v_order.order_number, 'labels', v_count), auth.uid());

  return jsonb_build_object('id', p_order, 'labels_created', v_count);
end $$;

-- ---------------------------------------------------------------------
-- صلاحيات التنفيذ
-- ---------------------------------------------------------------------
revoke execute on function
  public.create_order_full(jsonb), public.list_orders(uuid, text, int, int),
  public.edit_order(uuid, jsonb), public.reprint_order(uuid)
  from public, anon;
grant execute on function
  public.create_order_full(jsonb), public.list_orders(uuid, text, int, int),
  public.edit_order(uuid, jsonb), public.reprint_order(uuid)
  to authenticated;
