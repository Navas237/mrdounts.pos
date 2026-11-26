import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  PackageCheck,
  Coins,
  Flame,
  Coffee,
  Users,
  Settings,
  ClipboardList,
  BarChart3,
  Sparkles,
  Syringe,
} from 'lucide-react';
import { ScreenPermissionKey } from '@/types/permissions';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  hint?: string;
  requiredScreenPerm?: ScreenPermissionKey;
  requiredDeptId?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'التشغيل ونقطة البيع',
    items: [
      {
        path: '/cashier',
        label: ' طلب جديد ',
        icon: ShoppingCart,
        hint: '   ',
        requiredScreenPerm: 'screen.cashier',
      },
      {
        path: '/pickup',
        label: 'البيك أب والتسليم',
        icon: PackageCheck,
        hint: ' ',
        requiredScreenPerm: 'screen.pickup',
      },
      {
        path: '/shifts',
        label: 'الشفتات والدرج',
        icon: Coins,
        hint: ' ',
        requiredScreenPerm: 'screen.drawer',
      },
      {
        path: '/orders',
        label: 'الأوردرات',
        icon: ClipboardList,
        hint: 'إعادة طباعة وتعديل',
        requiredScreenPerm: 'screen.orders',
      },
      {
        path: '/reports',
        label: 'التقارير',
        icon: BarChart3,
        hint: 'الشفت والأصناف والصوصات',
        requiredScreenPerm: 'screen.reports',
      },
    ],
  },
  {
    title: 'محطات المطبخ والتجهيز',
    items: [
      {
        path: '/kitchen/donuts-topping',
        label: 'شاشة توبنج الدونتس',
        icon: Sparkles,
        hint: 'البوكسات والتزيين',
        requiredDeptId: 'd-donuts',
      },
      {
        path: '/kitchen/donuts-injection',
        label: 'شاشة حقن الدونتس',
        icon: Syringe,
        hint: 'الحشوات والقطع',
        requiredDeptId: 'd-donuts',
      },
      {
        path: '/kitchen/waffle',
        label: 'شاشة الوافل',
        icon: Flame,
        hint: 'استلام الوافل',
        requiredDeptId: 'd-waffle',
      },
      {
        path: '/kitchen/drinks',
        label: 'شاشة المشروبات',
        icon: Coffee,
        hint: 'بار المشروبات',
        requiredDeptId: 'd-drinks',
      },
    ],
  },
  {
    title: 'الإدارة والمتابعة',
    items: [
      {
        path: '/',
        label: 'لوحة التحكم (الرئيسية)',
        icon: LayoutDashboard,
        hint: 'مؤشرات وشارت',
      },
      {
        path: '/customers',
        label: 'العملاء (CRM)',
        icon: Users,
        hint: 'سجل الطلبات',
        requiredScreenPerm: 'screen.customers',
      },
      {
        path: '/admin',
        label: 'لوحة الإدارة والمنيو',
        icon: Settings,
        hint: 'الأصناف والأسعار',
        requiredScreenPerm: 'screen.admin',
      },
    ],
  },
];

export const BRAND = {
  name: 'MR DONUTS',
  sub: 'نظام إدارة المطعم الموحد',
  branch: 'الفرع الرئيسي',
};

