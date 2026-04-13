import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export function AdminEducationPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-900">Konten Edukasi (Full)</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Manajemen artikel edukasi akan hadir di tahap berikut.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Placeholder halaman admin edukasi.</p>
        </CardContent>
      </Card>
    </div>
  );
}
