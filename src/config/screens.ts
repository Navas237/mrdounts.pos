import { ScreenPermissionKey } from '@/types/permissions';

export interface AppScreenConfig {
  id: string;
  title: string;
  path: string;
  icon: string;
  requiredScreenPerm?: ScreenPermissionKey;
  requiredDeptId?: string;
  description: string;
}

export const ALL_SCREENS: AppScreenConfig[] = [
  {
    id: 'cashier',
    title: 'طلب جديد',
    path: '/cashier',
    icon: 'Calculator',
    requiredScreenPerm: 'screen.cashier',
    description: 'إدخال الأوردرات، اختيار بوكسات    ',
  },
  {
    id: 'kitchen_waffle',
    title: 'شاشة الوافل',
    path: '/kitchen/waffle',
    icon: 'Flame',
    requiredDeptId: 'd-waffle',
    description: 'استلام أصناف الوافل تلقائياً والتجهيز  ',
  },
  {
    id: 'kitchen_drinks',
    title: 'شاشة المشروبات',
    path: '/kitchen/drinks',
    icon: 'Coffee',
    requiredDeptId: 'd-drinks',
    description: 'استلام طلبات المشروبات   ',
  },
  {
    id: 'kitchen_donuts_topping',
    title: 'شاشة توبنج الدونتس',
    path: '/kitchen/donuts-topping',
    icon: 'Sparkles',
    requiredDeptId: 'd-donuts',
    description: 'تزيين البوكسات هندسياً بحسب كل أوردر كما في الكاشير',
  },
  {
    id: 'kitchen_donuts_injection',
    title: 'شاشة حقن الدونتس',
    path: '/kitchen/donuts-injection',
    icon: 'Syringe',
    requiredDeptId: 'd-donuts',
    description: 'إجمالي عدد القطع المطلوب حقنها لكل صوص حشو وتوزيعها',
  },
  {
    id: 'pickup',
    title: ' البيك أب والتسليم',
    path: '/pickup',
    icon: 'PackageCheck',
    requiredScreenPerm: 'screen.pickup',
    description: 'متابعة جاهزية كل الأقسام وتجميع الأوردر وتسليمه للعميل',
  },
  {
    id: 'shifts',
    title: 'الشفتات والدرج',
    path: '/shifts',
    icon: 'Coins',
    requiredScreenPerm: 'screen.drawer',
    description: 'فتح وقفل الشفت، رصيد الدرج،    ',
  },
  {
    id: 'orders',
    title: 'الأوردرات',
    path: '/orders',
    icon: 'ClipboardList',
    requiredScreenPerm: 'screen.orders',
    description: 'قائمة الأوردرات، إعادة الطباعة وتعديل الأوردر',
  },
  {
    id: 'reports',
    title: 'التقارير',
    path: '/reports',
    icon: 'BarChart3',
    requiredScreenPerm: 'screen.reports',
    description: 'تقرير نهاية الشفت، مبيعات الأصناف، واستهلاك الصوصات',
  },
  {
    id: 'customers',
    title: 'العملاء (CRM)',
    path: '/customers',
    icon: 'Users',
    requiredScreenPerm: 'screen.customers',
    description: 'سجل العملاء، العناوين، وطلبات الكول سنتر',
  },
  {
    id: 'admin',
    title: 'لوحة الإدارة والمنيو',
    path: '/admin',
    icon: 'Settings',
    requiredScreenPerm: 'screen.admin',
    description: 'إدارة الفروڡ الأصناف، الأسعار، الصوصات، والمستخدمين والصلاحيات',
  },
];
