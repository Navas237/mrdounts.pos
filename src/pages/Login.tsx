import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Lock,
  User,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const success = await login(username, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app-bg text-ink relative overflow-hidden">
      {/* عناصر خلفية جمالية هادئة بتدرجات البراند */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-brand-700/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* بطاقة الدخول الرئيسية */}
        <div className="bg-surface rounded-2xl border border-line shadow-xl p-6 sm:p-8">
          {/* الهيدر واللوجو */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-700 text-white shadow-md mb-3">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-none stroke-white stroke-[2.5]">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-brand-900 tracking-tight">
              MR DONUTS
            </h1>
          </div>

          {/* تنبيه الخطأ إن وجد */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* نموذج الدخول */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* حقل اسم المستخدم */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                اسم المستخدم
              </label>
              <div className="relative flex items-center rounded-xl border border-line bg-surface focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all overflow-hidden">
                <div className="pr-3 text-ink-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  dir="ltr"
                  autoComplete="username"
                  className="w-full py-2.5 px-2 text-sm text-left bg-transparent focus:outline-none font-medium"
                  required
                />
                <span className="bg-surface-2 px-2.5 py-2.5 text-[11px] font-bold text-ink-muted border-r border-line select-none">
                  @MRDOUNTS.COM
                </span>
              </div>
            </div>

            {/* حقل كلمة المرور */}
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">
                كلمة المرور
              </label>
              <div className="relative flex items-center rounded-xl border border-line bg-surface focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                <div className="pr-3 text-ink-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  autoComplete="current-password"
                  className="w-full py-2.5 px-2 text-sm text-left bg-transparent focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pl-3 text-ink-muted hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 active:scale-[0.99] text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 touch-target disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الدخول...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* الحقوق */}
        <p className="text-center text-[11px] text-ink-muted mt-5">
          MR DONUTS © 2026
        </p>
      </div>
    </div>
  );
};
