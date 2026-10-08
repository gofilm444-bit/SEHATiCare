import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import {
  createCompanionAssignment,
  endCompanionAssignment,
  getAdminCompanionAssignments,
  getAdminCompanionCandidates,
  getCompanionPatients,
  reassignCompanion,
  CandidateCompanion,
  CandidatePatient,
  CompanionPatientRosterItem,
  LongitudinalAssignmentItem,
} from '../../api/companionAssignments';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { Button, buttonClassName } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/ui/patterns';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanionAdherenceSupport,
  CompanionAdherenceSupportResponse,
  getCompanionRefillSupport,
  CompanionRefillSupportResponse
} from '../../api/artCare';

type Assignment = {
  public_id: string;
  status: string;
  priority: number;
  subject: string | null;
  assigned_at: string | null;
  last_activity_at: string;
  assignment_source?: string;
  is_longitudinal?: boolean;
};

type OutreachCase = {
  public_id: string;
  title: string;
  summary: string;
  status: 'OPEN' | 'REFERRED' | 'CLOSED';
  referral_target: string | null;
  referral_note: string | null;
  created_at: string;
  updated_at: string;
};

type Companion = {
  public_id: string;
  professional_name: string;
  max_active_assignments: number;
};

type QueueItem = {
  public_id: string;
  status: string;
  priority: number;
  queued_at: string;
  last_activity_at: string;
  assignment_source?: string;
};

function useApi() {
  const { token, handleUnauthorized } = useAuth();
  return useCallback(
    <T,>(path: string, init: RequestInit = {}) =>
      apiFetch<T>(path, init, { token, onUnauthorized: handleUnauthorized }),
    [token, handleUnauthorized]
  );
}

export function CompanionAssignmentsPage() {
  const { token } = useAuth();
  const api = useApi();
  const [patients, setPatients] = useState<CompanionPatientRosterItem[]>([]);
  const [conversationItems, setConversationItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [patientsRes, convRes] = await Promise.all([
        getCompanionPatients(token).catch(() => ({ items: [] as CompanionPatientRosterItem[] })),
        api<{ items: Assignment[] }>('/professional/assignments').catch(() => ({ items: [] as Assignment[] })),
      ]);
      setPatients(patientsRes.items || []);
      setConversationItems(convRes.items || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, api]);

  useEffect(() => {
    void load();
  }, [load]);

  const [supportSummaries, setSupportSummaries] = useState<
    Record<string, { loading: boolean; data?: CompanionAdherenceSupportResponse; error?: string }>
  >({});

  const handleLoadAdherenceSupport = async (patientPublicId: string) => {
    if (!token) return;
    setSupportSummaries((prev) => ({
      ...prev,
      [patientPublicId]: { loading: true }
    }));
    try {
      const res = await getCompanionAdherenceSupport(token, patientPublicId, 7);
      setSupportSummaries((prev) => ({
        ...prev,
        [patientPublicId]: { loading: false, data: res }
      }));
    } catch (err: any) {
      setSupportSummaries((prev) => ({
        ...prev,
        [patientPublicId]: { loading: false, error: err.message || 'Gagal memuat ringkasan dukungan' }
      }));
    }
  };

  const [refillSummaries, setRefillSummaries] = useState<
    Record<string, { loading?: boolean; data?: CompanionRefillSupportResponse; error?: string }>
  >({});

  const handleLoadRefillSupport = async (patientPublicId: string) => {
    if (!token) return;
    setRefillSummaries((prev) => ({
      ...prev,
      [patientPublicId]: { loading: true }
    }));
    try {
      const res = await getCompanionRefillSupport(token, patientPublicId);
      setRefillSummaries((prev) => ({
        ...prev,
        [patientPublicId]: { loading: false, data: res }
      }));
    } catch (err: any) {
      setRefillSummaries((prev) => ({
        ...prev,
        [patientPublicId]: { loading: false, error: err.message || 'Gagal memuat status refill' }
      }));
    }
  };

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Ruang kerja pendamping"
        title="Pendamping"
        description="Kelola daftar pasien dampingan jangka panjang dan sesi percakapan yang ditugaskan kepada Anda."
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Perbarui
          </Button>
        }
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      ) : null}

      {/* Longitudinal Care Section: Pasien Dampingan */}
      <section aria-labelledby="companion-roster-title" className="space-y-4">
        <div>
          <h2 id="companion-roster-title" className="text-xl font-bold text-slate-900">
            Pasien Dampingan
          </h2>
          <p className="text-sm text-slate-500">
            Daftar pasien yang berada di bawah pendampingan berkelanjutan Anda.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : !patients.length ? (
          <EmptyState
            icon="users"
            title="Belum ada pasien yang ditugaskan."
            description="Pasien dampingan yang ditugaskan oleh admin akan muncul di halaman ini."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {patients.map((item) => (
              <Card key={item.assignment_id}>
                <CardContent className="flex flex-col justify-between gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-base text-slate-900">{item.alias}</strong>
                      <p className="mt-1 text-xs text-slate-500">
                        ID: {item.patient_public_id}
                      </p>
                    </div>
                    <StatusBadge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {item.status === 'ACTIVE' ? 'Aktif' : item.status}
                    </StatusBadge>
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <p>
                      Mulai:{' '}
                      {item.started_at
                        ? new Date(item.started_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                    {item.facility ? (
                      <p className="mt-1">Fasilitas: {item.facility.name}</p>
                    ) : null}
                  </div>

                  {/* Privacy-Safe Adherence Support Summary */}
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Dukungan Kepatuhan:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        disabled={supportSummaries[item.patient_public_id]?.loading}
                        onClick={() => void handleLoadAdherenceSupport(item.patient_public_id)}
                      >
                        {supportSummaries[item.patient_public_id]?.loading
                          ? 'Memuat…'
                          : supportSummaries[item.patient_public_id]?.data
                          ? 'Perbarui Status'
                          : 'Cek Ringkasan Kepatuhan'}
                      </Button>
                    </div>

                    {supportSummaries[item.patient_public_id]?.data ? (
                      !supportSummaries[item.patient_public_id].data?.support_consent_enabled ? (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
                          <p className="font-medium text-slate-700">
                            Pasien belum mengaktifkan berbagi ringkasan dukungan kepatuhan.
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            Privasi klinis terlindungi. Ringkasan angka kepatuhan hanya dapat dilihat jika pasien mengizinkan.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 text-xs text-emerald-950 space-y-1">
                          <div className="flex items-center justify-between font-semibold">
                            <span>Ringkasan Dukungan (7 Hari)</span>
                            <span className="text-emerald-700">
                              {supportSummaries[item.patient_public_id].data?.summary?.adherence_percentage !== null
                                ? `${supportSummaries[item.patient_public_id].data?.summary?.adherence_percentage}%`
                                : '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-2xs text-slate-700 pt-1">
                            <div>Jadwal tercatat: <strong>{supportSummaries[item.patient_public_id].data?.summary?.doses_scheduled ?? 0}</strong></div>
                            <div>Ditandai selesai: <strong className="text-emerald-700">{supportSummaries[item.patient_public_id].data?.summary?.doses_taken ?? 0}</strong></div>
                            <div className="col-span-2">Belum tercatat/terlewat: <strong className="text-amber-800">{supportSummaries[item.patient_public_id].data?.summary?.doses_missed ?? 0}</strong></div>
                          </div>
                          {supportSummaries[item.patient_public_id].data?.summary?.upcoming_control_schedule ? (
                            <p className="text-2xs text-slate-600 border-t border-emerald-200/60 pt-1 mt-1">
                              Jadwal kontrol berikutnya: {new Date(supportSummaries[item.patient_public_id].data!.summary!.upcoming_control_schedule!.starts_at).toLocaleDateString('id-ID')}
                            </p>
                          ) : null}
                        </div>
                      )
                    ) : null}

                    {supportSummaries[item.patient_public_id]?.error ? (
                      <p className="text-2xs text-rose-600">
                        {supportSummaries[item.patient_public_id].error}
                      </p>
                    ) : null}
                  </div>

                  {/* Privacy-Safe Refill Support Summary */}
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Dukungan Pengingat Refill:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        disabled={refillSummaries[item.patient_public_id]?.loading}
                        onClick={() => void handleLoadRefillSupport(item.patient_public_id)}
                      >
                        {refillSummaries[item.patient_public_id]?.loading
                          ? 'Memuat…'
                          : refillSummaries[item.patient_public_id]?.data
                          ? 'Perbarui Status'
                          : 'Cek Status Refill'}
                      </Button>
                    </div>

                    {refillSummaries[item.patient_public_id]?.data ? (
                      !refillSummaries[item.patient_public_id].data?.support_consent_enabled ? (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
                          <p className="font-medium text-slate-700">
                            Pasien belum mengaktifkan dukungan pengingat refill untuk pendamping.
                          </p>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            Privasi klinis terlindungi: pendamping tidak menerima nama obat, dosis, atau riwayat efek samping.
                          </p>
                        </div>
                      ) : (
                        <div
                          className={`rounded-lg border p-2.5 text-xs space-y-1 ${
                            refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'NEEDS_ATTENTION'
                              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                              : refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'DUE_SOON'
                              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>Status Kesiapan Refill</span>
                            <StatusBadge
                              variant={
                                refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'OK'
                                  ? 'success'
                                  : refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'DUE_SOON'
                                  ? 'info'
                                  : refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'NEEDS_ATTENTION'
                                  ? 'default'
                                  : 'neutral'
                              }
                            >
                              {refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'OK'
                                ? 'Persediaan Aman'
                                : refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'DUE_SOON'
                                ? 'Perlu Dukungan Refill'
                                : refillSummaries[item.patient_public_id].data?.summary?.refill_status === 'NEEDS_ATTENTION'
                                ? 'Perlu Perhatian Segera'
                                : 'Belum Diketahui'}
                            </StatusBadge>
                          </div>
                          <p className="text-2xs">
                            Perkiraan sisa waktu:{' '}
                            <strong>
                              {refillSummaries[item.patient_public_id].data?.summary?.coarse_days_bucket_label || 'Belum diketahui'}
                            </strong>
                          </p>
                          {refillSummaries[item.patient_public_id].data?.summary?.next_control_schedule ? (
                            <p className="text-2xs text-slate-600 border-t border-slate-200/60 pt-1 mt-1">
                              Jadwal kontrol/refill: {new Date(refillSummaries[item.patient_public_id].data!.summary!.next_control_schedule!.starts_at).toLocaleDateString('id-ID')}
                            </p>
                          ) : null}
                        </div>
                      )
                    ) : null}

                    {refillSummaries[item.patient_public_id]?.error ? (
                      <p className="text-2xs text-rose-600">
                        {refillSummaries[item.patient_public_id].error}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Conversation Sessions Section */}
      <section aria-labelledby="conversation-assignments-title" className="space-y-4 border-t border-slate-200/80 pt-6">
        <div>
          <h2 id="conversation-assignments-title" className="text-xl font-bold text-slate-900">
            Sesi Percakapan Ditugaskan
          </h2>
          <p className="text-sm text-slate-500">
            Sesi percakapan konsultasi yang ditugaskan secara manual oleh admin.
          </p>
        </div>

        <div className="grid gap-3">
          {!loading && !conversationItems.length ? (
            <EmptyState
              icon="chat"
              title="Belum ada sesi percakapan"
              description="Sesi konsultasi yang ditugaskan admin akan muncul di sini."
            />
          ) : (
            conversationItems.map((item) => (
              <Card key={item.public_id}>
                <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{item.subject || 'Pendampingan privat'}</strong>
                      <StatusBadge variant="neutral">{item.status}</StatusBadge>
                      {item.is_longitudinal ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Pasien Dampingan
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Ditugaskan{' '}
                      {item.assigned_at
                        ? new Date(item.assigned_at).toLocaleString('id-ID')
                        : '—'}{' '}
                      · Prioritas {item.priority}
                    </p>
                  </div>
                  <Link
                    className={buttonClassName()}
                    to={`/companion/conversations/${item.public_id}`}
                  >
                    Buka percakapan
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function OutreachCasesPage() {
  const api = useApi();
  const [items, setItems] = useState<OutreachCase[]>([]);
  const [selected, setSelected] = useState<OutreachCase | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [target, setTarget] = useState('COUNSELOR');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ items: OutreachCase[] }>('/outreach/cases')
        .then((r) => {
          setItems(r.items);
          setSelected((current) => r.items.find((i) => i.public_id === current?.public_id) ?? null);
        })
        .catch((e) => setError((e as Error).message)),
    [api]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('/outreach/cases', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), summary: summary.trim() }),
      });
      setTitle('');
      setSummary('');
      setNotice('Catatan penjangkauan tersimpan.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refer() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api(`/outreach/cases/${selected.public_id}/refer`, {
        method: 'POST',
        body: JSON.stringify({ target, note: note.trim() }),
      });
      setNote('');
      setNotice('Rujukan berhasil dicatat.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!selected || !window.confirm('Tutup catatan penjangkauan ini?')) return;
    setBusy(true);
    try {
      await api(`/outreach/cases/${selected.public_id}/close`, { method: 'POST', body: '{}' });
      setNotice('Catatan telah ditutup.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Ruang kerja penjangkau"
        title="Catatan penjangkauan"
        description="Catat kebutuhan lapangan secara minimum, tanpa nama, email, nomor telepon, diagnosis, atau identitas lain."
      />
      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.85fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Buat catatan tanpa identitas</CardTitle>
              <CardDescription>
                Gunakan kategori atau kode internal; jangan masukkan data pribadi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={create} className="space-y-3">
                <label className="block text-sm font-semibold">
                  Judul ringkas
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={3}
                    maxLength={120}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Ringkasan kebutuhan
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 p-3 font-normal"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    minLength={10}
                    maxLength={1500}
                    required
                  />
                </label>
                <Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan catatan'}</Button>
              </form>
            </CardContent>
          </Card>
          <section>
            <h2 className="mb-3 text-xl font-bold">Catatan saya</h2>
            <div className="space-y-3">
              {!items.length ? (
                <EmptyState
                  icon="clipboard"
                  title="Belum ada catatan"
                  description="Catatan penjangkauan milik Anda akan tampil di sini."
                />
              ) : (
                items.map((item) => (
                  <button
                    key={item.public_id}
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setError('');
                    }}
                    className="block w-full rounded-2xl border bg-white p-4 text-left hover:border-brand"
                  >
                    <div className="flex justify-between gap-3">
                      <strong>{item.title}</strong>
                      <StatusBadge variant={item.status === 'OPEN' ? 'success' : 'neutral'}>
                        {item.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.summary}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.title}</CardTitle>
              <CardDescription>
                Dibuat {new Date(selected.created_at).toLocaleString('id-ID')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm">{selected.summary}</p>
              {selected.status === 'OPEN' ? (
                <>
                  <label className="block text-sm font-semibold">
                    Tujuan rujukan
                    <select
                      className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="COUNSELOR">Konselor</option>
                      <option value="COMPANION">Pendamping</option>
                      <option value="FACILITY">Fasilitas layanan</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">
                    Catatan rujukan
                    <textarea
                      className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal"
                      minLength={10}
                      maxLength={1500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void refer()} disabled={busy || note.trim().length < 10}>
                      Catat rujukan
                    </Button>
                    <Button variant="outline" onClick={() => void close()} disabled={busy}>
                      Tutup tanpa rujukan
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <strong>Status:</strong> {selected.status}
                  {selected.referral_target ? (
                    <p className="mt-1">Dirujuk ke {selected.referral_target}</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
            Pilih catatan untuk melihat tindakan.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminProfessionalAssignmentsPage() {
  const { token } = useAuth();
  const api = useApi();

  // Tab State: 'LONGITUDINAL' vs 'CONVERSATION'
  const [activeTab, setActiveTab] = useState<'LONGITUDINAL' | 'CONVERSATION'>('LONGITUDINAL');

  // Longitudinal Assignments State
  const [longitudinalItems, setLongitudinalItems] = useState<LongitudinalAssignmentItem[]>([]);
  const [candidates, setCandidates] = useState<{
    companions: CandidateCompanion[];
    patients: CandidatePatient[];
  }>({ companions: [], patients: [] });
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ENDED'>('ACTIVE');
  const [loadingLongitudinal, setLoadingLongitudinal] = useState(true);

  // Modals for Longitudinal Assignment
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedCompanionId, setSelectedCompanionId] = useState('');

  const [reassignTarget, setReassignTarget] = useState<LongitudinalAssignmentItem | null>(null);
  const [reassignCompanionId, setReassignCompanionId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  const [endTarget, setEndTarget] = useState<LongitudinalAssignmentItem | null>(null);
  const [endReason, setEndReason] = useState('');

  // Conversation Queue State (Existing)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});

  // Status & Feedback
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // Load Longitudinal Data
  const loadLongitudinal = useCallback(async () => {
    if (!token) return;
    setLoadingLongitudinal(true);
    setError('');
    try {
      const [listRes, candRes] = await Promise.all([
        getAdminCompanionAssignments(
          token,
          statusFilter === 'ALL' ? undefined : { status: statusFilter }
        ),
        getAdminCompanionCandidates(token),
      ]);
      setLongitudinalItems(listRes.items || []);
      setCandidates(candRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingLongitudinal(false);
    }
  }, [token, statusFilter]);

  // Load Conversation Queue Data
  const loadConversationQueue = useCallback(() => {
    return Promise.all([
      api<{ items: QueueItem[] }>('/counselor/queue'),
      api<{ items: Companion[] }>('/admin/professional/companions'),
    ])
      .then(([q, c]) => {
        setQueue(q.items);
        setCompanions(c.items);
      })
      .catch((e) => setError((e as Error).message));
  }, [api]);

  useEffect(() => {
    if (activeTab === 'LONGITUDINAL') {
      void loadLongitudinal();
    } else {
      void loadConversationQueue();
    }
  }, [activeTab, loadLongitudinal, loadConversationQueue]);

  // Action: Create Assignment
  async function handleCreateAssignment(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedPatientId || !selectedCompanionId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createCompanionAssignment(token, {
        patient_public_id: selectedPatientId,
        companion_public_id: selectedCompanionId,
      });
      setNotice('Penugasan pendamping berhasil dibuat.');
      setIsAssignModalOpen(false);
      setSelectedPatientId('');
      setSelectedCompanionId('');
      await loadLongitudinal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Action: Reassign Companion
  async function handleReassignSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !reassignTarget || !reassignCompanionId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await reassignCompanion(token, reassignTarget.id, {
        new_companion_public_id: reassignCompanionId,
        reason: reassignReason.trim() || undefined,
      });
      setNotice('Pendamping berhasil dialihkan (reassign).');
      setReassignTarget(null);
      setReassignCompanionId('');
      setReassignReason('');
      await loadLongitudinal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Action: End Assignment
  async function handleEndSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !endTarget) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await endCompanionAssignment(token, endTarget.id, {
        reason: endReason.trim() || undefined,
      });
      setNotice('Penugasan pendamping berhasil diakhiri.');
      setEndTarget(null);
      setEndReason('');
      await loadLongitudinal();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Action: Conversation Queue Assign (Existing)
  async function assignConversation(item: QueueItem) {
    const counselor_public_id = choice[item.public_id];
    if (!counselor_public_id) {
      setError('Pilih pendamping terlebih dahulu.');
      return;
    }
    if (!window.confirm('Tetapkan sesi ini kepada pendamping terpilih?')) return;
    try {
      await api(`/counselor/conversations/${item.public_id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ counselor_public_id }),
      });
      setNotice('Pendamping berhasil ditugaskan ke sesi percakapan.');
      setError('');
      await loadConversationQueue();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Penugasan Pendamping"
        description="Kelola hubungan pendampingan jangka panjang pasien–pendamping serta alokasi sesi percakapan."
        action={
          <Button
            variant="outline"
            onClick={() => {
              if (activeTab === 'LONGITUDINAL') void loadLongitudinal();
              else void loadConversationQueue();
            }}
          >
            Perbarui
          </Button>
        }
      />

      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      ) : null}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('LONGITUDINAL')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'LONGITUDINAL'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Pendampingan Pasien (Jangka Panjang)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CONVERSATION')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'CONVERSATION'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Sesi Percakapan
        </button>
      </div>

      {activeTab === 'LONGITUDINAL' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Filter status:</span>
              <select
                aria-label="Filter status penugasan"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'ENDED')}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="ACTIVE">Aktif (ACTIVE)</option>
                <option value="ENDED">Selesai (ENDED)</option>
                <option value="ALL">Semua</option>
              </select>
            </div>
            <Button onClick={() => setIsAssignModalOpen(true)}>
              Tugaskan Pasien
            </Button>
          </div>

          {loadingLongitudinal ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : !longitudinalItems.length ? (
            <EmptyState
              icon="users"
              title="Belum ada penugasan pasien"
              description="Data penugasan pasien ke pendamping akan muncul di sini."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Daftar Penugasan Pendampingan Pasien</caption>
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Pasien</th>
                      <th className="px-4 py-3 font-semibold">Pendamping</th>
                      <th className="px-4 py-3 font-semibold">Fasilitas</th>
                      <th className="px-4 py-3 font-semibold">Tanggal Mulai</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {longitudinalItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.patient.alias}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {item.companion.professional_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.facility ? item.facility.name : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.started_at
                            ? new Date(item.started_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {item.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.status === 'ACTIVE' ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReassignTarget(item);
                                  setReassignCompanionId('');
                                  setReassignReason('');
                                }}
                              >
                                Ganti
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-700 hover:bg-rose-50 border-rose-200"
                                onClick={() => {
                                  setEndTarget(item);
                                  setEndReason('');
                                }}
                              >
                                Akhiri
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {item.ended_at
                                ? `Diakhiri ${new Date(item.ended_at).toLocaleDateString('id-ID')}`
                                : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal: Tugaskan Pasien */}
          <AccessibleModal
            open={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            title="Tugaskan Pendamping ke Pasien"
            description="Pilih pasien dan pendamping aktif terverifikasi untuk membentuk hubungan pendampingan jangka panjang."
          >
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Pasien
                  <select
                    required
                    aria-label="Pilih pasien"
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">Pilih Pasien</option>
                    {candidates.patients.map((p) => (
                      <option key={p.public_id} value={p.public_id}>
                        {p.alias} ({p.public_id}) {p.has_active_companion ? '• Ada pendamping aktif' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Pendamping
                  <select
                    required
                    aria-label="Pilih pendamping"
                    value={selectedCompanionId}
                    onChange={(e) => setSelectedCompanionId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">Pilih Pendamping</option>
                    {candidates.companions.map((c) => (
                      <option key={c.public_id} value={c.public_id}>
                        {c.professional_name} ({c.service_role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving || !selectedPatientId || !selectedCompanionId}>
                  {saving ? 'Menyimpan…' : 'Simpan Penugasan'}
                </Button>
              </div>
            </form>
          </AccessibleModal>

          {/* Modal: Ganti Pendamping (Reassign) */}
          <AccessibleModal
            open={Boolean(reassignTarget)}
            onClose={() => setReassignTarget(null)}
            title="Ganti Pendamping (Reassign)"
            description={`Alihkan pendampingan pasien ${reassignTarget?.patient.alias} ke pendamping baru.`}
          >
            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <p>
                  <strong>Pendamping saat ini:</strong>{' '}
                  {reassignTarget?.companion.professional_name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Pendamping Baru
                  <select
                    required
                    aria-label="Pilih pendamping baru"
                    value={reassignCompanionId}
                    onChange={(e) => setReassignCompanionId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">Pilih Pendamping Baru</option>
                    {candidates.companions
                      .filter((c) => c.public_id !== reassignTarget?.companion.public_id)
                      .map((c) => (
                        <option key={c.public_id} value={c.public_id}>
                          {c.professional_name} ({c.service_role})
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Alasan Pengalihan (opsional)
                  <Input
                    placeholder="Contoh: Permintaan mutasi pendamping atau rotasi wilayah"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    maxLength={255}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReassignTarget(null)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving || !reassignCompanionId}>
                  {saving ? 'Memproses…' : 'Ganti Pendamping'}
                </Button>
              </div>
            </form>
          </AccessibleModal>

          {/* Modal: Akhiri Penugasan (End) */}
          <AccessibleModal
            open={Boolean(endTarget)}
            onClose={() => setEndTarget(null)}
            title="Akhiri Pendampingan"
            description={`Konfirmasi pengakhiran pendampingan pasien ${endTarget?.patient.alias}. Riwayat penugasan akan tetap tersimpan.`}
          >
            <form onSubmit={handleEndSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800">
                  Alasan Pengakhiran (opsional)
                  <Input
                    placeholder="Contoh: Pasien mandiri / selesai masa pendampingan"
                    value={endReason}
                    onChange={(e) => setEndReason(e.target.value)}
                    maxLength={255}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEndTarget(null)}
                  disabled={saving}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                  disabled={saving}
                >
                  {saving ? 'Memproses…' : 'Akhiri Pendampingan'}
                </Button>
              </div>
            </form>
          </AccessibleModal>
        </div>
      ) : (
        /* Conversation Queue Tab (Existing) */
        <div className="space-y-4">
          {!companions.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              Belum ada profil Pendamping yang terverifikasi dan aktif.
            </p>
          ) : null}

          <div className="grid gap-3">
            {!queue.length ? (
              <EmptyState
                icon="clipboard"
                title="Tidak ada sesi untuk ditugaskan"
                description="Sesi antrean umum akan tampil di sini."
              />
            ) : (
              queue.map((item) => (
                <Card key={item.public_id}>
                  <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>Sesi menunggu pendamping</strong>
                        {item.assignment_source ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {item.assignment_source === 'LONGITUDINAL'
                              ? 'Pendamping Tetap'
                              : item.assignment_source === 'SELF_CLAIM'
                              ? 'Klaim Mandiri'
                              : 'Penugasan Manual'}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">
                        Masuk {new Date(item.queued_at).toLocaleString('id-ID')} · Prioritas{' '}
                        {item.priority}
                      </p>
                    </div>
                    <select
                      aria-label="Pilih pendamping"
                      className="h-11 rounded-xl border border-slate-300 bg-white px-3"
                      value={choice[item.public_id] || ''}
                      onChange={(e) =>
                        setChoice({ ...choice, [item.public_id]: e.target.value })
                      }
                    >
                      <option value="">Pilih pendamping</option>
                      {companions.map((c) => (
                        <option key={c.public_id} value={c.public_id}>
                          {c.professional_name}
                        </option>
                      ))}
                    </select>
                    <Button onClick={() => void assignConversation(item)}>Tetapkan</Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
