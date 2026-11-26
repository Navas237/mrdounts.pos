import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import {
  menuService,
  UnifiedDonutBoxSize,
  MenuOption,
} from '@/services/menu.service';
import { Department } from '@/types/database';
import { formatCurrency } from '@/utils/formatters';
import {
  Settings,
  UtensilsCrossed,
  Layers,
  CreditCard,
  Printer,
  Users,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  ChefHat,
  MapPin,
} from 'lucide-react';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { SectionsMenuManagement } from '@/components/admin/SectionsMenuManagement';
import { RecipesManagement } from '@/components/admin/RecipesManagement';
import { DeliveryZonesManagement } from '@/components/admin/DeliveryZonesManagement';
import { PaymentMethodsManagement } from '@/components/admin/PaymentMethodsManagement';

const TABS = [
  { id: 'donuts', label: 'هيكل وقواعد الدونتس', icon: Layers, perm: 'menu.manage' },
  { id: 'departments', label: 'الأقسام والمنيو', icon: UtensilsCrossed, perm: 'menu.manage' },
  { id: 'payments', label: 'طرق الدفع', icon: CreditCard, perm: 'settings.manage' },
  { id: 'zones', label: 'مناطق التوصيل', icon: MapPin, perm: 'settings.manage' },
  { id: 'recipes', label: 'الرسبي', icon: ChefHat, perm: 'menu.manage' },
  { id: 'printers', label: 'طابعات الأقسام', icon: Printer, perm: 'print.manage' },
  { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users, perm: 'users.manage' },
];

export const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('donuts');
  const { hasActionPermission } = usePermissions();
  const { branch } = useAuth();

  // الطابعات المسجلة فعلياً في قاعدة البيانات (تُجلب فقط عند فتح التبويب)
  const { data: printersList = [], isLoading: isPrintersLoading } = useQuery<any[]>({
    queryKey: ['printers', branch?.id || ''],
    enabled: activeTab === 'printers',
    queryFn: async () => {
      if (!isLiveSupabaseConfigured || !supabase) return [];
      let q = supabase
        .from('printers')
        .select('id, name, connection_type, ip_address, port, paper_width_mm, is_active')
        .order('created_at');
      if (branch?.id) q = q.eq('branch_id', branch.id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // الحالة الديناميكية للأقسام وبوكسات الدونتس الموحدة
  const [departments, setDepartments] = useState<Department[]>([]);
  const [unifiedBoxSizes, setUnifiedBoxSizes] = useState<UnifiedDonutBoxSize[]>([]);
  const [stuffingSauces, setStuffingSauces] = useState<MenuOption[]>([]);
  const [toppingSauces, setToppingSauces] = useState<MenuOption[]>([]);

  // تحكم بمودالات الإضافة والتعديل
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);

  const [isBoxSizeModalOpen, setIsBoxSizeModalOpen] = useState(false);
  const [editingUnifiedBox, setEditingUnifiedBox] = useState<Partial<UnifiedDonutBoxSize> | null>(null);

  const [isStuffingModalOpen, setIsStuffingModalOpen] = useState(false);
  const [editingStuffing, setEditingStuffing] = useState<Partial<MenuOption> | null>(null);

  const [isToppingModalOpen, setIsToppingModalOpen] = useState(false);
  const [editingTopping, setEditingTopping] = useState<Partial<MenuOption> | null>(null);

  // تحميل البيانات
  const loadData = async () => {
    setDepartments(menuService.getDepartmentsSync());
    setUnifiedBoxSizes(menuService.getUnifiedBoxSizesSync());
    setStuffingSauces(menuService.getStuffingSaucesSync());
    setToppingSauces(menuService.getToppingSaucesSync());

    const [depts, sizes, stuffings, toppings] = await Promise.all([
      menuService.getDepartments(),
      menuService.getUnifiedBoxSizes(),
      menuService.getStuffingSauces(),
      menuService.getToppingSauces(),
    ]);
    setDepartments(depts);
    setUnifiedBoxSizes(sizes);
    setStuffingSauces(stuffings);
    setToppingSauces(toppings);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      setDepartments(menuService.getDepartmentsSync());
      setUnifiedBoxSizes(menuService.getUnifiedBoxSizesSync());
      setStuffingSauces(menuService.getStuffingSaucesSync());
      setToppingSauces(menuService.getToppingSaucesSync());
    };
    window.addEventListener('mrdonuts:menu-updated', handleUpdate);
    return () => window.removeEventListener('mrdonuts:menu-updated', handleUpdate);
  }, []);

  // معالجات الأقسام
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
    setEditingDept(null);
  };

  // معالجات أحجام البوكسات الموحدة
  const handleSaveBoxSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnifiedBox || !editingUnifiedBox.pieces || editingUnifiedBox.pieces <= 0) return;
    await menuService.saveUnifiedBoxSize({
      pieces: editingUnifiedBox.pieces,
      regular_price: Number(editingUnifiedBox.regular_price) || 0,
      mini_price: Number(editingUnifiedBox.mini_price) || 0,
      stuffed_price: Number(editingUnifiedBox.stuffed_price) || 0,
    });
    setIsBoxSizeModalOpen(false);
    setEditingUnifiedBox(null);
  };

  const handleDeleteBoxSize = async (pieces: number) => {
    if (confirm(`هل أنت متأكد من حذف بوكس (${pieces} قطع) بكافة أسعاره؟`)) {
      await menuService.deleteUnifiedBoxSize(pieces);
    }
  };

  // معالجات صوصات الحشو (بدون ربط)
  const handleSaveStuffing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStuffing?.name) return;
    await menuService.saveStuffing({
      id: editingStuffing.id,
      name: editingStuffing.name,
      extra_price: Number(editingStuffing.extra_price) || 0,
    });
    setIsStuffingModalOpen(false);
    setEditingStuffing(null);
  };

  const handleDeleteStuffing = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحشو؟')) {
      await menuService.deleteStuffing(id);
    }
  };

  // معالجات صوصات التوبنج (بدون ربط)
  const handleSaveTopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopping?.name) return;
    await menuService.saveTopping({
      id: editingTopping.id,
      name: editingTopping.name,
      extra_price: Number(editingTopping.extra_price) || 0,
    });
    setIsToppingModalOpen(false);
    setEditingTopping(null);
  };

  const handleDeleteTopping = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التوبنج؟')) {
      await menuService.deleteTopping(id);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. الترويسة الرئيسية للوحة الإدارة */}
      <div className="p-3.5 rounded-xl bg-surface border border-line shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-800 text-white flex items-center justify-center font-bold shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">
              لوحة الإدارة والإعدادات الديناميكية
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-line text-xs font-bold text-ink flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-800" />
            <span>نظام الإدارة النشط</span>
          </span>
        </div>
      </div>

      {/* 2. تبويبات الإدارة الرئيسية النظيفة */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-line">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const canAccessTab = hasActionPermission(tab.perm as any);

          if (!canAccessTab) return null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-brand-800 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. محتوى التبويب المختار */}
      <div className="bg-surface rounded-xl border border-line p-3.5 sm:p-4 shadow-2xs space-y-4">
        
        {/* ========================================================
            التبويب الأساسي: هيكل وتسعير بوكسات الدونتس الموحد
            ======================================================== */}
        {activeTab === 'donuts' && (
          <div className="space-y-4">
            
            {/* أ. الترويسة الرئيسية للسكشن */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-ink">
                  إدارة أحجام وتسعير بوكسات الدونتس الموحدة
                </h3>
              </div>
            </div>

            {/* ب. السكشن 1: أحجام البوكسات والتسعير الشامل (عادي / ميني / حشو) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-ink">
                    1. أحجام البوكسات والتسعير الشامل ({unifiedBoxSizes.length} أحجام)
                  </h4>
                </div>

                <PermissionGate action="menu.manage">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnifiedBox({ pieces: 1, regular_price: 30, mini_price: 25, stuffed_price: 40 });
                      setIsBoxSizeModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة حجم بوكس</span>
                  </button>
                </PermissionGate>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {unifiedBoxSizes.length === 0 ? (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-line rounded-xl bg-surface-2/20">
                    <p className="text-xs font-bold text-ink">لا توجد أحجام بوكسات مضافة حتى الآن</p>
                    <p className="text-[11px] text-ink-muted mt-1">انقر على زر "إضافة حجم بوكس" لتحديد عدد القطع وسعر كل نوع (عادي / ميني / حشو)</p>
                  </div>
                ) : (
                  unifiedBoxSizes.map((box) => (
                    <div
                      key={box.pieces}
                      className="p-3 rounded-xl border border-line bg-surface-2/40 flex flex-col justify-between space-y-2.5 hover:border-brand-300 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-line/60 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-7 h-7 rounded-lg bg-brand-800 text-white font-mono font-black text-xs flex items-center justify-center">
                            {box.pieces}
                          </span>
                          <span className="text-xs text-ink font-bold">قطع</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnifiedBox({ ...box });
                              setIsBoxSizeModalOpen(true);
                            }}
                            className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                            title="تعديل الأسعار"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBoxSize(box.pieces)}
                            className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                            title="حذف الحجم"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* تفاصيل الأسعار الثلاثة للبوكس */}
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-1.5 rounded-lg bg-surface border border-line">
                          <span className="text-[10px] text-ink-muted block font-semibold">عادي</span>
                          <span className="text-xs font-black text-brand-800 font-mono">
                            {formatCurrency(box.regular_price)}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-surface border border-line">
                          <span className="text-[10px] text-ink-muted block font-semibold">ميني</span>
                          <span className="text-xs font-black text-emerald-700 font-mono">
                            {formatCurrency(box.mini_price)}
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-surface border border-line">
                          <span className="text-[10px] text-ink-muted block font-semibold">حشو</span>
                          <span className="text-xs font-black text-amber-700 font-mono">
                            {formatCurrency(box.stuffed_price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ج. السكشن 2: صوصات الحشو الداخلي والإكسترا */}
            <div className="space-y-2.5 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-ink">
                    2. صوصات الحشو الداخلي والإكسترا ({stuffingSauces.length} حشوات)
                  </h4>
                </div>

                <PermissionGate action="menu.manage">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStuffing({ name: '', extra_price: 0, is_available: true });
                      setIsStuffingModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صوص حشو</span>
                  </button>
                </PermissionGate>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {stuffingSauces.length === 0 ? (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-line rounded-xl bg-surface-2/20">
                    <p className="text-xs font-bold text-ink">لا توجد صوصات حشو مضافة</p>
                    <p className="text-[11px] text-ink-muted mt-1">انقر على زر "إضافة صوص حشو" لإضافة صوص حشو جديد</p>
                  </div>
                ) : (
                  stuffingSauces.map((stuffing) => (
                    <div
                      key={stuffing.id}
                      className="p-3 rounded-xl border border-line bg-surface-2/40 flex flex-col justify-between space-y-2.5 hover:border-brand-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm font-bold text-ink">
                          {stuffing.name}
                        </strong>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            stuffing.extra_price > 0
                              ? 'bg-brand-50 text-brand-800 border border-brand-200'
                              : 'bg-surface text-ink-muted border border-line'
                          }`}
                        >
                          {stuffing.extra_price > 0 ? `+${stuffing.extra_price}` : 'مشمول'}
                        </span>
                      </div>

                      {/* أزرار الإجراءات */}
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-line/60">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStuffing(stuffing);
                            setIsStuffingModalOpen(true);
                          }}
                          className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                          title="تعديل الحشو"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStuffing(stuffing.id)}
                          className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                          title="حذف الحشو"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* د. السكشن 3: صوصات التوبنج الخارجي والإكسترا */}
            <div className="space-y-2.5 pt-2 border-t border-line">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-ink">
                    3. صوصات التوبنج الخارجي والإكسترا ({toppingSauces.length} صوصات)
                  </h4>
                </div>

                <PermissionGate action="menu.manage">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTopping({ name: '', extra_price: 0, is_available: true });
                      setIsToppingModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صوص توبنج</span>
                  </button>
                </PermissionGate>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {toppingSauces.length === 0 ? (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-line rounded-xl bg-surface-2/20">
                    <p className="text-xs font-bold text-ink">لا توجد صوصات توبنج مضافة</p>
                    <p className="text-[11px] text-ink-muted mt-1">انقر على زر "إضافة صوص توبنج" لإضافة صوص جديد</p>
                  </div>
                ) : (
                  toppingSauces.map((topping) => (
                    <div
                      key={topping.id}
                      className="p-2.5 rounded-lg border border-line bg-surface-2/40 flex flex-col justify-between space-y-2 hover:border-brand-300 transition-colors"
                    >
                      <div>
                        <strong className="text-xs font-bold text-ink block truncate">
                          {topping.name}
                        </strong>
                        <span
                          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
                            topping.extra_price > 0
                              ? 'bg-brand-50 text-brand-800 border border-brand-200'
                              : 'bg-surface text-ink-muted border border-line'
                          }`}
                        >
                          {topping.extra_price > 0 ? `+${topping.extra_price}` : 'مشمول'}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-line/60">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTopping(topping);
                            setIsToppingModalOpen(true);
                          }}
                          className="p-1 rounded bg-surface hover:bg-surface-2 text-ink border border-line"
                          title="تعديل التوبنج"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopping(topping.id)}
                          className="p-1 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line"
                          title="حذف التوبنج"
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
        )}

        {/* ========================================================
            التبويب 2: الأقسام والمنيو ديناميكياً حسب لوجك كل سكشن
            ======================================================== */}
        {activeTab === 'departments' && (
          <SectionsMenuManagement
            departments={departments}
            onRefreshDepartments={loadData}
          />
        )}

        {/* ========================================================
            التبويب 3: طرق الدفع
            ======================================================== */}
        {activeTab === 'payments' && <PaymentMethodsManagement />}
        {activeTab === 'zones' && <DeliveryZonesManagement />}

        {activeTab === 'recipes' && <RecipesManagement />}

        {/* ========================================================
            التبويب 4: طابعات الأقسام
            ======================================================== */}
        {activeTab === 'printers' && (
          <div className="space-y-3">
            <div className="border-b border-line pb-2.5">
              <h3 className="text-sm font-extrabold text-ink">الطابعات المسجلة</h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                القائمة من جدول الطابعات في قاعدة البيانات. التطبيق لا يتحقق من اتصال الأجهزة الفعلي؛
                طباعة التقارير والإيصالات تتم عبر نافذة طباعة المتصفح.
              </p>
            </div>

            {isPrintersLoading ? (
              <p className="text-[11px] text-ink-muted">جاري التحميل...</p>
            ) : printersList.length === 0 ? (
              <div className="p-4 rounded-lg bg-surface-2/40 border border-line text-center space-y-1">
                <p className="text-xs font-bold text-ink">لا توجد طابعات مسجلة</p>
                <p className="text-[11px] text-ink-muted">
                  لم تُسجَّل أي طابعة في قاعدة البيانات لهذا الفرع بعد.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {printersList.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-surface-2/40 border border-line space-y-1">
                    <div className="font-extrabold text-xs text-brand-800">
                      {p.name} ({p.connection_type === 'lan' ? 'LAN' : p.connection_type === 'usb' ? 'USB' : 'بلوتوث'})
                    </div>
                    {p.ip_address && (
                      <div className="text-xs text-ink-muted font-mono">
                        IP: {p.ip_address} : {p.port ?? 9100}
                      </div>
                    )}
                    {p.paper_width_mm && (
                      <div className="text-[11px] text-ink-muted">ورق: {p.paper_width_mm}مم</div>
                    )}
                    <div className={`text-[11px] font-bold ${p.is_active ? 'text-ink' : 'text-ink-muted'}`}>
                      {p.is_active ? 'مسجلة ومفعّلة' : 'مسجلة وموقوفة'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            التبويب 5: المستخدمون والصلاحيات
            ======================================================== */}
        {activeTab === 'users' && (
          <UsersManagement departments={departments} />
        )}

      </div>

      {/* ========================================================
          مودال 1: إضافة / تعديل قسم
          ======================================================== */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-xl border border-line p-4 w-full max-w-md shadow-lg space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="font-extrabold text-sm text-ink">
                {editingDept?.id ? 'تعديل القسم' : 'إضافة قسم جديد'}
              </h4>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم القسم:</label>
                <input
                  type="text"
                  required
                  value={editingDept?.name || ''}
                  onChange={(e) => setEditingDept((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: دونتس، كريب، آيس كريم..."
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">نوع المعالجة في المطبخ والكاشير:</label>
                <select
                  value={editingDept?.behavior || 'customizable'}
                  onChange={(e) => setEditingDept((prev) => ({ ...prev, behavior: e.target.value as any }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink focus:border-brand-700 outline-none"
                >
                  <option value="donut_box">تجميع بوكسات دونتس (Donut Box)</option>
                  <option value="customizable">صنف مخصص بإضافات وصوصات (Customizable)</option>
                  <option value="simple">أصناف ومشروبات بسيطة (Simple)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="print_labels_chk"
                  checked={Boolean(editingDept?.prints_labels)}
                  onChange={(e) => setEditingDept((prev) => ({ ...prev, prints_labels: e.target.checked }))}
                  className="rounded border-line"
                />
                <label htmlFor="print_labels_chk" className="text-xs font-bold text-ink cursor-pointer">
                  طباعة ملصقات تلقائياً لهذا القسم
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-bold hover:bg-brand-900"
                >
                  حفظ القسم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          مودال 2: إضافة / تعديل حجم بوكس وتسعيره الشامل
          ======================================================== */}
      {isBoxSizeModalOpen && editingUnifiedBox && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-xl border border-line p-4 w-full max-w-sm shadow-lg space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="font-extrabold text-sm text-ink">
                إضافة / تعديل حجم بوكس وتسعيره الشامل
              </h4>
              <button
                type="button"
                onClick={() => setIsBoxSizeModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBoxSize} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">عدد قطع البوكس:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={editingUnifiedBox.pieces || ''}
                  onChange={(e) => setEditingUnifiedBox((prev) => ({ ...prev, pieces: parseInt(e.target.value) || 0 }))}
                  placeholder="مثال: 1، 3، 6، 12..."
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس عادي (Regular):</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editingUnifiedBox.regular_price ?? ''}
                  onChange={(e) => setEditingUnifiedBox((prev) => ({ ...prev, regular_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس ميني (Mini):</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editingUnifiedBox.mini_price ?? ''}
                  onChange={(e) => setEditingUnifiedBox((prev) => ({ ...prev, mini_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">سعر البوكس محشو (Stuffed):</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editingUnifiedBox.stuffed_price ?? ''}
                  onChange={(e) => setEditingUnifiedBox((prev) => ({ ...prev, stuffed_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBoxSizeModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-bold hover:bg-brand-900"
                >
                  حفظ الحجم والتسعير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          مودال 3: إضافة / تعديل صوص حشو
          ======================================================== */}
      {isStuffingModalOpen && editingStuffing && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-xl border border-line p-4 w-full max-w-sm shadow-lg space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="font-extrabold text-sm text-ink">
                {editingStuffing.id ? 'تعديل صوص الحشو' : 'إضافة صوص حشو جديد'}
              </h4>
              <button
                type="button"
                onClick={() => setIsStuffingModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStuffing} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم صوص الحشو:</label>
                <input
                  type="text"
                  required
                  value={editingStuffing.name || ''}
                  onChange={(e) => setEditingStuffing((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: كيندر كريمي، نوتيلا، لوتس..."
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">رسوم الإكسترا بالجنيه (0 = مشمول مجاناً):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingStuffing.extra_price ?? ''}
                  onChange={(e) => setEditingStuffing((prev) => ({ ...prev, extra_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsStuffingModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-bold hover:bg-brand-900"
                >
                  حفظ الحشو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          مودال 4: إضافة / تعديل صوص توبنج
          ======================================================== */}
      {isToppingModalOpen && editingTopping && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-surface rounded-xl border border-line p-4 w-full max-w-sm shadow-lg space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="font-extrabold text-sm text-ink">
                {editingTopping.id ? 'تعديل صوص التوبنج' : 'إضافة صوص توبنج جديد'}
              </h4>
              <button
                type="button"
                onClick={() => setIsToppingModalOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTopping} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">اسم صوص التوبنج:</label>
                <input
                  type="text"
                  required
                  value={editingTopping.name || ''}
                  onChange={(e) => setEditingTopping((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: صوص فستق، كراميل، شوكولاتة..."
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink focus:border-brand-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">رسوم الإكسترا بالجنيه (0 = مشمول مجاناً):</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingTopping.extra_price ?? ''}
                  onChange={(e) => setEditingTopping((prev) => ({ ...prev, extra_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink font-mono focus:border-brand-700 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsToppingModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-bold hover:bg-brand-900"
                >
                  حفظ التوبنج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
