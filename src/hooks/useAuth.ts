import { create } from 'zustand';
import { AuthSession, MockUserPersona } from '@/types/auth';
import { authService } from '@/services/auth.service';

interface AuthStore {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password?: string) => Promise<boolean>;
  loginAsPersona: (persona: MockUserPersona) => void;
  logout: () => Promise<void>;
  updateSession: (updater: (prev: AuthSession | null) => AuthSession | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: authService.getCurrentSession(),
  isLoading: false,
  error: null,

  login: async (username: string, password = '') => {
    set({ isLoading: true, error: null });
    try {
      const session = await authService.login(username, password);
      set({ session, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  loginAsPersona: (persona: MockUserPersona) => {
    const session = authService.buildSessionFromPersona(persona);
    authService.setSession(session);
    set({ session, error: null });
  },

  logout: async () => {
    await authService.logout();
    set({ session: null });
  },

  updateSession: (updater) => {
    set((state) => {
      const next = updater(state.session);
      authService.setSession(next);
      return { session: next };
    });
  },
}));

export function useAuth() {
  const store = useAuthStore();
  return {
    session: store.session,
    user: store.session?.profile ?? null,
    branch: store.session?.branch ?? null,
    activeShift: store.session?.activeShift ?? null,
    departments: store.session?.departments ?? [],
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    loginAsPersona: store.loginAsPersona,
    logout: store.logout,
    personas: [] as MockUserPersona[],
  };
}

