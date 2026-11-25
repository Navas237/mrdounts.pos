import React, { useState, useEffect } from 'react';
import { useMenu } from '@/hooks/useMenu';
import { useCart } from '@/hooks/useCart';
import { useDonutBuilder } from '@/hooks/useDonutBuilder';
import { DonutPieceGrid } from '@/components/shared/DonutPieceGrid';
import { CartBottomSection } from '@/components/shared/CartBottomSection';
import { formatCurrency } from '@/utils/formatters';
import {
  Plus,
  Layers,
  Coffee,
  ShoppingCart,
  Flame,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { menuService, MenuOption, MenuItem, MenuItemSize } from '@/services/menu.service';

export const Cashier: React.FC = () => {
  const { addItem, items } = useCart();
  const [selectedDeptId, setSelectedDeptId] = useState<string>('d-donuts');

  const { departments, menuItems, isLoading } = useMenu(selectedDeptId);
  const currentDept = departments.find((d) => d.id === selectedDeptId);

  // التحقق الذكي من قسم الدونتس بالـ behavior أو الاسم أو الـ id
  const isDonutBox = currentDept
    ? currentDept.behavior === 'donut_box' || currentDept.name.includes('دونت')
    : selectedDeptId === 'd-donuts';

  // مزامنة واختيار أول قسم أو قسم الدونتس تلقائياً عند تحميل الأقسام
  useEffect(() => {
    if (departments.length > 0) {
      const exists = departments.some((d) => d.id === selectedDeptId);
      if (!exists) {
        const donutDept = departments.find(
          (d) => d.behavior === 'donut_box' || d.id === 'd-donuts' || d.name.includes('دونت')
        );
        setSelectedDeptId(donutDept ? donutDept.id : departments[0].id);
      }
    }
  }, [departments, selectedDeptId]);

  // حالة تخصيص الأصناف للوافل وما شابهه (Customizable Items Modal)
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customizingSize, setCustomizingSize] = useState<MenuItemSize | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<MenuOption[]>([]);
  const [availableDeptAddons, setAvailableDeptAddons] = useState<MenuOption[]>([]);

  // تحميل إضافات وصوصات القسم عند تغيير القسم
  useEffect(() => {
    if (selectedDeptId && !isDonutBox) {
      const addons = menuService.getDepartmentOptionsSync(selectedDeptId);
      setAvailableDeptAddons(addons);
    } else {
      setAvailableDeptAddons([]);
    }
  }, [selectedDeptId, isDonutBox]);

  // باني بوكسات الدونتس التفاعلي
  const donutBuilder = useDonutBuilder((cartItem) => {
    addItem(cartItem);
  });

  // اختصار F2 لإضافة البوكس المكتمل للسلة وتفريغ الصوصات
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (isDonutBox && donutBuilder.isBoxComplete) {
          donutBuilder.handleAddToCart();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDonutBox, donutBuilder]);

  const totalCartCount = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="space-y-3.5">
      
      {/* 1. شريط الأقسام الرئيسي الكبير والتكتيكي (Category Ribbon) */}
      <div className="flex items-center  gap-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1">
          {departments.map((dept) => {
            const isSelected = selectedDeptId === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDeptId(dept.id)}
                className={`py-3 px-3 sm:px-5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-98 ${
                  isSelected
                    ? 'bg-brand-700 text-white ring-2 ring-brand-700/25 shadow-xs'
                    : 'bg-surface hover:bg-surface-2 text-ink border border-line'
                }`}
              >
                {dept.behavior === 'donut_box' && <Layers className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.2]" />}
                {dept.behavior === 'customizable' && <Flame className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.2]" />}
                {dept.behavior === 'simple' && <Coffee className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 stroke-[2.2]" />}
                <span className="truncate">{dept.name}</span>
              </button>
            );
          })}
        </div>

        {/* مؤشر عدد أصناف السلة سريع */}
        <div className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-surface border border-line text-ink text-xs font-bold shrink-0 shadow-2xs">
          <ShoppingCart className="w-4 h-4 text-brand-700" />
          <span className="font-mono font-extrabold">({totalCartCount})</span>
        </div>
      </div>

      {/* 2. مساحة العمل بعرض الشاشة بالكامل: باني الدونتس أو قائمة الوافل والمشروبات */}
      <div className="w-full space-y-3.5">
          
          {/* ========================================================
              أولاً: قسم الدونتس وباني البوكسات التفاعلي
              ======================================================== */}
          {isDonutBox && (
            <div className="rounded-xl border border-line bg-surface p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
              
              {/* شريط التحكم السريع بحجم ونوع البوكس */}
              <div className="rounded-xl border border-line bg-surface-2 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                
                {/* نوع الدونتس: عادي أو ميني أو حشو */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs sm:text-sm font-extrabold text-ink shrink-0">
                    نوع الدونتس:
                  </span>
                  <div className="flex gap-1 bg-surface p-1 rounded-lg border border-line">
                    <button
                      type="button"
                      onClick={() => donutBuilder.setDonutType('regular')}
                      className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                        donutBuilder.donutType === 'regular'
                          ? 'bg-brand-700 text-white shadow-2xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      عادي
                    </button>
                    <button
                      type="button"
                      onClick={() => donutBuilder.setDonutType('mini')}
                      className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                        donutBuilder.donutType === 'mini'
                          ? 'bg-brand-700 text-white shadow-2xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      ميني
                    </button>
                    <button
                      type="button"
                      onClick={() => donutBuilder.setDonutType('stuffed')}
                      className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                        donutBuilder.donutType === 'stuffed'
                          ? 'bg-brand-700 text-white shadow-2xs'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      حشو
                    </button>
                  </div>
                </div>

                {/* حجم البوكس: عدد القطع بأزرار كبيرة ومريحة ديناميكياً من الإدارة */}
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-ink shrink-0">
                    عدد القطع:
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {donutBuilder.config.availableSizes.length === 0 ? (
                      <span className="text-xs text-ink-muted">
                        لا توجد أحجام مسجلة (أضف من لوحة الإدارة)
                      </span>
                    ) : (
                      donutBuilder.config.availableSizes.map((count) => {
                        const isSelected = donutBuilder.piecesCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => donutBuilder.setPiecesCount(count)}
                            className={`w-9 sm:w-10 h-8 sm:h-9 rounded-lg text-xs sm:text-sm font-extrabold border transition-all flex items-center justify-center font-mono ${
                              isSelected
                                ? 'border-brand-700 bg-brand-700 text-white shadow-2xs'
                                : 'border-line bg-surface text-ink hover:bg-surface-3'
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* شبكة قطع الدونتس الهندسية المدمجة واختيار الصوصات السريع */}
              <DonutPieceGrid
                pieces={donutBuilder.pieces}
                config={donutBuilder.config}
                piecesCount={donutBuilder.piecesCount}
                toppingsCount={donutBuilder.toppingsCount}
                stuffingsCount={donutBuilder.stuffingsCount}
                onApplyTopping={donutBuilder.applyToppingToPieces}
                onApplyStuffing={donutBuilder.applyStuffingToPieces}
                onClearPieceTopping={donutBuilder.clearPieceTopping}
                onClearPieceStuffing={donutBuilder.clearPieceStuffing}
                onResetBox={donutBuilder.resetEntireBox}
                onSetAllRemainingStuffingToPlain={donutBuilder.setAllRemainingStuffingToPlain}
                getAvailableToppingCountFrom={donutBuilder.getAvailableToppingCountFrom}
                getAvailableStuffingCountFrom={donutBuilder.getAvailableStuffingCountFrom}
              />

              {/* شريط الإضافة للسلة وحساب السعر النهائي */}
              <div className="pt-3.5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5 text-center sm:text-right">
                  <div className="text-ink text-xs flex items-center gap-2 justify-center sm:justify-start">
                    <span className='text-[15px]'>الأساسي: {formatCurrency(donutBuilder.boxBasePrice)}</span>
                    {donutBuilder.totalExtraFees > 0 && (
                      <span className="text-brand-700 font-bold text-ink">
                        + إكسترا صوصات: {formatCurrency(donutBuilder.totalExtraFees)}
                      </span>
                    )}
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold text-brand-700 font-mono">
                    إجمالي البوكس: {formatCurrency(donutBuilder.totalBoxPrice)}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!donutBuilder.isBoxComplete}
                  onClick={donutBuilder.handleAddToCart}
                  className="w-full sm:w-auto py-3 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {donutBuilder.isBoxComplete
                      ? 'إضافة البوكس للسلة (F2)'
                      : 'يرجى إكمال اختيار صوصات كافة القطع'}
                  </span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================
              ثانياً: قسم الوافل والمشروبات والأقسام الأخرى
              ======================================================== */}
          {!isDonutBox && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line">
                  جاري تحميل الأصناف...
                </div>
              ) : menuItems.length === 0 ? (
                <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-dashed border-line">
                  لا توجد أصناف مضافة لهذا القسم بعد. يمكنك إضافة الأصناف والأسعار من لوحة الإدارة والمنيو.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {menuItems.map((item) => {
                    const isCustomizable = currentDept?.behavior === 'customizable';
                    const deptName = currentDept?.name || 'قسم عام';

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-line bg-surface hover:border-line-strong hover:shadow-2xs transition-all flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-extrabold text-xs sm:text-sm text-ink">{item.name}</h3>
                            <span className="text-xs sm:text-sm font-extrabold text-brand-700 font-mono shrink-0">
                              {formatCurrency(item.base_price)}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-ink-muted mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* أحجام الصنف إن وجدت */}
                        {item.sizes.length > 1 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.sizes.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  if (isCustomizable && availableDeptAddons.length > 0) {
                                    setCustomizingItem(item);
                                    setCustomizingSize(s);
                                    setSelectedAddons([]);
                                  } else {
                                    addItem({
                                      cart_id: `item-${Date.now()}-${item.id}-${s.id}`,
                                      department_id: item.department_id,
                                      department_name: deptName,
                                      is_donut_box: false,
                                      item_id: item.id,
                                      item_name: item.name,
                                      size_id: s.id,
                                      size_name: s.name,
                                      unit_price: s.price,
                                      quantity: 1,
                                      options: [],
                                      line_total: s.price,
                                    });
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-brand-700 hover:text-white text-xs font-bold text-ink border border-line transition-colors cursor-pointer"
                              >
                                {s.name}: {formatCurrency(s.price)} +
                              </button>
                            ))}
                          </div>
                        )}

                        {/* زر الإضافة السريعة أو التخصيص للأصناف الفردية */}
                        {item.sizes.length <= 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isCustomizable && availableDeptAddons.length > 0) {
                                setCustomizingItem(item);
                                setCustomizingSize(item.sizes[0] || null);
                                setSelectedAddons([]);
                              } else {
                                addItem({
                                  cart_id: `item-${Date.now()}-${item.id}`,
                                  department_id: item.department_id,
                                  department_name: deptName,
                                  is_donut_box: false,
                                  item_id: item.id,
                                  item_name: item.name,
                                  unit_price: item.base_price,
                                  quantity: 1,
                                  options: [],
                                  line_total: item.base_price,
                                });
                              }
                            }}
                            className={`w-full py-2 px-3 rounded-lg border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                              isCustomizable
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-surface-2 hover:bg-brand-700 hover:text-white text-ink border-line'
                            }`}
                          >
                            {isCustomizable ? (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                                <span>تخصيص الصوصات والإضافة</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                                <span>إضافة للأوردر</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

      </div>

      {/* ========================================================
          مودال تخصيص الصنف (للوافل والأقسام المخصصة Customizable)
          ======================================================== */}
      {customizingItem && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h4 className="font-extrabold text-sm sm:text-base text-ink">
                  تخصيص: {customizingItem.name}
                </h4>
                <span className="text-[11px] text-ink-muted">
                  قسم {currentDept?.name} — حدد الحجم والصوصات والإضافات المطلوبة
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="p-1 rounded text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. اختيار الحجم إن وجد */}
            {customizingItem.sizes.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-ink block">الحجم:</span>
                <div className="flex flex-wrap gap-2">
                  {customizingItem.sizes.map((s) => {
                    const isSelected = customizingSize?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setCustomizingSize(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-800 text-white border-brand-800 shadow-2xs'
                            : 'bg-surface hover:bg-surface-2 text-ink border-line'
                        }`}
                      >
                        {s.name} ({formatCurrency(s.price)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. اختيار الصوصات والإضافات التابعة للقسم */}
            {availableDeptAddons.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-line/60">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>الصوصات والإضافات المتاحة:</span>
                </span>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableDeptAddons.map((addon) => {
                    const isSelected = selectedAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
                          } else {
                            setSelectedAddons([...selectedAddons, addon]);
                          }
                        }}
                        className={`p-2 rounded-xl text-right border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-brand-50 border-brand-800 text-brand-900 shadow-2xs'
                            : 'bg-surface-2/40 hover:bg-surface-2 border-line text-ink'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold block">{addon.name}</span>
                          <span className="text-[10px] text-ink-muted font-mono block">
                            {addon.extra_price > 0 ? `+ ${formatCurrency(addon.extra_price)}` : 'مجاناً'}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-brand-800" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* السعر الإجمالي وزر الإضافة */}
            <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] text-ink-muted block">الإجمالي:</span>
                <span className="text-base sm:text-lg font-extrabold text-brand-800 font-mono">
                  {formatCurrency(
                    (customizingSize ? customizingSize.price : customizingItem.base_price) +
                      selectedAddons.reduce((sum, a) => sum + (a.extra_price || 0), 0)
                  )}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const unitPrice = customizingSize ? customizingSize.price : customizingItem.base_price;
                  const addonsExtra = selectedAddons.reduce((sum, a) => sum + (a.extra_price || 0), 0);
                  const lineTotal = unitPrice + addonsExtra;

                  addItem({
                    cart_id: `custom-${Date.now()}-${customizingItem.id}`,
                    department_id: customizingItem.department_id,
                    department_name: currentDept?.name || 'قسم عام',
                    is_donut_box: false,
                    item_id: customizingItem.id,
                    item_name: customizingItem.name,
                    size_id: customizingSize?.id,
                    size_name: customizingSize?.name,
                    unit_price: unitPrice,
                    quantity: 1,
                    options: selectedAddons.map((a) => ({
                      option_id: a.id,
                      name: a.name,
                      extra_price: a.extra_price,
                    })),
                    line_total: lineTotal,
                  });

                  setCustomizingItem(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-900 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة للأوردر</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          3. سلة الأوردر والحساب بعرض الشاشة بالكامل في الأسفل (Full Width Bottom Cart)
          ديناميكية حسب نوع الأوردر:
          - لو ديليفري أو استلام: 4 أصناف في الصف + قسم بيانات العميل والتوصيل
          - لو صالة أو تيك أواي: جزء واحد كامل و 6 أصناف في الصف
          ======================================================== */}
      <CartBottomSection />

    </div>
  );
};
