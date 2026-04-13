import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

export function PendampingDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Pendamping</p>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard Pendamping</h1>
        </div>
        <Badge>PENDAMPING</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Antrian Tugas Hari Ini</CardTitle>
            <CardDescription>Prioritas tugas harian</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Belum ada tugas terjadwal.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pilih Pasien atau Tugas</CardTitle>
            <CardDescription>Mulai dengan memilih daftar pasien</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Daftar pasien akan muncul di sini.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Red-Flag</CardTitle>
            <CardDescription>Periksa prioritas risiko</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Tidak ada red-flag saat ini.</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Aksi Cepat</h2>
        <p className="text-sm text-slate-500">Pilih tindakan untuk pasien atau tugas terpilih.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Kirim Edukasi</CardTitle>
            <CardDescription>Bagikan konten edukasi relevan</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled>
              Kirim
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Rujukan dan Jadwal</CardTitle>
            <CardDescription>Atur rujukan dan jadwal kunjungan</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled>
              Buat Rujukan
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pantau Kepatuhan</CardTitle>
            <CardDescription>Evaluasi tindak lanjut pasien</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled>
              Pantau
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Check-in Chat</CardTitle>
            <CardDescription>Mulai percakapan pendampingan</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" disabled>
              Check-in
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Riwayat aktivitas pendamping</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Audit log akan ditampilkan di sini.</p>
        </CardContent>
      </Card>
    </div>
  );
}
