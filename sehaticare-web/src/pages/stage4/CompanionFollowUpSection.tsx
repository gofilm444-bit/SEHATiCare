import { useEffect, useState } from 'react';
import {
  fetchCompanionFollowUpSignals,
  recordCompanionCareSignalAction,
  CompanionCareSignal
} from '../../api/careSignals';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { StatusBadge } from '../../components/ui/patterns';
import { Icon } from '../../components/ui/icons';

interface Props {
  onRefresh?: () => void;
}

export function CompanionFollowUpSection({ onRefresh }: Props) {
  const [signals, setSignals] = useState<CompanionCareSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Action schedule modal state
  const [scheduleModalSignal, setScheduleModalSignal] = useState<CompanionCareSignal | null>(null);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCompanionFollowUpSignals();
      setSignals(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat antrean dukungan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSimpleAction = async (
    signal: CompanionCareSignal,
    actionType: 'ACKNOWLEDGED' | 'CONTACT_ATTEMPTED' | 'CONTACTED' | 'ESCALATED_TO_CLINICAL'
  ) => {
    setError('');
    setActionSuccess('');
    try {
      await recordCompanionCareSignalAction(signal.public_id, {
        action_type: actionType
      });

      let label = 'Tindakan dicatat';
      if (actionType === 'ACKNOWLEDGED') label = 'Sinyal telah ditandai dilihat.';
      else if (actionType === 'CONTACT_ATTEMPTED') label = 'Upaya menghubungi telah dicatat.';
      else if (actionType === 'CONTACTED') label = 'Status terhubung telah dicatat.';
      else if (actionType === 'ESCALATED_TO_CLINICAL') label = 'Sinyal telah diteruskan ke tenaga kesehatan.';

      setActionSuccess(label);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui status sinyal.');
    }
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleModalSignal) return;
    setSubmittingSchedule(true);
    setError('');
    try {
      await recordCompanionCareSignalAction(scheduleModalSignal.public_id, {
        action_type: 'FOLLOW_UP_SCHEDULED',
        next_follow_up_at: nextFollowUpDate ? new Date(nextFollowUpDate).toISOString() : null
      });
      setActionSuccess('Jadwal tindak lanjut berhasil disimpan.');
      setScheduleModalSignal(null);
      setNextFollowUpDate('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal menjadwalkan tindak lanjut.');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  return (
    <section aria-labelledby="companion-followup-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="companion-followup-title" className="text-xl font-bold text-slate-900">
            Perlu Dukungan
          </h2>
          <p className="text-sm text-slate-500">
            Daftar kebutuhan tindak lanjut umum dari pasien yang memberi izin pendampingan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          <Icon name="activity" className="mr-1.5 h-4 w-4" />
          Perbarui
        </Button>
      </div>

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
        <Card className="p-6 text-center text-sm text-slate-500">
          Memeriksa kebutuhan dukungan pasien...
        </Card>
      ) : signals.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Icon name="check" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Tidak ada kebutuhan dukungan tertunda
              </p>
              <p className="text-xs text-slate-500">
                Semua pasien dampingan dalam kondisi terpantau atau belum memiliki sinyal tindak lanjut baru.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <Card key={signal.public_id} className="border-amber-200 bg-amber-50/20">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900">
                      {signal.patient_display_alias}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-800">
                      {signal.support_title}
                    </h4>
                  </div>
                  <StatusBadge variant={signal.status === 'OPEN' ? 'neutral' : 'info'}>
                    {signal.status}
                  </StatusBadge>
                </div>
                <CardDescription className="text-xs text-slate-600 mt-1">
                  {signal.support_description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>Terdeteksi: {new Date(signal.detected_at).toLocaleDateString('id-ID')}</span>
                  {signal.overdue_bucket ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                      {signal.overdue_bucket === '1_TO_7_DAYS'
                        ? '1–7 hari terlewat'
                        : signal.overdue_bucket === '8_TO_30_DAYS'
                        ? '8–30 hari terlewat'
                        : '> 30 hari terlewat'}
                    </span>
                  ) : null}
                  {signal.preferred_contact_time ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                      Waktu kontak: {signal.preferred_contact_time}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {signal.status === 'OPEN' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => handleSimpleAction(signal, 'ACKNOWLEDGED')}
                    >
                      Tandai sudah dilihat
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => handleSimpleAction(signal, 'CONTACT_ATTEMPTED')}
                  >
                    Upaya menghubungi
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 text-emerald-800 border-emerald-300"
                    onClick={() => handleSimpleAction(signal, 'CONTACTED')}
                  >
                    Sudah terhubung
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => {
                      setScheduleModalSignal(signal);
                      setNextFollowUpDate('');
                    }}
                  >
                    Jadwalkan tindak lanjut
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => handleSimpleAction(signal, 'ESCALATED_TO_CLINICAL')}
                  >
                    Teruskan ke tenaga kesehatan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SCHEDULE MODAL */}
      <AccessibleModal
        open={Boolean(scheduleModalSignal)}
        onClose={() => setScheduleModalSignal(null)}
        title="Jadwalkan Tindak Lanjut"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Tentukan rencana waktu kontak atau pendampingan berikutnya untuk{' '}
            <strong>{scheduleModalSignal?.patient_display_alias}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tanggal & Waktu Rencana Tindak Lanjut
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
              onClick={() => setScheduleModalSignal(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleScheduleSubmit}
              disabled={submittingSchedule}
            >
              {submittingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </section>
  );
}
