import { LoginForm } from './LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type LoginCardProps = {
  onClose?: () => void;
  onSuccess?: () => void;
  redirectTo?: string;
};

export function LoginCard({ onClose, onSuccess, redirectTo }: LoginCardProps) {
  return (
    <Card className="w-full border-0 shadow-none">
      <CardHeader className="relative text-center">
        {onClose ? (
          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            onClick={onClose}
            aria-label="Tutup dialog login"
            title="Tutup"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
        <div className="flex justify-center">
          <img src="/brand/app-icon-192.png" alt="SEHATiCare" className="h-14 w-14 rounded-xl object-cover shadow-sm" />
        </div>
        <CardTitle>Masuk ke SEHATiCare</CardTitle>
        <CardDescription>Masuk sebagai pasien, konselor, dokter, atau pengelola SEHATiCare.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm onSuccess={onSuccess} redirectTo={redirectTo} />
      </CardContent>
    </Card>
  );
}
