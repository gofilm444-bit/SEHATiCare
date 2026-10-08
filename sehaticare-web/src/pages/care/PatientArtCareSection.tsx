import { FormEvent, useEffect, useState } from 'react';
import {
  getPatientAdherence,
  getPatientArtCare,
  getPatientArtCareHistory,
  getPatientSupportConsent,
  PatientArtCarePlan,
  AdherenceSummary,
  syncPatientReminder,
  updatePatientSupportConsent,
  getPatientSideEffects,
  createPatientSideEffect,
  updatePatientSideEffect,
  SideEffectEntry,
  getPatientStock,
  recordPatientStock,
  getPatientRefillSettings,
  updatePatientRefillSettings,
  getPatientRefillSupportConsent,
  updatePatientRefillSupportConsent,
  PatientStockResponse
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

  // AG-06: Side-effects state
  const [sideEffects, setSideEffects] = useState<SideEffectEntry[]>([]);
  const [showAddSideEffect, setShowAddSideEffect] = useState(false);
  const [seSymptom, setSeSymptom] = useState('');
  const [seSeverity, setSeSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MILD');
  const [seNote, setSeNote] = useState('');
  const [seSubmitting, setSeSubmitting] = useState(false);

  // AG-06: Stock & Refill state
  const [stockData, setStockData] = useState<PatientStockResponse | null>(null);
  const [refillThreshold, setRefillThreshold] = useState<number>(7);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<number>(7);
  const [thresholdSaving, setThresholdSaving] = useState(false);

  // Record Stock Form state
  const [showRecordStock, setShowRecordStock] = useState(false);
  const [stkQuantity, setStkQuantity] = useState('');
  const [stkUnit, setStkUnit] = useState('tablet');
  const [stkDays, setStkDays] = useState('');
  const [stkNotes, setStkNotes] = useState('');
  const [stkSubmitting, setStkSubmitting] = useState(false);

  // AG-06: Companion Refill Support Consent state
  const [refillConsentEnabled, setRefillConsentEnabled] = useState(false);
  const [refillConsentLoading, setRefillConsentLoading] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [planRes, historyRes, adhRes, consentRes, seRes, stockRes, refSettingRes, refConsentRes] = await Promise.all([
        getPatientArtCare(token),
        getPatientArtCareHistory(token),
        getPatientAdherence(token, 7),
        getPatientSupportConsent(token),
        getPatientSideEffects(token).catch(() => ({ items: [] })),
        getPatientStock(token).catch(() => null),
        getPatientRefillSettings(token).catch(() => ({ refill_alert_threshold_days: 7 })),
        getPatientRefillSupportConsent(token).catch(() => ({ is_consent_enabled: false }))
      ]);
      setActivePlan(planRes?.plan || null);
      setHistory(historyRes?.items || []);
      setAdherence(adhRes?.summary || null);
      setConsentEnabled(Boolean(consentRes?.is_consent_enabled));
      setSideEffects(seRes?.items || []);
      setStockData(stockRes || null);
      setRefillThreshold(refSettingRes?.refill_alert_threshold_days ?? 7);
      setTempThreshold(refSettingRes?.refill_alert_threshold_days ?? 7);
      setRefillConsentEnabled(Boolean(refConsentRes?.is_consent_enabled));
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

  // AG-06 Side-Effects Handlers
  const handleAddSideEffect = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !seSymptom.trim()) return;
    setSeSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const created = await createPatientSideEffect(token, {
        symptom_name: seSymptom.trim(),
        severity: seSeverity,
        patient_note: seNote.trim() || null,
        art_care_plan_id: activePlan?.public_id || null
      });
      setSideEffects((prev) => [created, ...prev]);
      setShowAddSideEffect(false);
      setSeSymptom('');
      setSeSeverity('MILD');
      setSeNote('');
      setSuccessMsg('Catatan keluhan efek samping berhasil disimpan.');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan catatan efek samping.');
    } finally {
      setSeSubmitting(false);
    }
  };

  const handleResolveSideEffect = async (publicId: string) => {
    if (!token) return;
    try {
      const updated = await updatePatientSideEffect(token, publicId, { status: 'RESOLVED' });
      setSideEffects((prev) => prev.map((item) => (item.public_id === publicId ? updated : item)));
      setSuccessMsg('Status keluhan telah ditandai selesai.');
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui status efek samping.');
    }
  };

  // AG-06 Stock Handlers
  const handleRecordStock = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStkSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const qty = stkQuantity.trim() ? Number(stkQuantity) : null;
      const days = stkDays.trim() ? Number(stkDays) : null;
      await recordPatientStock(token, {
        quantity_remaining: qty,
        unit: stkUnit.trim() || 'tablet',
        estimated_days_remaining: days,
        notes: stkNotes.trim() || null
      });
      const updatedStock = await getPatientStock(token);
      setStockData(updatedStock);
      setShowRecordStock(false);
      setStkQuantity('');
      setStkDays('');
      setStkNotes('');
      setSuccessMsg('Data persediaan obat berhasil diperbarui.');
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui persediaan obat.');
    } finally {
      setStkSubmitting(false);
    }
  };

  const handleSaveThreshold = async () => {
    if (!token || thresholdSaving) return;
    if (tempThreshold < 1 || tempThreshold > 30) {
      setError('Ambang batas pengingat harus antara 1 sampai 30 hari.');
      return;
    }
    setThresholdSaving(true);
    try {
      const res = await updatePatientRefillSettings(token, tempThreshold);
      setRefillThreshold(res.refill_alert_threshold_days);
      setEditingThreshold(false);
      const updatedStock = await getPatientStock(token);
      setStockData(updatedStock);
      setSuccessMsg('Pengaturan ambang batas pengingat berhasil disimpan.');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan refill.');
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleToggleRefillConsent = async () => {
    if (!token || refillConsentLoading) return;
    setRefillConsentLoading(true);
    setError('');
    setSuccessMsg('');
    const nextState = !refillConsentEnabled;
    try {
      const updated = await updatePatientRefillSupportConsent(token, nextState);
      setRefillConsentEnabled(updated.is_consent_enabled);
      setSuccessMsg(
        updated.is_consent_enabled
          ? 'Dukungan pengingat refill oleh pendamping telah diaktifkan.'
          : 'Dukungan pengingat refill oleh pendamping telah dinonaktifkan.'
      );
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui izin dukungan refill.');
    } finally {
      setRefillConsentLoading(false);
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

      {/* ========================================================================= */}
      {/* AG-06: SECTION A - CATATAN EFEK SAMPING                                   */}
      {/* ========================================================================= */}
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50/20 to-white shadow-sm" id="side-effects-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-teal-950 flex items-center gap-2">
                <Icon name="activity" className="h-5 w-5 text-teal-600" />
                Catatan Efek Samping
              </CardTitle>
              <CardDescription className="text-slate-600 text-xs mt-1">
                Catatan ini membantu Anda mengingat keluhan untuk dibahas dengan tenaga kesehatan dan bukan merupakan diagnosis.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant={showAddSideEffect ? 'outline' : 'default'}
              id="btn-add-side-effect"
              onClick={() => setShowAddSideEffect((prev) => !prev)}
            >
              {showAddSideEffect ? 'Tutup Formulir' : '+ Tambah Catatan'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Add Side Effect Form */}
          {showAddSideEffect ? (
            <form onSubmit={handleAddSideEffect} className="rounded-xl border border-teal-200 bg-white p-4 shadow-xs space-y-3">
              <strong className="text-sm text-slate-900 block">Catat Keluhan Baru</strong>

              <div className="space-y-2">
                <div>
                  <label htmlFor="se-symptom-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Gejala / Keluhan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="se-symptom-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    placeholder="Contoh: Mual, pusing, ruam kulit, gangguan tidur"
                    value={seSymptom}
                    onChange={(e) => setSeSymptom(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label htmlFor="se-severity-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tingkat Keluhan
                  </label>
                  <select
                    id="se-severity-select"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none bg-white"
                    value={seSeverity}
                    onChange={(e) => setSeSeverity(e.target.value as any)}
                  >
                    <option value="MILD">Ringan (Dapat beraktivitas biasa)</option>
                    <option value="MODERATE">Sedang (Mengganggu aktivitas harian)</option>
                    <option value="SEVERE">Berat (Sangat mengganggu atau memburuk)</option>
                  </select>
                </div>

                {seSeverity === 'SEVERE' ? (
                  <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                    <Icon name="bell" className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Panduan Keselamatan:</strong> Keluhan berat atau memburuk perlu dinilai tenaga kesehatan.
                      Segera hubungi fasilitas kesehatan bila keluhan semakin berat.
                    </span>
                  </div>
                ) : null}

                <div>
                  <label htmlFor="se-note-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    id="se-note-input"
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none resize-none"
                    placeholder="Ceritakan kapan keluhan muncul atau hal yang memperingan/memperberat..."
                    value={seNote}
                    onChange={(e) => setSeNote(e.target.value)}
                    maxLength={1000}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowAddSideEffect(false)}>
                  Batal
                </Button>
                <Button size="sm" type="submit" disabled={seSubmitting}>
                  {seSubmitting ? 'Menyimpan...' : 'Simpan Catatan'}
                </Button>
              </div>
            </form>
          ) : null}

          {/* List of Side Effects */}
          {sideEffects.length === 0 ? (
            <div className="text-center py-5 text-xs text-slate-500 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              Belum ada catatan efek samping yang tersimpan. Bila Anda merasakan keluhan setelah mengonsumsi obat, Anda dapat mencatatnya di sini.
            </div>
          ) : (
            <div className="space-y-2.5" id="side-effects-list">
              {sideEffects.map((item) => (
                <div
                  key={item.public_id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">{item.symptom_name}</strong>
                      <StatusBadge
                        variant={
                          item.severity === 'SEVERE'
                            ? 'default'
                            : item.severity === 'MODERATE'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {item.severity === 'SEVERE'
                          ? 'Keluhan Berat'
                          : item.severity === 'MODERATE'
                          ? 'Keluhan Sedang'
                          : 'Keluhan Ringan'}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={item.status === 'RESOLVED' ? 'success' : 'info'}>
                        {item.status === 'RESOLVED' ? 'Selesai' : 'Aktif'}
                      </StatusBadge>
                      {item.status === 'ACTIVE' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-2xs px-2 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => void handleResolveSideEffect(item.public_id)}
                        >
                          Tandai Selesai
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {item.patient_note ? (
                    <p className="text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {item.patient_note}
                    </p>
                  ) : null}

                  {item.severity === 'SEVERE' && item.status === 'ACTIVE' ? (
                    <p className="text-2xs text-rose-700 font-medium">
                      ⚠️ Keluhan berat atau memburuk perlu dinilai tenaga kesehatan.
                    </p>
                  ) : null}

                  <div className="text-2xs text-slate-400 flex items-center justify-between border-t border-slate-100 pt-1.5">
                    <span>
                      Dicatat: {new Date(item.occurred_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {item.resolved_at ? (
                      <span>
                        Selesai: {new Date(item.resolved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* AG-06: SECTION B - PERSEDIAAN OBAT PRIBADI & REFILL ALERT                */}
      {/* ========================================================================= */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50/20 to-white shadow-sm" id="stock-refill-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-amber-950 flex items-center gap-2">
                <Icon name="activity" className="h-5 w-5 text-amber-600" />
                Persediaan Obat Pribadi & Refill
              </CardTitle>
              <CardDescription className="text-slate-600 text-xs mt-1">
                Pantau sisa obat Anda sendiri dan dapatkan pengingat ramah saat persediaan menipis.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                variant={
                  stockData?.refill_status?.refill_status === 'OK'
                    ? 'success'
                    : stockData?.refill_status?.refill_status === 'DUE_SOON'
                    ? 'info'
                    : stockData?.refill_status?.refill_status === 'NEEDS_ATTENTION'
                    ? 'default'
                    : 'neutral'
                }
              >
                {stockData?.refill_status?.refill_status === 'OK'
                  ? 'Persediaan Aman'
                  : stockData?.refill_status?.refill_status === 'DUE_SOON'
                  ? 'Perlu Dijadwalkan'
                  : stockData?.refill_status?.refill_status === 'NEEDS_ATTENTION'
                  ? 'Perhatian Segera'
                  : 'Belum Ada Data'}
              </StatusBadge>
              <Button
                size="sm"
                variant="outline"
                id="btn-record-stock"
                onClick={() => setShowRecordStock((prev) => !prev)}
              >
                {showRecordStock ? 'Tutup' : 'Perbarui Persediaan'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Status Metric Grid */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
                Estimasi Sisa Obat
              </span>
              <strong className="text-xl text-slate-900 block">
                {stockData?.refill_status?.estimated_days_remaining !== null && stockData?.refill_status?.estimated_days_remaining !== undefined
                  ? `${stockData.refill_status.estimated_days_remaining} Hari`
                  : stockData?.current_stock?.quantity_remaining !== null && stockData?.current_stock?.quantity_remaining !== undefined
                  ? `${stockData.current_stock.quantity_remaining} ${stockData.current_stock.unit || 'unit'}`
                  : '—'}
              </strong>
              <span className="text-2xs text-slate-400 block truncate">
                {stockData?.refill_status?.last_recorded_at
                  ? `Dicatat ${new Date(stockData.refill_status.last_recorded_at).toLocaleDateString('id-ID')}`
                  : 'Belum ada rekaman stok'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
                Ambang Batas Pengingat
              </span>
              {editingThreshold ? (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    id="threshold-input"
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    value={tempThreshold}
                    onChange={(e) => setTempThreshold(Number(e.target.value))}
                  />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={() => void handleSaveThreshold()} disabled={thresholdSaving}>
                    Simpan
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5" onClick={() => setEditingThreshold(false)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <strong className="text-xl text-slate-900">{refillThreshold} Hari</strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-2xs px-2 text-slate-500 hover:text-brand"
                    onClick={() => {
                      setTempThreshold(refillThreshold);
                      setEditingThreshold(true);
                    }}
                  >
                    Ubah
                  </Button>
                </div>
              )}
              <span className="text-2xs text-slate-400 block">
                Alarm aktif saat sisa obat ≤ {refillThreshold} hari
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">
                Jadwal Pengambilan / Kontrol
              </span>
              <strong className="text-sm text-slate-900 block truncate pt-0.5">
                {stockData?.refill_status?.next_control_schedule
                  ? new Date(stockData.refill_status.next_control_schedule.starts_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Belum Terjadwal'}
              </strong>
              <span className="text-2xs text-slate-400 block truncate">
                {stockData?.refill_status?.next_control_schedule
                  ? `${stockData.refill_status.next_control_schedule.timezone}`
                  : 'Sesuaikan jadwal dengan faskes'}
              </span>
            </div>
          </div>

          {/* Safety alert if low stock */}
          {stockData?.refill_status?.safety_guidance ? (
            <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <Icon name="bell" className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Pemberitahuan Persediaan:</strong> {stockData.refill_status.safety_guidance}
              </span>
            </div>
          ) : null}

          {/* Record Stock Form */}
          {showRecordStock ? (
            <form onSubmit={handleRecordStock} className="rounded-xl border border-amber-200 bg-white p-4 shadow-xs space-y-3">
              <strong className="text-sm text-slate-900 block">Pembaruan Stok Pribadi</strong>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="stk-days-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi Sisa Hari
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    id="stk-days-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    placeholder="Contoh: 30"
                    value={stkDays}
                    onChange={(e) => setStkDays(e.target.value)}
                  />
                  <span className="text-2xs text-slate-400 block mt-0.5">Berdasarkan perkiraan Anda sendiri</span>
                </div>

                <div>
                  <label htmlFor="stk-quantity-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Obat (Butir / Tablet)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    id="stk-quantity-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    placeholder="Contoh: 30"
                    value={stkQuantity}
                    onChange={(e) => setStkQuantity(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="stk-unit-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    id="stk-unit-input"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    placeholder="tablet, botol, dll"
                    value={stkUnit}
                    onChange={(e) => setStkUnit(e.target.value)}
                    maxLength={50}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="stk-notes-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pribadi (Opsional)
                </label>
                <input
                  type="text"
                  id="stk-notes-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="Misal: Baru ambil di puskesmas, tersisa 1 strip"
                  value={stkNotes}
                  onChange={(e) => setStkNotes(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowRecordStock(false)}>
                  Batal
                </Button>
                <Button size="sm" type="submit" disabled={stkSubmitting}>
                  {stkSubmitting ? 'Menyimpan...' : 'Simpan Pembaruan'}
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

      {/* BERBAGI DUKUNGAN DENGAN PENDAMPING (CONSENT KEPATUHAN) */}
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

      {/* ========================================================================= */}
      {/* AG-06: SECTION C - DUKUNGAN REFILL DARI PENDAMPING (CONSENT REFILL)       */}
      {/* ========================================================================= */}
      <Card className="border-teal-100 bg-gradient-to-br from-teal-50/30 to-white" id="refill-consent-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base text-teal-950 flex items-center gap-2">
              <Icon name="heart" className="h-4 w-4 text-teal-600" />
              Dukungan Refill dari Pendamping
            </CardTitle>
            <StatusBadge variant={refillConsentEnabled ? 'success' : 'neutral'}>
              {refillConsentEnabled ? 'Berbagi Aktif' : 'Tidak Berbagi (Privat)'}
            </StatusBadge>
          </div>
          <CardDescription className="text-slate-600 text-xs leading-relaxed">
            Persetujuan ini mengizinkan pendamping sebaya Anda melihat <strong>hanya ringkasan status kesiapan refill</strong> (seperti perkiraan sisa waktu dalam rentang hari)
            agar dapat mengingatkan jadwal pengambilan obat. Pendamping <strong>tidak menerima</strong> nama obat, dosis, jumlah butir, atau riwayat efek samping Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Status Refill Pendamping:{' '}
            <strong className={refillConsentEnabled ? 'text-emerald-700' : 'text-slate-700'}>
              {refillConsentEnabled ? 'Izin Diberikan' : 'Dinonaktifkan'}
            </strong>
          </div>
          <Button
            variant={refillConsentEnabled ? 'outline' : 'default'}
            size="sm"
            id="toggle-refill-consent-btn"
            disabled={refillConsentLoading}
            onClick={() => void handleToggleRefillConsent()}
          >
            {refillConsentLoading ? 'Memproses...' : refillConsentEnabled ? 'Cabut Izin Refill' : 'Aktifkan Dukungan Refill'}
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
