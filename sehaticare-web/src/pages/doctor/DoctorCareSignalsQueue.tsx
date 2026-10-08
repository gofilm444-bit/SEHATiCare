import { useEffect, useState } from 'react';
import {
  fetchDoctorCareSignals,
  updateDoctorCareSignalStatus,
  recordDoctorCareSignalAction,
  DoctorCareSignal
} from '../../api/careSignals';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { StatusBadge } from '../../components/ui/patterns';
import { Icon } from '../../components/ui/icons';

interface Props {
  patientPublicId?: string;
  onRefresh?: () => void;
}

export function DoctorCareSignalsQueue({ onRefresh }: Props) {
  const [signals, setSignals] = useState<DoctorCareSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Action recording modal state
  const [selectedSignal, setSelectedSignal] = useState<DoctorCareSignal | null>(null);
  const [actionType, setActionType] = useState<
    | 'CONTACT_ATTEMPTED'
    | 'CONTACTED'
    | 'FOLLOW_UP_SCHEDULED'
    | 'ESCALATED_TO_CLINICAL'
    | 'RESOLVED'
    | 'DISMISSED'
  >('CONTACT_ATTEMPTED');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDoctorCareSignals({ status: 'OPEN' });
      setSignals(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat antrean tindak lanjut.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAcknowledge = async (signal: DoctorCareSignal) => {
    try {
      await updateDoctorCareSignalStatus(signal.public_id, 'ACKNOWLEDGED');
      setActionSuccess(`Sinyal ${signal.clinical_title} telah ditandai.`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal menandai sinyal.');
    }
  };

  const handleResolve = async (signal: DoctorCareSignal) => {
    try {
      await updateDoctorCareSignalStatus(signal.public_id, 'RESOLVED');
      setActionSuccess(`Sinyal ${signal.clinical_title} telah diselesaikan.`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal menyelesaikan sinyal.');
    }
  };

  const handleRecordActionSubmit = async () => {
    if (!selectedSignal) return;
    setSubmittingAction(true);
    setError('');
    try {
      await recordDoctorCareSignalAction(selectedSignal.public_id, {
        action_type: actionType,
        next_follow_up_at: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null
      });
      setActionSuccess(`Tindakan klinis berhasil dicatat.`);
      setSelectedSignal(null);
      setNextFollowUpDate('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat tindakan klinis.');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Antrean Tindak Lanjut</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Sinyal klinis dan tindak lanjut terstruktur untuk pasien yang berada di bawah kewenangan Anda.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <Icon name="activity" className="mr-1.5 h-4 w-4" />
            Perbarui Antrean
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionSuccess ? (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button type="button" className="underline font-semibold" onClick={() => setActionSuccess('')}>
              Tutup
            </button>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" className="underline font-semibold" onClick={() => setError('')}>
              Tutup
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500 py-4 text-center">Memeriksa antrean sinyal klinis...</p>
        ) : signals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
            <Icon name="check" className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
            <p className="font-semibold text-slate-800">Tidak ada sinyal tindak lanjut aktif</p>
            <p className="text-xs text-slate-500 mt-1">
              Seluruh laporan dan jadwal kontrol pasien dalam cakupan Anda berada dalam kondisi terpantau.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {signals.map((signal) => {
              const isPriority = signal.priority === 'PRIORITY';
              return (
                <div key={signal.public_id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isPriority
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {signal.priority === 'PRIORITY' ? 'PRIORITAS' : 'PERHATIAN'}
                        </span>
                        <StatusBadge variant={signal.status === 'OPEN' ? 'neutral' : 'info'}>
                          {signal.status}
                        </StatusBadge>
                        <span className="text-sm font-bold text-slate-900">
                          {signal.patient_display_alias}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-800">
                        {signal.clinical_title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>
                          Terdeteksi: {new Date(signal.detected_at).toLocaleString('id-ID')}
                        </span>
                        {signal.overdue_bucket ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                            Terlewat: {signal.overdue_bucket === '1_TO_7_DAYS' ? '1–7 hari' : signal.overdue_bucket === '8_TO_30_DAYS' ? '8–30 hari' : '> 30 hari'}
                          </span>
                        ) : null}
                        {signal.request_category ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                            Kategori: {signal.request_category}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {signal.status === 'OPEN' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(signal)}
                        >
                          Tandai Dilihat
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedSignal(signal);
                          setActionType('CONTACT_ATTEMPTED');
                        }}
                      >
                        Catat Tindakan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => handleResolve(signal)}
                      >
                        Selesaikan
                      </Button>
                    </div>
                  </div>

                  {signal.actions && signal.actions.length > 0 ? (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1">
                      <p className="font-semibold text-slate-700">Riwayat Tindakan Terbaru:</p>
                      {signal.actions.slice(0, 2).map((act) => (
                        <div key={act.id} className="flex justify-between">
                          <span>
                            {act.action_type} oleh {act.actor_display_alias}
                          </span>
                          <span className="text-slate-400">
                            {new Date(act.occurred_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* ACTION RECORDING MODAL */}
      <AccessibleModal
        open={Boolean(selectedSignal)}
        onClose={() => setSelectedSignal(null)}
        title={`Catat Tindakan: ${selectedSignal?.clinical_title || ''}`}
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Catat tindakan objektif yang telah atau akan diambil terhadap pasien{' '}
            <strong>{selectedSignal?.patient_display_alias}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jenis Tindakan
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
            >
              <option value="CONTACT_ATTEMPTED">Upaya Menghubungi Pasien</option>
              <option value="CONTACTED">Berhasil Terhubung dengan Pasien</option>
              <option value="FOLLOW_UP_SCHEDULED">Jadwal Kontrol Tindak Lanjut Ditetapkan</option>
              <option value="ESCALATED_TO_CLINICAL">Eskalasi ke Evaluasi Spesialis</option>
              <option value="RESOLVED">Sinyal Ditindaklanjuti & Selesai</option>
              <option value="DISMISSED">Abaikan / Tidak Memerlukan Intervensi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rencana Tindak Lanjut Berikutnya (Opsional)
            </label>
            <input
              type="datetime-local"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedSignal(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleRecordActionSubmit}
              disabled={submittingAction}
            >
              {submittingAction ? 'Menyimpan...' : 'Simpan Tindakan'}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </Card>
  );
}
