import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/client';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';

type HistoryItem = {
  id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  created_at: string;
  updated_at: string;
  patient?: { full_name?: string | null } | null;
};

export function DoctorConsultationHistory() {
  const { token, handleUnauthorized } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch<{ items: HistoryItem[] }>(
        '/doctor/history',
        {},
        { token, onUnauthorized: handleUnauthorized }
      );
      setItems(response.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Riwayat dokter</p>
          <h1 className="text-2xl font-semibold text-slate-900">Riwayat konsultasi saya</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Konsultasi selesai</CardTitle>
          <CardDescription>Daftar konsultasi yang sudah Anda tutup.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-600">Memuat riwayat...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-600">Belum ada konsultasi selesai.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/doctor/consultations/${item.id}`)}
                  className="w-full text-left"
                >
                  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-brand/40 hover:bg-slate-50">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{item.initial_complaint}</p>
                        <p className="text-xs text-slate-500">
                          Pasien {item.patient?.full_name ?? 'Tidak diketahui'} - Dibuka{' '}
                          {new Date(item.opened_at).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
