import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { buttonClassName } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';
import { StaleContentDisclosure } from '../../components/pwa/ConnectivityBanner';

type ArticleCategory = {
  slug: string;
  name: string;
};

type Article = {
  title: string;
  slug: string;
  summary: string;
  body_markdown?: string;
  reading_minutes: number;
  source_reference: string;
  updated_at: string;
  featured?: boolean;
  content_categories?: ArticleCategory;
};

export type Video = {
  id: string;
  title: string;
  description: string;
  source_type: 'UPLOAD' | 'EXTERNAL';
  external_url?: string;
  thumbnail_alt?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  subtitle_text?: string;
  transcript_text?: string;
};

const DEFAULT_CATEGORIES: ArticleCategory[] = [
  { slug: 'all', name: 'Semua Topik' },
  { slug: 'dasar-hiv', name: 'Dasar HIV' },
  { slug: 'pencegahan-dan-tes', name: 'Pencegahan & Tes' },
  { slug: 'pengobatan-hiv', name: 'Pengobatan HIV' },
  { slug: 'dukungan-psikososial', name: 'Dukungan Psikososial' },
  { slug: 'hak-dan-layanan', name: 'Hak & Akses Layanan' }
];

export function PublicContentPage() {
  const { slug, videoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'all';

  const [articles, setArticles] = useState<Article[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>(DEFAULT_CATEGORIES);
  const [article, setArticle] = useState<Article | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch article categories safely
  useEffect(() => {
    if (slug || videoId) return;
    void apiFetch<{ items: Array<{ slug: string; name: string }> }>('/public/content-categories')
      .then((res) => {
        if (Array.isArray(res?.items) && res.items.length > 0) {
          const fetched = res.items.filter((item) => item && typeof item.slug === 'string' && typeof item.name === 'string');
          if (fetched.length > 0) {
            setCategories([{ slug: 'all', name: 'Semua Topik' }, ...fetched]);
          }
        }
      })
      .catch(() => {
        // Fallback to default categories
      });
  }, [slug, videoId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setArticle(null);
    setVideo(null);

    if (slug) {
      void apiFetch<Article>(`/public/articles/${encodeURIComponent(slug)}`)
        .then(setArticle)
        .catch(() => setError('Artikel belum dapat dimuat. Silakan coba lagi.'))
        .finally(() => setLoading(false));
      return;
    }

    if (videoId) {
      void apiFetch<Video>(`/public/videos/${encodeURIComponent(videoId)}`)
        .then(setVideo)
        .catch(() => setError('Video belum dapat dimuat. Silakan coba lagi.'))
        .finally(() => setLoading(false));
      return;
    }

    const categoryQuery = selectedCategory !== 'all' ? `&category=${encodeURIComponent(selectedCategory)}` : '';
    const task = Promise.all([
      apiFetch<{ items: Article[] }>(`/public/articles?limit=24${categoryQuery}`),
      apiFetch<{ items: Video[] }>('/public/videos?limit=20')
    ]).then(([articleResponse, videoResponse]) => {
      setArticles(articleResponse.items || []);
      setVideos(videoResponse.items || []);
    });

    void task
      .catch(() => setError('Konten belum dapat dimuat. Silakan coba lagi.'))
      .finally(() => setLoading(false));
  }, [slug, videoId, selectedCategory]);

  const handleCategorySelect = (categorySlug: string) => {
    if (categorySlug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', categorySlug);
    }
    setSearchParams(searchParams);
  };

  const isDetail = Boolean(slug || videoId);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <ContentNavigation detail={isDetail} />
        <p role="status" className="text-slate-600">Memuat konten edukasi kesehatan...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <ContentNavigation detail={isDetail} />
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 font-semibold text-rose-700">{error}</p>
      </main>
    );
  }

  // Article Detail View
  if (article) {
    const isCompositePeerStory = article.slug.includes('komposit') || article.slug.includes('perjalanan-menuju-u-equals-u');
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <ContentNavigation detail />
        <article className="space-y-6">
          <header className="space-y-3">
            {article.content_categories ? (
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                {article.content_categories.name}
              </span>
            ) : null}
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{article.title}</h1>
            <p className="text-lg leading-7 text-slate-700">{article.summary}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {article.reading_minutes} menit baca
              </span>
              <span>·</span>
              <span>Diperbarui {new Date(article.updated_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </header>

          {isCompositePeerStory ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
              <p className="font-bold">🏷️ Ilustrasi Komposit Edukatif</p>
              <p className="mt-1 leading-relaxed text-amber-900">
                Tulisan ini dirangkum dari berbagai pola pengalaman nyata komunitas dampingan untuk tujuan pembelajaran empati. Tidak ada data pribadi atau identitas individu nyata yang diungkapkan.
              </p>
            </div>
          ) : null}

          {/* Medical Disclaimer Banner */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-xs leading-relaxed text-slate-700">
            <p className="font-bold text-sky-950">ℹ️ Pemberitahuan Medis:</p>
            <p className="mt-0.5">
              Materi ini disusun untuk tujuan edukasi kesehatan masyarakat dan tidak menggantikan konsultasi langsung, diagnosis, atau rencana terapi medis dari dokter atau tenaga kesehatan profesional.
            </p>
          </div>

          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-base leading-8 text-slate-800">
            {article.body_markdown}
          </div>

          {/* Official Source Reference */}
          {article.source_reference ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <span className="font-bold text-slate-900">Sumber Referensi Resmi: </span>
              <a
                className="font-medium text-brand underline break-all hover:text-emerald-700"
                href={article.source_reference}
                rel="noreferrer noopener"
                target="_blank"
              >
                {article.source_reference}
              </a>
            </div>
          ) : null}

          {/* Quick Consultation CTA */}
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Butuh Ruang untuk Bercerita Lebih Lanjut?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Konselor sebaya dan profesional medis SEHATiCare siap mendengarkan tanpa menghakimi dan menjaga kerahasiaan Anda.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/login" className={buttonClassName({ size: 'sm', className: 'bg-empathy hover:bg-rose-700 text-white' })}>
                <Icon name="chat" className="h-4 w-4" />
                Curhat Anonim ke Konselor
              </Link>
              <Link to="/informasi-layanan" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
                <Icon name="building" className="h-4 w-4" />
                Cari Fasilitas Layanan
              </Link>
            </div>
          </div>
        </article>
      </main>
    );
  }

  // Video Detail View
  if (video) {
    return (
      <main className="mx-auto max-w-3xl space-y-5 p-6">
        <ContentNavigation detail />
        <h1 className="text-3xl font-bold">{video.title}</h1>
        <p className="text-slate-700">{video.description}</p>
        <p className="text-sm text-slate-500">Video tidak diputar otomatis. Pemutar YouTube baru diaktifkan setelah Anda memilih putar.</p>
        {video.external_url ? <YouTubePlayer video={video} /> : <PlaybackLink id={video.id} />}
        <section aria-labelledby="accessibility-title">
          <h2 id="accessibility-title" className="text-xl font-bold text-slate-900">Informasi aksesibilitas</h2>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{video.subtitle_text}</p>
        </section>
        <section aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-xl font-bold text-slate-900">Ringkasan isi video</h2>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{video.transcript_text}</p>
        </section>
      </main>
    );
  }

  // Main Public Education Index
  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6">
      <ContentNavigation />

      {/* Header with Anti-stigma Tone */}
      <header className="space-y-3">
        <p className="eyebrow text-xs font-bold uppercase tracking-wider text-brand">Pusat Edukasi & Informasi Kesehatan</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Edukasi Terverifikasi, Bebas Stigma
        </h1>
        <p className="max-w-3xl text-base text-slate-600 sm:text-lg">
          Pelajari fakta medis seputar HIV/AIDS, pencegahan darurat, terapi ARV, prinsip U=U, serta hak perlindungan privasi pasien berdasarkan regulasi resmi.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline hover:text-emerald-700" to="/informasi-layanan">
            <Icon name="building" className="h-4 w-4" />
            Lihat fasilitas kesehatan dan statistik kasus
          </Link>
        </div>
      </header>

      <StaleContentDisclosure />

      {/* Interactive U=U Foundation Section */}
      <UExplainedSection />

      {/* Category Tabs Filter */}
      <section aria-label="Kategori edukasi" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Artikel Edukasi</h2>
          <span className="text-xs font-semibold text-slate-500">{articles.length} materi tersedia</span>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pilih kategori topik edukasi">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategorySelect(cat.slug)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Article Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.length ? (
            articles.map((item) => {
              const isComposite = item.slug.includes('komposit') || item.slug.includes('perjalanan-menuju-u-equals-u');
              return (
                <Card key={item.slug} className="flex flex-col justify-between transition-shadow hover:shadow-md">
                  <CardHeader className="space-y-2">
                    {item.content_categories ? (
                      <span className="self-start rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        {item.content_categories.name}
                      </span>
                    ) : null}
                    {isComposite ? (
                      <span className="self-start rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                        🏷️ Ilustrasi Komposit
                      </span>
                    ) : null}
                    <CardTitle className="text-lg font-bold leading-snug text-slate-950">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-3 text-sm text-slate-600">{item.summary}</p>
                    <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
                      <span>{item.reading_minutes} menit baca</span>
                      <Link className="font-semibold text-brand underline hover:text-emerald-700" to={`/edukasi/${item.slug}`}>
                        Baca detail →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="col-span-full py-8 text-center text-slate-500">Belum ada artikel pada kategori ini.</p>
          )}
        </div>
      </section>

      {/* Interactive Myth vs Fact Section */}
      <MythFactSection />

      {/* Educational FAQ Accordion */}
      <FaqAccordionSection />

      {/* Video Carousel Section */}
      <section aria-labelledby="video-carousel-title" className="space-y-3">
        <h2 id="video-carousel-title" className="text-2xl font-bold text-slate-900">Video Edukasi Pilihan</h2>
        <p className="text-sm text-slate-600">Pilih video melalui carousel. Pemutaran berlangsung di dalam SEHATiCare tanpa mengunduh video.</p>
        {videos.length ? <VideoCarousel videos={videos} /> : <p className="mt-3 text-slate-500">Belum ada video terpublikasi.</p>}
      </section>

      {/* Service Navigation Action Banners */}
      <section aria-label="Akses layanan dan navigasi cepat" className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-950">Curhat Tanpa Nama</h3>
            <p className="text-sm text-slate-600">Bicara privat dengan konselor terverifikasi menggunakan akun anonim tanpa nama asli.</p>
            <Link to="/login" className="inline-flex items-center gap-1 text-sm font-bold text-rose-600 underline hover:text-rose-700">
              Mulai bercerita →
            </Link>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-slate-950">Fasilitas & Tes VCT</h3>
            <p className="text-sm text-slate-600">Cari puskesmas dan rumah sakit ramah yang menyediakan tes sukarela dan obat ARV.</p>
            <Link to="/informasi-layanan" className="inline-flex items-center gap-1 text-sm font-bold text-brand underline hover:text-emerald-700">
              Temukan faskes →
            </Link>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-slate-950">Darurat Paparan (PEP)</h3>
            <p className="text-sm text-slate-600">Baru mengalami insiden paparan berisiko dalam 72 jam? Pelajari panduan profilaksis darurat.</p>
            <Link to="/edukasi/pep-profilaksis-pasca-paparan-darurat" className="inline-flex items-center gap-1 text-sm font-bold text-brand underline hover:text-emerald-700">
              Pelajari PEP 72 Jam →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function ContentNavigation({ detail = false }: { detail?: boolean }) {
  return (
    <nav aria-label="Navigasi halaman edukasi" className="flex flex-wrap gap-3">
      {detail ? (
        <Link to="/edukasi" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
          Kembali ke Edukasi
        </Link>
      ) : null}
      <Link to="/" className={buttonClassName({ variant: detail ? 'ghost' : 'outline', size: 'sm' })}>
        <Icon name="home" className="h-4 w-4" />
        Ke Beranda
      </Link>
    </nav>
  );
}

/**
 * Interactive U=U Explainer Component
 */
function UExplainedSection() {
  return (
    <section aria-labelledby="u-equals-u-heading" className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-900 to-slate-900 p-6 text-white shadow-lg sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="space-y-3">
          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
            Konsensus Ilmiah Global
          </span>
          <h2 id="u-equals-u-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            U=U: Undetectable = Untransmittable
          </h2>
          <p className="text-base leading-relaxed text-slate-300">
            Konsensus ilmiah internasional (WHO, NIH, UNAIDS) menegaskan: Orang dengan HIV yang rutin mengonsumsi ARV dan mempertahankan viral load tersupresi (<span className="text-emerald-300 font-bold">&lt;200 kopi/mL</span>) secara stabil <span className="font-bold text-white">tidak dapat menularkan HIV kepada pasangan seksualnya</span>.
          </p>
          <div className="pt-2">
            <Link
              to="/edukasi/arv-viral-load-dan-u-equals-u"
              className={buttonClassName({ size: 'sm', className: 'bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400' })}
            >
              Baca Bukti Ilmiah U=U Lengkap →
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">Syarat Kunci</p>
            <p className="mt-1 text-sm font-semibold text-white">Kepatuhan Terapi & Supresi Stabil</p>
            <p className="mt-1 text-xs text-slate-300">Mempertahankan viral load &lt;200 kopi/mL melalui tes laboratorium berkala. Pada awal terapi, gunakan pengaman tambahan hingga supresi terkonfirmasi.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Batasan Medis</p>
            <p className="mt-1 text-sm font-semibold text-white">Khusus Transmisi Seksual</p>
            <p className="mt-1 text-xs text-slate-300">U=U tidak mencegah IMS lain atau kehamilan, dan tidak berlaku tanpa kualifikasi untuk penularan darah atau jarum suntik bersama.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Interactive Myth vs Fact Section
 */
const MYTHS_AND_FACTS = [
  {
    id: 'myth-1',
    myth: 'HIV adalah vonis mati dan tidak ada harapan hidup normal.',
    fact: 'HIV adalah kondisi kronis yang dapat dikelola dengan terapi ARV. Dengan minum obat teratur, ODHIV memiliki angka harapan hidup dan kualitas hidup yang setara dengan populasi umum.',
    source: 'WHO Fact Sheets'
  },
  {
    id: 'myth-2',
    myth: 'HIV dapat menular lewat jabat tangan, alat makan, atau gigitan nyamuk.',
    fact: 'HIV tidak dapat hidup di luar tubuh atau bereplikasi pada serangga. Air liur, keringat, dan sentuhan fisik kasual tidak menularkan HIV.',
    source: 'Kementerian Kesehatan RI'
  },
  {
    id: 'myth-3',
    myth: 'HIV adalah penyakit kutukan atau cerminan moralitas.',
    fact: 'HIV adalah agen infeksius biologis (virus). Siapa pun dapat terpapar. Menghakimi secara moral hanya memperburuk stigma dan menunda pengobatan.',
    source: 'UNAIDS Zero Discrimination'
  },
  {
    id: 'myth-4',
    myth: 'Orang dengan HIV pasti menularkan virus ke pasangannya.',
    fact: 'Melalui prinsip U=U, ODHIV yang patuh minum ARV hingga viral load tidak terdeteksi (<200 kopi/mL) tidak menularkan virus secara seksual.',
    source: 'PARTNER 1 & 2 Studies'
  },
  {
    id: 'myth-5',
    myth: 'Ibu dengan HIV pasti melahirkan bayi dengan status HIV positif.',
    fact: 'Program PPIA/PMTCT melalui ARV selama kehamilan dan persalinan terencana menekan risiko penularan ke bayi hingga kurang dari 1–2%.',
    source: 'Pedoman PPIA Kemenkes RI'
  }
];

function MythFactSection() {
  const [openId, setOpenId] = useState<string | null>('myth-1');

  return (
    <section aria-labelledby="myths-facts-title" className="space-y-4">
      <div>
        <h2 id="myths-facts-title" className="text-2xl font-bold text-slate-900">Mitos vs Fakta Seputar HIV</h2>
        <p className="mt-1 text-sm text-slate-600">Klik kartu di bawah untuk melihat fakta ilmiah yang membongkar kesalahpahaman umum.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MYTHS_AND_FACTS.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border transition-all ${
                isOpen ? 'border-emerald-300 bg-emerald-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 p-4 text-left focus:outline-none focus:ring-2 focus:ring-brand rounded-2xl"
              >
                <div>
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-rose-600">Mitos Umum:</span>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{item.myth}</p>
                </div>
                <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                  ▼
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-emerald-100 px-4 pb-4 pt-3 text-sm">
                  <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-700">Fakta Ilmiah Terverifikasi:</span>
                  <p className="mt-1 font-medium leading-relaxed text-slate-800">{item.fact}</p>
                  <p className="mt-2 text-xs text-slate-500">Rujukan: {item.source}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * FAQ Educational Accordion Component
 */
const FAQS = [
  {
    q: 'Apa perbedaan mendasar antara HIV dan AIDS?',
    a: 'HIV adalah nama virus (Human Immunodeficiency Virus) yang menyerang sistem kekebalan tubuh, khususnya sel limfosit CD4. AIDS (Acquired Immunodeficiency Syndrome) adalah tahap lanjut yang timbul jika infeksi HIV tidak diobati selama bertahun-tahun. Dengan deteksi dini dan terapi ARV teratur, seseorang dengan HIV dapat hidup sehat tanpa berkembang menjadi AIDS.'
  },
  {
    q: 'Apa yang harus dilakukan jika saya baru saja terpapar dalam kurun <72 jam?',
    a: 'Segera kunjungi faskes atau IGD rumah sakit terdekat untuk konsultasi mengenai PEP (Post-Exposure Prophylaxis). PEP adalah pengobatan darurat yang harus dimulai secepat mungkin (idealnya <24 jam dan paling lambat 72 jam setelah paparan) serta dikonsumsi selama 28 hari penuh di bawah pengawasan dokter.'
  },
  {
    q: 'Kapan waktu yang tepat untuk melakukan tes HIV setelah paparan?',
    a: 'Masa jendela bervariasi menurut jenis tes: tes cepat antibodi (3–12 minggu), tes kombinasi antigen/antibodi generasi ke-4 (18–45 hari), dan tes asam nukleat (NAT, 10–33 hari). Jika tes dilakukan saat masa jendela dan hasilnya non-reaktif, dokter akan menganjurkan tes ulang konfirmasi setelah masa jendela berakhir.'
  },
  {
    q: 'Bagaimana kerahasiaan data medis saya dilindungi?',
    a: 'Kerahasiaan catatan medis dilindungi oleh UU No. 17 Tahun 2023 tentang Kesehatan dan Permenkes No. 24 Tahun 2022 (Pasal 28). Pembukaan informasi medis dibatasi secara hukum hanya atas persetujuan pasien, perawatan medis, atau perintah pengadilan yang sah. Di SEHATiCare, sesi Anda terlindungi dengan isolasi token di RAM dan fitur Quick Exit; pada perangkat bersama, disarankan menggunakan mode penyamaran (Incognito Browsing) karena peramban web tidak menghapus riwayat penelusuran secara otomatis.'
  },
  {
    q: 'Bagaimana cara mengakses obat ARV atau PrEP di fasilitas kesehatan?',
    a: 'Layanan konseling, tes VCT, dan obat ARV disediakan melalui puskesmas atau rumah sakit rujukan pemerintah. Dokter akan melakukan pemeriksaan dasar untuk menentukan rejimen yang tepat. PrEP oral juga dapat diakses di faskes percontohan yang ditunjuk bagi individu HIV-negatif dengan risiko signifikan.'
  }
];

function FaqAccordionSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section aria-labelledby="faq-section-title" className="space-y-4">
      <div>
        <h2 id="faq-section-title" className="text-2xl font-bold text-slate-900">Pertanyaan yang Sering Diajukan (FAQ)</h2>
        <p className="mt-1 text-sm text-slate-600">Jawaban ringkas dan tepercaya mengenai tes, pengobatan, dan hak layanan.</p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openFaq === idx;
          return (
            <div key={faq.q} className="rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenFaq(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-4 text-left font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand rounded-2xl"
              >
                <span>{faq.q}</span>
                <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                  ▼
                </span>
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 p-4 text-sm leading-relaxed text-slate-700">
                  {faq.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function VideoCarousel({ videos }: { videos: Video[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVideo = videos[Math.min(activeIndex, videos.length - 1)];
  const select = (index: number) => setActiveIndex(Math.max(0, Math.min(videos.length - 1, index)));

  return (
    <div className="mt-4 space-y-4" role="region" aria-roledescription="carousel" aria-label="Video edukasi HIV/AIDS">
      <Card className="overflow-hidden border-slate-200">
        <CardContent className="grid gap-5 p-4 md:grid-cols-[1.35fr_.65fr] md:p-6">
          <YouTubePlayer key={activeVideo.id} video={activeVideo} />
          <div className="flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand">Video {activeIndex + 1} dari {videos.length}</p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">{activeVideo.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{activeVideo.description}</p>
            </div>
            <Link className="text-sm font-semibold text-brand underline" to={`/edukasi/video/${activeVideo.id}`}>
              Lihat ringkasan dan aksesibilitas
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={buttonClassName({ variant: 'outline', size: 'sm' })}
          disabled={activeIndex === 0}
          onClick={() => select(activeIndex - 1)}
        >
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
          Sebelumnya
        </button>
        <div className="flex items-center gap-2" aria-label="Pilih video">
          {videos.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(index)}
              aria-label={`Pilih video ${index + 1}: ${item.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              className={`h-3 w-3 rounded-full ring-offset-2 focus:outline-none focus:ring-2 focus:ring-brand ${
                index === activeIndex ? 'bg-brand' : 'bg-slate-300'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          className={buttonClassName({ variant: 'outline', size: 'sm' })}
          disabled={activeIndex === videos.length - 1}
          onClick={() => select(activeIndex + 1)}
        >
          Berikutnya
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function YouTubePlayer({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);
  const youtubeId = useMemo(() => getYouTubeVideoId(video.external_url), [video.external_url]);

  if (!youtubeId) {
    return video.external_url ? (
      <a
        className="inline-flex min-h-44 items-center justify-center rounded-2xl border bg-slate-50 p-6 font-semibold text-brand underline"
        href={video.external_url}
        target="_blank"
        rel="noreferrer noopener"
      >
        Buka video pada situs penerbit
      </a>
    ) : (
      <div className="flex min-h-44 items-center justify-center rounded-2xl bg-slate-100 p-6 text-slate-600">
        Tautan video tidak tersedia.
      </div>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group relative flex aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 text-center text-white shadow-inner focus:outline-none focus:ring-4 focus:ring-emerald-200"
        aria-label={`Putar ${video.title}`}
      >
        <img
          src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
          alt={video.thumbnail_alt || `Thumbnail video ${video.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/10" aria-hidden="true" />
        <span className="relative m-auto flex flex-col items-center gap-3 px-6 py-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-2xl text-brand shadow-xl transition group-hover:scale-105 motion-reduce:transition-none" aria-hidden="true">
            ▶
          </span>
          <span className="max-w-lg rounded-full bg-slate-950/70 px-4 py-2 font-semibold shadow-sm backdrop-blur-sm">
            Putar video di SEHATiCare
          </span>
          <span className="rounded-full bg-slate-950/65 px-3 py-1 text-xs text-slate-100 backdrop-blur-sm">
            Pemutar YouTube diaktifkan setelah tombol ini ditekan
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
        title={video.title}
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

export function getYouTubeVideoId(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') candidate = url.searchParams.get('v') ?? '';
      else candidate = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)?.[1] ?? '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function PlaybackLink({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const open = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await apiFetch<{ playback_url: string }>(`/public/videos/${encodeURIComponent(id)}/playback`);
      window.location.assign(response.playback_url);
    } catch {
      setMessage('Video belum dapat dibuka.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button className="underline" type="button" disabled={busy} onClick={() => void open()}>
        {busy ? 'Menyiapkan tautan…' : 'Buka video (hemat data)'}
      </button>
      {message ? <p role="alert">{message}</p> : null}
    </div>
  );
}
