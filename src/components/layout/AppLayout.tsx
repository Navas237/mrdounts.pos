import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/hooks/useTheme';
import { NAV_GROUPS, BRAND } from '@/config/nav';
import {
  Home,
  ShoppingCart,
  Layers,
  Coins,
  LayoutGrid,
  X,
  LogOut,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, branch, logout } = useAuth();
  const { canAccessScreen, canAccessDepartment } = usePermissions();
  const { theme } = useTheme();
  const location = useLocation();
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  // حالة فتح وإغلاق السايدبار على شاشات الكمبيوتر
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('mr_donuts_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('mr_donuts_sidebar_open', String(next));
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setShowMobileDrawer(false);
  }, [location.pathname]);

  if (!user) return <Outlet />;

  // تصفية الروابط للقائمة الجانبية
  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.requiredScreenPerm) return canAccessScreen(item.requiredScreenPerm);
      if (item.requiredDeptId) return canAccessDepartment(item.requiredDeptId);
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="shell-container text-ink transition-colors">
      {/* 1. السايدبار المكتبي القابل للفتح والإغلاق بنقرة زر */}
      <Sidebar
        isOpen={isDesktopSidebarOpen}
        onToggle={toggleDesktopSidebar}
      />

      {/* 2. مساحة العرض الرئيسية + الهيدر العلوي */}
      <div className="main-view-wrapper">
        <Topbar
          onOpenMobileDrawer={() => setShowMobileDrawer(true)}
          onToggleDesktopSidebar={toggleDesktopSidebar}
          isDesktopSidebarOpen={isDesktopSidebarOpen}
        />

        <main className="shell-content-container">
          <Outlet />
        </main>
      </div>

      {/* 3. نافذة الدروار للموبايل (Mobile Slide-in Drawer) */}
      {showMobileDrawer && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex animate-in fade-in"
          onClick={() => setShowMobileDrawer(false)}
        >
          <aside
            className="w-[260px] max-w-[85vw] h-full bg-surface border-l border-line p-3.5 overflow-y-auto flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* ترويسة القائمة */}
              <div className="flex items-center justify-between pb-2.5 border-b border-line mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-white stroke-[2.5]">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  </div>
                  <div>
                    <strong className="block text-xs font-extrabold text-ink">{BRAND.name}</strong>
                    <small className="block text-[10px] text-ink-muted">{branch?.name || BRAND.branch}</small>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1 rounded-md hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* مجموعات الروابط — أسماء الشاشات فقط وبخط صغير بدون أوصاف */}
              <div className="space-y-3">
                {filteredGroups.map((group) => (
                  <div key={group.title} className="space-y-0.5">
                    <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider px-2 py-0.5">
                      {group.title}
                    </div>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setShowMobileDrawer(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            isActive
                              ? 'bg-brand-700 text-white shadow-2xs'
                              : 'text-ink hover:bg-surface-2'
                          }`
                        }
                      >
                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* زر تسجيل الخروج في أسفل قائمة الموبايل */}
            <div className="pt-2.5 border-t border-line mt-4">
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 4. شريط الملاحة السفلي الذكي للموبايل (Bottom Nav) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/98 backdrop-blur-md border-t border-line px-1 py-1 flex items-center justify-around shadow-xs">
        {/* 1. الرئيسية */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-center transition-colors ${
              isActive ? 'text-brand-700 font-bold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Home className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </NavLink>

        {/* 2. الكاشير */}
        {canAccessScreen('screen.cashier') && (
          <NavLink
            to="/cashier"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-center transition-colors ${
                isActive ? 'text-brand-700 font-bold' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">الكاشير</span>
          </NavLink>
        )}

        {/* 3. تجميع الدونتس */}
        {canAccessDepartment('d-donuts') && (
          <NavLink
            to="/kitchen/donuts"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-center transition-colors ${
                isActive ? 'text-brand-700 font-bold' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Layers className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">المطبخ</span>
          </NavLink>
        )}

        {/* 4. الشفت والدرج */}
        {canAccessScreen('screen.drawer') && (
          <NavLink
            to="/shifts"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-center transition-colors ${
                isActive ? 'text-brand-700 font-bold' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            <Coins className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">الدرج</span>
          </NavLink>
        )}

        {/* 5. فتح القائمة الكاملة */}
        <button
          type="button"
          onClick={() => setShowMobileDrawer(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-ink-muted hover:text-ink transition-colors"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المزيد</span>
        </button>
      </nav>
    </div>
  );
};
