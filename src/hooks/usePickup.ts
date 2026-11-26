import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pickupService, PickupOrder } from '@/services/pickup.service';

export function usePickup() {
  const queryClient = useQueryClient();
  const queryKey = ['pickup', 'orders'];

  const { data: orders = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => pickupService.getPickupOrders(),
    refetchInterval: 15000, // استعلام احتياطي متباعد كل 15 ثانية بدلاً من 3 ثوانٍ
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('mrdonuts:pickup-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:pickup-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient]);

  const deliverMutation = useMutation({
    mutationFn: (orderId: string) => pickupService.deliverOrder(orderId),
    onSuccess: (_, orderId) => {
      queryClient.setQueryData(queryKey, (prev: PickupOrder[] = []) =>
        prev.filter((o) => o.id !== orderId)
      );
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      // فشل التسليم: أعد جلب الحالة الحقيقية فوراً حتى يرجع الأوردر لحالة الانتظار
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    orders,
    isLoading,
    // mutate وليس mutateAsync: فشل التسليم يظهر في deliverError بدل وعد مرفوض بلا معالج
    deliverOrder: (orderId: string) => deliverMutation.mutate(orderId),
    deliverError: deliverMutation.error,
    resetDeliverError: () => deliverMutation.reset(),
    isDelivering: deliverMutation.isPending,
  };
}
