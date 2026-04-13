import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-900">Manajemen User</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Pengelolaan akun dan peran akan tersedia di tahap berikut.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Placeholder halaman manajemen user.</p>
        </CardContent>
      </Card>
    </div>
  );
}
