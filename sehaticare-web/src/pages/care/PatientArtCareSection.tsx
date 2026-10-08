import { FormEvent, useEffect, useState } from 'react';
import {
  getPatientAdherence,
  getPatientArtCare,
  getPatientArtCareHistory,
  getPatientSupportConsent,
  PatientArtCarePlan,
  AdherenceSummary,
  syncPatientReminder,
  updatePatientSupportConsent
} from '../../api/artCare';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { StatusBadge } from '../../components/ui/patterns';

interface Props {
  token: string;
}

export function PatientArtCareSection({ token }: Props) {
  const [activePlan, setActivePlan] = useState<PatientArtCarePlan | null>(null);
  const [history, setHistory] = useState<PatientArtCarePlan[]>([]);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reminder setup modal/form state
  const [activeReminderItemId, setActiveReminderItemId] = useState<string | null>(null);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [reminderLabel, setReminderLabel] = useState('Pengingat Minum Obat');
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  // Show history state
  const [showHistory, setShowHistory] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [planRes, historyRes, adhRes, consentRes] = await Promise.all([
        getPatientArtCare(token),
        getPatientArtCareHistory(token),
        getPatientAdherence(token, 7),
        getPatientSupportConsent(token)
      ]);
      setActivePlan(planRes?.plan || null);
      setHistory(historyRes?.items || []);
      setAdherence(adhRes?.summary || null);
      setConsentEnabled(Boolean(consentRes?.is_consent_enabled));
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rencana perawatan ART.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const handleConsentToggle = async () => {
    if (!token || consentLoading) return;
    setConsentLoading(true);
    setError('');
    setSuccessMsg('');
    const nextState = !consentEnabled;
    try {
      const updated = await updatePatientSupportConsent(token, nextState);
      setConsentEnabled(updated.is_consent_enabled);
      setSuccessMsg(
        updated.is_consent_enabled
          ? 'Berbagi ringkasan kepatuhan dengan pendamping telah diaktifkan.'
          : 'Berbagi ringkasan kepatuhan telah dinonaktifkan. Pendamping tidak dapat melihat ringkasan Anda.'
      );
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui izin berbagi pendamping.');
    } finally {
      setConsentLoading(false);
    }
  };

  const handleReminderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !activeReminderItemId) return;
    setReminderSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await syncPatientReminder(token, {
        art_item_id: activeReminderItemId,
        display_label: reminderLabel.trim() || 'Pengingat Minum Obat',
        reminder_times: [reminderTime],
        timezone: 'Asia/Jayapura',
        notification_privacy: 'NEUTRAL',
        is_active: true
      });
      setSuccessMsg('Pengingat obat berhasil disimpan di jadwal harian.');
      setActiveReminderItemId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal mengatur pengingat obat.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500 animate-pulse">Memuat rencana terapi ART dan catatan kepatuhan...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6" id="patient-art-care-section">
      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {successMsg ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-xs text-emerald-700 font-bold ml-2">
            ✕
          </button>
        </div>
      ) : null}

      {/* RENCANA TERAPI ART AKTIF */}
      <Card className="border-sky-200 bg-gradient-to-br from-sky-50/40 to-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg text-sky-950 flex items-center gap-2">
              <Icon name="activity" className="h-5 w-5 text-sky-600" />
              Rencana Terapi ART (Antiretroviral)
            </CardTitle>
            {activePlan ? (
              <StatusBadge variant="success">Sedang Berjalan</StatusBadge>
            ) : (
              <StatusBadge variant="neutral">Belum Ada Terapi Aktif</StatusBadge>
            )}
          </div>
          <CardDescription className="text-slate-600">
            {activePlan
              ? `Diresepkan oleh ${activePlan.prescribed_by?.display_alias || 'Dokter Penanggung Jawab'} sejak ${new Date(
                  activePlan.started_at
                ).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Rencana terapi obat ditentukan oleh dokter pemeriksa berdasarkan evaluasi klinis.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {activePlan ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-1">
                {activePlan.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-base text-slate-900">{item.medication_name}</strong>
                      {item.strength ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {item.strength}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <strong>Frekuensi:</strong> {item.frequency_per_day}x sehari
                      </span>
                      {item.timing_description ? (
                        <span>
                          <strong>Waktu:</strong> {item.timing_description}
                        </span>
                      ) : null}
                    </div>

                    {item.dose_instructions ? (
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <strong>Petunjuk:</strong> {item.dose_instructions}
                      </p>
                    ) : null}

                    {/* Reminder Status & Quick Configure */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                      <div className="text-xs text-slate-500">
                        {item.reminders && item.reminders.length > 0 ? (
                          <span className="text-emerald-700 font-medium">
                            🔔 Pengingat aktif jam {item.reminders[0].times.join(', ')}
                          </span>
                        ) : (
                          <span>Belum ada pengingat terjadwal</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveReminderItemId(item.id);
                          setReminderLabel(`Pengingat ${item.medication_name.slice(0, 30)}`);
                        }}
                      >
                        {item.reminders && item.reminders.length > 0 ? 'Ubah Jam Pengingat' : 'Pasang Pengingat'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {activePlan.clinical_notes ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3.5 text-xs text-sky-900">
                  <strong className="block mb-1">Catatan dari Dokter:</strong>
                  <p>{activePlan.clinical_notes}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Saat ini belum ada resep ART aktif yang tercatat. Silakan berkonsultasi dengan dokter Anda untuk memulai
              atau memperbarui rencana terapi.
            </p>
          )}

          {/* Quick Reminder Form Modal */}
          {activeReminderItemId ? (
            <form onSubmit={handleReminderSubmit} className="mt-4 rounded-xl border border-brand/30 bg-white p-4 shadow-sm space-y-3">
              <strong className="text-sm text-slate-900 block">Atur Pengingat Minum Obat</strong>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="reminder-time-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Waktu Minum Obat (HH:mm)
                  </label>
                  <input
                    type="time"
                    id="reminder-time-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reminder-label-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Label Notifikasi (Netral)
                  </label>
                  <input
                    type="text"
                    id="reminder-label-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    value={reminderLabel}
                    onChange={(e) => setReminderLabel(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" type="button" onClick={() => setActiveReminderItemId(null)}>
                  Batal
                </Button>
                <Button size="sm" type="submit" disabled={reminderSubmitting}>
                  {reminderSubmitting ? 'Menyimpan...' : 'Simpan Pengingat'}
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* RINGKASAN KEPATUHAN & JADWAL KONTROL */}
      <section aria-labelledby="adherence-summary-title" className="space-y-3">
        <h3 id="adherence-summary-title" className="text-lg font-bold text-slate-900">
          Ringkasan Kepatuhan & Kontrol
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4 border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Jadwal Selesai (7 Hari)
            </span>
            <strong className="text-2xl text-slate-900">
              {adherence ? adherence.doses_taken : 0}
            </strong>
            <span className="text-xs text-slate-500 block mt-1">
              dari total {adherence ? adherence.doses_scheduled : 0} jadwal tercatat
            </span>
          </Card>

          <Card className="p-4 border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Tingkat Kepatuhan
            </span>
            <strong className="text-2xl text-emerald-700">
              {adherence && adherence.adherence_percentage !== null
                ? `${adherence.adherence_percentage}%`
                : '—'}
            </strong>
            <span className="text-xs text-slate-500 block mt-1">
              {adherence?.doses_missed ? `${adherence.doses_missed} jadwal terlewat` : 'Tidak ada jadwal terlewat'}
            </span>
          </Card>

          <Card className="p-4 border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Kontrol Berikutnya
            </span>
            <strong className="text-base text-slate-900 block truncate">
              {adherence?.upcoming_control_schedule
                ? new Date(adherence.upcoming_control_schedule.starts_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })
                : 'Belum Terjadwal'}
            </strong>
            <span className="text-xs text-slate-500 block mt-1">
              {adherence?.upcoming_control_schedule
                ? `${new Date(adherence.upcoming_control_schedule.starts_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })} ${adherence.upcoming_control_schedule.timezone}`
                : 'Konsultasikan tanggal kontrol berikutnya'}
            </span>
          </Card>
        </div>
      </section>

      {/* BERBAGI DUKUNGAN DENGAN PENDAMPING (CONSENT) */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/30 to-white">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base text-indigo-950 flex items-center gap-2">
              <Icon name="shield" className="h-4 w-4 text-indigo-600" />
              Berbagi Ringkasan Kepatuhan dengan Pendamping
            </CardTitle>
            <StatusBadge variant={consentEnabled ? 'success' : 'neutral'}>
              {consentEnabled ? 'Berbagi Aktif' : 'Tidak Berbagi (Privat)'}
            </StatusBadge>
          </div>
          <CardDescription className="text-slate-600 text-xs leading-relaxed">
            Persetujuan ini mengizinkan pendamping sebaya Anda melihat <strong>hanya ringkasan angka kepatuhan 7 hari</strong> untuk
            memberikan dorongan semangat. Pendamping <strong>tidak akan pernah</strong> menerima nama obat, dosis, atau
            catatan medis Anda. Pilihan ini dinonaktifkan secara bawaan dan dapat dicabut kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Status:{' '}
            <strong className={consentEnabled ? 'text-emerald-700' : 'text-slate-700'}>
              {consentEnabled ? 'Izin Diberikan' : 'Dinonaktifkan'}
            </strong>
          </div>
          <Button
            variant={consentEnabled ? 'outline' : 'default'}
            size="sm"
            id="toggle-companion-consent-btn"
            disabled={consentLoading}
            onClick={() => void handleConsentToggle()}
          >
            {consentLoading ? 'Memproses...' : consentEnabled ? 'Cabut Izin Berbagi' : 'Aktifkan Berbagi Dukungan'}
          </Button>
        </CardContent>
      </Card>

      {/* RIWAYAT TERAPI ART */}
      {history.length > 0 ? (
        <div className="pt-2">
          <button
            type="button"
            className="text-xs text-slate-600 font-semibold hover:text-brand flex items-center gap-1 cursor-pointer"
            onClick={() => setShowHistory((prev) => !prev)}
          >
            <Icon name="chevron" className={showHistory ? 'rotate-90' : ''} />
            {showHistory ? 'Sembunyikan Riwayat Terapi Sebelumnya' : `Lihat Riwayat Terapi Sebelumnya (${history.length})`}
          </button>

          {showHistory ? (
            <div className="mt-3 space-y-3">
              {history.map((hPlan) => (
                <div key={hPlan.public_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-800">
                      Periode:{' '}
                      {new Date(hPlan.started_at).toLocaleDateString('id-ID')} —{' '}
                      {hPlan.ended_at ? new Date(hPlan.ended_at).toLocaleDateString('id-ID') : 'Selesai'}
                    </strong>
                    <StatusBadge variant="neutral">{hPlan.status}</StatusBadge>
                  </div>
                  {hPlan.change_reason ? (
                    <p className="text-slate-600 italic">Alasan perubahan: {hPlan.change_reason}</p>
                  ) : null}
                  <div className="text-slate-700">
                    {hPlan.items.map((it) => (
                      <span key={it.id} className="inline-block mr-3">
                        • {it.medication_name} {it.strength ? `(${it.strength})` : ''} - {it.frequency_per_day}x/hari
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
