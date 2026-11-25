import React, { useState, useEffect } from 'react';
import {
  userService,
  UserProfileWithPermissions,
  PERMISSION_CATALOG,
  ROLE_PRESETS,
} from '@/services/user.service';
import { Department } from '@/types/database';
import { ScreenPermissionKey, ActionPermissionKey } from '@/types/permissions';
import { useAuthStore } from '@/hooks/useAuth';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Check,
  X,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Power,
  Crown,
  ChefHat,
  Monitor,
  Sparkles,
  Key,
} from 'lucide-react';

interface UsersManagementProps {
  departments: Department[];
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ departments }) => {
  const [users, setUsers] = useState<UserProfileWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // المودال الموحد للإضافة أو التعديل (يشمل البيانات الأساسية + الشاشات + الأقسام + الصلاحيات)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // حقول النموذج
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // مصفوفة الصلاحيات والشاشات والأقسام داخل نفس النموذج
  const [selectedScreens, setSelectedScreens] = useState<ScreenPermissionKey[]>([]);
  const [selectedActions, setSelectedActions] = useState<ActionPermissionKey[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // جلب المستخدمين
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // فلترة المستخدمين
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return u.is_active;
    if (statusFilter === 'inactive') return !u.is_active;
    return true;
  });

  // فتح مودال إضافة مستخدم جديد
  const handleOpenAdd = () => {
    setEditingUserId(null);
    setFullName('');
    setUsername('');
    setPassword('12345678');
    setPhone('');
    setIsSuperAdmin(false);
    setIsActive(true);

    // افتراضي كاشير
    const defaultPreset = ROLE_PRESETS.find((p) => p.id === 'cashier');
    setSelectedScreens(defaultPreset ? [...defaultPreset.screens] : ['screen.cashier']);
    setSelectedActions(defaultPreset ? [...defaultPreset.actions] : ['order.create']);
    setSelectedDeptIds([]);
    setIsModalOpen(true);
  };

  // فتح مودال تعديل مستخدم قائم (شامل البيانات والشاشات والصلاحيات معاً)
  const handleOpenEdit = (user: UserProfileWithPermissions) => {
    setEditingUserId(user.id);
    setFullName(user.full_name);
    setUsername(user.username);
    setPassword('');
    setPhone(user.phone || '');
    setIsSuperAdmin(user.is_super_admin);
    setIsActive(user.is_active);

    const allScreens = PERMISSION_CATALOG.filter((p) => p.kind === 'screen').map((p) => p.key as ScreenPermissionKey);
    const allActions = PERMISSION_CATALOG.filter((p) => p.kind === 'action').map((p) => p.key as ActionPermissionKey);
    const allDeptIds = departments.map((d) => d.id);

    if (user.is_super_admin) {
      // السوبر أدمن يحصل على كافة الشاشات والإجراءات والأقسام افتراضياً
      setSelectedScreens(user.screens && user.screens.length > 0 ? [...user.screens] : allScreens);
      setSelectedActions(user.actions && user.actions.length > 0 ? [...user.actions] : allActions);
      setSelectedDeptIds(user.departmentIds && user.departmentIds.length > 0 ? [...user.departmentIds] : allDeptIds);
    } else {
      // المستخدم العادي
      const defaultCashier = ROLE_PRESETS.find((p) => p.id === 'cashier');
      setSelectedScreens(
        user.screens && user.screens.length > 0
          ? [...user.screens]
          : defaultCashier
          ? [...defaultCashier.screens]
          : ['screen.cashier', 'screen.drawer', 'screen.customers']
      );
      setSelectedActions(
        user.actions && user.actions.length > 0
          ? [...user.actions]
          : defaultCashier
          ? [...defaultCashier.actions]
          : ['order.create', 'shift.open', 'shift.close']
      );
      setSelectedDeptIds(user.departmentIds ? [...user.departmentIds] : []);
    }
    setIsModalOpen(true);
  };

  // تبديل صفة السوبر أدمن مع تحديث الصلاحيات
  const handleToggleSuperAdmin = (checked: boolean) => {
    setIsSuperAdmin(checked);
    if (checked) {
      const allScreens = PERMISSION_CATALOG.filter((p) => p.kind === 'screen').map((p) => p.key as ScreenPermissionKey);
      const allActions = PERMISSION_CATALOG.filter((p) => p.kind === 'action').map((p) => p.key as ActionPermissionKey);
      setSelectedScreens(allScreens);
      setSelectedActions(allActions);
      setSelectedDeptIds(departments.map((d) => d.id));
    }
  };

  // تطبيق قالب سريع
  const handleApplyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedScreens([...preset.screens]);
    setSelectedActions([...preset.actions]);

    if (preset.departmentIds.length > 0) {
      const matchedDeptIds = departments
        .filter((d) => {
          if (preset.id === 'waffle_chef') return d.name.includes('وافل');
          if (preset.id === 'barista') return d.name.includes('مشروب') || d.name.includes('عصير');
          if (preset.id === 'donut_chef') return d.name.includes('دونت');
          return true;
        })
        .map((d) => d.id);

      setSelectedDeptIds(matchedDeptIds.length > 0 ? matchedDeptIds : preset.departmentIds);
    } else {
      setSelectedDeptIds([]);
    }
  };

  // تحديد الكل
  const handleSelectAll = () => {
    const allScreens = PERMISSION_CATALOG.filter((p) => p.kind === 'screen').map(
      (p) => p.key as ScreenPermissionKey
    );
    const allActions = PERMISSION_CATALOG.filter((p) => p.kind === 'action').map(
      (p) => p.key as ActionPermissionKey
    );
    setSelectedScreens(allScreens);
    setSelectedActions(allActions);
    setSelectedDeptIds(departments.map((d) => d.id));
  };

  // إلغاء تحديد الكل
  const handleClearAll = () => {
    setSelectedScreens([]);
    setSelectedActions([]);
    setSelectedDeptIds([]);
  };

  // تبديل مجموعة إجراءات كاملة
  const handleToggleActionGroup = (groupName: string) => {
    const groupItems = PERMISSION_CATALOG.filter((p) => p.group === groupName).map(
      (p) => p.key as ActionPermissionKey
    );
    const allSelected = groupItems.every((k) => selectedActions.includes(k));

    if (allSelected) {
      setSelectedActions((prev) => prev.filter((k) => !groupItems.includes(k)));
    } else {
      setSelectedActions((prev) => [...new Set([...prev, ...groupItems])]);
    }
  };

  // حفظ المستخدم (بيانات + صلاحيات)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('يرجى إدخال اسم الموظف');
      return;
    }
    if (!editingUserId && !username.trim()) {
      alert('يرجى إدخال اسم المستخدم للدخول');
      return;
    }

    setIsSaving(true);
    try {
      const allScreens = PERMISSION_CATALOG.filter((p) => p.kind === 'screen').map((p) => p.key as ScreenPermissionKey);
      const allActions = PERMISSION_CATALOG.filter((p) => p.kind === 'action').map((p) => p.key as ActionPermissionKey);
      const allDeptIds = departments.map((d) => d.id);

      const finalScreens = isSuperAdmin ? allScreens : selectedScreens;
      const finalActions = isSuperAdmin ? allActions : selectedActions;
      const finalDepts = isSuperAdmin ? allDeptIds : selectedDeptIds;

      if (editingUserId) {
        // تحديث فوري ومتفائل في واجهة المستخدم في 0 جزء من الثانية بدون أي لاج
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUserId
              ? {
                  ...u,
                  full_name: fullName.trim(),
                  phone: phone.trim() || undefined,
                  is_active: isActive,
                  is_super_admin: isSuperAdmin,
                  screens: finalScreens,
                  actions: finalActions,
                  departmentIds: finalDepts,
                }
              : u
          )
        );

        // إذا كان المستخدم المعدل هو المستخدم المسجل حالياً، نحدث الجلسة فوراً ليتحدث السايدبار والشاشات
        const currentSession = useAuthStore.getState().session;
        if (
          currentSession?.profile?.id === editingUserId ||
          currentSession?.profile?.username === username
        ) {
          useAuthStore.getState().updateSession((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              profile: {
                ...prev.profile,
                full_name: fullName.trim(),
                is_super_admin: isSuperAdmin,
              },
              permissions: {
                screens: finalScreens,
                actions: finalActions,
                departmentIds: finalDepts,
              },
            };
          });
        }

        setIsModalOpen(false);

        // حفظ في الخلفية
        await userService.saveFullUser(
          editingUserId,
          {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            is_active: isActive,
            is_super_admin: isSuperAdmin,
          },
          {
            screens: finalScreens,
            actions: finalActions,
            departmentIds: finalDepts,
          }
        );
      } else {
        const newUser = await userService.createUser({
          username: username.trim(),
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          password: password.trim() || '12345678',
          is_super_admin: isSuperAdmin,
          screens: finalScreens,
          actions: finalActions,
          departmentIds: finalDepts,
        });

        setUsers((prev) => [newUser, ...prev]);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      alert('خطأ أثناء حفظ المستخدم: ' + (err.message || 'حدث خطأ'));
    } finally {
      setIsSaving(false);
    }
  };

  // تبديل نشاط الموظف (سريع)
  const handleToggleStatus = async (user: UserProfileWithPermissions) => {
    try {
      await userService.updateUser(user.id, {
        is_active: !user.is_active,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // حذف مستخدم
  const handleDeleteUser = async (user: UserProfileWithPermissions) => {
    if (confirm(`هل أنت متأكد من حذف حساب (${user.full_name} - @${user.username})؟`)) {
      try {
        await userService.deleteUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } catch (err) {
        console.error('Failed to delete user:', err);
      }
    }
  };

  // مجموعات الإجراءات
  const screenPerms = PERMISSION_CATALOG.filter((p) => p.kind === 'screen');
  const actionGroups = [
    { title: 'الدرج والشفتات', groupName: 'الشفت والدرج', items: PERMISSION_CATALOG.filter((p) => p.group === 'الشفت والدرج') },
    { title: 'الطلبات والمبيعات', groupName: 'الطلبات والمبيعات', items: PERMISSION_CATALOG.filter((p) => p.group === 'الطلبات والمبيعات') },
    { title: 'المطبخ والتحضير', groupName: 'المطبخ والتحضير', items: PERMISSION_CATALOG.filter((p) => p.group === 'المطبخ والتحضير') },
    { title: 'العملاء', groupName: 'العملاء', items: PERMISSION_CATALOG.filter((p) => p.group === 'العملاء') },
    { title: 'المنيو والإدارة', groupName: 'الإدارة والنظام', items: PERMISSION_CATALOG.filter((p) => p.group === 'الإدارة والنظام') },
  ];

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* 1. الترويسة الرئيسية */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-ink">المستخدمون ومصفوفة الصلاحيات</h3>
            <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 text-[11px] font-bold border border-brand-200">
              {users.length} مستخدم
            </span>
          </div>
         
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchUsers}
            className="p-1.5 rounded-lg border border-line hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إضافة مستخدم</span>
          </button>
        </div>
      </div>

      {/* 2. شريط البحث والتصفية */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم، اسم المستخدم، أو رقم الهاتف..."
            className="w-full pr-8 pl-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-medium text-ink placeholder:text-ink-muted focus:border-brand-700 outline-none"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === 'all'
                ? 'bg-brand-800 text-white'
                : 'border border-line text-ink-muted hover:bg-surface-2'
            }`}
          >
            الكل ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-700 text-white'
                : 'border border-line text-ink-muted hover:bg-surface-2'
            }`}
          >
            النشطون ({users.filter((u) => u.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-rose-700 text-white'
                : 'border border-line text-ink-muted hover:bg-surface-2'
            }`}
          >
            الموقوفون ({users.filter((u) => !u.is_active).length})
          </button>
        </div>
      </div>

      {/* 3. جدول المستخدمين (Data Table بنمط زوحليقة V2) */}
      {loading ? (
        <div className="py-12 text-center text-xs text-ink-muted">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-800" />
          <span>جاري تحميل المستخدمين والصلاحيات…</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-line rounded-xl bg-surface-2/20 space-y-2">
          <Users className="w-8 h-8 mx-auto text-ink-muted" />
          <p className="text-xs font-bold text-ink">لا يوجد مستخدمون</p>
          <p className="text-[11px] text-ink-muted">أضف أول مستخدم من زر "إضافة مستخدم"</p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-800 text-white text-xs font-bold hover:bg-brand-900 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إضافة مستخدم الآن</span>
          </button>
        </div>
      ) : (
        <div className="border border-line rounded-xl overflow-hidden bg-surface shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-surface-2/60 border-b border-line text-ink font-extrabold">
                <tr>
                  <th className="p-3">الاسم / اسم الدخول</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">الرتبة / الدور</th>
                  <th className="p-3">الشاشات والصلاحيات المسموحة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredUsers.map((user) => {
                  const allowedDepts = departments.filter((d) => user.departmentIds.includes(d.id));

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-surface-2/40 transition-colors ${
                        !user.is_active ? 'opacity-60 bg-surface-2/20' : ''
                      }`}
                    >
                      {/* الاسم */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 ${
                              user.is_super_admin
                                ? 'bg-gradient-to-br from-amber-500 to-amber-700'
                                : user.is_active
                                ? 'bg-brand-800'
                                : 'bg-ink-muted'
                            }`}
                          >
                            {user.full_name.charAt(0) || user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-ink block">{user.full_name}</span>
                            <span className="text-[10px] text-ink-muted font-mono block" dir="ltr">
                              @{user.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* الهاتف */}
                      <td className="p-3 text-ink-muted font-mono">
                        {user.phone || '—'}
                      </td>

                      {/* الدور */}
                      <td className="p-3">
                        {user.is_super_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>سوبر أدمن</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-surface-2 text-ink border border-line">
                            <ShieldCheck className="w-3 h-3 text-brand-800" />
                            <span>صلاحيات مخصصة</span>
                          </span>
                        )}
                      </td>

                      {/* الشاشات والصلاحيات (عمود تفصيلي مطابق لزوحليقة) */}
                      <td className="p-3">
                        <div className="text-[11px] space-y-0.5">
                          <span className="text-ink font-semibold block">
                            {user.is_super_admin
                              ? 'كامل الشاشات · كامل الصلاحيات'
                              : `${user.screens.length} شاشات · ${user.actions.length} صلاحيات إجرائية`}
                          </span>
                          {!user.is_super_admin && allowedDepts.length > 0 && (
                            <span className="text-[10px] text-brand-800 font-medium block">
                              🍳 مطبخ: {allowedDepts.map((d) => d.name).join('، ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* الحالة */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            user.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {user.is_active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>

                      {/* الإجراءات */}
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-2 border border-line text-ink font-bold text-xs flex items-center gap-1 transition-colors"
                            title="تعديل الحساب والشاشات والصلاحيات"
                          >
                            <Edit2 className="w-3 h-3 text-brand-800" />
                            <span>تعديل</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              user.is_active
                                ? 'bg-surface hover:bg-amber-50 text-amber-700 border-line'
                                : 'bg-surface hover:bg-emerald-50 text-emerald-700 border-line'
                            }`}
                            title={user.is_active ? 'إيقاف المستخدم' : 'تفعيل المستخدم'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 rounded-lg bg-surface hover:bg-rose-50 text-rose-600 border border-line transition-colors"
                            title="حذف المستخدم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          المودال الموحد والشامل (Wide Modal على نمط زوحليقة V2)
          يشمل: البيانات الأساسية + الشاشات المسموحة + أقسام المطبخ + صلاحيات العمليات
          ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 w-full max-w-4xl shadow-2xl space-y-4 my-6 max-h-[92vh] flex flex-col animate-in fade-in">
            {/* ترويسة المودال */}
            <div className="flex items-center justify-between border-b border-line pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-800 text-white flex items-center justify-center font-bold">
                  {editingUserId ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base text-ink">
                    {editingUserId ? `تعديل المستخدم: ${fullName}` : 'إضافة مستخدم جديد وتحديد صلاحياته'}
                  </h4>
                  <span className="text-[11px] text-ink-muted">
                    يُنشأ حساب الدخول مع تحديد الشاشات المصرح بها وصلاحيات العمليات الإجرائية المباشرة
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* النموذج القابل للتمرير */}
            <form onSubmit={handleSubmitForm} className="overflow-y-auto space-y-4 pr-1 pl-1 flex-1">
              {/* 1. البيانات الأساسية (Grid 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-2/30 border border-line">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">اسم الموظف الكامل:</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: مينا مجدي، أحمد كاشير"
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:border-brand-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">رقم الهاتف (اختياري):</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono text-ink focus:border-brand-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">
                    اسم المستخدم للدخول (Username بالإنجليزية):
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUserId)}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    placeholder="مثال: mina_cashier"
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink focus:border-brand-700 outline-none disabled:bg-surface-2"
                  />
                  <span className="text-[10px] text-ink-muted mt-0.5 block">
                    يستخدم هذا الاسم لتسجيل الدخول تلقائياً مع @mrdounts.com
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-1">
                    {editingUserId ? 'كلمة المرور (اتركها فارغة للإبقاء على الحالية):' : 'كلمة المرور (6+ أحرف):'}
                  </label>
                  <input
                    type="password"
                    required={!editingUserId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUserId ? '••••••••' : 'أدخل كلمة مرور الحساب'}
                    className="w-full px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono text-ink focus:border-brand-700 outline-none"
                  />
                </div>

                <div className="col-span-full pt-1 flex flex-wrap items-center gap-4 border-t border-line/60">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSuperAdmin}
                      onChange={(e) => handleToggleSuperAdmin(e.target.checked)}
                      className="rounded border-line text-brand-800"
                    />
                    <span className="text-xs font-bold text-ink flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span>صلاحية سوبر أدمن (كامل الصلاحيات والشاشات)</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-line text-brand-800"
                    />
                    <span className="text-xs font-bold text-ink">حساب نشط ومسموح له بالدخول</span>
                  </label>
                </div>
              </div>

              {/* شارة توضيحية عندما تكون صفة سوبر أدمن مفعلة */}
              {isSuperAdmin && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      صلاحية سوبر أدمن مفعلة: تم تحديد كامل الشاشات والصلاحيات تلقائياً (يمكنك التخصيص والتحكم أدناه).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSuperAdmin(false)}
                    className="text-[11px] px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-800 font-bold hover:bg-amber-100"
                  >
                    تخصيص يدوي
                  </button>
                </div>
              )}

              {/* شريط القوالب السريعة بزر واحد (Quick Presets) */}
                  <div className="p-3 rounded-xl bg-surface-2/40 border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-ink flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>تطبيق قالب صلاحيات سريع:</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-surface-2 text-ink border border-line font-bold"
                        >
                          تحديد الكل
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="text-[11px] px-2 py-0.5 rounded bg-surface hover:bg-rose-50 text-rose-600 border border-line font-bold"
                        >
                          إلغاء الكل
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className="px-2.5 py-1 rounded-lg bg-surface hover:bg-brand-50 hover:border-brand-300 border border-line text-xs font-bold text-ink transition-colors shadow-2xs"
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. قسم: الشاشات المسموحة (Screens Editor) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-line pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-brand-800" />
                        <h5 className="text-xs font-extrabold text-ink">
                          الشاشات المسموحة ({selectedScreens.length} شاشة محددة)
                        </h5>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedScreens(
                              PERMISSION_CATALOG.filter((p) => p.kind === 'screen').map(
                                (p) => p.key as ScreenPermissionKey
                              )
                            )
                          }
                          className="text-[10px] text-ink-muted hover:text-ink font-bold"
                        >
                          الكل
                        </button>
                        <span className="text-[10px] text-ink-muted">·</span>
                        <button
                          type="button"
                          onClick={() => setSelectedScreens([])}
                          className="text-[10px] text-rose-600 hover:text-rose-700 font-bold"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {screenPerms.map((perm) => {
                        const isChecked = selectedScreens.includes(perm.key as ScreenPermissionKey);
                        return (
                          <label
                            key={perm.key}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                              isChecked
                                ? 'bg-brand-50/60 border-brand-300 text-brand-900 shadow-2xs'
                                : 'bg-surface border-line text-ink hover:border-line-hover'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const key = perm.key as ScreenPermissionKey;
                                if (e.target.checked) {
                                  setSelectedScreens((prev) => [...prev, key]);
                                } else {
                                  setIsSuperAdmin(false);
                                  setSelectedScreens((prev) => prev.filter((k) => k !== key));
                                }
                              }}
                              className="mt-0.5 rounded border-line text-brand-800"
                            />
                            <div className="flex-1">
                              <strong className="text-xs font-bold block">{perm.label}</strong>
                              <span className="text-[10px] text-ink-muted block mt-0.5">
                                {perm.description}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. قسم: شاشات المطبخ والأقسام المسموح برؤيتها */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-line pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="w-3.5 h-3.5 text-brand-800" />
                        <h5 className="text-xs font-extrabold text-ink">
                          شاشات وأقسام المطبخ المسموح برؤيتها ({selectedDeptIds.length} أقسام محددة)
                        </h5>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedDeptIds(departments.map((d) => d.id))}
                          className="text-[10px] text-ink-muted hover:text-ink font-bold"
                        >
                          تحديد كافة الأقسام
                        </button>
                        <span className="text-[10px] text-ink-muted">·</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDeptIds([])}
                          className="text-[10px] text-rose-600 hover:text-rose-700 font-bold"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {departments.map((dept) => {
                        const isChecked = selectedDeptIds.includes(dept.id);
                        return (
                          <label
                            key={dept.id}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                              isChecked
                                ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-2xs'
                                : 'bg-surface border-line text-ink hover:border-line-hover'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDeptIds((prev) => [...prev, dept.id]);
                                } else {
                                  setIsSuperAdmin(false);
                                  setSelectedDeptIds((prev) => prev.filter((id) => id !== dept.id));
                                }
                              }}
                              className="mt-0.5 rounded border-line text-emerald-700"
                            />
                            <div className="flex-1">
                              <strong className="text-xs font-bold block">مطبخ: {dept.name}</strong>
                              <span className="text-[10px] text-ink-muted block mt-0.5">
                                {dept.behavior === 'donut_box'
                                  ? 'تجميع بوكسات دونتس'
                                  : dept.behavior === 'customizable'
                                  ? 'صنف مخصص وإضافات'
                                  : 'مشروبات وبسيط'}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. قسم: صلاحيات العمليات والبيانات (Caps Editor) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-line pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-brand-800" />
                        <h5 className="text-xs font-extrabold text-ink">
                          صلاحيات العمليات والبيانات التفصيلية ({selectedActions.length} صلاحية محددة)
                        </h5>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedActions(
                              PERMISSION_CATALOG.filter((p) => p.kind === 'action').map(
                                (p) => p.key as ActionPermissionKey
                              )
                            )
                          }
                          className="text-[10px] text-ink-muted hover:text-ink font-bold"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-[10px] text-ink-muted">·</span>
                        <button
                          type="button"
                          onClick={() => setSelectedActions([])}
                          className="text-[10px] text-rose-600 hover:text-rose-700 font-bold"
                        >
                          إلغاء الكل
                        </button>
                      </div>
                    </div>

                    {actionGroups.map((group) => (
                      <div
                        key={group.title}
                        className="p-3 rounded-xl bg-surface-2/40 border border-line space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-brand-800">
                            {group.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleActionGroup(group.groupName)}
                            className="text-[10px] text-ink-muted hover:text-brand-800 font-bold"
                          >
                            تحديد / إلغاء القسم
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.items.map((action) => {
                            const isChecked = selectedActions.includes(action.key as ActionPermissionKey);
                            return (
                              <label
                                key={action.key}
                                className={`p-2 rounded-lg border cursor-pointer transition-all flex items-start gap-2 ${
                                  isChecked
                                    ? 'bg-surface border-brand-300 text-ink shadow-2xs'
                                    : 'bg-surface/60 border-line text-ink-muted hover:border-line-hover'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const key = action.key as ActionPermissionKey;
                                    if (e.target.checked) {
                                      setSelectedActions((prev) => [...prev, key]);
                                    } else {
                                      setIsSuperAdmin(false);
                                      setSelectedActions((prev) => prev.filter((k) => k !== key));
                                    }
                                  }}
                                  className="mt-0.5 rounded border-line text-brand-800"
                                />
                                <div className="flex-1">
                                  <strong className="text-xs font-bold text-ink block">{action.label}</strong>
                                  <span className="text-[10px] text-ink-muted block mt-0.5">
                                    {action.description}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-line sticky bottom-0 bg-surface/95 backdrop-blur-xs py-2 shrink-0">
              <div className="text-xs text-ink font-bold flex items-center gap-1.5 flex-wrap">
                <span>المحدد:</span>
                <span className="text-brand-800 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {selectedScreens.length} شاشات
                </span>
                <span>·</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {selectedDeptIds.length} أقسام مطبخ
                </span>
                <span>·</span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {selectedActions.length} إجراءات
                </span>
                {isSuperAdmin && (
                  <span className="text-[11px] text-amber-700 font-bold bg-amber-100/60 px-2 py-0.5 rounded">
                    (👑 سوبر أدمن)
                  </span>
                )}
              </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-line text-xs font-bold text-ink hover:bg-surface-2 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-1.5 rounded-lg bg-brand-800 hover:bg-brand-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الحفظ…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ المستخدم والصلاحيات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
