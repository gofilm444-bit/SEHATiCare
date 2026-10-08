import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/client';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { DoctorCareSignalsQueue } from './doctor/DoctorCareSignalsQueue';

type QueueItem = {
  id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  patient?: { full_name: string } | null;
};

export function DoctorDashboard() {
  const { token, handleUnauthorized } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const loadQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch<{ items: QueueItem[] }>('/doctor/queue', {}, { token, onUnauthorized: handleUnauthorized });
      setItems(response.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [token, handleUnauthorized]);

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    setClaimError(null);
    try {
      const consultation = await apiFetch<QueueItem>(`/consultations/${id}/claim`, { method: 'POST' }, { token, onUnauthorized: handleUnauthorized });
      navigate(`/doctor/consultations/${consultation.id}`);
    } catch (err) {
      const msg = (err as Error).message;
      setClaimError(msg);
      await loadQueue();
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Panel dokter</p>
          <h1 className="text-2xl font-semibold text-slate-900">Antrean konsultasi pasien</h1>
        </div>
        <Badge variant="success">DOKTER</Badge>
      </div>

      <DoctorCareSignalsQueue />

      <Card>
        <CardHeader>
          <CardTitle>Antrean menunggu dokter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-slate-600">Memuat antrean...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && items.length === 0 && <p className="text-sm text-slate-600">Belum ada pasien menunggu.</p>}
          {!loading && !error && items.length > 0 && (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Sesi menunggu penugasan</p>
                    <p className="text-xs text-slate-500">
                      Masuk antrean {new Date(item.opened_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.status}</Badge>
                    <Button size="sm" onClick={() => handleClaim(item.id)} disabled={claimingId === item.id}>
                      {claimingId === item.id ? 'Mengambil...' : 'Ambil'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {claimError ? <p className="text-sm text-amber-700">Gagal klaim: {claimError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
