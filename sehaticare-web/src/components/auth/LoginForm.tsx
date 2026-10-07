import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PasswordInput } from '../ui/password-input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../lib/roles';
import { getAuthErrorMessage } from '../../lib/authErrors';
import { Icon } from '../ui/icons';

type LoginFormProps = {
  onSuccess?: () => void;
  redirectTo?: string;
};

export function LoginForm({ onSuccess, redirectTo }: LoginFormProps) {
  const { login, anonymousLogin, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginMethod, setLoginMethod] = useState<'legacy' | 'anonymous'>('anonymous');
  const [email, setEmail] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const target = getDashboardPath(user.role);
      if (target === '/login') {
        logout(false);
        setError('Role tidak dikenali. Silakan hubungi admin.');
        return;
      }
      onSuccess?.();
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, logout, navigate, onSuccess, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    let didSucceed = false;
    try {
      const response = loginMethod === 'anonymous' ? await anonymousLogin(loginId, password) : await login(email, password);
      const destination = redirectTo && response.user.role === 'PASIEN'
        ? redirectTo
        : (location.state as { from?: Location } | undefined)?.from?.pathname || getDashboardPath(response.user.role);
      if (destination === '/login') {
        logout(false);
        setError('Role tidak dikenali. Silakan hubungi admin.');
        return;
      }
      didSucceed = true;
      setSuccess('Login berhasil. Mengalihkan...');
      onSuccess?.();
      window.setTimeout(() => navigate(destination, { replace: true }), 700);
    } catch (err) {
      setError(getAuthErrorMessage(err, 'login'));
    } finally {
      if (!didSucceed) setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Jenis akun">
        <Button
          type="button"
          variant={loginMethod === 'anonymous' ? 'default' : 'outline'}
          onClick={() => setLoginMethod('anonymous')}
          role="tab"
          aria-selected={loginMethod === 'anonymous'}
        >
          Pasien anonim
        </Button>
        <Button
          type="button"
          variant={loginMethod === 'legacy' ? 'default' : 'outline'}
          onClick={() => setLoginMethod('legacy')}
          role="tab"
          aria-selected={loginMethod === 'legacy'}
        >
          Petugas &amp; Pengelola
        </Button>
      </div>
      <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
        {loginMethod === 'anonymous'
          ? 'Untuk pasien yang masuk menggunakan ID anonim.'
          : 'Untuk konselor, fasilitator, pendamping, penjangkau, dokter, admin, dan petugas lainnya yang masuk menggunakan email.'}
      </p>
      {loginMethod === 'anonymous' ? <div className="space-y-2"><Label htmlFor="login-id">ID Login Anonim</Label><Input id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value.toUpperCase())} placeholder="SC-XXXX-XXXX-XXXX" autoComplete="username" required /></div> :
      <div className="space-y-2"><Label htmlFor="email">Email Petugas atau Pengelola</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@contoh.com" autoComplete="email" required /></div>}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          autoComplete="current-password"
          visibilityLabel="kata sandi"
          required
        />
      </div>
      {success && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Memproses...' : 'Masuk'}
      </Button>
      <div className="flex justify-end text-sm"><Link className="font-medium text-brand underline" to="/recover-account">Lupa ID atau kata sandi?</Link></div>
      <section className="space-y-3 border-t border-slate-200 pt-4" aria-labelledby="create-account-title">
        <div className="text-center">
          <h3 id="create-account-title" className="font-bold text-slate-900">Belum memiliki akun?</h3>
          <p className="mt-1 text-xs text-slate-500">Pilih jenis akun sesuai kebutuhan Anda.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/register" className="group flex min-h-24 items-start gap-3 rounded-xl border-2 border-emerald-100 bg-emerald-50/60 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Icon name="user" /></span>
            <span><strong className="block text-sm text-slate-950">Buat akun Pasien</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Akun anonim, tanpa nama asli, email, atau nomor telepon.</span></span>
          </Link>
          <Link to="/register-counselor" className="group flex min-h-24 items-start gap-3 rounded-xl border-2 border-sky-100 bg-sky-50/60 p-4 text-left transition hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800"><Icon name="users" /></span>
            <span><strong className="block text-sm text-slate-950">Buat akun Tenaga Profesional</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Untuk konselor, fasilitator, pendamping, dan penjangkau; diverifikasi admin.</span></span>
          </Link>
        </div>
      </section>
      {loading ? <p className="text-xs text-slate-500">Memproses login...</p> : null}
    </form>
  );
}
