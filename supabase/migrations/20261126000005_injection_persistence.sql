-- 20261126000005_injection_persistence.sql
-- حفظ حالة إنجاز الحقن لكل قطعة دونتس.
-- الضغط على صوص في شاشة الحقن يعلّم كل قطعه الـ pending كمحقونة (injected_at).
-- الإنجاز في اتجاه واحد فقط: الضغط المتكرر بعد الاكتمال لا يلغي ولا يكرر.
-- القطع اللي توصل بعد كده تفضل فاضية (pending)، فالصوص بيرجع يظهر غير مكتمل
-- تلقائياً لحد ما يتعلّم هو كمان. لا علاقة له بحالة تسليم الأوردر.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_item_pieces' and column_name = 'injected_at'
  ) then
    alter table public.order_item_pieces add column injected_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_item_pieces' and column_name = 'injected_by'
  ) then
    alter table public.order_item_pieces add column injected_by uuid references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists order_item_pieces_injected_idx on public.order_item_pieces (order_item_id) where injected_at is null;

-- ---------------------------------------------------------------------
-- RPC: إنجاز حقن صوص — اتجاه واحد، idempotent، بصلاحية محطة الدونتس فقط
-- (kitchen.prepare + قسم الدونتس) بدون أي صلاحية order.create/order.edit.
-- injected_by يُشتق من المتصل (auth.uid)، والختم الأول يكسب: injected_at is null.
-- الأوردرات المسلّمة أو الملغية لا تتأثر (o.status = 'active' فقط).
-- ---------------------------------------------------------------------
create or replace function public.complete_injection_sauce(p_branch uuid, p_sauce_name text, p_donut_type text default 'regular')
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_dept uuid;
  v_count int;
begin
  if not public.auth_can_access_branch(p_branch) then
    raise exception 'NOT_ALLOWED: الفرع غير مسموح';
  end if;
  select id into v_dept from public.departments
   where branch_id = p_branch and behavior = 'donut_box'
   order by sort_order limit 1;
  if v_dept is null or not public._can_work_dept(v_dept) then
    raise exception 'NOT_ALLOWED: إنجاز الحقن';
  end if;
  if p_donut_type not in ('regular','mini','stuffed') then
    raise exception 'INVALID_TYPE: نوع الدونتس';
  end if;

  update public.order_item_pieces p
     set injected_at = now(), injected_by = auth.uid()
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where p.order_item_id = oi.id
     and oi.branch_id = p_branch
     and o.branch_id = p_branch
     and o.status = 'active'
     and oi.department_id = v_dept
     and p.injected_at is null
     and case oi.donut_type_name when 'ميني' then 'mini' when 'حشو' then 'stuffed' else 'regular' end = p_donut_type
     and (
       case
         when p.piece_kind = 'stuffed'
              and coalesce((select po.option_name from public.order_item_piece_options po
                             where po.piece_id = p.id and po.role = 'filling' limit 1), 'محشي') <> 'سادة'
         then coalesce((select po.option_name from public.order_item_piece_options po
                         where po.piece_id = p.id and po.role = 'filling' limit 1), 'محشي')
         else 'سادة (بدون حشو)'
       end
     ) = p_sauce_name;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.complete_injection_sauce(uuid, text, text) from public, anon;
grant execute on function public.complete_injection_sauce(uuid, text, text) to authenticated;
