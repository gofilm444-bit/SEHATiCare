import { ApiError } from '../api/client';

type AuthAction = 'login' | 'register';

const unavailableMessage = (action: AuthAction) =>
  action === 'login'
    ? 'Layanan login belum tersambung. Pastikan server SEHATiCare berjalan, lalu coba lagi.'
    : 'Layanan pendaftaran belum tersambung. Pastikan server SEHATiCare berjalan, lalu coba lagi.';

export function getAuthErrorMessage(error: unknown, action: AuthAction) {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return action === 'login'
        ? 'Data login belum valid. Periksa kembali informasi yang Anda masukkan.'
        : 'Data pendaftaran belum valid. Periksa alias, kata sandi, konfirmasi, dan persetujuan Anda.';
    }
    if (error.status === 401) {
      return action === 'login'
        ? 'ID login atau email dan kata sandi tidak cocok.'
        : 'Pendaftaran tidak dapat dikonfirmasi. Silakan periksa data Anda.';
    }
    if (error.status === 404) return unavailableMessage(action);
    if (error.status === 409) {
      return 'Data tersebut sudah digunakan. Silakan gunakan data lain atau masuk ke akun Anda.';
    }
    if (error.status === 429) {
      return 'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.';
    }
    if (error.status >= 500) {
      return 'Layanan sedang mengalami gangguan. Silakan coba lagi beberapa saat.';
    }
  }

  if (error instanceof Error && error.message.startsWith('Tidak dapat terhubung')) {
    return unavailableMessage(action);
  }

  return action === 'login'
    ? 'Login belum berhasil. Periksa data Anda lalu coba lagi.'
    : 'Pendaftaran belum berhasil. Periksa data Anda lalu coba lagi.';
}
