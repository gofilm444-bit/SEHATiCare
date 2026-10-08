import React, { useState, useEffect } from 'react';
import {
  fetchPublicServiceFacilities,
  requestPatientReferral,
  PublicServiceFacility
} from '../../api/referrals';

interface PatientServiceNavigationSectionProps {
  onReferralRequested?: () => void;
}

export const PatientServiceNavigationSection: React.FC<PatientServiceNavigationSectionProps> = ({
  onReferralRequested
}) => {
  const [facilities, setFacilities] = useState<PublicServiceFacility[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facilityType, setFacilityType] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');

  // Referral Request Modal / Drawer State
  const [selectedFacility, setSelectedFacility] = useState<PublicServiceFacility | null>(null);
  const [referralType, setReferralType] = useState<string>('CONTINUITY_OF_CARE');
  const [schedulingPref, setSchedulingPref] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPublicServiceFacilities({
        q: searchQuery.trim() || undefined,
        facility_type: (facilityType as any) || undefined,
        service_type: serviceType || undefined
      });
      setFacilities(Array.isArray(res?.items) ? res.items : []);
      setTotal(res?.total || 0);
    } catch (err: any) {
      setFacilities([]);
      setError(err?.message || 'Gagal memuat daftar fasilitas layanan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFacilities();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, facilityType, serviceType]);

  const handleOpenRequest = (facility: PublicServiceFacility) => {
    setSelectedFacility(facility);
    setReferralType('CONTINUITY_OF_CARE');
    setSchedulingPref('');
    setSubmitSuccess(null);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacility) return;

    try {
      setSubmitting(true);
      setError(null);
      await requestPatientReferral({
        target_facility_id: selectedFacility.id,
        referral_type: referralType,
        scheduling_preference: schedulingPref.trim() || null
      });
      setSubmitSuccess('Permintaan rujukan berhasil dikirim. Tenaga kesehatan akan meninjau permintaan Anda.');
      if (onReferralRequested) {
        onReferralRequested();
      }
      setTimeout(() => {
        setSelectedFacility(null);
        setSubmitSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim permintaan rujukan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="patient-service-navigation">
      {/* Header & Comfort Choice Notice */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Temukan Layanan Kesehatan</h2>
            <p className="mt-1 text-emerald-900 font-medium">
              Pilih fasilitas yang paling nyaman bagi Anda.
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Anda berhak memilih fasilitas kesehatan yang memberi rasa aman dan nyaman, tanpa harus terikat jarak terdekat. Privasi Anda adalah prioritas kami.
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3 md:space-y-0 md:flex md:items-center md:gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            role="searchbox"
            placeholder="Cari puskesmas, rumah sakit, klinik, atau wilayah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={facilityType}
            onChange={(e) => setFacilityType(e.target.value)}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Tipe</option>
            <option value="PUSKESMAS">Puskesmas</option>
            <option value="RUMAH_SAKIT">Rumah Sakit</option>
            <option value="KLINIK">Klinik</option>
          </select>

          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Semua Layanan</option>
            <option value="CLINICAL_CONSULTATION">Konsultasi Klinis</option>
            <option value="HIV_TESTING">Tes HIV / VCT</option>
            <option value="ART_CONTINUITY">Kontinuitas ARV</option>
            <option value="REFERRAL_INTAKE">Penerimaan Rujukan</option>
            <option value="COUNSELING">Konseling</option>
          </select>
        </div>
      </div>

      {/* Facilities List */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Memuat direktori layanan kesehatan...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      ) : (!facilities || facilities.length === 0) ? (
        <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-600">
          Tidak ada fasilitas layanan yang sesuai dengan pencarian Anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(facilities || []).map((facility) => (
            <div
              key={facility.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                      {facility.facility_type}
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-gray-900">{facility.name}</h3>
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{facility.address}</p>

                <div className="mt-3 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {facility.service_hours}
                  </span>
                  {facility.public_contact && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {facility.public_contact}
                    </span>
                  )}
                </div>

                {/* Service Tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {facility.services.map((srv, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"
                    >
                      {srv.service.replace(/_/g, ' ')}
                      {srv.appointment_required && ' (Perlu Janji Temu)'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenRequest(facility)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                >
                  Minta Rujukan ke Sini
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Referral Request Modal */}
      {selectedFacility && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Minta Bantuan Rujukan</h3>
              <button
                type="button"
                onClick={() => setSelectedFacility(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
                {submitSuccess}
              </div>
            ) : (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Fasilitas Tujuan Pilihan Anda
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900">
                    {selectedFacility.name}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Jenis Rujukan / Kebutuhan Layanan
                  </label>
                  <select
                    value={referralType}
                    onChange={(e) => setReferralType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CONTINUITY_OF_CARE">Kontinuitas Perawatan (Pindah/Lanjutan)</option>
                    <option value="CLINICAL_FOLLOW_UP">Tindak Lanjut Klinis</option>
                    <option value="LAB_MONITORING">Pemeriksaan Laboratorium</option>
                    <option value="MEDICATION_CONTINUITY">Kontinuitas Obat</option>
                    <option value="COUNSELING">Konseling</option>
                    <option value="GENERAL_REFERRAL">Rujukan Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Preferensi Jadwal (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Rabu pagi atau minggu depan"
                    value={schedulingPref}
                    onChange={(e) => setSchedulingPref(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                  <p className="font-semibold">Informasi Alur Rujukan:</p>
                  <p>
                    Permintaan ini merupakan permohonan awal. Tenaga medis akan meninjau dan menyiapkan rujukan Anda. Rujukan tidak akan dikirimkan ke fasilitas tujuan sebelum Anda memberikan persetujuan eksplisit.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedFacility(null)}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
