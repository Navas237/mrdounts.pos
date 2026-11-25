import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ScreenPermissionKey } from '@/types/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredScreen?: ScreenPermissionKey;
  requiredDeptId?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredScreen,
  requiredDeptId,
}) => {
  const { user } = useAuth();
  const { canAccessScreen, canAccessDepartment } = usePermissions();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredScreen && !canAccessScreen(requiredScreen)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredDeptId && !canAccessDepartment(requiredDeptId)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
