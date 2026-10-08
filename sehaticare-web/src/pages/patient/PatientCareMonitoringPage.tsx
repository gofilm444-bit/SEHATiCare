import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createPatientSelfReport,
  getPatientCare,
  getPatientMonitoring,
  PatientCareSummaryResponse,
  PatientMonitoringEntry
} from '../../api/hivCare';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { PageHeader, StatusBadge } from '../../components/ui/patterns';
import { useAuth } from '../../context/AuthContext';
import { PatientArtCareSection } from '../care/PatientArtCareSection';
import { PatientCareSignalsSection } from '../care/PatientCareSignalsSection';
import { PatientServiceNavigationSection } from '../care/PatientServiceNavigationSection';
import { PatientReferralsSection } from '../care/PatientReferralsSection';

export function PatientCareMonitoringPage() {
  const { token } = useAuth();
  const [careData, setCareData] = useState<PatientCareSummaryResponse | null>(null);
  const [entries, setEntries] = useState<PatientMonitoringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Self report form state
  const [showSelfReportForm, setShowSelfReportForm] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [generalCondition, setGeneralCondition] = useState('');
  const [patientNote, setPatientNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [careRes, monRes] = await Promise.all([
        getPatientCare(token),
        getPatientMonitoring(token, 1, 30)
      ]);
      setCareData(careRes);
      setEntries(monRes?.items || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data perawatan dan pemantauan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const handleSelfReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    const parsedWeight = weightKg.trim() ? parseFloat(weightKg) : null;
    if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
      setFormError('Berat badan harus berupa angka positif yang valid (maksimal 500 kg).');
      setSubmitting(false);
      return;
    }

    try {
      await createPatientSelfReport(token, {
        recorded_at: new Date().toISOString(),
        weight_kg: parsedWeight,
        general_condition: generalCondition.trim() || null,
        patient_note: patientNote.trim() || null
      });
      setFormSuccess('Catatan pemantauan mandiri berhasil disimpan.');
      setWeightKg('');
      setGeneralCondition('');
      setPatientNote('');
      setShowSelfReportForm(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan catatan pemantauan mandiri.');
    } finally {
      setSubmitting(false);
    }
  };

  const care = careData?.care;
  const isEnrolled = care && care.status === 'ACTIVE';

  return (
    <div className="page-shell pb-24 space-y-8">
      <PageHeader
        title="Perawatan & Pemantauan Saya"
        description="Pantau status layanan perawatan dan catatan kesehatan Anda secara mandiri dengan privasi terjamin."
        action={
          <Link to="/patient">
            <Button variant="outline" size="sm">
              <Icon name="chevron" className="rotate-180" />
              Kembali ke Beranda
            </Button>
          </Link>
        }
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-rose-800">
          <CardContent className="py-4">
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => loadData()}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* RINGKASAN STATUS LAYANAN */}
      <section aria-labelledby="care-status-title">
        <h2 id="care-status-title" className="text-xl font-bold text-slate-900 mb-4">
          Status Layanan Perawatan
        </h2>
        {loading ? (
          <Card className="p-6">
            <p className="text-sm text-slate-500 animate-pulse">Memuat ringkasan layanan...</p>
          </Card>
        ) : isEnrolled ? (
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg text-emerald-950 flex items-center gap-2">
                  <Icon name="check" className="h-5 w-5 text-emerald-600" />
                  Perawatan Aktif Terdaftar
                </CardTitle>
                <StatusBadge variant="success">Aktif</StatusBadge>
              </div>
              <CardDescription className="text-emerald-800">
                Terdaftar sejak{' '}
                {new Date(care.enrolled_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Fasilitas Layanan
                  </span>
                  <strong className="text-slate-900 text-base">
                    {care.facility ? care.facility.name : 'Belum ditetapkan'}
                  </strong>
                  {care.facility?.address ? (
                    <p className="text-xs text-slate-500 mt-1">{care.facility.address}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Pemantauan Terakhir
                  </span>
                  <strong className="text-slate-900 text-base">
                    {careData?.latest_monitoring_date
                      ? new Date(careData.latest_monitoring_date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Belum ada catatan pemantauan'}
                  </strong>
                  <p className="text-xs text-slate-500 mt-1">
                    Data terekam secara longitudinal dalam sistem
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-slate-50/70 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <strong className="text-base text-slate-900 block">
                  {care ? `Status Layanan: ${care.status}` : 'Belum Terdaftar Dalam Care Enrollment'}
                </strong>
                <p className="text-sm text-slate-600 mt-1 max-w-xl">
                  {care
                    ? 'Layanan perawatan Anda saat ini tidak dalam status aktif.'
                    : 'Pendaftaran program perawatan HIV dilakukan oleh administrator fasilitas kesehatan.'}
                </p>
              </div>
              <Link to="/informasi-layanan">
                <Button variant="outline" size="sm">
                  Cari Fasilitas Layanan
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </section>

      {/* PERLU TINDAK LANJUT & DUKUNGAN */}
      {token ? <PatientCareSignalsSection token={token} /> : null}

      {/* RUJUKAN & TRANSFER LAYANAN */}
      <PatientReferralsSection />

      {/* TEMUKAN LAYANAN KESEHATAN */}
      <PatientServiceNavigationSection />

      {/* RENCANA PERAWATAN ART & KEPATUHAN OBAT */}
      {isEnrolled && token ? (
        <PatientArtCareSection token={token} />
      ) : null}

      {/* FORM PENCATATAN MANDIRI */}
      {isEnrolled ? (
        <section aria-labelledby="self-report-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="self-report-title" className="text-xl font-bold text-slate-900">
                Catatan Pemantauan Mandiri
              </h2>
              <p className="text-sm text-slate-600">
                Anda dapat menambahkan catatan berkala mengenai kondisi tubuh atau berat badan.
              </p>
            </div>
            <Button
              variant={showSelfReportForm ? 'outline' : 'default'}
              size="sm"
              id="toggle-self-report-btn"
              onClick={() => {
                setShowSelfReportForm((prev) => !prev);
                setFormError('');
                setFormSuccess('');
              }}
            >
              <Icon name="activity" />
              {showSelfReportForm ? 'Batal' : 'Tambah Catatan Mandiri'}
            </Button>
          </div>

          {formSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {formSuccess}
            </div>
          ) : null}

          {showSelfReportForm ? (
            <Card className="border-brand/30 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Tambah Catatan Mandiri Baru</CardTitle>
                <CardDescription>
                  Data ini tersimpan dengan penanda sumber mandiri dan dapat dilihat oleh dokter yang merawat Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSelfReportSubmit} className="space-y-4">
                  {formError ? (
                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                      {formError}
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="self-report-weight" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Berat Badan (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="500"
                        id="self-report-weight"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        placeholder="Contoh: 62.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor="self-report-condition" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Kondisi Umum
                      </label>
                      <input
                        type="text"
                        maxLength={255}
                        id="self-report-condition"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        placeholder="Contoh: Nafsu makan baik, tidak lemas"
                        value={generalCondition}
                        onChange={(e) => setGeneralCondition(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="self-report-note" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Catatan Tambahan
                    </label>
                    <textarea
                      id="self-report-note"
                      rows={2}
                      maxLength={1000}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      placeholder="Catatan rutin atau keluhan ringan..."
                      value={patientNote}
                      onChange={(e) => setPatientNote(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSelfReportForm(false)}
                      disabled={submitting}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      size="sm"
                      id="submit-self-report-btn"
                      disabled={submitting}
                    >
                      {submitting ? 'Menyimpan…' : 'Simpan Catatan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* RIWAYAT PEMANTAUAN LONGITUDINAL */}
      <section aria-labelledby="monitoring-history-title">
        <h2 id="monitoring-history-title" className="text-xl font-bold text-slate-900 mb-4">
          Riwayat Pemantauan Klinis & Mandiri
        </h2>

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        ) : (!entries || entries.length === 0) ? (
          <Card className="p-8 text-center border-slate-200">
            <Icon name="clock" className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <strong className="text-base text-slate-800 block">Belum ada riwayat pemantauan</strong>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Hasil pemantauan laboratorium dari dokter atau catatan mandiri Anda akan tampil di sini secara kronologis.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {(entries || []).map((entry) => (
              <article
                key={entry.public_id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3"
                data-testid={`monitoring-entry-${entry.public_id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        entry.source === 'DOCTOR'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {entry.source === 'DOCTOR' ? 'Tenaga Medis' : 'Catatan Mandiri'}
                    </span>
                    <time className="text-xs text-slate-500" dateTime={entry.recorded_at}>
                      {new Date(entry.recorded_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </time>
                  </div>
                </div>

                {/* DATA TERSTRUKTUR */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  {entry.weight_kg !== null ? (
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-slate-500 block mb-0.5">Berat Badan</span>
                      <strong className="text-sm text-slate-900">{entry.weight_kg} kg</strong>
                    </div>
                  ) : null}

                  {entry.cd4_count_cells_mm3 !== null ? (
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-slate-500 block mb-0.5">Jumlah CD4</span>
                      <strong className="text-sm text-slate-900">
                        {entry.cd4_count_cells_mm3} <span className="font-normal text-xs text-slate-500">sel/mm³</span>
                      </strong>
                    </div>
                  ) : null}

                  {entry.viral_load_copies_ml !== null || entry.viral_load_interpretation ? (
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-slate-500 block mb-0.5">Viral Load</span>
                      <strong className="text-sm text-slate-900">
                        {entry.viral_load_copies_ml !== null ? `${entry.viral_load_copies_ml} copies/mL` : ''}
                        {entry.viral_load_interpretation ? ` (${entry.viral_load_interpretation})` : ''}
                      </strong>
                    </div>
                  ) : null}

                  {entry.tb_screening_result ? (
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <span className="text-slate-500 block mb-0.5">Skrining TB</span>
                      <strong className="text-sm text-slate-900">{entry.tb_screening_result}</strong>
                    </div>
                  ) : null}
                </div>

                {entry.general_condition ? (
                  <p className="text-xs text-slate-700 bg-slate-50/70 rounded-lg p-2.5">
                    <strong className="text-slate-900">Kondisi: </strong>
                    {entry.general_condition}
                  </p>
                ) : null}

                {entry.patient_note ? (
                  <p className="text-xs text-slate-700 bg-emerald-50/40 rounded-lg p-2.5 border border-emerald-100">
                    <strong className="text-emerald-950">Catatan Anda: </strong>
                    {entry.patient_note}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
