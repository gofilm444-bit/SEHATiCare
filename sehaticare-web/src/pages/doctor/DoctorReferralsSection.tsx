import React, { useState, useEffect } from 'react';
import {
  fetchDoctorPatientReferrals,
  createDoctorReferralDraft,
  requestDoctorReferralConsent,
  sendDoctorReferral,
  cancelDoctorReferral,
  completeDoctorReferral,
  fetchEligibleDestinationClinicians,
  fetchDoctorIncomingReferrals,
  acceptDoctorIncomingReferral,
  declineDoctorIncomingReferral,
  fetchPublicServiceFacilities,
  DoctorOutgoingReferral,
  DoctorIncomingReferralEnvelope,
  DestinationClinician,
  PublicServiceFacility
} from '../../api/referrals';

interface DoctorReferralsSectionProps {
  patientId?: string;
  patientAlias?: string;
  onReferralAccepted?: () => void;
}

export const DoctorReferralsSection: React.FC<DoctorReferralsSectionProps> = ({
  patientId,
  patientAlias,
  onReferralAccepted
}) => {
  const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING'>(
    patientId ? 'OUTGOING' : 'INCOMING'
  );

  // Outgoing State
  const [outgoingReferrals, setOutgoingReferrals] = useState<DoctorOutgoingReferral[]>([]);
  const [outgoingLoading, setOutgoingLoading] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // Facilities & Clinicians for Draft Creation
  const [targetFacilities, setTargetFacilities] = useState<PublicServiceFacility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [eligibleClinicians, setEligibleClinicians] = useState<DestinationClinician[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [draftReferralType, setDraftReferralType] = useState<string>('CONTINUITY_OF_CARE');
  const [draftScheduling, setDraftScheduling] = useState<string>('');
  const [creatingDraft, setCreatingDraft] = useState<boolean>(false);

  // Incoming State
  const [incomingReferrals, setIncomingReferrals] = useState<DoctorIncomingReferralEnvelope[]>([]);
  const [incomingLoading, setIncomingLoading] = useState<boolean>(false);

  // Decline Modal State
  const [declineTarget, setDeclineTarget] = useState<DoctorIncomingReferralEnvelope | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('CAPACITY_UNAVAILABLE');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // Load outgoing referrals for scoped patient
  const loadOutgoing = async () => {
    if (!patientId) return;
    try {
      setOutgoingLoading(true);
      setError(null);
      const res = await fetchDoctorPatientReferrals(patientId);
      setOutgoingReferrals(Array.isArray(res?.items) ? res.items : []);
    } catch (err: any) {
      setOutgoingReferrals([]);
      setError(err?.message || 'Gagal memuat rujukan pasien');
    } finally {
      setOutgoingLoading(false);
    }
  };

  // Load incoming referrals
  const loadIncoming = async () => {
    try {
      setIncomingLoading(true);
      setError(null);
      const res = await fetchDoctorIncomingReferrals();
      setIncomingReferrals(Array.isArray(res?.items) ? res.items : []);
    } catch (err: any) {
      setIncomingReferrals([]);
      setError(err?.message || 'Gagal memuat rujukan masuk');
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'OUTGOING' && patientId) {
      loadOutgoing();
    } else if (activeTab === 'INCOMING') {
      loadIncoming();
    }
  }, [activeTab, patientId]);

  // Load target facilities when opening create modal
  useEffect(() => {
    if (showCreateModal) {
      fetchPublicServiceFacilities().then((res) => {
        setTargetFacilities(res.items);
        if (res.items.length > 0) {
          setSelectedFacilityId(res.items[0].id);
        }
      });
    }
  }, [showCreateModal]);

  // Load eligible clinicians when facility changes
  useEffect(() => {
    if (selectedFacilityId) {
      fetchEligibleDestinationClinicians(selectedFacilityId).then((res) => {
        setEligibleClinicians(res.items);
        if (res.items.length > 0) {
          setSelectedDoctorId(res.items[0].id);
        } else {
          setSelectedDoctorId('');
        }
      });
    }
  }, [selectedFacilityId]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !selectedFacilityId) return;

    try {
      setCreatingDraft(true);
      setError(null);
      await createDoctorReferralDraft(patientId, {
        target_facility_id: selectedFacilityId,
        target_doctor_id: selectedDoctorId || null,
        referral_type: draftReferralType,
        scheduling_preference: draftScheduling.trim() || null
      });
      setShowCreateModal(false);
      await loadOutgoing();
    } catch (err: any) {
      setError(err?.message || 'Gagal membuat draf rujukan');
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleRequestConsent = async (referralId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await requestDoctorReferralConsent(referralId);
      await loadOutgoing();
    } catch (err: any) {
      setError(err?.message || 'Gagal meminta persetujuan pasien');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReferral = async (referralId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await sendDoctorReferral(referralId);
      await loadOutgoing();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim rujukan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelReferral = async (referralId: string) => {
    if (!window.confirm('Batalkan rujukan ini?')) return;
    try {
      setActionLoading(true);
      setError(null);
      await cancelDoctorReferral(referralId);
      await loadOutgoing();
    } catch (err: any) {
      setError(err?.message || 'Gagal membatalkan rujukan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteReferral = async (referralId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await completeDoctorReferral(referralId);
      await loadOutgoing();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyelesaikan rujukan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptIncoming = async (referralId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await acceptDoctorIncomingReferral(referralId);
      await loadIncoming();
      if (onReferralAccepted) {
        onReferralAccepted();
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menerima rujukan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineTarget) return;

    try {
      setActionLoading(true);
      setError(null);
      await declineDoctorIncomingReferral(declineTarget.public_id, declineReason);
      setDeclineTarget(null);
      await loadIncoming();
    } catch (err: any) {
      setError(err?.message || 'Gagal menolak rujukan');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="doctor-referrals-section">
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('INCOMING')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'INCOMING'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Rujukan Masuk</span>
          {incomingReferrals.length > 0 && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">
              {incomingReferrals.length}
            </span>
          )}
        </button>

        {patientId && (
          <button
            type="button"
            onClick={() => setActiveTab('OUTGOING')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'OUTGOING'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Rujukan Pasien ({patientAlias || 'Pasien'})
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* TAB 1: INCOMING REFERRALS */}
      {activeTab === 'INCOMING' && (
        <div className="space-y-4">
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
            <span className="font-semibold block mb-0.5">Batas Privasi &amp; Konfidensialitas Amplop Rujukan:</span>
            Sebagai dokter penerima yang ditunjuk, Anda melihat ringkasan administratif rujukan (identitas anonim/alias, asal rujukan, dan jenis layanan). Riwayat klinis lengkap (ART, pemantauan lab, catatan medis) hanya dapat diakses setelah Anda menerima rujukan ini secara eksplisit.
          </div>

          {incomingLoading ? (
            <div className="p-8 text-center text-gray-500">Memuat rujukan masuk...</div>
          ) : incomingReferrals.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-600">
              Tidak ada rujukan masuk yang menunggu tindakan Anda.
            </div>
          ) : (
            <div className="space-y-4">
              {incomingReferrals.map((referral) => (
                <div
                  key={referral.public_id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
                    <div>
                      <span className="text-xs font-mono text-gray-400">ID: {referral.public_id}</span>
                      <h3 className="text-base font-bold text-gray-900 mt-0.5">
                        Pasien: {referral.patient_display_alias}
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                      Menunggu Konfirmasi Dokter
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Fasilitas Pengirim</span>
                      <span className="font-medium text-gray-800">{referral.source_facility_name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Jenis Layanan yang Dibutuhkan</span>
                      <span className="font-medium text-gray-800">{referral.referral_type.replace(/_/g, ' ')}</span>
                    </div>
                    {referral.scheduling_preference && (
                      <div className="sm:col-span-2">
                        <span className="text-xs text-gray-400 block">Preferensi Jadwal</span>
                        <span className="font-medium text-gray-800">{referral.scheduling_preference}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setDeclineTarget(referral)}
                      disabled={actionLoading}
                      className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptIncoming(referral.public_id)}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                      Terima Rujukan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OUTGOING REFERRALS (PATIENT SPECIFIC) */}
      {activeTab === 'OUTGOING' && patientId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">
              Riwayat Rujukan Pasien ({patientAlias})
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              + Buat Draf Rujukan
            </button>
          </div>

          {outgoingLoading ? (
            <div className="p-8 text-center text-gray-500">Memuat rujukan pasien...</div>
          ) : outgoingReferrals.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-600">
              Belum ada rujukan yang dibuat untuk pasien ini.
            </div>
          ) : (
            <div className="space-y-4">
              {outgoingReferrals.map((referral) => (
                <div
                  key={referral.public_id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
                    <div>
                      <span className="text-xs font-mono text-gray-400">ID: {referral.public_id}</span>
                      <h4 className="text-base font-bold text-gray-900 mt-0.5">
                        Tujuan: {referral.target_facility.name}
                      </h4>
                    </div>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">
                      Status: {referral.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block">Jenis Rujukan</span>
                      <span className="font-medium text-gray-800">{referral.referral_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Dokter Penerima</span>
                      <span className="font-medium text-gray-800">
                        {referral.target_doctor?.display_alias || 'Belum Ditentukan'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Persetujuan Pasien</span>
                      <span className={`font-semibold ${referral.is_consent_enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {referral.is_consent_enabled ? 'Aktif' : 'Belum Diberikan'}
                      </span>
                    </div>
                    {referral.decline_reason && (
                      <div>
                        <span className="text-xs text-red-500 block">Alasan Penolakan</span>
                        <span className="font-semibold text-red-700">{referral.decline_reason.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions according to status */}
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                    {referral.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleRequestConsent(referral.public_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                      >
                        Minta Persetujuan Pasien
                      </button>
                    )}

                    {referral.status === 'CONSENTED' && (
                      <button
                        type="button"
                        onClick={() => handleSendReferral(referral.public_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                      >
                        Kirim Rujukan ke Fasilitas Tujuan
                      </button>
                    )}

                    {referral.status === 'ACCEPTED' && (
                      <button
                        type="button"
                        onClick={() => handleCompleteReferral(referral.public_id)}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold"
                      >
                        Tandai Selesai
                      </button>
                    )}

                    {!['ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(referral.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancelReferral(referral.public_id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-xl text-xs font-semibold"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE DRAFT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Buat Draf Rujukan Pasien</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Fasilitas Tujuan
                </label>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {targetFacilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.facility_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Dokter Penerima di Fasilitas Tujuan
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Dokter Penerima (Wajib sebelum dikirim)</option>
                  {eligibleClinicians.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_alias}
                    </option>
                  ))}
                </select>
                {eligibleClinicians.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    Belum ada dokter terverifikasi yang terafiliasi dengan fasilitas ini.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Jenis Rujukan
                </label>
                <select
                  value={draftReferralType}
                  onChange={(e) => setDraftReferralType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CONTINUITY_OF_CARE">Kontinuitas Perawatan (Transfer Antar Fasilitas)</option>
                  <option value="CLINICAL_FOLLOW_UP">Tindak Lanjut Klinis</option>
                  <option value="LAB_MONITORING">Pemeriksaan Laboratorium</option>
                  <option value="MEDICATION_CONTINUITY">Kontinuitas Obat ARV</option>
                  <option value="COUNSELING">Konseling Lanjutan</option>
                  <option value="GENERAL_REFERRAL">Rujukan Umum</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Preferensi Jadwal (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Jadwal kontrol rutin bulan depan"
                  value={draftScheduling}
                  onChange={(e) => setDraftScheduling(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingDraft}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingDraft}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {creatingDraft ? 'Menyimpan...' : 'Simpan Draf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DECLINE REASON MODAL */}
      {declineTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Alasan Penolakan Rujukan</h3>
              <button
                type="button"
                onClick={() => setDeclineTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeclineIncoming} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Pilih Alasan Operasional
                </label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="CAPACITY_UNAVAILABLE">Kapasitas Layanan Penuh</option>
                  <option value="SERVICE_NOT_AVAILABLE">Layanan Spesifik Tidak Tersedia</option>
                  <option value="WRONG_SERVICE">Jenis Layanan Tidak Sesuai</option>
                  <option value="NEEDS_DIFFERENT_FACILITY">Memerlukan Fasilitas Tingkat Berbeda</option>
                  <option value="OTHER_OPERATIONAL">Kendala Operasional Lainnya</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Status netral akan disampaikan kepada tim perujuk dan pasien tanpa memuat komentar bebas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDeclineTarget(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Memproses...' : 'Tolak Rujukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
