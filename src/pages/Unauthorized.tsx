import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const Unauthorized: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center p-8 rounded-3xl bg-surface border border-line shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-ink">غير مصرح بالدخول لهذه الشاشة</h1>
        <p className="text-xs text-ink-muted leading-relaxed">
          حسابك الحالي ({user?.full_name || 'المستخدم'}) لا يملك الصلاحية المحددة للوصول إلى هذه الشاشة. يمكنك العودة للشاشات المصرحة لك أو تبديل الحساب من القائمة بالأعلى.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-xs touch-target transition-colors"
        >
          <span>العودة للرئيسية</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
