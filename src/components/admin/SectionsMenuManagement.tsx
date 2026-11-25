import React, { useState, useEffect } from 'react';
import {
  menuService,
  UnifiedDonutBoxSize,
  MenuOption,
  MenuItem,
  MenuItemSize,
} from '@/services/menu.service';
import { Department, DepartmentBehavior } from '@/types/database';
import { formatCurrency } from '@/utils/formatters';
import {
  Layers,
  Flame,
  Coffee,
  Plus,
  Edit2,
  Trash2,
  Power,
  X,
  Sparkles,
  UtensilsCrossed,
  Settings,
  Printer,
} from 'lucide-react';
import { PermissionGate } from '@/components/shared/PermissionGate';

interface SectionsMenuManagementProps {
  departments: Department[];
  onRefreshDepartments: () => Promise<void>;
}

export const SectionsMenuManagement: React.FC<SectionsMenuManagementProps> = ({
  departments,
  onRefreshDepartments,
}) => {
  // القسم النشط المختار
  const [activeDeptId, setActiveDeptId] = useState<string>('');

  // البيانات لكل نوع معالجة
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [unifiedBoxSizes, setUnifiedBoxSizes] = useState<UnifiedDonutBoxSize[]>([]);
  const [stuffingSauces, setStuffingSauces] = useState<MenuOption[]>([]);
  const [toppingSauces, setToppingSauces] = useState<MenuOption[]>([]);
  const [deptAddons, setDeptAddons] = useState<MenuOption[]>([]);

  // مودالات التحكم
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);

  // مودال إضافة / تعديل صنف (وافل / مشروبات)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id?: string;
    name: string;
    description: string;
    base_price: number;
    has_sizes: boolean;
    sizes: { name: string; price: number; is_default: boolean }[];
    is_active: boolean;
  }>({
    name: '',
    description: '',
    base_price: 0,
    has_sizes: false,
    sizes: [
      { name: 'عادي / وسط', price: 0, is_default: true },
      { name: 'كبير / دبل', price: 0, is_default: false },
    ],
    is_active: true,
  });

  // مودال بوكس دونتس موحد
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<Partial<UnifiedDonutBoxSize>>({
    pieces: 4,
    regular_price: 0,
    mini_price: 0,
    stuffed_price: 0,
  });

  // مودال صوص (دونتس أو وافل)
  const [isSauceModalOpen, setIsSauceModalOpen] = useState(false);
  const [sauceType, setSauceType] = useState<'stuffing' | 'topping' | 'dept_addon'>('topping');
  const [editingSauce, setEditingSauce] = useState<{ id?: string; name: string; extra_price: number }>({
    name: '',
    extra_price: 0,
  });

  // اختيار أول قسم تلقائياً
  useEffect(() => {
    if (departments.length > 0 && !activeDeptId) {
      setActiveDeptId(departments[0].id);
    }
  }, [departments, activeDeptId]);

  // جلب بيانات القسم المختار
  const loadSectionData = async (deptId: string) => {
    if (!deptId) return;
    const targetDept = departments.find((d) => d.id === deptId);

    try {
      if (targetDept?.behavior === 'donut_box') {
        const [sizes, stuffings, toppings] = await Promise.all([
          menuService.getUnifiedBoxSizes(),
          menuService.getStuffingSauces(),
          menuService.getToppingSauces(),
        ]);
        setUnifiedBoxSizes(sizes);
        setStuffingSauces(stuffings);
        setToppingSauces(toppings);
      } else {
        const [items, addons] = await Promise.all([
          menuService.getMenuItems(deptId),
          menuService.getDepartmentOptions(deptId),
        ]);
        setMenuItems(items);
        setDeptAddons(addons);
      }
    } catch (err) {
      console.error('Error loading section data:', err);
    }
  };

  useEffect(() => {
    if (activeDeptId) {
      loadSectionData(activeDeptId);
    }
  }, [activeDeptId]);

  const currentDept = departments.find((d) => d.id === activeDeptId);

  // ==========================================
  // دوال الحفظ والتعامل مع البيانات
  // ==========================================

  // 1. حفظ القسم
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept?.name) return;
    await menuService.saveDepartment({
      id: editingDept.id,
      name: editingDept.name,
      behavior: editingDept.behavior || 'customizable',
      prints_labels: Boolean(editingDept.prints_labels),
      sort_order: editingDept.sort_order || departments.length + 1,
    });
    setIsDeptModalOpen(false);
    await onRefreshDepartments();
  };

  // 2. حذف القسم
  const handleDeleteDept = async (deptId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القسم؟ سيتم حذف كافة الأصناف التابعة له.')) {
      await menuService.deleteDepartment(deptId);
      await onRefreshDepartments();
      if (activeDeptId === deptId) {
        const remaining = departments.filter((d) => d.id !== deptId);
        if (remaining.length > 0) setActiveDeptId(remaining[0].id);
      }
    }
  };

  // 3. حفظ صنف (وافل / مشروبات)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem.name.trim() || !activeDeptId) return;

    const sizes: MenuItemSize[] = editingItem.has_sizes
      ? editingItem.sizes
          .filter((s) => s.name.trim() && s.price > 0)
          .map((s, idx) => ({
            id: `sz-${Date.now()}-${idx}`,
            name: s.name.trim(),
            price: Number(s.price),
            is_default: idx === 0,
          }))
      : [];

    const basePrice = editingItem.has_sizes
      ? sizes[0]?.price || 0
      : Number(editingItem.base_price) || 0;

    await menuService.saveMenuItem({
      id: editingItem.id || `it-${Date.now()}`,
      department_id: activeDeptId,
      name: editingItem.name.trim(),
      description: editingItem.description.trim(),
      base_price: basePrice,
      sizes,
      option_groups: [],
      is_active: editingItem.is_active,
    });

    setIsItemModalOpen(false);
    loadSectionData(activeDeptId);
  };

  // 4. حذف صنف
  const handleDeleteItem = async (itemId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      await menuService.deleteMenuItem(itemId);
      loadSectionData(activeDeptId);
    }
  };

  // 5. تبديل حالة الصنف
  const handleToggleItemStatus = async (item: MenuItem) => {
    await menuService.toggleMenuItemStatus(item.id, !item.is_active);
    loadSectionData(activeDeptId);
  };

  // 6. حفظ بوكس دونتس موحد
  const handleSaveDonutBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBox.pieces || editingBox.pieces <= 0) return;
    await menuService.saveUnifiedBoxSize({
      pieces: editingBox.pieces,
      regular_price: Number(editingBox.regular_price) || 0,
      mini_price: Number(editingBox.mini_price) || 0,
      stuffed_price: Number(editingBox.stuffed_price) || 0,
    });
    setIsBoxModalOpen(false);
    loadSectionData(activeDeptId);
  };

  // 7. حذف بوكس دونتس
  const handleDeleteDonutBox = async (pieces: number) => {
    if (confirm(`هل أنت متأكد من حذف بوكس الـ ${pieces} قطع؟`)) {
      await menuService.deleteUnifiedBoxSize(pieces);
      loadSectionData(activeDeptId);
    }
  };

  // 8. حفظ صنف صوص أو إضافة
  const handleSaveSauce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSauce.name.trim()) return;

    if (sauceType === 'stuffing') {
      await menuService.saveStuffing({
        id: editingSauce.id,
        name: editingSauce.name.trim(),
        extra_price: Number(editingSauce.extra_price) || 0,
      });
    } else if (sauceType === 'topping') {
      await menuService.saveTopping({
        id: editingSauce.id,
        name: editingSauce.name.trim(),
        extra_price: Number(editingSauce.extra_price) || 0,
      });
    } else if (sauceType === 'dept_addon') {
      await menuService.saveDepartmentOption(activeDeptId, {
        id: editingSauce.id,
        name: editingSauce.name.trim(),
        extra_price: Number(editingSauce.extra_price) || 0,
      });
    }

    setIsSauceModalOpen(false);
    loadSectionData(activeDeptId);
  };

  // 9. حذف صوص أو إضافة
  const handleDeleteSauce = async (type: 'stuffing' | 'topping' | 'dept_addon', id: string) => {
    if (confirm('هل أنت متأكد من الحذف؟')) {
      if (type === 'stuffing') {
        await menuService.deleteStuffing(id);
      } else if (type === 'topping') {
        await menuService.deleteTopping(id);
      } else if (type === 'dept_addon') {
        await menuService.deleteDepartmentOption(activeDeptId, id);
      }
      loadSectionData(activeDeptId);
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================================
          1. شريط اختيار الأقسام والأزرار الإدارية
          ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        {/* أزرار الأقسام (Section Filter Pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {departments.map((dept) => {
            const isSelected = activeDeptId === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setActiveDeptId(dept.id)}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-800 text-white shadow-xs'
                    : 'bg-surface hover:bg-surface-2 text-ink border border-line'
                }`}
              >
                {dept.behavior === 'donut_box' && <Layers className="w-4 h-4 text-amber-300" />}
                {dept.behavior === 'customizable' && <Flame className="w-4 h-4 text-orange-400" />}
                {dept.behavior === 'simple' && <Coffee className="w-4 h-4 text-blue-300" />}
                <span>{dept.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-muted'
                  }`}
                >
                  {dept.behavior === 'donut_box' ? 'دونتس' : dept.behavior === 'customizable' ? 'مخصص' : 'بسيط'}
                </span>
              </button>
            );
          })}
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-2 shrink-0">
          <PermissionGate action="menu.manage">
            <button
              type="button"
              onClick={() => {
                setEditingDept({
                  name: '',
                  behavior: 'customizable',
                  prints_labels: true,
                  sort_order: departments.length + 1,
                });
                setIsDeptModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-2 border border-line text-ink text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-brand-800" />
              <span>إدارة وتعديل الأقسام</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ========================================================
          2. الترويسة التفصيلية للقسم المختار ولوجك معالجته
          ======================================================== */}
      {currentDept && (
        <div className="p-3.5 rounded-xl bg-surface-2/40 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-800 text-white flex items-center justify-center font-bold shrink-0">
              {currentDept.behavior === 'donut_box' && <Layers className="w-5 h-5 text-amber-300" />}
              {currentDept.behavior === 'customizable' && <Flame className="w-5 h-5 text-orange-400" />}
              {currentDept.behavior === 'simple' && <Coffee className="w-5 h-5 text-blue-300" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-ink">{currentDept.name}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-brand-50 text-brand-800 border border-brand-200">
                  {currentDept.behavior === 'donut_box'
                    ? '🍩 لوجك بوكسات هندسية وقطع وصوصات'
                    : currentDept.behavior === 'customizable'
                    ? '🧇 لوجك أصناف مخصصة وصوصات إضافية'
                    : '☕ لوجك أصناف سريعة وأحجام مباشرة'}
                </span>
                {currentDept.prints_labels && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Printer className="w-3 h-3" />
                    <span>طباعة ملصق</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {currentDept.behavior === 'donut_box'
                  ? 'يتم التحكم هنا في عدد قطع البوكسات وأسعار الأنواع الثلاثة (عادي/ميني/حشو) وصوصات التوبنج والحشوات.'
                  : currentDept.behavior === 'customizable'
                  ? 'يتم التحكم هنا في أصناف الوافل (بالسعر الأساسي أو الأحجام) مع صوصات وإضافات التزيين التابعة للقسم.'
                  : 'يتم التحكم هنا في قائمة المشروبات السريعة مع إمكانية تحديد أحجام متعددة (Single / Double أو أحجام مختلفة).'}
              </p>
            </div>
          </div>

          {/* أزرار الإضافة حسب نوع القسم */}
          <div className="flex items-center gap-2">
            {currentDept.behavior === 'donut_box' ? (
              <PermissionGate action="menu.manage">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBox({ pieces: 4, regular_price: 0, mini_price: 0, stuffed_price: 0 });
                    setIsBoxModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة حجم بوكس</span>
                </button>
              </PermissionGate>
            ) : (
              <PermissionGate action="menu.manage">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem({
                      name: '',
                      description: '',
                      base_price: 0,
                      has_sizes: false,
                      sizes: [
                        { name: 'سنجل / وسط', price: 0, is_default: true },
                        { name: 'دبل / كبير', price: 0, is_default: false },
                      ],
                      is_active: true,
                    });
                    setIsItemModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة صنف جديد</span>
                </button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          3. عرض المحتوى واللوجك للقسم النشط
          ======================================================== */}

      {/* الحالة أ: لوجك قسم الدونتس (donut_box) */}
      {currentDept?.behavior === 'donut_box' && (
        <div className="space-y-4">
          {/* 1. جدول أحجام البوكسات الموحدة */}
          <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
            <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
              <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-800" />
                <span>أحجام بوكسات الدونتس الموحدة (Pieces & Pricing)</span>
              </span>
              <span className="text-[11px] text-ink-muted">
                يدخل المستخدم حجم البوكس وتتحدد أسعار الأنواع الثلاثة معاً
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-surface-2/40 border-b border-line text-ink-muted font-bold text-[11px]">
                    <th className="p-3">حجم البوكس</th>
                    <th className="p-3">سعر العادي</th>
                    <th className="p-3">سعر الميني</th>
                    <th className="p-3">سعر المحشي</th>
                    <th className="p-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {unifiedBoxSizes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-ink-muted text-xs">
                        لا توجد أحجام بوكسات معرفة. اضغط "إضافة حجم بوكس" للبدء.
                      </td>
                    </tr>
                  ) : (
                    unifiedBoxSizes.map((box) => (
                      <tr key={box.pieces} className="hover:bg-surface-2/20">
                        <td className="p-3 font-extrabold text-ink font-mono">
                          {box.pieces} قطع
                        </td>
                        <td className="p-3 font-bold text-ink font-mono">
                          {formatCurrency(box.regular_price)}
                        </td>
                        <td className="p-3 font-bold text-ink font-mono">
                          {formatCurrency(box.mini_price)}
                        </td>
                        <td className="p-3 font-bold text-ink font-mono">
                          {formatCurrency(box.stuffed_price)}
                        </td>
                        <td className="p-3 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBox(box);
                                setIsBoxModalOpen(true);
                              }}
                              className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                              title="تعديل الأسعار"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDonutBox(box.pieces)}
                              className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                              title="حذف الحجم"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. صوصات الحشو والتوبنج جنباً إلى جنب */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* صوصات الحشو */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs space-y-2">
              <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
                <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>صوصات الحشوات (Stuffing Sauces)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSauceType('stuffing');
                    setEditingSauce({ name: '', extra_price: 0 });
                    setIsSauceModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-md bg-brand-800 text-white font-bold text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة حشوة</span>
                </button>
              </div>

              <div className="p-3 divide-y divide-line/60">
                {stuffingSauces.length === 0 ? (
                  <p className="text-center py-4 text-xs text-ink-muted">لا توجد صوصات حشو معرفة</p>
                ) : (
                  stuffingSauces.map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-ink text-xs block">{s.name}</span>
                        {s.extra_price > 0 && (
                          <span className="text-[10px] text-brand-800 font-bold block font-mono">
                            + {formatCurrency(s.extra_price)} إضافي
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSauceType('stuffing');
                            setEditingSauce({ id: s.id, name: s.name, extra_price: s.extra_price });
                            setIsSauceModalOpen(true);
                          }}
                          className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSauce('stuffing', s.id)}
                          className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* صوصات التوبنج */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs space-y-2">
              <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
                <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span>صوصات التوبنج (Topping Sauces)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSauceType('topping');
                    setEditingSauce({ name: '', extra_price: 0 });
                    setIsSauceModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-md bg-brand-800 text-white font-bold text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة توبنج</span>
                </button>
              </div>

              <div className="p-3 divide-y divide-line/60">
                {toppingSauces.length === 0 ? (
                  <p className="text-center py-4 text-xs text-ink-muted">لا توجد صوصات توبنج معرفة</p>
                ) : (
                  toppingSauces.map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-ink text-xs block">{s.name}</span>
                        {s.extra_price > 0 && (
                          <span className="text-[10px] text-brand-800 font-bold block font-mono">
                            + {formatCurrency(s.extra_price)} إضافي
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSauceType('topping');
                            setEditingSauce({ id: s.id, name: s.name, extra_price: s.extra_price });
                            setIsSauceModalOpen(true);
                          }}
                          className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSauce('topping', s.id)}
                          className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* الحالة ب: لوجك قسم مخصص (customizable مثل الوافل) أو بسيط (simple مثل المشروبات) */}
      {currentDept && currentDept.behavior !== 'donut_box' && (
        <div className="space-y-4">
          {/* 1. قائمة أصناف القسم */}
          <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
            <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
              <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-brand-800" />
                <span>أصناف قسم ({currentDept.name})</span>
              </span>
              <span className="text-[11px] text-ink-muted">
                إجمالي {menuItems.length} صنف متاح في الكاشير
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-surface-2/40 border-b border-line text-ink-muted font-bold text-[11px]">
                    <th className="p-3">اسم الصنف</th>
                    <th className="p-3">السعر / الأحجام المتاحة</th>
                    <th className="p-3">الوصف</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {menuItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-muted text-xs">
                        لا توجد أصناف مضافة لهذا القسم بعد. اضغط "إضافة صنف جديد" للبدء.
                      </td>
                    </tr>
                  ) : (
                    menuItems.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-2/20">
                        <td className="p-3 font-extrabold text-ink">{item.name}</td>
                        <td className="p-3 font-bold text-ink">
                          {item.sizes && item.sizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.sizes.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[11px] px-2 py-0.5 rounded bg-surface-2 text-ink border border-line font-mono"
                                >
                                  {s.name}: {formatCurrency(s.price)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-brand-800">
                              {formatCurrency(item.base_price)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-ink-muted text-[11px]">{item.description || '—'}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {item.is_active ? 'نشط' : 'موقوف'}
                          </span>
                        </td>
                        <td className="p-3 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem({
                                  id: item.id,
                                  name: item.name,
                                  description: item.description || '',
                                  base_price: item.base_price,
                                  has_sizes: item.sizes && item.sizes.length > 0,
                                  sizes:
                                    item.sizes && item.sizes.length > 0
                                      ? item.sizes.map((s) => ({
                                          name: s.name,
                                          price: s.price,
                                          is_default: Boolean(s.is_default),
                                        }))
                                      : [
                                          { name: 'سنجل / عادي', price: item.base_price, is_default: true },
                                          { name: 'دبل / كبير', price: item.base_price * 1.5, is_default: false },
                                        ],
                                  is_active: item.is_active,
                                });
                                setIsItemModalOpen(true);
                              }}
                              className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                              title="تعديل الصنف"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleItemStatus(item)}
                              className={`p-1 rounded border ${
                                item.is_active
                                  ? 'bg-surface hover:bg-amber-50 text-amber-700 border-line'
                                  : 'bg-surface hover:bg-emerald-50 text-emerald-700 border-line'
                              }`}
                              title={item.is_active ? 'إيقاف الصنف' : 'تفعيل الصنف'}
                            >
                              <Power className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. إذا كان القسم customizable (مثل الوافل): عرض صوصات وإضافات التزيين التابعة للقسم */}
          {currentDept.behavior === 'customizable' && (
            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs space-y-2">
              <div className="p-3 bg-surface-2 border-b border-line flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-xs text-ink flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                    <span>صوصات وإضافات التزيين المخصصة لقسم ({currentDept.name})</span>
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    تظهر هذه الصوصات والإضافات للكاشير عند اختيار أي صنف من أصناف الوافل
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSauceType('dept_addon');
                    setEditingSauce({ name: '', extra_price: 0 });
                    setIsSauceModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-md bg-brand-800 text-white font-bold text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة صوص / إضافة للقسم</span>
                </button>
              </div>

              <div className="p-3">
                {deptAddons.length === 0 ? (
                  <p className="text-center py-4 text-xs text-ink-muted">
                    لا توجد صوصات أو إضافات مخصصة لهذا القسم بعد (مثل: نوتيلا، لوتس، كيندر، مكسرات، بولة آيس كريم).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {deptAddons.map((addon) => (
                      <div
                        key={addon.id}
                        className="p-2.5 rounded-lg border border-line bg-surface-2/30 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-xs text-ink block">{addon.name}</span>
                          <span className="text-[10px] text-brand-800 font-bold block font-mono">
                            {addon.extra_price > 0 ? `+ ${formatCurrency(addon.extra_price)}` : 'مجاناً'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSauceType('dept_addon');
                              setEditingSauce({ id: addon.id, name: addon.name, extra_price: addon.extra_price });
                              setIsSauceModalOpen(true);
                            }}
                            className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSauce('dept_addon', addon.id)}
                            className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          المودالات الديناميكية
          ======================================================== */}

      {/* مودال 1: إضافة / تعديل صنف */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="font-extrabold text-sm text-ink">
                {editingItem.id ? 'تعديل الصنف' : `إضافة صنف جديد لقسم ${currentDept?.name}`}
              </h4>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم الصنف:</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="مثال: وافل كلاسيك، كابتشينو، شاي كرك"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink outline-none focus:border-brand-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">وصف الصنف (اختياري):</label>
                <textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="وصف مكونات الصنف..."
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs text-ink outline-none focus:border-brand-700"
                />
              </div>

              {/* تبديل الأحجام المتعددة */}
              <div className="p-3 rounded-xl bg-surface-2/40 border border-line space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold text-xs text-ink block">أحجام وأسعار متعددة للصنف</span>
                    <span className="text-[10px] text-ink-muted block">
                      تفعيل خيارات مثل (سنجل / دبل أو صغير / وسط / كبير)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingItem.has_sizes}
                    onChange={(e) => setEditingItem({ ...editingItem, has_sizes: e.target.checked })}
                    className="rounded border-line text-brand-800"
                  />
                </label>

                {!editingItem.has_sizes ? (
                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">السعر الأساسي (ج.م):</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editingItem.base_price || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, base_price: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink outline-none focus:border-brand-700"
                    />
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 border-t border-line/60">
                    <span className="text-[11px] font-bold text-ink block">قائمة الأحجام والأسعار:</span>
                    {editingItem.sizes.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={s.name}
                          onChange={(e) => {
                            const updated = [...editingItem.sizes];
                            updated[sIdx].name = e.target.value;
                            setEditingItem({ ...editingItem, sizes: updated });
                          }}
                          placeholder="اسم الحجم (مثل: سنجل)"
                          className="flex-1 px-2.5 py-1 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
                        />
                        <input
                          type="number"
                          min={0}
                          required
                          value={s.price || ''}
                          onChange={(e) => {
                            const updated = [...editingItem.sizes];
                            updated[sIdx].price = Number(e.target.value);
                            setEditingItem({ ...editingItem, sizes: updated });
                          }}
                          placeholder="السعر ج.م"
                          className="w-24 px-2.5 py-1 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                        />
                        {editingItem.sizes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingItem.sizes.filter((_, i) => i !== sIdx);
                              setEditingItem({ ...editingItem, sizes: updated });
                            }}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem({
                          ...editingItem,
                          sizes: [...editingItem.sizes, { name: '', price: 0, is_default: false }],
                        });
                      }}
                      className="text-xs text-brand-800 font-bold hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>إضافة حجم إضافي</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold shadow-2xs"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال 2: بوكس دونتس موحد */}
      {isBoxModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="font-extrabold text-sm text-ink">حجم بوكس دونتس</h4>
              <button
                type="button"
                onClick={() => setIsBoxModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDonutBox} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">عدد القطع في البوكس:</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingBox.pieces || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, pieces: Number(e.target.value) })}
                  placeholder="مثال: 4، 6، 12"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس (دونتس عادي):</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingBox.regular_price || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, regular_price: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس (ميني دونتس):</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingBox.mini_price || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, mini_price: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس (دونتس حشو):</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editingBox.stuffed_price || ''}
                  onChange={(e) => setEditingBox({ ...editingBox, stuffed_price: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBoxModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold shadow-2xs"
                >
                  حفظ البوكس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال 3: صوص أو إضافة */}
      {isSauceModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="font-extrabold text-sm text-ink">
                {sauceType === 'stuffing'
                  ? 'صوص حشو الدونتس'
                  : sauceType === 'topping'
                  ? 'صوص توبنج الدونتس'
                  : `صوص / إضافة لقسم ${currentDept?.name}`}
              </h4>
              <button
                type="button"
                onClick={() => setIsSauceModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSauce} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">الاسم:</label>
                <input
                  type="text"
                  required
                  value={editingSauce.name}
                  onChange={(e) => setEditingSauce({ ...editingSauce, name: e.target.value })}
                  placeholder="مثال: نوتيلا، بستاشيو، لوتس، مكسرات"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  سعر إضافي إكسترا (0 لو مشمول مجاناً):
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingSauce.extra_price || ''}
                  onChange={(e) => setEditingSauce({ ...editingSauce, extra_price: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold font-mono text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsSauceModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold shadow-2xs"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال 4: إدارة القسم وتعديل خواصه */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h4 className="font-extrabold text-sm text-ink">
                {editingDept?.id ? 'تعديل بيانات القسم' : 'إضافة قسم جديد للمنظومة'}
              </h4>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم القسم:</label>
                <input
                  type="text"
                  required
                  value={editingDept?.name || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  placeholder="مثال: دونتس، وافل، مشروبات، بان كيك..."
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  نوع المعالجة واللوجك (Behavior):
                </label>
                <select
                  value={editingDept?.behavior || 'customizable'}
                  onChange={(e) =>
                    setEditingDept({
                      ...editingDept,
                      behavior: e.target.value as DepartmentBehavior,
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
                >
                  <option value="donut_box">🍩 تجميع بوكسات دونتس (قطع هندسية وصوصات وحشوات)</option>
                  <option value="customizable">🧇 صنف مخصص وصوصات (مثل الوافل والكريب مع صوصات وإضافات)</option>
                  <option value="simple">☕ أصناف سريعة ومباشرة (مثل المشروبات والقهوة مع أحجام)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-line/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingDept?.prints_labels)}
                    onChange={(e) => setEditingDept({ ...editingDept, prints_labels: e.target.checked })}
                    className="rounded border-line text-brand-800"
                  />
                  <div>
                    <span className="text-xs font-bold text-ink block">طباعة ملصقات آلية</span>
                    <span className="text-[10px] text-ink-muted block">
                      طباعة ملصق تحضير باركود عند إتمام كل أوردر تابع لهذا القسم
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                {editingDept?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeptModalOpen(false);
                      handleDeleteDept(editingDept.id!);
                    }}
                    className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent text-xs font-bold ml-auto"
                  >
                    حذف القسم
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold shadow-2xs"
                >
                  حفظ القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
