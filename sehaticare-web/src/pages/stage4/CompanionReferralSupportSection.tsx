import React, { useState, useEffect } from 'react';
import {
  fetchCompanionReferrals,
  fetchCompanionPatientReferrals,
  recordCompanionReferralAction,
  CompanionReferral
} from '../../api/referrals';

interface CompanionReferralSupportSectionProps {
  patientId?: string;
  patientAlias?: string;
}

export const CompanionReferralSupportSection: React.FC<CompanionReferralSupportSectionProps> = ({
  patientId,
  patientAlias
}) => {
  const [referrals, setReferrals] = useState<CompanionReferral[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      setError(null);
      if (patientId) {
        const res = await fetchCompanionPatientReferrals(patientId);
        setReferrals(Array.isArray(res?.items) ? res.items : []);
      } else {
        const res = await fetchCompanionReferrals();
        setReferrals(Array.isArray(res?.items) ? res.items : []);
      }
    } catch (err: any) {
      setReferrals([]);
      setError(err?.message || 'Gagal memuat dukungan rujukan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, [patientId]);

  const handleAction = async (
    referralId: string,
    actionType: 'ACKNOWLEDGED' | 'CONTACT_ATTEMPTED' | 'CONTACTED'
  ) => {
    try {
      setActionLoadingId(referralId);
      setError(null);
      await recordCompanionReferralAction(referralId, actionType);
      await loadReferrals();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui catatan dukungan');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="companion-referral-support-section">
      <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Dukungan Rujukan &amp; Navigasi Layanan
            </h2>
            <p className="text-xs text-indigo-900 mt-0.5 leading-relaxed">
              Daftar ini hanya menampilkan status operasional umum dari pasien yang telah memberikan izin berbagi pendampingan. Riwayat klinis, diagnosis, dan nama obat tetap rahasia.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Memuat status dukungan rujukan...</div>
      ) : (!referrals || referrals.length === 0) ? (
        <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800">Tidak Ada Rujukan yang Dibagikan</p>
          <p className="text-xs text-gray-500">
            {patientId
              ? `Pasien ${patientAlias || ''} belum mengaktifkan izin berbagi status rujukan dengan pendamping.`
              : 'Belum ada pasien dampingan yang membagikan status rujukan saat ini.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(referrals || []).map((referral) => {
            const isProcessing = actionLoadingId === referral.public_id;

            return (
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
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                    {referral.generic_status_label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {referral.target_facility_name && (
                    <div>
                      <span className="text-xs text-gray-400 block">Fasilitas Tujuan</span>
                      <span className="font-medium text-gray-800">{referral.target_facility_name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-gray-400 block">Status Operasional</span>
                    <span className="font-medium text-gray-800">{referral.status}</span>
                  </div>
                </div>

                {/* Companion Action Buttons */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(referral.public_id, 'ACKNOWLEDGED')}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Sudah Dilihat
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(referral.public_id, 'CONTACT_ATTEMPTED')}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Upaya Menghubungi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(referral.public_id, 'CONTACTED')}
                    disabled={isProcessing}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                  >
                    Sudah Terhubung
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
