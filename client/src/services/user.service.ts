import apiClient from '@/lib/axios';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
}

export const userService = {
  getMe(): Promise<User> {
    return apiClient.get<User>('/users/me').then((r) => r.data);
  },

  listUsers(): Promise<User[]> {
    return apiClient.get<User[]>('/users/').then((r) => r.data);
  },

  getUser(id: number): Promise<User> {
    return apiClient.get<User>(`/users/${id}`).then((r) => r.data);
  },
};
