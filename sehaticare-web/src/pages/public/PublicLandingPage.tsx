import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoginCard } from '../../components/auth/LoginCard';
import { apiFetch } from '../../api/client';
import { PortalCardSection, getPublishedItems } from '../../components/portal/PortalContentSections';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { Icon } from '../../components/ui/icons';
import { ActionCard } from '../../components/ui/patterns';
import { buttonClassName } from '../../components/ui/button';
import {
  cleanupLegacyPortalStorage,
  fetchPublicPortalContent,
  seedContent,
  type PortalContent,
  type PortalItem
} from '../../store/portalContentStore';
import { VideoCarousel, type Video } from './PublicContentPage';

type FeaturedArticle = {
  title: string;
  slug: string;
  summary: string;
  updated_at: string;
};

const services = [
  {icon:'chat' as const,title:'Curhat Ke Konselor',description:'Ceritakan kebutuhan Anda secara privat kepada konselor yang telah diverifikasi.',href:'/login',action:'Mulai bercerita',tone:'warm' as const},
  {icon:'calendar' as const,title:'Jadwal dan Pengingat',description:'Atur jadwal kontrol dan pengingat pribadi dalam satu tempat.',href:'/login',action:'Lihat jadwal',tone:'mint' as const},
  {icon:'book' as const,title:'Informasi Terpercaya',description:'Pelajari informasi kesehatan yang telah ditinjau dan mudah dipahami.',href:'/edukasi',action:'Baca informasi',tone:'support' as const},
  {icon:'building' as const,title:'Temukan Fasilitas',description:'Cari layanan secara manual berdasarkan wilayah—tanpa mewajibkan GPS.',href:'/informasi-layanan',action:'Cari layanan',tone:'calm' as const}
];

export function PublicLandingPage(){
  const[loginOpen,setLoginOpen]=useState(false);
  const[portal,setPortal]=useState<PortalContent>(()=>seedContent);
  const[apiFeatured,setApiFeatured]=useState<PortalItem[] | null>(null);
  const[featuredVideos,setFeaturedVideos]=useState<Video[]>([]);
  useEffect(()=>{
    cleanupLegacyPortalStorage();
    void fetchPublicPortalContent()
      .then((data)=>{
        if (data) setPortal(data);
      })
      .catch(()=>{});
    void apiFetch<{items:FeaturedArticle[]}>('/public/articles?limit=6')
      .then(({items})=>setApiFeatured(items.map((item,index)=>({
        id:`article-${item.slug}`,
        title:item.title,
        summary:item.summary,
        href:`/edukasi/${item.slug}`,
        status:'Published',
        order:index+1,
        updatedAt:item.updated_at
      }))))
      .catch(()=>setApiFeatured(null));
    void apiFetch<{items:Video[]}>('/public/videos?limit=4')
      .then(({items})=>setFeaturedVideos(items))
      .catch(()=>setFeaturedVideos([]));
  },[]);
  const featured=useMemo(()=>apiFeatured?.length ? apiFeatured : getPublishedItems([...portal.edukasiAwal,...portal.video]).slice(0,6),[apiFeatured,portal]);
  return <div className="min-h-screen bg-[#f8fbfc] text-slate-900"><a href="#main-content" className="sr-only z-[100] rounded-lg bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten utama</a>
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"><Link to="/" className="flex items-center gap-3" aria-label="SEHATiCare, beranda"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"><img src="/brand/app-icon-192.png" alt="" className="h-full w-full object-cover"/></span><div><p className="text-lg font-bold leading-tight text-slate-950">SEHATiCare</p><p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Ruang dukungan yang aman</p></div></Link><nav aria-label="Navigasi utama" className="flex items-center gap-2"><Link to="/edukasi" className="hidden min-h-11 items-center px-3 text-sm font-semibold text-slate-700 hover:text-brand sm:inline-flex">Informasi</Link><Link to="/informasi-layanan" className="hidden min-h-11 items-center px-3 text-sm font-semibold text-slate-700 hover:text-brand md:inline-flex">Layanan</Link><button type="button" onClick={()=>setLoginOpen(true)} className={buttonClassName({variant:'outline',size:'sm'})}>Masuk</button></nav></div></header>
    <main id="main-content">
      <section className="relative overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(133,111,190,.16),transparent_34%),radial-gradient(circle_at_15%_70%,rgba(23,107,135,.14),transparent_32%)]"/><div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-3 sm:px-6 sm:pb-14 sm:pt-3 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-8"><div><p className="eyebrow">Privat · Mudah · Tanpa Menghakimi</p><h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Ruang Aman untuk Bercerita dan Mendapatkan Dukungan</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Temukan informasi, layanan, dan pendampingan kesehatan secara privat, mudah, dan tanpa menghakimi.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={()=>setLoginOpen(true)} className={buttonClassName({size:'lg',className:'h-auto bg-empathy py-2.5 hover:bg-rose-700 !whitespace-normal'})}><Icon name="chat"/><span className="flex flex-col items-start leading-tight"><span>Curhat Ke Konselor</span><span className="mt-1 text-[11px] font-medium text-rose-50">Anonim / tanpa identitas</span></span></button><Link to="/informasi-layanan" className={buttonClassName({variant:'secondary',size:'lg'})}><Icon name="building"/>Cari Layanan</Link><Link to="/edukasi" className={buttonClassName({variant:'ghost',size:'lg'})}>Pelajari Informasi Kesehatan</Link></div><p className="mt-5 flex items-center gap-2 text-sm text-slate-600"><Icon name="shield" className="h-4 w-4 text-progress"/>Anda dapat menggunakan akun anonim dan pencarian layanan tidak memerlukan GPS.</p></div>
        <figure className="relative mx-auto w-full max-w-md"><div className="absolute -inset-3 -z-10 rounded-[2.75rem] bg-gradient-to-br from-sky-100/80 via-white to-violet-100/80 blur-xl"/><img src="/brand/hero-counselor-anonymous-v2.jpg" alt="Ilustrasi percakapan daring antara konselor dan pasien bertopeng anonim dengan simbol perlindungan identitas" width="900" height="900" loading="eager" fetchPriority="high" className="aspect-square w-full rounded-[2.25rem] border border-white/80 object-cover shadow-[0_24px_70px_rgba(15,35,61,.16)]"/></figure>
      </div></section>
      <section className="px-4 pb-4 sm:px-6 sm:pb-8 lg:px-8" aria-labelledby="privacy-title"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-[0_20px_60px_rgba(15,118,110,.10)] sm:p-8 lg:p-10"><div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl"/><div className="relative grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div className="flex gap-4"><span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-brand shadow-sm sm:flex"><Icon name="shield" className="h-7 w-7"/></span><div><p className="eyebrow">Kendali tetap pada Anda</p><h2 id="privacy-title" className="mt-2 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">Privasi Anda Adalah Prioritas</h2><p className="mt-4 max-w-xl leading-7 text-slate-600">Kami menerapkan minimisasi data dan perlindungan akses untuk membantu menjaga pengalaman Anda tetap privat.</p></div></div><ul className="grid gap-3 sm:grid-cols-2">{['Tidak harus menggunakan nama asli','Data konsultasi bersifat privat','Notifikasi memakai teks netral','Anda menentukan pilihan dukungan'].map(text=><li key={text} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-sm font-semibold text-slate-700 shadow-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-brand"><Icon name="check" className="h-5 w-5"/></span>{text}</li>)}</ul></div></div></section>
      {featuredVideos.length ? <section className="mx-auto max-w-7xl px-4 pb-4 pt-10 sm:px-6 lg:px-8" aria-labelledby="home-video-title"><div className="mb-5 max-w-2xl"><p className="eyebrow">Belajar melalui video</p><h2 id="home-video-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Video edukasi pilihan</h2><p className="mt-3 text-slate-600">Pilih video untuk memahami HIV/AIDS, tes, dan pentingnya mengurangi stigma. Pemutar YouTube baru diaktifkan setelah Anda menekan tombol putar.</p></div><VideoCarousel videos={featuredVideos}/><div className="mt-5"><Link to="/edukasi" className={buttonClassName({variant:'outline',size:'sm'})}><Icon name="book"/>Lihat semua edukasi</Link></div></section> : null}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="services-title"><div className="max-w-2xl"><p className="eyebrow">Layanan utama</p><h2 id="services-title" className="mt-2 text-3xl font-bold tracking-tight">Mulai dari yang Anda butuhkan</h2><p className="mt-3 text-slate-600">Aksi penting dibuat mudah ditemukan, dengan bahasa yang singkat dan ramah.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(item=><ActionCard key={item.title} {...item}/>)}</div></section>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><PortalCardSection title="Informasi pilihan" description="Artikel edukasi terbaru untuk membantu Anda mengambil langkah dengan tenang." items={featured} limit={6} actionHref="/edukasi" actionLabel="Pelajari" emptyTitle="Informasi sedang disiapkan" emptyDescription="Silakan kembali lagi untuk melihat materi terbaru."/></section>
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[1.75rem] bg-slate-900 p-7 text-white sm:p-10"><div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-widest text-cyan-200">Pencarian manual</p><h2 className="mt-2 text-3xl font-bold">Temukan fasilitas sesuai kebutuhan</h2><p className="mt-3 max-w-2xl text-slate-300">Pilih kabupaten/kota, jenis fasilitas, dan layanan. GPS tidak diwajibkan.</p></div><Link to="/informasi-layanan" className={buttonClassName({variant:'secondary',size:'lg'})}><Icon name="building"/>Temukan Layanan</Link></div></div></section>
    </main>
    <button
      type="button"
      onClick={()=>setLoginOpen(true)}
      aria-label="Curhat Ke Konselor, tombol cepat"
      className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+8.5rem)] right-4 z-[70] inline-flex min-h-12 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-empathy px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 motion-reduce:transition-none md:right-5"
    >
      <Icon name="chat" className="h-5 w-5"/>
      <span>Curhat Ke Konselor</span>
    </button>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><p>© 2026 SEHATiCare. Empati untuk semua pasien.</p><nav className="flex flex-wrap gap-5" aria-label="Navigasi footer"><Link to="/edukasi" className="hover:text-brand">Informasi kesehatan</Link><Link to="/informasi-layanan" className="hover:text-brand">Fasilitas</Link><Link to="/complaints/new" className="hover:text-brand">Pengaduan</Link></nav></div></footer>
    <AccessibleModal open={loginOpen} onClose={()=>setLoginOpen(false)} title="Masuk untuk Curhat Ke Konselor" description="Pasien masuk dengan ID anonim; petugas dan pengelola masuk menggunakan email."><LoginCard onSuccess={()=>setLoginOpen(false)} redirectTo="/patient/consultations?start=1"/></AccessibleModal>
  </div>
}
