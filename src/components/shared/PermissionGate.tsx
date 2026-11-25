import React from 'react';
import { ActionPermissionKey } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  action: ActionPermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * مكون للتحكم في ظهور أي زر أو محتوى داخل أي شاشة ديناميكياً
 * مثال:
 * <PermissionGate action="order.cancel">
 *   <button>إلغاء الأوردر</button>
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  action,
  children,
  fallback = null,
}) => {
  const { hasActionPermission } = usePermissions();

  if (!hasActionPermission(action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

