import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { menuService } from '@/services/menu.service';
import { useAuth } from './useAuth';

export const MENU_QUERY_KEYS = {
  departments: (branchId: string) => ['menu', 'departments', branchId] as const,
  items: (deptId: string) => ['menu', 'items', deptId] as const,
  donutConfig: (type: 'mini' | 'regular') => ['menu', 'donutConfig', type] as const,
};

export function useMenu(activeDepartmentId?: string) {
  const { branch } = useAuth();
  const queryClient = useQueryClient();

  // الاستماع لأي تعديل في صفحة الإدارة لتحديث كافة الشاشات فوراً
  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
    };

    window.addEventListener('mrdonuts:menu-updated', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:menu-updated', handleUpdate);
    };
  }, [queryClient]);

  const { data: departments = [], isLoading: isDeptsLoading } = useQuery({
    queryKey: MENU_QUERY_KEYS.departments(branch?.id || 'b-main'),
    queryFn: () => menuService.getDepartments(branch?.id || 'b-main'),
  });

  const { data: menuItems = [], isLoading: isItemsLoading } = useQuery({
    queryKey: MENU_QUERY_KEYS.items(activeDepartmentId || ''),
    queryFn: () => (activeDepartmentId ? menuService.getMenuItems(activeDepartmentId) : []),
    enabled: Boolean(activeDepartmentId),
  });

  return {
    departments,
    menuItems,
    isLoading: isDeptsLoading || isItemsLoading,
  };
}

// هوك خاص بالحصول على بنية الدونتس مع التحديث اللحظي
export function useDynamicDonutConfig(boxType: 'mini' | 'regular' = 'regular') {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: MENU_QUERY_KEYS.donutConfig(boxType) });
    };

    window.addEventListener('mrdonuts:menu-updated', handleUpdate);
    return () => {
      window.removeEventListener('mrdonuts:menu-updated', handleUpdate);
    };
  }, [queryClient, boxType]);

  const { data: config, isLoading } = useQuery({
    queryKey: MENU_QUERY_KEYS.donutConfig(boxType),
    queryFn: () => menuService.getDonutConfig(boxType),
  });

  return {
    config,
    isLoading,
  };
}
