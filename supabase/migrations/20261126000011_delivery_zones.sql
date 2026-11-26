-- =====================================================================
-- مناطق التوصيل + بحث العميل بالرقم + رسوم التوصيل من المنطقة في الخادم
-- =====================================================================
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
  v_req text := nullif(p_payload->>'client_request_id','');
  v_hash text := md5(coalesce(p_payload->'items','[]'::jsonb)::text || coalesce(p_payload->'payments','[]'::jsonb)::text);
  v_existing_hash text;
  v_noncash numeric(12,2);
  v_change numeric(12,2);
  v_otype public.order_type := (p_payload->>'order_type')::public.order_type;
  v_zone public.delivery_zones;
  v_zone_name text;
  v_fee numeric(10,2) := 0;
  v_phone text := nullif(regexp_replace(coalesce(p_payload->>'customer_phone',''), '\s', '', 'g'), '');
  v_cust uuid;
  v_addr text := nullif(btrim(coalesce(p_payload->'address_snapshot'->>'address','')), '');
begin
  if v_branch is null or not public.auth_has_perm('order.create') then
    raise exception 'NOT_ALLOWED: إنشاء الأوردر';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'EMPTY_ORDER: الأوردر بدون أصناف';
  end if;

  -- منع البيع المكرر: نفس مفتاح الطلب يرجع نفس الأوردر (إعادة إرسال/شبكة)
  if v_req is not null then
    select o.id, o.order_number, o.total, o.client_request_hash
      into v_order_id, v_order_number, v_total, v_existing_hash
      from public.orders o
     where o.branch_id = v_branch and o.client_request_id = v_req;
    if found then
      if v_existing_hash is distinct from v_hash then
        raise exception 'REQUEST_KEY_CONFLICT: مفتاح الطلب استُخدم بمحتوى مختلف';
      end if;
      select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.order_id = v_order_id;
      return jsonb_build_object('id', v_order_id, 'order_number', v_order_number,
                                'total', v_total, 'paid', v_paid, 'duplicate', true);
    end if;
  end if;

  -- رسوم التوصيل من المنطقة فقط (لا نصدّق رقماً مرسلاً من العميل)
  if v_otype = 'delivery' then
    if nullif(p_payload->>'delivery_zone_id','') is not null then
      select * into v_zone from public.delivery_zones
       where id = (p_payload->>'delivery_zone_id')::uuid and branch_id = v_branch and is_active;
      if not found then
        raise exception 'ZONE_INVALID: منطقة التوصيل غير موجودة أو غير مفعّلة';
      end if;
      v_fee := v_zone.fee; v_zone_name := v_zone.name;
    elsif exists (select 1 from public.delivery_zones where branch_id = v_branch and is_active) then
      raise exception 'ZONE_REQUIRED: اختار منطقة التوصيل';
    end if;
  end if;

  -- الأوردر الرئيسي (التريجرات تملأ الشفت والرقم والضريبة والإجماليات)
  begin
    insert into public.orders (
      branch_id, order_type, customer_name, customer_phone, address_snapshot,
      delivery_zone_id, delivery_zone_name, delivery_fee,
      discount_type, discount_value, notes, client_request_id, client_request_hash)
    values (
      v_branch,
      (p_payload->>'order_type')::public.order_type,
      nullif(p_payload->>'customer_name',''),
      nullif(p_payload->>'customer_phone',''),
      nullif(p_payload->'address_snapshot','null'::jsonb),
      v_zone.id,
      v_zone_name,
      v_fee,
      nullif(p_payload->>'discount_type','')::public.discount_type,
      coalesce((p_payload->>'discount_value')::numeric, 0),
      nullif(p_payload->>'notes',''),
      v_req, v_hash)
    returning id into v_order_id;
  exception when unique_violation then
    -- سباق متزامن على نفس المفتاح: طلب آخر سجّله أولاً، نرجع نفس الأوردر
    if v_req is null then raise; end if;
    select o.id, o.order_number, o.total, o.client_request_hash
      into v_order_id, v_order_number, v_total, v_existing_hash
      from public.orders o
     where o.branch_id = v_branch and o.client_request_id = v_req;
    if v_existing_hash is distinct from v_hash then
      raise exception 'REQUEST_KEY_CONFLICT: مفتاح الطلب استُخدم بمحتوى مختلف';
    end if;
    select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.order_id = v_order_id;
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_number,
                              'total', v_total, 'paid', v_paid, 'duplicate', true);
  end;

  -- حفظ العميل وعنوانه ليظهروا تلقائياً عند كتابة الرقم لاحقاً
  if v_phone ~ '^[0-9+]{6,20}$' and v_otype in ('delivery', 'takeaway', 'pickup') then
    insert into public.customers (phone, name, created_branch_id)
    values (v_phone, coalesce(nullif(btrim(p_payload->>'customer_name'), ''), ''), v_branch)
    on conflict (phone) do update
      set name = case when nullif(btrim(coalesce(p_payload->>'customer_name','')), '') is not null
                        and btrim(coalesce(p_payload->>'customer_name','')) not in ('عميل جديد', 'عميل صالة', 'عميل')
                      then btrim(p_payload->>'customer_name') else public.customers.name end,
          updated_at = now()
    returning id into v_cust;
    if v_otype = 'delivery' and v_addr is not null then
      if not exists (select 1 from public.customer_addresses
                      where customer_id = v_cust and address = v_addr and delivery_zone_id is not distinct from v_zone.id) then
        update public.customer_addresses set is_default = false where customer_id = v_cust;
        insert into public.customer_addresses (customer_id, address, delivery_zone_id, is_default)
        values (v_cust, v_addr, v_zone.id, true);
      else
        update public.customer_addresses set is_default = (address = v_addr and delivery_zone_id is not distinct from v_zone.id)
         where customer_id = v_cust;
      end if;
    end if;
    update public.orders set customer_id = v_cust where id = v_order_id;
  end if;

  -- الأصناف
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    -- حل نوع الدونتس وحجم البوكس بالاسم لو لم تُرسل المعرفات
    v_donut_type_id := nullif(v_item->>'donut_type_id','')::uuid;
    if v_donut_type_id is null and nullif(v_item->>'donut_type_name','') is not null then
      select id into v_donut_type_id from public.donut_types
       where branch_id = v_branch and name = v_item->>'donut_type_name' limit 1;
    end if;
    -- أحجام البوكسات موحدة لكل فرع بعدد القطع (migration 20261123000001)
    v_box_size_id := nullif(v_item->>'box_size_id','')::uuid;
    if v_box_size_id is null and nullif(v_item->>'pieces','') is not null then
      select id into v_box_size_id from public.donut_box_sizes
       where branch_id = v_branch and pieces = (v_item->>'pieces')::int
       order by id limit 1;
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
    select coalesce(sum((p->>'amount')::numeric), 0),
           coalesce(sum((p->>'amount')::numeric) filter (
             where not coalesce((p->>'is_cash')::boolean, false)), 0)
      into v_paid, v_noncash
      from jsonb_array_elements(p_payload->'payments') p;
    if v_paid + 0.01 < v_total then
      raise exception 'PAYMENT_SHORT: المدفوع (%) أقل من إجمالي الأوردر (%)', v_paid, v_total;
    end if;
    -- الزيادة عن الإجمالي = باقي للعميل، ولا تكون إلا كاش؛ الإلكتروني لا يتجاوز الإجمالي
    if v_noncash > v_total + 0.01 then
      raise exception 'OVERPAY_NONCASH: المدفوع إلكترونياً (%) أكبر من إجمالي الأوردر (%)', v_noncash, v_total;
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

  -- الباقي للعميل (كاش فقط، وقد منعنا تجاوز الإلكتروني أعلاه)
  v_change := greatest(v_paid - v_total, 0);
  update public.orders set change_amount = v_change where id = v_order_id;

  select order_number into v_order_number from public.orders where id = v_order_id;
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number,
                            'total', v_total, 'paid', v_paid, 'change', v_change);
end $$;


-- مناطق الفرع الفعّالة للكاشير
create or replace function public.list_delivery_zones(p_include_inactive boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_any_perm(array['order.create','settings.manage','screen.admin']) then
    raise exception 'NOT_ALLOWED: عرض مناطق التوصيل';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'fee', z.fee,
                                        'sort_order', z.sort_order, 'is_active', z.is_active)
                     order by z.sort_order, z.name)
      from public.delivery_zones z
     where z.branch_id = v_branch and (p_include_inactive or z.is_active)), '[]'::jsonb);
end $$;

-- إضافة/تعديل منطقة (الأدمن)
create or replace function public.upsert_delivery_zone(
  p_id uuid, p_name text, p_fee numeric, p_sort int default 0, p_active boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id(); v_id uuid;
begin
  if v_branch is null or not public.auth_has_perm('settings.manage') then
    raise exception 'NOT_ALLOWED: إدارة مناطق التوصيل';
  end if;
  if nullif(btrim(coalesce(p_name,'')), '') is null then raise exception 'INVALID: اسم المنطقة مطلوب'; end if;
  if coalesce(p_fee, -1) < 0 then raise exception 'INVALID: رسوم التوصيل غير صحيحة'; end if;
  if p_id is null then
    insert into public.delivery_zones (branch_id, name, fee, sort_order, is_active)
    values (v_branch, btrim(p_name), p_fee, coalesce(p_sort,0), coalesce(p_active,true))
    returning id into v_id;
  else
    update public.delivery_zones set name = btrim(p_name), fee = p_fee,
           sort_order = coalesce(p_sort, sort_order), is_active = coalesce(p_active, is_active)
     where id = p_id and branch_id = v_branch
    returning id into v_id;
    if v_id is null then raise exception 'NOT_FOUND: المنطقة غير موجودة'; end if;
  end if;
  return jsonb_build_object('id', v_id);
exception when unique_violation then
  raise exception 'DUPLICATE: في منطقة بنفس الاسم';
end $$;

-- حذف منطقة: الأوردرات القديمة تحتفظ باسم المنطقة، والعناوين المحفوظة تفقد الربط فقط
create or replace function public.delete_delivery_zone(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_perm('settings.manage') then
    raise exception 'NOT_ALLOWED: إدارة مناطق التوصيل';
  end if;
  delete from public.delivery_zones where id = p_id and branch_id = v_branch;
  if not found then raise exception 'NOT_FOUND: المنطقة غير موجودة'; end if;
  return jsonb_build_object('id', p_id, 'deleted', true);
end $$;

-- بحث العميل بالرقم: الاسم + العناوين المحفوظة + المنطقة ورسومها الحالية (لفرع الكاشير)
create or replace function public.find_customer_by_phone(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_branch uuid := public.auth_branch_id(); v_phone text := regexp_replace(coalesce(p_phone,''), '\s', '', 'g'); v_c public.customers;
begin
  if v_branch is null or not public.auth_has_any_perm(array['order.create','customers.view','customers.manage','screen.callcenter']) then
    raise exception 'NOT_ALLOWED: بحث العملاء';
  end if;
  select * into v_c from public.customers where phone = v_phone;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_c.id, 'name', v_c.name, 'phone', v_c.phone,
    'addresses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'label', a.label, 'address', a.address, 'landmark', a.landmark,
               'is_default', a.is_default,
               'zone_id', z.id, 'zone_name', z.name, 'zone_fee', z.fee)
             order by a.is_default desc, a.created_at desc)
        from public.customer_addresses a
        left join public.delivery_zones z on z.id = a.delivery_zone_id and z.branch_id = v_branch and z.is_active
       where a.customer_id = v_c.id), '[]'::jsonb));
end $$;

revoke execute on function public.list_delivery_zones(boolean), public.upsert_delivery_zone(uuid,text,numeric,int,boolean),
  public.delete_delivery_zone(uuid), public.find_customer_by_phone(text) from public, anon;
grant execute on function public.list_delivery_zones(boolean), public.upsert_delivery_zone(uuid,text,numeric,int,boolean),
  public.delete_delivery_zone(uuid), public.find_customer_by_phone(text) to authenticated;
