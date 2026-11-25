import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftService } from '@/services/shift.service';
import { useAuth, useAuthStore } from './useAuth';
import { Shift, CashKind, CashMovement, ShiftSummaryReport } from '@/types/database';

export const SHIFT_QUERY_KEYS = {
  active: (branchId: string) => ['shift', 'active', branchId] as const,
  summary: (shiftId: string) => ['shift', 'summary', shiftId] as const,
  movements: (shiftId: string) => ['shift', 'movements', shiftId] as const,
  history: (branchId: string) => ['shift', 'history', branchId] as const,
  drawer: (shiftId: string) => ['shift', 'drawer', shiftId] as const,
};

export function useShift() {
  const { branch, activeShift, user } = useAuth();
  const queryClient = useQueryClient();
  const updateSession = useAuthStore((s) => s.updateSession);

  const branchId = branch?.id || 'b1111111-1111-1111-1111-111111111111';

  // استعلام الشفت النشط
  const {
    data: currentShift,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: SHIFT_QUERY_KEYS.active(branchId),
    queryFn: async () => {
      const remote = await shiftService.getActiveShift(branchId);
      return remote || activeShift;
    },
    initialData: activeShift,
  });

  const shiftId = currentShift?.id || 'none';

  // استعلام ملخص الشفت المالي الشامل
  const { data: summary, isLoading: isSummaryLoading } = useQuery<ShiftSummaryReport>({
    queryKey: SHIFT_QUERY_KEYS.summary(shiftId),
    queryFn: async () => {
      if (!currentShift?.id) {
        return {
          shift_id: 'none',
          status: 'closed',
          opened_at: new Date().toISOString(),
          opened_by: user?.full_name || 'أحمد محمود',
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
      }
      return shiftService.getShiftSummary(currentShift.id);
    },
    enabled: Boolean(currentShift?.id),
    refetchInterval: 30000, // فحص متباعد كل 30 ثانية؛ التحديث الفعلي يحدث فورياً عبر أحداث mrdonuts:shift-updated
  });

  // استعلام سجل حركات النقدية بالدرج
  const { data: movements, isLoading: isMovementsLoading } = useQuery<CashMovement[]>({
    queryKey: SHIFT_QUERY_KEYS.movements(shiftId),
    queryFn: async () => {
      if (!currentShift?.id) return [];
      return shiftService.listShiftMovements(currentShift.id);
    },
    enabled: Boolean(currentShift?.id),
    refetchInterval: 30000,
  });

  // الاستماع لتحديثات الشفت والأوردرات لحظياً
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.active(branchId) });
      if (currentShift?.id) {
        queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.summary(currentShift.id) });
        queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.movements(currentShift.id) });
      }
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    };

    window.addEventListener('mrdonuts:shift-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:shift-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient, branchId, currentShift?.id]);

  // استعلام أرشيف الشفتات السابقة
  const { data: history, isLoading: isHistoryLoading } = useQuery<Shift[]>({
    queryKey: SHIFT_QUERY_KEYS.history(branchId),
    queryFn: async () => {
      return shiftService.listShiftsHistory(branchId);
    },
  });

  // فتح شفت جديد
  const openShiftMutation = useMutation({
    mutationFn: async ({ openingCash, notes }: { openingCash: number; notes?: string }) => {
      return shiftService.openShift(openingCash, notes);
    },
    onSuccess: (newShift: Shift) => {
      updateSession((prev) => (prev ? { ...prev, activeShift: newShift } : null));
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.active(branchId) });
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.summary(newShift.id) });
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.movements(newShift.id) });
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.history(branchId) });
    },
  });

  // قفل الشفت ومطابقة النقدية
  const closeShiftMutation = useMutation({
    mutationFn: async ({ actualCash, notes }: { actualCash: number; notes?: string }) => {
      if (!currentShift?.id) throw new Error('لا يوجد شفت نشط لقفله');
      return shiftService.closeShift(currentShift.id, actualCash, notes);
    },
    onSuccess: () => {
      updateSession((prev) => (prev ? { ...prev, activeShift: null } : null));
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.active(branchId) });
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.history(branchId) });
    },
  });

  // إضافة حركة نقدية في الدرج (إيداع / سحب / مصروف)
  const addMovementMutation = useMutation({
    mutationFn: async ({
      kind,
      amount,
      category,
      description,
    }: {
      kind: CashKind;
      amount: number;
      category: string;
      description?: string;
    }) => {
      if (!currentShift?.id) throw new Error('يجب فتح شفت أولاً لتسجيل حركات الدرج');
      return shiftService.addCashMovement({
        branch_id: branchId,
        shift_id: currentShift.id,
        kind,
        amount,
        category,
        description,
        created_by: user?.full_name || 'أحمد محمود',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.summary(shiftId) });
      queryClient.invalidateQueries({ queryKey: SHIFT_QUERY_KEYS.movements(shiftId) });
    },
  });

  // فتح الدرج يدوياً
  const kickDrawerMutation = useMutation({
    mutationFn: async (reason?: string) => {
      return shiftService.kickDrawer(reason);
    },
  });

  return {
    shift: currentShift,
    isOpen: currentShift?.status === 'open',
    isLoading,
    summary,
    isSummaryLoading,
    movements: movements || [],
    isMovementsLoading,
    history: history || [],
    isHistoryLoading,
    refetchShift: refetch,
    openShift: openShiftMutation.mutateAsync,
    isOpening: openShiftMutation.isPending,
    closeShift: closeShiftMutation.mutateAsync,
    isClosing: closeShiftMutation.isPending,
    addMovement: addMovementMutation.mutateAsync,
    isAddingMovement: addMovementMutation.isPending,
    kickDrawer: kickDrawerMutation.mutateAsync,
    isKickingDrawer: kickDrawerMutation.isPending,
    // للتوافقية السريعة
    drawerReport: summary
      ? {
          opening_cash: summary.opening_cash,
          cash_sales: summary.cash_sales,
          expected_in_drawer: summary.expected_cash,
          total_orders_count: summary.orders_count,
          active_orders_count: 0,
        }
      : null,
  };
}
