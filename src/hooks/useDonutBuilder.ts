import { useState, useMemo, useEffect } from 'react';
import { DonutPieceItem, CartItem } from '@/types/order';
import { menuService, DonutBoxType, DonutBoxConfig } from '@/services/menu.service';

const createDefaultPieces = (count: number, type: DonutBoxType): DonutPieceItem[] => {
  return Array.from({ length: count }, (_, idx) => ({
    piece_number: idx + 1,
    piece_type: type === 'regular' ? 'topping_only' : 'stuffed',
    stuffing_sauce_id: type === 'regular' ? 'plain' : undefined,
    stuffing_sauce_name: type === 'regular' ? 'سادة (بدون حشو)' : undefined,
    topping_sauce_id: undefined,
    topping_sauce_name: undefined,
    extra_fee: 0,
  }));
};

// الحفاظ على الصوصات المختارة مسبقاً عند تغيير عدد القطع (تكبير أو تصغير البوكس)
const resizePieces = (
  prevPieces: DonutPieceItem[],
  newCount: number,
  type: DonutBoxType
): DonutPieceItem[] => {
  if (newCount <= prevPieces.length) {
    // إذا قل العدد، نحتفظ بالقطع الأولى حتى newCount بكافة صوصاتها وتفاصيلها
    return prevPieces.slice(0, newCount).map((p, idx) => ({
      ...p,
      piece_number: idx + 1,
    }));
  }
  // إذا زاد العدد، نحتفظ بالقطع السابقة كما هي بصوصاتها، ونضيف قطعاً جديدة فارغة للباقي
  const additionalPieces: DonutPieceItem[] = Array.from(
    { length: newCount - prevPieces.length },
    (_, idx) => ({
      piece_number: prevPieces.length + idx + 1,
      piece_type: type === 'regular' ? 'topping_only' : 'stuffed',
      stuffing_sauce_id: type === 'regular' ? 'plain' : undefined,
      stuffing_sauce_name: type === 'regular' ? 'سادة (بدون حشو)' : undefined,
      topping_sauce_id: undefined,
      topping_sauce_name: undefined,
      extra_fee: 0,
    })
  );
  return [...prevPieces, ...additionalPieces];
};

export function useDonutBuilder(onAddToCart?: (item: CartItem) => void) {
  const [donutType, setDonutType] = useState<DonutBoxType>('regular');
  const [builderVersion, setBuilderVersion] = useState(0);

  // الاستماع لتعديلات الإدارة وتحديث البنية ديناميكياً
  useEffect(() => {
    const handleUpdate = () => {
      setBuilderVersion((v) => v + 1);
    };
    window.addEventListener('mrdonuts:menu-updated', handleUpdate);
    return () => window.removeEventListener('mrdonuts:menu-updated', handleUpdate);
  }, []);

  const config = useMemo(() => {
    return menuService.getDonutConfigSync(donutType);
  }, [donutType, builderVersion]);

  const [piecesCount, setPiecesCount] = useState<number>(() => {
    return config.availableSizes.includes(2)
      ? 2
      : config.availableSizes[0] || 0;
  });
  const [activePieceIndex, setActivePieceIndex] = useState<number>(0);

  const boxBasePrice = config.boxPrices[piecesCount] || 0;

  // تهيئة قطع البوكس بحسب نوع الدونتس (عادي / ميني / حشو)
  const [pieces, setPieces] = useState<DonutPieceItem[]>(() => {
    const initialCount = config.availableSizes.includes(2)
      ? 2
      : config.availableSizes[0] || 0;
    return createDefaultPieces(initialCount, 'regular');
  });

  // مزامنة عدد القطع والبوكس تلقائياً عند تغيير أو تحميل الأحجام المتاحة من الإدارة
  useEffect(() => {
    if (config.availableSizes.length > 0) {
      if (!config.availableSizes.includes(piecesCount) || piecesCount === 0) {
        const defaultCount = config.availableSizes.includes(2) ? 2 : config.availableSizes[0];
        setPiecesCount(defaultCount);
        setPieces((prev) => resizePieces(prev, defaultCount, donutType));
      }
    }
  }, [config.availableSizes, piecesCount, donutType]);

  // حساب رسوم الإكسترا لنكهة معينة
  const calculateExtraFee = (
    stuffingId?: string,
    toppingId?: string,
    customConfig?: DonutBoxConfig
  ): number => {
    const cfg = customConfig || config;
    let fee = 0;
    if (stuffingId && stuffingId !== 'plain') {
      const stuffing = cfg.stuffingSauces.find((s) => s.id === stuffingId);
      if (stuffing) fee += stuffing.extra_price;
    }
    if (toppingId) {
      const topping = cfg.toppingSauces.find((t) => t.id === toppingId);
      if (topping) fee += topping.extra_price;
    }
    return fee;
  };

  // تبديل نوع الدونتس (عادي | ميني | حشو) مع مواءمة حالة القطع
  const handleSetDonutType = (nextType: DonutBoxType) => {
    setDonutType(nextType);
    const nextConfig = menuService.getDonutConfigSync(nextType);

    setPieces((prev) =>
      prev.map((p) => {
        if (nextType === 'regular') {
          return {
            ...p,
            piece_type: 'topping_only',
            stuffing_sauce_id: 'plain',
            stuffing_sauce_name: 'سادة (بدون حشو)',
            extra_fee: calculateExtraFee('plain', p.topping_sauce_id, nextConfig),
          };
        } else {
          // إذا كان التحويل إلى حشو أو ميني، وكان الحشو السابق 'plain'، نفرغه ليطلب اختيار صوص حشو
          const isPrevPlain = p.stuffing_sauce_id === 'plain';
          const stId = isPrevPlain ? undefined : p.stuffing_sauce_id;
          const stName = isPrevPlain ? undefined : p.stuffing_sauce_name;
          return {
            ...p,
            piece_type: 'stuffed',
            stuffing_sauce_id: stId,
            stuffing_sauce_name: stName,
            extra_fee: calculateExtraFee(stId, p.topping_sauce_id, nextConfig),
          };
        }
      })
    );
  };

  // تحديث حجم البوكس والقطع عند تغيير التكوين
  useEffect(() => {
    if (config.availableSizes.length === 0) {
      if (piecesCount !== 0) {
        setPiecesCount(0);
        setPieces([]);
      }
    } else if (!config.availableSizes.includes(piecesCount)) {
      const nextCount = config.availableSizes.includes(2)
        ? 2
        : config.availableSizes[0];
      setPiecesCount(nextCount);
      setActivePieceIndex((prev) => Math.min(prev, Math.max(0, nextCount - 1)));
      setPieces((prev) => resizePieces(prev, nextCount, donutType));
    }
  }, [config, piecesCount, donutType]);

  // تحديث حجم البوكس (1, 2, 3, 4, 6, 8, 10, 12) مع الحفاظ على الصوصات المختارة مسبقاً
  const handleSetPiecesCount = (count: number) => {
    setPiecesCount(count);
    setActivePieceIndex((prev) => Math.min(prev, Math.max(0, count - 1)));
    setPieces((prev) => resizePieces(prev, count, donutType));
  };

  // التحقق من اكتمال قطعة معينة (عادي: توبنج فقط | ميني وحشو: توبنج + حشو)
  const isPieceComplete = (p: DonutPieceItem): boolean => {
    if (donutType === 'regular') {
      return Boolean(p.topping_sauce_id);
    }
    return Boolean(p.topping_sauce_id && p.stuffing_sauce_id);
  };

  // عدد القطع المكتملة والمتبقية
  const completedPiecesCount = useMemo(() => {
    return pieces.filter(isPieceComplete).length;
  }, [pieces]);

  const remainingPiecesCount = useMemo(() => {
    return piecesCount - completedPiecesCount;
  }, [piecesCount, completedPiecesCount]);

  // عدد القطع التي تم اختيار التوبنج والحشو لها
  const toppingsCount = useMemo(() => {
    return pieces.filter((p) => Boolean(p.topping_sauce_id)).length;
  }, [pieces]);

  const stuffingsCount = useMemo(() => {
    return pieces.filter((p) => Boolean(p.stuffing_sauce_id)).length;
  }, [pieces]);

  // إجمالي رسوم الإضافات (Extras) لكافة القطع
  const totalExtraFees = useMemo(() => {
    return pieces.reduce((sum, p) => sum + p.extra_fee, 0);
  }, [pieces]);

  // الإجمالي الكلي للبوكس
  const totalBoxPrice = boxBasePrice + totalExtraFees;

  // هل البوكس مكتمل بالكامل؟
  const isBoxComplete = useMemo(() => {
    if (pieces.length === 0) return false;
    return pieces.every(isPieceComplete);
  }, [pieces]);

  // ========================================================================
  // تطبيق التوبنج على القطعة المحددة + عدد محدد من القطع غير المكتملة (Batch Apply)
  // ========================================================================
  const applyToppingToPieces = (startIndex: number, toppingId: string, count: number = 1) => {
    const toppingSauce = config.toppingSauces.find((s) => s.id === toppingId);
    if (!toppingSauce) return;

    setPieces((prev) => {
      let applied = 0;
      const next = [...prev];

      // 1. التطبيق على القطعة المضغوط عليها أولاً
      if (startIndex >= 0 && startIndex < next.length) {
        const p = next[startIndex];
        next[startIndex] = {
          ...p,
          topping_sauce_id: toppingId,
          topping_sauce_name: toppingSauce.name,
          extra_fee: calculateExtraFee(p.stuffing_sauce_id, toppingId),
        };
        applied++;
      }

      // 2. التطبيق على القطع اللاحقة التي ليس لها توبنج بعد
      if (applied < count) {
        for (let i = startIndex + 1; i < next.length && applied < count; i++) {
          if (!next[i].topping_sauce_id) {
            const p = next[i];
            next[i] = {
              ...p,
              topping_sauce_id: toppingId,
              topping_sauce_name: toppingSauce.name,
              extra_fee: calculateExtraFee(p.stuffing_sauce_id, toppingId),
            };
            applied++;
          }
        }
      }

      // 3. إن تبقى عدد، نملأ أي قطع سابقة غير مكتملة
      if (applied < count) {
        for (let i = 0; i < next.length && applied < count; i++) {
          if (i !== startIndex && !next[i].topping_sauce_id) {
            const p = next[i];
            next[i] = {
              ...p,
              topping_sauce_id: toppingId,
              topping_sauce_name: toppingSauce.name,
              extra_fee: calculateExtraFee(p.stuffing_sauce_id, toppingId),
            };
            applied++;
          }
        }
      }

      return next;
    });
  };

  // ========================================================================
  // تطبيق الحشو على القطعة المحددة + عدد محدد من القطع (Batch Apply)
  // ========================================================================
  const applyStuffingToPieces = (startIndex: number, stuffingId: string, count: number = 1) => {
    const isPlain = stuffingId === 'plain';
    const stuffingSauce = isPlain ? null : config.stuffingSauces.find((s) => s.id === stuffingId);

    setPieces((prev) => {
      let applied = 0;
      const next = [...prev];

      const formatPiece = (p: DonutPieceItem): DonutPieceItem => {
        const effectiveId = isPlain ? 'plain' : stuffingSauce?.id;
        const effectiveName = isPlain ? 'سادة (بدون حشو)' : stuffingSauce?.name;
        const pieceType = isPlain ? 'topping_only' : 'stuffed';
        return {
          ...p,
          piece_type: pieceType,
          stuffing_sauce_id: effectiveId,
          stuffing_sauce_name: effectiveName,
          extra_fee: calculateExtraFee(effectiveId, p.topping_sauce_id),
        };
      };

      // 1. التطبيق على القطعة المضغوط عليها
      if (startIndex >= 0 && startIndex < next.length) {
        next[startIndex] = formatPiece(next[startIndex]);
        applied++;
      }

      // 2. التطبيق على القطع اللاحقة التي ليس لها حشو بعد
      if (applied < count) {
        for (let i = startIndex + 1; i < next.length && applied < count; i++) {
          if (!next[i].stuffing_sauce_id) {
            next[i] = formatPiece(next[i]);
            applied++;
          }
        }
      }

      // 3. تطبيق على باقي القطع إن وُجد
      if (applied < count) {
        for (let i = 0; i < next.length && applied < count; i++) {
          if (i !== startIndex && !next[i].stuffing_sauce_id) {
            next[i] = formatPiece(next[i]);
            applied++;
          }
        }
      }

      return next;
    });
  };

  // تفريغ توبنج قطعة
  const clearPieceTopping = (index: number) => {
    setPieces((prev) =>
      prev.map((p, idx) => {
        if (idx !== index) return p;
        return {
          ...p,
          topping_sauce_id: undefined,
          topping_sauce_name: undefined,
          extra_fee: calculateExtraFee(p.stuffing_sauce_id, undefined),
        };
      })
    );
  };

  // تفريغ حشو قطعة
  const clearPieceStuffing = (index: number) => {
    setPieces((prev) =>
      prev.map((p, idx) => {
        if (idx !== index) return p;
        return {
          ...p,
          stuffing_sauce_id: undefined,
          stuffing_sauce_name: undefined,
          extra_fee: calculateExtraFee(undefined, p.topping_sauce_id),
        };
      })
    );
  };

  // تفريغ قطعة بالكامل
  const clearPiece = (index: number) => {
    setPieces((prev) =>
      prev.map((p, idx) => {
        if (idx !== index) return p;
        return {
          piece_number: p.piece_number,
          piece_type: donutType === 'regular' ? 'topping_only' : 'stuffed',
          stuffing_sauce_id: donutType === 'regular' ? 'plain' : undefined,
          stuffing_sauce_name: donutType === 'regular' ? 'سادة (بدون حشو)' : undefined,
          topping_sauce_id: undefined,
          topping_sauce_name: undefined,
          extra_fee: 0,
        };
      })
    );
  };

  // إعادة ضبط البوكس بالكامل
  const resetEntireBox = () => {
    setActivePieceIndex(0);
    setPieces(createDefaultPieces(piecesCount, donutType));
  };

  // تحديد كافة القطع المتبقية كسادة (بدون حشو) بنقرة واحدة
  const setAllRemainingStuffingToPlain = () => {
    setPieces((prev) =>
      prev.map((p) => {
        if (p.stuffing_sauce_id) return p;
        return {
          ...p,
          piece_type: 'topping_only',
          stuffing_sauce_id: 'plain',
          stuffing_sauce_name: 'سادة (بدون حشو)',
          extra_fee: calculateExtraFee('plain', p.topping_sauce_id),
        };
      })
    );
  };

  // حساب عدد القطع المتاحة للتطبيق بدءاً من قطعة معينة
  const getAvailableToppingCountFrom = (startIndex: number): number => {
    let count = 0;
    for (let i = startIndex; i < pieces.length; i++) {
      if (i === startIndex || !pieces[i].topping_sauce_id) count++;
    }
    return Math.max(1, count);
  };

  const getAvailableStuffingCountFrom = (startIndex: number): number => {
    let count = 0;
    for (let i = startIndex; i < pieces.length; i++) {
      if (i === startIndex || !pieces[i].stuffing_sauce_id) count++;
    }
    return Math.max(1, count);
  };

  // بناء عنصر السلة
  const buildCartItem = (): CartItem => {
    const depts = menuService.getDepartmentsSync();
    const donutDept = depts.find(
      (d) => d.behavior === 'donut_box' || d.name.includes('دونتس')
    );
    return {
      cart_id: `donut-box-${Date.now()}`,
      department_id: donutDept?.id || 'd-donuts',
      department_name: donutDept?.name || 'دونتس',
      is_donut_box: true,
      donut_type: donutType,
      donut_pieces_count: piecesCount,
      donut_pieces: pieces,
      unit_price: boxBasePrice,
      quantity: 1,
      options: [],
      line_total: totalBoxPrice,
    };
  };

  const handleAddToCart = () => {
    if (!isBoxComplete) return;
    const item = buildCartItem();
    if (onAddToCart) {
      onAddToCart(item);
    }
    // تفريغ البوكس بالكامل من الصوصات ليكون جاهزاً للطلب التالي فوراً
    resetEntireBox();
  };

  return {
    donutType,
    setDonutType: handleSetDonutType,
    piecesCount,
    setPiecesCount: handleSetPiecesCount,
    pieces,
    activePieceIndex,
    setActivePieceIndex,
    clearPiece,
    clearPieceTopping,
    clearPieceStuffing,
    resetEntireBox,
    config,
    boxBasePrice,
    totalExtraFees,
    totalBoxPrice,
    isBoxComplete,
    completedPiecesCount,
    remainingPiecesCount,
    toppingsCount,
    stuffingsCount,
    // وظائف التطبيق والمودال
    applyToppingToPieces,
    applyStuffingToPieces,
    setAllRemainingStuffingToPlain,
    getAvailableToppingCountFrom,
    getAvailableStuffingCountFrom,
    handleAddToCart,
  };
}
