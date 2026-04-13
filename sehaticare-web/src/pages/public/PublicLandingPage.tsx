import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  PortalCarousel,
  PortalCardSection,
  PortalFaqSection,
  buildAutoCarouselItems,
  getPublishedItems
} from '../../components/portal/PortalContentSections';
import {
  loadPortalContent,
  seedDefaultIfEmpty,
  type PortalItem
} from '../../store/portalContentStore';

export function PublicLandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [portalContent, setPortalContent] = useState(() => seedDefaultIfEmpty());
  const location = useLocation();

  useEffect(() => {
    setPortalContent(loadPortalContent());
  }, []);

  useEffect(() => {
    if (!loginOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLoginOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [loginOpen]);

  useEffect(() => {
    if (loginOpen) {
      setLoginOpen(false);
    }
  }, [location.pathname]);

  const educationHighlights = useMemo<PortalItem[]>(
    () => getPublishedItems(portalContent.edukasiAwal),
    [portalContent]
  );
  const mediaItems = useMemo<PortalItem[]>(() => {
    const videos = getPublishedItems(portalContent.video);
    const infografis = getPublishedItems(portalContent.infografis);
    return [...videos, ...infografis];
  }, [portalContent]);
  const faqs = useMemo<PortalItem[]>(() => getPublishedItems(portalContent.faq), [portalContent]);
  const manualCarouselItems = useMemo(
    () => getPublishedItems(portalContent.carouselImages),
    [portalContent]
  );
  const autoCarouselItems = useMemo(
    () => buildAutoCarouselItems(portalContent),
    [portalContent]
  );
  const carouselItems = useMemo(() => {
    if (manualCarouselItems.length === 0) return autoCarouselItems;
    const titles = new Set(manualCarouselItems.map((item) => item.title));
    const merged = manualCarouselItems.concat(
      autoCarouselItems.filter((item) => !titles.has(item.title))
    );
    return merged;
  }, [autoCarouselItems, manualCarouselItems]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-24 pt-12 md:px-8 md:pb-12">
        <header className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <img
                src="/brand/logo-sehaticare.png"
                alt="SEHATiCare"
                className="h-14 w-14 object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Portal Publik</p>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
                Tidak sendiri. Informasi HIV yang jelas dan aman.
              </h1>
            </div>
          </div>
          <p className="text-base text-slate-700 md:text-lg">
            Saat bingung atau cemas, mulai dari informasi yang benar. SEHATiCare membantu kamu memahami
            langkah awal, mengurangi stigma, dan menyiapkan konsultasi saat dibutuhkan.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/edukasi">Baca Edukasi</Link>
            </Button>
            <Button variant="outline" onClick={() => setLoginOpen(true)}>
              Login
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/login">Daftar</Link>
            </Button>
          </div>
        </header>

        {carouselItems.length ? (
          <PortalCarousel
            items={carouselItems}
            title="Sorotan edukasi & informasi"
            description="Geser untuk melihat materi visual yang sedang diprioritaskan."
          />
        ) : null}

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Apa itu HIV?</CardTitle>
              <CardDescription>Ringkas, jelas, dan tanpa stigma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand" />
                  HIV adalah virus yang menyerang sistem kekebalan tubuh.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand" />
                  Dengan terapi yang tepat, orang dengan HIV bisa hidup sehat.
                </li>
                <li className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand" />
                  Informasi yang akurat membantu mencegah stigma dan penularan.
                </li>
              </ul>
              <Link to="/edukasi" className="inline-flex text-sm font-medium text-brand hover:underline">
                Baca edukasi lengkap
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">Langkah aman pertama</CardTitle>
              <CardDescription>Jika baru tahu atau masih bingung.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-700">
              {[
                'Tarik napas dulu, wajar merasa cemas.',
                'Catat pertanyaan penting untuk tenaga kesehatan.',
                'Cari sumber informasi terpercaya.',
                'Pertimbangkan konsultasi saat kamu siap.'
              ].map((text, index) => (
                <div key={text} className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <p>{text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Mitos vs Fakta</h2>
            <p className="text-sm text-slate-600">Luruskan informasi yang sering keliru.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                myth: 'HIV menular lewat sentuhan.',
                fact: 'Tidak. HIV tidak menular lewat sentuhan, pelukan, atau berbagi makanan.'
              },
              {
                myth: 'ODHIV tidak bisa hidup normal.',
                fact: 'Dengan terapi rutin, ODHIV bisa hidup sehat dan produktif.'
              },
              {
                myth: 'HIV selalu bergejala jelas.',
                fact: 'Tidak selalu. Banyak orang tidak merasakan gejala dalam waktu lama.'
              },
              {
                myth: 'Tes HIV itu menakutkan.',
                fact: 'Tes HIV cepat dan rahasia, membantu langkah aman berikutnya.'
              }
            ].map((item) => (
              <Card key={item.myth} className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-sm text-rose-600">Mitos</CardTitle>
                  <CardDescription className="text-slate-700">{item.myth}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-emerald-700">Fakta: {item.fact}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <PortalCardSection
          title="Edukasi awal"
          description="Materi singkat untuk memahami langkah aman dan dukungan awal."
          items={educationHighlights}
          actionHref="/edukasi"
          actionLabel="Lihat"
          actionMode="toggle"
          idPrefix="portal-item"
          emptyTitle="Belum ada konten"
          emptyDescription="Konten edukasi awal akan ditambahkan."
        />

        <PortalCardSection
          title="Video, foto, dan info"
          description="Konten multimedia untuk memperjelas informasi penting."
          items={mediaItems}
          actionHref="/edukasi"
          actionLabel="Lihat"
          actionMode="toggle"
          idPrefix="portal-item"
          emptyTitle="Belum ada konten"
          emptyDescription="Konten multimedia akan ditambahkan."
        />

        <PortalFaqSection items={faqs} />

        <footer className="space-y-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
          <div className="flex flex-wrap gap-4">
            <Link to="/edukasi" className="font-medium text-slate-700 hover:underline">
              Kebijakan Privasi
            </Link>
            <span>Kontak: support@sehaticare.local</span>
            <span>Hotline: (021) 000-000</span>
          </div>
          <p className="text-xs text-slate-500">
            Informasi di portal ini bersifat edukatif dan tidak menggantikan konsultasi medis profesional.
          </p>
        </footer>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <Button asChild className="flex-1">
            <Link to="/edukasi">Baca Edukasi</Link>
          </Button>
          <Button variant="outline" onClick={() => setLoginOpen(true)}>
            Login
          </Button>
        </div>
      </div>

      {loginOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setLoginOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/60" />
          <div className="relative w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <Card className="shadow-xl">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>Masuk ke SEHATiCare</CardTitle>
                  <CardDescription>Gunakan akun yang sudah disediakan.</CardDescription>
                </div>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                  onClick={() => setLoginOpen(false)}
                  aria-label="Tutup"
                >
                  X
                </button>
              </CardHeader>
              <CardContent>
                <LoginForm onSuccess={() => setLoginOpen(false)} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
