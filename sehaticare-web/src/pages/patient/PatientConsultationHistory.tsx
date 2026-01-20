import { useCallback, useEffect, useMemo, useState } from 'react';
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
  assignedDoctorId?: string | null;
};

const ACTIVE_STATUSES = new Set(['MENUNGGU_DOKTER', 'AI_AKTIF', 'DOKTER_AKTIF']);

export function PatientConsultationHistory() {
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
        '/consultations/history',
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

  const { activeItems, finishedItems } = useMemo(() => {
    const active: HistoryItem[] = [];
    const finished: HistoryItem[] = [];
    items.forEach((item) => {
      if (ACTIVE_STATUSES.has(item.status)) {
        active.push(item);
      } else {
        finished.push(item);
      }
    });
    return { activeItems: active, finishedItems: finished };
  }, [items]);

  const renderList = (list: HistoryItem[], emptyText: string) => {
    if (list.length === 0) {
      return <p className="text-sm text-slate-600">{emptyText}</p>;
    }
    return (
      <div className="space-y-3">
        {list.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/patient/consultations/${item.id}`)}
            className="w-full text-left"
          >
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-brand/40 hover:bg-slate-50">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.initial_complaint}</p>
                  <p className="text-xs text-slate-500">
                    Dibuka {new Date(item.opened_at).toLocaleString('id-ID')} • Terakhir update{' '}
                    {new Date(item.updated_at).toLocaleString('id-ID')}
                  </p>
                </div>
                <Badge variant="outline">{item.status}</Badge>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Riwayat pasien</p>
          <h1 className="text-2xl font-semibold text-slate-900">Riwayat konsultasi</h1>
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
          <CardTitle>Konsultasi aktif</CardTitle>
          <CardDescription>Sesi yang masih berlangsung atau menunggu dokter.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-600">Memuat riwayat...</p> : renderList(activeItems, 'Tidak ada sesi aktif.')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konsultasi selesai</CardTitle>
          <CardDescription>Riwayat konsultasi yang sudah ditutup.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-600">Memuat riwayat...</p> : renderList(finishedItems, 'Belum ada konsultasi selesai.')}
        </CardContent>
      </Card>
    </div>
  );
}
