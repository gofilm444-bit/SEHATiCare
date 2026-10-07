import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getPatientCompanion,
  PatientActiveCompanionResponse,
  startCompanionConversation,
  getPatientActiveCompanionConversation,
} from '../api/companionAssignments';
import { consultationApi, ConsultationOverviewItem } from '../api/consultations';
import { Button, buttonClassName } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Icon } from '../components/ui/icons';
import { ActionCard, HeroCard, PageHeader, Skeleton, StatusBadge } from '../components/ui/patterns';
import { useAuth } from '../context/AuthContext';

const openStatuses = new Set(['QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'ESCALATED']);

function sessionState(session: ConsultationOverviewItem | null) {
  if (!session) return { label: 'Belum ada sesi aktif', action: 'Curhat Ke Konselor', path: '/patient/consultations?start=1', variant: 'outline' as const };
  if (session.has_unread) return { label: 'Ada balasan baru', action: 'Buka Balasan', path: session.detail_path, variant: 'success' as const };
  if (['QUEUED', 'ESCALATED'].includes(session.status)) return { label: 'Menunggu konselor', action: 'Lihat Status Curhat', path: session.detail_path, variant: 'info' as const };
  if (session.status === 'WAITING_USER') return { label: 'Menunggu balasan Anda', action: 'Lanjutkan Curhat', path: session.detail_path, variant: 'info' as const };
  return { label: 'Konselor telah ditugaskan', action: 'Lanjutkan Curhat', path: session.detail_path, variant: 'success' as const };
}

export function PatientDashboard() {
  const nav = useNavigate();
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<ConsultationOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companionData, setCompanionData] = useState<PatientActiveCompanionResponse | null>(null);
  const [loadingCompanion, setLoadingCompanion] = useState(true);
  const [contactingCompanion, setContactingCompanion] = useState(false);
  const [companionActionError, setCompanionActionError] = useState('');

  const auth = useMemo(() => ({ token, onUnauthorized: handleUnauthorized }), [handleUnauthorized, token]);

  const handleContactCompanion = async () => {
    if (!token) return;
    setContactingCompanion(true);
    setCompanionActionError('');
    try {
      const activeRes = await getPatientActiveCompanionConversation(token);
      if (activeRes.has_active_conversation && activeRes.conversation_public_id) {
        nav(`/patient/consultations/${activeRes.conversation_public_id}`);
        return;
      }
      const res = await startCompanionConversation(token, {
        initial_message: 'Halo, saya ingin memulai sesi pendampingan.'
      });
      nav(`/patient/consultations/${res.conversation_public_id}`);
    } catch (err: any) {
      setCompanionActionError(err.message || 'Gagal menghubungkan ke pendamping. Silakan coba lagi.');
    } finally {
      setContactingCompanion(false);
    }
  };

  const handleStartCompanionSupport = async () => {
    if (!token) return;
    setContactingCompanion(true);
    setCompanionActionError('');
    try {
      const res = await startCompanionConversation(token, {
        initial_message: 'Halo, saya ingin mengajukan pendampingan layanan.'
      });
      nav(`/patient/consultations/${res.conversation_public_id}`);
    } catch (err: any) {
      setCompanionActionError(err.message || 'Gagal memulai pendampingan. Silakan coba lagi.');
    } finally {
      setContactingCompanion(false);
    }
  };

  useEffect(() => {
    void consultationApi
      .overview(auth)
      .then((r) => setItems(r.items))
      .catch(() => setError('Status konsultasi belum dapat dimuat. Coba lagi beberapa saat.'))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => {
    if (!token) {
      setLoadingCompanion(false);
      return;
    }
    void getPatientCompanion(token)
      .then((res) => setCompanionData(res))
      .catch(() => setCompanionData(null))
      .finally(() => setLoadingCompanion(false));
  }, [token]);

  const active = (items || []).find((item) => openStatuses.has(item.status)) ?? null;
  const state = sessionState(active);
  const historyCount = (items || []).filter((item) => ['CLOSED', 'CANCELLED', 'SELESAI'].includes(item.status)).length;

  return (
    <div className="page-shell pb-24 space-y-8">
      <PageHeader
        eyebrow="Hari ini"
        title="Halo, bagaimana kabar Anda hari ini?"
        description="Pilih langkah yang paling membantu. Anda tidak perlu melakukan semuanya sekaligus."
      />

      <HeroCard
        tone="warm"
        eyebrow="Dukungan privat"
        title="Butuh teman bicara?"
        description="Ceritakan keluhan, pertanyaan, atau dukungan yang Anda butuhkan secara privat."
        action={
          <Button size="lg" onClick={() => nav(state.path)}>
            <Icon name="chat" />
            {state.action}
          </Button>
        }
        secondary={
          loading ? (
            <Skeleton className="h-11 w-36" />
          ) : (
            <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
          )
        }
      />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <Icon name="help" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Belum dapat memperbarui status</p>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {/* PENDAMPING SAYA */}
      <section aria-labelledby="companion-section-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Dukungan Berkelanjutan</p>
            <h2 id="companion-section-title" className="mt-1 text-2xl font-bold">
              Pendamping Saya
            </h2>
          </div>
        </div>
        <div className="mt-4">
          {loadingCompanion ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : companionData?.assigned && companionData.companion ? (
            <Card>
              <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-brand">
                    <Icon name="user" className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-lg text-slate-950">
                        {companionData.companion.professional_name}
                      </strong>
                      <StatusBadge variant="success">Pendamping Aktif</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {companionData.companion.facility
                        ? `Fasilitas: ${companionData.companion.facility.name}`
                        : 'Pendamping Layanan Berkelanjutan'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Mendampingi sejak{' '}
                      {companionData.started_at
                        ? new Date(companionData.started_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    id="contact-companion-btn"
                    onClick={handleContactCompanion}
                    disabled={contactingCompanion}
                  >
                    <Icon name="chat" />
                    {contactingCompanion ? 'Menghubungkan…' : 'Hubungi Pendamping'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed bg-slate-50/60">
              <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                    <Icon name="users" className="h-5 w-5" />
                  </span>
                  <div>
                    <strong className="text-sm font-semibold text-slate-900">
                      Belum ada pendamping aktif
                    </strong>
                    <p className="text-xs text-slate-500">
                      Tenaga pendamping dapat ditugaskan oleh administrator layanan untuk membantu perjalanan perawatan Anda.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  id="start-companion-support-btn"
                  onClick={handleStartCompanionSupport}
                  disabled={contactingCompanion}
                >
                  <Icon name="chat" />
                  {contactingCompanion ? 'Memproses…' : 'Mulai Pendampingan'}
                </Button>
              </CardContent>
            </Card>
          )}
          {companionActionError ? (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {companionActionError}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="today-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ringkasan hari ini</p>
            <h2 id="today-title" className="mt-1 text-2xl font-bold">
              Yang mungkin Anda perlukan
            </h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            icon="calendar"
            title="Jadwal Anda"
            description="Lihat jadwal kontrol berikutnya dan kelola rencana kunjungan."
            href="/patient/schedules"
            action="Lihat jadwal"
            tone="calm"
          />
          <ActionCard
            icon="bell"
            title="Pengingat Anda"
            description="Periksa jadwal pengingat dan riwayat respons dalam satu tempat."
            href="/patient/medication-reminders"
            action="Buka pengingat"
            tone="mint"
          />
          <article className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-800">
              <Icon name="clock" />
            </span>
            <h3 className="mt-4 text-lg font-bold">Riwayat konsultasi</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
              {historyCount
                ? `${historyCount} sesi selesai tersedia untuk Anda lihat kembali.`
                : 'Riwayat sesi selesai akan muncul di sini.'}
            </p>
            <Link
              to="/patient/consultations"
              className={buttonClassName({
                variant: 'ghost',
                className: 'mt-4 justify-start px-0 text-brand',
              })}
            >
              Lihat riwayat
              <Icon name="chevron" className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="recommend-title">
        <div>
          <p className="eyebrow">Jelajahi dengan tenang</p>
          <h2 id="recommend-title" className="mt-1 text-2xl font-bold">
            Informasi dan layanan pilihan
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ActionCard
            icon="book"
            title="Informasi kesehatan"
            description="Baca materi terpercaya dengan bahasa yang mudah dipahami."
            href="/patient/education"
            action="Baca informasi"
            tone="support"
          />
          <ActionCard
            icon="building"
            title="Temukan fasilitas"
            description="Cari fasilitas terverifikasi secara manual tanpa mewajibkan GPS."
            href="/informasi-layanan"
            action="Cari layanan"
            tone="calm"
          />
          <Card className="bg-slate-900 text-white">
            <CardHeader className="border-white/10">
              <CardTitle className="text-white">Privasi dalam kendali Anda</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-300">
                Notifikasi menggunakan teks netral. Anda juga dapat mengatur preferensi pemberitahuan kapan saja.
              </p>
              <Link
                to="/patient/notification-preferences"
                className={buttonClassName({ variant: 'secondary', className: 'mt-5' })}
              >
                Atur preferensi
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
