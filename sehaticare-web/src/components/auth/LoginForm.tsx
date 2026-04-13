import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../lib/roles';
import { API_BASE_URL } from '../../lib/api';

type LoginFormProps = {
  onSuccess?: () => void;
};

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('patient@sehaticare.local');
  const [password, setPassword] = useState('SehatiCare123!');
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
    if (loginMethod === 'otp') {
      setError('OTP belum tersedia. Silakan gunakan login password.');
      setLoginMethod('password');
      return;
    }
    setLoading(true);
    let didSucceed = false;
    try {
      const response = await login(email, password);
      const redirectTo =
        (location.state as { from?: Location } | undefined)?.from?.pathname || getDashboardPath(response.user.role);
      if (redirectTo === '/login') {
        logout(false);
        setError('Role tidak dikenali. Silakan hubungi admin.');
        return;
      }
      didSucceed = true;
      setSuccess('Login berhasil. Mengalihkan...');
      onSuccess?.();
      window.setTimeout(() => navigate(redirectTo, { replace: true }), 700);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login gagal. Periksa email dan kata sandi.';
      setError(message);
    } finally {
      if (!didSucceed) setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={loginMethod === 'password' ? 'default' : 'outline'}
          onClick={() => setLoginMethod('password')}
        >
          Password
        </Button>
        <Button
          type="button"
          variant={loginMethod === 'otp' ? 'default' : 'outline'}
          onClick={() => setLoginMethod('otp')}
        >
          OTP
        </Button>
      </div>
      {loginMethod === 'otp' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          OTP belum tersedia. Gunakan login password terlebih dahulu.
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          autoComplete="current-password"
          required
        />
      </div>
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Memproses...' : 'Masuk'}
      </Button>
      {loading ? <p className="text-xs text-slate-500">Memproses login...</p> : null}
      <p className="text-xs text-slate-500">
        Backend:{' '}
        <span className="font-medium text-slate-700">
          {API_BASE_URL.startsWith('http')
            ? API_BASE_URL
            : `${API_BASE_URL}${import.meta.env.VITE_API_TARGET ? ` -> ${import.meta.env.VITE_API_TARGET}` : ''}`}
        </span>
      </p>
    </form>
  );
}
