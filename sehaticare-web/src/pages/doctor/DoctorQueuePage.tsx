import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/client';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';

type QueueItem = {
  id: string;
  patient_id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  last_message_at: string;
  closeRequested: boolean;
  closeRequestedAt: string | null;
  updated_at: string;
  red_flag?: boolean;
  red_flag_reason?: string | null;
  priority?: number;
  patient?: { full_name?: string | null } | null;
};

type ActiveItem = {
  id: string;
  status: string;
  initial_complaint: string;
  opened_at: string;
  updated_at: string;
  patient?: { full_name?: string | null } | null;
};

export function DoctorQueuePage() {
  const { token, handleUnauthorized } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActive, setLoadingActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    try {
      setLoadingActive(true);
      setActiveError(null);
      const response = await apiFetch<{ items: ActiveItem[] }>(
        '/doctor/active',
        {},
        { token, onUnauthorized: handleUnauthorized }
      );
      setActiveItems(response.items);
    } catch (err) {
      setActiveError((err as Error).message);
    } finally {
      setLoadingActive(false);
    }
  }, [handleUnauthorized, token]);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFetch<{ items: QueueItem[] }>(
        '/doctor/queue',
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
    loadQueue();
    loadActive();
  }, [loadActive, loadQueue]);

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    setClaimNotice(null);
    try {
      const consultation = await apiFetch<{ id: string }>(
        `/consultations/${id}/claim`,
        { method: 'POST' },
        { token, onUnauthorized: handleUnauthorized }
      );
      navigate(`/doctor/consultations/${consultation.id}`);
    } catch (err) {
      const message = (err as Error).message || 'Gagal mengambil konsultasi.';
      setClaimNotice(message === 'Sudah diambil dokter lain' ? message : `Gagal mengambil: ${message}`);
      await loadQueue();
    } finally {
      setClaimingId(null);
    }
  };

  const renderLoading = () => (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="space-y-2 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="mt-3 flex items-center justify-between">
              <div className="h-6 w-20 rounded bg-slate-100" />
              <div className="h-8 w-24 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMyConsultations = () => {
    if (loadingActive) {
      return <p className="text-sm text-slate-600">Memuat konsultasi aktif...</p>;
    }
    if (activeError) {
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{activeError}</span>
          <Button size="sm" variant="outline" onClick={loadActive}>
            Muat ulang
          </Button>
        </div>
      );
    }
    if (activeItems.length === 0) {
      return <p className="text-sm text-slate-600">Belum ada konsultasi aktif.</p>;
    }

    return (
      <div className="space-y-3">
        {activeItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.initial_complaint}</p>
                <p className="text-xs text-slate-500">
                  Dibuka {new Date(item.opened_at).toLocaleString('id-ID')}
                  {item.patient?.full_name ? ` - ${item.patient.full_name}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  Update {new Date(item.updated_at).toLocaleString('id-ID')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Sedang Berlangsung</Badge>
                <Button size="sm" onClick={() => navigate(`/doctor/consultations/${item.id}`)}>
                  Lanjutkan
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderQueue = () => {
    if (loading) return renderLoading();
    if (error) {
      return (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={loadQueue}>
            Muat ulang
          </Button>
        </div>
      );
    }
    if (items.length === 0) {
      return <p className="text-sm text-slate-600">Belum ada antrian.</p>;
    }

    const activeQueueItems = items.filter((item) => item.status === 'MENUNGGU_DOKTER' || item.status === 'AI_AKTIF');
    const activeIds = new Set(activeItems.map((item) => item.id));
    const visibleItems = activeQueueItems.filter((item) => !activeIds.has(item.id));
    if (visibleItems.length === 0) {
      return <p className="text-sm text-slate-600">Belum ada antrian.</p>;
    }
    const sortedItems = [...visibleItems].sort((a, b) => {
      const priorityDelta = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime();
    });

    return (
      <div className="space-y-3">
        {sortedItems.map((item) => {
          const statusLabel =
            item.status === 'AI_AKTIF'
              ? 'Aktif dengan Asisten'
              : item.status === 'MENUNGGU_DOKTER'
                ? 'Menunggu Dokter'
                : item.status;
          const isPriority = Boolean(item.red_flag) || (item.priority ?? 0) >= 10;
          return (
          <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.initial_complaint}</p>
                <p className="text-xs text-slate-500">
                  Dibuka {new Date(item.opened_at).toLocaleString('id-ID')} -{' '}
                  {item.patient?.full_name ? item.patient.full_name : `Pasien #${item.patient_id.slice(0, 8)}`}
                </p>
                <p className="text-xs text-slate-500">
                  Aktivitas terakhir {new Date(item.last_message_at).toLocaleString('id-ID')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isPriority ? (
                  <Badge className="border border-amber-300 bg-amber-100 text-amber-800" variant="outline">
                    Prioritas
                  </Badge>
                ) : null}
                <Badge variant={item.status === 'AI_AKTIF' ? 'info' : 'outline'}>{statusLabel}</Badge>
                {item.closeRequested ? (
                  <Badge variant="outline">Minta Ditutup</Badge>
                ) : null}
                <Button size="sm" onClick={() => handleClaim(item.id)} disabled={claimingId === item.id}>
                  {claimingId === item.id ? 'Mengambil...' : 'Ambil'}
                </Button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Panel dokter</p>
          <h1 className="text-2xl font-semibold text-slate-900">Antrian konsultasi</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={loading}>
            Refresh
          </Button>
          <Badge variant="success">DOKTER</Badge>
        </div>
      </div>

      {claimNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {claimNotice}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Konsultasi Saya</CardTitle>
          <CardDescription>Konsultasi yang sedang Anda tangani.</CardDescription>
        </CardHeader>
        <CardContent>{renderMyConsultations()}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Antrean Konsultasi</CardTitle>
          <CardDescription>Ambil konsultasi untuk mulai percakapan dengan pasien.</CardDescription>
        </CardHeader>
        <CardContent>{renderQueue()}</CardContent>
      </Card>
    </div>
  );
}
