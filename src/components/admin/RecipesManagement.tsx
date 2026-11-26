import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { posService, isPosDemoMode } from '@/services/pos.service';
import { demoRecipes, demoTargetOptions } from '@/services/pos.fixtures';
import { Plus, X, Save, AlertCircle, ChefHat } from 'lucide-react';

interface RecipeTarget {
  target_type: 'menu_item' | 'donut_type';
  id: string;
  name: string;
  department_name?: string;
}

interface IngredientRow {
  ingredient_name: string;
  quantity: number;
  unit: string;
  per_unit: 'item' | 'piece';
  /** صوص/إضافة محددة: يُحسب المكون فقط عند اختيارها فعلياً؛ فارغ = أساسي على كل وحدة */
  option_name?: string | null;
  role?: 'filling' | 'topping' | null;
}

interface TargetOption {
  option_name: string;
  role: 'filling' | 'topping' | null;
}

interface Recipe {
  id: string;
  target_type: 'menu_item' | 'donut_type';
  menu_item_id?: string;
  donut_type_id?: string;
  target_name: string;
  ingredients: IngredientRow[];
}

export const RecipesManagement: React.FC = () => {
  const [targets, setTargets] = useState<RecipeTarget[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<RecipeTarget | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isPosDemoMode) {
      const list = demoRecipes as any[];
      setRecipes(list);
      setTargets(list.map((r) => ({
        target_type: r.target_type,
        id: r.menu_item_id || r.donut_type_id,
        name: r.target_type === 'donut_type' ? `دونتس ${r.target_name}` : r.target_name,
        department_name: r.target_type === 'donut_type' ? 'دونتس' : (r.department_name || 'وافل'),
      })));
      return;
    }
    if (!isLiveSupabaseConfigured || !supabase) return;
    const [itemsRes, typesRes, recipeList] = await Promise.all([
      supabase.from('menu_items').select('id, name, departments(name)').eq('is_active', true).order('name'),
      supabase.from('donut_types').select('id, name').eq('is_active', true).order('name'),
      posService.listRecipes().catch(() => []),
    ]);

    const itemTargets: RecipeTarget[] = (itemsRes.data || []).map((i: any) => ({
      target_type: 'menu_item',
      id: i.id,
      name: i.name,
      department_name: i.departments?.name,
    }));
    const typeTargets: RecipeTarget[] = (typesRes.data || []).map((t: any) => ({
      target_type: 'donut_type',
      id: t.id,
      name: `دونتس ${t.name}`,
      department_name: 'دونتس',
    }));
    setTargets([...typeTargets, ...itemTargets]);
    setRecipes(recipeList as Recipe[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recipeFor = (t: RecipeTarget): Recipe | undefined =>
    recipes.find((r) =>
      t.target_type === 'menu_item' ? r.menu_item_id === t.id : r.donut_type_id === t.id
    );

  const openEditor = async (t: RecipeTarget) => {
    setSelectedTarget(t);
    const existing = recipeFor(t);
    setIngredients(
      existing
        ? existing.ingredients.map((i) => ({ ...i }))
        : [{ ingredient_name: '', quantity: 0, unit: 'جرام', per_unit: t.target_type === 'donut_type' ? 'piece' : 'item', option_name: null, role: null }]
    );
    setMessage(null);
    // الصوصات/الإضافات المتاحة للصنف — تُربط بها المكونات اختيارياً
    if (isPosDemoMode) {
      setTargetOptions(demoTargetOptions[t.id] || []);
      return;
    }
    if (!supabase) { setTargetOptions([]); return; }
    try {
      if (t.target_type === 'donut_type') {
        const { data } = await supabase
          .from('donut_type_groups')
          .select('role, option_groups(options(name, is_active))')
          .eq('donut_type_id', id(t));
        const opts: TargetOption[] = [];
        for (const g of (data as any[]) || []) {
          for (const o of g.option_groups?.options || []) {
            if (o.is_active !== false) opts.push({ option_name: o.name, role: g.role });
          }
        }
        setTargetOptions(opts);
      } else {
        const { data } = await supabase
          .from('item_option_groups')
          .select('option_groups(options(name, is_active))')
          .eq('item_id', id(t));
        const opts: TargetOption[] = [];
        for (const g of (data as any[]) || []) {
          for (const o of g.option_groups?.options || []) {
            if (o.is_active !== false) opts.push({ option_name: o.name, role: null });
          }
        }
        setTargetOptions(opts);
      }
    } catch {
      setTargetOptions([]);
    }
  };

  const id = (t: RecipeTarget) => t.id;

  const handleSave = async () => {
    if (!selectedTarget) return;
    const valid = ingredients.filter((i) => i.ingredient_name.trim() && i.quantity > 0);
    setIsSaving(true);
    setMessage(null);
    try {
      await posService.upsertRecipe({
        target_type: selectedTarget.target_type,
        menu_item_id: selectedTarget.target_type === 'menu_item' ? selectedTarget.id : undefined,
        donut_type_id: selectedTarget.target_type === 'donut_type' ? selectedTarget.id : undefined,
        ingredients: valid.map((i) => ({
          ingredient_name: i.ingredient_name.trim(),
          quantity: i.quantity,
          unit: i.unit,
          per_unit: i.per_unit,
          option_name: i.option_name || undefined,
          role: i.option_name ? i.role || undefined : undefined,
        })),
      });
      setMessage('تم حفظ الوصفة');
      await load();
      setSelectedTarget(null);
    } catch (err: any) {
      setMessage(err.message || 'فشل حفظ الوصفة');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLiveSupabaseConfigured && !isPosDemoMode) {
    return (
      <div className="py-12 text-center text-xs text-ink-muted">
        إدارة الرسبي تحتاج اتصال قاعدة البيانات (Supabase)
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div>
          <h3 className="text-sm font-extrabold text-ink flex items-center gap-1.5">
            <ChefHat className="w-4 h-4 text-brand-700" />
            الرسبي (وصفات الأصناف)
          </h3>
          <p className="text-[11px] text-ink-muted">
            حدد مكونات كل صنف وكمياتها — استهلاك الصوصات في التقارير يتحسب من هنا
          </p>
        </div>
      </div>

      {message && (
        <div className="p-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* قائمة الأصناف وحالة الوصفة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {targets.map((t) => {
          const r = recipeFor(t);
          return (
            <button
              key={`${t.target_type}-${t.id}`}
              type="button"
              onClick={() => openEditor(t)}
              className="p-2.5 rounded-lg border border-line bg-surface-2/40 hover:bg-surface-2 text-right transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">{t.name}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    r ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {r ? `${r.ingredients.length} مكونات` : 'بدون وصفة'}
                </span>
              </div>
              {t.department_name && <div className="text-[10px] text-ink-muted mt-0.5">{t.department_name}</div>}
            </button>
          );
        })}
        {targets.length === 0 && (
          <p className="text-[11px] text-ink-muted col-span-full py-6 text-center">
            لا توجد أصناف. أضف الأصناف من تبويب الأقسام والمنيو أولاً.
          </p>
        )}
      </div>

      {/* محرر الوصفة */}
      {selectedTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h4 className="font-extrabold text-sm text-ink">وصفة: {selectedTarget.name}</h4>
                <p className="text-[11px] text-ink-muted">
                  {selectedTarget.target_type === 'donut_type'
                    ? 'الكميات لكل قطعة دونتس'
                    : 'الكميات لكل وحدة مباعة من الصنف'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedTarget(null)} className="p-1 rounded text-ink-muted hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={ing.ingredient_name}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...ing, ingredient_name: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder="اسم الصوص / المكون"
                    className="flex-1 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:outline-none focus:border-brand-700"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={ing.quantity || ''}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...ing, quantity: Number(e.target.value) };
                      setIngredients(next);
                    }}
                    placeholder="الكمية"
                    dir="ltr"
                    className="w-20 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink text-center focus:outline-none focus:border-brand-700"
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...ing, unit: e.target.value };
                      setIngredients(next);
                    }}
                    placeholder="الوحدة"
                    className="w-16 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-bold text-ink text-center focus:outline-none focus:border-brand-700"
                  />
                  <button
                    type="button"
                    onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                    className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* ربط كل مكون بصوص/إضافة محددة (يُحسب عند اختيارها فعلاً) أو تركه أساسياً */}
            <div className="space-y-1.5">
              {ingredients.map((ing, idx) => (
                <div key={`bind-${idx}`} className="flex items-center gap-1.5 pr-1">
                  <span className="text-[10px] text-ink-muted w-20 truncate">{ing.ingredient_name || '—'}</span>
                  <select
                    value={ing.option_name ? `${ing.option_name}|${ing.role || ''}` : ''}
                    onChange={(e) => {
                      const next = [...ingredients];
                      const v = e.target.value;
                      if (!v) {
                        next[idx] = { ...ing, option_name: null, role: null };
                      } else {
                        const sep = v.lastIndexOf('|');
                        const on = v.slice(0, sep);
                        const rl = v.slice(sep + 1);
                        next[idx] = { ...ing, option_name: on, role: rl === '' ? null : (rl as 'filling' | 'topping') };
                      }
                      setIngredients(next);
                    }}
                    className="flex-1 py-1 px-2 rounded-lg border border-line bg-surface text-[11px] font-bold text-ink focus:outline-none focus:border-brand-700"
                  >
                    <option value="">
                      {selectedTarget.target_type === 'donut_type' ? 'أساسي — على كل قطعة' : 'أساسي — على كل وحدة'}
                    </option>
                    {targetOptions.map((o) => (
                      <option key={`${o.option_name}|${o.role || ''}`} value={`${o.option_name}|${o.role || ''}`}>
                        عند اختيار: {o.option_name}
                        {o.role ? (o.role === 'filling' ? ' (حشوة)' : ' (توبنج)') : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  {
                    ingredient_name: '',
                    quantity: 0,
                    unit: 'جرام',
                    per_unit: selectedTarget.target_type === 'donut_type' ? 'piece' : 'item',
                  },
                ])
              }
              className="w-full py-1.5 rounded-lg border border-dashed border-line text-xs font-bold text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مكون</span>
            </button>

            <div className="flex items-center gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الوصفة'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarget(null)}
                className="py-2 px-4 rounded-xl border border-line text-ink font-bold text-xs hover:bg-surface-2 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
