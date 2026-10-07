import { FormEvent, useEffect, useState } from 'react';
import {
  AdminCareEnrollmentItem,
  createAdminCareEnrollment,
  endAdminCareEnrollment,
  getAdminCareEnrollments,
  transferAdminCareEnrollment
} from '../../api/hivCare';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { PageHeader, StatusBadge } from '../../components/ui/patterns';
import { useAuth } from '../../context/AuthContext';

export function AdminMonitoringPage() {
  const { token } = useAuth();
  const [enrollments, setEnrollments] = useState<AdminCareEnrollmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [patientPublicId, setPatientPublicId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // End / Transfer state
  const [selectedEnrollment, setSelectedEnrollment] = useState<AdminCareEnrollmentItem | null>(null);
  const [modalAction, setModalAction] = useState<'TRANSFER' | 'END' | null>(null);
  const [targetFacilityId, setTargetFacilityId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadEnrollments = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminCareEnrollments(token, statusFilter, 1, 50);
      setEnrollments(res.items);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar care enrollment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEnrollments();
  }, [token, statusFilter]);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreateSubmitting(true);
    setCreateError('');
    setActionSuccess('');

    try {
      await createAdminCareEnrollment(token, {
        patient_public_id: patientPublicId.trim(),
        facility_id: facilityId.trim() || null
      });
      setActionSuccess('Care enrollment berhasil dibuat.');
      setPatientPublicId('');
      setFacilityId('');
      setShowCreate(false);
      await loadEnrollments();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat care enrollment.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !selectedEnrollment || !modalAction) return;
    setModalSubmitting(true);
    setModalError('');

    try {
      if (modalAction === 'TRANSFER') {
        if (!targetFacilityId.trim()) {
          setModalError('ID fasilitas tujuan wajib diisi.');
          setModalSubmitting(false);
          return;
        }
        await transferAdminCareEnrollment(token, selectedEnrollment.public_id, {
          facility_id: targetFacilityId.trim(),
          transfer_reason: actionReason.trim() || null
        });
        setActionSuccess('Care enrollment berhasil dipindahkan ke fasilitas baru.');
      } else {
        if (!actionReason.trim()) {
          setModalError('Alasan pengakhiran enrollment wajib diisi.');
          setModalSubmitting(false);
          return;
        }
        await endAdminCareEnrollment(token, selectedEnrollment.public_id, {
          end_reason: actionReason.trim()
        });
        setActionSuccess('Care enrollment berhasil diakhiri.');
      }
      setModalAction(null);
      setSelectedEnrollment(null);
      setTargetFacilityId('');
      setActionReason('');
      await loadEnrollments();
    } catch (err: any) {
      setModalError(err.message || 'Gagal memproses aksi enrollment.');
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="page-shell pb-24 space-y-8">
      <PageHeader
        eyebrow="Tata Kelola Program Layanan"
        title="Care Enrollment Pasien"
        description="Kelola siklus pendaftaran program layanan perawatan HIV tanpa mengakses data klinis atau hasil laboratorium pengguna."
        action={
          <Button
            variant="default"
            size="sm"
            id="admin-create-enrollment-btn"
            onClick={() => {
              setShowCreate((prev) => !prev);
              setCreateError('');
              setActionSuccess('');
            }}
          >
            <Icon name="activity" />
            {showCreate ? 'Tutup Formulir' : 'Daftarkan Pasien Baru'}
          </Button>
        }
      />

      {actionSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionSuccess}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* CREATE FORM */}
      {showCreate ? (
        <Card className="border-brand/40 shadow-sm" data-testid="admin-create-enrollment-form">
          <CardHeader>
            <CardTitle className="text-base">Pendaftaran Care Enrollment Baru</CardTitle>
            <CardDescription>
              Menghubungkan pasien terdaftar ke program layanan fasilitas kesehatan secara eksplisit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {createError ? (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {createError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="enrollment-patient-id" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Public ID Pasien *
                  </label>
                  <input
                    type="text"
                    required
                    id="enrollment-patient-id"
                    placeholder="Contoh: usr_123456..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    value={patientPublicId}
                    onChange={(e) => setPatientPublicId(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="enrollment-facility-id" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    ID Fasilitas Kesehatan (Opsional)
                  </label>
                  <input
                    type="text"
                    id="enrollment-facility-id"
                    placeholder="UUID Fasilitas Kesehatan..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Batal
                </Button>
                <Button type="submit" variant="default" size="sm" id="submit-admin-enrollment-btn" disabled={createSubmitting}>
                  {createSubmitting ? 'Mendaftarkan…' : 'Daftarkan Enrollment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* FILTER & LIST */}
      <section aria-labelledby="enrollment-list-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="enrollment-list-title" className="text-xl font-bold text-slate-900">
              Daftar Enrollment ({total})
            </h2>
            <p className="text-xs text-slate-500">
              Metadata pendaftaran aktif dan riwayat transisi fasilitas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Semua</option>
              <option value="ACTIVE">Aktif</option>
              <option value="TRANSFERRED">Ditransfer</option>
              <option value="ENDED">Diakhiri</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        ) : enrollments.length === 0 ? (
          <Card className="p-8 text-center border-slate-200">
            <Icon name="users" className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <strong className="text-base text-slate-800 block">Belum ada care enrollment</strong>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Daftar enrollment program perawatan akan tampil di sini.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((item) => (
              <Card key={item.public_id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <strong className="text-sm text-slate-900 block">{item.patient_alias}</strong>
                      <span className="text-2xs text-slate-500">ID: {item.patient_public_id}</span>
                    </div>
                    <StatusBadge
                      variant={
                        item.status === 'ACTIVE'
                          ? 'success'
                          : item.status === 'TRANSFERRED'
                          ? 'info'
                          : 'neutral'
                      }
                    >
                      {item.status}
                    </StatusBadge>
                  </div>

                  <div className="py-3 text-xs text-slate-600 space-y-1">
                    <p>
                      <strong className="text-slate-800">Fasilitas: </strong>
                      {item.facility ? item.facility.name : 'Belum ditetapkan'}
                    </p>
                    <p>
                      <strong className="text-slate-800">Mulai: </strong>
                      {new Date(item.enrolled_at).toLocaleDateString('id-ID')}
                    </p>
                    {item.ended_at ? (
                      <p>
                        <strong className="text-slate-800">Berakhir: </strong>
                        {new Date(item.ended_at).toLocaleDateString('id-ID')}
                      </p>
                    ) : null}
                    {item.end_reason ? (
                      <p className="text-slate-500 text-2xs italic">
                        Alasan: {item.end_reason}
                      </p>
                    ) : null}
                  </div>
                </div>

                {item.status === 'ACTIVE' ? (
                  <div className="flex gap-2 border-t border-slate-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setSelectedEnrollment(item);
                        setModalAction('TRANSFER');
                        setModalError('');
                      }}
                    >
                      Transfer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        setSelectedEnrollment(item);
                        setModalAction('END');
                        setModalError('');
                      }}
                    >
                      Akhiri
                    </Button>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* MODAL ACTION (TRANSFER / END) */}
      {modalAction && selectedEnrollment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {modalAction === 'TRANSFER'
                ? 'Pindahkan Fasilitas Enrollment'
                : 'Akhiri Care Enrollment'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pasien: {selectedEnrollment.patient_alias} ({selectedEnrollment.patient_public_id})
            </p>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              {modalError ? (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {modalError}
                </div>
              ) : null}

              {modalAction === 'TRANSFER' ? (
                <div>
                  <label htmlFor="modal-facility-id" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    ID Fasilitas Tujuan (UUID) *
                  </label>
                  <input
                    type="text"
                    required
                    id="modal-facility-id"
                    placeholder="UUID fasilitas aktif..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    value={targetFacilityId}
                    onChange={(e) => setTargetFacilityId(e.target.value)}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="modal-reason" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Alasan {modalAction === 'TRANSFER' ? 'Pemindahan' : 'Pengakhiran'} *
                </label>
                <input
                  type="text"
                  required
                  id="modal-reason"
                  placeholder={
                    modalAction === 'TRANSFER'
                      ? 'Contoh: Pindah domisili kota'
                      : 'Contoh: Selesai program pendampingan'
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModalAction(null);
                    setSelectedEnrollment(null);
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant={modalAction === 'TRANSFER' ? 'default' : 'destructive'}
                  size="sm"
                  disabled={modalSubmitting}
                >
                  {modalSubmitting
                    ? 'Memproses…'
                    : modalAction === 'TRANSFER'
                    ? 'Konfirmasi Transfer'
                    : 'Konfirmasi Akhiri'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
