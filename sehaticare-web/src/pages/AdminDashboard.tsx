import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { apiFetch } from '../lib/client';
import { useAuth } from '../context/AuthContext';

type ConsultationItem = {
  id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  updated_at: string;
  patient_id: string;
  assignedDoctorId: string | null;
  closeRequested?: boolean;
};

type AuditEvent = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  consultation_id: string | null;
  meta_json: unknown;
};

export function AdminDashboard() {
  const { token, handleUnauthorized } = useAuth();
  const [activeItems, setActiveItems] = useState<ConsultationItem[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [forceNotice, setForceNotice] = useState<string | null>(null);
  const [forcingId, setForcingId] = useState<string | null>(null);
  const [auditItems, setAuditItems] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    try {
      setLoadingActive(true);
      setActiveError(null);
      const response = await apiFetch<{ items: ConsultationItem[] }>(
        '/consultations',
        {},
        { token, onUnauthorized: handleUnauthorized }
      );
      const active = response.items.filter((item) => item.status !== 'SELESAI');
      setActiveItems(active);
    } catch (err) {
      setActiveError((err as Error).message);
    } finally {
      setLoadingActive(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  const loadAudit = useCallback(async () => {
    try {
      setLoadingAudit(true);
      setAuditError(null);
      const response = await apiFetch<{ items: AuditEvent[] }>(
        '/admin/audit?limit=10',
        {},
        { token, onUnauthorized: handleUnauthorized }
      );
      setAuditItems(response.items);
    } catch (err) {
      setAuditError((err as Error).message);
    } finally {
      setLoadingAudit(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const handleForceClose = async (id: string) => {
    if (forcingId) return;
    const confirmed = window.confirm('Tindakan ini hanya untuk pemulihan sistem/testing.');
    if (!confirmed) return;
    setForcingId(id);
    setForceNotice(null);
    try {
      await apiFetch<{ id: string }>(
        `/admin/consultations/${id}/force-close`,
        { method: 'POST' },
        { token, onUnauthorized: handleUnauthorized }
      );
      setActiveItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setForceNotice((err as Error).message);
    } finally {
      setForcingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Kendali sistem</p>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
        </div>
        <Badge>ADMIN</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dokter terverifikasi</CardTitle>
            <CardDescription>Jumlah terkini</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">0</p>
            <p className="text-sm text-slate-500">Verifikasi akan dikelola di tahap berikut</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Aktivitas penting</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAudit ? (
              <p className="text-sm text-slate-600">Memuat audit...</p>
            ) : auditError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {auditError}
              </div>
            ) : auditItems.length === 0 ? (
              <p className="text-sm text-slate-700">Belum ada aktivitas tercatat.</p>
            ) : (
              <div className="space-y-2 text-xs text-slate-600">
                {auditItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1 border-b border-slate-100 pb-2 last:border-b-0">
                    <span className="font-semibold text-slate-800">{item.action}</span>
                    <span>
                      {item.actor_role ?? 'SYSTEM'}
                      {item.actor_user_id ? ` - ${item.actor_user_id.slice(0, 8)}` : ''}
                    </span>
                    <span>{new Date(item.created_at).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pengaturan</CardTitle>
            <CardDescription>Kontrol akses & keamanan</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Atur kebijakan keamanan dan sesi.</p>
            <Button variant="secondary" disabled>
              Kelola
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
          <CardDescription>Integrasi dengan API akan melengkapi data.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Setelah endpoint audit dan manajemen user siap, area ini akan menampilkan log, pembuatan akun, dan
            laporan singkat.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konsultasi aktif</CardTitle>
          <CardDescription>Gunakan force close hanya untuk pemulihan sistem yang stuck.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forceNotice ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {forceNotice}
            </div>
          ) : null}
          {loadingActive ? (
            <p className="text-sm text-slate-600">Memuat konsultasi aktif...</p>
          ) : activeError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {activeError}
            </div>
          ) : activeItems.length === 0 ? (
            <p className="text-sm text-slate-600">Tidak ada konsultasi aktif.</p>
          ) : (
            <div className="space-y-3">
              {activeItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{item.initial_complaint}</p>
                      <p className="text-xs text-slate-500">
                        ID {item.id.slice(0, 8)} - Pasien {item.patient_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Update {new Date(item.updated_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.status}</Badge>
                      {item.closeRequested ? <Badge variant="outline">Minta Ditutup</Badge> : null}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleForceClose(item.id)}
                        disabled={forcingId === item.id}
                      >
                        {forcingId === item.id ? 'Memproses...' : 'Force Selesaikan'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
