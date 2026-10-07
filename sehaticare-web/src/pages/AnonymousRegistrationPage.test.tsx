import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AnonymousRegistrationPage } from './AnonymousRegistrationPage';

const credentials = { public_id: 'usr_123', login_id: 'SC-ABCD-EFGH-IJKL', alias: 'Bintang', recovery_code: 'ABCDE-FGHIJ-KLMNP-QRSTU' };
const ok = () => new Response(JSON.stringify(credentials), { status: 201, headers: { 'Content-Type': 'application/json' } });
function view() { return render(<MemoryRouter><AnonymousRegistrationPage /></MemoryRouter>); }
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Alias'), 'Bintang');
  await user.type(screen.getByLabelText(/Kata sandi \(minimal/), 'Anonim-aman-2026');
  await user.type(screen.getByLabelText('Konfirmasi kata sandi'), 'Anonim-aman-2026');
  for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);
}

test('form requires alias, password, and versioned consent but no email or phone', () => {
  view(); expect(screen.getByLabelText('Alias')).toBeRequired(); expect(screen.getByLabelText(/Kata sandi \(minimal/)).toBeRequired(); expect(screen.getByLabelText(/Kata sandi \(minimal/)).toHaveAttribute('minlength', '8');
  expect(screen.getByRole('button', { name: 'Tampilkan kata sandi' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Tampilkan konfirmasi kata sandi' })).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(2); expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument(); expect(screen.queryByLabelText(/telepon|phone/i)).not.toBeInTheDocument();
});

test('registration sends no contact identity and shows credentials once', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok()); const user = userEvent.setup(); view(); await fill(user); await user.click(screen.getByRole('button', { name: 'Buat akun anonim' }));
  expect(await screen.findByText('Simpan Informasi Akun Anda')).toHaveFocus(); expect(screen.getByText(credentials.login_id)).toBeInTheDocument(); expect(screen.getByText(credentials.recovery_code)).toBeInTheDocument();
  expect(screen.getByText(/cukup gunakan ID singkat/i)).toBeInTheDocument(); expect(screen.queryByText(credentials.public_id)).not.toBeInTheDocument();
  const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)); expect(request).not.toHaveProperty('email'); expect(request).not.toHaveProperty('phone_e164'); expect(request.policy_version).toBe('2026-08-05-v1'); expect(JSON.stringify(localStorage)).not.toContain(credentials.recovery_code);
});

test('copy action gives feedback and confirmation gates continuation', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok()); const user = userEvent.setup(); view(); await fill(user); await user.click(screen.getByRole('button', { name: 'Buat akun anonim' }));
  await user.click(await screen.findByRole('button', { name: 'Salin' })); expect(screen.getByRole('button', { name: 'Tersalin' })).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Lanjut ke login' }); expect(link).toHaveAttribute('aria-disabled', 'true'); await user.click(screen.getByRole('checkbox')); expect(link).toHaveAttribute('aria-disabled', 'false');
});

test('registration exposes safe error and loading states', async () => {
  let resolve!: (value: Response) => void; vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((done) => { resolve = done; })); const user = userEvent.setup(); view(); await fill(user); await user.click(screen.getByRole('button', { name: 'Buat akun anonim' })); expect(screen.getByRole('button', { name: 'Membuat...' })).toBeDisabled(); resolve(new Response(JSON.stringify({ message: 'Invalid request' }), { status: 400 })); expect(await screen.findByRole('alert')).toHaveTextContent('Data pendaftaran belum valid');
});

test('keyboard navigation reaches the clear back-to-home action first', async () => {
  const user = userEvent.setup(); view(); await user.tab(); expect(screen.getByRole('link', { name: 'Kembali ke beranda' })).toHaveFocus();
});
