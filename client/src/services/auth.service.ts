import apiClient from '@/lib/axios';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
}

export const authService = {
  login(payload: LoginPayload): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/auth/login', payload).then((r) => r.data);
  },

  logout(): Promise<void> {
    return apiClient.post('/auth/logout').then(() => undefined);
  },

  register(payload: RegisterPayload): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/users/', payload).then((r) => r.data);
  },
};
