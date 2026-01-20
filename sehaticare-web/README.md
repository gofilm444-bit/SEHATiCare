# SEHATiCare Web (Frontend)

Frontend React + Vite + Tailwind untuk MVP dashboard SEHATiCare (login, guard, role-based shell).

## Menjalankan
1) Jalankan backend (port 3000):
   - Dari root repo: `npm run dev`
   - Atau: `cd sehaticare-api && npm run dev`
2) Jalankan frontend (port 5173):
   - `cd sehaticare-web`
   - `npm install`
   - `npm run dev`

## Akun demo (seeded)
- Admin: `admin@sehaticare.local` / `SehatiCare123!`
- Dokter: `doctor@sehaticare.local` / `SehatiCare123!`
- Pasien: `patient@sehaticare.local` / `SehatiCare123!`

## Catatan implementasi
- Autentikasi via `POST /auth/login`, token + user disimpan di localStorage. Vite dev server mem-proxy `/api` ke `http://localhost:3000` (lihat `vite.config.ts`), default `API_BASE_URL=/api`.
- Jika ingin hardcode host berbeda, set `.env` di frontend: `VITE_API_BASE_URL=http://localhost:3000` (butuh CORS di backend jika beda origin).
- Route guard: jika tidak login diarahkan ke `/login`; jika role tidak sesuai, diarahkan ke dashboard perannya.
- App shell: sidebar & header menyesuaikan role, tombol logout membersihkan sesi dan kembali ke `/login`.
- API client: `src/api/client.ts` menempelkan header Bearer dan otomatis logout saat 401.
