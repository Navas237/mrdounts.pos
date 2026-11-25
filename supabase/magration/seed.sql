-- =====================================================================
-- بيانات أولية: فرع + أقسام + طرق دفع + أنواع الدونتس وأحجام البوكس
-- كل ده قابل للتعديل من لوحة الإدارة. غيّر اسم الفرع حسب مشروعك.
-- =====================================================================

do $$
declare
  v_branch uuid;
  v_type uuid;
  v_pieces int;
  v_i int := 0;
  v_t text;
begin
  insert into public.branches (name, code) values ('الفرع الرئيسي', 'MAIN')
  returning id into v_branch;

  insert into public.departments (branch_id, name, behavior, prints_labels, sort_order) values
    (v_branch, 'وافل',     'customizable', true,  1),
    (v_branch, 'مشروبات',  'simple',       true,  2),
    (v_branch, 'دونتس',    'donut_box',    false, 3);

  insert into public.payment_methods (branch_id, name, is_cash, sort_order) values
    (v_branch, 'نقدي',        true,  1),
    (v_branch, 'فيزا',        false, 2),
    (v_branch, 'إنستاباي',    false, 3),
    (v_branch, 'فودافون كاش', false, 4);

  foreach v_t in array array['ميني', 'عادي'] loop
    v_i := v_i + 1;
    insert into public.donut_types (branch_id, name, sort_order) values (v_branch, v_t, v_i)
    returning id into v_type;
    foreach v_pieces in array array[1, 2, 4, 6, 8, 12] loop
      insert into public.donut_box_sizes (branch_id, donut_type_id, pieces, sort_order)
      values (v_branch, v_type, v_pieces, v_pieces);
    end loop;
  end loop;
end $$;
