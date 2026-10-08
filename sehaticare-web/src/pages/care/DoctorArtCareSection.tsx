import { FormEvent, useEffect, useState } from 'react';
import {
  createDoctorPatientArtCare,
  getDoctorPatientAdherence,
  getDoctorPatientArtCare,
  getDoctorPatientSideEffects,
  getDoctorPatientStockSummary,
  updateDoctorPatientArtCare,
  PatientArtCarePlan,
  AdherenceSummary,
  SideEffectEntry,
  PatientStockResponse
} from '../../api/artCare';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { StatusBadge } from '../../components/ui/patterns';

interface Props {
  token: string;
  patientPublicId: string;
}

interface NewItemForm {
  medication_name: string;
  strength: string;
  dose_instructions: string;
  frequency_per_day: number;
  timing_description: string;
}

export function DoctorArtCareSection({ token, patientPublicId }: Props) {
  const [activePlan, setActivePlan] = useState<PatientArtCarePlan | null>(null);
  const [history, setHistory] = useState<PatientArtCarePlan[]>([]);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [sideEffects, setSideEffects] = useState<SideEffectEntry[]>([]);
  const [stockSummary, setStockSummary] = useState<PatientStockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [items, setItems] = useState<NewItemForm[]>([
    {
      medication_name: '',
      strength: '',
      dose_instructions: '',
      frequency_per_day: 1,
      timing_description: ''
    }
  ]);

  const loadData = async () => {
    if (!token || !patientPublicId) return;
    setLoading(true);
    setError('');
    try {
      const [artRes, adhRes, seRes, stkRes] = await Promise.all([
        getDoctorPatientArtCare(token, patientPublicId),
        getDoctorPatientAdherence(token, patientPublicId, 7).catch(() => null),
        getDoctorPatientSideEffects(token, patientPublicId).catch(() => ({ items: [] })),
        getDoctorPatientStockSummary(token, patientPublicId).catch(() => null)
      ]);
      setActivePlan(artRes.active_plan || null);
      setHistory(artRes.history || []);
      setAdherence(adhRes?.summary || null);
      setSideEffects(seRes?.items || []);
      setStockSummary(stkRes || null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rencana ART pasien.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token, patientPublicId]);

  const addItemRow = () => {
    if (items.length >= 10) return;
    setItems((prev) => [
      ...prev,
      {
        medication_name: '',
        strength: '',
        dose_instructions: '',
        frequency_per_day: 1,
        timing_description: ''
      }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof NewItemForm, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !patientPublicId) return;
    setSubmitting(true);
    setFormError('');
    setSuccessMsg('');

    // Validation
    const validItems = items.filter((it) => it.medication_name.trim().length > 0);
    if (!validItems.length) {
      setFormError('Minimal satu nama obat/rejimen harus diisi.');
      setSubmitting(false);
      return;
    }

    try {
      await createDoctorPatientArtCare(token, patientPublicId, {
        items: validItems.map((it) => ({
          medication_name: it.medication_name.trim(),
          strength: it.strength.trim() || null,
          dose_instructions: it.dose_instructions.trim() || null,
          frequency_per_day: Number(it.frequency_per_day) || 1,
          timing_description: it.timing_description.trim() || null
        })),
        clinical_notes: clinicalNotes.trim() || null,
        change_reason: changeReason.trim() || null
      });

      setSuccessMsg('Rencana terapi ART berhasil disimpan.');
      setShowForm(false);
      setClinicalNotes('');
      setChangeReason('');
      setItems([
        {
          medication_name: '',
          strength: '',
          dose_instructions: '',
          frequency_per_day: 1,
          timing_description: ''
        }
      ]);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan rencana terapi ART.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndPlan = async (planPublicId: string) => {
    if (!token || !patientPublicId) return;
    if (!window.confirm('Hentikan terapi ART aktif ini? Riwayat akan tetap tersimpan.')) return;
    try {
      await updateDoctorPatientArtCare(token, patientPublicId, planPublicId, {
        status: 'DISCONTINUED',
        change_reason: 'Dihentikan oleh dokter pemeriksa'
      });
      setSuccessMsg('Status terapi ART berhasil diperbarui menjadi Dihentikan.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui status terapi.');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500 animate-pulse">Memuat data resep terapi ART dan kepatuhan...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6" id="doctor-art-care-section">
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
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <Icon name="activity" className="h-5 w-5 text-indigo-600" />
                Rencana Terapi ART Pasien
              </CardTitle>
              <CardDescription>
                Kelola rejimen obat antiretroviral secara fleksibel tanpa merusak riwayat terapi sebelumnya.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={showForm ? 'outline' : 'default'}
                id="toggle-doctor-art-form-btn"
                onClick={() => {
                  setShowForm((prev) => !prev);
                  setFormError('');
                }}
              >
                {showForm ? 'Batal' : activePlan ? 'Perbarui Terapi ART' : 'Resepkan Terapi ART'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {activePlan ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm text-emerald-950">Terapi Aktif</strong>
                  <span className="text-xs text-slate-500 block">
                    Dimulai:{' '}
                    {new Date(activePlan.started_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="success">Aktif</StatusBadge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    onClick={() => void handleEndPlan(activePlan.public_id)}
                  >
                    Hentikan
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {activePlan.items.map((it) => (
                  <div key={it.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 text-sm">{it.medication_name}</strong>
                      {it.strength ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {it.strength}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-600">
                      Frekuensi: {it.frequency_per_day}x sehari{' '}
                      {it.timing_description ? `(${it.timing_description})` : ''}
                    </p>
                    {it.dose_instructions ? (
                      <p className="text-slate-700 italic">Petunjuk: {it.dose_instructions}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {activePlan.clinical_notes ? (
                <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs text-slate-700">
                  <strong>Catatan Klinis Dokter:</strong>
                  <p className="mt-0.5">{activePlan.clinical_notes}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Pasien ini belum memiliki terapi ART aktif. Klik tombol di atas untuk meresepkan terapi pertama.
            </p>
          )}

          {/* FORM RESEP TERAPI ART */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-indigo-200 bg-slate-50/70 p-4 space-y-4">
              <strong className="text-sm text-slate-900 block">
                {activePlan ? 'Form Pembaruan Terapi ART (Transisi Aman)' : 'Form Peresepan Terapi ART Baru'}
              </strong>

              {formError ? (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              ) : null}

              {activePlan ? (
                <div>
                  <label htmlFor="art-change-reason" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Alasan Perubahan Terapi
                  </label>
                  <input
                    type="text"
                    id="art-change-reason"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                    placeholder="Contoh: Substitusi rejimen karena efek samping / optimasi dosis"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                  />
                </div>
              ) : null}

              {/* Dynamic Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Daftar Obat / Rejimen</span>
                  <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                    + Tambah Obat
                  </Button>
                </div>

                {items.map((it, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Obat #{idx + 1}</span>
                      {items.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-rose-600 font-bold hover:underline"
                          onClick={() => removeItemRow(idx)}
                        >
                          Hapus
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nama Obat / Rejimen *
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none"
                          placeholder="Contoh: Tenofovir + Lamivudine + Dolutegravir"
                          value={it.medication_name}
                          onChange={(e) => updateItemRow(idx, 'medication_name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kekuatan Sediaan (opsional)
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none"
                          placeholder="Contoh: 300/300/50 mg"
                          value={it.strength}
                          onChange={(e) => updateItemRow(idx, 'strength', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Frekuensi Minum per Hari
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none bg-white"
                          value={it.frequency_per_day}
                          onChange={(e) => updateItemRow(idx, 'frequency_per_day', parseInt(e.target.value, 10))}
                        >
                          <option value={1}>1 kali sehari</option>
                          <option value={2}>2 kali sehari</option>
                          <option value={3}>3 kali sehari</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Waktu Minum Obat (opsional)
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none"
                          placeholder="Contoh: Malam sebelum tidur"
                          value={it.timing_description}
                          onChange={(e) => updateItemRow(idx, 'timing_description', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Petunjuk / Aturan Tambahan (opsional)
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none"
                        placeholder="Contoh: 1 tablet sesudah makan malam"
                        value={it.dose_instructions}
                        onChange={(e) => updateItemRow(idx, 'dose_instructions', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="art-clinical-notes" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Catatan Klinis Dokter (opsional)
                </label>
                <textarea
                  id="art-clinical-notes"
                  rows={2}
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none"
                  placeholder="Catatan monitoring, evaluasi kepatuhan, atau instruksi khusus..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowForm(false)}>
                  Batal
                </Button>
                <Button size="sm" type="submit" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Resep Terapi'}
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* RINGKASAN KEPATUHAN PASIEN (DOKTER VIEW) */}
      {adherence ? (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-800">
              Evaluasi Kepatuhan Pasien (7 Hari Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-slate-500 block">Dosis Tercatat Selesai</span>
                <strong className="text-lg text-slate-900 mt-1 block">{adherence.doses_taken}</strong>
                <span className="text-slate-500">dari {adherence.doses_scheduled} jadwal</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-slate-500 block">Tingkat Kepatuhan</span>
                <strong className="text-lg text-emerald-700 mt-1 block">
                  {adherence.adherence_percentage !== null ? `${adherence.adherence_percentage}%` : '—'}
                </strong>
                <span className="text-slate-500">{adherence.doses_missed} terlewat/belum</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-slate-500 block">Kontrol Berikutnya</span>
                <strong className="text-sm text-slate-900 mt-1 block truncate">
                  {adherence.upcoming_control_schedule
                    ? new Date(adherence.upcoming_control_schedule.starts_at).toLocaleDateString('id-ID')
                    : 'Belum dijadwalkan'}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* CATATAN EFEK SAMPING PASIEN (DOKTER VIEW - READ ONLY) */}
      <Card className="border-teal-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-teal-950 flex items-center gap-2">
              <Icon name="activity" className="h-4 w-4 text-teal-600" />
              Catatan Keluhan / Efek Samping Pasien ({sideEffects.length})
            </CardTitle>
          </div>
          <CardDescription className="text-slate-500 text-xs">
            Laporan keluhan mandiri pasien untuk bahan pertimbangan evaluasi klinis rejimen.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {sideEffects.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-lg">
              Belum ada keluhan atau efek samping yang dilaporkan pasien.
            </p>
          ) : (
            <div className="space-y-2">
              {sideEffects.map((se) => (
                <div key={se.public_id} className="rounded-lg border border-slate-200 p-3 text-xs bg-slate-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-900">{se.symptom_name}</strong>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        variant={
                          se.severity === 'SEVERE'
                            ? 'default'
                            : se.severity === 'MODERATE'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {se.severity === 'SEVERE'
                          ? 'Berat'
                          : se.severity === 'MODERATE'
                          ? 'Sedang'
                          : 'Ringan'}
                      </StatusBadge>
                      <StatusBadge variant={se.status === 'RESOLVED' ? 'success' : 'info'}>
                        {se.status === 'RESOLVED' ? 'Selesai' : 'Aktif'}
                      </StatusBadge>
                    </div>
                  </div>
                  {se.patient_note ? (
                    <p className="text-slate-600 italic">"{se.patient_note}"</p>
                  ) : null}
                  <div className="text-2xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span>
                      Dilaporkan: {new Date(se.occurred_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {se.resolved_at ? (
                      <span>
                        Selesai: {new Date(se.resolved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* STATUS PERSEDIAAN & REFILL PASIEN (DOKTER VIEW - READ ONLY) */}
      <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-amber-950 flex items-center gap-2">
              <Icon name="activity" className="h-4 w-4 text-amber-600" />
              Status Persediaan Obat & Kesiapan Refill Pasien
            </CardTitle>
            <StatusBadge
              variant={
                stockSummary?.refill_status?.refill_status === 'OK'
                  ? 'success'
                  : stockSummary?.refill_status?.refill_status === 'DUE_SOON'
                  ? 'info'
                  : stockSummary?.refill_status?.refill_status === 'NEEDS_ATTENTION'
                  ? 'default'
                  : 'neutral'
              }
            >
              {stockSummary?.refill_status?.refill_status === 'OK'
                ? 'Persediaan Aman'
                : stockSummary?.refill_status?.refill_status === 'DUE_SOON'
                ? 'Perlu Dijadwalkan'
                : stockSummary?.refill_status?.refill_status === 'NEEDS_ATTENTION'
                ? 'Perhatian Segera'
                : 'Belum Ada Data'}
            </StatusBadge>
          </div>
          <CardDescription className="text-slate-500 text-xs">
            Data persediaan obat mandiri yang dilaporkan pasien.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="text-slate-500 block">Estimasi Sisa Obat</span>
              <strong className="text-base text-slate-900 mt-1 block">
                {stockSummary?.refill_status?.estimated_days_remaining !== null && stockSummary?.refill_status?.estimated_days_remaining !== undefined
                  ? `${stockSummary.refill_status.estimated_days_remaining} Hari Tersisa`
                  : stockSummary?.current_stock?.quantity_remaining !== null && stockSummary?.current_stock?.quantity_remaining !== undefined
                  ? `${stockSummary.current_stock.quantity_remaining} ${stockSummary.current_stock.unit || 'unit'}`
                  : 'Belum dilaporkan'}
              </strong>
              <span className="text-2xs text-slate-400">
                {stockSummary?.refill_status?.last_recorded_at
                  ? `Pembaruan: ${new Date(stockSummary.refill_status.last_recorded_at).toLocaleDateString('id-ID')}`
                  : '—'}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="text-slate-500 block">Jadwal Kontrol Terdekat</span>
              <strong className="text-sm text-slate-900 mt-1 block truncate">
                {stockSummary?.refill_status?.next_control_schedule
                  ? new Date(stockSummary.refill_status.next_control_schedule.starts_at).toLocaleDateString('id-ID')
                  : 'Belum ada jadwal kontrol'}
              </strong>
              <span className="text-2xs text-slate-400">
                {stockSummary?.refill_status?.next_control_schedule
                  ? stockSummary.refill_status.next_control_schedule.timezone
                  : '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIWAYAT TERAPI SEBELUMNYA */}
      {history.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Riwayat Terapi Sebelumnya ({history.length})
          </h4>
          <div className="space-y-2">
            {history.map((hPlan) => (
              <div key={hPlan.public_id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">
                    Periode: {new Date(hPlan.started_at).toLocaleDateString('id-ID')} —{' '}
                    {hPlan.ended_at ? new Date(hPlan.ended_at).toLocaleDateString('id-ID') : 'Selesai'}
                  </span>
                  <StatusBadge variant="neutral">{hPlan.status}</StatusBadge>
                </div>
                {hPlan.change_reason ? (
                  <p className="text-slate-500 italic">Alasan perubahan: {hPlan.change_reason}</p>
                ) : null}
                <div className="text-slate-800">
                  {hPlan.items.map((it) => (
                    <span key={it.id} className="inline-block mr-3">
                      • {it.medication_name} {it.strength ? `(${it.strength})` : ''} - {it.frequency_per_day}x/hari
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
