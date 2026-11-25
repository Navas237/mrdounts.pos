import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  Menu,
  Sun,
  Moon,
  ShoppingCart,
  User,
  PanelRight,
} from 'lucide-react';

interface TopbarProps {
  onOpenMobileDrawer: () => void;
  onToggleDesktopSidebar?: () => void;
  isDesktopSidebarOpen?: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobileDrawer,
  onToggleDesktopSidebar,
  isDesktopSidebarOpen = true,
}) => {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="shell-topbar">
      {/* 1. الجانب الأيمن: زر طي/فتح السايدبار للكمبيوتر + زر القائمة للموبايل + اسم الفرع */}
      <div className="flex items-center gap-2">
        {/* زر فتح وإغلاق السايدبار للكمبيوتر */}
        {onToggleDesktopSidebar && (
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            className="hidden lg:flex items-center justify-center p-2 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink transition-colors"
            title={isDesktopSidebarOpen ? 'طي القائمة الجانبية' : 'فتح القائمة الجانبية'}
            aria-label="تبديل القائمة الجانبية"
          >
            <PanelRight className="w-4 h-4 text-ink" />
          </button>
        )}

        {/* زر القائمة للموبايل */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="lg:hidden p-2 rounded-lg border border-line bg-surface text-ink hover:bg-surface-2 transition-colors"
          aria-label="القائمة الجانبية"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-surface-2 text-xs font-semibold text-ink-muted">
          <span>•</span>
          <span className="font-mono text-xs text-ink font-bold">
            {new Date().toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* 2. الجانب الأيسر: الإجراءات السريعة وحالة الشفت والشخصيات */}
      <div className="flex items-center gap-2">
        {/* مؤشر الشيفت العلوي */}
        {/* <button
          type="button"
          onClick={() => nav('/shifts')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            isShiftOpen
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-surface-2 text-ink-muted border-line hover:bg-surface-3'
          }`}
          title="انقر لإدارة الشفت"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isShiftOpen ? `الدرج مفتوح: ${formatCurrency(summary?.expected_cash || 0)}` : 'الدرج مغلق'}
          </span>
          <span className="md:hidden">
            {isShiftOpen ? 'مفتوح' : 'مغلق'}
          </span>
        </button> */}

        {/* زر تبديل الثيم الداكن والفاتح */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink transition-colors"
          title="تبديل وضع الألوان"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-ink-muted" />}
        </button>

        {/* اسم المستخدم الحالي */}
        {user && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-bold">
            <User className="w-3.5 h-3.5 text-brand-700" />
            <span className="hidden sm:inline truncate max-w-[100px]">
              {user.full_name?.split(' ')[0] || user.username}
            </span>
          </div>
        )}

        {/* زر طلب جديد (F1) ينقل للكاشير مباشرة */}
        {location.pathname !== '/cashier' && (
          <button
            type="button"
            onClick={() => nav('/cashier')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-2xs transition-colors shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>طلب جديد</span>
          </button>
        )}
      </div>
    </header>
  );
};
