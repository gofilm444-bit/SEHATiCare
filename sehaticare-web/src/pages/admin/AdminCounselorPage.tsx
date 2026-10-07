import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader, StatusBadge } from '../../components/ui/patterns';

type Application = {
  public_id: string;
  status: string;
  professional_name: string;
  profession: string;
  service_role: 'COUNSELOR' | 'FACILITATOR' | 'COMPANION' | 'OUTREACH_WORKER' | 'SUPPORT_OFFICER';
  license_number?: string | null;
  submitted_at?: string | null;
  revision_notes?: string | null;
  rejection_reason?: string | null;
  applicant?: { public_id: string; full_name: string; email: string; role: string; is_active: boolean };
  documents: Array<{ public_id: string; document_type: string; file_size_bytes: number }>;
  review_history: Array<{ action: string; reason?: string | null; created_at: string }>;
};

const statuses = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED'];
const actions: Record<string, string[]> = {
  SUBMITTED: ['VERIFY', 'REQUEST_REVISION', 'REJECT'],
  UNDER_REVIEW: ['REQUEST_REVISION', 'VERIFY', 'REJECT'],
  VERIFIED: ['ACTIVATE', 'SUSPEND'],
  ACTIVE: ['DEACTIVATE', 'SUSPEND'],
  INACTIVE: ['ACTIVATE', 'SUSPEND'],
  SUSPENDED: ['REACTIVATE']
};
const labels: Record<string, string> = {
  START_REVIEW: 'Mulai review', REQUEST_REVISION: 'Minta revisi', VERIFY: 'Verifikasi langsung',
  ACTIVATE: 'Aktifkan', DEACTIVATE: 'Nonaktifkan', REJECT: 'Tolak',
  SUSPEND: 'Suspend', REACTIVATE: 'Aktifkan kembali'
};
const nextStatuses: Record<string, string> = {
  START_REVIEW: 'UNDER_REVIEW', REQUEST_REVISION: 'REVISION_REQUIRED', VERIFY: 'VERIFIED',
  ACTIVATE: 'ACTIVE', DEACTIVATE: 'INACTIVE', REJECT: 'REJECTED',
  SUSPEND: 'SUSPENDED', REACTIVATE: 'ACTIVE'
};
const reasonRequired = new Set(['REQUEST_REVISION', 'DEACTIVATE', 'REJECT', 'SUSPEND']);

export function AdminCounselorPage() {
  const { token, handleUnauthorized } = useAuth();
  const [status, setStatus] = useState('SUBMITTED');
  const [items, setItems] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const api = useCallback(<T,>(path: string, init: RequestInit = {}) =>
    apiFetch<T>(path, init, { token, onUnauthorized: handleUnauthorized }), [token, handleUnauthorized]);
  const load = useCallback(() => api<{ items: Application[] }>(
    `/admin/counselor-applications${status === 'ALL' ? '' : `?status=${status}`}`
  ).then((result) => {
    setItems(result.items);
    setSelected((current) => result.items.find((item) => item.public_id === current?.public_id) ?? null);
  }).catch((err) => setError(err instanceof Error ? err.message : 'Pengajuan gagal dimuat')), [api, status]);

  useEffect(() => { void load(); }, [load]);

  async function open(id: string) {
    try {
      setError('');
      const result = await api<{ application: Application }>(`/admin/counselor-applications/${id}`);
      setSelected(result.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail pengajuan gagal dimuat');
    }
  }

  async function transition(action: string) {
    if (!selected || busyAction) return;
    let reason: string | undefined;
    if (reasonRequired.has(action)) {
      const entered = window.prompt('Alasan wajib diisi (minimal 8 karakter):');
      if (entered === null) return;
      reason = entered.trim();
      if (reason.length < 8) {
        setError('Alasan harus berisi minimal 8 karakter.');
        return;
      }
    }
    if (!window.confirm(`${labels[action]} pengajuan ${selected.professional_name}?`)) return;
    setBusyAction(action);
    setError('');
    setNotice('');
    try {
      await api(`/admin/counselor-applications/${selected.public_id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) })
      });
      setSelected(null);
      setNotice(`${labels[action]} berhasil diproses.`);
      setStatus(nextStatuses[action] ?? 'ALL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Perubahan status gagal diproses');
    } finally {
      setBusyAction(null);
    }
  }

  async function document(id: string) {
    try {
      setError('');
      const result = await api<{ download_url: string }>(`/counselor-documents/${id}`);
      window.location.assign(result.download_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dokumen gagal dibuka');
    }
  }

  return <div className="page-shell">
    <PageHeader eyebrow="Pengelolaan profesional" title="Tenaga profesional" description="Review peran layanan, verifikasi kompetensi, lalu aktifkan izin secara terpisah." />
    {notice ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p> : null}
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status pengajuan">
      {statuses.map((value) => <Button key={value} size="sm" variant={status === value ? 'default' : 'outline'} onClick={() => { setStatus(value); setSelected(null); setError(''); }} role="tab" aria-selected={status === value}>{value}</Button>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)]">
      <section className="space-y-3">
        {items.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Tidak ada pengajuan pada status ini.</p> : items.map((item) => <button key={item.public_id} onClick={() => void open(item.public_id)} className="block w-full rounded-xl border bg-white p-4 text-left hover:border-brand"><div className="flex justify-between gap-3"><div><strong>{item.professional_name}</strong><p className="text-sm text-slate-500">{item.profession} · {item.applicant?.role}</p></div><StatusBadge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}>{item.status}</StatusBadge></div></button>)}
      </section>
      {selected ? <Card><CardHeader><CardTitle>{selected.professional_name}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="text-sm"><p><strong>Akun:</strong> {selected.applicant?.full_name} ({selected.applicant?.email})</p><p><strong>Profesi:</strong> {selected.profession}</p><p><strong>Peran layanan:</strong> {selected.service_role}</p><p><strong>Nomor izin:</strong> {selected.license_number || '—'}</p></div>
        <section><h3 className="font-semibold">Dokumen privat</h3><div className="mt-2 space-y-2">{selected.documents.map((doc) => <Button key={doc.public_id} size="sm" variant="outline" onClick={() => void document(doc.public_id)}>{doc.document_type} · {Math.ceil(doc.file_size_bytes / 1024)} KB</Button>)}</div></section>
        <section><h3 className="font-semibold">Tindakan</h3><div className="mt-2 flex flex-wrap gap-2">{(actions[selected.status] || []).map((action) => <Button key={action} size="sm" disabled={Boolean(busyAction)} variant={['REJECT', 'SUSPEND', 'DEACTIVATE'].includes(action) ? 'destructive' : 'default'} onClick={() => void transition(action)}>{busyAction === action ? 'Memproses…' : labels[action]}</Button>)}</div></section>
        <section><h3 className="font-semibold">Riwayat review</h3><ol className="mt-2 space-y-2 text-sm">{selected.review_history.map((event, index) => <li key={`${event.created_at}-${index}`}>{event.action} · {new Date(event.created_at).toLocaleString('id-ID')}{event.reason ? ` — ${event.reason}` : ''}</li>)}</ol></section>
      </CardContent></Card> : <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Pilih pengajuan untuk melihat detail.</div>}
    </div>
  </div>;
}
