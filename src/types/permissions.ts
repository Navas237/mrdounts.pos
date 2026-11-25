/**
 * كتالوج الصلاحيات الديناميكية متطابق تماماً مع قاعدة البيانات (foundation.sql)
 * النظام ديناميكي بالكامل: لا توجد أدوار ثابتة (Roles)، بل قائمة صلاحيات تمنح لكل مستخدم:
 * 1. صلاحيات الشاشات (Screen Permissions)
 * 2. صلاحيات الأقسام (Department Access)
 * 3. صلاحيات الإجراءات التفصيلية (Action Permissions)
 */

export type ScreenPermissionKey =
  | 'screen.cashier'
  | 'screen.pickup'
  | 'screen.customers'
  | 'screen.drawer'
  | 'screen.callcenter'
  | 'screen.admin';

export type ActionPermissionKey =
  | 'shift.open'
  | 'shift.close'
  | 'drawer.view'
  | 'drawer.movement'
  | 'order.create'
  | 'order.edit'
  | 'order.cancel'
  | 'order.discount'
  | 'order.deliver'
  | 'order.reprint'
  | 'kitchen.prepare'
  | 'donut.control'
  | 'customers.view'
  | 'customers.manage'
  | 'menu.manage'
  | 'settings.manage'
  | 'users.manage'
  | 'print.manage';

export type PermissionKey = ScreenPermissionKey | ActionPermissionKey | string;

export interface UserPermissions {
  screens: ScreenPermissionKey[];
  actions: ActionPermissionKey[];
  departmentIds: string[]; // معرفات الأقسام المسموح له برؤية شاشتها في المطبخ
}

