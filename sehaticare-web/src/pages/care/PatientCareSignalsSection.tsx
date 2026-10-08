import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPatientCareSignals,
  fetchFollowUpSupportConsent,
  updateFollowUpSupportConsent,
  requestClinicalContact,
  requestCompanionSupport,
  PatientCareSignal,
  FollowUpSupportConsent
} from '../../api/careSignals';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { StatusBadge } from '../../components/ui/patterns';

interface Props {
  token?: string;
  onRefresh?: () => void;
}

export function PatientCareSignalsSection({ onRefresh }: Props) {
  const [signals, setSignals] = useState<PatientCareSignal[]>([]);
  const [consent, setConsent] = useState<FollowUpSupportConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Clinical request modal state
  const [showClinicalModal, setShowClinicalModal] = useState(false);
  const [clinicalCategory, setClinicalCategory] = useState<
    'GENERAL_HEALTH_SUPPORT' | 'MEDICATION_QUESTION' | 'FOLLOW_UP_HELP' | 'OTHER'
  >('GENERAL_HEALTH_SUPPORT');
  const [clinicalContactTime, setClinicalContactTime] = useState<
    'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME'
  >('ANYTIME');
  const [submittingClinical, setSubmittingClinical] = useState(false);

  // Companion request state
  const [requestingCompanion, setRequestingCompanion] = useState(false);

  // Consent update state
  const [updatingConsent, setUpdatingConsent] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [signalsRes, consentRes] = await Promise.all([
        fetchPatientCareSignals().catch(() => ({ items: [] })),
        fetchFollowUpSupportConsent().catch(() => null)
      ]);
      setSignals(signalsRes.items || []);
      setConsent(consentRes);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat status tindak lanjut.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleToggleConsent = async () => {
    if (!consent) return;
    setUpdatingConsent(true);
    setError('');
    setActionSuccess('');
    try {
      const nextVal = !consent.is_consent_enabled;
      const res = await updateFollowUpSupportConsent(nextVal);
      setConsent(res);
      setActionSuccess(
        nextVal
          ? 'Dukungan tindak lanjut dari pendamping berhasil diaktifkan.'
          : 'Izin dukungan pendamping berhasil dinonaktifkan.'
      );
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui izin dukungan pendamping.');
    } finally {
      setUpdatingConsent(false);
    }
  };

  const handleRequestClinicalSubmit = async () => {
    setSubmittingClinical(true);
    setError('');
    setActionSuccess('');
    try {
      await requestClinicalContact({
        category: clinicalCategory,
        preferred_contact_time: clinicalContactTime
      });
      setActionSuccess('Permintaan kontak tenaga kesehatan telah dicatat dan akan segera ditindaklanjuti.');
      setShowClinicalModal(false);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal mengajukan permintaan kontak tenaga kesehatan.');
    } finally {
      setSubmittingClinical(false);
    }
  };

  const handleRequestCompanionSupport = async () => {
    setRequestingCompanion(true);
    setError('');
    setActionSuccess('');
    try {
      await requestCompanionSupport();
      setActionSuccess('Permintaan dukungan pendamping berhasil dikirim.');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Gagal meminta dukungan pendamping. Pastikan Anda memiliki pendamping dan izin telah aktif.');
    } finally {
      setRequestingCompanion(false);
    }
  };

  const activeSignals = signals.filter((s) => ['OPEN', 'ACKNOWLEDGED'].includes(s.status));

  return (
    <section aria-labelledby="care-signals-title" className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="care-signals-title" className="text-xl font-bold text-slate-900">
            Perlu Tindak Lanjut
          </h2>
          <p className="text-sm text-slate-600">
            Informasi objektif mengenai jadwal kontrol, persediaan, atau permintaan dukungan layanan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClinicalModal(true)}
            id="btn-request-clinical-contact"
          >
            <Icon name="chat" className="mr-1.5 h-4 w-4" />
            Hubungi Tenaga Kesehatan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestCompanionSupport}
            disabled={requestingCompanion}
            id="btn-request-companion-support"
          >
            <Icon name="users" className="mr-1.5 h-4 w-4" />
            {requestingCompanion ? 'Mengirim...' : 'Minta Dukungan Pendamping'}
          </Button>
        </div>
      </div>

      {actionSuccess ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start justify-between gap-3">
          <span>{actionSuccess}</span>
          <button
            type="button"
            className="text-xs text-emerald-700 underline font-medium"
            onClick={() => setActionSuccess('')}
          >
            Tutup
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            className="text-xs text-rose-700 underline font-medium"
            onClick={() => setError('')}
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* SIGNALS LIST */}
      {loading ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          Memeriksa status tindak lanjut...
        </Card>
      ) : activeSignals.length === 0 ? (
        <Card className="border-slate-200 bg-slate-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Icon name="check" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Semua jadwal dan persediaan berjalan lancar
              </p>
              <p className="text-xs text-slate-500">
                Tidak ada kontrol terlewat atau persediaan yang membutuhkan perhatian saat ini.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeSignals.map((signal) => {
            const isPriority = signal.priority === 'PRIORITY';
            return (
              <Card
                key={signal.public_id}
                className={`transition-shadow hover:shadow-md ${
                  isPriority
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isPriority
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {signal.priority === 'PRIORITY' ? 'Prioritas' : 'Perlu Perhatian'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(signal.detected_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  </div>
                  <CardTitle className="text-base text-slate-900 mt-2">
                    {signal.display_title}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    {signal.display_message}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {signal.safety_guidance ? (
                    <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-900 border border-rose-100">
                      <strong>Panduan: </strong>
                      {signal.safety_guidance}
                    </div>
                  ) : null}

                  {signal.cta ? (
                    <div className="pt-1">
                      {signal.cta.action === 'SCHEDULE_FOLLOW_UP' ? (
                        <Link to="/jadwal">
                          <Button size="sm" variant="default" className="w-full">
                            {signal.cta.label}
                          </Button>
                        </Link>
                      ) : signal.cta.action === 'UPDATE_STOCK' ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={() => {
                            const el = document.getElementById('btn-add-stock');
                            if (el) el.click();
                          }}
                        >
                          {signal.cta.label}
                        </Button>
                      ) : signal.cta.action === 'DOCTOR_CONSULTATION' ? (
                        <Link to="/patient/consultations?start=1">
                          <Button size="sm" variant="default" className="w-full">
                            {signal.cta.label}
                          </Button>
                        </Link>
                      ) : signal.cta.action === 'CHAT_COMPANION' ? (
                        <Link to="/patient/consultations">
                          <Button size="sm" variant="default" className="w-full">
                            {signal.cta.label}
                          </Button>
                        </Link>
                      ) : (
                        <div className="rounded-lg bg-slate-100 p-2 text-center text-xs text-slate-600 font-medium">
                          {signal.cta.label}
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* FOLLOW-UP SUPPORT CONSENT CARD */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Dukungan Tindak Lanjut dari Pendamping</CardTitle>
              <CardDescription className="text-xs text-slate-600 max-w-xl mt-1">
                Jika diaktifkan, Pendamping dapat melihat informasi umum bahwa Anda membutuhkan dukungan tindak lanjut. Pendamping tidak dapat melihat catatan klinis, hasil pemeriksaan, atau rincian obat melalui fitur ini.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge variant={consent?.is_consent_enabled ? 'success' : 'neutral'}>
                {consent?.is_consent_enabled ? 'Aktif' : 'Nonaktif'}
              </StatusBadge>
              <Button
                variant={consent?.is_consent_enabled ? 'outline' : 'default'}
                size="sm"
                onClick={handleToggleConsent}
                disabled={updatingConsent || loading}
                id="btn-toggle-followup-consent"
              >
                {updatingConsent
                  ? 'Menyimpan...'
                  : consent?.is_consent_enabled
                  ? 'Nonaktifkan'
                  : 'Aktifkan Dukungan'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* MODAL: REQUEST CLINICAL CONTACT */}
      <AccessibleModal
        open={showClinicalModal}
        onClose={() => setShowClinicalModal(false)}
        title="Hubungi Tenaga Kesehatan"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Pilih kategori dukungan yang Anda butuhkan. Tenaga kesehatan di fasilitas terkait akan menerima sinyal tindak lanjut dan menghubungi Anda sesuai ketersediaan waktu.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kategori Kebutuhan
            </label>
            <select
              value={clinicalCategory}
              onChange={(e) => setClinicalCategory(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
            >
              <option value="GENERAL_HEALTH_SUPPORT">Dukungan Kesehatan Umum</option>
              <option value="MEDICATION_QUESTION">Pertanyaan Seputar Pengobatan</option>
              <option value="FOLLOW_UP_HELP">Bantuan Penjadwalan Kontrol</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Waktu Kontak yang Diinginkan (Opsional)
            </label>
            <select
              value={clinicalContactTime}
              onChange={(e) => setClinicalContactTime(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm bg-white"
            >
              <option value="ANYTIME">Kapan Saja</option>
              <option value="MORNING">Pagi Hari (08.00–12.00)</option>
              <option value="AFTERNOON">Siang/Sore (12.00–17.00)</option>
              <option value="EVENING">Malam (17.00–20.00)</option>
            </select>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
            Fitur ini bukan untuk keadaan darurat. Jika Anda mengalami kondisi gawat darurat, segera datangi IGD atau fasilitas kesehatan terdekat.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowClinicalModal(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleRequestClinicalSubmit}
              disabled={submittingClinical}
            >
              {submittingClinical ? 'Mengirim...' : 'Kirim Permintaan'}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </section>
  );
}
