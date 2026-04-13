import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex justify-center">
            <img
              src="/brand/logo-sehaticare.png"
              alt="SEHATiCare"
              className="h-14 w-14 object-contain"
            />
          </div>
          <CardTitle>Masuk ke SEHATiCare</CardTitle>
          <CardDescription>Gunakan akun pasien, dokter, atau admin yang sudah disediakan.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
