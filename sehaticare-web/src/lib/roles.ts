import { UserRole } from '../types/auth';

export const roleHome: Record<UserRole, string> = {
  PASIEN: '/patient',
  DOKTER: '/doctor',
  ADMIN: '/admin',
  COUNSELOR: '/counselor',
  COMPLAINT_OFFICER: '/complaint-officer',
  SUPERVISOR: '/complaint-officer'
};

export function getDashboardPath(role?: UserRole | null) {
  if (!role) return '/login';
  return roleHome[role] ?? '/login';
}

export function formatRole(role: UserRole) {
  const labels: Record<UserRole, string> = {
    PASIEN: 'Pasien',
    DOKTER: 'Dokter',
    ADMIN: 'Admin',
    COUNSELOR: 'Konselor',
    COMPLAINT_OFFICER: 'Petugas Pengaduan',
    SUPERVISOR: 'Supervisor'
  };
  return labels[role];
}
