export type UserRole = 'PASIEN' | 'DOKTER' | 'ADMIN' | 'COUNSELOR' | 'COMPLAINT_OFFICER' | 'SUPERVISOR';

export interface User {
  id: string;
  public_id?: string;
  role: UserRole;
  is_superadmin?: boolean;
  email: string | null;
  full_name: string;
  display_alias?: string | null;
  account_mode?: 'LEGACY' | 'ANONYMOUS';
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
