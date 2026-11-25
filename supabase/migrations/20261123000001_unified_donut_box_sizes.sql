-- =====================================================================
-- 20261123000001_unified_donut_box_sizes.sql
-- توحيد إدخال أحجام بوكسات الدونتس (عدد القطع مع أسعار العادي والميني والحشو)
-- مع معالجة وتفريغ أي سجلات مكررة سابقة لمنع أخطاء القيد الفريد (Unique Constraint)
-- وإلغاء جدول ربط التوبنج بالحشو ليعمل النظام بحرية ديناميكية تامة
-- =====================================================================

-- 1. إضافة أعمدة الأسعار الموحدة إن لم تكن موجودة بعد
alter table public.donut_box_sizes
  add column if not exists regular_price numeric(10,2) not null default 0 check (regular_price >= 0),
  add column if not exists mini_price    numeric(10,2) not null default 0 check (mini_price >= 0),
  add column if not exists stuffed_price numeric(10,2) not null default 0 check (stuffed_price >= 0);

-- 2. في حال وجود بيانات قديمة مرتبطة بـ donut_type_id، نقوم بتحديث الأسعار إن أمكن
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'donut_box_sizes' and column_name = 'donut_type_id'
  ) then
    update public.donut_box_sizes b
    set regular_price = coalesce(
      (select p.price from public.donut_box_sizes p 
       join public.donut_types t on t.id = p.donut_type_id 
       where p.branch_id = b.branch_id and p.pieces = b.pieces and (t.name ilike '%regular%' or t.name like '%عادي%') limit 1),
      b.regular_price
    ),
    mini_price = coalesce(
      (select p.price from public.donut_box_sizes p 
       join public.donut_types t on t.id = p.donut_type_id 
       where p.branch_id = b.branch_id and p.pieces = b.pieces and (t.name ilike '%mini%' or t.name like '%ميني%') limit 1),
      b.mini_price
    ),
    stuffed_price = coalesce(
      (select p.price from public.donut_box_sizes p 
       join public.donut_types t on t.id = p.donut_type_id 
       where p.branch_id = b.branch_id and p.pieces = b.pieces and (t.name ilike '%stuffed%' or t.name like '%حشو%') limit 1),
      b.stuffed_price
    );
  end if;
end $$;

-- 3. إعادة توجيه أي عناصر طلبات سابقة تشير للسجلات المكررة إلى السجل الرئيسي
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_items') then
    with ranked as (
      select id, branch_id, pieces,
             row_number() over (partition by branch_id, pieces order by id) as rn,
             first_value(id) over (partition by branch_id, pieces order by id) as keep_id
      from public.donut_box_sizes
    )
    update public.order_items oi
    set box_size_id = r.keep_id
    from ranked r
    where oi.box_size_id = r.id and r.rn > 1;
  end if;
end $$;

-- 4. إزالة كافة السجلات المكررة لكل (branch_id, pieces) والإبقاء على سجل واحد فقط
with duplicates as (
  select id,
         row_number() over (partition by branch_id, pieces order by id) as rn
  from public.donut_box_sizes
)
delete from public.donut_box_sizes
where id in (select id from duplicates where rn > 1);

-- 5. حذف الأعمدة والقيود القديمة
alter table public.donut_box_sizes
  drop constraint if exists donut_box_sizes_donut_type_id_pieces_key,
  drop column if exists donut_type_id,
  drop column if exists price;

-- 6. إنشاء القيد الفريد على (branch_id, pieces)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'donut_box_sizes_branch_pieces_key'
  ) then
    alter table public.donut_box_sizes add constraint donut_box_sizes_branch_pieces_key unique (branch_id, pieces);
  end if;
end $$;

-- 7. إلغاء جدول قيود ربط التوبنج بالحشو
drop table if exists public.donut_type_groups cascade;
