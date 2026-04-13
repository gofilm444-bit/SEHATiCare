export type UserRole = 'PASIEN' | 'DOKTER' | 'ADMIN' | 'PENDAMPING';

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
