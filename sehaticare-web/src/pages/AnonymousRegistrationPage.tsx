import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnonymousCredentials, registerAnonymousRequest } from '../api/client';
import { Button, buttonClassName } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordInput } from '../components/ui/password-input';
import { getAuthErrorMessage } from '../lib/authErrors';
import { Icon } from '../components/ui/icons';

const POLICY_VERSION = '2026-08-05-v1';
const MIN_PASSWORD_LENGTH = 8;

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CredentialsPanel({ credentials }: { credentials: AnonymousCredentials }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  const text = `SEHATiCare\nID Login Anonim: ${credentials.login_id}\nRecovery Code: ${credentials.recovery_code}\nSimpan offline dan jangan bagikan.`;
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sehaticare-kredensial.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-6" role="alert">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Simpan Informasi Akun Anda</h1>
        <p>Informasi ini hanya ditampilkan sekali. SEHATiCare tidak dapat melihat recovery code Anda.</p>
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Untuk masuk, cukup gunakan ID singkat berawalan <strong>SC</strong> di bawah ini. Anda tidak perlu mencatat ID sistem yang panjang.</p>
        <dl className="space-y-2 rounded-xl bg-white p-4">
          <div><dt className="text-sm font-medium text-slate-600">ID Login Anonim</dt><dd className="break-all font-mono text-xl font-bold tracking-wide">{credentials.login_id}</dd></div>
          <div><dt className="text-sm text-slate-500">Recovery Code</dt><dd className="font-mono text-lg">{credentials.recovery_code}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy}>{copied ? 'Tersalin' : 'Salin'}</Button>
          <Button variant="outline" onClick={download}>Unduh .txt</Button>
        </div>
        <label className="flex gap-2">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          Saya sudah menyimpan ID Login dan recovery code.
        </label>
        <Link
          to="/login"
          aria-disabled={!confirmed}
          className={`block rounded-lg px-4 py-2 text-center text-white ${confirmed ? 'bg-brand' : 'pointer-events-none bg-slate-400'}`}
        >
          Lanjut ke login
        </Link>
      </div>
    </main>
  );
}

export function AnonymousRegistrationPage() {
  const [form, setForm] = useState({
    alias: '',
    password: '',
    password_confirmation: '',
    accept_terms: false,
    accept_privacy: false,
    website: ''
  });
  const [credentials, setCredentials] = useState<AnonymousCredentials | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.password_confirmation) {
      setError('Konfirmasi kata sandi tidak sama. Silakan ketik ulang.');
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError('Kata sandi harus minimal 8 karakter serta mengandung huruf dan angka.');
      return;
    }

    setLoading(true);
    try {
      setCredentials(await registerAnonymousRequest({ ...form, policy_version: POLICY_VERSION }));
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'register'));
    } finally {
      setLoading(false);
    }
  };

  if (credentials) return <CredentialsPanel credentials={credentials} />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-6 flex flex-wrap items-center justify-between gap-3" aria-label="Navigasi pendaftaran">
          <Link to="/" className={buttonClassName({ variant: 'outline', className: 'bg-white' })}>
            <BackIcon />
            Kembali ke beranda
          </Link>
          <Link className="text-sm font-medium text-brand underline" to="/login">Sudah punya akun? Masuk</Link>
        </nav>

        <div className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[.8fr_1.2fr]"><aside className="bg-slate-900 p-7 text-white sm:p-9"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-cyan-200"><Icon name="shield"/></span><h1 className="mt-6 text-3xl font-bold">Buat akun anonim</h1><p className="mt-3 leading-7 text-slate-300">Tidak memerlukan nama asli, email, nomor telepon, atau media sosial.</p><ul className="mt-7 space-y-3 text-sm text-slate-300"><li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-emerald-300"/>Pilih alias yang tidak mengenali Anda</li><li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-emerald-300"/>Simpan recovery code secara offline</li><li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-emerald-300"/>Anda dapat mengatur privasi notifikasi</li></ul></aside>
        <form onSubmit={submit} className="space-y-5 p-6 sm:p-9">
          <input
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
          <div>
            <Label htmlFor="alias">Alias</Label>
            <Input id="alias" value={form.alias} onChange={(event) => setForm({ ...form, alias: event.target.value })} minLength={2} maxLength={40} required />
            <p className="text-xs text-slate-500">Jangan gunakan nama lengkap, nomor telepon, email, atau alamat.</p>
          </div>
          <div>
            <Label htmlFor="new-password">Kata sandi (minimal 8 karakter, huruf dan angka)</Label>
            <PasswordInput id="new-password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={MIN_PASSWORD_LENGTH} visibilityLabel="kata sandi" required />
          </div>
          <div>
            <Label htmlFor="confirm-password">Konfirmasi kata sandi</Label>
            <PasswordInput id="confirm-password" autoComplete="new-password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} minLength={MIN_PASSWORD_LENGTH} visibilityLabel="konfirmasi kata sandi" required />
          </div>
          <label className="flex gap-2">
            <input type="checkbox" checked={form.accept_terms} onChange={(event) => setForm({ ...form, accept_terms: event.target.checked })} required />
            Saya menyetujui Ketentuan Penggunaan versi {POLICY_VERSION}.
          </label>
          <label className="flex gap-2">
            <input type="checkbox" checked={form.accept_privacy} onChange={(event) => setForm({ ...form, accept_privacy: event.target.checked })} required />
            Saya memahami Kebijakan Privasi versi {POLICY_VERSION} dan minimisasi data.
          </label>
          {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Membuat...' : 'Buat akun anonim'}</Button>
          <Link to="/login" className={buttonClassName({ variant: 'outline', className: 'w-full' })}>
            <BackIcon />
            Kembali ke halaman login
          </Link>
        </form></div>
      </div>
    </main>
  );
}
