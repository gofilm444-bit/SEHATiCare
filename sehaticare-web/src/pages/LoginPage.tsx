import { Link } from 'react-router-dom';
import { LoginCard } from '../components/auth/LoginCard';
import { buttonClassName } from '../components/ui/button';
import { Icon } from '../components/ui/icons';

export function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50 px-4 py-6 sm:py-10">
      <a href="#login-card" className="sr-only focus:not-sr-only">Lewati ke formulir masuk</a>
      <div className="mx-auto w-full max-w-5xl">
        <Link to="/" className={buttonClassName({ variant: 'outline', className: 'mb-5 bg-white' })}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Kembali ke beranda
        </Link>
        <div className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
          <aside className="relative hidden overflow-hidden bg-slate-900 p-10 text-white lg:block"><div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/20"/><div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-cyan-400/20"/><div className="relative"><img src="/brand/app-icon-192.png" alt="" className="h-16 w-16 rounded-2xl bg-white object-cover shadow-md"/><p className="mt-10 text-sm font-bold uppercase tracking-widest text-cyan-200">Ruang dukungan privat</p><h1 className="mt-3 text-4xl font-bold leading-tight">Masuk dengan cara yang nyaman bagi Anda.</h1><ul className="mt-8 space-y-4 text-sm text-slate-300">{['Gunakan akun anonim tanpa nama asli','Notifikasi menggunakan teks netral','Kendali data tetap berada pada Anda'].map(text=><li key={text} className="flex gap-3"><Icon name="check" className="h-5 w-5 shrink-0 text-emerald-300"/>{text}</li>)}</ul></div></aside>
          <div id="login-card" className="p-2 sm:p-6 lg:p-10"><LoginCard /></div>
        </div>
      </div>
    </main>
  );
}
