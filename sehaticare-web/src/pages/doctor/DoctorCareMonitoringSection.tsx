import { FormEvent, useEffect, useState } from 'react';
import {
  archiveDoctorMonitoring,
  createDoctorConsultationMonitoring,
  createDoctorMonitoring,
  DoctorMonitoringEntry,
  getDoctorConsultationCare,
  getDoctorConsultationMonitoring,
  getDoctorPatientCare,
  getDoctorPatientMonitoring
} from '../../api/hivCare';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { StatusBadge } from '../../components/ui/patterns';

interface Props {
  token: string;
  consultationId?: string;
  patientPublicId?: string;
}

export function DoctorCareMonitoringSection({ token, consultationId, patientPublicId }: Props) {
  const [careSummary, setCareSummary] = useState<any>(null);
  const [entries, setEntries] = useState<DoctorMonitoringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [weightKg, setWeightKg] = useState('');
  const [cd4Count, setCd4Count] = useState('');
  const [viralLoad, setViralLoad] = useState('');
  const [viralLoadInterpretation, setViralLoadInterpretation] = useState('');
  const [tbScreening, setTbScreening] = useState('');
  const [generalCondition, setGeneralCondition] = useState('');
  const [clinicalNotePrivate, setClinicalNotePrivate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      if (consultationId) {
        const [careRes, monRes] = await Promise.all([
          getDoctorConsultationCare(token, consultationId),
          getDoctorConsultationMonitoring(token, consultationId, 1, 50, true)
        ]);
        setCareSummary(careRes);
        setEntries(monRes?.items || []);
      } else if (patientPublicId) {
        const [careRes, monRes] = await Promise.all([
          getDoctorPatientCare(token, patientPublicId),
          getDoctorPatientMonitoring(token, patientPublicId, 1, 50, true)
        ]);
        setCareSummary(careRes);
        setEntries(monRes?.items || []);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data pemantauan klinis pasien.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token, consultationId, patientPublicId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    const parsedWeight = weightKg.trim() ? parseFloat(weightKg) : null;
    if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
      setFormError('Berat badan harus angka positif yang valid (maksimal 500 kg).');
      setSubmitting(false);
      return;
    }

    const parsedCd4 = cd4Count.trim() ? parseInt(cd4Count, 10) : null;
    if (parsedCd4 !== null && (isNaN(parsedCd4) || parsedCd4 < 0 || parsedCd4 > 100000)) {
      setFormError('Jumlah CD4 harus berupa bilangan bulat tidak negatif (0 - 100.000).');
      setSubmitting(false);
      return;
    }

    const parsedVl = viralLoad.trim() ? parseInt(viralLoad, 10) : null;
    if (parsedVl !== null && (isNaN(parsedVl) || parsedVl < 0)) {
      setFormError('Viral load harus berupa bilangan bulat tidak negatif.');
      setSubmitting(false);
      return;
    }

    const payload = {
      recorded_at: new Date(recordedAt).toISOString(),
      weight_kg: parsedWeight,
      cd4_count_cells_mm3: parsedCd4,
      viral_load_copies_ml: parsedVl,
      viral_load_interpretation: viralLoadInterpretation || null,
      tb_screening_result: tbScreening.trim() || null,
      general_condition: generalCondition.trim() || null,
      clinical_note_private: clinicalNotePrivate.trim() || null
    };

    try {
      if (consultationId) {
        await createDoctorConsultationMonitoring(token, consultationId, payload);
      } else if (patientPublicId) {
        await createDoctorMonitoring(token, patientPublicId, payload);
      }
      setFormSuccess('Catatan pemantauan klinis berhasil disimpan.');
      setWeightKg('');
      setCd4Count('');
      setViralLoad('');
      setViralLoadInterpretation('');
      setTbScreening('');
      setGeneralCondition('');
      setClinicalNotePrivate('');
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan catatan pemantauan klinis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (monitoringPublicId: string) => {
    if (!token || !window.confirm('Arsipkan catatan pemantauan ini?')) return;
    try {
      await archiveDoctorMonitoring(token, monitoringPublicId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengarsipkan catatan pemantauan.');
    }
  };

  const care = careSummary?.care;
  const isEnrolled = care && care.status === 'ACTIVE';

  return (
    <Card className="border-sky-200/90 shadow-sm" data-testid="doctor-care-monitoring-section">
      <CardHeader className="bg-sky-50/40 border-b border-sky-100/80 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
              <Icon name="activity" className="h-5 w-5 text-sky-700" />
              Pemantauan Klinis & Care Enrollment Pasien
            </CardTitle>
            <CardDescription className="text-slate-600">
              Pencatatan data klinis longitudinal (CD4, Viral Load, TB, catatan privat dokter).
            </CardDescription>
          </div>
          {isEnrolled ? (
            <Button
              variant={showForm ? 'outline' : 'default'}
              size="sm"
              id="doctor-add-monitoring-btn"
              onClick={() => {
                setShowForm((p) => !p);
                setFormError('');
                setFormSuccess('');
              }}
            >
              <Icon name="activity" />
              {showForm ? 'Tutup Formulir' : 'Tambah Pemantauan'}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {formSuccess ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {formSuccess}
          </div>
        ) : null}

        {/* STATUS PERAWATAN */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Status Care Enrollment Pasien
          </span>
          {loading ? (
            <p className="text-sm text-slate-500 animate-pulse">Memeriksa enrollment pasien...</p>
          ) : isEnrolled ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-base text-slate-900">
                  {care.facility?.name || 'Fasilitas Layanan Utama'}
                </strong>
                <p className="text-xs text-slate-500">
                  Terdaftar sejak{' '}
                  {new Date(care.enrolled_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <StatusBadge variant="success">Care Terdaftar (Aktif)</StatusBadge>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-amber-800">
                Pasien belum memiliki Care Enrollment aktif. Pencatatan pemantauan klinis memerlukan enrollment aktif yang dibuat oleh administrator.
              </p>
              <StatusBadge variant="outline">Belum Terdaftar</StatusBadge>
            </div>
          )}
        </div>

        {/* FORM TAMBAH PEMANTAUAN */}
        {showForm && isEnrolled ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-sky-300 bg-sky-50/20 p-5 space-y-4 shadow-sm"
            data-testid="doctor-monitoring-form"
          >
            <h4 className="text-base font-bold text-slate-900 border-b border-sky-100 pb-2">
              Formulir Pemantauan Klinis Pasien
            </h4>

            {formError ? (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
                {formError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <label htmlFor="doc-mon-date" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Tanggal & Waktu Pemeriksaan *
                </label>
                <input
                  type="datetime-local"
                  required
                  id="doc-mon-date"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={recordedAt}
                  onChange={(e) => setRecordedAt(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="doc-mon-weight" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Berat Badan (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="500"
                  id="doc-mon-weight"
                  placeholder="Contoh: 65.5"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="doc-mon-cd4" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  CD4 (sel/mm³)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  id="doc-mon-cd4"
                  placeholder="Contoh: 450"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={cd4Count}
                  onChange={(e) => setCd4Count(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="doc-mon-vl" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Viral Load (copies/mL)
                </label>
                <input
                  type="number"
                  min="0"
                  id="doc-mon-vl"
                  placeholder="Contoh: 50"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={viralLoad}
                  onChange={(e) => setViralLoad(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="doc-mon-vl-interp" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Interpretasi Lab Viral Load
                </label>
                <select
                  id="doc-mon-vl-interp"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={viralLoadInterpretation}
                  onChange={(e) => setViralLoadInterpretation(e.target.value)}
                >
                  <option value="">Pilih interpretasi lab...</option>
                  <option value="DETECTED">DETECTED (Terdeteksi)</option>
                  <option value="NOT_DETECTED">NOT_DETECTED (Tidak Terdeteksi)</option>
                  <option value="BELOW_QUANTIFICATION">BELOW_QUANTIFICATION (&lt; Nilai Batas)</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>

              <div>
                <label htmlFor="doc-mon-tb" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Skrining / Hasil TB
                </label>
                <input
                  type="text"
                  maxLength={100}
                  id="doc-mon-tb"
                  placeholder="Contoh: NEGATIF"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={tbScreening}
                  onChange={(e) => setTbScreening(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="doc-mon-condition" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Kondisi Umum Pasien
              </label>
              <input
                type="text"
                maxLength={255}
                id="doc-mon-condition"
                placeholder="Contoh: Keadaan umum baik, tidak ada keluhan nafsu makan"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                value={generalCondition}
                onChange={(e) => setGeneralCondition(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="doc-mon-private-note" className="block text-xs font-semibold text-amber-800 uppercase mb-1">
                Catatan Privat Dokter (Hanya Terlihat Oleh Tenaga Medis)
              </label>
              <textarea
                id="doc-mon-private-note"
                rows={3}
                maxLength={2000}
                placeholder="Catatan observasi internal dokter. Tidak akan dikirimkan ke pasien..."
                className="w-full rounded-xl border border-amber-300 bg-amber-50/30 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                value={clinicalNotePrivate}
                onChange={(e) => setClinicalNotePrivate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Batal
              </Button>
              <Button type="submit" variant="default" size="sm" id="doc-submit-monitoring-btn" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Simpan Catatan Pemantauan'}
              </Button>
            </div>
          </form>
        ) : null}

        {/* RIWAYAT MONITORING */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Riwayat Pemantauan Pasien</h4>
          {loading ? (
            <p className="text-xs text-slate-500 animate-pulse">Memuat riwayat pemantauan...</p>
          ) : (!entries || entries.length === 0) ? (
            <p className="text-xs text-slate-500 py-3">Belum ada riwayat pemantauan untuk pasien ini.</p>
          ) : (
            <div className="space-y-3">
              {(entries || []).map((entry) => (
                <div
                  key={entry.public_id}
                  className={`rounded-xl border p-4 text-xs space-y-2.5 ${
                    entry.archived_at
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : 'border-slate-200/90 bg-white'
                  }`}
                  data-testid={`doctor-entry-${entry.public_id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${
                          entry.source === 'DOCTOR'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {entry.source === 'DOCTOR' ? 'Tenaga Medis' : 'Catatan Mandiri Pasien'}
                      </span>
                      <strong className="text-slate-800">
                        {new Date(entry.recorded_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </strong>
                      {entry.archived_at ? (
                        <span className="text-rose-600 font-semibold">[Diarsipkan]</span>
                      ) : null}
                    </div>

                    {!entry.archived_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-slate-500 hover:text-rose-600 h-7 px-2"
                        onClick={() => handleArchive(entry.public_id)}
                      >
                        Arsipkan
                      </Button>
                    ) : null}
                  </div>

                  {/* DATA GRID */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {entry.weight_kg !== null ? (
                      <div className="rounded bg-slate-50 p-2">
                        <span className="text-slate-500 block">Berat Badan</span>
                        <strong className="text-slate-900">{entry.weight_kg} kg</strong>
                      </div>
                    ) : null}

                    {entry.cd4_count_cells_mm3 !== null ? (
                      <div className="rounded bg-slate-50 p-2">
                        <span className="text-slate-500 block">CD4</span>
                        <strong className="text-slate-900">{entry.cd4_count_cells_mm3} sel/mm³</strong>
                      </div>
                    ) : null}

                    {entry.viral_load_copies_ml !== null || entry.viral_load_interpretation ? (
                      <div className="rounded bg-slate-50 p-2">
                        <span className="text-slate-500 block">Viral Load</span>
                        <strong className="text-slate-900">
                          {entry.viral_load_copies_ml !== null ? `${entry.viral_load_copies_ml} copies/mL` : ''}
                          {entry.viral_load_interpretation ? ` (${entry.viral_load_interpretation})` : ''}
                        </strong>
                      </div>
                    ) : null}

                    {entry.tb_screening_result ? (
                      <div className="rounded bg-slate-50 p-2">
                        <span className="text-slate-500 block">Skrining TB</span>
                        <strong className="text-slate-900">{entry.tb_screening_result}</strong>
                      </div>
                    ) : null}
                  </div>

                  {entry.general_condition ? (
                    <p className="text-slate-700">
                      <strong>Kondisi: </strong>
                      {entry.general_condition}
                    </p>
                  ) : null}

                  {entry.patient_note ? (
                    <p className="text-emerald-900 bg-emerald-50/50 p-2 rounded">
                      <strong>Catatan Mandiri Pasien: </strong>
                      {entry.patient_note}
                    </p>
                  ) : null}

                  {entry.clinical_note_private ? (
                    <div className="rounded-lg bg-amber-50/60 border border-amber-200/80 p-2.5 text-amber-950">
                      <strong className="block text-2xs uppercase tracking-wider text-amber-800 mb-0.5">
                        Catatan Privat Dokter:
                      </strong>
                      <p className="whitespace-pre-line">{entry.clinical_note_private}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
