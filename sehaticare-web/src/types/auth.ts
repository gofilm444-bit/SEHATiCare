export type UserRole = 'PASIEN' | 'DOKTER' | 'ADMIN';

export interface User {
  id: string;
  role: UserRole;
  email: string | null;
  full_name: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
