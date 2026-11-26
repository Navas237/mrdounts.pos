-- =====================================================================
-- 008: ترقيات نقطة البيع (مستر دونتس)
-- صلاحيات شاشتي الطلبات والتقارير + جداول الرسبي (الوصفات)
-- =====================================================================

-- ---------------------------------------------------------------------
-- صلاحيات جديدة: شاشة الطلبات + شاشة التقارير
-- ---------------------------------------------------------------------
insert into public.permissions (key, kind, group_name, label_ar, sort_order) values
  ('screen.orders',  'screen', 'الشاشات', 'شاشة الطلبات', 25),
  ('screen.reports', 'screen', 'الشاشات', 'شاشة التقارير', 45)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- الرسبي (الوصفات): لكل صنف منيو أو نوع دونتس قائمة مكونات بكمياتها
-- تُستخدم لحساب استهلاك الصوصات من المبيعات الفعلية
-- ---------------------------------------------------------------------
create type public.recipe_target as enum ('menu_item', 'donut_type');

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id) on delete cascade,
  target_type   public.recipe_target not null,
  menu_item_id  uuid references public.menu_items(id) on delete cascade,
  donut_type_id uuid references public.donut_types(id) on delete cascade,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint recipes_one_target check (
    (target_type = 'menu_item' and menu_item_id is not null and donut_type_id is null)
    or (target_type = 'donut_type' and donut_type_id is not null and menu_item_id is null))
);
create unique index recipes_unique_menu_item on public.recipes (branch_id, menu_item_id)
  where menu_item_id is not null;
create unique index recipes_unique_donut_type on public.recipes (branch_id, donut_type_id)
  where donut_type_id is not null;
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- مكونات الوصفة: اسم المكون (صوص) وكميته لكل وحدة مبيعات
-- per_unit = 'item'  : الكمية لكل وحدة مباعة من الصنف (وافل / مشروب)
-- per_unit = 'piece' : الكمية لكل قطعة دونتس (من نوع الدونتس صاحب الوصفة)
create table public.recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  ingredient_name text not null,
  quantity        numeric(10,3) not null check (quantity > 0),
  unit            text not null default 'جرام',
  per_unit        text not null default 'item' check (per_unit in ('item','piece')),
  sort_order      int not null default 0
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

-- RLS: القراءة لكل من يملك شاشة الإدارة أو التقارير، والكتابة لإدارة المنيو
alter table public.recipes enable row level security;
create policy recipes_select on public.recipes for select to authenticated
  using (public.auth_can_access_branch(branch_id)
    and public.auth_has_any_perm(array['menu.manage','screen.reports','screen.admin']));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'));
create policy recipes_update on public.recipes for update to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'))
  with check (public.auth_can_access_branch(branch_id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'));

alter table public.recipe_ingredients enable row level security;
create policy recipe_ingredients_select on public.recipe_ingredients for select to authenticated
  using (public.auth_can_access_branch(branch_id)
    and public.auth_has_any_perm(array['menu.manage','screen.reports','screen.admin']));
create policy recipe_ingredients_insert on public.recipe_ingredients for insert to authenticated
  with check (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'));
create policy recipe_ingredients_update on public.recipe_ingredients for update to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'))
  with check (public.auth_can_access_branch(branch_id));
create policy recipe_ingredients_delete on public.recipe_ingredients for delete to authenticated
  using (public.auth_can_access_branch(branch_id) and public.auth_has_perm('menu.manage'));
