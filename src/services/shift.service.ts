import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { Shift, CashMovement, CashKind, ShiftSummaryReport } from '@/types/database';
import { authService } from './auth.service';

export interface DrawerReport {
  opening_cash: number;
  cash_sales: number;
  expected_in_drawer: number;
  total_orders_count: number;
  active_orders_count: number;
}

export const DEFAULT_SHIFT: Shift | null = null;

export const DEFAULT_SUMMARY: ShiftSummaryReport = {
  shift_id: '',
  status: 'closed',
  opened_at: new Date().toISOString(),
  closed_at: null,
  opened_by: '',
  opening_cash: 0,
  expected_cash: 0,
  sales_total: 0,
  cash_sales: 0,
  card_sales: 0,
  wallet_sales: 0,
  instapay_sales: 0,
  total_in: 0,
  total_out: 0,
  expenses_total: 0,
  orders_count: 0,
  movements_count: 0,
};

export const DEFAULT_MOVEMENTS: CashMovement[] = [];
export const DEFAULT_HISTORY: Shift[] = [];

const SHIFT_STORAGE_KEYS = {
  activeShift: 'mrdonuts_v9_active_shift',
  summary: 'mrdonuts_v9_shift_summary',
  movements: 'mrdonuts_v9_shift_movements',
  history: 'mrdonuts_v9_shift_history',
};

function loadStoredActiveShift(): Shift | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEYS.activeShift);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.status === 'open') return parsed;
    }
    const session = authService.getCurrentSession();
    if (session?.activeShift && session.activeShift.status === 'open') {
      return session.activeShift;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveStoredActiveShift(shift: Shift | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (shift) {
      localStorage.setItem(SHIFT_STORAGE_KEYS.activeShift, JSON.stringify(shift));
    } else {
      localStorage.removeItem(SHIFT_STORAGE_KEYS.activeShift);
    }
    // تحديث الجلسة أيضاً لتتطابق في كل التطبيق
    const session = authService.getCurrentSession();
    if (session) {
      session.activeShift = shift;
      localStorage.setItem('mrdounts_session', JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

function loadStoredSummary(): ShiftSummaryReport {
  if (typeof window === 'undefined') return { ...DEFAULT_SUMMARY };
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEYS.summary);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { ...DEFAULT_SUMMARY };
}

function saveStoredSummary(summary: ShiftSummaryReport): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHIFT_STORAGE_KEYS.summary, JSON.stringify(summary));
  } catch {
    // ignore
  }
}

function loadStoredMovements(): CashMovement[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEYS.movements);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveStoredMovements(movements: CashMovement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHIFT_STORAGE_KEYS.movements, JSON.stringify(movements));
  } catch {
    // ignore
  }
}

function loadStoredHistory(): Shift[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEYS.history);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveStoredHistory(history: Shift[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHIFT_STORAGE_KEYS.history, JSON.stringify(history));
  } catch {
    // ignore
  }
}

export const shiftService = {
  // جلب الشفت المفتوح حالياً
  async getCurrentShift(_branchId?: string): Promise<Shift | null> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*')
          .eq('status', 'open')
          .maybeSingle();

        if (!error && data) {
          const shift: Shift = {
            id: data.id,
            branch_id: data.branch_id,
            status: data.status,
            opened_by: data.opened_by || 'الموظف المسؤول',
            opened_at: data.opened_at,
            opening_cash: Number(data.opening_cash) || 0,
            closed_by: data.closed_by,
            closed_at: data.closed_at,
            closing_cash: data.counted_cash
              ? Number(data.counted_cash)
              : data.closing_cash
              ? Number(data.closing_cash)
              : undefined,
            expected_cash: data.expected_cash ? Number(data.expected_cash) : undefined,
            difference: data.cash_difference ? Number(data.cash_difference) : undefined,
            notes: data.close_notes,
          };
          saveStoredActiveShift(shift);
          return shift;
        }
      } catch (err) {
        console.warn('Supabase fetch failed for active shift:', err);
      }
    }

    return loadStoredActiveShift();
  },

  async getActiveShift(branchId?: string): Promise<Shift | null> {
    return this.getCurrentShift(branchId);
  },

  // فتح شفت جديد
  async openShift(openingCash: number, notes?: string): Promise<Shift> {
    let newShiftId = `shift-mock-${Date.now()}`;

    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data: shiftId, error } = await supabase.rpc('open_shift', {
          p_opening_cash: openingCash,
        });

        if (!error && shiftId) {
          newShiftId = shiftId;
        }
      } catch (err) {
        console.warn('Supabase open_shift failed, proceeding with local shift:', err);
      }
    }

    const newShift: Shift = {
      id: newShiftId,
      branch_id: 'b-main',
      status: 'open',
      opened_by: 'أحمد محمود',
      opened_at: new Date().toISOString(),
      opening_cash: openingCash,
      expected_cash: openingCash,
      notes,
    };

    const newSummary: ShiftSummaryReport = {
      shift_id: newShift.id,
      status: 'open',
      opened_at: newShift.opened_at,
      closed_at: null,
      opened_by: newShift.opened_by,
      opening_cash: openingCash,
      expected_cash: openingCash,
      sales_total: 0,
      cash_sales: 0,
      card_sales: 0,
      wallet_sales: 0,
      instapay_sales: 0,
      total_in: 0,
      total_out: 0,
      expenses_total: 0,
      orders_count: 0,
      movements_count: 0,
    };

    saveStoredActiveShift(newShift);
    saveStoredSummary(newSummary);
    saveStoredMovements([]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
    }

    return newShift;
  },

  // قفل الشفت
  async closeShift(
    arg1: string | number,
    arg2?: number | string,
    arg3?: string
  ): Promise<ShiftSummaryReport> {
    let countedCash = 0;
    let notes: string | undefined = undefined;

    if (typeof arg1 === 'string' && typeof arg2 === 'number') {
      countedCash = arg2;
      notes = typeof arg3 === 'string' ? arg3 : undefined;
    } else if (typeof arg1 === 'number') {
      countedCash = arg1;
      notes = typeof arg2 === 'string' ? arg2 : undefined;
    }

    const curShift = loadStoredActiveShift();
    const curSummary = loadStoredSummary();

    if (isLiveSupabaseConfigured && supabase) {
      const shiftId = typeof arg1 === 'string' ? arg1 : curShift?.id;
      if (shiftId && !shiftId.startsWith('shift-mock')) {
        try {
          await supabase.rpc('close_shift', {
            p_shift: shiftId,
            p_counted_cash: countedCash,
            p_notes: notes || '',
          });
        } catch (err) {
          console.warn('Supabase close_shift error:', err);
        }
      }
    }

    const closedReport: ShiftSummaryReport = {
      ...curSummary,
      status: 'closed',
      closed_at: new Date().toISOString(),
      expected_cash: curSummary.expected_cash,
    };

    // حفظ في الأرشيف
    const history = loadStoredHistory();
    history.unshift({
      id: curShift?.id || `shift-${Date.now()}`,
      branch_id: curShift?.branch_id || 'b-main',
      status: 'closed',
      opened_by: curShift?.opened_by || 'الموظف',
      opened_at: curShift?.opened_at || new Date().toISOString(),
      opening_cash: curSummary.opening_cash,
      closed_by: 'الموظف المسؤول',
      closed_at: closedReport.closed_at!,
      closing_cash: countedCash,
      expected_cash: closedReport.expected_cash,
      difference: countedCash - closedReport.expected_cash,
      notes,
    });
    saveStoredHistory(history);

    saveStoredActiveShift(null);
    saveStoredSummary(closedReport);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
    }

    return closedReport;
  },

  // تسجيل المبيعات والمدفوعات فور إتمام أي أوردر
  recordOrderPayment(params: {
    total: number;
    payments: Array<{ method_name: string; is_cash: boolean; amount: number }>;
    order_id: string;
  }): void {
    const summary = loadStoredSummary();
    const shift = loadStoredActiveShift();

    const orderTotal = Number(params.total) || 0;
    summary.sales_total += orderTotal;
    summary.orders_count += 1;

    let cashAmount = 0;
    (params.payments || []).forEach((p) => {
      const amt = Number(p.amount) || 0;
      const method = (p.method_name || '').toLowerCase();

      // فودافون كاش محفظة وليست نقدية الدرج: النقدي بعلامة is_cash أو اسم «نقدي» فقط
      const isWallet = method.includes('فودافون') || method.includes('محفظ') || method.includes('wallet');
      if (!isWallet && (p.is_cash || method.includes('نقد'))) {
        cashAmount += amt;
        summary.cash_sales += amt;
      } else if (method.includes('فيزا') || method.includes('card') || method.includes('بطاق')) {
        summary.card_sales += amt;
      } else if (isWallet) {
        summary.wallet_sales += amt;
      } else if (/[اإ]نستاباي/.test(method) || method.includes('instapay')) {
        summary.instapay_sales += amt;
      } else {
        summary.card_sales += amt;
      }
    });

    // زيادة النقدية المتوقعة بالدرج فقط بمقدار المدفوع نقداً
    summary.expected_cash =
      summary.opening_cash + summary.cash_sales + summary.total_in - summary.total_out;

    saveStoredSummary(summary);

    if (shift) {
      shift.expected_cash = summary.expected_cash;
      saveStoredActiveShift(shift);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
    }
  },

  // ملخص الشفت المالي الشامل
  async getShiftSummary(shiftId: string): Promise<ShiftSummaryReport> {
    if (
      isLiveSupabaseConfigured &&
      supabase &&
      shiftId &&
      shiftId !== 'none' &&
      !shiftId.startsWith('shift-mock')
    ) {
      try {
        const { data, error } = await supabase.rpc('drawer_report', {
          p_shift: shiftId,
        });

        if (!error && data) {
          const methods: Array<{ method: string; is_cash: boolean; total: number }> =
            data.payments_by_method || [];
          const cashSales = methods
            .filter((m) => m.is_cash)
            .reduce((sum, m) => sum + Number(m.total || 0), 0);
          const cardSales = methods
            .filter(
              (m) =>
                m.method?.toLowerCase().includes('فيزا') ||
                m.method?.toLowerCase().includes('card')
            )
            .reduce((sum, m) => sum + Number(m.total || 0), 0);
          const walletSales = methods
            .filter((m) => !m.is_cash && (m.method?.includes('فودافون') || m.method?.includes('محفظ')))
            .reduce((sum, m) => sum + Number(m.total || 0), 0);
          const instapaySales = methods
            .filter((m) => /[اإ]نستاباي/.test(m.method || '') || m.method?.toLowerCase().includes('instapay'))
            .reduce((sum, m) => sum + Number(m.total || 0), 0);
          const salesTotal = methods.reduce((sum, m) => sum + Number(m.total || 0), 0);

          const openingCash = Number(data.opening_cash) || 0;
          const movementsIn = Number(data.movements_in) || 0;
          const movementsOut = Number(data.movements_out) || 0;
          // حساب النقدية المتوقعة بدقة حتى أثناء فتح الشفت
          const expectedCash =
            Number(data.expected_cash) || openingCash + cashSales + movementsIn - movementsOut;

          return {
            shift_id: shiftId,
            status: data.status || 'open',
            opened_at: data.opened_at || new Date().toISOString(),
            closed_at: data.closed_at || null,
            opened_by: data.opened_by || 'الكاشير',
            opening_cash: openingCash,
            expected_cash: expectedCash,
            sales_total: salesTotal,
            cash_sales: cashSales,
            card_sales: cardSales,
            wallet_sales: walletSales,
            instapay_sales: instapaySales,
            total_in: movementsIn,
            total_out: movementsOut,
            expenses_total: movementsOut,
            orders_count: Number(data.orders_count) || 0,
            movements_count: 0,
          };
        }
      } catch (err) {
        console.warn('Supabase fetch failed for shift summary:', err);
      }
    }

    return loadStoredSummary();
  },

  // حركات الدرج للشفت
  async getMovements(shiftId: string): Promise<CashMovement[]> {
    if (
      isLiveSupabaseConfigured &&
      supabase &&
      shiftId &&
      shiftId !== 'none' &&
      !shiftId.startsWith('shift-mock')
    ) {
      try {
        const { data, error } = await supabase
          .from('cash_movements')
          .select('*')
          .eq('shift_id', shiftId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((m: any) => ({
            id: m.id,
            branch_id: m.branch_id,
            shift_id: m.shift_id,
            kind: m.direction as CashKind,
            amount: Number(m.amount) || 0,
            category: m.reason?.split(':')[0] || 'حركة نقدية',
            description: m.reason || '',
            created_by: m.created_by || 'الكاشير',
            created_at: m.created_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch failed for movements:', err);
      }
    }
    return loadStoredMovements();
  },

  async listShiftMovements(shiftId: string): Promise<CashMovement[]> {
    return this.getMovements(shiftId);
  },

  // إضافة حركة درج (سحب / إيداع / مصروف)
  async addMovement(
    kind: CashKind,
    amount: number,
    category: string,
    description: string,
    shiftId: string
  ): Promise<CashMovement> {
    if (isLiveSupabaseConfigured && supabase && !shiftId.startsWith('shift-mock')) {
      try {
        const { data, error } = await supabase
          .from('cash_movements')
          .insert({
            shift_id: shiftId,
            branch_id: 'b-main',
            direction: kind,
            amount,
            reason: `${category}: ${description}`.trim(),
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: data.id,
            branch_id: data.branch_id,
            shift_id: data.shift_id,
            kind: data.direction as CashKind,
            amount: Number(data.amount) || 0,
            category,
            description,
            created_by: 'الكاشير',
            created_at: data.created_at,
          };
        }
      } catch (err) {
        console.warn('Supabase addMovement error:', err);
      }
    }

    const movements = loadStoredMovements();
    const summary = loadStoredSummary();

    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      branch_id: 'b-main',
      shift_id: shiftId || summary.shift_id || 'shift-mock-current',
      kind,
      amount,
      category,
      description,
      created_by: 'أحمد محمود',
      created_at: new Date().toISOString(),
    };

    movements.unshift(newMov);
    saveStoredMovements(movements);

    if (kind === 'in') {
      summary.total_in += amount;
      summary.expected_cash += amount;
    } else {
      summary.total_out += amount;
      summary.expenses_total += amount;
      summary.expected_cash -= amount;
    }
    summary.movements_count = movements.length;

    saveStoredSummary(summary);

    const shift = loadStoredActiveShift();
    if (shift) {
      shift.expected_cash = summary.expected_cash;
      saveStoredActiveShift(shift);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
    }

    return newMov;
  },

  async addCashMovement(movement: {
    branch_id?: string;
    shift_id: string;
    kind: CashKind;
    amount: number;
    category: string;
    description?: string;
    created_by?: string;
  }): Promise<CashMovement> {
    return this.addMovement(
      movement.kind,
      movement.amount,
      movement.category,
      movement.description || '',
      movement.shift_id
    );
  },

  // تقرير الدرج المباشر
  async getDrawerReport(shiftId: string): Promise<DrawerReport> {
    const summary = await this.getShiftSummary(shiftId);
    return {
      opening_cash: summary.opening_cash,
      cash_sales: summary.cash_sales,
      expected_in_drawer: summary.expected_cash,
      total_orders_count: summary.orders_count,
      active_orders_count: 0,
    };
  },

  // سجل الشفتات السابقة
  async getShiftsHistory(branchId?: string): Promise<Shift[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('shifts')
          .select('*')
          .order('opened_at', { ascending: false })
          .limit(30);

        if (branchId) {
          query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (!error && data) {
          return data.map((s: any) => ({
            id: s.id,
            branch_id: s.branch_id,
            status: s.status,
            opened_by: s.opened_by || 'الموظف',
            opened_at: s.opened_at,
            opening_cash: Number(s.opening_cash) || 0,
            closed_by: s.closed_by,
            closed_at: s.closed_at,
            closing_cash: s.counted_cash
              ? Number(s.counted_cash)
              : s.closing_cash
              ? Number(s.closing_cash)
              : undefined,
            expected_cash: s.expected_cash ? Number(s.expected_cash) : undefined,
            difference: s.cash_difference ? Number(s.cash_difference) : undefined,
            notes: s.close_notes,
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch failed for shifts history:', err);
      }
    }
    return loadStoredHistory();
  },

  async listShiftsHistory(branchId?: string): Promise<Shift[]> {
    return this.getShiftsHistory(branchId);
  },

  // فتح الدرج يدوياً
  async kickDrawer(reason?: string): Promise<{ success: boolean }> {
    console.log('[KICK DRAWER]', reason);
    return { success: true };
  },
};
