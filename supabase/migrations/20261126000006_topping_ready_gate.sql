-- =====================================================================
-- بوابة الحقن قبل الجاهزية والتسليم
-- القطع التي تتطلب حقناً (محشية بصوص حشو غير 'سادة') يجب أن تكون مختمة
-- injected_at قبل أن يصبح البوكس جاهزاً أو يُسلَّم الأوردر.
-- القطع السادة/topping_only لا تتطلب حقناً ولا تدخل في البوابة.
-- =====================================================================

-- القطع المطلوب حقنها ولم تُحقن بعد لصنف معيّن
create or replace function public._item_has_pending_injection(p_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.order_item_pieces p
     where p.order_item_id = p_item
       and p.piece_kind = 'stuffed'
       and p.injected_at is null
       and coalesce((select po.option_name from public.order_item_piece_options po
                      where po.piece_id = p.id and po.role = 'filling' limit 1), 'محشي') <> 'سادة')
$$;

-- ---------------------------------------------------------------------
-- RPC: تبديل جاهزية بوكس التوبنج — صلاحية المحطة فقط
-- (kitchen.prepare + قسم الدونتس) بدون order.create/order.edit.
-- اتجاه "جاهز" ممنوع ما دامت قطع محشية بانتظار الحقن؛ اتجاه الإلغاء
-- (جاهز -> تحضير) متاح دائماً. قفل الصف يمنع سباق الضغطات المتزامنة.
-- ---------------------------------------------------------------------
create or replace function public.toggle_donut_box_ready(p_item uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_item public.order_items;
  v_order_status public.order_status;
begin
  select * into v_item from public.order_items where id = p_item for update;
  if not found or not public.auth_can_access_branch(v_item.branch_id)
     or not public._can_work_dept(v_item.department_id) then
    raise exception 'NOT_ALLOWED: جاهزية البوكس';
  end if;
  select status into v_order_status from public.orders where id = v_item.order_id;
  if v_order_status is distinct from 'active' then
    raise exception 'INVALID_STATE: الأوردر ليس شغالاً';
  end if;

  if v_item.status = 'ready' then
    update public.order_items set status = 'preparing', ready_at = null where id = p_item;
    return 'preparing';
  end if;

  if v_item.status in ('pending','preparing') then
    if public._item_has_pending_injection(p_item) then
      raise exception 'INJECTION_INCOMPLETE: أكمل حقن القطع المحشية أولاً';
    end if;
    update public.order_items set status = 'ready', ready_at = now() where id = p_item;
    return 'ready';
  end if;

  raise exception 'INVALID_STATE: حالة الصنف لا تسمح بالتبديل';
end $$;

revoke execute on function public.toggle_donut_box_ready(uuid) from public, anon;
grant execute on function public.toggle_donut_box_ready(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- deliver_order: نفس البوابة عند التسليم (القفل النهائي على الأوردر).
-- يحمي من أي مسار آخر علّم الصنف جاهزاً قبل اكتمال الحقن، ومن قطع
-- محشية جديدة أُضيفت بعد جاهزية الصنف. الأصناف الملغية لا تدخل في الفحص.
-- ---------------------------------------------------------------------
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
  if exists (
    select 1
      from public.order_items oi
      join public.order_item_pieces p on p.order_item_id = oi.id
     where oi.order_id = p_order
       and oi.status <> 'cancelled'
       and p.piece_kind = 'stuffed'
       and p.injected_at is null
       and coalesce((select po.option_name from public.order_item_piece_options po
                      where po.piece_id = p.id and po.role = 'filling' limit 1), 'محشي') <> 'سادة'
  ) then
    raise exception 'INJECTION_INCOMPLETE: يوجد قطع محشية لم تُحقن بعد';
  end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = auth.uid()
   where id = p_order;
  insert into public.order_events (branch_id, order_id, event_type, payload, created_by)
  values (v_order.branch_id, p_order, 'order_delivered',
          jsonb_build_object('order_number', v_order.order_number), auth.uid());
end $$;

revoke execute on function public.deliver_order(uuid) from public, anon;
grant execute on function public.deliver_order(uuid) to authenticated;
