import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/client';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';

type ConsultationResponse = { id: string };
type ActiveConsultation = {
  id: string;
  status: string;
  initial_complaint: string;
  created_at: string;
  updated_at: string;
};

export function PatientDashboard() {
  const navigate = useNavigate();
  const { token, handleUnauthorized } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialComplaint, setInitialComplaint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeConsultation, setActiveConsultation] = useState<ActiveConsultation | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadActive = async () => {
      try {
        setLoadingActive(true);
        setActiveError(null);
        const response = await apiFetch<{ active: ActiveConsultation | null }>(
          '/consultations/active',
          {},
          { token, onUnauthorized: handleUnauthorized }
        );
        if (!active) return;
        setActiveConsultation(response.active);
      } catch (err) {
        if (!active) return;
        setActiveError((err as Error).message);
      } finally {
        if (active) setLoadingActive(false);
      }
    };
    loadActive();
    return () => {
      active = false;
    };
  }, [handleUnauthorized, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = initialComplaint.trim();
    if (trimmed.length < 10) {
      setError('Keluhan awal minimal 10 karakter.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const consultation = await apiFetch<ConsultationResponse>(
        '/consultations',
        {
          method: 'POST',
          body: JSON.stringify({ initial_complaint: trimmed })
        },
        { token, onUnauthorized: handleUnauthorized }
      );
      setActiveConsultation({
        id: consultation.id,
        status: 'MENUNGGU_DOKTER',
        initial_complaint: trimmed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setDialogOpen(false);
      navigate(`/patient/consultations/${consultation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Ringkasan pasien</p>
          <h1 className="text-2xl font-semibold text-slate-900">Selamat datang kembali</h1>
        </div>
        <Badge variant="info">PASIEN</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Konsultasi</CardTitle>
            <CardDescription>Status terkini</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingActive ? (
              <p className="text-sm text-slate-500">Memuat...</p>
            ) : activeConsultation ? (
              <div className="space-y-1">
                <p className="text-3xl font-semibold text-slate-900">1</p>
                <p className="text-sm text-slate-600">Status: {activeConsultation.status}</p>
              </div>
            ) : (
              <>
                <p className="text-3xl font-semibold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Belum ada antrean aktif</p>
              </>
            )}
            {activeError ? <p className="mt-2 text-xs text-red-600">{activeError}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Artikel edukasi</CardTitle>
            <CardDescription>Terakhir dibaca</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">Segera hadir di tahap berikutnya.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Progress kesehatan</CardTitle>
            <CardDescription>Catatan pribadi</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">Belum ada data. Mulai dari konsultasi pertama.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apa langkah selanjutnya?</CardTitle>
          <CardDescription>
            {activeConsultation ? 'Lanjutkan sesi yang sedang berjalan atau mulai baru saat selesai.' : 'Mulai sesi konsultasi baru kapan saja.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Ceritakan keluhan utama Anda untuk memulai. Jika masih ada sesi aktif, kami akan membuka kembali sesi tersebut.
          </p>
          {activeConsultation ? (
            <Button variant="secondary" onClick={() => navigate(`/patient/consultations/${activeConsultation.id}`)}>
              Lanjutkan konsultasi
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Mulai konsultasi
            </Button>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Mulai konsultasi</p>
                  <h2 className="text-lg font-semibold text-slate-900">Keluhan awal</h2>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Tutup
                </Button>
              </div>
              <div className="space-y-3 px-5 py-4">
                <label className="text-sm font-medium text-slate-800" htmlFor="initial_complaint">
                  Ceritakan keluhan Anda
                </label>
                <textarea
                  id="initial_complaint"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                  rows={4}
                  minLength={10}
                  required
                  value={initialComplaint}
                  onChange={(e) => setInitialComplaint(e.target.value)}
                  disabled={submitting}
                  placeholder="Contoh: Demam sejak 2 hari lalu disertai batuk dan sakit kepala."
                />
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Memulai...' : 'Mulai konsultasi'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
