import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { normalizeUserEmail } from '@/utils/formatters';
import { AuthSession, MockUserPersona } from '@/types/auth';
import { ScreenPermissionKey, ActionPermissionKey } from '@/types/permissions';
import { Branch, Department } from '@/types/database';

export const DEFAULT_BRANCH: Branch = {
  id: 'b1111111-1111-1111-1111-111111111111',
  name: 'الفرع الرئيسي — MR DONUTS',
  code: 'MAIN',
  phone: '01012345678',
  address: 'شارع الجمهورية - الفرع الرئيسي',
  is_active: true,
};

export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'd-waffle',
    branch_id: DEFAULT_BRANCH.id,
    name: 'وافل',
    behavior: 'customizable',
    prints_labels: true,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'd-drinks',
    branch_id: DEFAULT_BRANCH.id,
    name: 'مشروبات',
    behavior: 'simple',
    prints_labels: true,
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'd-donuts',
    branch_id: DEFAULT_BRANCH.id,
    name: 'دونتس',
    behavior: 'donut_box',
    prints_labels: false,
    sort_order: 3,
    is_active: true,
  },
];

export const MOCK_PERSONAS: MockUserPersona[] = [
  {
    id: 'u-admin',
    username: 'admin',
    full_name: 'أحمد محمود',
    job_title: 'مدير الفرع (صلاحيات مخصصة شاملة)',
    permissions: {
      screens: [
        'screen.cashier',
        'screen.pickup',
        'screen.customers',
        'screen.drawer',
        'screen.admin',
        'screen.callcenter',
      ],
      actions: [
        'shift.open',
        'shift.close',
        'drawer.view',
        'drawer.movement',
        'order.create',
        'order.edit',
        'order.cancel',
        'order.discount',
        'order.deliver',
        'order.reprint',
        'kitchen.prepare',
        'donut.control',
        'customers.view',
        'customers.manage',
        'menu.manage',
        'settings.manage',
        'users.manage',
        'print.manage',
      ],
      departmentIds: ['d-waffle', 'd-drinks', 'd-donuts'],
    },
  },
  {
    id: 'u-cashier',
    username: 'cashier',
    full_name: 'محمد علي',
    job_title: 'كاشير ومبيعات',
    permissions: {
      screens: ['screen.cashier', 'screen.drawer', 'screen.customers'],
      actions: ['shift.open', 'shift.close', 'order.create', 'order.discount', 'drawer.movement', 'customers.view'],
      departmentIds: [],
    },
  },
  {
    id: 'u-waffle-chef',
    username: 'waffle_chef',
    full_name: 'محمود السيد',
    job_title: 'مسؤول قسم الوافل',
    permissions: {
      screens: [],
      actions: ['kitchen.prepare', 'order.reprint'],
      departmentIds: ['d-waffle'], // يرى قسم الوافل فقط
    },
  },
  {
    id: 'u-barista',
    username: 'barista',
    full_name: 'سارة خالد',
    job_title: 'باريستا المشروبات',
    permissions: {
      screens: [],
      actions: ['kitchen.prepare', 'order.reprint'],
      departmentIds: ['d-drinks'], // يرى قسم المشروبات فقط
    },
  },
  {
    id: 'u-donut-chef',
    username: 'donut_chef',
    full_name: 'إبراهيم حسن',
    job_title: 'مسؤول تجميع وحشو الدونتس',
    permissions: {
      screens: [],
      actions: ['donut.control'],
      departmentIds: ['d-donuts'], // يرى قسم الدونتس فقط
    },
  },
  {
    id: 'u-pickup',
    username: 'pickup_staff',
    full_name: 'عمر عثمان',
    job_title: 'مسؤول محطة البيك أب',
    permissions: {
      screens: ['screen.pickup'],
      actions: ['order.deliver', 'order.reprint'],
      departmentIds: [],
    },
  },
];

const STORAGE_KEY = 'mrdounts_session';

export const authService = {
  getCurrentSession(): AuthSession | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AuthSession = JSON.parse(saved);

        // إذا كان Supabase الحقيقي متصلاً، نتحقق أن الجلسة ليست جلسة وهمية قديمة من الوضع المحلي
        if (isLiveSupabaseConfigured) {
          const isMockId =
            !parsed.profile?.id ||
            parsed.profile.id.startsWith('u-') ||
            parsed.profile.id.startsWith('p-') ||
            parsed.profile.id === 'mock-user-id';
          if (isMockId) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
        }

        if (parsed.profile && (parsed.profile.username === 'admin' || parsed.profile.is_super_admin)) {
          parsed.profile.is_super_admin = true;
        }

        if (parsed.activeShift?.id === 'shift-mock-current') {
          parsed.activeShift = null;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  },

  buildSessionFromPersona(persona: MockUserPersona): AuthSession {
    return {
      profile: {
        id: persona.id,
        branch_id: DEFAULT_BRANCH.id,
        username: persona.username,
        full_name: persona.full_name,
        is_super_admin: false,
        is_active: true,
      },
      branch: DEFAULT_BRANCH,
      permissions: {
        screens: persona.permissions.screens,
        actions: persona.permissions.actions,
        departmentIds: persona.permissions.departmentIds,
      },
      activeShift: null,
      departments: DEFAULT_DEPARTMENTS,
    };
  },

  async login(username: string, password = ''): Promise<AuthSession> {
    const cleanUsername = username.split('@')[0].trim().toLowerCase();

    if (isLiveSupabaseConfigured && supabase) {
      const email = normalizeUserEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('لم يتم العثور على بيانات المستخدم');
      }

      // 1. جلب البروفايل الحقيقي للمستخدم من قاعدة البيانات مع بيانات الفرع دفعة واحدة
      const { data: profileRaw, error: profErr } = await supabase
        .from('profiles')
        .select('*, branch:branches(*)')
        .eq('id', data.user.id)
        .single();

      if (profErr || !profileRaw) {
        console.error('Failed to fetch profile from DB:', profErr);
        throw new Error('تعذر جلب ملف المستخدم من قاعدة البيانات (تأكد من إدراج بياناته في جدول profiles ومنح الصلاحيات).');
      }

      const profile = {
        id: profileRaw.id,
        branch_id: profileRaw.branch_id,
        username: profileRaw.username,
        full_name: profileRaw.full_name,
        phone: profileRaw.phone,
        is_super_admin: Boolean(profileRaw.is_super_admin || cleanUsername === 'admin'),
        is_active: profileRaw.is_active,
        created_at: profileRaw.created_at,
      };

      const branch: Branch = profileRaw.branch || DEFAULT_BRANCH;
      const branchId = profile.branch_id || branch.id;
      const isSuper = profile.is_super_admin;

      // 2. جلب باقي البيانات (الصلاحيات، الأقسام، الشفت النشط) بالتوازي دفعة واحدة (Parallel Fetch)
      const [permsRes, deptsAccessRes, deptsRes, shiftRes] = await Promise.all([
        isSuper
          ? Promise.resolve({ data: null, error: null })
          : supabase.from('user_permissions').select('permission_key').eq('user_id', data.user.id),
        isSuper
          ? Promise.resolve({ data: null, error: null })
          : supabase.from('user_department_access').select('department_id').eq('user_id', data.user.id),
        supabase
          .from('departments')
          .select('*')
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('shifts')
          .select('*')
          .eq('branch_id', branchId)
          .eq('status', 'open')
          .maybeSingle(),
      ]);

      let screens: ScreenPermissionKey[] = [];
      let actions: ActionPermissionKey[] = [];

      if (isSuper) {
        screens = [
          'screen.cashier',
          'screen.pickup',
          'screen.customers',
          'screen.drawer',
          'screen.admin',
          'screen.callcenter',
        ];
        actions = [
          'shift.open',
          'shift.close',
          'drawer.view',
          'drawer.movement',
          'order.create',
          'order.edit',
          'order.cancel',
          'order.discount',
          'order.deliver',
          'order.reprint',
          'kitchen.prepare',
          'donut.control',
          'customers.view',
          'customers.manage',
          'menu.manage',
          'settings.manage',
          'users.manage',
          'print.manage',
        ];
      } else {
        const allPermKeys = permsRes?.data?.map((p) => p.permission_key) || [];
        screens = allPermKeys.filter((k) => k.startsWith('screen.')) as ScreenPermissionKey[];
        actions = allPermKeys.filter((k) => !k.startsWith('screen.')) as ActionPermissionKey[];
      }

      const departmentIds = deptsAccessRes?.data?.map((d) => d.department_id) || [];
      const depts = deptsRes.data || [];
      const shift = shiftRes.data || null;

      const session: AuthSession = {
        profile,
        branch,
        permissions: {
          screens,
          actions,
          departmentIds: isSuper ? depts.map((d) => d.id) : departmentIds,
        },
        activeShift: shift,
        departments: depts,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    }

    // في وضع التطوير المحلي أو التجريبي
    const persona = MOCK_PERSONAS.find((p) => p.username === cleanUsername);
    if (!persona) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    const session = this.buildSessionFromPersona(persona);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  },

  async logout(): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEY);
  },

  setSession(session: AuthSession | null): void {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
};

