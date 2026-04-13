import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';

const adminMenu = [
  {
    title: 'Konten Portal Depan',
    description: 'Kelola landing, banner, dan informasi publik.',
    path: '/admin/portal'
  },
  {
    title: 'Konten Edukasi (Full)',
    description: 'Kelola artikel edukasi dan kategori.',
    path: '/admin/education'
  },
  {
    title: 'Manajemen User',
    description: 'Kelola akun pasien, dokter, dan pendamping.',
    path: '/admin/users'
  },
  {
    title: 'Audit & Log Aktivitas',
    description: 'Pantau aktivitas sistem dan perubahan penting.',
    path: '/admin/audit'
  },
  {
    title: 'Monitoring Sistem',
    description: 'Kesehatan layanan dan performa harian.',
    path: '/admin/monitoring'
  }
];

export function AdminDashboard() {
  const { logout } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Kendali sistem</p>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
        </div>
        <Badge>ADMIN</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminMenu.map((item) => (
          <Link key={item.path} to={item.path} className="block">
            <Card className="h-full transition hover:border-brand/40 hover:shadow-md">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs font-medium text-brand">Buka menu</span>
              </CardContent>
            </Card>
          </Link>
        ))}

        <Card className="h-full border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Logout</CardTitle>
            <CardDescription>Keluar dari akun admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => logout(true)}>
              Keluar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
