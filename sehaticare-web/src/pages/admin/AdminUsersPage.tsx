import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  adminCreateUserRequest,
  adminResetUserPasswordRequest,
  adminRevokeUserSessionsRequest,
  adminUpdateUserRequest,
  adminUserDetailRequest,
  adminUsersRequest,
  adminUserStatusRequest,
  MANAGED_USER_ROLES,
  type AdminUser,
  type AdminUserList,
  type ManagedUserRole
} from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AccessibleModal } from '../../components/ui/AccessibleModal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PasswordInput } from '../../components/ui/password-input';

const ROLE_LABELS: Record<ManagedUserRole, string> = {
  PASIEN: 'Pasien', DOKTER: 'Dokter', ADMIN: 'Admin', COUNSELOR: 'Konselor',
  COMPLAINT_OFFICER: 'Petugas pengaduan', SUPERVISOR: 'Supervisor'
};

type PendingStatus = { user: AdminUser; next: boolean } | null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

export function AdminUsersPage() {
  const { token, user: signedInUser } = useAuth();
  const [data, setData] = useState<AdminUserList | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>(null);

  const isSuperadmin = Boolean(signedInUser?.is_superadmin || data?.is_superadmin);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError('');
      setData(await adminUsersRequest(token, page, query, role, status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daftar akun gagal dimuat');
    }
  }, [token, page, query, role, status]);

  useEffect(() => { void load(); }, [load]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const openAccount = async (item: AdminUser) => {
    if (!token) return;
    try {
      setError('');
      setSelected(await adminUserDetailRequest(token, item.public_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detail akun gagal dimuat');
    }
  };

  const confirmStatus = async () => {
    if (!token || !pendingStatus) return;
    setBusy(true);
    try {
      await adminUserStatusRequest(token, pendingStatus.user.public_id, pendingStatus.next);
      setNotice(`Akun berhasil ${pendingStatus.next ? 'diaktifkan' : 'dinonaktifkan'}. Semua sesi lama telah dicabut.`);
      setPendingStatus(null);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status akun gagal diubah');
    } finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-sm text-slate-500">{isSuperadmin ? 'Superadmin' : 'Admin'}</p><h1 className="text-2xl font-semibold">Manajemen pengguna</h1><p className="mt-1 text-sm text-slate-600">Kelola identitas, role, akses, dan sesi akun secara terkontrol.</p></div>
      {isSuperadmin ? <Button onClick={() => setCreateOpen(true)}>Buat akun</Button> : null}
    </div>

    {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

    <form onSubmit={submitSearch} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_180px_160px_auto]">
      <Input aria-label="Cari akun" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Public ID, nama, atau alias" />
      <select aria-label="Filter role" className="h-11 rounded-xl border border-slate-300 bg-white px-3" value={role} onChange={(event) => { setPage(1); setRole(event.target.value); }}><option value="">Semua role</option>{MANAGED_USER_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select>
      <select aria-label="Filter status" className="h-11 rounded-xl border border-slate-300 bg-white px-3" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select>
      <Button>Cari</Button>
    </form>

    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead><tr className="border-b bg-slate-50"><th className="p-3">Public ID</th><th>Nama / alias</th><th>Mode / role</th><th>Status</th><th className="pr-3">Aksi</th></tr></thead>
        <tbody>{data?.items.map((item) => <tr key={item.public_id} className="border-b last:border-0">
          <td className="p-3 font-mono text-xs">{item.public_id}</td>
          <td><span className="font-medium">{item.display_alias}</span>{item.is_self ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800">Anda</span> : null}</td>
          <td>{item.account_mode} / {item.is_superadmin ? 'SUPERADMIN' : ROLE_LABELS[item.role]}</td>
          <td><span className={`rounded-full px-2 py-1 text-xs ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{item.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
          <td className="pr-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void openAccount(item)}>Detail</Button>{item.can_manage ? <Button size="sm" variant="outline" onClick={() => setPendingStatus({ user: item, next: !item.is_active })}>{item.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button> : null}</div></td>
        </tr>)}</tbody>
      </table>
      {!data?.items.length ? <p className="p-6 text-center text-sm text-slate-500">Tidak ada akun yang sesuai.</p> : null}
    </div>

    <div className="flex items-center justify-between"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button><span className="text-sm">Halaman {page} · {data?.total ?? 0} akun</span><Button variant="outline" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button></div>
    <p className="text-xs text-slate-500">Daftar utama tidak menampilkan email, nomor telepon, login ID, recovery code, kata sandi, atau token. Setiap perubahan sensitif dicatat pada audit aktivitas.</p>

    <CreateAccountModal open={createOpen} token={token} onClose={() => setCreateOpen(false)} onCreated={async () => { setCreateOpen(false); setNotice('Akun baru berhasil dibuat. Kata sandi tidak disimpan atau ditampilkan kembali.'); await load(); }} />
    <AccountModal user={selected} token={token} isSuperadmin={isSuperadmin} onClose={() => setSelected(null)} onChanged={async (message) => { setSelected(null); setNotice(message); await load(); }} onStatus={(item) => setPendingStatus({ user: item, next: !item.is_active })} />
    <ConfirmationDialog open={Boolean(pendingStatus)} onClose={() => setPendingStatus(null)} onConfirm={() => void confirmStatus()} busy={busy} title={pendingStatus?.next ? 'Aktifkan akun?' : 'Nonaktifkan akun?'} description={pendingStatus?.next ? 'Akun akan dapat masuk kembali menggunakan kredensialnya.' : 'Akun tidak dapat masuk dan seluruh sesi aktifnya akan dicabut.'} confirmLabel={pendingStatus?.next ? 'Aktifkan akun' : 'Nonaktifkan akun'} />
  </div>;
}

function CreateAccountModal({ open, token, onClose, onCreated }: { open: boolean; token: string | null; onClose: () => void; onCreated: () => Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!token) return; setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      await adminCreateUserRequest(token, { email: String(form.get('email')), full_name: String(form.get('full_name')), display_alias: String(form.get('display_alias')), role: String(form.get('role')) as ManagedUserRole, password: String(form.get('password')), password_confirmation: String(form.get('password_confirmation')) });
      event.currentTarget.reset(); await onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Akun gagal dibuat'); } finally { setBusy(false); }
  };
  return <AccessibleModal open={open} onClose={onClose} title="Buat akun baru" description="Khusus superadmin. Akun dibuat sebagai akun login email."><form onSubmit={submit} className="space-y-4">{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}<Field label="Nama lengkap"><Input name="full_name" required minLength={2} maxLength={100} /></Field><Field label="Alias tampilan (opsional)"><Input name="display_alias" maxLength={64} /></Field><Field label="Email"><Input name="email" type="email" required autoComplete="off" /></Field><Field label="Role"><select name="role" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3" defaultValue="PASIEN">{MANAGED_USER_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></Field><Field label="Kata sandi sementara"><PasswordInput name="password" required minLength={8} maxLength={128} autoComplete="new-password" /></Field><Field label="Konfirmasi kata sandi"><PasswordInput name="password_confirmation" required minLength={8} maxLength={128} autoComplete="new-password" /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Batal</Button><Button disabled={busy}>{busy ? 'Membuat…' : 'Buat akun'}</Button></div></form></AccessibleModal>;
}

function AccountModal({ user, token, isSuperadmin, onClose, onChanged, onStatus }: { user: AdminUser | null; token: string | null; isSuperadmin: boolean; onClose: () => void; onChanged: (message: string) => Promise<void>; onStatus: (user: AdminUser) => void }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [resetMode, setResetMode] = useState(false);
  if (!user) return null;
  const update = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!token) return; setBusy(true); setError(''); const form = new FormData(event.currentTarget); try { await adminUpdateUserRequest(token, user.public_id, { full_name: String(form.get('full_name')), display_alias: String(form.get('display_alias')), ...(isSuperadmin ? { role: String(form.get('role')) as ManagedUserRole } : {}) }); await onChanged('Data akun berhasil diperbarui. Perubahan role otomatis mencabut semua sesi lama.'); } catch (err) { setError(err instanceof Error ? err.message : 'Akun gagal diperbarui'); } finally { setBusy(false); } };
  const reset = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!token) return; setBusy(true); setError(''); const form = new FormData(event.currentTarget); try { await adminResetUserPasswordRequest(token, user.public_id, String(form.get('new_password')), String(form.get('password_confirmation'))); await onChanged('Kata sandi berhasil direset dan semua sesi lama telah dicabut.'); } catch (err) { setError(err instanceof Error ? err.message : 'Kata sandi gagal direset'); } finally { setBusy(false); } };
  const revoke = async () => { if (!token) return; setBusy(true); setError(''); try { await adminRevokeUserSessionsRequest(token, user.public_id); await onChanged('Semua sesi akun berhasil dicabut.'); } catch (err) { setError(err instanceof Error ? err.message : 'Sesi gagal dicabut'); } finally { setBusy(false); } };
  return <AccessibleModal open onClose={onClose} title={user.is_superadmin ? 'Detail superadmin' : 'Detail akun'} description={user.public_id}>{error ? <p role="alert" className="mb-4 text-sm text-red-700">{error}</p> : null}<dl className="mb-5 grid grid-cols-[110px_1fr] gap-2 text-sm"><dt className="text-slate-500">Email</dt><dd>{user.email ?? 'Tidak tersedia'}</dd><dt className="text-slate-500">Mode</dt><dd>{user.account_mode}</dd><dt className="text-slate-500">Status</dt><dd>{user.is_active ? 'Aktif' : 'Nonaktif'}</dd><dt className="text-slate-500">Dibuat</dt><dd>{new Date(user.created_at).toLocaleString('id-ID')}</dd></dl>{user.can_manage ? <>{resetMode ? <form onSubmit={reset} className="space-y-4"><Field label="Kata sandi baru"><PasswordInput name="new_password" required minLength={8} maxLength={128} autoComplete="new-password" /></Field><Field label="Konfirmasi kata sandi"><PasswordInput name="password_confirmation" required minLength={8} maxLength={128} autoComplete="new-password" /></Field><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setResetMode(false)}>Batal</Button><Button disabled={busy}>Reset kata sandi</Button></div></form> : <form onSubmit={update} className="space-y-4"><Field label="Nama lengkap"><Input name="full_name" defaultValue={user.full_name ?? user.display_alias} required minLength={2} maxLength={100} /></Field><Field label="Alias tampilan"><Input name="display_alias" defaultValue={user.display_alias} maxLength={64} /></Field><Field label="Role"><select name="role" disabled={!isSuperadmin} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 disabled:bg-slate-100" defaultValue={user.role}>{MANAGED_USER_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></Field><div className="flex flex-wrap gap-2"><Button disabled={busy}>Simpan perubahan</Button><Button type="button" variant="outline" onClick={() => void revoke()} disabled={busy}>Cabut semua sesi</Button>{isSuperadmin && user.account_mode === 'LEGACY' ? <Button type="button" variant="outline" onClick={() => setResetMode(true)}>Reset kata sandi</Button> : null}<Button type="button" variant="outline" onClick={() => { onClose(); onStatus(user); }}>{user.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button></div></form>}</> : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Akun ini hanya dapat dikelola melalui profilnya sendiri atau oleh superadmin lain yang di-bootstrap secara lokal.</p>}</AccessibleModal>;
}
