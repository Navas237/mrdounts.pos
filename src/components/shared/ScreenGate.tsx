import React from 'react';
import { Navigate } from 'react-router-dom';
import { ScreenPermissionKey } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';

interface ScreenGateProps {
  screen: ScreenPermissionKey;
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * حارس الشاشات الكاملة: يتأكد من امتلاك الموظف لصلاحية الشاشة المحددة
 */
export const ScreenGate: React.FC<ScreenGateProps> = ({
  screen,
  children,
  redirectTo = '/unauthorized',
}) => {
  const { canAccessScreen } = usePermissions();

  if (!canAccessScreen(screen)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

