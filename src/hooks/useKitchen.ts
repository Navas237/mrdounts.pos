import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kitchenService, KitchenItem } from '@/services/kitchen.service';

export function useKitchen(departmentName: 'وافل' | 'مشروبات') {
  const queryClient = useQueryClient();
  const queryKey = ['kitchen', 'items', departmentName];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => kitchenService.getDepartmentItems(departmentName),
    refetchInterval: 15000, // فحص متباعد؛ الاستجابة الفورية تعتمد على الأحداث
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('mrdonuts:kitchen-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:kitchen-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient, departmentName]);

  const finishMutation = useMutation({
    mutationFn: (itemId: string) => kitchenService.finishItem(itemId),
    onSuccess: (_, itemId) => {
      queryClient.setQueryData(queryKey, (prev: KitchenItem[] = []) =>
        prev.filter((i) => i.id !== itemId)
      );
    },
  });

  const startMutation = useMutation({
    mutationFn: (itemId: string) => kitchenService.startItem(itemId),
    onSuccess: (_, itemId) => {
      queryClient.setQueryData(queryKey, (prev: KitchenItem[] = []) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: 'preparing' as const } : i))
      );
    },
  });

  return {
    items,
    isLoading,
    startItem: startMutation.mutateAsync,
    finishItem: finishMutation.mutateAsync,
  };
}

export function useDonutBatch() {
  const queryClient = useQueryClient();
  const queryKey = ['kitchen', 'donutBatch'];

  const { data: batch, isLoading } = useQuery({
    queryKey,
    queryFn: () => kitchenService.getDonutBatch(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('mrdonuts:kitchen-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:kitchen-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient]);

  const [isReceivingStopped, setIsReceivingStopped] = useState(false);

  const toggleReceivingMutation = useMutation({
    mutationFn: (stop: boolean) => kitchenService.toggleDonutReceiving(stop),
    onSuccess: (stop) => {
      setIsReceivingStopped(stop);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const finishBatchMutation = useMutation({
    mutationFn: (batchId: string) => kitchenService.finishDonutBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    batch,
    isLoading,
    isReceivingStopped,
    toggleReceiving: toggleReceivingMutation.mutateAsync,
    finishBatch: finishBatchMutation.mutateAsync,
    isFinishing: finishBatchMutation.isPending,
  };
}

export function useDonutTopping() {
  const queryClient = useQueryClient();
  const queryKey = ['kitchen', 'donutTopping'];

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => kitchenService.getDonutToppingOrders(),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('mrdonuts:kitchen-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:kitchen-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient]);

  const toggleBoxMutation = useMutation({
    mutationFn: ({ orderId, boxId }: { orderId: string; boxId: string }) =>
      kitchenService.toggleBoxReady(orderId, boxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'donutInjection'] });
    },
    onError: () => {
      // فشل التبديل (مثل رفض INJECTION_INCOMPLETE): أعد الجلب حتى لا تبقى حالة جاهز محلية زائفة
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const finishOrderMutation = useMutation({
    mutationFn: (orderId: string) => kitchenService.finishDonutToppingOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['kitchen', 'donutInjection'] });
      queryClient.invalidateQueries({ queryKey: ['pickup', 'orders'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    orders,
    isLoading,
    isError,
    refetch,
    toggleBoxReady: (orderId: string, boxId: string) =>
      toggleBoxMutation.mutate({ orderId, boxId }),
    toggleError: toggleBoxMutation.error,
    resetToggleError: () => toggleBoxMutation.reset(),
    finishOrder: (orderId: string) => finishOrderMutation.mutate(orderId),
    finishError: finishOrderMutation.error,
    resetFinishError: () => finishOrderMutation.reset(),
    isFinishing: finishOrderMutation.isPending,
  };
}

export function useDonutInjection(pausedAt?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['kitchen', 'donutInjection', pausedAt || 'active'];

  const { data: injectionData, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => kitchenService.getDonutInjectionData(pausedAt),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey });
    };
    window.addEventListener('mrdonuts:kitchen-updated', handleUpdate);
    window.addEventListener('mrdonuts:order-created', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:kitchen-updated', handleUpdate);
      window.removeEventListener('mrdonuts:order-created', handleUpdate);
    };
  }, [queryClient, pausedAt]);

  const toggleSauceMutation = useMutation({
    mutationFn: (sauceName: string) => kitchenService.toggleInjectionSauce(sauceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      console.error('Failed to persist injection completion:', err);
    },
  });

  const toggleOrderMutation = useMutation({
    mutationFn: (orderId: string) => kitchenService.toggleInjectionOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    injectionData: injectionData || {
      total_pieces: 0,
      total_stuffed: 0,
      total_plain: 0,
      pending_orders_count: 0,
      sauce_aggregates: [],
      orders: [],
    },
    isLoading,
    isError,
    refetch,
    toggleSauce: (sauceKey: string) => toggleSauceMutation.mutate(sauceKey),
    toggleOrder: toggleOrderMutation.mutateAsync,
  };
}

