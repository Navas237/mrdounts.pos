import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface DepartmentGateProps {
  departmentId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * مكون للتحكم في ظهور شاشة قسم معين بالمطبخ (وافل / مشروبات / دونتس)
 * بحسب صلاحيات الأقسام الممنوحة للمستخدم
 */
export const DepartmentGate: React.FC<DepartmentGateProps> = ({
  departmentId,
  children,
  fallback = null,
}) => {
  const { canAccessDepartment } = usePermissions();

  if (!canAccessDepartment(departmentId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

