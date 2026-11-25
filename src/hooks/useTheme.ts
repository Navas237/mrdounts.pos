import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const getSavedTheme = (): 'light' | 'dark' => {
  try {
    const val = localStorage.getItem('mrdounts_theme');
    if (val === 'dark' || val === 'light') return val;
  } catch {
    // fallback
  }
  return 'light';
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getSavedTheme(),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('mrdounts_theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },
  setTheme: (theme) => {
    localStorage.setItem('mrdounts_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));

export function useTheme() {
  const store = useThemeStore();
  return {
    theme: store.theme,
    toggleTheme: store.toggleTheme,
    setTheme: store.setTheme,
    isDark: store.theme === 'dark',
  };
}

