import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { formatRole, roleHome } from '../lib/roles';
import { UserRole } from '../types/auth';

const navItems: { label: string; path: string; roles: UserRole[]; description?: string }[] = [
  { label: 'Dashboard Pasien', path: '/patient', roles: ['PASIEN'], description: 'Ringkasan kondisi & edukasi' },
  { label: 'Riwayat Konsultasi', path: '/patient/consultations', roles: ['PASIEN'], description: 'Sesi aktif & selesai' },
  { label: 'Edukasi', path: '/patient/education', roles: ['PASIEN'], description: 'Artikel kesehatan' },
  { label: 'Antrian Konsultasi', path: '/doctor', roles: ['DOKTER'], description: 'Daftar pasien menunggu' },
  { label: 'Riwayat Saya', path: '/doctor/history', roles: ['DOKTER'], description: 'Konsultasi selesai' },
  { label: 'Dashboard Admin', path: '/admin', roles: ['ADMIN'], description: 'Kendali sistem & audit' }
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const links = user ? navItems.filter((item) => item.roles.includes(user.role)) : [];

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white/90 backdrop-blur md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white font-bold shadow-inner">
            SC
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">SEHATiCare</p>
            <p className="text-xs text-slate-500">Empati untuk semua pasien</p>
          </div>
        </div>
        <div className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Navigasi
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-6">
          {links.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block rounded-xl px-4 py-3 transition ${
                  active
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                {item.description ? <div className="text-xs opacity-80">{item.description}</div> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(roleHome[(user?.role ?? 'PASIEN') as UserRole])}
              >
                Menu
              </Button>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Area pengelolaan</p>
              <p className="text-base font-semibold text-slate-900">
                {user ? formatRole(user.role) : 'Pengguna'}
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-900">{user.full_name}</span>
                <span className="text-xs text-slate-500">{user.email ?? 'Tidak ada email'}</span>
              </div>
              <Badge variant="info">{formatRole(user.role)}</Badge>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
