import { UserRole } from '../types/auth';

export const roleHome: Record<UserRole, string> = {
  PASIEN: '/patient',
  DOKTER: '/doctor',
  ADMIN: '/admin'
};

export function getDashboardPath(role?: UserRole | null) {
  return role ? roleHome[role] : '/login';
}

export function formatRole(role: UserRole) {
  const labels: Record<UserRole, string> = {
    PASIEN: 'Pasien',
    DOKTER: 'Dokter',
    ADMIN: 'Admin'
  };
  return labels[role];
}
