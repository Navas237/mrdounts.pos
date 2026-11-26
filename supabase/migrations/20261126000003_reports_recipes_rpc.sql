-- =====================================================================
-- 010: تقارير نهاية الشفت + تقارير الأصناف + الرسبي واستهلاك الصوصات
-- كلها RPC في الباك إند
-- =====================================================================

-- نطاق التقرير: شفت محدد أو فترة (افتراضي الفترة: كل الوقت يُمنع، لازم شفت أو فترة)
create or replace function public._report_order_ids(
  p_branch uuid, p_shift uuid, p_from timestamptz, p_to timestamptz)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.orders o
   where o.branch_id = p_branch and o.status <> 'cancelled'
     and (p_shift is null or o.shift_id = p_shift)
     and (p_from is null or o.created_at >= p_from)
     and (p_to is null or o.created_at < p_to)
$$;

-- ---------------------------------------------------------------------
-- تقرير نهاية الشفت: مبيعات ومدفوعات وأنواع أوردرات ودرج
-- ---------------------------------------------------------------------
create or replace function public.shift_end_report(p_shift uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_shift public.shifts;
begin
  select * into v_shift from public.shifts where id = p_shift;
  if not found or not public.auth_can_access_branch(v_shift.branch_id)
     or not public.auth_has_perm('drawer.view') then
    raise exception 'NOT_ALLOWED: تقرير نهاية الشفت';
  end if;

  return jsonb_build_object(
    'shift_id', v_shift.id,
    'status', v_shift.status,
    'opened_at', v_shift.opened_at,
    'closed_at', v_shift.closed_at,
    'opening_cash', v_shift.opening_cash,
    'orders', coalesce((
      select jsonb_build_object(
        'count', count(*),
        'subtotal', sum(o.subtotal),
        'discounts', sum(o.discount_amount),
        'tax', sum(o.tax_amount),
        'delivery_fees', sum(o.delivery_fee),
        'net_total', sum(o.total))
      from public.orders o
      where o.shift_id = p_shift and o.status <> 'cancelled'), '{}'::jsonb),
    'cancelled_orders', (
      select count(*) from public.orders o
      where o.shift_id = p_shift and o.status = 'cancelled'),
    'orders_by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', t.order_type, 'count', t.cnt, 'total', t.total))
      from (select o.order_type, count(*) as cnt, sum(o.total) as total
              from public.orders o
             where o.shift_id = p_shift and o.status <> 'cancelled'
             group by o.order_type) t), '[]'::jsonb),
    'payments_by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', t.method_name, 'is_cash', t.is_cash, 'total', t.total, 'count', t.cnt))
      from (select p.method_name, p.is_cash, sum(p.amount) as total, count(*) as cnt
              from public.payments p
              join public.orders o on o.id = p.order_id and o.status <> 'cancelled'
             where p.shift_id = p_shift
             group by p.method_name, p.is_cash) t), '[]'::jsonb),
    'cash_change', coalesce((select sum(o.change_amount) from public.orders o
             where o.shift_id = p_shift and o.status <> 'cancelled'), 0),
    'net_cash', coalesce((select sum(p.amount) from public.payments p
             join public.orders o on o.id = p.order_id and o.status <> 'cancelled'
             where p.shift_id = p_shift and p.is_cash), 0)
           - coalesce((select sum(o.change_amount) from public.orders o
             where o.shift_id = p_shift and o.status <> 'cancelled'), 0),
    'movements_in', coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'in'), 0),
    'movements_out', coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift and direction = 'out'), 0),
    'expected_cash', v_shift.expected_cash,
    'counted_cash', v_shift.counted_cash,
    'cash_difference', v_shift.cash_difference
  );
end $$;

-- ---------------------------------------------------------------------
-- تقارير الأصناف مقسمة:
--  - عدد مبيعات كل بوكس (نوع الدونتس + حجم البوكس)
--  - عدد القطع بالصوص (حشوة/توبنج) بالاسم
--  - الوافل والمشروبات وباقي الأصناف بالاسم لكل قطعة
-- ---------------------------------------------------------------------
create or replace function public.item_sales_report(
  p_shift uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_any_perm(array['screen.reports','screen.admin','drawer.view']) then
    raise exception 'NOT_ALLOWED: تقرير الأصناف';
  end if;

  return jsonb_build_object(
    -- البوكسات: عدد مبيعات كل بوكس بالاسم
    'donut_boxes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'pieces', t.pieces, 'boxes', t.boxes, 'revenue', t.revenue
      ) order by t.boxes desc)
      from (
        select concat('بوكس ', coalesce(oi.donut_type_name, 'دونتس'), ' ', oi.pieces, ' قطعة') as name,
               oi.pieces,
               count(*) as boxes,
               sum(oi.line_total) as revenue
          from public.order_items oi
         where oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
           and oi.status <> 'cancelled' and oi.pieces is not null
         group by oi.donut_type_name, oi.pieces
      ) t), '[]'::jsonb),

    -- قطع الدونتس بالصوص: كل صوص اتطلب على كام قطعة (حشوة وتوبنج منفصلين)
    'donut_pieces_by_sauce', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sauce', t.option_name, 'role', t.role, 'pieces', t.pieces
      ) order by t.pieces desc)
      from (
        select po.option_name, po.role, count(*) as pieces
          from public.order_item_piece_options po
          join public.order_item_pieces pc on pc.id = po.piece_id
          join public.order_items oi on oi.id = pc.order_item_id and oi.status <> 'cancelled'
         where oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
         group by po.option_name, po.role
      ) t), '[]'::jsonb),

    -- الوافل والمشروبات وباقي الأصناف: بالاسم لكل قطعة
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'department', t.department_name,
        'name', t.name,
        'size', t.size_name,
        'quantity', t.qty,
        'revenue', t.revenue
      ) order by t.department_name, t.qty desc)
      from (
        select d.name as department_name,
               oi.item_name as name,
               oi.size_name,
               sum(oi.quantity) as qty,
               sum(oi.line_total) as revenue
          from public.order_items oi
          join public.departments d on d.id = oi.department_id
         where oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
           and oi.status <> 'cancelled' and oi.pieces is null
         group by d.name, oi.item_name, oi.size_name
      ) t), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- الرسبي: عرض وحفظ (upsert) — الإدارة من لوحة الإدارة
-- ---------------------------------------------------------------------
create or replace function public.list_recipes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_any_perm(array['menu.manage','screen.reports','screen.admin']) then
    raise exception 'NOT_ALLOWED: عرض الرسبي';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'target_type', r.target_type,
      'menu_item_id', r.menu_item_id,
      'donut_type_id', r.donut_type_id,
      'target_name', coalesce(mi.name, dt.name),
      'is_active', r.is_active,
      'ingredients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'ingredient_name', ri.ingredient_name,
          'quantity', ri.quantity,
          'unit', ri.unit,
          'per_unit', ri.per_unit
        ) order by ri.sort_order, ri.ingredient_name)
        from public.recipe_ingredients ri where ri.recipe_id = r.id), '[]'::jsonb)
    ))
    from public.recipes r
    left join public.menu_items mi on mi.id = r.menu_item_id
    left join public.donut_types dt on dt.id = r.donut_type_id
    where r.branch_id = v_branch), '[]'::jsonb);
end $$;

create or replace function public.upsert_recipe(p_recipe jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
  v_id uuid;
  v_ing jsonb;
begin
  if v_branch is null or not public.auth_has_perm('menu.manage') then
    raise exception 'NOT_ALLOWED: حفظ الرسبي';
  end if;

  insert into public.recipes (branch_id, target_type, menu_item_id, donut_type_id)
  values (
    v_branch,
    (p_recipe->>'target_type')::public.recipe_target,
    nullif(p_recipe->>'menu_item_id','')::uuid,
    nullif(p_recipe->>'donut_type_id','')::uuid)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.recipes
     where branch_id = v_branch
       and ((menu_item_id is not null and menu_item_id = nullif(p_recipe->>'menu_item_id','')::uuid)
         or (donut_type_id is not null and donut_type_id = nullif(p_recipe->>'donut_type_id','')::uuid));
  end if;

  delete from public.recipe_ingredients where recipe_id = v_id;

  if jsonb_typeof(p_recipe->'ingredients') = 'array' then
    for v_ing in select * from jsonb_array_elements(p_recipe->'ingredients') loop
      insert into public.recipe_ingredients (branch_id, recipe_id, ingredient_name, quantity, unit, per_unit, sort_order)
      values (
        v_branch, v_id,
        v_ing->>'ingredient_name',
        (v_ing->>'quantity')::numeric,
        coalesce(nullif(v_ing->>'unit',''), 'جرام'),
        coalesce(nullif(v_ing->>'per_unit',''), 'item'),
        coalesce((v_ing->>'sort_order')::int, 0));
    end loop;
  end if;

  return jsonb_build_object('id', v_id);
end $$;

-- ---------------------------------------------------------------------
-- استهلاك الصوصات: الكمية المستهلكة محسوبة من الرسبي × المبيعات
-- وافل/مشروبات: كمية الصنف المباعة × كمية المكون لكل صنف
-- دونتس: عدد القطع المباعة من النوع × كمية المكون لكل قطعة
-- ---------------------------------------------------------------------
create or replace function public.sauce_consumption_report(
  p_shift uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
begin
  if v_branch is null or not public.auth_has_any_perm(array['screen.reports','screen.admin','drawer.view']) then
    raise exception 'NOT_ALLOWED: تقرير استهلاك الصوصات';
  end if;

  return jsonb_build_object(
   'consumption', coalesce((
    with consumption as (
      -- أصناف المنيو (وافل ومشروبات): لكل وحدة مباعة
      select ri.ingredient_name, ri.unit,
             mi.name as target_name,
             sum(oi.quantity) as units,
             sum(oi.quantity * ri.quantity) as consumed
        from public.recipe_ingredients ri
        join public.recipes r on r.id = ri.recipe_id and r.is_active
        join public.menu_items mi on mi.id = r.menu_item_id
        join public.order_items oi on oi.menu_item_id = r.menu_item_id and oi.status <> 'cancelled'
       where ri.per_unit = 'item'
         and r.branch_id = v_branch
         and oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
       group by ri.ingredient_name, ri.unit, mi.name

      union all

      -- أنواع الدونتس: لكل قطعة
      select ri.ingredient_name, ri.unit,
             dt.name as target_name,
             sum(oi.pieces) as units,
             sum(oi.pieces * ri.quantity) as consumed
        from public.recipe_ingredients ri
        join public.recipes r on r.id = ri.recipe_id and r.is_active
        join public.donut_types dt on dt.id = r.donut_type_id
        join public.order_items oi on oi.donut_type_id = r.donut_type_id and oi.status <> 'cancelled'
       where ri.per_unit = 'piece'
         and r.branch_id = v_branch
         and oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
       group by ri.ingredient_name, ri.unit, dt.name
    )
    select jsonb_agg(jsonb_build_object(
      'ingredient', g.ingredient_name,
      'unit', g.unit,
      'total_consumed', g.total_consumed,
      'breakdown', g.breakdown
    ) order by g.total_consumed desc)
    from (
      select c.ingredient_name, c.unit,
             sum(c.consumed) as total_consumed,
             jsonb_agg(jsonb_build_object(
               'target', c.target_name, 'units', c.units, 'consumed', c.consumed
             )) as breakdown
        from consumption c
       group by c.ingredient_name, c.unit
    ) g), '[]'::jsonb),
   -- أصناف اتباعت بدون رسبي: التقرير ناقص بدونها ولازم تظهر بالاسم
   'missing_recipes', coalesce((
     select jsonb_agg(t.name order by t.name)
       from (
         select oi.item_name as name
           from public.order_items oi
          where oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
            and oi.status <> 'cancelled' and oi.pieces is null and oi.menu_item_id is not null
            and not exists (
              select 1 from public.recipes r
               where r.branch_id = v_branch and r.is_active and r.menu_item_id = oi.menu_item_id)
          group by oi.item_name
         union
         select 'دونتس ' || dt.name
           from public.order_items oi
           join public.donut_types dt on dt.id = oi.donut_type_id
          where oi.order_id in (select public._report_order_ids(v_branch, p_shift, p_from, p_to))
            and oi.status <> 'cancelled' and oi.donut_type_id is not null
            and not exists (
              select 1 from public.recipes r
               where r.branch_id = v_branch and r.is_active and r.donut_type_id = oi.donut_type_id)
          group by dt.name
       ) t), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------
-- صلاحيات التنفيذ
-- ---------------------------------------------------------------------
revoke execute on function
  public._report_order_ids(uuid, uuid, timestamptz, timestamptz),
  public.shift_end_report(uuid), public.item_sales_report(uuid, timestamptz, timestamptz),
  public.list_recipes(), public.upsert_recipe(jsonb),
  public.sauce_consumption_report(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function
  public.shift_end_report(uuid), public.item_sales_report(uuid, timestamptz, timestamptz),
  public.list_recipes(), public.upsert_recipe(jsonb),
  public.sauce_consumption_report(uuid, timestamptz, timestamptz)
  to authenticated;
