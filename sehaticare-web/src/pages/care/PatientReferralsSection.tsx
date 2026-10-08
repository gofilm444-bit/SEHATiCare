import React, { useState, useEffect } from 'react';
import {
  fetchPatientReferrals,
  updatePatientReferralConsent,
  cancelPatientReferral,
  updatePatientReferralCompanionShare,
  PatientReferral
} from '../../api/referrals';

export const PatientReferralsSection: React.FC = () => {
  const [referrals, setReferrals] = useState<PatientReferral[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPatientReferrals();
      setReferrals(Array.isArray(res?.items) ? res.items : []);
    } catch (err: any) {
      setReferrals([]);
      setError(err?.message || 'Gagal memuat daftar rujukan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleToggleConsent = async (referral: PatientReferral) => {
    try {
      setActionLoadingId(referral.public_id);
      setError(null);
      const nextConsent = !referral.is_consent_enabled;
      await updatePatientReferralConsent(referral.public_id, nextConsent);
      await loadReferrals();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui persetujuan rujukan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelReferral = async (referralId: string) => {
    if (!window.confirm('Batalkan proses rujukan ini? Catatan: Pembatalan proses rujukan tidak menghapus riwayat pemeriksaan di fasilitas asal.')) {
      return;
    }
    try {
      setActionLoadingId(referralId);
      setError(null);
      await cancelPatientReferral(referralId);
      await loadReferrals();
    } catch (err: any) {
      setError(err?.message || 'Gagal membatalkan rujukan');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleCompanionShare = async (referral: PatientReferral) => {
    try {
      setActionLoadingId(referral.public_id);
      setError(null);
      const nextEnabled = !referral.companion_share.is_enabled;
      await updatePatientReferralCompanionShare(referral.public_id, {
        is_enabled: nextEnabled,
        share_target_facility: referral.companion_share.share_target_facility
      });
      await loadReferrals();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui izin berbagi pendamping');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleShareFacility = async (referral: PatientReferral) => {
    try {
      setActionLoadingId(referral.public_id);
      setError(null);
      await updatePatientReferralCompanionShare(referral.public_id, {
        is_enabled: referral.companion_share.is_enabled,
        share_target_facility: !referral.companion_share.share_target_facility
      });
      await loadReferrals();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui pengaturan fasilitas pendamping');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Menunggu Review Klinis</span>;
      case 'DRAFT':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Disiapkan Nakes</span>;
      case 'PENDING_PATIENT_CONSENT':
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">Perlu Persetujuan Anda</span>;
      case 'CONSENTED':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Persetujuan Diberikan</span>;
      case 'SENT':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">Terkirim ke Tujuan</span>;
      case 'ACCEPTED':
        return <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Diterima Fasilitas Tujuan</span>;
      case 'DECLINED':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Belum Dapat Diterima</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">Dibatalkan</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 bg-gray-900 text-white text-xs font-semibold rounded-full">Selesai</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" data-testid="patient-referrals-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Rujukan & Transfer Layanan Saya</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Pantau proses dan kelola persetujuan pengiriman rujukan Anda secara konfidensial.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReferrals}
          disabled={loading}
          className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          Perbarui
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Memuat data rujukan...</div>
      ) : (!referrals || referrals.length === 0) ? (
        <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-600 space-y-2">
          <p className="font-semibold text-gray-800">Belum Ada Permintaan Rujukan</p>
          <p className="text-sm">
            Gunakan tab &quot;Temukan Layanan&quot; untuk mencari fasilitas kesehatan yang nyaman dan meminta bantuan rujukan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(referrals || []).map((referral) => {
            const canCancel = !['ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED'].includes(referral.status);
            const isFinished = ['ACCEPTED', 'COMPLETED'].includes(referral.status);
            const isProcessing = actionLoadingId === referral.public_id;

            return (
              <div
                key={referral.public_id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
                  <div>
                    <span className="text-xs font-mono text-gray-400">ID: {referral.public_id}</span>
                    <h3 className="text-base font-bold text-gray-900 mt-0.5">
                      Tujuan: {referral.target_facility?.name || 'Fasilitas Belum Dipilih'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(referral.status)}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Kategori Rujukan</span>
                    <span className="font-medium text-gray-800">{referral.referral_type.replace(/_/g, ' ')}</span>
                  </div>
                  {referral.source_facility && (
                    <div>
                      <span className="text-xs text-gray-400 block">Fasilitas Asal</span>
                      <span className="font-medium text-gray-800">{referral.source_facility.name}</span>
                    </div>
                  )}
                  {referral.scheduling_preference && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-gray-400 block">Preferensi Jadwal</span>
                      <span className="font-medium text-gray-800">{referral.scheduling_preference}</span>
                    </div>
                  )}
                </div>

                {/* Privacy & Consent Controls */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <span className="text-sm font-semibold text-gray-900 block">
                        Persetujuan Berbagi Rujukan ke Fasilitas Tujuan
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5 max-w-lg">
                        {referral.is_consent_enabled
                          ? 'Persetujuan aktif. Nakes dapat meneruskan amplop rujukan ke dokter penerima.'
                          : 'Persetujuan belum diberikan. Rujukan tidak akan dikirim sebelum Anda mengaktifkannya.'}
                      </p>
                    </div>

                    {!isFinished && (
                      <button
                        type="button"
                        onClick={() => handleToggleConsent(referral)}
                        disabled={isProcessing}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          referral.is_consent_enabled
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isProcessing
                          ? 'Memproses...'
                          : referral.is_consent_enabled
                          ? 'Cabut Persetujuan'
                          : 'Beri Persetujuan'}
                      </button>
                    )}
                  </div>

                  {/* Companion Support Share Toggle */}
                  <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-gray-800 block">
                        Bantuan Pendamping (Status Umum Rujukan)
                      </span>
                      <p className="text-xs text-gray-500">
                        Hanya status umum proses yang dibagikan untuk pendampingan. Catatan klinis tetap rahasia.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCompanionShare(referral)}
                        disabled={isProcessing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          referral.companion_share.is_enabled
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {referral.companion_share.is_enabled ? 'Dukungan Aktif' : 'Dukungan Nonaktif'}
                      </button>

                      {referral.companion_share.is_enabled && (
                        <button
                          type="button"
                          onClick={() => handleToggleShareFacility(referral)}
                          disabled={isProcessing}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            referral.companion_share.share_target_facility
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                          title="Tampilkan nama fasilitas tujuan kepada pendamping"
                        >
                          {referral.companion_share.share_target_facility ? 'Nama RS/Puskesmas: Terlihat' : 'Nama RS/Puskesmas: Disamarkan'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cancel Action */}
                {canCancel && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => handleCancelReferral(referral.public_id)}
                      disabled={isProcessing}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Batalkan Proses Rujukan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
