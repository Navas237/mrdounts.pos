import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { NAV_GROUPS, BRAND } from '@/config/nav';
import { LogOut, PanelRightClose } from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onToggle }) => {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { canAccessScreen, canAccessDepartment } = usePermissions();

  // تصفية الروابط بحسب صلاحيات الموظف المسجل
  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.requiredScreenPerm) return canAccessScreen(item.requiredScreenPerm);
      if (item.requiredDeptId) return canAccessDepartment(item.requiredDeptId);
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  const displayName = user?.full_name || 'أحمد محمود';
  const initial = displayName.trim().charAt(0) || 'م';
  const roleTitle = user?.is_super_admin ? 'مدير النظام' : 'كاشير';

  return (
    <aside className={`shell-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      {/* 1. الترويسة والعلامة التجارية + زر إغلاق السايدبار */}
      <div className="brand-section flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden flex-1"
          onClick={() => nav('/')}
        >
          <div className="brand-mark-box">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-white stroke-[2.5]">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </div>
          <div className="overflow-hidden">
            <strong className="block text-xs font-extrabold text-ink leading-tight tracking-tight">
              {BRAND.name}
            </strong>
         
          </div>
        </div>

        {/* زر طي وإغلاق السايدبار */}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
            title="طي القائمة الجانبية"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

    

      {/* 3. قائمة التصفح المجمعة — اسم الشاشة فقط وبخط صغير بدون أي وصف */}
      <nav className="sidebar-nav-scroll no-scrollbar">
        {filteredGroups.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active-link' : ''}`
                } 
              >
                <div className='flex gap-1 p-1 text-bold'>

                <item.icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                <span className="truncate text-[14px] font-bold">{item.label}</span>
                </div>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* 4. تذييل السايدبار */}
      <div className="sidebar-footer">
        <div className="p-1.5 rounded-lg bg-surface-2 border border-line flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-brand-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
              {initial}
            </div>
            <div className="overflow-hidden">
              <strong className="block text-xs font-bold text-ink truncate">
                {displayName}
              </strong>
              <small className="block text-xs text-ink-muted truncate">
                {roleTitle}
              </small>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="p-1 rounded-md hover:bg-rose-50 text-ink-muted hover:text-rose-600 transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
