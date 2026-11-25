import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { normalizeUserEmail } from '@/utils/formatters';
import { ScreenPermissionKey, ActionPermissionKey } from '@/types/permissions';
import { MOCK_PERSONAS, DEFAULT_BRANCH } from './auth.service';

export interface UserProfileWithPermissions {
  id: string;
  branch_id: string;
  username: string;
  full_name: string;
  phone?: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  created_at?: string;
  screens: ScreenPermissionKey[];
  actions: ActionPermissionKey[];
  departmentIds: string[];
}

export interface PermissionDefinition {
  key: string;
  kind: 'screen' | 'action';
  group: string;
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // 1. الشاشات
  { key: 'screen.cashier', kind: 'screen', group: 'الشاشات الرئيسية', label: 'شاشة الكاشير والمبيعات', description: 'إنشاء الفواتير وإتمام عمليات البيع واختيار طرق الدفع' },
  { key: 'screen.pickup', kind: 'screen', group: 'الشاشات الرئيسية', label: 'شاشة تسليم الطلبات (البيك أب)', description: 'متابعة الطلبات الجاهزة وتسليمها وتصفية الأوردرات' },
  { key: 'screen.customers', kind: 'screen', group: 'الشاشات الرئيسية', label: 'شاشة العملاء وسجل العمليات', description: 'عرض قائمة العملاء وعناوينهم وتاريخ مشترياتهم' },
  { key: 'screen.drawer', kind: 'screen', group: 'الشاشات الرئيسية', label: 'شاشة الدرج والشفتات', description: 'فتح وقفل الشفت وعرض تقرير النقدية والمبيعات' },
  { key: 'screen.callcenter', kind: 'screen', group: 'الشاشات الرئيسية', label: 'شاشة الكول سنتر والدليفري', description: 'استقبال طلبات الهاتف وإدارتها وتعيين الطيارين' },
  { key: 'screen.admin', kind: 'screen', group: 'الشاشات الرئيسية', label: 'لوحة الإدارة والإعدادات', description: 'تعديل الأقسام والمنيو والبوكسات والمستخدمين والصلاحيات' },

  // 2. الشفت والدرج
  { key: 'shift.open', kind: 'action', group: 'الشفت والدرج', label: 'فتح شفت جديد', description: 'إمكانية إدخال المبلغ الافتتاحي وبدء شفت جديد' },
  { key: 'shift.close', kind: 'action', group: 'الشفت والدرج', label: 'إغلاق وتقفيل الشفت', description: 'جرد درج النقدية وترحيل الحسابات وإغلاق الشفت' },
  { key: 'drawer.view', kind: 'action', group: 'الشفت والدرج', label: 'عرض تقرير وعهدة الدرج', description: 'مشاهدة إجمالي المبيعات والنقدية الحالية بالدرج' },
  { key: 'drawer.movement', kind: 'action', group: 'الشفت والدرج', label: 'تسجيل حركة نقدية (مصروف/إيداع)', description: 'تسجيل مصروفات نثرية أو سحب نقدية أو إيداع بالدرج' },

  // 3. الطلبات والمبيعات
  { key: 'order.create', kind: 'action', group: 'الطلبات والمبيعات', label: 'إنشاء طلبات جديدة', description: 'إضافة أصناف وبوكسات وإنشاء طلب جديد' },
  { key: 'order.edit', kind: 'action', group: 'الطلبات والمبيعات', label: 'تعديل طلب قائم', description: 'تعديل محتويات طلب قبل البدء في تجهيزه' },
  { key: 'order.cancel', kind: 'action', group: 'الطلبات والمبيعات', label: 'إلغاء طلب أو صنف', description: 'إلغاء أوردر كامل أو حذف صنف بعد تأكيده' },
  { key: 'order.discount', kind: 'action', group: 'الطلبات والمبيعات', label: 'تطبيق خصم مالي أو نسبي', description: 'منح خصومات يدوية على إجمالي الفاتورة' },
  { key: 'order.deliver', kind: 'action', group: 'الطلبات والمبيعات', label: 'تأكيد تسليم الطلب (البيك أب)', description: 'تغيير حالة الطلب إلى تم التسليم للعميل' },
  { key: 'order.reprint', kind: 'action', group: 'الطلبات والمبيعات', label: 'إعادة طباعة البون أو الملصق', description: 'إعادة طباعة ملصق تحضير أو إيصال عميل' },

  // 4. المطبخ والأقسام
  { key: 'kitchen.prepare', kind: 'action', group: 'المطبخ والتحضير', label: 'بدء وتجهيز وإنهاء الأصناف', description: 'تغيير حالة الأصناف في شاشات المطبخ إلى جاري التحضير وجاهز' },
  { key: 'donut.control', kind: 'action', group: 'المطبخ والتحضير', label: 'التحكم في دفعات الدونتس', description: 'بدء دفعات الدونتس وإيقافها مؤقتاً وتأكيد جاهزيتها' },

  // 5. العملاء
  { key: 'customers.view', kind: 'action', group: 'العملاء', label: 'استعراض بيانات العملاء', description: 'البحث عن العملاء وعرض أرقامهم وملاحظاتهم' },
  { key: 'customers.manage', kind: 'action', group: 'العملاء', label: 'إضافة وتعديل بيانات العملاء', description: 'تسجيل عميل جديد أو تحديث العنوان ورقم الهاتف' },

  // 6. الإدارة والنظام
  { key: 'menu.manage', kind: 'action', group: 'الإدارة والنظام', label: 'إدارة المنيو والأسعار والبوكسات', description: 'إضافة وتعديل الأقسام والبوكسات والأسعار والصوصات' },
  { key: 'settings.manage', kind: 'action', group: 'الإدارة والنظام', label: 'إدارة الإعدادات وطرق الدفع', description: 'ضبط طرق الدفع وإعدادات الضرائب والفرع' },
  { key: 'users.manage', kind: 'action', group: 'الإدارة والنظام', label: 'إدارة المستخدمين والصلاحيات', description: 'إنشاء حسابات الموظفين وتعيين مصفوفة الصلاحيات' },
  { key: 'print.manage', kind: 'action', group: 'الإدارة والنظام', label: 'إعدادات طابعات الأقسام والملصقات', description: 'ربط طابعات الشبكة وإعدادات الملصقات التلقائية' },
];

export const ROLE_PRESETS: {
  id: string;
  name: string;
  description: string;
  screens: ScreenPermissionKey[];
  actions: ActionPermissionKey[];
  departmentIds: string[];
}[] = [
  {
    id: 'cashier',
    name: '⚡ قالب كاشير ومبيعات',
    description: 'شاشة الكاشير والدرج والعملاء مع صلاحيات فتح/قفل الشفت وعمليات البيع',
    screens: ['screen.cashier', 'screen.drawer', 'screen.customers'],
    actions: ['shift.open', 'shift.close', 'drawer.movement', 'drawer.view', 'order.create', 'order.discount', 'order.reprint', 'customers.view', 'customers.manage'],
    departmentIds: [],
  },
  {
    id: 'branch_manager',
    name: '⚡ قالب مشرف / مدير فرع',
    description: 'صلاحيات وصول شاملة لكافة الشاشات وإدارة المنيو والعملاء والشفتات',
    screens: ['screen.cashier', 'screen.pickup', 'screen.customers', 'screen.drawer', 'screen.callcenter', 'screen.admin'],
    actions: [
      'shift.open', 'shift.close', 'drawer.view', 'drawer.movement',
      'order.create', 'order.edit', 'order.cancel', 'order.discount', 'order.deliver', 'order.reprint',
      'kitchen.prepare', 'donut.control',
      'customers.view', 'customers.manage',
      'menu.manage', 'settings.manage', 'users.manage', 'print.manage',
    ],
    departmentIds: ['d-waffle', 'd-drinks', 'd-donuts'],
  },
  {
    id: 'waffle_chef',
    name: '⚡ قالب شيف وافل',
    description: 'مطبخ قسم الوافل فقط لبدء التجهيز وإنهاء الأصناف',
    screens: [],
    actions: ['kitchen.prepare', 'order.reprint'],
    departmentIds: ['d-waffle'],
  },
  {
    id: 'barista',
    name: '⚡ قالب باريستا مشروبات',
    description: 'مطبخ قسم المشروبات فقط لبدء وتجهيز وإنهاء العصائر والقهوة',
    screens: [],
    actions: ['kitchen.prepare', 'order.reprint'],
    departmentIds: ['d-drinks'],
  },
  {
    id: 'donut_chef',
    name: '⚡ قالب شيف دونتس وتوبنج',
    description: 'قسم وتجميع الدونتس مع التحكم في دفعات الدونتس المجهزة',
    screens: [],
    actions: ['kitchen.prepare', 'donut.control', 'order.reprint'],
    departmentIds: ['d-donuts'],
  },
  {
    id: 'pickup_staff',
    name: '⚡ قالب مسؤول تسليم الطلبات',
    description: 'شاشة البيك أب لتسليم الطلبات للعملاء وإعادة طباعة الملصقات',
    screens: ['screen.pickup'],
    actions: ['order.deliver', 'order.reprint'],
    departmentIds: [],
  },
];

const LOCAL_STORAGE_USERS_KEY = 'mrdounts_custom_users';

export const userService = {
  /**
   * جلب كافة المستخدمين مع مصفوفة صلاحياتهم وأقسامهم
   */
  async getAllUsers(): Promise<UserProfileWithPermissions[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        // 1. جلب البروفايلات من Supabase
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profErr) {
          console.error('Failed to load profiles from DB:', profErr);
          throw profErr;
        }

        if (profiles && profiles.length > 0) {
          // 2. جلب كافة الصلاحيات
          const { data: allPerms } = await supabase
            .from('user_permissions')
            .select('user_id, permission_key');

          // 3. جلب وصول الأقسام
          const { data: allDeptAccess } = await supabase
            .from('user_department_access')
            .select('user_id, department_id');

          const allCatalogScreens = PERMISSION_CATALOG.filter((k) => k.kind === 'screen').map((k) => k.key as ScreenPermissionKey);
          const allCatalogActions = PERMISSION_CATALOG.filter((k) => k.kind === 'action').map((k) => k.key as ActionPermissionKey);

          // قراءة أي تعديلات محلية محفوظة للمستخدم
          const localUsers: UserProfileWithPermissions[] = (() => {
            try {
              const s = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
              return s ? JSON.parse(s) : [];
            } catch {
              return [];
            }
          })();

          const userList: UserProfileWithPermissions[] = profiles.map((p) => {
            const cached = localUsers.find((u) => u.id === p.id || u.username === p.username);

            const userPermKeys = (allPerms || [])
              .filter((item) => item.user_id === p.id)
              .map((item) => item.permission_key);

            const userDeptIds = (allDeptAccess || [])
              .filter((item) => item.user_id === p.id)
              .map((item) => item.department_id);

            let screens = userPermKeys.filter((k) => k.startsWith('screen.')) as ScreenPermissionKey[];
            let actions = userPermKeys.filter((k) => !k.startsWith('screen.')) as ActionPermissionKey[];
            let departmentIds = userDeptIds;

            if (cached) {
              if (cached.screens && cached.screens.length > 0) screens = cached.screens;
              if (cached.actions && cached.actions.length > 0) actions = cached.actions;
              if (cached.departmentIds && cached.departmentIds.length > 0) departmentIds = cached.departmentIds;
            }

            const isSuper = Boolean(p.is_super_admin || p.username === 'admin' || cached?.is_super_admin);

            // إذا كان المستخدم سوبر أدمن، يملك كافة الشاشات والإجراءات والأقسام افتراضياً
            if (isSuper) {
              if (screens.length === 0) screens = allCatalogScreens;
              if (actions.length === 0) actions = allCatalogActions;
              if (departmentIds.length === 0) departmentIds = ['d-waffle', 'd-drinks', 'd-donuts'];
            } else if (screens.length === 0 && actions.length === 0) {
              // إذا كان مستخدماً عادياً بدون صلاحيات مسجلة، نمنحه صلاحيات الكاشير الافتراضية
              const cashierPreset = ROLE_PRESETS.find((pr) => pr.id === 'cashier');
              if (cashierPreset) {
                screens = [...cashierPreset.screens];
                actions = [...cashierPreset.actions];
              }
            }

            return {
              id: p.id,
              branch_id: p.branch_id,
              username: p.username,
              full_name: cached?.full_name || p.full_name || p.username,
              phone: cached?.phone ?? p.phone,
              is_super_admin: isSuper,
              is_active: cached?.is_active ?? Boolean(p.is_active),
              created_at: p.created_at,
              screens,
              actions,
              departmentIds,
            };
          });

          return userList;
        }
      } catch (err) {
        console.warn('Falling back to local users list:', err);
      }
    }

    // الوضع المحلي أو الاحتياطي
    const local = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // ignore
      }
    }

    // تهيئة من MOCK_PERSONAS
    const initialUsers: UserProfileWithPermissions[] = MOCK_PERSONAS.map((m) => ({
      id: m.id,
      branch_id: DEFAULT_BRANCH.id,
      username: m.username,
      full_name: m.full_name,
      phone: '01000000000',
      is_super_admin: m.username === 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      screens: m.permissions.screens,
      actions: m.permissions.actions,
      departmentIds: m.permissions.departmentIds,
    }));

    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  },

  /**
   * إنشاء مستخدم جديد وحفظ صلاحياته
   */
  async createUser(input: {
    username: string;
    full_name: string;
    phone?: string;
    password?: string;
    is_super_admin?: boolean;
    branch_id?: string;
    screens: ScreenPermissionKey[];
    actions: ActionPermissionKey[];
    departmentIds: string[];
  }): Promise<UserProfileWithPermissions> {
    const cleanUsername = input.username.trim().toLowerCase();
    const branchId = input.branch_id || DEFAULT_BRANCH.id;

    let newUserId = 'u-' + Math.random().toString(36).substring(2, 9);

    if (isLiveSupabaseConfigured && supabase) {
      try {
        // إنشاء المستخدم في Supabase Auth
        const email = normalizeUserEmail(cleanUsername);
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password: input.password || '12345678',
          options: {
            data: {
              full_name: input.full_name,
              branch_id: branchId,
            },
          },
        });

        if (authErr && !authErr.message.includes('already registered')) {
          console.warn('Supabase Auth signUp notice:', authErr.message);
        }

        if (authData?.user?.id) {
          newUserId = authData.user.id;
        }

        // إدراج أو تحديث البروفايل في جدول profiles
        const { error: profErr } = await supabase.from('profiles').upsert({
          id: newUserId,
          branch_id: branchId,
          username: cleanUsername,
          full_name: input.full_name,
          phone: input.phone || null,
          is_super_admin: Boolean(input.is_super_admin),
          is_active: true,
        });

        if (profErr) {
          console.error('Error upserting profile in DB:', profErr);
        }

        // حفظ الصلاحيات
        await this.savePermissions(newUserId, {
          screens: input.screens,
          actions: input.actions,
          departmentIds: input.departmentIds,
        });
      } catch (err) {
        console.warn('Error creating user in Supabase, continuing with local store:', err);
      }
    }

    const newUser: UserProfileWithPermissions = {
      id: newUserId,
      branch_id: branchId,
      username: cleanUsername,
      full_name: input.full_name,
      phone: input.phone || null,
      is_super_admin: Boolean(input.is_super_admin),
      is_active: true,
      created_at: new Date().toISOString(),
      screens: input.screens,
      actions: input.actions,
      departmentIds: input.departmentIds,
    };

    // تحديث التخزين المحلي
    const current = await this.getAllUsers();
    const updated = [newUser, ...current.filter((u) => u.id !== newUserId && u.username !== cleanUsername)];
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));

    return newUser;
  },

  /**
   * تحديث البيانات الأساسية لمستخدم (الاسم، الهاتف، الحالة، سوبر أدمن)
   */
  async updateUser(
    userId: string,
    updates: Partial<Pick<UserProfileWithPermissions, 'full_name' | 'phone' | 'is_active' | 'is_super_admin'>>
  ): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: updates.full_name,
            phone: updates.phone,
            is_active: updates.is_active,
            is_super_admin: updates.is_super_admin,
          })
          .eq('id', userId);

        if (error) {
          console.warn('First update attempt notice:', error.message);
          // في حال كان هناك حظر على عمود is_super_admin في الداتابيز، نحدث باقي الحقول
          await supabase
            .from('profiles')
            .update({
              full_name: updates.full_name,
              phone: updates.phone,
              is_active: updates.is_active,
            })
            .eq('id', userId);
        }
      } catch (err) {
        console.warn('Could not update profile in Supabase:', err);
      }
    }

    // تحديث فوري وسريع في التخزين المحلي بدون إعادة جلب من الشبكة
    try {
      const s = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      const current: UserProfileWithPermissions[] = s ? JSON.parse(s) : [];
      const updated = current.map((u) => (u.id === userId ? { ...u, ...updates } : u));
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  /**
   * تحديث شامل لبيانات المستخدم وصلاحياته وأقسامه دفعة واحدة بتنفيذ متوازي فائق السرعة
   */
  async saveFullUser(
    userId: string,
    profileData: {
      full_name: string;
      phone?: string;
      is_active: boolean;
      is_super_admin: boolean;
    },
    permissions: {
      screens: ScreenPermissionKey[];
      actions: ActionPermissionKey[];
      departmentIds: string[];
    }
  ): Promise<void> {
    // 1. تحديث الكاش المحلي فوراً لضمان عدم حدوث أي بطء
    try {
      const s = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      const current: UserProfileWithPermissions[] = s ? JSON.parse(s) : [];
      const existing = current.find((u) => u.id === userId);
      const updatedUser: UserProfileWithPermissions = {
        id: userId,
        branch_id: existing?.branch_id || DEFAULT_BRANCH.id,
        username: existing?.username || '',
        full_name: profileData.full_name,
        phone: profileData.phone || null,
        is_active: profileData.is_active,
        is_super_admin: profileData.is_super_admin,
        screens: permissions.screens,
        actions: permissions.actions,
        departmentIds: permissions.departmentIds,
      };
      const updated = current.some((u) => u.id === userId)
        ? current.map((u) => (u.id === userId ? updatedUser : u))
        : [...current, updatedUser];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 2. التنفيذ بالتوازي على Supabase
    await Promise.allSettled([
      this.updateUser(userId, {
        full_name: profileData.full_name,
        phone: profileData.phone,
        is_active: profileData.is_active,
        is_super_admin: profileData.is_super_admin,
      }),
      this.savePermissions(userId, permissions),
    ]);
  },

  /**
   * حفظ مصفوفة الصلاحيات والأقسام لمستخدم معين
   */
  async savePermissions(
    userId: string,
    perms: {
      screens: ScreenPermissionKey[];
      actions: ActionPermissionKey[];
      departmentIds: string[];
    }
  ): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      const client = supabase;
      try {
        const allPermKeys = [...perms.screens, ...perms.actions];

        // استدعاء متوازي لحذف وإضافة الصلاحيات وأقسام المطبخ دفعة واحدة
        await Promise.allSettled([
          client
            .from('user_permissions')
            .delete()
            .eq('user_id', userId)
            .then(() => {
              if (allPermKeys.length > 0) {
                return client.from('user_permissions').insert(
                  allPermKeys.map((key) => ({
                    user_id: userId,
                    permission_key: key,
                  }))
                );
              }
            }),
          client
            .from('user_department_access')
            .delete()
            .eq('user_id', userId)
            .then(() => {
              if (perms.departmentIds.length > 0) {
                return client.from('user_department_access').insert(
                  perms.departmentIds.map((deptId) => ({
                    user_id: userId,
                    department_id: deptId,
                  }))
                );
              }
            }),
        ]);
      } catch (err) {
        console.warn('Error saving permissions to Supabase:', err);
      }
    }

    // تحديث التخزين المحلي فورياً
    try {
      const s = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      const current: UserProfileWithPermissions[] = s ? JSON.parse(s) : [];
      const updated = current.map((u) =>
        u.id === userId
          ? {
              ...u,
              screens: perms.screens,
              actions: perms.actions,
              departmentIds: perms.departmentIds,
            }
          : u
      );
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  /**
   * حذف مستخدم
   */
  async deleteUser(userId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.warn('Could not delete user from DB:', err);
      }
    }

    const current = await this.getAllUsers();
    const updated = current.filter((u) => u.id !== userId);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
  },
};
