import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import { buttonClassName } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Icon } from '../../components/ui/icons';

type Article = {
  title:string;
  slug:string;
  summary:string;
  body_markdown?:string;
  reading_minutes:number;
  source_reference:string;
  updated_at:string;
};

export type Video = {
  id:string;
  title:string;
  description:string;
  source_type:'UPLOAD'|'EXTERNAL';
  external_url?:string;
  thumbnail_alt?:string;
  duration_seconds?:number;
  file_size_bytes?:number;
  subtitle_text?:string;
  transcript_text?:string;
};

export function PublicContentPage() {
  const { slug, videoId } = useParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [article, setArticle] = useState<Article | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setArticle(null);
    setVideo(null);
    const task = slug
      ? apiFetch<Article>(`/public/articles/${encodeURIComponent(slug)}`).then(setArticle)
      : videoId
        ? apiFetch<Video>(`/public/videos/${encodeURIComponent(videoId)}`).then(setVideo)
        : Promise.all([
            apiFetch<{items:Article[]}>('/public/articles?limit=20'),
            apiFetch<{items:Video[]}>('/public/videos?limit=20')
          ]).then(([articleResponse, videoResponse]) => {
            setArticles(articleResponse.items);
            setVideos(videoResponse.items);
          });
    void task
      .catch(() => setError('Konten belum dapat dimuat. Silakan coba lagi.'))
      .finally(() => setLoading(false));
  }, [slug, videoId]);

  const isDetail = Boolean(slug || videoId);
  if (loading) return <main className="mx-auto max-w-6xl space-y-6 p-6"><ContentNavigation detail={isDetail}/><p role="status">Memuat konten ringkas...</p></main>;
  if (error) return <main className="mx-auto max-w-6xl space-y-6 p-6"><ContentNavigation detail={isDetail}/><p role="alert" className="text-red-700">{error}</p></main>;

  if (article) {
    return <main className="mx-auto max-w-3xl space-y-6 p-6">
      <ContentNavigation detail/>
      <article>
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <p>{article.summary}</p>
        <p className="text-sm">{article.reading_minutes} menit baca · Diperbarui {new Date(article.updated_at).toLocaleDateString('id-ID')}</p>
        <div className="mt-6 whitespace-pre-wrap leading-7">{article.body_markdown}</div>
        <p className="mt-6">Sumber: <a className="underline" href={article.source_reference} rel="noreferrer noopener" target="_blank">Referensi eksternal</a></p>
      </article>
    </main>;
  }

  if (video) {
    return <main className="mx-auto max-w-3xl space-y-5 p-6">
      <ContentNavigation detail/>
      <h1 className="text-3xl font-bold">{video.title}</h1>
      <p>{video.description}</p>
      <p className="text-sm">Video tidak diputar otomatis. Pemutar YouTube baru diaktifkan setelah Anda memilih putar.</p>
      {video.external_url ? <YouTubePlayer video={video}/> : <PlaybackLink id={video.id}/>} 
      <section aria-labelledby="accessibility-title">
        <h2 id="accessibility-title" className="text-xl font-bold">Informasi aksesibilitas</h2>
        <p className="whitespace-pre-wrap">{video.subtitle_text}</p>
      </section>
      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-xl font-bold">Ringkasan isi video</h2>
        <p className="whitespace-pre-wrap">{video.transcript_text}</p>
      </section>
    </main>;
  }

  return <main className="mx-auto max-w-6xl space-y-8 p-6">
    <ContentNavigation/>
    <header>
      <h1 className="text-3xl font-bold">Edukasi dan video</h1>
      <p>Artikel dan video edukasi terpilih. Pemutar video hanya diaktifkan setelah Anda menekan tombol putar.</p>
      <Link className="underline" to="/informasi-layanan">Lihat statistik kasus dan fasilitas layanan</Link>
    </header>
    <section>
      <h2 className="text-2xl font-bold">Artikel</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {articles.length ? articles.map((item) => <Card key={item.slug}>
          <CardHeader><CardTitle>{item.title}</CardTitle></CardHeader>
          <CardContent><p>{item.summary}</p><Link className="mt-3 inline-block underline" to={`/edukasi/${item.slug}`}>Baca detail</Link></CardContent>
        </Card>) : <p>Belum ada artikel terpublikasi.</p>}
      </div>
    </section>
    <section aria-labelledby="video-carousel-title">
      <h2 id="video-carousel-title" className="text-2xl font-bold">Video edukasi pilihan</h2>
      <p className="mt-1 text-sm text-slate-600">Pilih video melalui carousel. Pemutaran berlangsung di dalam SEHATiCare tanpa mengunduh video.</p>
      {videos.length ? <VideoCarousel videos={videos}/> : <p className="mt-3">Belum ada video terpublikasi.</p>}
    </section>
  </main>;
}

function ContentNavigation({ detail = false }: { detail?: boolean }) {
  return <nav aria-label="Navigasi halaman edukasi" className="flex flex-wrap gap-3">
    {detail ? <Link to="/edukasi" className={buttonClassName({variant:'outline',size:'sm'})}><Icon name="chevron" className="h-4 w-4 rotate-180"/>Kembali ke Edukasi</Link> : null}
    <Link to="/" className={buttonClassName({variant:detail?'ghost':'outline',size:'sm'})}><Icon name="home" className="h-4 w-4"/>Ke Beranda</Link>
  </nav>;
}

export function VideoCarousel({ videos }: { videos:Video[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVideo = videos[Math.min(activeIndex, videos.length - 1)];
  const select = (index:number) => setActiveIndex(Math.max(0, Math.min(videos.length - 1, index)));

  return <div className="mt-4 space-y-4" role="region" aria-roledescription="carousel" aria-label="Video edukasi HIV/AIDS">
    <Card className="overflow-hidden border-slate-200">
      <CardContent className="grid gap-5 p-4 md:grid-cols-[1.35fr_.65fr] md:p-6">
        <YouTubePlayer key={activeVideo.id} video={activeVideo}/>
        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Video {activeIndex + 1} dari {videos.length}</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{activeVideo.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{activeVideo.description}</p>
          </div>
          <Link className="text-sm font-semibold text-brand underline" to={`/edukasi/video/${activeVideo.id}`}>Lihat ringkasan dan aksesibilitas</Link>
        </div>
      </CardContent>
    </Card>
    <div className="flex items-center justify-between gap-3">
      <button type="button" className={buttonClassName({variant:'outline',size:'sm'})} disabled={activeIndex === 0} onClick={() => select(activeIndex - 1)}><Icon name="chevron" className="h-4 w-4 rotate-180"/>Sebelumnya</button>
      <div className="flex items-center gap-2" aria-label="Pilih video">
        {videos.map((item,index) => <button key={item.id} type="button" onClick={() => select(index)} aria-label={`Pilih video ${index + 1}: ${item.title}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-3 w-3 rounded-full ring-offset-2 focus:outline-none focus:ring-2 focus:ring-brand ${index === activeIndex ? 'bg-brand' : 'bg-slate-300'}`}/>) }
      </div>
      <button type="button" className={buttonClassName({variant:'outline',size:'sm'})} disabled={activeIndex === videos.length - 1} onClick={() => select(activeIndex + 1)}>Berikutnya<Icon name="chevron" className="h-4 w-4"/></button>
    </div>
  </div>;
}

function YouTubePlayer({ video }: { video:Video }) {
  const [playing, setPlaying] = useState(false);
  const youtubeId = useMemo(() => getYouTubeVideoId(video.external_url), [video.external_url]);

  if (!youtubeId) {
    return video.external_url
      ? <a className="inline-flex min-h-44 items-center justify-center rounded-2xl border bg-slate-50 p-6 font-semibold text-brand underline" href={video.external_url} target="_blank" rel="noreferrer noopener">Buka video pada situs penerbit</a>
      : <div className="flex min-h-44 items-center justify-center rounded-2xl bg-slate-100 p-6 text-slate-600">Tautan video tidak tersedia.</div>;
  }

  if (!playing) {
    return <button type="button" onClick={() => setPlaying(true)} className="group relative flex aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 text-center text-white shadow-inner focus:outline-none focus:ring-4 focus:ring-emerald-200" aria-label={`Putar ${video.title}`}>
      <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt={video.thumbnail_alt || `Thumbnail video ${video.title}`} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"/>
      <span className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/10" aria-hidden="true"/>
      <span className="relative m-auto flex flex-col items-center gap-3 px-6 py-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-2xl text-brand shadow-xl transition group-hover:scale-105 motion-reduce:transition-none" aria-hidden="true">▶</span>
        <span className="max-w-lg rounded-full bg-slate-950/70 px-4 py-2 font-semibold shadow-sm backdrop-blur-sm">Putar video di SEHATiCare</span>
        <span className="rounded-full bg-slate-950/65 px-3 py-1 text-xs text-slate-100 backdrop-blur-sm">Pemutar YouTube diaktifkan setelah tombol ini ditekan</span>
      </span>
    </button>;
  }

  return <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
    <iframe
      className="h-full w-full"
      src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
      title={video.title}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  </div>;
}

export function getYouTubeVideoId(value?:string) {
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

function PlaybackLink({ id }: { id:string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const open = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await apiFetch<{playback_url:string}>(`/public/videos/${encodeURIComponent(id)}/playback`);
      window.location.assign(response.playback_url);
    } catch {
      setMessage('Video belum dapat dibuka.');
    } finally {
      setBusy(false);
    }
  };
  return <div><button className="underline" type="button" disabled={busy} onClick={() => void open()}>{busy ? 'Menyiapkan tautan…' : 'Buka video (hemat data)'}</button>{message ? <p role="alert">{message}</p> : null}</div>;
}
