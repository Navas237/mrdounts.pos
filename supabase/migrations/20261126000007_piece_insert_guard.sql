-- =====================================================================
-- قفل مشترك لكُتّاب القطع: أي إدخال مباشر في order_item_pieces
-- (مسموح بصلاحية order.create/order.edit عبر RLS) يقفل صف الأوردر أولاً،
-- فيتسلسل مع deliver_order و edit_order على نفس القفل (FOR UPDATE)،
-- ويُرفض إن لم يكن الأوردر شغالاً. النتيجة: لا يمكن لقطعة جديدة أن
-- تتجاوز بوابة الحقن/التسليم بسباق، في أي اتجاه.
-- create_order_full و edit_order لا يتأثران: معاملتاهما تملكان القفل أصلاً.
-- =====================================================================
create or replace function public.order_item_pieces_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order_status public.order_status;
begin
  select o.status into v_order_status
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.id = new.order_item_id
   for update of o;
  if v_order_status is null then
    raise exception 'NOT_FOUND: الصنف غير موجود';
  end if;
  if v_order_status <> 'active' then
    raise exception 'INVALID_STATE: لا يمكن إضافة قطع لأوردر غير شغال';
  end if;
  return new;
end $$;

drop trigger if exists order_item_pieces_before_insert on public.order_item_pieces;
create trigger order_item_pieces_before_insert
  before insert on public.order_item_pieces
  for each row execute function public.order_item_pieces_before_insert();
