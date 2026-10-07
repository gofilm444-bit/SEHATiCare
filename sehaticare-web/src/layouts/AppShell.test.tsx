import { describe, expect, test } from 'vitest';
import { getActiveNavPath, getVisibleNavigationItems } from './AppShell';
import type { UserRole } from '../types/auth';

function activeFor(role: UserRole, pathname: string) {
  return getActiveNavPath(pathname, getVisibleNavigationItems(role, role === 'COUNSELOR'));
}

function labelsFor(role: UserRole) {
  return getVisibleNavigationItems(role, role === 'COUNSELOR').map((item) => item.label);
}

describe('AppShell active navigation', () => {
  test.each([
    ['PASIEN', '/patient', '/patient'],
    ['PASIEN', '/patient/consultations', '/patient/consultations'],
    ['PASIEN', '/patient/consultations/session-1', '/patient/consultations'],
    ['PASIEN', '/patient/education/article-1', '/patient/education'],
    ['PASIEN', '/patient/medication-reminders', '/patient/medication-reminders'],
    ['PASIEN', '/patient/medication-reminders/edit', '/patient/medication-reminders'],
    ['PASIEN', '/patient/adherence', '/patient/medication-reminders'],
    ['PASIEN', '/patient/complaints/ticket-1', '/patient/complaints'],
    ['DOKTER', '/doctor', '/doctor'],
    ['DOKTER', '/doctor/history', '/doctor/history'],
    ['DOKTER', '/doctor/schedules', '/doctor/schedules'],
    ['DOKTER', '/doctor/consultations/session-1', '/doctor'],
    ['ADMIN', '/admin', '/admin'],
    ['ADMIN', '/admin/education', '/admin/education'],
    ['ADMIN', '/admin/users', '/admin/users'],
    ['ADMIN', '/admin/portal', '/admin/portal'],
    ['ADMIN', '/admin/monitoring', '/admin/monitoring'],
    ['ADMIN', '/admin/audit', '/admin/audit'],
    ['COUNSELOR', '/counselor/conversations/session-1', '/counselor'],
    ['COMPLAINT_OFFICER', '/complaint-officer/ticket-1', '/complaint-officer'],
    ['SUPERVISOR', '/complaint-officer/ticket-1', '/complaint-officer']
  ] satisfies Array<[UserRole, string, string]>)('%s at %s activates only %s', (role, pathname, expected) => {
    expect(activeFor(role, pathname)).toBe(expected);
  });

  test('matches complete URL segments and normalizes trailing slashes', () => {
    expect(activeFor('PASIEN', '/patient/')).toBe('/patient');
    expect(activeFor('PASIEN', '/patient-other')).toBeNull();
  });

  test('patient menu is prioritized and combines reminder tasks', () => {
    expect(labelsFor('PASIEN')).toEqual([
      'Dashboard Pasien',
      'Konsultasi',
      'Jadwal Kontrol',
      'Pengingat & Kepatuhan',
      'Edukasi',
      'Fasilitas',
      'Pengaduan',
      'Preferensi Notifikasi',
      'Profil & Keamanan'
    ]);
    expect(labelsFor('PASIEN')).not.toEqual(expect.arrayContaining(['Ubah Pengingat', 'Riwayat Pengingat']));
  });

  test('other role menus prioritize work, expose key destinations, and put account settings last', () => {
    expect(labelsFor('DOKTER')).toEqual(['Antrian Konsultasi', 'Riwayat Saya', 'Pengajuan Profesional', 'Jadwal Pengguna', 'Profil & Keamanan']);
    expect(labelsFor('ADMIN')).toEqual(['Dashboard Admin', 'Manajemen Pengguna', 'Konten Portal', 'Informasi Publik', 'Monitoring Sistem', 'Audit Aktivitas', 'Tenaga Profesional', 'Penugasan Pendamping', 'Laporan Percakapan', 'Profil & Keamanan']);
    expect(labelsFor('COUNSELOR')).toEqual(['Pengajuan Profesional', 'Antrean Konsultasi', 'Profil & Keamanan']);
    expect(labelsFor('COMPLAINT_OFFICER')).toEqual(['Antrean Pengaduan', 'Profil & Keamanan']);
    expect(labelsFor('SUPERVISOR')).toEqual(['Antrean Pengaduan', 'Laporan Percakapan', 'Reassign Pengaduan', 'Profil & Keamanan']);
  });

  test('doctor counselor menu appears only after counselor permission is confirmed', () => {
    expect(getVisibleNavigationItems('DOKTER', false).map((item) => item.label)).not.toContain('Antrean Konsultasi');
    expect(getVisibleNavigationItems('DOKTER', true).map((item) => item.label)).toContain('Antrean Konsultasi');
  });

  test('professional service roles receive only their own work menu', () => {
    expect(getVisibleNavigationItems('COUNSELOR', true, 'COMPANION').map((item) => item.label)).toContain('Penugasan Pendamping');
    expect(getVisibleNavigationItems('COUNSELOR', true, 'COMPANION').map((item) => item.label)).not.toContain('Antrean Konsultasi');
    expect(getVisibleNavigationItems('COUNSELOR', true, 'OUTREACH_WORKER').map((item) => item.label)).toContain('Penjangkauan');
    expect(getVisibleNavigationItems('COUNSELOR', true, 'OUTREACH_WORKER').map((item) => item.label)).not.toContain('Penugasan Pendamping');
  });
});
