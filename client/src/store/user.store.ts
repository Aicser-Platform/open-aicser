import { create } from 'zustand';
import { userService, User } from '@/services/user.service';

interface UserState {
  me: User | null;
  users: User[];
  loading: boolean;
  error: string | null;

  fetchMe: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  clearMe: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  me: null,
  users: [],
  loading: false,
  error: null,

  async fetchMe() {
    set({ loading: true, error: null });
    try {
      const me = await userService.getMe();
      set({ me, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  async fetchUsers() {
    set({ loading: true, error: null });
    try {
      const users = await userService.listUsers();
      set({ users, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  clearMe() {
    set({ me: null, users: [] });
  },
}));
