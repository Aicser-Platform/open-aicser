import { create } from 'zustand';
import { authService, LoginPayload, RegisterPayload } from '@/services/auth.service';

interface AuthState {
  token: string | null;
  loading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  initFromStorage: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  loading: false,
  error: null,

  initFromStorage() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    set({ token });
  },

  async login(payload) {
    set({ loading: true, error: null });
    try {
      const { access_token } = await authService.login(payload);
      localStorage.setItem('token', access_token);
      set({ token: access_token, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  async logout() {
    set({ loading: true, error: null });
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem('token');
      set({ token: null, loading: false });
    }
  },

  async register(payload) {
    set({ loading: true, error: null });
    try {
      await authService.register(payload);
      set({ loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  clearError() {
    set({ error: null });
  },
}));
