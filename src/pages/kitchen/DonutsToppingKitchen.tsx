import React, { useState } from 'react';
import { useDonutTopping } from '@/hooks/useKitchen';
import { useStationPause } from '@/hooks/useStationPause';
import { formatTime } from '@/utils/formatters';
import {
  CheckCircle2,
  Clock,
  Check,
  Search,
  Package,
  PauseCircle,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { DonutToppingBox, DonutToppingOrder } from '@/services/kitchen.service';

export const DonutsToppingKitchen: React.FC = () => {
  const { orders, isLoading, isError, refetch, toggleBoxReady, toggleError, resetToggleError, finishOrder, finishError, resetFinishError, isFinishing } = useDonutTopping();
  const { isPaused, pausedAt, togglePause } = useStationPause('donut_topping');

  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (isLoading) {
    return (
      <div className="py-20 text-center text-xs font-bold text-ink-muted">
        جاري تحميل أوردرات محطة التوبنج...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-xs font-bold text-red-600">
          تعذر تحميل أوردرات محطة التوبنج. تحقق من الاتصال بالسيرفر.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // فشل تبديل جاهزية بوكس أو إنهاء أوردر (مثل رفض السيرفر قبل اكتمال الحقن) يظهر هنا
  const writeError = toggleError || finishError;
  const resetWriteError = () => { resetToggleError(); resetFinishError(); };
  const toggleErrorBanner = writeError && (
    <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold mb-3">
      <span>تعذر تحديث الجاهزية: {writeError.message}</span>
      <button type="button" onClick={resetWriteError} className="shrink-0 underline">إخفاء</button>
    </div>
  );

  // عند الإيقاف المؤقت، يتم تجميد الطلبات الحالية ولا يزيد العدد مع دخول طلبات جديدة
  const visibleOrders = isPaused && pausedAt
    ? orders.filter((o) => !o.created_at || new Date(o.created_at).getTime() <= new Date(pausedAt).getTime())
    : orders;
  const queuedCount = orders.length - visibleOrders.length;

  // تصفية الأوردرات
  const filteredOrders = visibleOrders.filter((ord) => {
    if (orderTypeFilter !== 'all' && ord.order_type !== orderTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = String(ord.order_daily_number).includes(q);
      const matchCust = ord.customer_name?.toLowerCase().includes(q);
      return matchNum || matchCust;
    }
    return true;
  });

  return (
    <div className="space-y-3.5">
      
      {/* 1. الترويسة مع زر إيقاف / استئناف الاستلام */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-line shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">
              شاشة توبنج وبوكسات الدونتس
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* زر إيقاف / استئناف استلام الطلبات */}
          <button
            type="button"
            onClick={togglePause}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
              isPaused
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-surface hover:bg-surface-2 border border-line text-ink'
            }`}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>استئناف استلام الطلبات {queuedCount > 0 ? `(${queuedCount} بالانتظار)` : ''}</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>إيقاف استلام الطلبات مؤقتاً</span>
              </>
            )}
          </button>
        </div>
      </div>

      {toggleErrorBanner}

      {/* تنبيه حالة التوقف المؤقت وتجميد الطلبات */}
      {isPaused && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              تم إيقاف استقبال الطلبات وتجميد القائمة الحالية حتى تنتهي من تجهيزها.
              {queuedCount > 0 ? ` (يوجد ${queuedCount} طلب جديد بانتظار الاستئناف)` : ' (لا توجد طلبات جديدة معلقة)'}
            </span>
          </div>
          <button
            type="button"
            onClick={togglePause}
            className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
          >
            فتح واستئناف الآن
          </button>
        </div>
      )}

      {/* 2. شريط البحث والتصفية بحسب نوع الأوردر */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-surface p-1.5 sm:p-2 rounded-xl border border-line shadow-2xs">
        {/* أزرار نوع الطلب */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar">
          {[
            { id: 'all', label: 'كافة الطلبات' },
            { id: 'dine_in', label: 'صالة' },
            { id: 'takeaway', label: 'تيك أواي' },
            { id: 'delivery', label: 'ديليفري' },
            { id: 'pickup', label: 'استلام' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOrderTypeFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                orderTypeFilter === tab.id
                  ? 'bg-brand-700 text-white shadow-2xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* حقل البحث السريع برقم الأوردر أو اسم العميل */}
        <div className="relative w-full sm:w-56">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الطلب أو العميل..."
            className="w-full py-1 pr-7 pl-2.5 rounded-md border border-line bg-surface-2 text-[11px] font-bold text-ink focus:outline-none focus:border-brand-700"
          />
          <Search className="w-3 h-3 text-ink-muted absolute right-2 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 3. شبكة كروت الأوردرات — أوردرين اثنين كحد أقصى في الصف مع وضوح عالي للقطع */}
      {filteredOrders.length === 0 ? (
        <div className="py-16 text-center rounded-xl border border-dashed border-line bg-surface p-6">
          <Package className="w-8 h-8 text-stone-300 mx-auto mb-2 stroke-[1.5]" />
          <h3 className="text-xs font-bold text-ink">لا توجد طلبات توبنج في الانتظار حالياً</h3>
         
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
          {filteredOrders.map((order) => (
            <OrderToppingCard
              key={order.id}
              order={order}
              onToggleBoxReady={(boxId) => toggleBoxReady(order.order_id, boxId)}
              onFinishOrder={() => finishOrder(order.order_id)}
              isFinishing={isFinishing}
            />
          ))}
        </div>
      )}

    </div>
  );
};

// كارت الأوردر الكامل في محطة التوبنج
const OrderToppingCard: React.FC<{
  order: DonutToppingOrder;
  onToggleBoxReady: (boxId: string) => void;
  onFinishOrder: () => void;
  isFinishing: boolean;
}> = ({ order, onToggleBoxReady, onFinishOrder, isFinishing }) => {
  const readyBoxesCount = order.boxes.filter((b) => b.is_ready).length;
  const isOrderAllReady = order.boxes.length > 0 && readyBoxesCount === order.boxes.length;

  return (
    <div
      className={`rounded-xl border bg-surface p-3 space-y-2.5 shadow-2xs transition-all ${
        isOrderAllReady
          ? 'border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
          : 'border-line hover:border-line-strong'
      }`}
    >
      {/* 1. ترويسة الأوردر الواضحة */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-700 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-ink font-mono">
                طلب #{order.order_daily_number}
              </h2>
              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                  order.order_type === 'dine_in'
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : order.order_type === 'delivery'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : 'bg-stone-100 text-stone-800 border-stone-200'
                }`}
              >
                {order.order_type_label}
              </span>
            </div>
           
          </div>
        </div>

        {/* التوقيت ومؤشر البوكسات المكتملة */}
        <div className="text-left flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-[11px] text-ink-muted font-mono">
            <Clock className="w-3.5 h-3.5 text-ink-muted" />
            <span>{formatTime(order.created_at)}</span>
          </div>

          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-lg border font-mono ${
              isOrderAllReady
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-surface-2 text-ink border-line'
            }`}
          >
            {readyBoxesCount} / {order.total_boxes} جاهز
          </span>
        </div>
      </div>

      {order.notes && (
        <div className="py-1 px-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs font-bold text-amber-950 truncate">
          ملاحظة: {order.notes}
        </div>
      )}

      {/* 2. قائمة البوكسات داخل الأوردر — كل بوكس يظهر بقطع الدونتس الهندسية */}
      <div className="space-y-2.5">
        {order.boxes.map((box) => (
          <DonutBoxToppingItem
            key={box.id}
            box={box}
            onToggleReady={() => onToggleBoxReady(box.id)}
          />
        ))}
      </div>

      {/* 3. زر تأكيد اكتمال التوبنج للطلب وتسليمه للبيك أب */}
      <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted font-medium">
          إجمالي {order.total_pieces} قطعة في {order.total_boxes} بوكس
        </span>

        <button
          type="button"
          disabled={isFinishing}
          onClick={onFinishOrder}
          className={`py-2 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 shadow-2xs active:scale-98 cursor-pointer ${
            isOrderAllReady
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-brand-700 hover:bg-brand-800 text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
          <span>{isOrderAllReady ? 'اكتمال الطلب والتسليم للبيك أب ✓' : 'إنهاء وتجهيز الطلب'}</span>
        </button>
      </div>
    </div>
  );
};

// تمثيل البوكس الواحد مع شبكة القطع (مستطيل التوبنج فوق ومستطيل الحشو تحت)
const DonutBoxToppingItem: React.FC<{
  box: DonutToppingBox;
  onToggleReady: () => void;
}> = ({ box, onToggleReady }) => {
  // حساب توزيع شبكة الأعمدة بحسب عدد القطع
  const gridColsClass = (() => {
    switch (box.pieces_count) {
      case 1:
        return 'grid grid-cols-1 max-w-[200px]';
      case 2:
        return 'grid grid-cols-2 gap-2';
      case 3:
      case 4:
        return 'grid grid-cols-2 sm:grid-cols-4 gap-2';
      case 6:
        return 'grid grid-cols-3 sm:grid-cols-6 gap-1.5';
      case 8:
        return 'grid grid-cols-4 sm:grid-cols-8 gap-1.5';
      case 12:
        return 'grid grid-cols-4 sm:grid-cols-6 gap-1.5';
      default:
        return 'grid grid-cols-2 sm:grid-cols-4 gap-2';
    }
  })();

  return (
    <div
      className={`rounded-xl border p-2.5 space-y-2 transition-all ${
        box.is_ready
          ? 'bg-emerald-50/40 border-emerald-300'
          : 'bg-surface-2/40 border-line hover:border-brand-200'
      }`}
    >
      {/* شريط عنوان البوكس وزر التأكيد */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
        
          <span className="text-xs sm:text-sm font-black text-ink">
            بوكس {box.pieces_count} قطع ({box.donut_type === 'mini' ? 'ميني دونتس' : box.donut_type === 'stuffed' ? 'دونتس حشو' : 'عادي'})
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleReady}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            box.is_ready
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-surface hover:bg-surface-2 border border-line text-ink'
          }`}
        >
          {box.is_ready ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>جاهز ומقفل ✓</span>
            </>
          ) : (
            <span>تحديد كجاهز</span>
          )}
        </button>
      </div>

      {/* شبكة القطع — كل قطعة تحتوي على مستطيل التوبنج فوق ومستطيل الحشو تحت */}
      <div className={gridColsClass}>
        {box.pieces.map((piece) => (
          <div
            key={piece.piece_number}
            className="flex flex-col gap-1 p-1.5 rounded-lg border border-line bg-surface shadow-2xs"
          >
          
            {/* المستطيل العلوي: التوبنج */}
            <div
              className="h-7 px-2 rounded-md bg-brand-50/90 border border-brand-200 text-brand-950 flex items-center justify-between gap-1 overflow-hidden"
              title={`توبنج: ${piece.topping_sauce_name}`}
            >
              {/* <span className="text-[10px] font-bold text-brand-700 shrink-0 leading-none">توبنج:</span> */}
              <span className="text-xs font-black truncate leading-none">
                {piece.topping_sauce_name || 'بدون'}
              </span>
            </div>

            {/* المستطيل السفلي: الحشو (يظهر فقط إذا كان البوكس محشياً أو ميني) */}
            {box.donut_type !== 'regular' && (
              <div
                className={`h-7 px-2 rounded-md border flex items-center justify-between gap-1 overflow-hidden ${
                  piece.is_stuffed && piece.stuffing_sauce_name && piece.stuffing_sauce_name !== 'سادة'
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                    : 'bg-stone-50 border-stone-200 text-stone-600'
                }`}
                title={`الحشو: ${piece.stuffing_sauce_name || 'سادة'}`}
              >
                {/* <span className="text-[10px] font-bold text-stone-500 shrink-0 leading-none">حشو:</span> */}
                <span className="text-xs font-black truncate leading-none">
                  {piece.stuffing_sauce_name || 'سادة'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
