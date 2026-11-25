import React, { useState, useMemo } from 'react';
import { DonutPieceItem } from '@/types/order';
import { DonutBoxConfig } from '@/services/menu.service';
import {
  RotateCcw,
  Check,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';

interface DonutPieceGridProps {
  pieces: DonutPieceItem[];
  config: DonutBoxConfig;
  piecesCount: number;
  toppingsCount: number;
  stuffingsCount: number;
  onApplyTopping: (pieceIndex: number, toppingId: string, count: number) => void;
  onApplyStuffing: (pieceIndex: number, stuffingId: string, count: number) => void;
  onClearPieceTopping: (pieceIndex: number) => void;
  onClearPieceStuffing: (pieceIndex: number) => void;
  onResetBox: () => void;
  onSetAllRemainingStuffingToPlain: () => void;
  getAvailableToppingCountFrom: (pieceIndex: number) => number;
  getAvailableStuffingCountFrom: (pieceIndex: number) => number;
}

interface PickerState {
  isOpen: boolean;
  type: 'topping' | 'stuffing';
  pieceIndex: number;
  selectedCount: number;
}

export const DonutPieceGrid: React.FC<DonutPieceGridProps> = ({
  pieces,
  config,
  piecesCount,
  toppingsCount,
  stuffingsCount,
  onApplyTopping,
  onApplyStuffing,
  onClearPieceTopping,
  onClearPieceStuffing,
  onResetBox,
  onSetAllRemainingStuffingToPlain,
  getAvailableToppingCountFrom,
  getAvailableStuffingCountFrom,
}) => {
  // حالة مودال الاختيار السريع للصوص
  const [picker, setPicker] = useState<PickerState | null>(null);

  // فتح المودال مع ضبط عدد القطع الافتراضي = 1
  const handleOpenPicker = (type: 'topping' | 'stuffing', pieceIndex: number) => {
    setPicker({
      isOpen: true,
      type,
      pieceIndex,
      selectedCount: 1, // الديفلت 1 كما طلب العميل
    });
  };

  const handleClosePicker = () => {
    setPicker(null);
  };

  // اختيار صوص مع الإغلاق التلقائي الفوري للمودال
  const handleSelectSauce = (sauceId: string) => {
    if (!picker) return;
    const { type, pieceIndex, selectedCount } = picker;

    if (type === 'topping') {
      onApplyTopping(pieceIndex, sauceId, selectedCount);
    } else {
      onApplyStuffing(pieceIndex, sauceId, selectedCount);
    }

    // إغلاق المودال فوراً بعد النقر
    handleClosePicker();
  };

  // أقصى عدد متاح للتطبيق عليه من القطعة الحالية
  const maxAvailableCount = useMemo(() => {
    if (!picker) return 1;
    if (picker.type === 'topping') {
      return getAvailableToppingCountFrom(picker.pieceIndex);
    }
    return getAvailableStuffingCountFrom(picker.pieceIndex);
  }, [picker, getAvailableToppingCountFrom, getAvailableStuffingCountFrom]);

  // شبكة فائقة الضغط (Ultra-Compact) لتناسب مساحة الشاشة بالكامل بأقل ارتفاع ممكن
  const gridLayoutClass = useMemo(() => {
    switch (piecesCount) {
      case 1:
        return 'grid grid-cols-1 max-w-[280px] mx-auto gap-1.5';
      case 2:
        return 'grid grid-cols-2 max-w-[420px] mx-auto gap-1.5';
      case 3:
        return 'grid grid-cols-3 max-w-[700px] mx-auto gap-1.5';
      case 4:
        return 'grid grid-cols-4 max-w-[800px] mx-auto gap-1.5';
      case 6:
        return 'grid grid-cols-8 gap-1 sm:gap-1.5';
      case 8:
        return 'grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-1.5';
      case 10:
        return 'grid grid-cols-10 gap-1 sm:gap-1.5';
      case 12:
        // صفين من 6 أعمدة بارتفاع فائق الضغط
        return 'grid grid-cols-12 gap-1 sm:gap-1.5';
      default:
        return 'grid grid-cols-4 sm:grid-cols-12 gap-1.5';
    }
  }, [piecesCount]);

  return (
    <div className="space-y-1.5">
      {/* 1. شريط إحصاءات البوكس فائق الصغر */}
      <div className="flex items-center justify-between gap-1.5 px-0.5 text-xs leading-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-black text-ink text-xs">
            البوكس ({piecesCount} قطع):
          </span>

          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
              toppingsCount === piecesCount
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-surface text-ink-muted border-line'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-brand-700" />
            <span>توبنج:</span>
            <strong className="font-mono">{toppingsCount}/{piecesCount}</strong>
          </span>

          {config.type !== 'regular' && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                stuffingsCount === piecesCount
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-surface text-ink-muted border-line'
              }`}
            >
              <Layers className="w-2.5 h-2.5 text-stone-700" />
              <span>حشو:</span>
              <strong className="font-mono">{stuffingsCount}/{piecesCount}</strong>
            </span>
          )}
        </div>

        {/* أزرار سريعة */}
        <div className="flex items-center gap-1.5">
          {config.type === 'mini' && stuffingsCount < piecesCount && (
            <button
              type="button"
              onClick={onSetAllRemainingStuffingToPlain}
              className="text-[10px] font-bold text-brand-800 hover:text-brand-900 hover:underline transition-colors cursor-pointer"
              title="تحديد كل القطع التي ليس لها حشو كسادة"
            >
              سادة للكل (توبنج فقط)
            </button>
          )}

          {(toppingsCount > 0 || stuffingsCount > 0) && (
            <button
              type="button"
              onClick={onResetBox}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors flex items-center gap-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>تفريغ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. شبكة القطع فائقة الصغر (Ultra-Compact Cards) */}
      {pieces.length === 0 ? (
        <div className="py-6 text-center border-2 border-dashed border-line rounded-xl bg-surface-2/20">
          <p className="text-xs font-bold text-ink">لم يتم اختيار حجم للبوكس أو لا توجد أحجام مضافة</p>
          <p className="text-[11px] text-ink-muted mt-1">اختر عدد القطع أعلاه أو أضف أحجام بوكسات جديدة من لوحة الإدارة</p>
        </div>
      ) : (
        <div className={gridLayoutClass}>
        {pieces.map((piece, idx) => {
          const hasTopping = Boolean(piece.topping_sauce_id);
          const hasStuffing = config.type !== 'regular' && Boolean(piece.stuffing_sauce_id);
          const isPieceComplete = config.type === 'regular' ? hasTopping : (hasTopping && hasStuffing);

          return (
            <div
              key={piece.piece_number}
              className={`rounded-lg border transition-all p-1 space-y-1 flex flex-col justify-between ${
                isPieceComplete
                  ? 'border-emerald-300 bg-surface shadow-2xs'
                  : hasTopping || hasStuffing
                  ? 'border-brand-200 bg-surface shadow-2xs'
                  : 'border-dashed border-stone-300 dark:border-stone-700 bg-surface-2/20'
              }`}
            >
              {/* الكارت العلوي: التوبنج */}
              <button
                type="button"
                onClick={() => handleOpenPicker('topping', idx)}
                className={`w-full h-[26px] sm:h-7 px-1.5 py-8 rounded text-[14px] font-bold transition-all flex items-center justify-between gap-1 text-right truncate cursor-pointer ${
                  hasTopping
                    ? 'bg-brand-50/70 border border-brand-700 text-brand-950 font-black shadow-2xs hover:bg-brand-50'
                    : 'border border-dashed border-stone-300 dark:border-stone-700 bg-surface hover:border-brand-600 hover:bg-brand-50/20 text-stone-600 dark:text-stone-300'
                }`}
                title={hasTopping ? `توبنج: ${piece.topping_sauce_name}` : 'اضغط لاختيار التوبنج'}
              >
                <span className="truncate">
                  {hasTopping ? piece.topping_sauce_name : ' التوبنج'}
                </span>
                {hasTopping ? (
                  <Check className="w-2.5 h-2.5 text-brand-700 shrink-0 stroke-[3]" />
                ) : (
                  <span className="text-[9px] text-stone-400 shrink-0 font-normal">توبنج</span>
                )}
              </button>

              {/* الكارت السفلي: الحشو (يختفي تماماً في الدونتس العادي ويظهر فقط للميني والحشو) */}
              {config.type !== 'regular' && (
                <button
                  type="button"
                  onClick={() => handleOpenPicker('stuffing', idx)}
                  className={`w-full h-[26px] sm:h-7 px-1.5 rounded text-[14px] py-8 font-bold transition-all flex items-center justify-between gap-1 text-right truncate cursor-pointer ${
                    hasStuffing && piece.stuffing_sauce_id !== 'plain'
                      ? 'bg-stone-100/90 dark:bg-stone-800 border border-stone-700 dark:border-stone-600 text-ink font-black shadow-2xs hover:bg-stone-100'
                      : piece.stuffing_sauce_id === 'plain'
                      ? 'bg-stone-50 border border-stone-300 text-stone-600 font-bold'
                      : 'border border-dashed border-stone-300 dark:border-stone-700 bg-surface hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-600 dark:text-stone-300'
                  }`}
                  title={hasStuffing ? `حشو: ${piece.stuffing_sauce_name}` : 'اضغط لاختيار الحشو'}
                >
                  <span className="truncate">
                    {hasStuffing ? piece.stuffing_sauce_name : ' الحشو'}
                  </span>
                  {hasStuffing ? (
                    <Check className="w-2.5 h-2.5 text-stone-700 shrink-0 stroke-[3]" />
                  ) : (
                    <span className="text-[9px] text-stone-400 shrink-0 font-normal">حشو</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* ==========================================================
          3. مودال الاختيار السريع للصوص (1-Tap Fast Modal)
          ========================================================== */}
      {picker && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={handleClosePicker}
        >
          <div
            className="bg-surface border border-line rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ترويسة المودال */}
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div>
                <h3 className="text-sm sm:text-base font-black text-ink flex items-center gap-1.5">
                  {picker.type === 'topping' ? (
                    <>
                      <Sparkles className="w-4 h-4 text-brand-700" />
                      <span>اختيار التوبنج — قطعة {picker.pieceIndex + 1}</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4 text-stone-700" />
                      <span>اختيار الحشو — قطعة {picker.pieceIndex + 1}</span>
                    </>
                  )}
                </h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  انقر على الصوص وسيتم تطبيقه وإغلاق النافذة فوراً
                </p>
              </div>

              <button
                type="button"
                onClick={handleClosePicker}
                className="p-1 rounded-lg border border-line hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* محدد التطبيق المتعدد: تطبيق على كم قطعة متبقية؟ */}
            {maxAvailableCount > 1 && (
              <div className="p-2.5 rounded-xl border border-line bg-surface-2/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-ink text-[11px] sm:text-xs">
                    تطبيق نفس الصوص على:
                  </span>
                  <span className="text-ink-muted text-[10px]">
                    (متبقي {maxAvailableCount} قطع)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from({ length: maxAvailableCount }, (_, i) => i + 1).map((num) => {
                    const isSelected = picker.selectedCount === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPicker({ ...picker, selectedCount: num })}
                        className={`h-7 sm:h-8 px-2.5 rounded-lg text-xs font-black border transition-all font-mono flex items-center justify-center ${
                          isSelected
                            ? 'border-brand-700 bg-brand-700 text-white shadow-2xs'
                            : 'border-line bg-surface text-ink hover:bg-surface-3'
                        }`}
                      >
                        {num} {num === 1 ? 'قطعة' : 'قطع'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* شبكة الصوصات المتاحة */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-ink-muted block">
                {picker.type === 'topping' ? 'اختر صوص التوبنج:' : 'اختر نوع الحشو:'}
              </span>

              {picker.type === 'topping' ? (
                /* صوصات التوبنج (الـ 9 صوصات) */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {config.toppingSauces.map((sauce) => (
                    <button
                      key={sauce.id}
                      type="button"
                      onClick={() => handleSelectSauce(sauce.id)}
                      className="p-2.5 rounded-xl border border-line bg-surface hover:border-brand-700 hover:bg-brand-50/25 text-right transition-all flex flex-col justify-between min-h-[54px] shadow-2xs active:scale-95 cursor-pointer group"
                    >
                      <span className="text-xs sm:text-sm font-black text-ink group-hover:text-brand-900 leading-tight">
                        {sauce.name}
                      </span>
                      <span className="text-[10px] font-bold text-ink-muted mt-1 block">
                        {sauce.extra_price > 0 ? `+${sauce.extra_price}` : 'شامل'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                /* صوصات الحشو */
                <div className="grid grid-cols-2 gap-2">
                  {/* خيار سادة (متاح فقط للدونتس الميني) */}
                  {config.type === 'mini' && (
                    <button
                      type="button"
                      onClick={() => handleSelectSauce('plain')}
                      className="p-2.5 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-surface hover:border-stone-600 hover:bg-stone-50 text-right transition-all flex flex-col justify-between min-h-[54px] shadow-2xs active:scale-95 col-span-2 sm:col-span-1 cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-black text-ink leading-tight block">
                        سادة (بدون حشو)
                      </span>
                      <span className="text-[10px] text-stone-500 mt-1 block">
                        توبنج فقط
                      </span>
                    </button>
                  )}

                  {/* صوصات الحشو الأساسية */}
                  {config.stuffingSauces
                    .filter((s) => s.id !== 'st-plain')
                    .map((sauce) => (
                      <button
                        key={sauce.id}
                        type="button"
                        onClick={() => handleSelectSauce(sauce.id)}
                        className="p-2.5 rounded-xl border border-line bg-surface hover:border-brand-700 hover:bg-brand-50/25 text-right transition-all flex flex-col justify-between min-h-[54px] shadow-2xs active:scale-95 cursor-pointer group"
                      >
                        <span className="text-xs sm:text-sm font-black text-ink group-hover:text-brand-900 leading-tight">
                          {sauce.name}
                        </span>
                        <span className="text-[10px] font-bold text-ink-muted mt-1 block">
                          +{sauce.extra_price}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* تذييل المودال */}
            <div className="pt-2 border-t border-line flex items-center justify-between">
              <button
                type="button"
                onClick={handleClosePicker}
                className="px-3 py-1 rounded-lg border border-line text-xs font-bold text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
              >
                إلغاء
              </button>

              {/* زر مسح الصوص إن وجد */}
              {picker.type === 'topping' && pieces[picker.pieceIndex]?.topping_sauce_id && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPieceTopping(picker.pieceIndex);
                    handleClosePicker();
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded transition-colors"
                >
                  إزالة التوبنج
                </button>
              )}

              {picker.type === 'stuffing' && pieces[picker.pieceIndex]?.stuffing_sauce_id && (
                <button
                  type="button"
                  onClick={() => {
                    onClearPieceStuffing(picker.pieceIndex);
                    handleClosePicker();
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded transition-colors"
                >
                  إزالة الحشو
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
