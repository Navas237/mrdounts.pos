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
