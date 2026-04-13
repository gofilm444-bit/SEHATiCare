import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export function AdminMonitoringPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">Admin</p>
        <h1 className="text-2xl font-semibold text-slate-900">Monitoring Sistem</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Monitoring performa sistem akan hadir di tahap berikut.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Placeholder halaman monitoring.</p>
        </CardContent>
      </Card>
    </div>
  );
}
