import { useAuth } from './useAuth';
import { ScreenPermissionKey, ActionPermissionKey } from '@/types/permissions';

export function usePermissions() {
  const { session } = useAuth();
  const permissions = session?.permissions;
  const isSuper = Boolean(session?.profile?.is_super_admin || session?.profile?.username === 'admin');

  /**
   * هل يملك الموظف صلاحية رؤية شاشة معينة؟
   * السوبر أدمن يملك صلاحية رؤية كافة الشاشات تلقائياً
   */
  const canAccessScreen = (screenKey: ScreenPermissionKey): boolean => {
    if (isSuper) return true;
    if (!permissions) return false;
    return permissions.screens.includes(screenKey);
  };

  /**
   * هل يملك الموظف صلاحية تنفيذ إجراء تفصيلي داخل شاشة؟
   * مثل: order.cancel, shift.open, donut.control, menu.manage
   */
  const hasActionPermission = (actionKey: ActionPermissionKey): boolean => {
    if (isSuper) return true;
    if (!permissions) return false;
    return permissions.actions.includes(actionKey);
  };

  /**
   * هل يملك الموظف صلاحية رؤية شاشة مطبخ لقسم معين (وافل / مشروبات / دونتس)؟
   * السوبر أدمن يدخل على كافة مطابخ الأقسام تلقائياً
   */
  const canAccessDepartment = (departmentId: string): boolean => {
    if (isSuper) return true;
    if (!permissions) return false;
    if (permissions.departmentIds.includes(departmentId)) return true;

    // مطابقة مرنة بالسلوك أو الاسم في حال كان المعرف UUID أو اسماً رمزياً
    const depts = session?.departments || [];
    const matched = depts.find(
      (d) =>
        d.id === departmentId ||
        (departmentId === 'd-donuts' && (d.behavior === 'donut_box' || d.name.includes('دونت'))) ||
        (departmentId === 'd-waffle' && (d.name.includes('وافل') || d.behavior === 'customizable')) ||
        (departmentId === 'd-drinks' && (d.name.includes('مشروب') || d.name.includes('عصير')))
    );

    if (matched && permissions.departmentIds.includes(matched.id)) {
      return true;
    }

    return false;
  };

  /**
   * هل لديه أي قسم مطبخ مسموح؟
   */
  const canAccessAnyKitchen = (): boolean => {
    if (isSuper) return true;
    if (!permissions) return false;
    return permissions.departmentIds.length > 0;
  };

  return {
    permissions,
    canAccessScreen,
    hasActionPermission,
    canAccessDepartment,
    canAccessAnyKitchen,
  };
}

