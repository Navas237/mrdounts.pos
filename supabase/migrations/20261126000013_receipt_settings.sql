-- إعدادات إيصال العميل لكل فرع: اللوجو + النصوص الثابتة (رأس/ذيل الإيصال).
-- اللوجو يتخزن في branch_settings.logo_url الموجود أصلاً (رابط http(s) أو صورة صغيرة data:image)،
-- فمفيش bucket أو تغيير في storage. باقي الإعدادات في عمود jsonb جديد.
alter table public.branch_settings add column if not exists receipt jsonb not null default '{}'::jsonb;

-- قراءة: أي مستخدم في الفرع بيطبع/ينشئ أوردرات (الإيصال بيحتاجها) أو يدير الإعدادات
create or replace function public.get_receipt_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
  s public.branch_settings;
  b public.branches;
  r jsonb;
begin
  if v_branch is null or not public.auth_has_any_perm(
       array['order.create','order.reprint','screen.orders','settings.manage','screen.admin']) then
    raise exception 'NOT_ALLOWED: عرض إعدادات الإيصال';
  end if;
  select * into s from public.branch_settings where branch_id = v_branch;
  select * into b from public.branches where id = v_branch;
  r := coalesce(s.receipt, '{}'::jsonb);
  return jsonb_build_object(
    'logo_url', s.logo_url,
    'show_logo', coalesce((r->>'show_logo')::boolean, true),
    'logo_width_mm', coalesce((r->>'logo_width_mm')::int, 30),
    'brand_name', nullif(r->>'brand_name', ''),
    'header_lines', case when jsonb_typeof(r->'header_lines') = 'array' then r->'header_lines' else null end,
    'footer_lines', case when jsonb_typeof(r->'footer_lines') = 'array' then r->'footer_lines'
                         else '["شكراً لزيارتكم"]'::jsonb end,
    'delivery_footer_lines', case when jsonb_typeof(r->'delivery_footer_lines') = 'array' then r->'delivery_footer_lines'
                                  else '["نتمنى لكم وجبة سعيدة"]'::jsonb end,
    'branch', jsonb_build_object('name', b.name, 'address', b.address, 'phone', b.phone)
  );
end $$;

-- حفظ (settings.manage فقط). p: {logo_url, show_logo, logo_width_mm, brand_name, header_lines[], footer_lines[], delivery_footer_lines[]}
-- header_lines = null يعني «استخدم عنوان وتليفون الفرع تلقائي».
create or replace function public.save_receipt_settings(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid := public.auth_branch_id();
  v_logo text := nullif(btrim(coalesce(p->>'logo_url','')), '');
  v_w int := coalesce((p->>'logo_width_mm')::int, 30);
  v_key text;
  v_line jsonb;
  v_rec jsonb;
begin
  if v_branch is null or not public.auth_has_perm('settings.manage') then
    raise exception 'NOT_ALLOWED: تعديل إعدادات الإيصال';
  end if;
  if v_w < 10 or v_w > 60 then raise exception 'INVALID: عرض اللوجو من 10 إلى 60 مم'; end if;
  if v_logo is not null then
    if length(v_logo) > 400000 then raise exception 'INVALID: صورة اللوجو كبيرة'; end if;
    if v_logo !~* '^(https?://|data:image/(png|jpeg|webp);base64,)' then
      raise exception 'INVALID: اللوجو لازم رابط http(s) أو صورة png/jpg/webp';
    end if;
  end if;
  if length(coalesce(p->>'brand_name','')) > 60 then raise exception 'INVALID: اسم الإيصال طويل'; end if;
  foreach v_key in array array['header_lines','footer_lines','delivery_footer_lines'] loop
    if p ? v_key and jsonb_typeof(p->v_key) = 'array' then
      if jsonb_array_length(p->v_key) > 8 then raise exception 'INVALID: أقصى عدد سطور 8'; end if;
      for v_line in select * from jsonb_array_elements(p->v_key) loop
        if jsonb_typeof(v_line) <> 'string' or length(v_line #>> '{}') > 80 then
          raise exception 'INVALID: كل سطر نص لحد 80 حرف';
        end if;
      end loop;
    end if;
  end loop;

  v_rec := jsonb_strip_nulls(jsonb_build_object(
    'show_logo', coalesce((p->>'show_logo')::boolean, true),
    'logo_width_mm', v_w,
    'brand_name', nullif(btrim(coalesce(p->>'brand_name','')), ''),
    'header_lines', case when jsonb_typeof(p->'header_lines') = 'array' then p->'header_lines' end,
    'footer_lines', case when jsonb_typeof(p->'footer_lines') = 'array' then p->'footer_lines' end,
    'delivery_footer_lines', case when jsonb_typeof(p->'delivery_footer_lines') = 'array' then p->'delivery_footer_lines' end));

  insert into public.branch_settings (branch_id, logo_url, receipt)
  values (v_branch, v_logo, v_rec)
  on conflict (branch_id) do update set logo_url = excluded.logo_url, receipt = excluded.receipt;
  return public.get_receipt_settings();
end $$;

revoke execute on function public.get_receipt_settings(), public.save_receipt_settings(jsonb) from public, anon;
grant execute on function public.get_receipt_settings(), public.save_receipt_settings(jsonb) to authenticated;
