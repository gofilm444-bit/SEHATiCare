# SEHATiCare Web (Frontend)

Frontend React + Vite + Tailwind untuk MVP dashboard SEHATiCare (login, guard, role-based shell).

## Menjalankan
1) Jalankan backend (port 3100):
   - Dari root repo: `npm run dev`
   - Atau: `cd sehaticare-api && npm run dev`
2) Jalankan frontend (port 5173):
   - `cd sehaticare-web`
   - `npm install`
   - `npm run dev`

Secara default Vite hanya bind ke loopback dan menerima `localhost`/`127.0.0.1`. Untuk uji
perangkat pada LAN tepercaya, atur `VITE_DEV_HOST` dan `VITE_ALLOWED_HOSTS` secara eksplisit
di `.env` lokal. Jangan membuka dev server ke jaringan publik.

## Akun development/testing

Akun contoh hanya dapat dibuat oleh seed backend pada environment development/testing.
Password tidak disimpan di source atau ditampilkan oleh frontend; operator development harus
menyediakannya melalui `SEED_DEMO_PASSWORD`. Demo seed ditolak pada production.

## Catatan implementasi
- Autentikasi via `POST /auth/login`; access token hanya disimpan di memori dan refresh token berada di cookie HttpOnly dengan rotasi. Vite dev server mem-proxy `/api` ke backend (lihat `vite.config.ts`), default `API_BASE_URL=/api`.
- Untuk development, pertahankan `VITE_API_BASE_URL=/api` dan atur target proxy dengan `VITE_API_TARGET=http://localhost:3100`.
- Route guard: jika tidak login diarahkan ke `/login`; jika role tidak sesuai, diarahkan ke dashboard perannya.
- App shell: sidebar & header menyesuaikan role, tombol logout membersihkan sesi dan kembali ke `/login`.
- API client: `src/api/client.ts` menempelkan header Bearer dan otomatis logout saat 401.
