import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/hooks/useTheme';
import { ALL_SCREENS } from '@/config/screens';
import {
  Sun,
  Moon,
  LogOut,
  Store,
  Clock,
  ShieldCheck,
  ChevronDown,
  Calculator,
  Flame,
  Coffee,
  Layers,
  PackageCheck,
  Coins,
  Users,
  Settings,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Calculator,
  Flame,
  Coffee,
  Layers,
  PackageCheck,
  Coins,
  Users,
  Settings,
};

export const Navbar: React.FC = () => {
  const { user, branch, activeShift, logout } = useAuth();
  const { canAccessScreen, canAccessDepartment } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [showStationsMenu, setShowStationsMenu] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const stationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stationsRef.current && !stationsRef.current.contains(event.target as Node)) {
        setShowStationsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowMobileDrawer(false);
    setShowStationsMenu(false);
  }, [location.pathname]);

  if (!user || !branch) return null;

  const accessibleScreens = ALL_SCREENS.filter((s) => {
    if (s.requiredScreenPerm) return canAccessScreen(s.requiredScreenPerm);
    if (s.requiredDeptId) return canAccessDepartment(s.requiredDeptId);
    return false;
  });

  const currentScreen = accessibleScreens.find((s) =>
    s.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(s.path)
  );

  const CurrentIcon = currentScreen ? ICON_MAP[currentScreen.icon] || Store : Store;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-line shadow-2xs transition-colors">
        <div className="max-w-[1560px] mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-13 sm:h-14 gap-2">
            
            {/* 1. اليمين: اللوجو الهندسي واسم الفرع وحالة الشفت */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-white stroke-[2.5]">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                </div>
                <div className="shrink-0">
                  <span className="font-black text-sm text-brand-700 tracking-tight leading-none block whitespace-nowrap">
                    MR DONUTS
                  </span>
                  <span className="text-[10px] text-ink-muted flex items-center gap-1 font-semibold whitespace-nowrap mt-0.5">
                    <Store className="w-2.5 h-2.5 text-brand-700 shrink-0" />
                    {branch.name}
                  </span>
                </div>
              </Link>

              {/* مؤشر حالة الشفت */}
              <div className="hidden lg:flex items-center mr-1 shrink-0">
                {activeShift?.status === 'open' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>الدرج مفتوح</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-surface-2 text-ink-muted border border-line">
                    <Clock className="w-2.5 h-2.5" />
                    <span>الدرج مغلق</span>
                  </span>
                )}
              </div>
            </div>

            {/* 2. المنتصف: مبدل المحطات الذكي */}
            {/* <nav className="hidden 2xl:flex items-center gap-1 shrink-0">
              {accessibleScreens.map((screen) => {
                const Icon = ICON_MAP[screen.icon] || Store;
                const isActive =
                  screen.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(screen.path);

                const label =
                  screen.requiredScreenPerm && SHORT_TITLES[screen.requiredScreenPerm]
                    ? SHORT_TITLES[screen.requiredScreenPerm]
                    : screen.title.replace('شاشة ', '');

                return (
                  <Link
                    key={screen.id}
                    to={screen.path}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                      isActive
                        ? 'bg-brand-700 text-white font-bold'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav> */}

            {/* على الشاشات المتوسطة (md إلى xl): قائمة منسدلة أنيقة */}
            <div className="hidden md:flex 2xl:hidden relative shrink-0" ref={stationsRef}>
              <button
                type="button"
                onClick={() => setShowStationsMenu(!showStationsMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink text-xs font-bold transition-colors"
              >
                <CurrentIcon className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                <span>
                  المحطة:{' '}
                  <strong className="text-brand-900 font-bold">
                    {currentScreen ? currentScreen.title.replace('شاشة ', '') : 'الرئيسية'}
                  </strong>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-muted mr-1" />
              </button>

              {showStationsMenu && (
                <div className="absolute right-0 mt-1.5 w-60 rounded-lg bg-surface border border-line shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-ink-muted border-b border-line mb-0.5">
                    محطات العمل:
                  </div>
                  {accessibleScreens.map((screen) => {
                    const Icon = ICON_MAP[screen.icon] || Store;
                    const isActive =
                      screen.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(screen.path);

                    return (
                      <Link
                        key={screen.id}
                        to={screen.path}
                        onClick={() => setShowStationsMenu(false)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-brand-700 text-white font-bold'
                            : 'hover:bg-surface-2 text-ink'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{screen.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. اليسار: تبديل الثيم، تبديل الأدوار، وزر الخروج */}
            <div className="flex items-center gap-1 shrink-0">
              
              <button
                type="button"
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors flex items-center justify-center shrink-0"
                title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
              >
                {theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                )}
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line bg-surface text-xs font-semibold text-ink shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                <span className="font-bold">{user.full_name?.split(' ')[0] || user.username}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-8 h-8 rounded-lg border border-line bg-surface hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-ink-muted transition-colors flex items-center justify-center shrink-0"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowMobileDrawer(!showMobileDrawer)}
                className="md:hidden w-8 h-8 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink flex items-center justify-center shrink-0"
                aria-label="قائمة المحطات"
              >
                {showMobileDrawer ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* نافذة المحطات للموبايل (Mobile Stations Drawer) */}
      {showMobileDrawer && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex flex-col justify-end animate-in fade-in">
          <div className="bg-surface rounded-t-xl border-t border-line p-3 max-h-[80vh] overflow-y-auto space-y-2.5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-brand-700" />
                <h3 className="font-bold text-xs text-ink">محطات العمل</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileDrawer(false)}
                className="p-1 rounded text-ink-muted hover:text-ink text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {accessibleScreens.map((screen) => {
                const Icon = ICON_MAP[screen.icon] || Store;
                const isActive =
                  screen.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(screen.path);

                return (
                  <Link
                    key={screen.id}
                    to={screen.path}
                    onClick={() => setShowMobileDrawer(false)}
                    className={`p-2.5 rounded-lg border text-right transition-colors flex flex-col justify-between min-h-[64px] ${
                      isActive
                        ? 'border-brand-700 bg-brand-700 text-white font-bold'
                        : 'border-line bg-surface hover:bg-surface-2 text-ink'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold mt-1.5">{screen.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
